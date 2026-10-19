import 'package:flutter/services.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_theme_tokens.dart';
import 'feedback_page.dart' show myFeedbackProvider;

class _FeedbackCategory {
  const _FeedbackCategory({required this.id, required this.label, required this.description});
  final String id;
  final String label;
  final String description;
}

const List<_FeedbackCategory> _kFeedbackCategories = [
  _FeedbackCategory(
    id: 'teacherRating',
    label: 'Teacher Quality',
    description: 'Pace, communication, and teaching effectiveness',
  ),
  _FeedbackCategory(
    id: 'conceptRating',
    label: 'Concept Clarity',
    description: 'Depth, explanation, and clarity of topics',
  ),
  _FeedbackCategory(
    id: 'materialRating',
    label: 'Study Materials Quality',
    description: 'Notes, slides, PYQs, and assignment quality',
  ),
  _FeedbackCategory(
    id: 'recommendScore',
    label: 'Recommendation Score',
    description: 'How likely are you to recommend this course to a friend?',
  ),
];

/// Bottom sheet for course feedback — matches FeedbackModal.tsx from Next.js.
class RateCourseSheet extends ConsumerStatefulWidget {
  const RateCourseSheet({
    super.key,
    required this.courseId,
    required this.courseName,
    this.courseSubject,
    this.existingFeedback,
  });

  final String courseId;
  final String courseName;
  final String? courseSubject;
  final Map<String, dynamic>? existingFeedback;

  static Future<bool?> show(
    BuildContext context, {
    required String courseId,
    required String courseName,
    String? courseSubject,
    Map<String, dynamic>? existingFeedback,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => RateCourseSheet(
        courseId: courseId,
        courseName: courseName,
        courseSubject: courseSubject,
        existingFeedback: existingFeedback,
      ),
    );
  }

  @override
  ConsumerState<RateCourseSheet> createState() => _RateCourseSheetState();
}

class _RateCourseSheetState extends ConsumerState<RateCourseSheet> {
  final Map<String, int> _ratings = {};
  final _commentCtrl = TextEditingController();
  bool _submitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final existing = widget.existingFeedback;
    if (existing != null) {
      _ratings['teacherRating'] = (existing['teacherRating'] as num?)?.toInt() ?? 0;
      _ratings['conceptRating'] = (existing['conceptRating'] as num?)?.toInt() ?? 0;
      _ratings['materialRating'] = (existing['materialRating'] as num?)?.toInt() ?? 0;
      _ratings['recommendScore'] = (existing['recommendScore'] as num?)?.toInt() ?? 0;
      _commentCtrl.text = (existing['comment'] as String?) ?? '';
    } else {
      _ratings['teacherRating'] = 0;
      _ratings['conceptRating'] = 0;
      _ratings['materialRating'] = 0;
      _ratings['recommendScore'] = 0;
    }
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  List<_FeedbackCategory> get _categories {
    if (widget.courseId == 'APP') {
      return const [
        _FeedbackCategory(
          id: 'teacherRating',
          label: 'App UI & Design',
          description: 'Look, layout, ease of navigation, and user experience',
        ),
        _FeedbackCategory(
          id: 'conceptRating',
          label: 'Video & Lecture Player',
          description: 'Streaming smoothness, playback speed, and video quality',
        ),
        _FeedbackCategory(
          id: 'materialRating',
          label: 'Performance & Speed',
          description: 'App loading speed, stability, and responsiveness',
        ),
        _FeedbackCategory(
          id: 'recommendScore',
          label: 'Recommendation Score',
          description: 'How likely are you to recommend the Gen-Z IITian app?',
        ),
      ];
    }
    return _kFeedbackCategories;
  }

  Future<void> _submit() async {
    setState(() => _errorMessage = null);

    // Security check: Only the student who submitted can update/submit feedback.
    final user = ref.read(authStateProvider).value;
    final currentUserId = user?.id;
    final role = (user?.role ?? 'STUDENT').toUpperCase();
    final isStudent = role == 'STUDENT';
    final feedbackStudentId = widget.existingFeedback?['studentId'] ??
        widget.existingFeedback?['student']?['id'];
    final bool isOwner = isStudent &&
        (widget.existingFeedback == null ||
            feedbackStudentId == null ||
            feedbackStudentId == currentUserId);

    if (!isOwner) {
      if (mounted) Navigator.of(context).pop(false);
      return;
    }

    // Explicit validation check
    for (final cat in _categories) {
      if ((_ratings[cat.id] ?? 0) <= 0) {
        setState(() => _errorMessage = 'Please rate "${cat.label}" (1-5 stars)');
        return;
      }
    }

    setState(() => _submitting = true);

    try {
      final api = ref.read(apiClientProvider);
      final isEdit = widget.existingFeedback != null && widget.existingFeedback!['id'] != null;

      if (widget.courseId == 'APP') {
        final avgRating = ((_ratings['teacherRating']! +
                    _ratings['conceptRating']! +
                    _ratings['materialRating']! +
                    _ratings['recommendScore']!) /
                4)
            .round()
            .clamp(1, 5);

        final body = <String, dynamic>{
          'rating': avgRating,
          if (_commentCtrl.text.trim().isNotEmpty)
            'comment': _commentCtrl.text.trim(),
        };

        if (isEdit) {
          body['id'] = widget.existingFeedback!['id'];
          await api.put('/api/feedback/app', body: body);
        } else {
          body['platform'] = 'APP';
          await api.post('/api/feedback/app', body: body);
        }
      } else {
        final body = <String, dynamic>{
          'courseId': widget.courseId,
          'teacherRating': _ratings['teacherRating'],
          'conceptRating': _ratings['conceptRating'],
          'materialRating': _ratings['materialRating'],
          'recommendScore': _ratings['recommendScore'],
          if (_commentCtrl.text.trim().isNotEmpty)
            'comment': _commentCtrl.text.trim(),
        };

        if (isEdit) {
          body['id'] = widget.existingFeedback!['id'];
          await api.put('/api/feedback', body: body);
        } else {
          await api.post('/api/feedback', body: body);
        }
      }

      ref.invalidate(myFeedbackProvider);

      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEdit ? 'Feedback updated successfully!' : 'Thank you for your feedback!'),
            backgroundColor: const Color(0xFF34C759),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _errorMessage = 'Could not submit feedback: ${e.toString().replaceAll("Exception:", "").trim()}';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isEdit = widget.existingFeedback != null;

    final user = ref.watch(authStateProvider).value;
    final currentUserId = user?.id;
    final role = (user?.role ?? 'STUDENT').toUpperCase();
    final isStudent = role == 'STUDENT';
    final feedbackStudentId = widget.existingFeedback?['studentId'] ??
        widget.existingFeedback?['student']?['id'];
    final bool isOwner = isStudent &&
        (widget.existingFeedback == null ||
            feedbackStudentId == null ||
            feedbackStudentId == currentUserId);
    final studentName = widget.existingFeedback?['student']?['name'] as String? ??
        widget.existingFeedback?['student']?['securityNumber'] as String?;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.80,
      ),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 8, bottom: 2),
              width: 40,
              height: 4.5,
              decoration: BoxDecoration(
                color: tokens.border,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 14, 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              !isOwner
                                  ? 'Course Feedback Details'
                                  : (isEdit ? 'Edit Course Feedback' : 'Course Feedback'),
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                                color: tokens.textPrimary,
                                letterSpacing: -0.5,
                              ),
                            ),
                          ),
                          if (!isOwner)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: tokens.surfaceSecondary,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: tokens.border),
                              ),
                              child: const Text(
                                'READ ONLY',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        widget.courseName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF5856D6),
                        ),
                      ),
                      if (!isOwner && studentName != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Submitted by: $studentName',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: tokens.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Symbols.close_rounded,
                      color: tokens.textSecondary, size: 18, weight: 700),
                  style: IconButton.styleFrom(
                    backgroundColor: tokens.surfaceSecondary,
                    minimumSize: const Size(32, 32),
                    padding: EdgeInsets.zero,
                    tapTargetSize: MaterialTapTargetSize.padded,
                  ),
                  onPressed: () => Navigator.of(context).pop(false),
                ),
              ],
            ),
          ),

          const Divider(height: 0.5, thickness: 0.5),

          // Scrollable Body
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                16,
                12,
                16,
                MediaQuery.of(context).viewInsets.bottom + 16,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Validation Error alert
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: tokens.danger.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: tokens.danger.withOpacity(0.35)),
                      ),
                      child: Row(
                        children: [
                          Icon(Symbols.error_rounded, fill: 1, color: tokens.danger, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: TextStyle(
                                color: tokens.danger,
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  if (_errorMessage != null) const SizedBox(height: 12),

                  // 4 categories: one inset-grouped list, hairline separators
                  Container(
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (var i = 0; i < _categories.length; i++)
                          _buildCategoryCard(_categories[i], tokens, isOwner,
                              isLast: i == _categories.length - 1),
                      ],
                    ),
                  ),

                  // Privacy note as a quiet footnote
                  Padding(
                    padding: const EdgeInsets.fromLTRB(6, 8, 6, 0),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 1),
                          child: Icon(Symbols.lock_rounded,
                              fill: 1, color: Color(0xFF5856D6), size: 14),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Your feedback is completely private. Teachers cannot see your name or identity.',
                            style: TextStyle(
                              fontSize: 12,
                              color: tokens.textSecondary,
                              height: 1.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Additional comments
                  Text(
                    'Additional Comments (Optional)',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                      color: tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextField(
                          controller: _commentCtrl,
                          readOnly: !isOwner,
                          enabled: isOwner,
                          minLines: 2,
                          maxLines: 4,
                          maxLength: 500,
                          onChanged: isOwner ? (_) => setState(() {}) : null,
                          style: TextStyle(
                            color: tokens.textPrimary,
                            fontSize: 14.5,
                            height: 1.4,
                          ),
                          decoration: InputDecoration(
                            hintText: isOwner
                                ? 'Share more about what went well and what can be improved...'
                                : (_commentCtrl.text.isEmpty ? 'No comments provided.' : ''),
                            hintStyle: TextStyle(color: tokens.textMuted, fontSize: 13.5),
                            border: InputBorder.none,
                            isDense: true,
                            counterText: '',
                          ),
                        ),
                        if (isOwner)
                          Align(
                            alignment: Alignment.bottomRight,
                            child: Text(
                              '${_commentCtrl.text.length}/500',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: tokens.textMuted,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Submit / Close Button
                  if (isOwner)
                    ApplePressable(
                      onTap: _submitting ? null : _submit,
                      child: SizedBox(
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _submitting ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF5856D6),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: const Color(0xFF5856D6).withOpacity(0.6),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(25),
                          ),
                          elevation: 0,
                        ),
                        child: _submitting
                            ? const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      color: Colors.white,
                                    ),
                                  ),
                                  SizedBox(width: 12),
                                  Text(
                                    'Submitting...',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              )
                            : Text(
                                isEdit ? 'Update Feedback' : 'Submit Feedback',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: -0.2,
                                ),
                              ),
                      ),
                    ))
                  else
                    SizedBox(
                      height: 50,
                      child: ElevatedButton(
                        onPressed: () => Navigator.of(context).pop(false),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: tokens.surfaceSecondary,
                          foregroundColor: tokens.textPrimary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: BorderSide(color: tokens.border),
                          ),
                          elevation: 0,
                        ),
                        child: const Text(
                          'Close',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryCard(
    _FeedbackCategory cat,
    AppThemeTokens tokens,
    bool isOwner, {
    bool isLast = false,
  }) {
    final currentVal = _ratings[cat.id] ?? 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 10),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : Border(bottom: BorderSide(color: tokens.border, width: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  cat.label,
                  style: TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.2,
                    color: tokens.textPrimary,
                  ),
                ),
              ),
              _StarRating(
                value: currentVal,
                enabled: isOwner,
                emptyColor: tokens.textMuted.withValues(alpha: 0.55),
                onChanged: (v) {
                  setState(() {
                    _ratings[cat.id] = v;
                    _errorMessage = null;
                  });
                },
              ),
            ],
          ),
          Text(
            cat.description,
            style: TextStyle(
              fontSize: 12.5,
              color: tokens.textSecondary,
              height: 1.25,
            ),
          ),
        ],
      ),
    );
  }
}

/// Five stars that respond the instant a finger lands and can be scrubbed
/// with a horizontal drag (1:1 tracking). Light haptic on each change.
class _StarRating extends StatelessWidget {
  const _StarRating({
    required this.value,
    required this.enabled,
    required this.emptyColor,
    required this.onChanged,
  });

  final int value;
  final bool enabled;
  final Color emptyColor;
  final ValueChanged<int> onChanged;

  static const double _star = 24;
  static const double _gap = 4;

  void _set(double dx) {
    final v = ((dx / (_star + _gap)).floor() + 1).clamp(1, 5);
    if (v != value) {
      HapticFeedback.selectionClick();
      onChanged(v);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: enabled ? (d) => _set(d.localPosition.dx) : null,
      onHorizontalDragUpdate: enabled ? (d) => _set(d.localPosition.dx) : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 1; i <= 5; i++) ...[
              Icon(
                Symbols.star_rounded,
                fill: i <= value ? 1 : 0,
                weight: i <= value ? 500 : 400,
                size: _star,
                color: i <= value ? const Color(0xFFFF9500) : emptyColor,
              ),
              if (i < 5) const SizedBox(width: _gap),
            ],
          ],
        ),
      ),
    );
  }
}
