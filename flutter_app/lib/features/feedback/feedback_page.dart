import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../courses/courses_page.dart' show coursesProvider;
import 'rate_course_sheet.dart';

/// GET /api/feedback → list of feedback rows the user has already submitted.
final myFeedbackProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/feedback');
    final list = res.data is List ? res.data as List : const [];
    return [for (final j in list) j as Map<String, dynamic>];
  } catch (_) {
    return const [];
  }
});

/// /api/courses → list of courses available to the student.
final enrolledCoursesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  // 1. First watch coursesProvider (already loaded and cached in SharedPreferences)
  try {
    final courses = await ref.watch(coursesProvider.future);
    if (courses.isNotEmpty) {
      return [
        for (final c in courses)
          {
            'id': c.id,
            'name': c.name,
            'subject': c.subject,
            'color': c.color,
            'teacherName': c.teacherName,
          }
      ];
    }
  } catch (_) {}

  // 2. Direct API call fallback
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/courses');
    final data = res.data;
    final list = data is List
        ? data
        : (data is Map && data['courses'] is List
            ? data['courses']
            : <dynamic>[]);
    if (list.isNotEmpty) {
      return [for (final c in list) c as Map<String, dynamic>];
    }
  } catch (_) {}

  // 3. SharedPreferences cache fallback
  try {
    final prefs = await SharedPreferences.getInstance();
    final cachedStr = prefs.getString('cached_courses_payload');
    if (cachedStr != null && cachedStr.isNotEmpty) {
      final list = jsonDecode(cachedStr) as List;
      return [for (final c in list) c as Map<String, dynamic>];
    }
  } catch (_) {}

  return const [];
});

class FeedbackPage extends ConsumerWidget {
  const FeedbackPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).valueOrNull;
    final role = (user?.role ?? 'STUDENT').toUpperCase();
    final isStudent = role == 'STUDENT';
    final currentUserId = user?.id;

    final enrolledAsync = ref.watch(enrolledCoursesProvider);
    final mineAsync = ref.watch(myFeedbackProvider);
    final allFeedback = mineAsync.valueOrNull ?? const [];
    final tokens = context.tokens;

    // Filter out any legacy APP type feedback
    final courseFeedbacks = allFeedback
        .where((f) => f['courseId'] != 'APP' && f['type'] != 'APP')
        .toList();

    final feedbackByCourseId = <String, Map<String, dynamic>>{};
    for (final f in courseFeedbacks) {
      final cId = (f['courseId'] ?? (f['course'] as Map?)?['id'])?.toString();
      if (cId != null) {
        feedbackByCourseId[cId] = f;
      }
    }

    final allCourses = enrolledAsync.valueOrNull ?? [];
    // Only students have unrated pending courses
    final unrated = isStudent
        ? allCourses
            .where((c) => !feedbackByCourseId.containsKey(c['id']?.toString()))
            .toList()
        : const <Map<String, dynamic>>[];

    return AppPageScaffold(
      title: 'Course Feedback',
      subtitle: isStudent
          ? 'Rate your enrolled courses to help us improve'
          : 'Student reviews and course ratings',
      showBack: true,
      body: AppRefresh(
        onRefresh: () async {
          ref.invalidate(coursesProvider);
          ref.invalidate(enrolledCoursesProvider);
          ref.invalidate(myFeedbackProvider);
        },
        child: enrolledAsync.when(
          loading: () => Center(
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: tokens.primaryAccent,
            ),
          ),
          error: (e, _) => ListView(
            padding: const EdgeInsets.all(40),
            children: [
              Icon(Icons.cloud_off, color: tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text(
                'Could not load courses',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: tokens.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                e.toString(),
                style: TextStyle(
                  fontSize: 13.5,
                  color: tokens.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
          data: (courses) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(0, 16, 0, 32),
              children: [
                // ── 1. Pending Course Reviews (STUDENTS ONLY) ───────────────────
                if (isStudent && unrated.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _SectionHeader(
                      title: 'PENDING COURSE REVIEWS',
                      badge: '${unrated.length}',
                      badgeColor: tokens.warning,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      children: [
                        for (final c in unrated) ...[
                          _CourseFeedbackRow(
                            course: c,
                            existingFeedback: feedbackByCourseId[c['id']?.toString()],
                          ),
                          const SizedBox(height: 10),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // ── 2. Submitted Course Reviews ─────────────────────────────────
                if (courseFeedbacks.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _SectionHeader(
                      title: isStudent ? 'YOUR SUBMITTED REVIEWS' : 'STUDENT COURSE REVIEWS',
                      badge: '${courseFeedbacks.length}',
                      badgeColor: tokens.success,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      children: [
                        for (final f in courseFeedbacks) ...[
                          _MyFeedbackRow(
                            f: f,
                            isStudent: isStudent,
                            currentUserId: currentUserId,
                            onTap: () {
                              final course = f['course'] as Map<String, dynamic>?;
                              final cId = (f['courseId'] ?? course?['id'])?.toString() ?? '';
                              final cName = (course?['name'] as String?) ?? 'Course';
                              RateCourseSheet.show(
                                context,
                                courseId: cId,
                                courseName: cName,
                                existingFeedback: f,
                              );
                            },
                          ),
                          const SizedBox(height: 10),
                        ],
                      ],
                    ),
                  ),
                ] else if (!isStudent) ...[
                  Padding(
                    padding: const EdgeInsets.all(40),
                    child: Column(
                      children: [
                        Icon(Icons.rate_review_outlined, color: tokens.textMuted, size: 44),
                        const SizedBox(height: 12),
                        Text(
                          'No student reviews yet',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: tokens.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'When students submit feedback for courses, their ratings and reviews will appear here.',
                          style: TextStyle(fontSize: 13, color: tokens.textSecondary),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ] else if (courses.isEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.all(40),
                    child: Column(
                      children: [
                        Icon(Icons.school_outlined, color: tokens.textMuted, size: 48),
                        const SizedBox(height: 12),
                        Text(
                          'No courses found',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: tokens.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Your courses will appear here once active in your account.',
                          style: TextStyle(
                            fontSize: 13.5,
                            color: tokens.textSecondary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
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

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.badge, required this.badgeColor});
  final String title;
  final String badge;
  final Color badgeColor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Row(
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            color: tokens.textSecondary,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(color: badgeColor.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
          child: Text(badge, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: badgeColor)),
        )
      ],
    );
  }
}

class _CourseFeedbackRow extends StatelessWidget {
  const _CourseFeedbackRow({
    required this.course,
    required this.existingFeedback,
  });

  final Map<String, dynamic> course;
  final Map<String, dynamic>? existingFeedback;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final name = (course['name'] as String?) ?? 'Course';
    final subject = course['subject'] as String?;
    final alreadyRated = existingFeedback != null;

    return InkWell(
      onTap: () => RateCourseSheet.show(
        context,
        courseId: (course['id'] as String?) ?? '',
        courseName: name,
        courseSubject: subject,
        existingFeedback: existingFeedback,
      ),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: alreadyRated ? const Color(0xFF6366F1).withOpacity(0.35) : tokens.border,
            width: alreadyRated ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFF6366F1).withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.star_rounded,
                color: Color(0xFFF59E0B),
                size: 26,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subject ?? 'IIT Madras BS Course',
                    style: TextStyle(
                      fontSize: 12.5,
                      color: tokens.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (alreadyRated)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: tokens.success.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle_rounded, color: tokens.success, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      'EDIT',
                      style: TextStyle(
                        color: tokens.success,
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              )
            else
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Rate',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 12.5,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MyFeedbackRow extends StatelessWidget {
  const _MyFeedbackRow({
    required this.f,
    required this.isStudent,
    required this.currentUserId,
    required this.onTap,
  });

  final Map<String, dynamic> f;
  final bool isStudent;
  final String? currentUserId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final rating = (f['teacherRating'] as num?)?.toInt() ?? 5;
    final comment = (f['comment'] as String?) ?? '';
    final course = f['course'] as Map<String, dynamic>?;
    final student = f['student'] as Map<String, dynamic>?;

    final studentId = f['studentId']?.toString() ?? student?['id']?.toString();
    final canEdit = isStudent &&
        (currentUserId == null || studentId == null || currentUserId == studentId);
    final studentName = student?['name'] as String? ??
        student?['securityNumber'] as String? ??
        student?['email'] as String? ??
        (f['studentName'] as String?);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: tokens.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (course?['name'] as String?) ?? 'Course',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: tokens.textPrimary,
                        ),
                      ),
                      if (!isStudent && studentName != null && studentName.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Icon(Icons.person_outline_rounded, size: 12, color: tokens.textSecondary),
                            const SizedBox(width: 4),
                            Text(
                              'By $studentName',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: tokens.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                Row(
                  children: List.generate(
                    5,
                    (i) => Icon(
                      i < rating ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: const Color(0xFFF59E0B),
                      size: 16,
                    ),
                  ),
                ),
              ],
            ),
            if (comment.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                comment,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.4,
                  color: tokens.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: canEdit
                        ? tokens.success.withOpacity(0.12)
                        : tokens.textMuted.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        canEdit ? Icons.edit_outlined : Icons.visibility_outlined,
                        size: 12,
                        color: canEdit ? tokens.success : tokens.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        canEdit ? 'EDIT' : 'VIEW',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: canEdit ? tokens.success : tokens.textSecondary,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}


