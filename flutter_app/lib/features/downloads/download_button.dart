import 'dart:async';
import 'dart:math';

import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/downloads/download_providers.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme_tokens.dart';
import '../../theme/app_typography.dart';

/// Reusable download button for PDFs and course materials.
///
/// States:
/// 1. Not Downloaded: Download icon + 'Download' text (or just icon if compact)
/// 2. Downloading: Circular progress indicator with percentage
/// 3. Downloaded: Checkmark icon + 'Downloaded' (opens sheet with View Offline / Delete)
/// 4. Error: Error icon + 'Retry'
class DownloadButton extends ConsumerWidget {
  const DownloadButton({
    super.key,
    required this.contentId,
    this.contentType = 'CONTENT',
    required this.title,
    this.courseId,
    this.courseName,
    this.compact = false,
  });

  final String contentId;
  final String contentType;
  final String title;
  final String? courseId;
  final String? courseName;
  final bool compact;

  Future<void> _startDownload(BuildContext context, WidgetRef ref) =>
      startDownloadFlow(
        context,
        ref,
        contentId: contentId,
        contentType: contentType,
        title: title,
        courseId: courseId,
        courseName: courseName,
      );

  void _showDownloadedOptions(
      BuildContext context, WidgetRef ref, String localPath) {
    final tokens = context.tokens;
    final user = ref.read(authStateProvider).value;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: tokens.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.title.copyWith(
                    color: tokens.textPrimary,
                    fontSize: 16,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.brand.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.visibility_outlined,
                      color: AppColors.brand, size: 20),
                ),
                title: Text(
                  'View Offline',
                  style: AppTypography.title.copyWith(
                    color: tokens.textPrimary,
                    fontSize: 14.5,
                  ),
                ),
                subtitle: Text(
                  'Open stored PDF without using internet',
                  style: AppTypography.caption.copyWith(
                    color: tokens.textSecondary,
                  ),
                ),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  final uri = Uri(
                    path: '/material',
                    queryParameters: {
                      'contentId': contentId,
                      'title': title,
                      'contentType': contentType,
                    },
                  );
                  context.push(uri.toString());
                },
              ),
              const SizedBox(height: 6),
              ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.red.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.delete_outline,
                      color: AppColors.red, size: 20),
                ),
                title: Text(
                  'Delete Download',
                  style: AppTypography.title.copyWith(
                    color: AppColors.red,
                    fontSize: 14.5,
                  ),
                ),
                subtitle: Text(
                  'Remove local PDF to free up space',
                  style: AppTypography.caption.copyWith(
                    color: tokens.textSecondary,
                  ),
                ),
                onTap: () async {
                  Navigator.of(sheetContext).pop();
                  if (user != null) {
                    final manager = ref.read(downloadManagerProvider);
                    await manager.deleteDownload(user.id, contentId);
                    ref.invalidate(downloadStatusProvider(contentId));
                    ref.invalidate(downloadedNotesProvider);
                    ref.invalidate(totalDownloadSizeProvider);
                    ref
                        .read(activeDownloadProvider(contentId).notifier)
                        .reset();
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Download removed.')),
                      );
                    }
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusAsync = ref.watch(downloadStatusProvider(contentId));
    final activeProgress = ref.watch(activeDownloadProvider(contentId));
    final tokens = context.tokens;

    // 1. Is downloading in progress?
    if (activeProgress != null && !activeProgress.done) {
      if (activeProgress.error != null) {
        // Error state
        if (compact) {
          return IconButton(
            tooltip: 'Retry Download',
            icon: const Icon(Icons.refresh, color: AppColors.red, size: 20),
            onPressed: () => _startDownload(context, ref),
          );
        }
        return InkWell(
          onTap: () => _startDownload(context, ref),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, color: AppColors.red, size: 16),
                const SizedBox(width: 6),
                Text(
                  'Retry',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.red,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        );
      }

      // Downloading state
      final pct = (activeProgress.fraction * 100).toInt();
      if (compact) {
        return SizedBox(
          width: 32,
          height: 32,
          child: IconButton(
            tooltip: 'Cancel ($pct%)',
            padding: EdgeInsets.zero,
            icon: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    value: activeProgress.fraction > 0
                        ? activeProgress.fraction
                        : null,
                    strokeWidth: 2.5,
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(AppColors.brand),
                    backgroundColor: tokens.border,
                  ),
                ),
                const Icon(Icons.close, size: 10, color: AppColors.brand),
              ],
            ),
            onPressed: () {
              ref.read(downloadManagerProvider).cancel(contentId);
              ref.read(activeDownloadProvider(contentId).notifier).reset();
            },
          ),
        );
      }

      return InkWell(
        onTap: () {
          ref.read(downloadManagerProvider).cancel(contentId);
          ref.read(activeDownloadProvider(contentId).notifier).reset();
        },
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.brand.withOpacity(0.08),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  value: activeProgress.fraction > 0
                      ? activeProgress.fraction
                      : null,
                  strokeWidth: 2,
                  valueColor:
                      const AlwaysStoppedAnimation<Color>(AppColors.brand),
                  backgroundColor: tokens.border,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '$pct%',
                style: AppTypography.caption.copyWith(
                  color: AppColors.brand,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // 2. Downloaded check
    final localPath = statusAsync.value;
    if (localPath != null && localPath.isNotEmpty) {
      if (compact) {
        return IconButton(
          tooltip: 'Downloaded ✓ (Tap for options)',
          icon: const Icon(Icons.check_circle_rounded,
              color: AppColors.green, size: 20),
          onPressed: () => _showDownloadedOptions(context, ref, localPath),
        );
      }

      return InkWell(
        onTap: () => _showDownloadedOptions(context, ref, localPath),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.green.withOpacity(0.10),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_rounded,
                  color: AppColors.green, size: 15),
              const SizedBox(width: 5),
              Text(
                'Downloaded',
                style: AppTypography.caption.copyWith(
                  color: AppColors.green,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // 3. Not Downloaded
    if (compact) {
      return IconButton(
        tooltip: 'Download',
        icon:
            Icon(Icons.download_rounded, color: tokens.textSecondary, size: 20),
        onPressed: () => _startDownload(context, ref),
      );
    }

    return InkWell(
      onTap: () => _startDownload(context, ref),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: tokens.surfaceSecondary,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: tokens.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.download_rounded, color: tokens.textPrimary, size: 15),
            const SizedBox(width: 5),
            Text(
              'Download',
              style: AppTypography.caption.copyWith(
                color: tokens.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DownloadProgressDialog extends ConsumerStatefulWidget {
  const _DownloadProgressDialog({
    required this.contentId,
    required this.title,
  });

  final String contentId;
  final String title;

  @override
  ConsumerState<_DownloadProgressDialog> createState() =>
      _DownloadProgressDialogState();
}

class _DownloadProgressDialogState
    extends ConsumerState<_DownloadProgressDialog> {
  final Random _random = Random();
  Timer? _timer;
  double _shownProgress = 0;
  late final List<double> _stages;

  @override
  void initState() {
    super.initState();
    final first = 0.15 + _random.nextDouble() * 0.06;
    final pauseOne = first + 0.02 + _random.nextDouble() * 0.03;
    final middle = 0.44 + _random.nextDouble() * 0.09;
    final pauseTwo = middle + 0.03 + _random.nextDouble() * 0.06;
    final high = 0.90 + _random.nextDouble() * 0.06;
    _stages = [first, pauseOne, middle, pauseTwo, high, 0.99];
    _tick();
  }

  void _tick() {
    final p = _shownProgress;
    late final double increment;
    late final int delayMs;
    if (p < _stages[0]) {
      increment = 0.015 + _random.nextDouble() * 0.035;
      delayMs = 75 + _random.nextInt(140);
    } else if (p < _stages[1]) {
      increment = 0.002 + _random.nextDouble() * 0.005;
      delayMs = 420 + _random.nextInt(600);
    } else if (p < _stages[2]) {
      increment = 0.012 + _random.nextDouble() * 0.028;
      delayMs = 90 + _random.nextInt(180);
    } else if (p < _stages[3]) {
      increment = 0.002 + _random.nextDouble() * 0.005;
      delayMs = 480 + _random.nextInt(650);
    } else if (p < _stages[4]) {
      increment = 0.008 + _random.nextDouble() * 0.022;
      delayMs = 130 + _random.nextInt(260);
    } else {
      increment = 0.001 + _random.nextDouble() * 0.003;
      delayMs = 550 + _random.nextInt(750);
    }
    _timer = Timer(Duration(milliseconds: delayMs), () {
      if (!mounted) return;
      final progress = ref.read(activeDownloadProvider(widget.contentId));
      if (progress?.done == true || progress?.error != null) return;
      setState(() {
        _shownProgress = (_shownProgress + increment).clamp(0.0, 0.99);
      });
      if (_shownProgress < 0.99) _tick();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final progress = ref.watch(activeDownloadProvider(widget.contentId));
    final complete = progress?.done == true;
    final error = progress?.error;
    final display = complete ? 1.0 : _shownProgress;

    Widget button(String label, VoidCallback onTap,
        {bool primary = false}) {
      return ApplePressable(
        onTap: onTap,
        child: Container(
          height: 50,
          decoration: BoxDecoration(
            color: primary
                ? tokens.primaryAccent
                : tokens.textMuted.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(16),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: primary ? Colors.white : tokens.textPrimary,
            ),
          ),
        ),
      );
    }

    final Widget indicator = complete
        ? const Icon(Symbols.check_circle_rounded,
            fill: 1, color: AppColors.green, size: 64)
        : error != null
            ? const Icon(Symbols.error_rounded,
                fill: 1, color: AppColors.red, size: 60)
            : CircularProgressIndicator(
                value: display,
                strokeWidth: 6,
                strokeCap: StrokeCap.round,
                color: tokens.primaryAccent,
                backgroundColor: tokens.textMuted.withValues(alpha: 0.18),
              );

    return Dialog(
      backgroundColor: tokens.cardBg,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 36),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: SizedBox(width: 64, height: 64, child: indicator)),
            const SizedBox(height: 20),
            Text(
              complete
                  ? 'Download Complete'
                  : error != null
                      ? 'Download Failed'
                      : 'Downloading Notes',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 21,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              error ??
                  (complete
                      ? '${widget.title} is ready offline.'
                      : '${(display * 100).floor()}% · Please keep the app open'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                height: 1.35,
                color: tokens.textSecondary,
              ),
            ),
            const SizedBox(height: 24),
            if (!complete && error == null)
              button('Cancel', () {
                ref.read(downloadManagerProvider).cancel(widget.contentId);
                ref
                    .read(activeDownloadProvider(widget.contentId).notifier)
                    .reset();
                Navigator.of(context).pop();
              }),
            if (complete) ...[
              button('View Downloads',
                  () => Navigator.of(context).pop('view'),
                  primary: true),
              const SizedBox(height: 10),
              button('Done', () => Navigator.of(context).pop('done')),
            ],
            if (error != null)
              button('Close', () => Navigator.of(context).pop(),
                  primary: true),
          ],
        ),
      ),
    );
  }
}

/// Starts a download with the standard progress dialog. Shared by the
/// download button and the material list menus.
Future<void> startDownloadFlow(
BuildContext context,
WidgetRef ref, {
required String contentId,
String contentType = 'CONTENT',
required String title,
String? courseId,
String? courseName,
String? version,
}) async {
  final user = ref.read(authStateProvider).value;
  if (user == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Please log in to download notes.')),
    );
    return;
  }

  final manager = ref.read(downloadManagerProvider);
  final stream = manager
      .download(
        userId: user.id,
        contentId: contentId,
        contentType: contentType,
        title: title,
        courseId: courseId,
        courseName: courseName,
        version: version,
      )
      .asBroadcastStream();

  ref.read(activeDownloadProvider(contentId).notifier).start(stream);

  // Watch stream completion to invalidate providers
  stream.listen(
    (p) {
      if (p.done) {
        ref.invalidate(downloadStatusProvider(contentId));
        ref.invalidate(downloadedNotesProvider);
        ref.invalidate(totalDownloadSizeProvider);
      }
    },
    onError: (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e')),
        );
      }
    },
  );

  final completedAction = await showDialog<String>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _DownloadProgressDialog(
      contentId: contentId,
      title: title,
    ),
  );
  if (completedAction == 'view' && context.mounted) {
    context.push('/downloads');
  }
}

