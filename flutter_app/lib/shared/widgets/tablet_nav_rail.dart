import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/tour/tour_target_registry.dart';
import '../../theme/app_theme_tokens.dart';
import '../../theme/theme_mode_provider.dart';
import 'bouncy_pressable.dart';

/// Navigation item specification for the tablet rail.
class _RailItemSpec {
  const _RailItemSpec(
    this.label,
    this.icon,
    this.activeIcon,
    this.path,
    this.tourId,
  );

  final String label;
  final IconData icon;
  final IconData activeIcon;
  final String path;
  final String tourId;
}

/// Premium side navigation rail for tablet and wide-screen experiences.
/// Mirrors the sidebar navigation in the Capacitor/web app, providing ergonomic
/// access on large displays without stretching bottom bars awkwardly.
class TabletNavRail extends ConsumerWidget {
  const TabletNavRail({super.key, required this.currentLocation});

  final String currentLocation;

  static const _items = <_RailItemSpec>[
    _RailItemSpec(
      'Home',
      Icons.home_outlined,
      Icons.home_rounded,
      '/dashboard',
      'nav_home',
    ),
    _RailItemSpec(
      'Courses',
      Icons.menu_book_outlined,
      Icons.menu_book_rounded,
      '/courses',
      'nav_courses',
    ),
    _RailItemSpec(
      'Academics',
      Icons.school_outlined,
      Icons.school_rounded,
      '/academics',
      'nav_academics',
    ),
    _RailItemSpec(
      'Community',
      Icons.groups_outlined,
      Icons.groups_rounded,
      '/community',
      'nav_community',
    ),
    _RailItemSpec(
      'More',
      Icons.menu_outlined,
      Icons.menu_rounded,
      '/more',
      'nav_more',
    ),
  ];

  bool _isActive(_RailItemSpec t) {
    if (t.path == '/dashboard') return currentLocation == '/dashboard';
    if (t.path == '/academics') {
      return currentLocation.startsWith('/academics') ||
          currentLocation.startsWith('/calendar') ||
          currentLocation.startsWith('/free-resources') ||
          currentLocation.startsWith('/announcements') ||
          currentLocation.startsWith('/feedback') ||
          currentLocation.startsWith('/live');
    }
    if (t.path == '/community') {
      return currentLocation.startsWith('/community');
    }
    if (t.path == '/more') {
      return currentLocation.startsWith('/more') ||
          currentLocation.startsWith('/profile') ||
          currentLocation.startsWith('/transactions') ||
          currentLocation.startsWith('/settings');
    }
    if (t.path == '/support') {
      return currentLocation.startsWith('/support') ||
          currentLocation.startsWith('/faq');
    }
    return currentLocation.startsWith(t.path);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final isDark = context.isDark;
    final isBlack = tokens.isBlack;

    final railBg = isBlack
        ? const Color(0xF2000000)
        : (isDark ? const Color(0xF2101426) : const Color(0xF2FFFFFF));
    final borderColor = tokens.border;

    return Container(
      width: 84,
      decoration: BoxDecoration(
        color: railBg,
        border: Border(right: BorderSide(color: borderColor, width: 1)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            offset: Offset(4, 0),
            blurRadius: 16,
          ),
        ],
      ),
      child: SafeArea(
        right: false,
        child: Column(
          children: [
            const SizedBox(height: 16),

            // App Brand Logo / Icon at top of tablet rail
            BouncyPressable(
              onTap: () => context.go('/dashboard'),
              scaleDown: 0.92,
              child: Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: tokens.cardBg,
                  border: Border.all(color: borderColor.withOpacity(0.6)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x08000000),
                      offset: Offset(0, 2),
                      blurRadius: 8,
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(6),
                child: Image.asset(
                  'assets/mobile-login-logo.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),

            const SizedBox(height: 24),
            const Divider(height: 1, indent: 14, endIndent: 14),
            const SizedBox(height: 16),

            // Navigation Items
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  children: [
                    for (final item in _items) ...[
                      TourTarget(
                        id: item.tourId,
                        child: _RailItem(
                          spec: item,
                          active: _isActive(item),
                          isAcademics: item.path == '/academics',
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                  ],
                ),
              ),
            ),

            // Bottom Actions: Quick Theme Toggle
            const Divider(height: 1, indent: 14, endIndent: 14),
            const SizedBox(height: 12),
            BouncyPressable(
              onTap: () {
                HapticFeedback.lightImpact();
                final currentMode = ref.read(themeModeProvider).valueOrNull ??
                    AppThemeMode.system;
                final AppThemeMode nextMode;
                if (currentMode == AppThemeMode.light) {
                  nextMode = AppThemeMode.dark;
                } else if (currentMode == AppThemeMode.dark) {
                  nextMode = AppThemeMode.black;
                } else if (currentMode == AppThemeMode.black) {
                  nextMode = AppThemeMode.light;
                } else {
                  nextMode = isDark ? AppThemeMode.light : AppThemeMode.dark;
                }
                ref.read(themeModeProvider.notifier).set(nextMode);
              },
              scaleDown: 0.90,
              child: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: tokens.cardBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: borderColor),
                ),
                child: Icon(
                  isBlack
                      ? Icons.contrast_rounded
                      : (isDark
                          ? Icons.wb_sunny_outlined
                          : Icons.nightlight_outlined),
                  size: 20,
                  color: isBlack
                      ? Colors.white
                      : (isDark
                          ? const Color(0xFFF59E0B)
                          : const Color(0xFF475569)),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _RailItem extends StatelessWidget {
  const _RailItem({
    required this.spec,
    required this.active,
    this.isAcademics = false,
  });

  final _RailItemSpec spec;
  final bool active;
  final bool isAcademics;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = context.isDark;
    final isBlack = tokens.isBlack;

    final primaryAccent = tokens.primaryAccent;
    final activeBg = isAcademics
        ? (isBlack
            ? const Color(0xFF27272A)
            : const Color(0xFF6366F1).withOpacity(0.18))
        : (isBlack
            ? const Color(0xFF1E1E24)
            : primaryAccent.withOpacity(0.12));

    final iconColor = active
        ? (isAcademics ? const Color(0xFF8B5CF6) : primaryAccent)
        : tokens.textMuted;

    return BouncyPressable(
      onTap: () {
        HapticFeedback.selectionClick();
        context.go(spec.path);
      },
      scaleDown: 0.92,
      duration: const Duration(milliseconds: 90),
      reverseDuration: const Duration(milliseconds: 160),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.fastOutSlowIn,
        width: 64,
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: active ? activeBg : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          border: active
              ? Border.all(
                  color: (isAcademics
                          ? const Color(0xFF8B5CF6)
                          : primaryAccent)
                      .withOpacity(0.3),
                  width: 1,
                )
              : Border.all(color: Colors.transparent),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedScale(
              scale: active ? 1.12 : 1.0,
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutBack,
              child: Icon(
                active ? spec.activeIcon : spec.icon,
                size: 24,
                color: iconColor,
              ),
            ),
            const SizedBox(height: 4),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              style: TextStyle(
                fontSize: 11,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active
                    ? (isAcademics
                        ? const Color(0xFF8B5CF6)
                        : (isDark ? Colors.white : tokens.textPrimary))
                    : tokens.textMuted,
                fontFamily: 'Manrope',
              ),
              child: Text(
                spec.label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
