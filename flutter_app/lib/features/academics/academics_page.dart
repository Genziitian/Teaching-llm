import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../support/support_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_theme_tokens.dart';
import '../courses/courses_page.dart';
import '../live/live_sessions_page.dart';
import 'calendar_page.dart';
import 'free_resources_page.dart';

class AcademicsPage extends ConsumerWidget {
  const AcademicsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;

    final items = [
      (
        title: 'Calendar',
        gradient: const [Color(0xFF5AC8FA), Color(0xFF0A84FF)],
        icon: Symbols.calendar_month_rounded,
        route: '/calendar',
      ),
      (
        title: 'Live Sessions',
        gradient: const [Color(0xFFFF9F0A), Color(0xFFFF3B30)],
        icon: Symbols.videocam_rounded,
        route: '/live',
      ),
      (
        title: 'Free Resources',
        gradient: const [Color(0xFF34C759), Color(0xFF30B350)],
        icon: Symbols.bookmark_rounded,
        route: '/free-resources',
      ),
      (
        title: 'Store',
        gradient: const [Color(0xFFFF6482), Color(0xFFFF2D55)],
        icon: Symbols.storefront_rounded,
        route: '/store',
      ),
      if (canAccessSupport(ref.watch(authStateProvider).value?.role))
        (
          title: 'Support',
          gradient: const [Color(0xFF5AC8FA), Color(0xFF32ADE6)],
          icon: Symbols.headset_mic_rounded,
          route: '/support',
        ),
      (
        title: 'Downloads',
        gradient: const [Color(0xFFBF5AF2), Color(0xFFAF52DE)],
        icon: Symbols.download_done_rounded,
        route: '/downloads',
      ),
      (
        title: 'Announcements',
        gradient: const [Color(0xFF0A84FF), Color(0xFF007AFF)],
        icon: Symbols.notifications_rounded,
        route: '/announcements',
      ),
    ];

    void open(String route) {
      HapticFeedback.lightImpact();
      context.push(route);
    }

    final heroes = items.take(2).toList();
    final rest = items.skip(2).toList();

    return Scaffold(
      backgroundColor: tokens.bg,
      body: SafeArea(
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: AppRefresh(
              onRefresh: () async {
                final now = DateTime.now();
                ref.invalidate(
                    calendarEventsProvider((year: now.year, month: now.month)));
                ref.invalidate(liveSessionsProvider);
                ref.invalidate(freeCoursesProvider);
                ref.invalidate(freeMaterialsProvider);
                ref.invalidate(purchasedMaterialsProvider);
                ref.invalidate(coursesProvider);
              },
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
                          'Academics',
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
                          'Everything for your learning journey',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: tokens.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── Hero cards ──
                  Row(
                    children: [
                      for (var i = 0; i < heroes.length; i++) ...[
                        if (i > 0) const SizedBox(width: 12),
                        Expanded(
                          child: _HeroCard(
                            title: heroes[i].title,
                            icon: heroes[i].icon,
                            gradient: heroes[i].gradient,
                            onTap: () => open(heroes[i].route),
                          ),
                        ),
                      ],
                    ],
                  ),

                  const SizedBox(height: 20),

                  // ── Grouped list ──
                  Container(
                    decoration: BoxDecoration(
                      color: tokens.cardBg,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        for (var i = 0; i < rest.length; i++)
                          _ListRow(
                            title: rest[i].title,
                            icon: rest[i].icon,
                            color: rest[i].gradient.last,
                            isLast: i == rest.length - 1,
                            onTap: () => open(rest[i].route),
                          ),
                      ],
                    ),
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

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.title,
    required this.icon,
    required this.gradient,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final List<Color> gradient;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ApplePressable(
      onTap: onTap,
      child: Container(
        height: 176,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradient,
          ),
          boxShadow: [
            BoxShadow(
              color: gradient.last.withValues(alpha: 0.30),
              blurRadius: 22,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Oversized watermark glyph
            Positioned(
              right: -18,
              bottom: -22,
              child: Icon(
                icon,
                size: 124,
                fill: 1,
                color: Colors.white.withValues(alpha: 0.18),
              ),
            ),
            // Specular highlight
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.center,
                    colors: [
                      Colors.white.withValues(alpha: 0.16),
                      Colors.white.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.22),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(icon,
                        color: Colors.white, size: 26, fill: 1, weight: 500),
                  ),
                  const Spacer(),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            letterSpacing: -0.4,
                          ),
                        ),
                      ),
                      Icon(
                        Symbols.arrow_forward_ios_rounded,
                        size: 14,
                        weight: 700,
                        color: Colors.white.withValues(alpha: 0.85),
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

class _ListRow extends StatefulWidget {
  const _ListRow({
    required this.title,
    required this.icon,
    required this.color,
    required this.isLast,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final Color color;
  final bool isLast;
  final VoidCallback onTap;

  @override
  State<_ListRow> createState() => _ListRowState();
}

class _ListRowState extends State<_ListRow> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: Duration(milliseconds: _down ? 60 : 180),
        curve: kEaseOutStrong,
        color: _down ? tokens.surfaceSecondary : Colors.transparent,
        padding: const EdgeInsets.only(left: 16),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: widget.color,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(widget.icon,
                  color: Colors.white, size: 21, fill: 1, weight: 500),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Container(
                height: 60,
                padding: const EdgeInsets.only(right: 16),
                decoration: BoxDecoration(
                  border: widget.isLast
                      ? null
                      : Border(
                          bottom: BorderSide(color: tokens.border, width: 0.5),
                        ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        widget.title,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w500,
                          letterSpacing: -0.3,
                          color: tokens.textPrimary,
                        ),
                      ),
                    ),
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
