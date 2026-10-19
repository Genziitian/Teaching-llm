import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/models/course.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/app_refresh.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../shared/widgets/apple_pressable.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../shared/widgets/shimmer_loading.dart';
import '../../shared/widgets/sub_page_header.dart';

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
/// page heading + filter button, search field,
/// All-courses section with structured colour-banded cards.
class CoursesPage extends ConsumerWidget {
  const CoursesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(coursesProvider);
    final count = async.value?.length ?? 0;

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
                  color: const Color(0xFF5856D6).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$count Enrolled',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF5856D6),
                  ),
                ),
              ),
            ),
            Expanded(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1080),
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

                        final remainingCourses = List<Course>.from(courses);

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

                        final isTablet = MediaQuery.sizeOf(context).width >= 720;

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: 14),
                            if (isTablet)
                              LayoutBuilder(
                                builder: (context, constraints) {
                                  final cardWidth = (constraints.maxWidth - 16) / 2;
                                  return Wrap(
                                    spacing: 16,
                                    runSpacing: 16,
                                    children: [
                                      for (final c in remainingCourses)
                                        SizedBox(
                                          width: cardWidth,
                                          child: _CourseCard(course: c),
                                        ),
                                    ],
                                  );
                                },
                              )
                            else
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
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          Icon(Symbols.search_rounded, size: 20, weight: 500, color: tokens.textMuted),
          const SizedBox(width: 8),
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
                  fontSize: 16,
                ),
              ),
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 16,
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

    return ApplePressable(
      onTap: isExpired
          ? null
          : () {
              HapticFeedback.lightImpact();
              context.push('/courses/${course.id}');
            },
      pressedScale: 0.98,
      child: Container(
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(24),
          border: isPinned
              ? Border.all(
                  color: tokens.primaryAccent.withValues(alpha: 0.5),
                  width: 1.5)
              : null,
          boxShadow: AppShadows.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Coloured header band
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(22)),
              child: Container(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
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
                                borderRadius: BorderRadius.circular(20),
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
                            if (isPinned) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0x40FFFFFF),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Symbols.push_pin_rounded,
                                        fill: 1, size: 12, color: Colors.white),
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
                                  borderRadius: BorderRadius.circular(20),
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
                        const SizedBox(height: 22),
                        Text(
                          course.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.4,
                          ),
                        ),
                        if (course.description != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            course.description!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xE6FFFFFF),
                              fontSize: 12.5,
                            ),
                          ),
                        ],
                      ],
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
                      if (!isExpired &&
                          course.accessDays != null &&
                          course.accessDays! <= 7)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0x1FFF9500),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: const Color(0x40FF9500)),
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
                      borderRadius: BorderRadius.circular(14),
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
                          width: 0.5,
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
                          width: 0.5,
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
                          height: 46,
                          decoration: BoxDecoration(
                            color: isExpired
                                ? tokens.surfaceSecondary
                                : accent,
                            borderRadius: BorderRadius.circular(23),
                          ),
                          alignment: Alignment.center,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                isExpired ? 'Expired' : 'Continue',
                                style: TextStyle(
                                  color: isExpired
                                      ? tokens.textSecondary
                                      : Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Icon(
                                isExpired
                                    ? Symbols.lock_rounded
                                    : Symbols.arrow_forward_rounded,
                                weight: 700,
                                color: isExpired
                                    ? tokens.textSecondary
                                    : Colors.white,
                                size: 16,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ApplePressable(
                        pressedScale: 0.9,
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
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: isPinned
                                ? tokens.primaryAccent.withValues(alpha: 0.16)
                                : tokens.surfaceSecondary,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Symbols.push_pin_rounded,
                            fill: isPinned ? 1 : 0,
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
          Icon(Symbols.menu_book_rounded, color: tokens.textMuted, size: 40),
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
          Icon(Symbols.cloud_off_rounded, color: tokens.textMuted, size: 40),
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
