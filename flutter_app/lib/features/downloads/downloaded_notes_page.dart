import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/downloads/download_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import '../../theme/app_typography.dart';
import '../store/store_notes_data.dart';

class DownloadedNotesPage extends ConsumerWidget {
  const DownloadedNotesPage({super.key});

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(0)} KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
  }

  void _confirmDeleteAll(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final user = ref.read(authStateProvider).value;
    if (user == null) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: tokens.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Delete All Downloads?',
          style: AppTypography.title.copyWith(color: tokens.textPrimary),
        ),
        content: Text(
          'This will delete all stored PDF notes from your device. You can download them again anytime while online.',
          style: AppTypography.body.copyWith(color: tokens.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Cancel',
              style: TextStyle(color: tokens.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final manager = ref.read(downloadManagerProvider);
              await manager.deleteAllDownloads(user.id);
              ref.invalidate(downloadedNotesProvider);
              ref.invalidate(totalDownloadSizeProvider);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('All downloads deleted.')),
                );
              }
            },
            child: const Text(
              'Delete All',
              style: TextStyle(
                color: AppColors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteSingle(
      BuildContext context, WidgetRef ref, String contentId, String title) {
    final tokens = context.tokens;
    final user = ref.read(authStateProvider).value;
    if (user == null) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: tokens.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Delete Download?',
          style: AppTypography.title.copyWith(color: tokens.textPrimary),
        ),
        content: Text(
          'Are you sure you want to delete "$title"?',
          style: AppTypography.body.copyWith(color: tokens.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Cancel',
              style: TextStyle(color: tokens.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final manager = ref.read(downloadManagerProvider);
              await manager.deleteDownload(user.id, contentId);
              ref.invalidate(downloadStatusProvider(contentId));
              ref.invalidate(downloadedNotesProvider);
              ref.invalidate(totalDownloadSizeProvider);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Download deleted.')),
                );
              }
            },
            child: const Text(
              'Delete',
              style: TextStyle(
                color: AppColors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final notesAsync = ref.watch(downloadedNotesProvider);
    final totalSizeAsync = ref.watch(totalDownloadSizeProvider);

    return AppPageScaffold(
      title: 'Downloaded Notes',
      subtitle: 'Offline study materials',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/courses'),
      right: notesAsync.maybeWhen(
        data: (groups) {
          if (groups.isEmpty) return const SizedBox.shrink();
          return BouncyPressable(
            onTap: () => _confirmDeleteAll(context, ref),
            scaleDown: 0.90,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.red.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.red.withOpacity(0.3)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.delete_sweep_outlined,
                      color: AppColors.red, size: 16),
                  SizedBox(width: 4),
                  Text(
                    'Clear',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.red,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
        orElse: () => const SizedBox.shrink(),
      ),
      body: AppRefresh(
        onRefresh: () async {
          ref.invalidate(myStoreNotesProvider);
          ref.invalidate(downloadedNotesProvider);
          ref.invalidate(totalDownloadSizeProvider);
        },
        child: notesAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation(AppColors.brand),
            ),
          ),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline,
                      color: AppColors.red, size: 48),
                  const SizedBox(height: 12),
                  Text('Failed to load downloads',
                      style: AppTypography.title
                          .copyWith(color: tokens.textPrimary)),
                  const SizedBox(height: 6),
                  Text(err.toString(),
                      textAlign: TextAlign.center,
                      style: AppTypography.bodyMuted
                          .copyWith(color: tokens.textSecondary)),
                ],
              ),
            ),
          ),
          data: (groups) {
            if (groups.isEmpty && ref.watch(expiredStoreNotesProvider).isEmpty) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: AppColors.brand.withOpacity(0.10),
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: const Icon(
                          Icons.download_done_rounded,
                          size: 36,
                          color: AppColors.brand,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'No Downloaded Notes',
                        style: AppTypography.title.copyWith(
                          fontSize: 17,
                          color: tokens.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'When you download lecture notes and course PDFs, they will appear here so you can read them offline anytime.',
                        textAlign: TextAlign.center,
                        style: AppTypography.body.copyWith(
                          color: tokens.textSecondary,
                          fontSize: 13.5,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }

            final totalSize = totalSizeAsync.value ?? 0;

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              children: [
                const _ExpiredNotesSection(),

                // Total Storage Summary Card
                if (groups.isNotEmpty)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  margin: const EdgeInsets.only(bottom: 18),
                  decoration: BoxDecoration(
                    color: tokens.cardBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: tokens.border),
                    boxShadow: AppShadows.sm,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.green.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        alignment: Alignment.center,
                        child: const Icon(
                          Icons.offline_pin_rounded,
                          color: AppColors.green,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Available Offline',
                              style: AppTypography.title.copyWith(
                                fontSize: 14,
                                color: tokens.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${groups.values.fold<int>(0, (sum, list) => sum + list.length)} notes · ${_formatBytes(totalSize)} stored',
                              style: AppTypography.caption.copyWith(
                                color: tokens.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Course-Grouped Notes
                for (final entry in groups.entries) ...[
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 8),
                    child: Text(
                      entry.key.toUpperCase(),
                      style: AppTypography.uppercase.copyWith(
                        letterSpacing: 1.2,
                        color: tokens.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  Container(
                    margin: const EdgeInsets.only(bottom: 18),
                    decoration: BoxDecoration(
                      color: tokens.cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: tokens.border),
                      boxShadow: AppShadows.sm,
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Column(
                        children: [
                          for (int i = 0; i < entry.value.length; i++) ...[
                            if (i > 0)
                              Divider(
                                height: 1,
                                color: tokens.border,
                                indent: 58,
                              ),
                            _DownloadItemTile(
                              item: entry.value[i],
                              courseName: entry.key,
                              formatBytes: _formatBytes,
                              onDelete: () => _confirmDeleteSingle(
                                context,
                                ref,
                                entry.value[i]['contentId'] as String,
                                entry.value[i]['title'] as String,
                              ),
                              onTap: () {
                                final item = entry.value[i];
                                final contentId = item['contentId'] as String;
                                final title = item['title'] as String;
                                final contentType =
                                    (item['contentType'] as String?) ??
                                        'CONTENT';
                                final localPath = item['localPath'] as String;

                                final uri = Uri(
                                  path: '/material',
                                  queryParameters: {
                                    'contentId': contentId,
                                    'title': title,
                                    'contentType': contentType,
                                    'localPath': localPath,
                                    'courseName': entry.key,
                                  },
                                );
                                context.push(uri.toString());
                              },
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _DownloadItemTile extends StatelessWidget {
  const _DownloadItemTile({
    required this.item,
    required this.formatBytes,
    required this.onDelete,
    required this.onTap,
    this.courseName,
  });

  final Map<String, dynamic> item;
  final String Function(int) formatBytes;
  final VoidCallback onDelete;
  final VoidCallback onTap;
  final String? courseName;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = (item['title'] as String?) ?? 'Notes';
    final fileSize = (item['fileSize'] as int?) ?? 0;
    final downloadedAtStr = item['downloadedAt'] as String?;
    final course = ((item['courseName'] as String?) ?? courseName ?? '').trim();
    DateTime? downloadedAt;
    if (downloadedAtStr != null) {
      downloadedAt = DateTime.tryParse(downloadedAtStr);
    }

    return BouncyPressable(
      onTap: onTap,
      scaleDown: 0.99,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            // PDF Icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.brand.withOpacity(0.10),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.picture_as_pdf_rounded,
                color: AppColors.brand,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),

            // Title & Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.title.copyWith(
                      fontSize: 13.5,
                      color: tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      if (course.isNotEmpty &&
                          course.toLowerCase() != 'general') ...[
                        Flexible(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1.5),
                            margin: const EdgeInsets.only(right: 6),
                            decoration: BoxDecoration(
                              color: tokens.textMuted.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              course,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: tokens.textSecondary,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ],
                      Text(
                        formatBytes(fileSize),
                        style: AppTypography.caption.copyWith(
                          color: tokens.textSecondary,
                          fontSize: 11.5,
                        ),
                      ),
                      if (downloadedAt != null) ...[
                        Text(
                          ' · ',
                          style: TextStyle(
                            color: tokens.textMuted,
                            fontSize: 11,
                          ),
                        ),
                        Text(
                          DateFormat('d MMM yyyy').format(downloadedAt),
                          style: AppTypography.caption.copyWith(
                            color: tokens.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),

            // Delete Action
            IconButton(
              tooltip: 'Delete download',
              icon: Icon(
                Icons.delete_outline_rounded,
                color: tokens.textMuted,
                size: 20,
              ),
              onPressed: onDelete,
            ),
          ],
        ),
      ),
    );
  }
}


/// Premium Notes whose access ran out: removed from the device, listed here
/// with Restore now (payment) and View details.
class _ExpiredNotesSection extends ConsumerWidget {
  const _ExpiredNotesSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final expired = ref.watch(expiredStoreNotesProvider);
    if (expired.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'EXPIRED',
            style: AppTypography.uppercase.copyWith(
              letterSpacing: 1.2,
              color: tokens.danger,
              fontSize: 11,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.only(bottom: 18),
          decoration: BoxDecoration(
            color: tokens.cardBg,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            children: [
              for (var i = 0; i < expired.length; i++) ...[
                if (i > 0)
                  Divider(height: 0.5, thickness: 0.5, color: tokens.border),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        expired[i].title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: tokens.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        expired[i].expiresAt == null
                            ? 'Expired'
                            : 'Expired on ${formatNoteDate(expired[i].expiresAt!)}',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: tokens.danger,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: BouncyPressable(
                              onTap: () => buyStoreNote(
                                context,
                                ref,
                                noteId: expired[i].noteId,
                                title: expired[i].title,
                                price: expired[i].price,
                              ),
                              child: Container(
                                height: 38,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: tokens.warning,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  expired[i].price > 0
                                      ? 'Restore now · ${formatNotePrice(expired[i].price)}'
                                      : 'Restore now',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 2,
                            child: BouncyPressable(
                              onTap: () => context
                                  .push('/store/notes/${expired[i].noteId}'),
                              child: Container(
                                height: 38,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color:
                                      tokens.textMuted.withValues(alpha: 0.14),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  'View details',
                                  style: TextStyle(
                                    color: tokens.textPrimary,
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
