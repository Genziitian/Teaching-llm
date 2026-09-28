import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/app_theme_tokens.dart';
import 'homework_providers.dart';
import 'homework_submit_sheet.dart';

class HomeworkBannerCard extends ConsumerWidget {
  const HomeworkBannerCard({
    super.key,
    required this.courseId,
    required this.accent,
  });

  final String courseId;
  final Color accent;

  String _formatCountdown(String? dueAtStr) {
    if (dueAtStr == null) return '';
    final due = DateTime.tryParse(dueAtStr)?.toLocal();
    if (due == null) return '';
    final diff = due.difference(DateTime.now());
    if (diff.isNegative) return 'Past deadline';
    if (diff.inDays > 0) return '${diff.inDays}d left';
    if (diff.inHours > 0) return '${diff.inHours}h left';
    return '${diff.inMinutes}m left';
  }

  String _formatDate(String? dueAtStr) {
    if (dueAtStr == null) return '';
    final due = DateTime.tryParse(dueAtStr)?.toLocal();
    if (due == null) return '';
    return DateFormat('MMM d, h:mm a').format(due);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeworkAsync = ref.watch(homeworkListProvider(courseId));
    final tokens = context.tokens;

    return homeworkAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: list.map((hw) {
              final title = (hw['title'] as String?) ?? 'Homework Assignment';
              final desc = hw['description'] as String?;
              final dueAt = hw['dueAt'] as String?;
              final isSubmitted = hw['isSubmitted'] == true;
              final isPastDue = hw['isPastDue'] == true;
              final fileUrls = (hw['fileUrls'] as List?)?.cast<String>() ?? [];
              final countdown = _formatCountdown(dueAt);
              final dateFormatted = _formatDate(dueAt);

              final statusColor = isSubmitted
                  ? const Color(0xFF10B981)
                  : isPastDue
                      ? const Color(0xFFEF4444)
                      : const Color(0xFFF59E0B);

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: tokens.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: statusColor.withOpacity(0.35),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxStyle.neuSmall(tokens.isDark),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top ribbon bar
                    Container(
                      height: 4,
                      decoration: BoxDecoration(
                        color: statusColor,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(20),
                        ),
                      ),
                    ),

                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Status Badge + Due Date
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: statusColor.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: statusColor.withOpacity(0.3),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      isSubmitted
                                          ? Icons.check_circle_outline
                                          : isPastDue
                                              ? Icons.error_outline
                                              : Icons.access_time,
                                      size: 13,
                                      color: statusColor,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      isSubmitted
                                          ? 'Submitted'
                                          : isPastDue
                                              ? 'Past Deadline'
                                              : 'Homework Pending',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: statusColor,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Spacer(),
                              if (dateFormatted.isNotEmpty)
                                Row(
                                  children: [
                                    Icon(
                                      Icons.calendar_today_outlined,
                                      size: 12,
                                      color: tokens.textSecondary,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      dateFormatted,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: tokens.textSecondary,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (countdown.isNotEmpty) ...[
                                      const SizedBox(width: 4),
                                      Text(
                                        '($countdown)',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: statusColor,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                            ],
                          ),
                          const SizedBox(height: 10),

                          // Title
                          Text(
                            title,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: tokens.textPrimary,
                              height: 1.25,
                            ),
                          ),

                          // Description
                          if (desc != null && desc.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              desc,
                              style: TextStyle(
                                fontSize: 13,
                                color: tokens.textSecondary,
                                height: 1.4,
                              ),
                            ),
                          ],

                          // Attached materials download buttons
                          if (fileUrls.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Text(
                              'Attachments (${fileUrls.length}):',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: tokens.textMuted,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: fileUrls.asMap().entries.map((entry) {
                                final idx = entry.key;
                                final url = entry.value;
                                return ActionChip(
                                  avatar: Icon(
                                    Icons.download_rounded,
                                    size: 14,
                                    color: accent,
                                  ),
                                  label: Text(
                                    'Material ${idx + 1}',
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                      color: tokens.textPrimary,
                                    ),
                                  ),
                                  backgroundColor: tokens.surfaceSecondary,
                                  side: BorderSide(color: tokens.border),
                                  onPressed: () {
                                    final uri = Uri.tryParse(url);
                                    if (uri != null) {
                                      launchUrl(uri,
                                          mode: LaunchMode.externalApplication);
                                    }
                                  },
                                );
                              }).toList(),
                            ),
                          ],

                          const SizedBox(height: 14),

                          // Submit Action Button
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () => HomeworkSubmitSheet.show(
                                context,
                                homework: hw,
                                courseId: courseId,
                                accent: accent,
                              ),
                              icon: Icon(
                                isSubmitted
                                    ? Icons.edit_outlined
                                    : Icons.upload_file_outlined,
                                size: 16,
                              ),
                              label: Text(
                                isSubmitted
                                    ? 'Update Submission'
                                    : 'Submit Homework',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isSubmitted
                                    ? tokens.surfaceSecondary
                                    : accent,
                                foregroundColor: isSubmitted
                                    ? tokens.textPrimary
                                    : Colors.white,
                                elevation: isSubmitted ? 0 : 2,
                                side: isSubmitted
                                    ? BorderSide(color: tokens.border)
                                    : BorderSide.none,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(50),
                                ),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 10),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        );
      },
    );
  }
}

class BoxStyle {
  static BoxShadow neuSmall(bool isDark) {
    return BoxShadow(
      color: Colors.black.withOpacity(isDark ? 0.25 : 0.04),
      blurRadius: 10,
      offset: const Offset(0, 4),
    );
  }
}
