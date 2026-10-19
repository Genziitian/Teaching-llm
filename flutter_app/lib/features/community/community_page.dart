import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/course.dart';
import '../../features/courses/courses_page.dart' show coursesProvider;
import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/app_refresh.dart';

/// Community: General Discussion hero + the user's course communities.
class CommunityPage extends ConsumerWidget {
  const CommunityPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(coursesProvider);
    final tokens = context.tokens;

    return Scaffold(
      backgroundColor: tokens.bg,
      body: SafeArea(
        bottom: false,
        child: AppRefresh(
          onRefresh: () async => ref.invalidate(coursesProvider),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 120),
            children: [
              // ── Header ──
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Community',
                      style: TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                        color: tokens.textPrimary,
                        letterSpacing: -0.8,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Connect with your coursemates',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),

              // ── General Discussion hero ──
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  color: tokens.cardBg,
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: tokens.textMuted.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          alignment: Alignment.center,
                          child: Icon(Symbols.chat_bubble_rounded,
                              color: tokens.textSecondary, size: 24, fill: 1),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'General Discussion',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: tokens.textPrimary,
                            letterSpacing: -0.6,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Public posts and questions from everyone.',
                          style: TextStyle(
                            fontSize: 14.5,
                            height: 1.35,
                            color: tokens.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: ApplePressable(
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  context.push(
                                      '/community/general-discussion?action=create');
                                },
                                child: Container(
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: tokens.primaryAccent,
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  alignment: Alignment.center,
                                  child: const Text(
                                    'Create Post',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: -0.2,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: ApplePressable(
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  context.push('/community/general-discussion');
                                },
                                child: Container(
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: tokens.textMuted.withValues(alpha: 0.14),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    'All Posts',
                                    style: TextStyle(
                                      color: tokens.textPrimary,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: -0.2,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // ── MY COURSES header ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'MY COURSES',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.4,
                        color: tokens.textSecondary,
                      ),
                    ),
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => context.go('/courses'),
                      child: Row(
                        children: [
                          Text(
                            'View All',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              color: tokens.primaryAccent,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            Symbols.arrow_forward_ios_rounded,
                            size: 12,
                            weight: 700,
                            color: tokens.primaryAccent,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // ── Course communities ──
              coursesAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 20),
                  child: Text('Could not load course communities: $e',
                      style: TextStyle(
                          color: tokens.textSecondary, fontSize: 14)),
                ),
                data: (courses) {
                  if (courses.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: tokens.cardBg,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        'No courses enrolled yet. Visit the Store to join courses and unlock their community hubs.',
                        style: TextStyle(
                            fontSize: 14,
                            height: 1.4,
                            color: tokens.textSecondary),
                      ),
                    );
                  }

                  return Container(
                    decoration: BoxDecoration(
                      color: tokens.cardBg,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (var i = 0; i < courses.length; i++)
                          _CourseCommunityTile(
                            course: courses[i],
                            isLast: i == courses.length - 1,
                          ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CourseCommunityTile extends StatefulWidget {
  const _CourseCommunityTile({required this.course, required this.isLast});

  final Course course;
  final bool isLast;

  @override
  State<_CourseCommunityTile> createState() => _CourseCommunityTileState();
}

class _CourseCommunityTileState extends State<_CourseCommunityTile> {
  bool _down = false;

  ({IconData icon, List<Color> colors}) _look(Course c, bool isGift) =>
      communityCourseLook(c.name, c.subject, isGift);

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final course = widget.course;
    final isGift = course.name.toLowerCase().contains('qualifier') ||
        course.name.toLowerCase().contains('oneshot') ||
        course.name.toLowerCase().contains('attempt');

    final subLabel = (course.subject ??
            (course.name.toLowerCase().contains('quiz') ? 'Quiz' : 'Qualifier'))
        .trim();

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/community/${course.id}');
      },
      child: AnimatedContainer(
        duration: Duration(milliseconds: _down ? 60 : 180),
        curve: kEaseOutStrong,
        color: _down ? tokens.surfaceSecondary : Colors.transparent,
        padding: const EdgeInsets.only(left: 16),
        child: Row(
          children: [
            Builder(builder: (context) {
              final look = _look(course, isGift);
              return Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: look.colors,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: look.colors.last.withValues(alpha: 0.28),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(
                  look.icon,
                  color: Colors.white,
                  size: 24,
                  fill: 1,
                  weight: 500,
                ),
              );
            }),
            const SizedBox(width: 14),
            Expanded(
              child: Container(
                padding: const EdgeInsets.fromLTRB(0, 14, 16, 14),
                decoration: BoxDecoration(
                  border: widget.isLast
                      ? null
                      : Border(
                          bottom: BorderSide(color: tokens.border, width: 0.5)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            course.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w600,
                              color: tokens.textPrimary,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            subLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14,
                              color: tokens.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      Symbols.arrow_forward_ios_rounded,
                      size: 14,
                      weight: 700,
                      color: tokens.textMuted,
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

/// Colourful, topic-aware icon for each course. Shared with the chat header
/// so a course looks the same in the list and in its conversation.
({IconData icon, List<Color> colors}) communityCourseLook(
  String name, String? subject, bool isGift) {
  ({IconData icon, List<Color> colors}) pick(String t) {
    if (t.contains('youtube') || t.contains('video') || t.contains('series')) {
      return (
        icon: Symbols.smart_display_rounded,
        colors: const [Color(0xFFFF6482), Color(0xFFFF3B30)]
      );
    }
    if (t.contains('python') ||
        t.contains('code') ||
        t.contains('program') ||
        t.contains('java')) {
      return (
        icon: Symbols.code_rounded,
        colors: const [Color(0xFF5BD778), Color(0xFF30B350)]
      );
    }
    if (t.contains('math')) {
      return (
        icon: Symbols.calculate_rounded,
        colors: const [Color(0xFFFFB340), Color(0xFFFF7A00)]
      );
    }
    if (t.contains('stat') || t.contains('data')) {
      return (
        icon: Symbols.bar_chart_rounded,
        colors: const [Color(0xFFD27CF5), Color(0xFFAF52DE)]
      );
    }
    if (t.contains('demo') || t.contains('general')) {
      return (
        icon: Symbols.school_rounded,
        colors: const [Color(0xFF5AC8FA), Color(0xFF007AFF)]
      );
    }
    return (
      icon: Symbols.menu_book_rounded,
      colors: const [Color(0xFF7D7AFF), Color(0xFF5856D6)]
    );
  }

  if (isGift) {
    return (
      icon: Symbols.card_giftcard_rounded,
      colors: const [Color(0xFFFF6482), Color(0xFFFF2D55)]
    );
  }
  final byName = pick(name.toLowerCase());
  if (byName.icon != Symbols.menu_book_rounded) return byName;
  return pick((subject ?? '').toLowerCase());
}

