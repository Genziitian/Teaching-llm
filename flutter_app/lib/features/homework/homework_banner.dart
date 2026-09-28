import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../theme/app_theme_tokens.dart';
import '../lecture/material_page.dart' as doc_page;
import 'homework_providers.dart';
import 'homework_submit_sheet.dart';

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

void _openMaterialInApp(
  BuildContext context, {
  required String url,
  required String label,
  required String courseId,
}) {
  final lower = url.toLowerCase();
  final isImage = RegExp(r'\.(jpe?g|png|webp|gif|avif)($|\?)', caseSensitive: false)
      .hasMatch(lower);

  if (isImage) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black.withOpacity(0.92),
      builder: (_) => _InAppImageViewerDialog(url: url, title: label),
    );
    return;
  }

  // Opens directly in the LMS in-app Secure PDF viewer
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => doc_page.MaterialPage(
        contentId: url,
        title: label,
        courseId: courseId,
      ),
    ),
  );
}

/// Compact amber strip shown on Curriculum / Lectures tab matching Web source of truth
class HomeworkCurriculumReminder extends ConsumerWidget {
  const HomeworkCurriculumReminder({
    super.key,
    required this.courseId,
    required this.accent,
    required this.onViewHomework,
  });

  final String courseId;
  final Color accent;
  final VoidCallback onViewHomework;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeworkAsync = ref.watch(homeworkListProvider(courseId));
    final tokens = context.tokens;

    return homeworkAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) return const SizedBox.shrink();

        // Sort newest first
        final sortedList = [...list];
        sortedList.sort((a, b) {
          final aCreated = DateTime.tryParse(a['createdAt'] ?? '') ?? DateTime(1970);
          final bCreated = DateTime.tryParse(b['createdAt'] ?? '') ?? DateTime(1970);
          final createdDiff = bCreated.compareTo(aCreated);
          if (createdDiff != 0) return createdDiff;
          final aDue = DateTime.tryParse(a['dueAt'] ?? '') ?? DateTime(1970);
          final bDue = DateTime.tryParse(b['dueAt'] ?? '') ?? DateTime(1970);
          return aDue.compareTo(bDue);
        });

        // Find active pending homework or fallback to newest
        final activeList = sortedList
            .where((hw) => hw['isOpen'] != false && hw['isPastDue'] != true)
            .toList();
        final hw = activeList.isNotEmpty ? activeList.first : sortedList.first;
        final serial = sortedList.indexOf(hw) + 1;
        final title = (hw['title'] as String?) ?? 'Homework';
        final dueAt = hw['dueAt'] as String?;
        final countdown = _formatCountdown(dueAt);
        final dateFormatted = _formatDate(dueAt);

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF59E0B).withOpacity(0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: const Color(0xFFF59E0B).withOpacity(0.28),
              width: 1,
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  // Left 5px solid amber border
                  Container(
                    width: 5,
                    color: const Color(0xFFF59E0B),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: InkWell(
                              onTap: onViewHomework,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.access_time_rounded,
                                        size: 13,
                                        color: Color(0xFFD97706),
                                      ),
                                      const SizedBox(width: 5),
                                      Text(
                                        'HOMEWORK #$serial',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 0.5,
                                          color: Color(0xFFD97706),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          title,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 13.5,
                                            fontWeight: FontWeight.w800,
                                            color: tokens.textPrimary,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (dateFormatted.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.calendar_today_outlined,
                                          size: 11,
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
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: Color(0xFFD97706),
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          // View Homework Pill Button
                          ElevatedButton(
                            onPressed: onViewHomework,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: accent,
                              foregroundColor: Colors.white,
                              elevation: 2,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: const Text(
                              'View Homework',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Full Homework List view rendered inside the dedicated Homework tab
class HomeworkBannerCard extends ConsumerWidget {
  const HomeworkBannerCard({
    super.key,
    required this.courseId,
    required this.accent,
    this.showEmptyState = false,
  });

  final String courseId;
  final Color accent;
  final bool showEmptyState;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeworkAsync = ref.watch(homeworkListProvider(courseId));
    final tokens = context.tokens;

    return homeworkAsync.when(
      loading: () => showEmptyState
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Center(
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(accent),
                ),
              ),
            )
          : const SizedBox.shrink(),
      error: (_, __) => showEmptyState
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 16),
              child: Center(
                child: Text(
                  'Failed to load homework assignments.',
                  style: TextStyle(
                    fontSize: 13,
                    color: tokens.textMuted,
                  ),
                ),
              ),
            )
          : const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) {
          if (!showEmptyState) return const SizedBox.shrink();
          return Container(
            padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 20),
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: tokens.surfaceSecondary,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.assignment_outlined,
                    size: 28,
                    color: tokens.textMuted,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'No active homework for this course',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  'Assignments and submissions will appear here once posted.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: tokens.textMuted,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          );
        }

        // Sort homework: newest created first
        final sortedList = [...list];
        sortedList.sort((a, b) {
          final aCreated = DateTime.tryParse(a['createdAt'] ?? '') ?? DateTime(1970);
          final bCreated = DateTime.tryParse(b['createdAt'] ?? '') ?? DateTime(1970);
          final createdDiff = bCreated.compareTo(aCreated);
          if (createdDiff != 0) return createdDiff;
          final aDue = DateTime.tryParse(a['dueAt'] ?? '') ?? DateTime(1970);
          final bDue = DateTime.tryParse(b['dueAt'] ?? '') ?? DateTime(1970);
          return aDue.compareTo(bDue);
        });

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: sortedList.asMap().entries.map((entry) {
            final idx = entry.key;
            final hw = entry.value;
            final serial = idx + 1;

            return _HomeworkDetailCard(
              key: ValueKey(hw['id'] ?? '$idx'),
              hw: hw,
              serial: serial,
              courseId: courseId,
              accent: accent,
            );
          }).toList(),
        );
      },
    );
  }
}

class _HomeworkDetailCard extends StatefulWidget {
  const _HomeworkDetailCard({
    super.key,
    required this.hw,
    required this.serial,
    required this.courseId,
    required this.accent,
  });

  final Map<String, dynamic> hw;
  final int serial;
  final String courseId;
  final Color accent;

  @override
  State<_HomeworkDetailCard> createState() => _HomeworkDetailCardState();
}

class _HomeworkDetailCardState extends State<_HomeworkDetailCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final hw = widget.hw;
    final title = (hw['title'] as String?) ?? 'Homework Assignment';
    final desc = (hw['description'] as String?)?.trim();
    final dueAt = hw['dueAt'] as String?;
    final isSubmitted = hw['isSubmitted'] == true;
    final isPastDue = hw['isPastDue'] == true;
    final isOpen = (hw['isOpen'] as bool?) ?? true;
    final canSubmit = isOpen;
    final fileUrls = (hw['fileUrls'] as List?)?.cast<String>() ?? [];
    final mySub = hw['mySubmission'] as Map<String, dynamic>?;

    final countdown = _formatCountdown(dueAt);
    final dateFormatted = _formatDate(dueAt);

    final statusColor = isSubmitted
        ? const Color(0xFF10B981)
        : isPastDue
            ? const Color(0xFFEF4444)
            : const Color(0xFFF59E0B);

    final statusGradient = isSubmitted
        ? const [Color(0xFF10B981), Color(0xFF059669)]
        : isPastDue
            ? const [Color(0xFFEF4444), Color(0xFFDC2626)]
            : const [Color(0xFFF59E0B), Color(0xFFD97706)];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: tokens.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: statusColor.withOpacity(0.35),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(tokens.isDark ? 0.25 : 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 3px top colored indicator
            Container(
              height: 3,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: statusGradient,
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top badge row: Status pill + Locked pill + Due Date
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      // Status Badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3.5,
                        ),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: statusColor.withOpacity(0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '#${widget.serial} ',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: statusColor,
                              ),
                            ),
                            Icon(
                              isSubmitted
                                  ? Icons.check_circle_outline_rounded
                                  : isPastDue
                                      ? Icons.error_outline_rounded
                                      : Icons.access_time_rounded,
                              size: 13,
                              color: statusColor,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              isSubmitted
                                  ? 'SUBMITTED'
                                  : isPastDue
                                      ? 'PAST DEADLINE'
                                      : 'HOMEWORK PENDING',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.4,
                                color: statusColor,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Locked Badge
                      if (!isOpen)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3.5,
                          ),
                          decoration: BoxDecoration(
                            color: tokens.surfaceSecondary,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: tokens.border,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.lock_outline_rounded,
                                size: 12,
                                color: tokens.textSecondary,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'SUBMISSIONS CLOSED',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.4,
                                  color: tokens.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Due Date
                      if (dateFormatted.isNotEmpty)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.calendar_today_outlined,
                              size: 12,
                              color: tokens.textSecondary,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Due: $dateFormatted',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: tokens.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (countdown.isNotEmpty) ...[
                              const SizedBox(width: 4),
                              Text(
                                '($countdown)',
                                style: TextStyle(
                                  fontSize: 11.5,
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
                      fontSize: 16.5,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary,
                      height: 1.25,
                    ),
                  ),

                  // Description (expandable if long)
                  if (desc != null && desc.isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Text(
                      desc,
                      maxLines: _isExpanded ? null : 2,
                      overflow: _isExpanded
                          ? TextOverflow.visible
                          : TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        color: tokens.textSecondary,
                        height: 1.45,
                      ),
                    ),
                    if (desc.length > 100)
                      GestureDetector(
                        onTap: () => setState(() => _isExpanded = !_isExpanded),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 3),
                          child: Text(
                            _isExpanded ? 'Less' : 'Read more',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: widget.accent,
                            ),
                          ),
                        ),
                      ),
                  ],

                  // Divider
                  const SizedBox(height: 14),
                  Container(
                    height: 1,
                    color: tokens.border,
                  ),
                  const SizedBox(height: 12),

                  // Bottom Area: Submission status info & Actions
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Status / Submission Notice
                      if (isSubmitted && mySub != null) ...[
                        Row(
                          children: [
                            const Icon(
                              Icons.task_alt_rounded,
                              size: 15,
                              color: Color(0xFF10B981),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'You submitted ${(mySub['fileUrls'] as List?)?.length ?? 0} file(s) on ${_formatDate(mySub['submittedAt'] as String?)}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: tokens.textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                      ] else ...[
                        Text(
                          canSubmit
                              ? 'Submit before the deadline.'
                              : 'Submission is currently closed by admin.',
                          style: TextStyle(
                            fontSize: 12,
                            color: tokens.textMuted,
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],

                      // Actions Row: View Materials & Submit
                      Wrap(
                        alignment: WrapAlignment.end,
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          // Materials Button
                          if (fileUrls.isNotEmpty)
                            OutlinedButton.icon(
                              onPressed: () {
                                if (fileUrls.length == 1) {
                                  _openMaterialInApp(
                                    context,
                                    url: fileUrls.first,
                                    label: 'Material 1',
                                    courseId: widget.courseId,
                                  );
                                } else {
                                  _showMaterialPickerSheet(context, fileUrls);
                                }
                              },
                              icon: Icon(
                                Icons.description_outlined,
                                size: 14,
                                color: tokens.textPrimary,
                              ),
                              label: Text(
                                fileUrls.length == 1
                                    ? 'View Material'
                                    : 'Materials (${fileUrls.length})',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: tokens.textPrimary,
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                side: BorderSide(color: tokens.border),
                                backgroundColor: tokens.surfaceSecondary,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 8,
                                ),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                            ),

                          // Submit Action Button
                          ElevatedButton.icon(
                            onPressed: canSubmit
                                ? () => HomeworkSubmitSheet.show(
                                      context,
                                      homework: hw,
                                      courseId: widget.courseId,
                                      accent: widget.accent,
                                    )
                                : null,
                            icon: Icon(
                              !canSubmit
                                  ? Icons.lock_outline_rounded
                                  : isSubmitted
                                      ? Icons.edit_outlined
                                      : Icons.upload_file_outlined,
                              size: 14,
                            ),
                            label: Text(
                              !canSubmit
                                  ? 'Submission Closed'
                                  : isSubmitted
                                      ? 'Update Submission'
                                      : 'Submit Homework',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: !canSubmit
                                  ? tokens.surfaceSecondary
                                  : isSubmitted
                                      ? tokens.surfaceSecondary
                                      : widget.accent,
                              foregroundColor: !canSubmit
                                  ? tokens.textMuted
                                  : isSubmitted
                                      ? tokens.textPrimary
                                      : Colors.white,
                              elevation: isSubmitted || !canSubmit ? 0 : 2,
                              side: isSubmitted
                                  ? BorderSide(color: tokens.border)
                                  : BorderSide.none,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMaterialPickerSheet(BuildContext context, List<String> fileUrls) {
    final tokens = context.tokens;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Homework Materials',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              ...fileUrls.asMap().entries.map((entry) {
                final idx = entry.key;
                final url = entry.value;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.description_outlined,
                      size: 20,
                      color: widget.accent,
                    ),
                  ),
                  title: Text(
                    'Material ${idx + 1}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: tokens.textPrimary,
                    ),
                  ),
                  subtitle: Text(
                    url,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      color: tokens.textMuted,
                    ),
                  ),
                  trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14),
                  onTap: () {
                    Navigator.pop(context);
                    _openMaterialInApp(
                      context,
                      url: url,
                      label: 'Material ${idx + 1}',
                      courseId: widget.courseId,
                    );
                  },
                );
              }),
            ],
          ),
        ),
      ),
    );
  }
}

/// Fullscreen in-app image viewer with pinch-to-zoom
class _InAppImageViewerDialog extends StatelessWidget {
  const _InAppImageViewerDialog({
    required this.url,
    required this.title,
  });

  final String url;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black.withOpacity(0.85),
        elevation: 0,
        title: Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Center(
        child: InteractiveViewer(
          minScale: 0.8,
          maxScale: 5.0,
          child: Image.network(
            url,
            fit: BoxFit.contain,
            loadingBuilder: (context, child, progress) {
              if (progress == null) return child;
              return const Center(
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white70),
                ),
              );
            },
            errorBuilder: (context, error, stackTrace) => const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.broken_image_rounded, size: 48, color: Colors.white54),
                  SizedBox(height: 10),
                  Text(
                    'Failed to load image',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
