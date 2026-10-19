import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../auth/auth_providers.dart';
import 'download_db.dart';
import 'download_manager.dart';

// ─── Singleton providers ─────────────────────────────────────────────

final downloadManagerProvider = Provider<DownloadManager>((ref) {
  return DownloadManager(tokenStorage: ref.watch(tokenStorageProvider));
});

final downloadDbProvider = Provider<DownloadDb>((ref) => DownloadDb.instance);

// ─── Downloaded notes list (documents only) ──────────────────────────

final downloadedNotesProvider =
    FutureProvider<Map<String, List<Map<String, dynamic>>>>((ref) async {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return const {};
  final mgr = ref.read(downloadManagerProvider);
  // Expired Premium Notes are removed from the device before listing.
  await mgr.purgeExpiredStoreNotes(user.id);
  return mgr.listGroupedByCourse(user.id, isVideo: false);
});

// ─── Downloaded lectures list (videos only) ──────────────────────────

final downloadedVideosProvider =
    FutureProvider<Map<String, List<Map<String, dynamic>>>>((ref) async {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return const {};
  final mgr = ref.read(downloadManagerProvider);
  return mgr.listGroupedByCourse(user.id, isVideo: true);
});

// ─── Single-item download status ─────────────────────────────────────

/// Check whether a specific contentId has been downloaded by the current
/// user. Returns the local file path or null.
final downloadStatusProvider =
    FutureProvider.family<String?, String>((ref, contentId) async {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return null;
  final mgr = ref.read(downloadManagerProvider);
  return mgr.localPathIfExists(user.id, contentId);
});

// ─── Total storage used ──────────────────────────────────────────────

final totalDownloadSizeProvider = FutureProvider<int>((ref) async {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return 0;
  final db = ref.read(downloadDbProvider);
  return db.totalSize(user.id);
});

final totalNotesDownloadSizeProvider = FutureProvider<int>((ref) async {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return 0;
  final db = ref.read(downloadDbProvider);
  return db.totalSizeByType(user.id, isVideo: false);
});

final totalVideoDownloadSizeProvider = FutureProvider<int>((ref) async {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return 0;
  final db = ref.read(downloadDbProvider);
  return db.totalSizeByType(user.id, isVideo: true);
});

// ─── Active download progress ────────────────────────────────────────

class ActiveDownloadNotifier extends StateNotifier<DownloadProgress?> {
  ActiveDownloadNotifier() : super(null);

  StreamSubscription<DownloadProgress>? _sub;

  void start(Stream<DownloadProgress> stream) {
    _sub?.cancel();
    _sub = stream.listen(
      (p) => state = p,
      onError: (e) => state = DownloadProgress.failed(e.toString()),
      onDone: () {},
    );
  }

  void reset() {
    _sub?.cancel();
    state = null;
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

final activeDownloadProvider = StateNotifierProvider.family<
    ActiveDownloadNotifier, DownloadProgress?, String>(
  (ref, contentId) => ActiveDownloadNotifier(),
);
