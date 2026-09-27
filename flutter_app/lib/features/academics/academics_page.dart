import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../support/support_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../theme/app_shadows.dart';
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
        gradient: const [Color(0xFF8B5CF6), Color(0xFF6366F1)],
        icon: Icons.calendar_month_rounded,
        route: '/calendar',
      ),
      (
        title: 'Live Sessions',
        gradient: const [Color(0xFFFF5722), Color(0xFFFF7043)],
        icon: Icons.videocam_rounded,
        route: '/live',
      ),
      (
        title: 'Free Resources',
        gradient: const [Color(0xFF10B981), Color(0xFF059669)],
        icon: Icons.bookmark_rounded,
        route: '/free-resources',
      ),
      if (canAccessSupport(ref.watch(authStateProvider).valueOrNull?.role))
        (
          title: 'Support',
          gradient: const [Color(0xFF0EA5E9), Color(0xFF0284C7)],
          icon: Icons.headset_mic_rounded,
          route: '/support',
        ),
      (
        title: 'Downloads',
        gradient: const [Color(0xFF8B5CF6), Color(0xFF6366F1)],
        icon: Icons.download_done_rounded,
        route: '/downloads',
      ),
      (
        title: 'Announcements',
        gradient: const [Color(0xFF3B82F6), Color(0xFF2563EB)],
        icon: Icons.notifications_rounded,
        route: '/announcements',
      ),
    ];

    return Scaffold(
      backgroundColor: tokens.bg,
      body: SafeArea(
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1080),
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
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 110),
                children: [
              // ── Header ─────────────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Academics',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
                            color: tokens.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Everything for your learning journey',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w500,
                            color: tokens.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Divider(
                color: tokens.divider,
                thickness: 1.2,
                height: 1,
              ),
              const SizedBox(height: 20),

              // ── 2-Column Grid of Action Cards ──────────────────────
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: items.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: MediaQuery.sizeOf(context).width >= 900
                      ? 4
                      : (MediaQuery.sizeOf(context).width >= 600 ? 3 : 2),
                  crossAxisSpacing: 14,
                  mainAxisSpacing: 14,
                  childAspectRatio:
                      MediaQuery.sizeOf(context).width >= 600 ? 1.25 : 1.05,
                ),
                itemBuilder: (context, i) {
                  final item = items[i];
                  return BouncyPressable(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.push(item.route);
                    },
                    scaleDown: 0.95,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          vertical: 18, horizontal: 12),
                      decoration: BoxDecoration(
                        color: tokens.cardBg,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: tokens.border),
                        boxShadow: AppShadows.sm,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Squircle gradient icon - clean & modern without colored glow halo
                          Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              gradient: LinearGradient(
                                colors: item.gradient,
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Icon(
                              item.icon,
                              color: Colors.white,
                              size: 28,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            item.title,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: tokens.textPrimary,
                              letterSpacing: -0.1,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
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
