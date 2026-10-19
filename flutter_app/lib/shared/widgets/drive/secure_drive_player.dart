import 'dart:async';
import 'dart:io';

import 'package:chewie/chewie.dart';
import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:video_player/video_player.dart';

import '../../../config/api_config.dart';
import '../../../core/auth/token_storage.dart';
import '../../../core/downloads/download_db.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_typography.dart';

// Default quality preference key — kept distinct from the YouTube one so
// they don't tread on each other. 'auto' = let the server pick (i.e. the
// default videoUrl, which is whatever the manager set as the master file).
const _kDriveQualityPrefKey = 'drive_quality_pref';
const _kDriveQualityAuto = 'auto';

/// SecureDrivePlayer — plays Google-Drive-hosted lectures through the
/// backend proxy at `/api/drive-stream/<contentId>`, or directly from
/// offline app-private storage if previously downloaded.
class SecureDrivePlayer extends StatefulWidget {
  const SecureDrivePlayer({
    super.key,
    required this.contentId,
    this.title,
    this.localPathOverride,
    this.aspectRatio = 16 / 9,
    this.autoplay = true,
    this.onEnded,
  });

  final String contentId;
  final String? title;
  final String? localPathOverride;
  final double aspectRatio;
  final bool autoplay;
  final VoidCallback? onEnded;

  @override
  State<SecureDrivePlayer> createState() => _SecureDrivePlayerState();
}

class _SecureDrivePlayerState extends State<SecureDrivePlayer> {
  VideoPlayerController? _video;
  ChewieController? _chewie;
  String? _error;
  bool _ended = false;

  // Quality state — populated from /api/content/<id>/variants on first load.
  // [_qualities] is the list of available labels from the manager (e.g.
  // ['360p', '720p', '1080p']). [_currentQuality] is either 'auto' (i.e.
  // the default videoUrl) or one of those labels. Empty list = no picker.
  List<String> _qualities = const [];
  String _currentQuality = _kDriveQualityAuto;
  String? _token; // cached so quality switches don't re-read secure storage
  File? _activeLocalFile;
  bool _recoveringLocalPlayback = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      // 1. Direct local path override (e.g. from Downloaded Lectures page)
      if (widget.localPathOverride != null &&
          widget.localPathOverride!.isNotEmpty) {
        final f = File(widget.localPathOverride!);
        if (await f.exists() && await f.length() > 0) {
          if (await _loadLocalVideo(f)) return;
          await _discardBrokenLocalDownload(f);
        }
      }

      // 2. Check if already downloaded locally in SQLite for current user
      final userId = await const TokenStorage().userId();
      if (userId != null && userId.isNotEmpty) {
        final row = await DownloadDb.instance.find(userId, widget.contentId);
        if (row != null) {
          final localPath = row['localPath'] as String;
          final f = File(localPath);
          if (await f.exists() && await f.length() > 0) {
            if (await _loadLocalVideo(f)) return;
            await _discardBrokenLocalDownload(f, userId: userId);
          } else {
            await DownloadDb.instance.delete(userId, widget.contentId);
          }
        }
      }

      // 3. Fallback to online streaming through the backend proxy
      await _loadOnlineStream();
    } catch (e) {
      if (mounted) setState(() => _error = _humanize(e));
    }
  }

  Future<void> _loadOnlineStream() async {
    final token = await const TokenStorage().read();
    if (token == null || token.isEmpty) {
      if (mounted) {
        setState(() => _error = 'Not signed in — please log in again.');
      }
      return;
    }
    _token = token;

    final qualitiesFuture = _fetchAvailableQualities();
    final savedPrefFuture = _loadQualityPref();

    final saved = await savedPrefFuture;
    final available = await qualitiesFuture;
    _qualities = available;
    _currentQuality = available.contains(saved) ? saved : _kDriveQualityAuto;

    await _loadStreamForQuality(_currentQuality,
        resume: Duration.zero, wasPlaying: widget.autoplay);
  }

  Future<bool> _loadLocalVideo(File file) async {
    final v = VideoPlayerController.file(
      file,
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
    );

    try {
      await v.initialize().timeout(const Duration(seconds: 15));
    } catch (e) {
      await v.dispose();
      return false;
    }

    v.addListener(_listener);
    if (!mounted) {
      await v.dispose();
      return true;
    }

    final c = _buildChewie(v, autoplay: widget.autoplay);
    setState(() {
      _video = v;
      _chewie = c;
      _activeLocalFile = file;
      _qualities = const []; // Hide network quality picker for local playback
    });
    return true;
  }

  Future<void> _discardBrokenLocalDownload(File file, {String? userId}) async {
    try {
      if (await file.exists()) await file.delete();
    } catch (_) {}
    final ownerId = userId ?? await const TokenStorage().userId();
    if (ownerId != null && ownerId.isNotEmpty) {
      try {
        await DownloadDb.instance.delete(ownerId, widget.contentId);
      } catch (_) {}
    }
  }

  Future<void> _recoverFromBrokenLocalPlayback() async {
    if (_recoveringLocalPlayback || _activeLocalFile == null) return;
    _recoveringLocalPlayback = true;
    final brokenFile = _activeLocalFile!;
    _activeLocalFile = null;
    final oldVideo = _video;
    final oldChewie = _chewie;
    _video = null;
    _chewie = null;
    oldVideo?.removeListener(_listener);
    oldChewie?.dispose();
    await oldVideo?.dispose();
    await _discardBrokenLocalDownload(brokenFile);
    if (mounted) setState(() => _error = null);
    try {
      await _loadOnlineStream();
    } catch (e) {
      if (mounted) setState(() => _error = _humanize(e));
    } finally {
      _recoveringLocalPlayback = false;
    }
  }

  /// Builds the proxy URL for the chosen quality and re-creates the Chewie
  /// controller. Used for both initial load and quality switches; [resume]
  /// + [wasPlaying] are honored so switches don't lose the user's place.
  Future<void> _loadStreamForQuality(
    String quality, {
    required Duration resume,
    required bool wasPlaying,
  }) async {
    final token = _token;
    if (token == null) return;

    final query = quality == _kDriveQualityAuto ? '' : '?quality=$quality';
    final streamUrl =
        '${ApiConfig.baseUrl}/api/drive-stream/${widget.contentId}$query';
    final headers = <String, String>{
      'Authorization': 'Bearer $token',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.5',
    };

    // Probe only on the very first load — for switches we trust the original
    // probe since auth/enrollment hasn't changed in the last few seconds.
    if (_video == null) {
      final probe = await _probeStream(streamUrl, headers);
      if (probe != null) {
        if (mounted) setState(() => _error = probe);
        return;
      }
    }

    final v = VideoPlayerController.networkUrl(
      Uri.parse(streamUrl),
      httpHeaders: headers,
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
    );

    try {
      await v.initialize().timeout(const Duration(seconds: 30));
    } on TimeoutException {
      await v.dispose();
      if (mounted) {
        setState(() => _error =
            'Video took too long to load. Check your connection and try again.');
      }
      return;
    }

    if (resume > Duration.zero && resume < v.value.duration) {
      await v.seekTo(resume);
    }
    v.addListener(_listener);

    if (!mounted) {
      await v.dispose();
      return;
    }

    final c = _buildChewie(v, autoplay: wasPlaying);

    // Tear down the old pair after the new one is live, so the user sees
    // continuous video rather than a black frame during the swap.
    final oldVideo = _video;
    final oldChewie = _chewie;

    setState(() {
      _video = v;
      _chewie = c;
      _activeLocalFile = null;
    });

    if (oldVideo != null) {
      oldVideo.removeListener(_listener);
      Future.microtask(() {
        oldChewie?.dispose();
        oldVideo.dispose();
      });
    }
  }

  ChewieController _buildChewie(VideoPlayerController v,
      {required bool autoplay}) {
    return ChewieController(
      videoPlayerController: v,
      aspectRatio: widget.aspectRatio,
      autoPlay: autoplay,
      looping: false,
      allowFullScreen: true,
      allowMuting: true,
      allowPlaybackSpeedChanging: true,
      // Preserve the gesture and fullscreen behavior from Chewie 1.10.
      allowDoubleTapSeek: false,
      allowDoubleTapToggleFullScreen: false,
      swipeToExitFullscreen: false,
      showSeekIndicator: false,
      useNativeFullScreenOnWeb: false,
      hideCursorInFullScreen: false,
      playbackSpeeds: const [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
      showControlsOnInitialize: true,
      hideControlsTimer: const Duration(milliseconds: 2500),
      progressIndicatorDelay: const Duration(milliseconds: 250),
      materialProgressColors: ChewieProgressColors(
        playedColor: AppColors.brand,
        handleColor: AppColors.brand,
        backgroundColor: const Color(0x33FFFFFF),
        bufferedColor: const Color(0x66FFFFFF),
      ),
      placeholder: Container(color: Colors.black),
      errorBuilder: (_, msg) => _ErrorView(message: msg),
      // Adds a "Quality" row to Chewie's built-in options menu (the 3-dot
      // icon in the controls bar). Hidden when only auto is available.
      additionalOptions: _qualities.isEmpty
          ? null
          : (ctx) => [
                OptionItem(
                  onTap: (sheetCtx) async {
                    // Pop Chewie's own options sheet first, then show ours.
                    Navigator.of(sheetCtx, rootNavigator: true).pop();
                    await _showQualitySheet(ctx);
                  },
                  iconData: Icons.high_quality_outlined,
                  title: 'Quality (${_qualityDisplayLabel()})',
                ),
              ],
    );
  }

  Future<List<String>> _fetchAvailableQualities() async {
    try {
      final token = _token ?? '';
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Authorization': 'Bearer $token',
          'X-Requested-With': 'XMLHttpRequest',
        },
        validateStatus: (_) => true,
      ));
      final res = await dio.get<dynamic>(
        '${ApiConfig.baseUrl}/api/content/${widget.contentId}/variants',
      );
      if (res.statusCode != 200) return const [];
      final data = res.data;
      if (data is! Map) return const [];
      final variants = data['variants'];
      if (variants is! Map) return const [];
      // Sort high → low using the numeric part of the label so "1080p"
      // appears above "720p" without depending on map iteration order.
      final labels = variants.keys.cast<String>().toList()
        ..sort((a, b) => _resolutionRank(b).compareTo(_resolutionRank(a)));
      return labels;
    } catch (_) {
      return const [];
    }
  }

  int _resolutionRank(String label) {
    final m = RegExp(r'(\d+)').firstMatch(label);
    return m == null ? 0 : int.tryParse(m.group(1)!) ?? 0;
  }

  Future<String> _loadQualityPref() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_kDriveQualityPrefKey) ?? _kDriveQualityAuto;
    } catch (_) {
      return _kDriveQualityAuto;
    }
  }

  Future<void> _saveQualityPref(String label) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kDriveQualityPrefKey, label);
    } catch (_) {}
  }

  String _qualityDisplayLabel() {
    if (_currentQuality == _kDriveQualityAuto) return 'Auto';
    return _currentQuality;
  }

  Future<void> _showQualitySheet(BuildContext context) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      backgroundColor: const Color(0xEE0B1020),
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _DriveQualitySheet(
        current: _currentQuality,
        qualities: _qualities,
      ),
    );
    if (picked == null || picked == _currentQuality) return;
    await _switchQuality(picked);
  }

  Future<void> _switchQuality(String label) async {
    final v = _video;
    final resume = v?.value.position ?? Duration.zero;
    final wasPlaying = v?.value.isPlaying ?? true;
    setState(() => _currentQuality = label);
    await _saveQualityPref(label);
    await _loadStreamForQuality(label, resume: resume, wasPlaying: wasPlaying);
  }

  /// Quick HEAD-ish range probe so we surface auth / not-found / Drive-side
  /// errors as a clear message instead of an infinite black spinner. Returns
  /// `null` when the proxy is healthy, or a human error string otherwise.
  Future<String?> _probeStream(String url, Map<String, String> headers) async {
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 25),
        // Range: 0-0 → server replies 206 with just 1 byte, enough to
        // validate auth + enrollment + the upstream Drive credentials.
        headers: {...headers, 'Range': 'bytes=0-0'},
        // Don't throw on non-2xx — we want to inspect the status ourselves.
        validateStatus: (_) => true,
        responseType: ResponseType.bytes,
      ));
      final res = await dio.get<dynamic>(url);
      final s = res.statusCode ?? 0;
      if (s == 200 || s == 206) return null;
      if (s == 401) return 'Session expired — please sign in again.';
      if (s == 403) return "You don't have access to this lecture.";
      if (s == 404) return 'Lecture video not found.';
      if (s == 502) {
        return "Couldn't reach Google Drive right now. Try again in a moment.";
      }
      // Surface the server's error payload when present.
      final body = res.data;
      String? msg;
      if (body is List<int>) {
        try {
          msg = body.isEmpty
              ? null
              : (body.length > 500 ? null : String.fromCharCodes(body));
        } catch (_) {}
      }
      return 'Video unavailable (status $s)${msg != null ? ': $msg' : ''}.';
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return 'Server is taking too long. Check your connection and try again.';
      }
      return e.message ?? 'Network error.';
    } catch (e) {
      return _humanize(e);
    }
  }

  void _listener() {
    final v = _video;
    if (v == null || !mounted) return;
    if (v.value.hasError) {
      if (_activeLocalFile != null) {
        _recoverFromBrokenLocalPlayback();
        return;
      }
      setState(() => _error = _humanize(v.value.errorDescription));
      return;
    }
    final dur = v.value.duration;
    final pos = v.value.position;
    if (!_ended && dur.inMilliseconds > 0 && pos >= dur) {
      _ended = true;
      widget.onEnded?.call();
    }
  }

  String _humanize(Object? raw) {
    final s = raw?.toString() ?? 'Playback failed';
    if (s.contains('401') || s.toLowerCase().contains('unauthorized')) {
      return 'Session expired — please sign in again.';
    }
    if (s.contains('403') || s.toLowerCase().contains('not enrolled')) {
      return "You don't have access to this lecture.";
    }
    if (s.contains('404')) return 'Lecture video not found.';
    if (s.contains('502') || s.contains('Drive')) {
      return "Couldn't fetch the video from Drive. Try again in a moment.";
    }
    return s.length > 200 ? '${s.substring(0, 200)}…' : s;
  }

  @override
  void dispose() {
    _video?.removeListener(_listener);
    _chewie?.dispose();
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return AspectRatio(
        aspectRatio: widget.aspectRatio,
        child: _ErrorView(message: _error!),
      );
    }
    final c = _chewie;
    if (c == null) {
      // Initial pre-buffer state. A title + spinner reads as "we're loading
      // YOUR lecture" rather than the dead-black slab a bare progress
      // indicator would give. Same visual weight as the YouTube player's
      // initial state, so transitions feel uniform across sources.
      return AspectRatio(
        aspectRatio: widget.aspectRatio,
        child: Container(
          color: Colors.black,
          alignment: Alignment.center,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 32,
                height: 32,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation(Colors.white),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                widget.title ?? 'Loading lecture…',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: AppTypography.bodyMuted.copyWith(
                  color: const Color(0xCCFFFFFF),
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      );
    }
    return AspectRatio(
      aspectRatio: widget.aspectRatio,
      child: Chewie(controller: c),
    );
  }
}

/// Drive quality picker sheet — mirrors the YouTube player's sheet visually
/// so both players feel like the same product. Returns the picked label
/// (or 'auto'); null when dismissed.
class _DriveQualitySheet extends StatelessWidget {
  const _DriveQualitySheet({
    required this.current,
    required this.qualities,
  });

  final String current;
  final List<String> qualities;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0x55FFFFFF),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Quality',
              style: AppTypography.h2.copyWith(
                fontSize: 17,
                color: AppColors.textInverse,
              ),
            ),
            const SizedBox(height: 10),
            _SheetRow(
              label: 'Auto',
              sub: 'Manager-recommended default',
              selected: current == _kDriveQualityAuto,
              onTap: () => Navigator.of(context).pop(_kDriveQualityAuto),
            ),
            for (final q in qualities)
              _SheetRow(
                label: q,
                sub: '',
                selected: current == q,
                onTap: () => Navigator.of(context).pop(q),
              ),
          ],
        ),
      ),
    );
  }
}

class _SheetRow extends StatelessWidget {
  const _SheetRow({
    required this.label,
    required this.sub,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final String sub;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0x225856D6) : Colors.transparent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Icon(
                selected ? Icons.check_circle : Icons.radio_button_unchecked,
                color: selected ? AppColors.brand : const Color(0x99FFFFFF),
                size: 18,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: AppTypography.title.copyWith(
                        fontSize: 14,
                        color: AppColors.textInverse,
                      ),
                    ),
                    if (sub.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: Text(
                          sub,
                          style: AppTypography.caption.copyWith(
                            color: const Color(0x99FFFFFF),
                            fontSize: 11,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.white70, size: 36),
          const SizedBox(height: 10),
          Text(message,
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(color: Colors.white)),
        ],
      ),
    );
  }
}
