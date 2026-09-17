import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
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
    final user = ref.read(authStateProvider).valueOrNull;
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
            backgroundColor: const Color(0xFF10B981),
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

    final user = ref.watch(authStateProvider).valueOrNull;
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
        maxHeight: MediaQuery.of(context).size.height * 0.92,
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
              margin: const EdgeInsets.only(top: 12, bottom: 6),
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
            padding: const EdgeInsets.fromLTRB(22, 10, 16, 12),
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
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                color: tokens.textPrimary,
                                letterSpacing: -0.3,
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
                          color: Color(0xFF6366F1),
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
                  icon: Icon(Icons.close_rounded, color: tokens.textSecondary, size: 24),
                  onPressed: () => Navigator.of(context).pop(false),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Scrollable Body
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                22,
                16,
                22,
                MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Privacy note
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6366F1).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.lock_outline_rounded, color: Color(0xFF6366F1), size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Your feedback is completely private. Teachers cannot see your name or identity.',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: tokens.textSecondary,
                              height: 1.35,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

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
                          Icon(Icons.error_outline_rounded, color: tokens.danger, size: 20),
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

                  const SizedBox(height: 20),

                  // 4 Categories
                  for (final cat in _categories) ...[
                    _buildCategoryCard(cat, tokens, isOwner),
                    const SizedBox(height: 16),
                  ],

                  // Additional comments
                  Text(
                    'Additional Comments (Optional)',
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: tokens.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextField(
                          controller: _commentCtrl,
                          readOnly: !isOwner,
                          enabled: isOwner,
                          minLines: 3,
                          maxLines: 6,
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

                  const SizedBox(height: 24),

                  // Submit / Close Button
                  if (isOwner)
                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _submitting ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4F46E5),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: const Color(0xFF4F46E5).withOpacity(0.6),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
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
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                      ),
                    )
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

  Widget _buildCategoryCard(_FeedbackCategory cat, AppThemeTokens tokens, bool isOwner) {
    final currentVal = _ratings[cat.id] ?? 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: tokens.surfaceSecondary,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: currentVal > 0 ? const Color(0xFF6366F1).withOpacity(0.4) : tokens.border,
          width: currentVal > 0 ? 1.5 : 1,
        ),
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
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: tokens.textPrimary,
                  ),
                ),
              ),
              if (currentVal > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 14),
                      const SizedBox(width: 3),
                      Text(
                        '$currentVal/5',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFD97706),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            cat.description,
            style: TextStyle(
              fontSize: 12,
              color: tokens.textSecondary,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(5, (i) {
              final starNum = i + 1;
              final isFilled = starNum <= currentVal;
              return InkWell(
                onTap: isOwner
                    ? () {
                        setState(() {
                          _ratings[cat.id] = starNum;
                          _errorMessage = null;
                        });
                      }
                    : null,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  child: Icon(
                    isFilled ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: isFilled ? const Color(0xFFF59E0B) : tokens.textMuted.withOpacity(0.5),
                    size: 38,
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

