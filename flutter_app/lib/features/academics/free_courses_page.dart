import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_loading_wrapper.dart';
import '../../shared/widgets/apple_alert.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/share_link_sheet.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../courses/course_detail_page.dart';
import '../courses/courses_page.dart';
import '../dashboard/dashboard_providers.dart';
import 'free_resources_page.dart';

class FreeCoursesPage extends ConsumerStatefulWidget {
  const FreeCoursesPage({super.key, this.highlightCourseId});

  /// Course shared via link; shown first on the list.
  final String? highlightCourseId;

  @override
  ConsumerState<FreeCoursesPage> createState() => _FreeCoursesPageState();
}

class _FreeCoursesPageState extends ConsumerState<FreeCoursesPage> {
  final _enrollingIds = <String>{};

  Future<void> _enroll(String courseId) async {
    if (_enrollingIds.contains(courseId)) return;
    setState(() => _enrollingIds.add(courseId));
    try {
      await ref.read(apiClientProvider).post<dynamic>(
        '/api/free-resources/enroll',
        body: {'courseId': courseId},
      );
      if (!mounted) return;
      ref.invalidate(freeCoursesProvider);
      ref.invalidate(coursesProvider);
      ref.invalidate(dashboardProvider);
      ref.invalidate(courseDetailProvider(courseId));
      ref.invalidate(courseTopicsProvider(courseId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Successfully enrolled in the free course.')),
      );
    } catch (error) {
      if (!mounted) return;
      final data = error is DioException ? error.response?.data : null;
      final message = data is Map && data['error'] is String
          ? data['error'] as String
          : 'Could not enroll. Please try again.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) setState(() => _enrollingIds.remove(courseId));
    }
  }

  Future<void> _unenroll(String courseId) async {
    if (_enrollingIds.contains(courseId)) return;
    final confirm = await showAppleAlert<bool>(
      context,
      title: 'Unenroll from this course?',
      message: 'You can enroll again anytime for free.',
      actions: const [
        AppleAlertAction(label: 'Cancel', value: false, isDefault: true),
        AppleAlertAction(label: 'Unenroll', value: true, isDestructive: true),
      ],
    );
    if (confirm != true || !mounted) return;
    setState(() => _enrollingIds.add(courseId));
    try {
      await ref.read(apiClientProvider).delete<dynamic>(
        '/api/free-resources/enroll?courseId=${Uri.encodeQueryComponent(courseId)}',
      );
      if (!mounted) return;
      ref.invalidate(freeCoursesProvider);
      ref.invalidate(coursesProvider);
      ref.invalidate(dashboardProvider);
      ref.invalidate(courseDetailProvider(courseId));
      ref.invalidate(courseTopicsProvider(courseId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You have been unenrolled.')),
      );
    } catch (error) {
      if (!mounted) return;
      final data = error is DioException ? error.response?.data : null;
      final message = data is Map && data['error'] is String
          ? data['error'] as String
          : 'Could not unenroll. Please try again.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) setState(() => _enrollingIds.remove(courseId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final coursesAsync = ref.watch(freeCoursesProvider);
    return AppPageScaffold(
      title: 'Free Courses',
      subtitle: 'Browse and enroll for free',
      body: AppRefresh(
        onRefresh: () async {
          ref.invalidate(freeCoursesProvider);
          try {
            await ref.read(freeCoursesProvider.future);
          } catch (_) {
            // The provider renders the error with a retry action below.
          }
        },
        child: coursesAsync.when(
          loading: () => _message(
            const AppLoadingWrapper(isLoading: true),
          ),
          error: (_, __) => _message(
            Column(
              children: [
                const Text('Could not load free courses.'),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => ref.invalidate(freeCoursesProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (rawCourses) {
            final highlight = widget.highlightCourseId;
            final courses = [...rawCourses];
            if (highlight != null) {
              final i = courses.indexWhere(
                  (c) => c is Map && c['id'] == highlight);
              if (i > 0) courses.insert(0, courses.removeAt(i));
            }
            return courses.isEmpty
              ? _message(const Text(
                  'No free courses available at the moment.',
                  textAlign: TextAlign.center,
                ))
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: courses.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    final course =
                        (courses[index] as Map).cast<String, dynamic>();
                    final id = course['id'] as String;
                    return _FreeCourseCard(
                      course: course,
                      enrolling: _enrollingIds.contains(id),
                      onEnroll: () => _enroll(id),
                      onUnenroll: () => _unenroll(id),
                      onShare: () => showShareLinkSheet(
                        context,
                        title: (course['name'] as String?) ?? 'Free course',
                        message:
                            'Check out this free course on GenZ IITIAN: ${(course['name'] as String?) ?? ''}',
                        link:
                            'https://class.genziitian.in/free-resources/courses?course=${Uri.encodeQueryComponent(id)}',
                      ),
                      onOpen: () => context.push(
                        '/courses/${Uri.encodeComponent(id)}',
                      ),
                    );
                  },
                );
          },
        ),
      ),
    );
  }

  Widget _message(Widget child) => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 60),
        children: [child],
      );
}

class _FreeCourseCard extends StatelessWidget {
  const _FreeCourseCard({
    required this.course,
    required this.enrolling,
    required this.onEnroll,
    required this.onUnenroll,
    required this.onShare,
    required this.onOpen,
  });

  final Map<String, dynamic> course;
  final bool enrolling;
  final VoidCallback onEnroll;
  final VoidCallback onUnenroll;
  final VoidCallback onShare;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final enrolled = course['isEnrolled'] == true;
    final subject = (course['subject'] as String?)?.trim() ?? '';
    final teacher = (course['teacherName'] as String?)?.trim() ?? '';
    final counts = course['_count'] as Map<String, dynamic>? ?? const {};

    Widget stat(IconData icon, String text) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 11),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 16, fill: 1, color: tokens.textSecondary),
                  const SizedBox(width: 5),
                  Text(
                    text,
                    maxLines: 1,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                      color: tokens.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );

    Widget vline() =>
        Container(width: 0.5, height: 18, color: tokens.border);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(26),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(15),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF7D7AFF), Color(0xFF5856D6)],
                  ),
                ),
                child: const Icon(Symbols.menu_book_rounded,
                    color: Colors.white, size: 28, fill: 1),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (course['name'] as String?) ?? 'Untitled course',
                      style: TextStyle(
                        fontSize: 19,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.4,
                        color: tokens.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: tokens.success.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(50),
                      ),
                      child: Text(
                        enrolled ? 'FREE · ENROLLED' : 'FREE',
                        style: TextStyle(
                          color: tokens.success,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              ApplePressable(
                onTap: onShare,
                pressedScale: 0.9,
                child: SizedBox(
                  width: 40,
                  height: 40,
                  child: Icon(Symbols.ios_share_rounded,
                      weight: 500, size: 22, color: tokens.primaryAccent),
                ),
              ),
            ],
          ),
          if (subject.isNotEmpty || teacher.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              [subject, teacher].where((value) => value.isNotEmpty).join(' · '),
              style: TextStyle(
                fontSize: 15,
                height: 1.4,
                color: tokens.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: 14),
          Container(
            decoration: BoxDecoration(
              color: tokens.surfaceSecondary,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                stat(Symbols.folder_rounded, '${counts['topics'] ?? 0} Topics'),
                vline(),
                stat(Symbols.play_circle_rounded,
                    '${counts['lectures'] ?? 0} Lectures'),
                vline(),
                stat(Symbols.description_rounded,
                    '${counts['materials'] ?? 0} Materials'),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              if (enrolled) ...[
                Expanded(
                  flex: 2,
                  child: TextButton(
                    onPressed: enrolling ? null : onUnenroll,
                    style: TextButton.styleFrom(
                      foregroundColor: tokens.danger,
                      backgroundColor: tokens.danger.withValues(alpha: 0.12),
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                      textStyle: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w600),
                    ),
                    child: const Text('Unenroll'),
                  ),
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                flex: 3,
                child: FilledButton(
                  onPressed: enrolling ? null : (enrolled ? onOpen : onEnroll),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    textStyle: const TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w600),
                  ),
                  child: Text(enrolling
                      ? (enrolled ? 'Please wait...' : 'Enrolling...')
                      : enrolled
                          ? 'Open Course'
                          : 'Enroll for Free'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
