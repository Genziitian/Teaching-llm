import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../config/api_config.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/auth/token_storage.dart';
import '../../../core/downloads/download_db.dart';
import '../../../core/downloads/url_resolver.dart';
import '../../../features/downloads/download_button.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_theme_tokens.dart';
import '../../../theme/app_typography.dart';

/// SecurePdfViewer — renders an in-app PDF viewer for course materials and notes.
///
/// Features:
/// - Smooth page scrolling, pinch zoom
/// - Page counter + jump to page dialog
/// - Instant offline playback if previously downloaded
/// - Download button to save into app-private persistent documents directory
/// - If not downloaded, views via temporary cache and deletes on dispose
/// - Full-bleed native protection (FLAG_SECURE + watermark)
class SecurePdfViewer extends ConsumerStatefulWidget {
  const SecurePdfViewer({
    super.key,
    required this.contentId,
    this.contentType = 'CONTENT',
    this.title,
    this.courseId,
    this.courseName,
    this.localPathOverride,
    this.watermark,
  });

  final String contentId;
  final String contentType;
  final String? title;
  final String? courseId;
  final String? courseName;
  final String? localPathOverride;

  /// Watermark text overlaid semi-transparently across the PDF
  final String? watermark;

  @override
  ConsumerState<SecurePdfViewer> createState() => _SecurePdfViewerState();
}

class _SecurePdfViewerState extends ConsumerState<SecurePdfViewer> {
  PDFViewController? _pdfViewController;
  String? _localPath;
  String? _error;
  double _displayProgress = 0.0;
  int? _totalBytes;
  int _currentPage = 0;
  int _pageCount = 0;
  bool _isPersistentDownload = false;
  CancelToken? _cancelToken;
  Timer? _progressTimer;
  final Random _random = Random();
  late List<double> _progressStages;

  @override
  void initState() {
    super.initState();
    _startSimulatedProgress();
    _bootstrap();
  }

  void _startSimulatedProgress() {
    _progressTimer?.cancel();
    _displayProgress = 0;
    final firstFast = 0.15 + _random.nextDouble() * 0.06;
    final firstSlow = firstFast + 0.02 + _random.nextDouble() * 0.03;
    final middleFast = 0.44 + _random.nextDouble() * 0.09;
    final middleSlow = middleFast + 0.03 + _random.nextDouble() * 0.06;
    final finalFast = 0.90 + _random.nextDouble() * 0.06;
    _progressStages = [
      firstFast,
      firstSlow,
      middleFast,
      middleSlow,
      finalFast,
      0.99,
    ];
    _scheduleProgressTick();
  }

  void _scheduleProgressTick() {
    if (!mounted || _localPath != null || _error != null) return;

    final p = _displayProgress;
    late final double increment;
    late final int delayMs;
    if (p < _progressStages[0]) {
      increment = 0.015 + _random.nextDouble() * 0.035;
      delayMs = 75 + _random.nextInt(140);
    } else if (p < _progressStages[1]) {
      increment = 0.002 + _random.nextDouble() * 0.005;
      delayMs = 420 + _random.nextInt(600);
    } else if (p < _progressStages[2]) {
      increment = 0.012 + _random.nextDouble() * 0.028;
      delayMs = 90 + _random.nextInt(180);
    } else if (p < _progressStages[3]) {
      increment = 0.002 + _random.nextDouble() * 0.005;
      delayMs = 480 + _random.nextInt(650);
    } else if (p < _progressStages[4]) {
      increment = 0.008 + _random.nextDouble() * 0.022;
      delayMs = 130 + _random.nextInt(260);
    } else {
      increment = 0.001 + _random.nextDouble() * 0.003;
      delayMs = 550 + _random.nextInt(750);
    }

    _progressTimer = Timer(Duration(milliseconds: delayMs), () {
      if (!mounted || _localPath != null || _error != null) return;
      setState(() {
        _displayProgress = (_displayProgress + increment).clamp(0.0, 0.99);
      });
      if (_displayProgress < 0.99) _scheduleProgressTick();
    });
  }

  Future<void> _bootstrap() async {
    try {
      // 1. Direct local path override (e.g. opened from Downloaded Notes page)
      if (widget.localPathOverride != null &&
          widget.localPathOverride!.isNotEmpty) {
        final f = File(widget.localPathOverride!);
        if (await f.exists() && await f.length() > 0) {
          if (mounted) {
            setState(() {
              _localPath = f.path;
              _isPersistentDownload = true;
            });
          }
          return;
        }
      }

      // 2. Check if already downloaded locally for the current user
      final user = ref.read(authStateProvider).value;
      if (user != null) {
        final existingLocal = await DownloadDb.instance.find(
          user.id,
          widget.contentId,
        );
        if (existingLocal != null) {
          final path = existingLocal['localPath'] as String;
          final f = File(path);
          if (await f.exists() && await f.length() > 0) {
            if (mounted) {
              setState(() {
                _localPath = path;
                _isPersistentDownload = true;
              });
            }
            return;
          }
        }
      }

      // 3. Otherwise, fetch online via backend proxy or direct URL into a temporary cache file
      final isDirectUrl = widget.contentId.startsWith('http://') ||
          widget.contentId.startsWith('https://');

      final token = await const TokenStorage().read();
      if (!isDirectUrl && (token == null || token.isEmpty)) {
        if (mounted) {
          setState(() => _error = 'Not signed in — please log in again.');
        }
        return;
      }

      final dir = await getApplicationCacheDirectory();
      final cacheKey = isDirectUrl
          ? 'doc_${widget.contentId.hashCode.abs()}'
          : widget.contentId;
      final dst = File('${dir.path}/$cacheKey.pdf');
      if (await dst.exists()) {
        try {
          await dst.delete();
        } catch (_) {}
      }

      final String url;
      final Map<String, dynamic> headers;
      if (isDirectUrl) {
        url = widget.contentId;
        headers = {
          'Accept': 'application/pdf,*/*;q=0.5',
        };
      } else {
        final proxyPath =
            UrlResolver.resolve(widget.contentId, widget.contentType);
        url = '${ApiConfig.baseUrl}$proxyPath';
        headers = {
          'Authorization': 'Bearer $token',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/pdf,*/*;q=0.5',
        };
      }

      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(minutes: 5),
        headers: headers,
        validateStatus: (_) => true,
      ));

      _cancelToken = CancelToken();
      final res = await dio.download(
        url,
        dst.path,
        cancelToken: _cancelToken,
        onReceiveProgress: (_, total) {
          if (!mounted || total <= 0 || _totalBytes != null) return;
          setState(() => _totalBytes = total);
        },
      );

      final status = res.statusCode ?? 0;
      if (status != 200 && status != 206) {
        try {
          await dst.delete();
        } catch (_) {}
        if (mounted) setState(() => _error = _httpError(status));
        return;
      }

      if (!await dst.exists() || await dst.length() == 0) {
        if (mounted) setState(() => _error = 'Empty file from server.');
        return;
      }

      if (!mounted) {
        try {
          await dst.delete();
        } catch (_) {}
        return;
      }

      setState(() {
        _localPath = dst.path;
        _isPersistentDownload = false;
      });
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) return;
      if (mounted) setState(() => _error = _dioError(e));
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  String _httpError(int status) {
    switch (status) {
      case 401:
        return 'Session expired — please sign in again.';
      case 403:
        return "You don't have access to this material.";
      case 404:
        return 'Material not found for this lecture.';
      case 502:
        return "Couldn't reach Google Drive right now. Try again in a moment.";
      default:
        return 'Material unavailable (status $status).';
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
    return e.message ?? 'Network error.';
  }

  void _showJumpToPageDialog(BuildContext context) {
    if (_pageCount <= 1) return;
    final controller = TextEditingController(text: '${_currentPage + 1}');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.tokens.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Jump to Page',
          style:
              AppTypography.title.copyWith(color: context.tokens.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Enter page number (1 to $_pageCount):',
              style: AppTypography.caption
                  .copyWith(color: context.tokens.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              autofocus: true,
              style: TextStyle(color: context.tokens.textPrimary),
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text('Cancel',
                style: TextStyle(color: context.tokens.textSecondary)),
          ),
          TextButton(
            onPressed: () {
              final target = int.tryParse(controller.text.trim());
              if (target != null && target >= 1 && target <= _pageCount) {
                _pdfViewController?.setPage(target - 1);
                Navigator.of(ctx).pop();
              }
            },
            child: const Text('Go',
                style: TextStyle(
                    color: AppColors.brand, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _cancelToken?.cancel();
    _progressTimer?.cancel();
    // Only wipe the cached PDF if the user DID NOT explicitly save it as a persistent download
    if (!_isPersistentDownload) {
      final path = _localPath;
      if (path != null) {
        Future.microtask(() async {
          try {
            final f = File(path);
            if (await f.exists()) {
              // Ensure we don't delete files stored in the persistent downloads dir
              if (!path.contains('/downloads/')) {
                await f.delete();
              }
            }
          } catch (_) {}
        });
      }
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Scaffold(
      backgroundColor: tokens.bg,
      appBar: AppBar(
        backgroundColor: tokens.cardBg,
        foregroundColor: tokens.textPrimary,
        elevation: 0,
        title: Text(
          widget.title ?? 'Notes',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.title.copyWith(
            color: tokens.textPrimary,
            fontSize: 15,
          ),
        ),
        actions: [
          if (_pageCount > 0)
            InkWell(
              onTap: () => _showJumpToPageDialog(context),
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${_currentPage + 1} / $_pageCount',
                      style: AppTypography.caption.copyWith(
                        color: tokens.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 2),
                    Icon(Icons.arrow_drop_down,
                        size: 16, color: tokens.textSecondary),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(right: 8, left: 4),
            child: DownloadButton(
              contentId: widget.contentId,
              contentType: widget.contentType,
              title: widget.title ?? 'Notes',
              courseId: widget.courseId,
              courseName: widget.courseName,
              compact: true,
            ),
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    final tokens = context.tokens;

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.red, size: 44),
              const SizedBox(height: 12),
              Text("Couldn't open the material",
                  style: AppTypography.title
                      .copyWith(color: tokens.textPrimary, fontSize: 15)),
              const SizedBox(height: 6),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: AppTypography.bodyMuted
                      .copyWith(color: tokens.textSecondary, fontSize: 13)),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.brand,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Try Again'),
                onPressed: () {
                  setState(() {
                    _error = null;
                    _totalBytes = null;
                  });
                  _startSimulatedProgress();
                  _bootstrap();
                },
              ),
            ],
          ),
        ),
      );
    }

    final path = _localPath;
    if (path == null) {
      return _DownloadProgress(
        progress: _displayProgress,
        totalBytes: _totalBytes,
        title: widget.title,
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        PDFView(
          filePath: path,
          enableSwipe: true,
          swipeHorizontal: false,
          autoSpacing: true,
          pageFling: true,
          pageSnap: true,
          fitPolicy: FitPolicy.WIDTH,
          preventLinkNavigation: true,
          onViewCreated: (controller) {
            _pdfViewController = controller;
          },
          onRender: (pages) {
            if (!mounted) return;
            setState(() => _pageCount = pages ?? 0);
          },
          onPageChanged: (page, _) {
            if (!mounted) return;
            setState(() => _currentPage = page ?? 0);
          },
          onError: (msg) {
            if (!mounted) return;
            setState(() => _error = 'Failed to render PDF: $msg');
          },
        ),
        if ((widget.watermark ?? '').isNotEmpty)
          Positioned.fill(
            child: IgnorePointer(
              child: _Watermark(text: widget.watermark!),
            ),
          ),
      ],
    );
  }
}

class _DownloadProgress extends StatelessWidget {
  const _DownloadProgress({
    required this.progress,
    required this.totalBytes,
    required this.title,
  });
  final double progress;
  final int? totalBytes;
  final String? title;

  String _humanBytes(int? bytes) {
    if (bytes == null || bytes <= 0) return '';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(0)} KB';
    }
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final pct = progress.isFinite ? (progress * 100).clamp(0, 100) : 0;
    final size = _humanBytes(totalBytes);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 56,
              height: 56,
              child: CircularProgressIndicator(
                value: progress > 0 ? progress : null,
                strokeWidth: 3,
                color: AppColors.brand,
                backgroundColor: tokens.border,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Loading material',
              style: AppTypography.title.copyWith(
                color: tokens.textPrimary,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              size.isEmpty
                  ? '${pct.toStringAsFixed(0)}%'
                  : '${pct.toStringAsFixed(0)}% · $size',
              style: AppTypography.bodyMuted.copyWith(
                color: tokens.textSecondary,
                fontSize: 12,
              ),
            ),
            if (title != null) ...[
              const SizedBox(height: 10),
              Text(
                title!,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.caption.copyWith(
                  color: tokens.textMuted,
                  fontSize: 11.5,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Tiled, faintly-visible watermark layer painted over the PDF.
class _Watermark extends StatelessWidget {
  const _Watermark({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (_, c) {
        const tileH = 260.0;
        const tileW = 340.0;
        final rows = (c.maxHeight / tileH).ceil() + 1;
        final cols = (c.maxWidth / tileW).ceil() + 1;
        final children = <Widget>[];
        for (var r = 0; r < rows; r++) {
          for (var col = 0; col < cols; col++) {
            children.add(Positioned(
              left: col * tileW - 60,
              top: r * tileH + 20,
              child: Transform.rotate(
                angle: -0.45,
                child: Text(
                  text,
                  style: const TextStyle(
                    color: Color(0x08000000),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 1.1,
                  ),
                ),
              ),
            ));
          }
        }
        return Stack(children: children);
      },
    );
  }
}
