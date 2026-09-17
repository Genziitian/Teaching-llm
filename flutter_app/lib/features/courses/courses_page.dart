import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/models/course.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../shared/widgets/shimmer_loading.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../dashboard/dashboard_providers.dart';

const _kCachedCoursesKey = 'cached_courses_payload';
const _kPinnedCoursesKey = 'pinned_course_ids';

final courseSearchQueryProvider = StateProvider<String>((ref) => '');

final pinnedCoursesProvider =
    StateNotifierProvider<PinnedCoursesNotifier, Set<String>>((ref) {
  return PinnedCoursesNotifier();
});

class PinnedCoursesNotifier extends StateNotifier<Set<String>> {
  PinnedCoursesNotifier() : super(<String>{}) {
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_kPinnedCoursesKey) ?? <String>[];
      state = list.toSet();
    } catch (_) {}
  }

  Future<void> togglePin(String courseId) async {
    final next = Set<String>.from(state);
    if (next.contains(courseId)) {
      next.remove(courseId);
    } else {
      next.add(courseId);
    }
    state = next;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_kPinnedCoursesKey, next.toList());
    } catch (_) {}
  }

  bool isPinned(String courseId) => state.contains(courseId);
}

final coursesProvider = FutureProvider<List<Course>>((ref) async {
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
      SharedPreferences.getInstance().then((prefs) {
        prefs.setString(_kCachedCoursesKey, jsonEncode(list));
      }).catchError((_) {});

      return [
        for (final j in list) Course.fromJson(j as Map<String, dynamic>)
      ];
    }
    return const <Course>[];
  } catch (err) {
    if (err is DioException) {
      final statusCode = err.response?.statusCode;
      final errMsg = (err.message ?? '').toLowerCase();
      if (statusCode == 401 ||
          statusCode == 403 ||
          errMsg.contains('not authenticated') ||
          errMsg.contains('unauthorized')) {
        Future.microtask(() => ref.read(authStateProvider.notifier).signOut());
        return const <Course>[];
      }
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedStr = prefs.getString(_kCachedCoursesKey);
      if (cachedStr != null && cachedStr.isNotEmpty) {
        final list = jsonDecode(cachedStr) as List;
        return [
          for (final j in list) Course.fromJson(j as Map<String, dynamic>)
        ];
      }
    } catch (_) {}
  }

  return const <Course>[];
});

/// Redesigned My Courses screen — matches courses.jsx from the design canvas:
/// page heading + filter button, search field, Continue-learning hero,
/// All-courses section with structured colour-banded cards.
class CoursesPage extends ConsumerWidget {
  const CoursesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(coursesProvider);
    final count = async.value?.length ?? 0;
    final dash = ref.watch(dashboardProvider).valueOrNull;
    final recentLecture = dash?['recentViewedLecture'] as Map<String, dynamic>?;
    final hasRecent = recentLecture != null &&
        recentLecture.isNotEmpty &&
        (recentLecture['content'] != null || recentLecture['id'] != null);
    final String? recentCourseId = hasRecent
        ? (((recentLecture['content'] as Map?)?['topic'] as Map?)?['courseId'] as String? ??
            (recentLecture['content'] as Map?)?['courseId'] as String? ??
            recentLecture['courseId'] as String?)
        : null;

    return Scaffold(
      backgroundColor: context.tokens.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SubPageHeader(
              title: 'My Courses',
              showBack: false,
              right: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: context.tokens.surfaceSecondary,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: context.tokens.border),
                ),
                child: Text(
                  '$count Enrolled',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: context.tokens.textSecondary,
                  ),
                ),
              ),
            ),
            Expanded(
              child: AppRefresh(
                onRefresh: () async => ref.invalidate(coursesProvider),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 110),
                  children: [
                    const _SearchField(),
                    async.when(
                      loading: () => const Column(
                        children: [
                          SizedBox(height: 14),
                          SkeletonBox(height: 140, borderRadius: 20),
                          SizedBox(height: 14),
                          SkeletonBox(height: 120, borderRadius: 20),
                          SizedBox(height: 14),
                          SkeletonBox(height: 120, borderRadius: 20),
                        ],
                      ),
                      error: (e, _) => _Error(message: e.toString()),
                      data: (rawCourses) {
                        if (rawCourses.isEmpty) return const _Empty();

                        final query = ref.watch(courseSearchQueryProvider).trim().toLowerCase();
                        final pinnedIds = ref.watch(pinnedCoursesProvider);

                        final courses = query.isEmpty
                            ? rawCourses
                            : rawCourses.where((c) {
                                final name = c.name.toLowerCase();
                                final subj = (c.subject ?? '').toLowerCase();
                                final mentor = (c.teacherName ?? '').toLowerCase();
                                return name.contains(query) ||
                                    subj.contains(query) ||
                                    mentor.contains(query);
                              }).toList();

                        if (courses.isEmpty) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 40),
                            child: Center(
                              child: Text(
                                'No courses match "$query"',
                                style: TextStyle(
                                  color: context.tokens.textSecondary,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          );
                        }

                        // Only show Continue Learning if the user actually has an active (non-expired) in-progress course and not searching
                        Course? continueCourse;
                        if (query.isEmpty && recentCourseId != null && recentCourseId.isNotEmpty) {
                          for (final c in courses) {
                            if (c.id == recentCourseId && !c.isExpired) {
                              continueCourse = c;
                              break;
                            }
                          }
                        }

                        final remainingCourses = continueCourse != null
                            ? courses.where((c) => c.id != continueCourse!.id).toList()
                            : List<Course>.from(courses);

                        // Sort remaining courses: pinned first, active courses next, expired courses last
                        remainingCourses.sort((a, b) {
                          final aPinned = pinnedIds.contains(a.id);
                          final bPinned = pinnedIds.contains(b.id);
                          if (aPinned && !bPinned) return -1;
                          if (!aPinned && bPinned) return 1;
                          if (!a.isExpired && b.isExpired) return -1;
                          if (a.isExpired && !b.isExpired) return 1;
                          return 0;
                        });

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (continueCourse != null) ...[
                              const SizedBox(height: 14),
                              _ContinueCard(course: continueCourse),
                            ],
                            const SizedBox(height: 14),
                            for (final c in remainingCourses) ...[
                              _CourseCard(course: c),
                              const SizedBox(height: 14),
                            ],
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchField extends ConsumerWidget {
  const _SearchField();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;

    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: tokens.surfaceSecondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.border),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          Icon(Icons.search, size: 18, color: tokens.textMuted),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              onChanged: (val) {
                ref.read(courseSearchQueryProvider.notifier).state = val;
              },
              decoration: InputDecoration(
                hintText: 'Search your courses…',
                border: InputBorder.none,
                hintStyle: TextStyle(
                  color: tokens.textMuted,
                  fontSize: 13.5,
                ),
              ),
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 13.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Color _accentOf(Course c) {
  if (_usesNeutralCardColors(c)) return const Color(0xFF4B5563);
  final v = int.tryParse(c.color.replaceAll('#', ''), radix: 16) ?? 0x6366F1;
  return Color(0xFF000000 | v);
}

bool _isGeneralAccess(Course course) =>
    course.enrollmentType?.trim().toUpperCase() == 'FREE' ||
    course.enrollmentType?.trim().toUpperCase() == 'DEMO';

bool _isRecordedAccess(Course course) {
  final type = course.enrollmentType?.trim().toUpperCase();
  return type == null ||
      type.isEmpty ||
      (type != 'LIVE' && type != 'FREE' && type != 'DEMO');
}

bool _usesNeutralCardColors(Course course) =>
    course.isExpired || _isGeneralAccess(course) || _isRecordedAccess(course);

Color _headerEndColor(Course course, Color accent) =>
    course.isExpired
        ? const Color(0xFF374151)
        : (_usesNeutralCardColors(course)
            ? const Color(0xFF6B7280)
            : accent.withOpacity(0.78));

class _ContinueCard extends StatelessWidget {
  const _ContinueCard({required this.course});
  final Course course;

  @override
  Widget build(BuildContext context) {
    final accent = _accentOf(course);
    final tokens = context.tokens;

    return BouncyPressable(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/courses/${course.id}');
      },
      scaleDown: 0.98,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: tokens.border),
          boxShadow: AppShadows.md,
        ),
        child: Row(
          children: [
            Container(
              width: 92,
              height: 92,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: LinearGradient(
                  colors: [accent, _headerEndColor(course, accent)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              alignment: Alignment.center,
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0x59FFFFFF),
                  borderRadius: BorderRadius.circular(19),
                  border: Border.all(
                      color: const Color(0x59FFFFFF), width: 1.5),
                ),
                child: const Icon(Icons.play_arrow,
                    color: Colors.white, size: 18),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CONTINUE LEARNING',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: tokens.primaryAccent,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    course.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    course.subject ?? course.teacherName ?? 'Mentor',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: tokens.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: tokens.primaryAccent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.play_arrow, color: Colors.white, size: 12),
                        SizedBox(width: 4),
                        Text(
                          'Resume',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CourseCard extends ConsumerWidget {
  const _CourseCard({required this.course});
  final Course course;

  String _batchLabel() {
    switch (course.enrollmentType?.trim().toUpperCase()) {
      case 'LIVE':
        return 'LIVE BATCH';
      case 'RECORDED':
        return 'RECORDED BATCH';
      case 'FREE':
        return 'GENERAL BATCH';
      case 'DEMO':
        return 'DEMO';
      default:
        return 'RECORDED BATCH';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accent = _accentOf(course);
    final mentor = (course.teacherName ?? 'Mentor');
    final mentorInitial =
        mentor.trim().isNotEmpty ? mentor.trim()[0].toUpperCase() : '?';
    final tokens = context.tokens;
    final isPinned = ref.watch(pinnedCoursesProvider).contains(course.id);
    final isExpired = course.isExpired;

    return BouncyPressable(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/courses/${course.id}');
      },
      scaleDown: 0.98,
      child: Container(
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isPinned
                ? tokens.primaryAccent.withOpacity(0.5)
                : (isExpired ? const Color(0x40EF4444) : tokens.border),
            width: isPinned ? 1.5 : 1.0,
          ),
          boxShadow: AppShadows.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Coloured header band
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(19)),
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [accent, _headerEndColor(course, accent)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Stack(
                  clipBehavior: Clip.hardEdge,
                  children: [
                    Positioned(
                      right: -30,
                      top: -30,
                      child: Container(
                        width: 110,
                        height: 110,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0x14FFFFFF),
                        ),
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 9, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0x33FFFFFF),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                _batchLabel(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.6,
                                ),
                              ),
                            ),
                            if (isExpired) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEF4444),
                                  borderRadius: BorderRadius.circular(6),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Color(0x4DEF4444),
                                      blurRadius: 6,
                                      offset: Offset(0, 1.5),
                                    ),
                                  ],
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.lock_clock_rounded,
                                        size: 11, color: Colors.white),
                                    SizedBox(width: 3.5),
                                    Text(
                                      'EXPIRED',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.6,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            if (isPinned) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0x40FFFFFF),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.push_pin_rounded,
                                        size: 11, color: Colors.white),
                                    SizedBox(width: 3),
                                    Text(
                                      'PINNED',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            const Spacer(),
                            Builder(builder: (_) {
                              final tag = (_isRecordedAccess(course)
                                      ? 'PLUS'
                                      : course.enrollmentType
                                                  ?.trim()
                                                  .toUpperCase() ==
                                              'LIVE'
                                          ? 'PRO'
                                      : _isGeneralAccess(course)
                                          ? 'GENERAL'
                                          : course.tag ??
                                              course.packageName ??
                                              'PRO')
                                  .trim()
                                  .toUpperCase();
                              return Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 9, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0x2EFFFFFF),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  tag,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              );
                            }),
                          ],
                        ),
                        const SizedBox(height: 28),
                        Text(
                          course.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                        ),
                        if (course.description != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            course.description!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xD9FFFFFF),
                              fontSize: 11.5,
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (isExpired)
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            color: const Color(0x99000000),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          alignment: Alignment.center,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0x33EF4444),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                  color: const Color(0x80EF4444), width: 1.5),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.lock_clock_rounded,
                                    color: Colors.white, size: 16),
                                SizedBox(width: 6),
                                Text(
                                  'EXPIRED',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.8,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // Body
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 26,
                        height: 26,
                        decoration: BoxDecoration(
                          color: accent.withOpacity(0.12),
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          mentorInitial,
                          style: TextStyle(
                            color: accent,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        mentor,
                        style: TextStyle(
                          fontSize: 12.5,
                          color: tokens.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if ((course.subject ?? '').trim().isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Container(
                          width: 3,
                          height: 3,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: tokens.textMuted,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            course.subject!.trim(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: tokens.textSecondary,
                            ),
                          ),
                        ),
                      ],
                      const Spacer(),
                      if (isExpired)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0x1FEF4444),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                                color: const Color(0x40EF4444)),
                          ),
                          child: const Text(
                            'Access expired',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFDC2626),
                            ),
                          ),
                        )
                      else if (course.accessDays != null &&
                          course.accessDays! <= 7)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0x1FF59E0B),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                                color: const Color(0x40F59E0B)),
                          ),
                          child: Text(
                            'Ends in ${course.accessDays}d',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFD97706),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Stats strip
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: _Stat(
                            value: course.topicsCount,
                            label: 'Topics',
                          ),
                        ),
                        Container(
                          width: 1,
                          height: 28,
                          color: tokens.border,
                        ),
                        Expanded(
                          child: _Stat(
                            value: course.lecturesCount,
                            label: 'Lectures',
                          ),
                        ),
                        Container(
                          width: 1,
                          height: 28,
                          color: tokens.border,
                        ),
                        Expanded(
                          child: _Stat(
                            value: course.materialsCount,
                            label: 'Materials',
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Actions
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 42,
                          decoration: BoxDecoration(
                            color: isExpired
                                ? const Color(0x1AEF4444)
                                : tokens.textPrimary,
                            borderRadius: BorderRadius.circular(12),
                            border: isExpired
                                ? Border.all(
                                    color: const Color(0x33EF4444))
                                : null,
                          ),
                          alignment: Alignment.center,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                isExpired ? 'Access Expired' : 'Continue',
                                style: TextStyle(
                                  color: isExpired
                                      ? const Color(0xFFDC2626)
                                      : tokens.bg,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Icon(
                                isExpired
                                    ? Icons.lock_outline_rounded
                                    : Icons.arrow_forward,
                                color: isExpired
                                    ? const Color(0xFFDC2626)
                                    : tokens.bg,
                                size: isExpired ? 14 : 12,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      BouncyPressable(
                        onTap: () {
                          HapticFeedback.mediumImpact();
                          final nowPinned = !isPinned;
                          ref
                              .read(pinnedCoursesProvider.notifier)
                              .togglePin(course.id);
                          ScaffoldMessenger.of(context).clearSnackBars();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                nowPinned
                                    ? '📌 "${course.name}" pinned to top'
                                    : 'Unpinned "${course.name}"',
                              ),
                              duration: const Duration(milliseconds: 1400),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        child: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: isPinned
                                ? tokens.primaryAccent.withOpacity(0.18)
                                : tokens.surfaceSecondary,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isPinned
                                  ? tokens.primaryAccent
                                  : tokens.border,
                              width: isPinned ? 1.5 : 1.0,
                            ),
                          ),
                          child: Icon(
                            isPinned
                                ? Icons.push_pin_rounded
                                : Icons.push_pin_outlined,
                            color: isPinned
                                ? tokens.primaryAccent
                                : tokens.textSecondary,
                            size: 18,
                          ),
                        ),
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
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          Text(
            '$value',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: tokens.textPrimary,
              height: 1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              color: tokens.textMuted,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(
        children: [
          Icon(Icons.menu_book_outlined, color: tokens.textMuted, size: 40),
          const SizedBox(height: 8),
          Text(
            'No courses enrolled yet',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: tokens.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            'Enrolled courses will show up here.',
            style: TextStyle(
              fontSize: 13,
              color: tokens.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(
        children: [
          Icon(Icons.cloud_off, color: tokens.textMuted, size: 40),
          const SizedBox(height: 8),
          Text(
            'Could not load your courses',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: tokens.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            message,
            style: TextStyle(
              fontSize: 13,
              color: tokens.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
