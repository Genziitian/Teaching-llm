import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:video_player/video_player.dart';
import 'package:youtube_explode_dart/youtube_explode_dart.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_typography.dart';

// Key for the user's last-picked YouTube quality. 'auto' selects whatever
// muxed stream has the highest bitrate at video-load time.
const _kYtQualityPrefKey = 'yt_quality_pref';
const _kYtQualityAuto = 'auto';

/// SecureYouTubePlayer — uses `youtube_explode_dart` to scrape direct
/// stream URLs from the YouTube watch page (which doesn't enforce the
/// uploader's "Allow embedding" flag the way the IFrame Player API does),
/// then renders them with `video_player`. Result: videos that throw
/// error 150/152 in iframe-based players play here.
///
/// Trade-off the user explicitly opted into: this approach scrapes
/// YouTube internals and can break when YouTube changes its signing
/// algorithm. Re-run `flutter pub upgrade youtube_explode_dart` if a
/// video stops playing after a YouTube-side update.
class SecureYouTubePlayer extends StatefulWidget {
  const SecureYouTubePlayer({
    super.key,
    required this.videoId,
    this.isLive = false,
    this.title,
    this.aspectRatio = 16 / 9,
    this.autoplay = false,
    this.onEnded,
  });

  final String videoId;
  final bool isLive;
  final String? title;
  final double aspectRatio;
  final bool autoplay;
  final VoidCallback? onEnded;

  @override
  State<SecureYouTubePlayer> createState() => _SecureYouTubePlayerState();
}

class _SecureYouTubePlayerState extends State<SecureYouTubePlayer>
    with WidgetsBindingObserver {
  YoutubeExplode? _yt;
  VideoPlayerController? _player;
  Timer? _hideTimer;
  Timer? _pollTimer;

  bool _disposed = false;
  bool _showControls = true;
  bool _isPlaying = false;
  bool _buffering = true;
  bool _ended = false;
  bool _isFullscreen = false;
  bool _isLive = false;
  String? _errorMsg;

  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  // Quality state ─ populated once we successfully fetch the StreamManifest.
  // [_availableQualities] is the list of muxed (audio+video) stream variants
  // sorted high → low, deduped by label. [_currentQuality] is either 'auto'
  // or a concrete label from that list (e.g. '720p'). Live streams skip all
  // of this — YouTube hands us a single HLS URL that handles its own ABR.
  final List<MuxedStreamInfo> _availableQualities = [];
  String _currentQuality = _kYtQualityAuto;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _isLive = widget.isLive;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final yt = YoutubeExplode();
    _yt = yt;
    try {
      String streamUrl;
      bool live;
      if (widget.isLive) {
        streamUrl = await yt.videos.streamsClient
            .getHttpLiveStreamUrl(VideoId(widget.videoId));
        live = true;
      } else {
        try {
          final manifest = await yt.videos.streamsClient
              .getManifest(VideoId(widget.videoId));
          // Sort muxed streams high-bitrate first and dedupe by qualityLabel
          // so the picker only shows one entry per visible resolution.
          final seenLabels = <String>{};
          final sorted = manifest.muxed.toList()
            ..sort((a, b) => b.bitrate.compareTo(a.bitrate));
          for (final s in sorted) {
            if (seenLabels.add(s.qualityLabel)) {
              _availableQualities.add(s);
            }
          }
          if (_availableQualities.isEmpty) {
            throw StateError('No muxed streams available for this video.');
          }

          // Resolve "auto" → highest, or honor a saved preference if that
          // exact label is present in this video's manifest.
          final saved = await _loadQualityPref();
          final chosen = _pickStream(saved);
          _currentQuality = saved == _kYtQualityAuto ? _kYtQualityAuto : chosen.qualityLabel;
          streamUrl = chosen.url.toString();
          live = false;
        } catch (_) {
          // Live/HLS-only fallback: YouTube doesn't expose discrete qualities
          // for HLS — the player ABRs internally — so the picker stays hidden.
          streamUrl = await yt.videos.streamsClient
              .getHttpLiveStreamUrl(VideoId(widget.videoId));
          live = true;
        }
      }

      if (_disposed) return;
      _isLive = live;
      await _attachController(streamUrl, resume: Duration.zero);
    } on VideoUnplayableException catch (e) {
      _setError('This video is unavailable. ($e)');
    } catch (e) {
      _setError(
          'Could not load the video stream. Check your connection and try again.\n\n($e)');
    }
  }

  /// Picks the muxed stream for a given user choice. 'auto' = the highest
  /// bitrate variant; an exact label match wins otherwise. Falls back to
  /// highest if the saved label isn't in this video's manifest (e.g. user
  /// last picked 720p but this video tops out at 480p).
  MuxedStreamInfo _pickStream(String label) {
    if (label != _kYtQualityAuto) {
      for (final s in _availableQualities) {
        if (s.qualityLabel == label) return s;
      }
    }
    return _availableQualities.first;
  }

  /// Tears down the current VideoPlayerController and spins up a new one
  /// pointed at [streamUrl]. Used for both the initial load and quality
  /// switches; [resume] is honored on the new controller so quality
  /// changes don't lose the user's place.
  Future<void> _attachController(String streamUrl,
      {required Duration resume}) async {
    final old = _player;
    _player = null;
    _pollTimer?.cancel();
    if (old != null) {
      old.removeListener(_onPlayerTick);
      try {
        await old.dispose();
      } catch (_) {}
    }

    final controller = VideoPlayerController.networkUrl(
      Uri.parse(streamUrl),
      videoPlayerOptions: VideoPlayerOptions(
        mixWithOthers: false,
        allowBackgroundPlayback: false,
      ),
    );

    await controller.initialize();
    if (_disposed) {
      controller.dispose();
      return;
    }

    if (resume > Duration.zero && resume < controller.value.duration) {
      await controller.seekTo(resume);
    }

    controller.addListener(_onPlayerTick);
    _player = controller;
    _duration = controller.value.duration;
    _position = controller.value.position;

    if (widget.autoplay || resume > Duration.zero) {
      await controller.play();
    }
    if (!_disposed && mounted) {
      setState(() {
        _buffering = false;
      });
    }
    _scheduleHide();

    _pollTimer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (_disposed || !mounted) return;
      final v = controller.value;
      if (v.position != _position) {
        setState(() => _position = v.position);
      }
    });
  }

  Future<String> _loadQualityPref() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_kYtQualityPrefKey) ?? _kYtQualityAuto;
    } catch (_) {
      return _kYtQualityAuto;
    }
  }

  Future<void> _saveQualityPref(String label) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kYtQualityPrefKey, label);
    } catch (_) {}
  }

  /// Short user-facing label for the current quality choice. 'Auto · 720p'
  /// when on auto so the user can see what auto actually picked.
  String _qualityDisplayLabel() {
    if (_availableQualities.isEmpty) return '';
    if (_currentQuality == _kYtQualityAuto) {
      return 'Auto · ${_availableQualities.first.qualityLabel}';
    }
    return _currentQuality;
  }

  Future<void> _showQualitySheet(BuildContext context) async {
    if (_availableQualities.isEmpty) return;
    _hideTimer?.cancel();
    final picked = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      backgroundColor: const Color(0xEE0B1020),
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => _QualitySheet(
        current: _currentQuality,
        qualities: _availableQualities,
      ),
    );
    if (picked != null) {
      await _switchQuality(picked);
    }
    _scheduleHide();
  }

  /// Switches the player to [label] ('auto' or a concrete qualityLabel),
  /// preserving the current position.
  Future<void> _switchQuality(String label) async {
    if (label == _currentQuality) return;
    if (_isLive || _availableQualities.isEmpty) return;
    final resume = _player?.value.position ?? Duration.zero;
    final wasPlaying = _player?.value.isPlaying ?? false;
    setState(() {
      _buffering = true;
      _currentQuality = label;
    });
    await _saveQualityPref(label);
    final chosen = _pickStream(label);
    try {
      await _attachController(chosen.url.toString(), resume: resume);
      if (!wasPlaying) await _player?.pause();
    } catch (e) {
      _setError('Could not switch quality. ($e)');
    }
  }

  void _setError(String msg) {
    if (_disposed || !mounted) return;
    setState(() {
      _buffering = false;
      _errorMsg = msg;
    });
  }

  void _onPlayerTick() {
    if (_disposed || !mounted) return;
    final v = _player?.value;
    if (v == null) return;
    final next = v.isPlaying;
    final buffering = v.isBuffering;
    final ended = v.duration.inMilliseconds > 0 &&
        v.position >= v.duration - const Duration(milliseconds: 250);
    if (next != _isPlaying ||
        buffering != _buffering ||
        ended != _ended) {
      setState(() {
        _isPlaying = next;
        _buffering = buffering;
        if (ended && !_ended) {
          _ended = true;
          widget.onEnded?.call();
        } else if (!ended && _ended) {
          _ended = false;
        }
      });
    }
  }

  Future<void> _togglePlay() async {
    final c = _player;
    if (c == null) return;
    if (_ended) {
      await c.seekTo(Duration.zero);
      await c.play();
      if (mounted) setState(() => _ended = false);
    } else if (c.value.isPlaying) {
      await c.pause();
    } else {
      await c.play();
    }
    _scheduleHide();
  }

  Future<void> _seekTo(Duration target) async {
    if (_isLive) return;
    final c = _player;
    if (c == null) return;
    final clamped = target.isNegative
        ? Duration.zero
        : (target > _duration ? _duration : target);
    await c.seekTo(clamped);
    setState(() => _position = clamped);
    _scheduleHide();
  }

  void _toggleControls() {
    setState(() => _showControls = !_showControls);
    if (_showControls) _scheduleHide();
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    if (!_isPlaying) return;
    _hideTimer = Timer(const Duration(seconds: 3), () {
      if (_disposed || !mounted) return;
      setState(() => _showControls = false);
    });
  }

  Future<void> _toggleFullscreen() async {
    if (_isFullscreen) {
      await SystemChrome.setPreferredOrientations(
          [DeviceOrientation.portraitUp]);
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    } else {
      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      await SystemChrome.setEnabledSystemUIMode(
          SystemUiMode.immersiveSticky);
    }
    if (!mounted) return;
    setState(() => _isFullscreen = !_isFullscreen);
    _scheduleHide();
  }

  @override
  void dispose() {
    _disposed = true;
    _pollTimer?.cancel();
    _hideTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    final p = _player;
    if (p != null) {
      p.removeListener(_onPlayerTick);
      Future.microtask(() {
        try {
          p.dispose();
        } catch (_) {}
      });
    }
    _yt?.close();
    if (_isFullscreen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        SystemChrome.setPreferredOrientations(
            [DeviceOrientation.portraitUp]);
        SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      });
    }
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _player?.pause();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _player;
    return Container(
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (c != null && c.value.isInitialized)
            Center(
              child: AspectRatio(
                aspectRatio: c.value.aspectRatio,
                child: VideoPlayer(c),
              ),
            )
          else
            const SizedBox.expand(),

          if (_buffering && _errorMsg == null)
            const Center(
              child: SizedBox(
                width: 38,
                height: 38,
                child: CircularProgressIndicator(
                  strokeWidth: 2.6,
                  color: AppColors.textInverse,
                ),
              ),
            ),

          if (_errorMsg != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _errorMsg!,
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(
                    color: const Color(0xCCFFFFFF),
                    fontSize: 13,
                  ),
                ),
              ),
            ),

          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _toggleControls,
              child: const SizedBox.expand(),
            ),
          ),

          if (_errorMsg == null)
            IgnorePointer(
              ignoring: !_showControls,
              child: AnimatedOpacity(
                opacity: _showControls ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 180),
                child: _ControlsOverlay(
                  title: widget.title,
                  isPlaying: _isPlaying,
                  isLive: _isLive,
                  isFullscreen: _isFullscreen,
                  position: _position,
                  duration: _duration,
                  qualityLabel: _qualityDisplayLabel(),
                  canChangeQuality:
                      !_isLive && _availableQualities.isNotEmpty,
                  onPlayPause: _togglePlay,
                  onSeek: _seekTo,
                  onFullscreen: _toggleFullscreen,
                  onSkip: _isLive
                      ? null
                      : (sec) =>
                          _seekTo(_position + Duration(seconds: sec)),
                  onPickQuality: () => _showQualitySheet(context),
                ),
              ),
            ),

          if (_ended)
            Positioned.fill(
              child: Container(
                color: const Color(0xCC000000),
                child: Center(
                  child: IconButton(
                    iconSize: 56,
                    icon: const Icon(Icons.replay_circle_filled,
                        color: AppColors.textInverse),
                    onPressed: _togglePlay,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Flutter controls overlay ───────────────────────────────────────────

class _ControlsOverlay extends StatelessWidget {
  const _ControlsOverlay({
    required this.title,
    required this.isPlaying,
    required this.isLive,
    required this.isFullscreen,
    required this.position,
    required this.duration,
    required this.qualityLabel,
    required this.canChangeQuality,
    required this.onPlayPause,
    required this.onSeek,
    required this.onFullscreen,
    required this.onSkip,
    required this.onPickQuality,
  });

  final String? title;
  final bool isPlaying;
  final bool isLive;
  final bool isFullscreen;
  final Duration position;
  final Duration duration;
  final String qualityLabel;
  final bool canChangeQuality;
  final VoidCallback onPlayPause;
  final ValueChanged<Duration> onSeek;
  final VoidCallback onFullscreen;
  final ValueChanged<int>? onSkip;
  final VoidCallback onPickQuality;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xCC000000), Color(0x00000000), Color(0xCC000000)],
          stops: [0.0, 0.45, 1.0],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Column(
        children: [
          _TopBar(title: title, isLive: isLive),
          Expanded(
            child: _CenterControls(
              isPlaying: isPlaying,
              onPlayPause: onPlayPause,
              onSkip: onSkip,
            ),
          ),
          _BottomBar(
            position: position,
            duration: duration,
            isLive: isLive,
            isFullscreen: isFullscreen,
            qualityLabel: qualityLabel,
            canChangeQuality: canChangeQuality,
            onSeek: onSeek,
            onFullscreen: onFullscreen,
            onPickQuality: onPickQuality,
          ),
        ],
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.title, required this.isLive});
  final String? title;
  final bool isLive;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
      child: Row(
        children: [
          if (isLive)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.danger,
                borderRadius: BorderRadius.circular(50),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.textInverse,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text('LIVE',
                      style: AppTypography.uppercase.copyWith(
                        color: AppColors.textInverse,
                        fontSize: 10.5,
                        letterSpacing: 1.2,
                      )),
                ],
              ),
            ),
          if (isLive) const SizedBox(width: 10),
          if (title != null)
            Expanded(
              child: Text(
                title!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.title.copyWith(
                  color: AppColors.textInverse,
                  fontSize: 13.5,
                ),
              ),
            )
          else
            const Spacer(),
        ],
      ),
    );
  }
}

class _CenterControls extends StatelessWidget {
  const _CenterControls({
    required this.isPlaying,
    required this.onPlayPause,
    required this.onSkip,
  });
  final bool isPlaying;
  final VoidCallback onPlayPause;
  final ValueChanged<int>? onSkip;
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (onSkip != null)
          _CircleAction(icon: Icons.replay_10, onTap: () => onSkip!(-10)),
        if (onSkip != null) const SizedBox(width: 32),
        _CircleAction(
          icon: isPlaying ? Icons.pause : Icons.play_arrow,
          size: 72,
          iconSize: 36,
          onTap: onPlayPause,
        ),
        if (onSkip != null) const SizedBox(width: 32),
        if (onSkip != null)
          _CircleAction(icon: Icons.forward_10, onTap: () => onSkip!(10)),
      ],
    );
  }
}

class _CircleAction extends StatelessWidget {
  const _CircleAction({
    required this.icon,
    required this.onTap,
    this.size = 52,
    this.iconSize = 24,
  });
  final IconData icon;
  final VoidCallback onTap;
  final double size;
  final double iconSize;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0x66000000),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(icon,
              color: AppColors.textInverse, size: iconSize),
        ),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.position,
    required this.duration,
    required this.isLive,
    required this.isFullscreen,
    required this.qualityLabel,
    required this.canChangeQuality,
    required this.onSeek,
    required this.onFullscreen,
    required this.onPickQuality,
  });
  final Duration position;
  final Duration duration;
  final bool isLive;
  final bool isFullscreen;
  final String qualityLabel;
  final bool canChangeQuality;
  final ValueChanged<Duration> onSeek;
  final VoidCallback onFullscreen;
  final VoidCallback onPickQuality;

  String _fmt(Duration d) {
    String two(int n) => n.toString().padLeft(2, '0');
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60);
    return h > 0 ? '${two(h)}:${two(m)}:${two(s)}' : '${two(m)}:${two(s)}';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: Column(
        children: [
          if (!isLive)
            SliderTheme(
              data: const SliderThemeData(
                activeTrackColor: AppColors.primary,
                inactiveTrackColor: Color(0x44FFFFFF),
                thumbColor: AppColors.textInverse,
                overlayColor: Color(0x33FFFFFF),
                trackHeight: 3,
                thumbShape:
                    RoundSliderThumbShape(enabledThumbRadius: 7),
              ),
              child: Slider(
                value: position.inMilliseconds
                    .clamp(0, duration.inMilliseconds.clamp(1, 1 << 31))
                    .toDouble(),
                min: 0,
                max: duration.inMilliseconds
                    .clamp(1, 1 << 31)
                    .toDouble(),
                onChanged: (v) =>
                    onSeek(Duration(milliseconds: v.round())),
              ),
            ),
          Row(
            children: [
              const SizedBox(width: 4),
              Text(
                isLive ? 'Live' : '${_fmt(position)} / ${_fmt(duration)}',
                style: AppTypography.caption.copyWith(
                  color: AppColors.textInverse,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (canChangeQuality)
                Material(
                  color: const Color(0x33000000),
                  borderRadius: BorderRadius.circular(8),
                  child: InkWell(
                    onTap: onPickQuality,
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.high_quality_outlined,
                              color: AppColors.textInverse, size: 16),
                          const SizedBox(width: 5),
                          Text(
                            qualityLabel,
                            style: AppTypography.caption.copyWith(
                              color: AppColors.textInverse,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              IconButton(
                onPressed: onFullscreen,
                icon: Icon(
                  isFullscreen
                      ? Icons.fullscreen_exit
                      : Icons.fullscreen,
                  color: AppColors.textInverse,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Modal bottom sheet listing available muxed quality variants. Returns the
/// selected label (or 'auto') via Navigator.pop; null when dismissed.
class _QualitySheet extends StatelessWidget {
  const _QualitySheet({
    required this.current,
    required this.qualities,
  });

  final String current;
  final List<MuxedStreamInfo> qualities;

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
            _Row(
              label: 'Auto',
              sub: qualities.isEmpty
                  ? ''
                  : 'Best for your connection (up to ${qualities.first.qualityLabel})',
              selected: current == _kYtQualityAuto,
              onTap: () => Navigator.of(context).pop(_kYtQualityAuto),
            ),
            for (final q in qualities)
              _Row(
                label: q.qualityLabel,
                sub: _humanBytes(q.bitrate.bitsPerSecond ~/ 8),
                selected: current == q.qualityLabel,
                onTap: () => Navigator.of(context).pop(q.qualityLabel),
              ),
          ],
        ),
      ),
    );
  }

  static String _humanBytes(int bytesPerSec) {
    if (bytesPerSec <= 0) return '';
    final kb = bytesPerSec / 1024;
    if (kb < 1024) return '${kb.toStringAsFixed(0)} KB/s';
    return '${(kb / 1024).toStringAsFixed(1)} MB/s';
  }
}

class _Row extends StatelessWidget {
  const _Row({
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
          padding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Icon(
                selected
                    ? Icons.check_circle
                    : Icons.radio_button_unchecked,
                color: selected
                    ? AppColors.brand
                    : const Color(0x99FFFFFF),
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
