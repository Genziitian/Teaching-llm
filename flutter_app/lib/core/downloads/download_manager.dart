import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

import '../../config/api_config.dart';
import '../auth/token_storage.dart';
import 'download_db.dart';
import 'url_resolver.dart';

/// Orchestrates the full download lifecycle for PDFs and lecture videos:
/// temp-file write, atomic rename on success, metadata persistence,
/// deletion, and storage queries.
class DownloadManager {
  DownloadManager({TokenStorage? tokenStorage})
      : _tokens = tokenStorage ?? const TokenStorage();

  final TokenStorage _tokens;
  final DownloadDb _db = DownloadDb.instance;

  // Active download cancel-tokens keyed by contentId
  final Map<String, CancelToken> _active = {};

  /// Returns `true` if a download for [contentId] is currently in progress.
  bool isDownloading(String contentId) => _active.containsKey(contentId);

  /// Cancel an in-progress download.
  void cancel(String contentId) {
    _active[contentId]?.cancel('User cancelled');
    _active.remove(contentId);
  }

  // ─── DOWNLOAD ──────────────────────────────────────────────────────

  /// Download a PDF or video file and persist metadata. Yields [DownloadProgress] events.
  ///
  /// On success the final event has [DownloadProgress.done] == true.
  /// On failure [DownloadProgress.error] is non-null.
  ///
  /// The file is first written to a `.tmp` path and renamed to `.mp4`/`.pdf`
  /// only after the download succeeds.
  Stream<DownloadProgress> download({
    required String userId,
    required String contentId,
    required String contentType,
    required String title,
    String? courseId,
    String? courseName,
    String? version,
  }) async* {
    if (_active.containsKey(contentId)) return;

    final token = await _tokens.read();
    if (token == null || token.isEmpty) {
      yield DownloadProgress.failed('Not signed in — please log in again.');
      return;
    }

    final isVideo = contentType.toUpperCase() == 'VIDEO';
    final ext = isVideo ? 'mp4' : 'pdf';
    final subFolder = isVideo ? 'videos' : 'notes';

    // Build destination path: {appDocDir}/downloads/{subFolder}/{userId}/{courseId}/{contentId}.{ext}
    final baseDir = await getApplicationDocumentsDirectory();
    final dlDir = Directory(
      p.join(baseDir.path, 'downloads', subFolder, userId, courseId ?? '_global'),
    );
    if (!await dlDir.exists()) {
      await dlDir.create(recursive: true);
    }
    final finalPath = p.join(dlDir.path, '$contentId.$ext');
    final tmpPath = '$finalPath.tmp';

    // Cleanup stale temp file from a previous interrupted attempt.
    final tmpFile = File(tmpPath);
    if (await tmpFile.exists()) {
      try {
        await tmpFile.delete();
      } catch (_) {}
    }

    final proxyPath = UrlResolver.resolve(contentId, contentType);
    final url = '${ApiConfig.baseUrl}$proxyPath';

    final cancelToken = CancelToken();
    _active[contentId] = cancelToken;

    final acceptHeader = isVideo
        ? 'video/mp4,video/*;q=0.9,*/*;q=0.5'
        : 'application/pdf,*/*;q=0.5';

    final dio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: isVideo
          ? const Duration(minutes: 30)
          : const Duration(minutes: 10),
      headers: {
        'Authorization': 'Bearer $token',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': acceptHeader,
      },
      validateStatus: (_) => true,
    ));

    final progressController = StreamController<DownloadProgress>();

    try {
      yield const DownloadProgress(received: 0, total: null);

      // Store notes live in private storage: ask our API for a short-lived
      // signed URL (this also enforces purchase + expiry), then fetch the
      // file from it with a plain client that carries no auth header.
      var fetchUrl = url;
      var client = dio;
      if (contentType.toUpperCase() == UrlResolver.typeStoreNote) {
        final meta = await dio.get<dynamic>(
          url,
          queryParameters: {'format': 'json'},
          options: Options(
            responseType: ResponseType.json,
            headers: {'Accept': 'application/json'},
          ),
        );
        final data = meta.data;
        final signed = data is Map ? data['url'] as String? : null;
        if (meta.statusCode != 200 || signed == null || signed.isEmpty) {
          _active.remove(contentId);
          final msg = data is Map ? data['error'] as String? : null;
          yield DownloadProgress.failed(
              msg ?? 'This note is not available. It may have expired.');
          return;
        }
        fetchUrl = signed;
        client = Dio(BaseOptions(
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(minutes: 10),
          validateStatus: (_) => true,
        ));
      }

      final downloadFuture = client.download(
        fetchUrl,
        tmpPath,
        cancelToken: cancelToken,
        onReceiveProgress: (received, total) {
          progressController.add(DownloadProgress(
            received: received,
            total: total > 0 ? total : null,
          ));
        },
      );

      final sub = progressController.stream.listen((p) {});

      final completer = Completer<Response>();

      downloadFuture.then((res) {
        if (!completer.isCompleted) completer.complete(res);
      }).catchError((e) {
        if (!completer.isCompleted) completer.completeError(e);
      });

      while (!completer.isCompleted) {
        await Future.delayed(const Duration(milliseconds: 100));
      }

      final res = await completer.future;
      _active.remove(contentId);
      await progressController.close();
      await sub.cancel();

      final status = res.statusCode ?? 0;
      if (status != 200 && status != 206) {
        await _cleanupTmp(tmpPath);
        yield DownloadProgress.failed(_httpError(status));
        return;
      }

      // Validate the downloaded file before finalising.
      final tmp = File(tmpPath);
      if (!await tmp.exists()) {
        yield DownloadProgress.failed('Download produced no file.');
        return;
      }
      final fileSize = await tmp.length();
      if (fileSize == 0) {
        await _cleanupTmp(tmpPath);
        yield DownloadProgress.failed('Downloaded file is empty.');
        return;
      }

      // Atomic rename: tmp → final
      await tmp.rename(finalPath);

      // Persist metadata in local DB
      await _db.upsert(
        userId: userId,
        contentId: contentId,
        contentType: contentType,
        courseId: courseId,
        courseName: courseName,
        title: title,
        localPath: finalPath,
        originalUrl: url,
        fileSize: fileSize,
        version: version,
      );

      yield DownloadProgress(
        received: fileSize,
        total: fileSize,
        done: true,
        localPath: finalPath,
      );
    } on DioException catch (e) {
      _active.remove(contentId);
      await _cleanupTmp(tmpPath);
      if (CancelToken.isCancel(e)) {
        yield DownloadProgress.failed('Download cancelled.');
      } else {
        yield DownloadProgress.failed(_dioError(e));
      }
    } catch (e) {
      _active.remove(contentId);
      await _cleanupTmp(tmpPath);
      if (e is FileSystemException &&
          e.message.contains('No space left on device')) {
        yield DownloadProgress.failed(
          'Insufficient storage space. Free up some space and try again.',
        );
      } else {
        yield DownloadProgress.failed(e.toString());
      }
    }
  }

  // ─── STATUS ────────────────────────────────────────────────────────

  /// Returns the local path if [contentId] has been downloaded by [userId]
  /// and the file still exists on disk.
  Future<String?> localPathIfExists(String userId, String contentId) async {
    final row = await _db.find(userId, contentId);
    if (row == null) return null;
    final path = row['localPath'] as String;
    if (await File(path).exists()) return path;
    // File was removed externally. Remove stale row.
    await _db.delete(userId, contentId);
    return null;
  }

  // ─── EXPIRY ────────────────────────────────────────────────────────

  /// Removes downloaded Premium Notes whose access has expired. A note is
  /// expired when the expiry saved at download time has passed (works
  /// offline) or the server reports it in [expiredIds]. Returns the ids
  /// that were removed.
  Future<List<String>> purgeExpiredStoreNotes(
    String userId, {
    Set<String> expiredIds = const {},
  }) async {
    final rows = await _db.listForUser(userId);
    final now = DateTime.now();
    final removed = <String>[];
    for (final row in rows) {
      if ((row['contentType'] as String?) != UrlResolver.typeStoreNote) {
        continue;
      }
      final id = row['contentId'] as String;
      final noteId = id.split('__').first;
      final until = DateTime.tryParse((row['version'] as String?) ?? '');
      if (expiredIds.contains(noteId) || (until != null && until.isBefore(now))) {
        await deleteDownload(userId, id);
        removed.add(id);
      }
    }
    return removed;
  }

  // ─── DELETE ────────────────────────────────────────────────────────

  /// Delete a single download — both the file and the DB row.
  Future<void> deleteDownload(String userId, String contentId) async {
    final row = await _db.find(userId, contentId);
    if (row != null) {
      final path = row['localPath'] as String;
      try {
        await File(path).delete();
      } catch (_) {}
    }
    await _db.delete(userId, contentId);
  }

  /// Delete ALL downloads of a specific type (videos vs documents) or all for [userId].
  Future<void> deleteAllDownloads(String userId, {bool? isVideo}) async {
    final List<Map<String, dynamic>> rows;
    if (isVideo != null) {
      rows = await _db.listByTypeForUser(userId, isVideo: isVideo);
      await _db.deleteAllByType(userId, isVideo: isVideo);
    } else {
      rows = await _db.listForUser(userId);
      await _db.deleteAllForUser(userId);
    }

    for (final row in rows) {
      try {
        await File(row['localPath'] as String).delete();
      } catch (_) {}
    }

    if (isVideo == null) {
      final baseDir = await getApplicationDocumentsDirectory();
      final userDir = Directory(p.join(baseDir.path, 'downloads'));
      if (await userDir.exists()) {
        try {
          await userDir.delete(recursive: true);
        } catch (_) {}
      }
    }
  }

  // ─── LIST ──────────────────────────────────────────────────────────

  /// Downloads for the given user grouped by courseName.
  /// If [isVideo] is provided, filters to only videos or only documents.
  Future<Map<String, List<Map<String, dynamic>>>> listGroupedByCourse(
      String userId, {bool? isVideo}) async {
    final List<Map<String, dynamic>> rows;
    if (isVideo != null) {
      rows = await _db.listByTypeForUser(userId, isVideo: isVideo);
    } else {
      rows = await _db.listForUser(userId);
    }

    final groups = <String, List<Map<String, dynamic>>>{};
    for (final row in rows) {
      final path = row['localPath'] as String;
      if (!await File(path).exists()) {
        await _db.delete(userId, row['contentId'] as String);
        continue;
      }
      final course = (row['courseName'] as String?) ?? 'General';
      groups.putIfAbsent(course, () => []).add(row);
    }
    return groups;
  }

  /// Total storage used by downloads for [userId].
  Future<int> totalStorageUsed(String userId, {bool? isVideo}) {
    if (isVideo != null) {
      return _db.totalSizeByType(userId, isVideo: isVideo);
    }
    return _db.totalSize(userId);
  }

  // ─── HELPERS ───────────────────────────────────────────────────────

  Future<void> _cleanupTmp(String tmpPath) async {
    try {
      await File(tmpPath).delete();
    } catch (_) {}
  }

  String _httpError(int status) {
    switch (status) {
      case 401:
        return 'Session expired — please sign in again.';
      case 403:
        return "You don't have access to this lecture.";
      case 404:
        return 'Lecture not found.';
      case 502:
        return "Couldn't reach Google Drive right now. Try again in a moment.";
      default:
        return 'Download failed (status $status).';
    }
  }

  String _dioError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Download timed out. Check your connection and try again.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'No internet connection. Connect to a network and try again.';
    }
    return e.message ?? 'Network error during download.';
  }
}

/// Immutable snapshot of download progress.
class DownloadProgress {
  const DownloadProgress({
    this.received = 0,
    this.total,
    this.done = false,
    this.error,
    this.localPath,
  });

  factory DownloadProgress.failed(String message) =>
      DownloadProgress(error: message);

  final int received;
  final int? total;
  final bool done;
  final String? error;
  final String? localPath;

  double get fraction =>
      (total != null && total! > 0) ? (received / total!).clamp(0.0, 1.0) : 0.0;
}
