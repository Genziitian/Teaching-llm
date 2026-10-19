import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/tour/tour_target_registry.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme_tokens.dart';
import 'bouncy_pressable.dart';

/// Five-tab bottom nav with an elevated center button and frosted glass backdrop.
/// Home · Courses · Academics(FAB) · Support · More.
/// Matches the Capacitor UI / mobile web design one-to-one with spring micro-interactions.
class MobileBottomNav extends StatelessWidget {
  const MobileBottomNav({super.key, required this.currentLocation});

  final String currentLocation;

  static const _left = <_TabSpec>[
    _TabSpec('Home', Icons.home_outlined, Icons.home, '/dashboard'),
    _TabSpec('Courses', Icons.menu_book_outlined, Icons.menu_book, '/courses'),
  ];
  static const _right = <_TabSpec>[
    _TabSpec('Community', Icons.groups_outlined, Icons.groups_rounded, '/community'),
    _TabSpec('More', Icons.menu_outlined, Icons.menu, '/more'),
  ];
  static const _center =
      _TabSpec('Academics', Icons.school_outlined, Icons.school, '/academics');

  bool _isActive(_TabSpec t) {
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

  String _getTourId(_TabSpec spec) {
    if (spec.path == '/courses') return 'nav_courses';
    if (spec.path == '/community') return 'nav_community';
    if (spec.path == '/more') return 'nav_more';
    if (spec.path == '/academics') return 'nav_academics';
    return 'nav_home';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = context.isDark;
    final isBlack = tokens.isBlack;
    final media = MediaQuery.of(context);
    // Increased-contrast setting -> near-solid surface, no blur (Apple: prefers-contrast).
    final solid = media.highContrast;

    // Translucent "glass" material: light surface tinted by what scrolls beneath it.
    final glass = isBlack
        ? Color(solid ? 0xFF000000 : 0xB8000000)
        : (isDark
            ? Color(solid ? 0xFF101426 : 0xB8101426)
            : Color(solid ? 0xFFFFFFFF : 0xB8FFFFFF));
    // Bright hairline = light catching the edge of the material.
    final edge = isBlack
        ? const Color(0x24FFFFFF)
        : (isDark ? const Color(0x1FFFFFFF) : const Color(0xCCFFFFFF));

    final academicsActive = _isActive(_center);
    final bottomInset = media.viewPadding.bottom;

    const pillHeight = 64.0;
    const fabLift = 20.0; // how far the center button rises above the pill

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 10 + bottomInset),
      child: SizedBox(
        height: pillHeight + fabLift,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.bottomCenter,
          children: [
            // Floating glass pill (shadow outside the clip, blur inside).
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: pillHeight,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [
                    BoxShadow(
                      color: Color(isDark || isBlack ? 0x66000000 : 0x240B1020),
                      offset: const Offset(0, 10),
                      blurRadius: 30,
                    ),
                    const BoxShadow(
                      color: Color(0x0F0B1020),
                      offset: Offset(0, 2),
                      blurRadius: 6,
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(32),
                  child: BackdropFilter(
                    filter: solid
                        ? ui.ImageFilter.blur(sigmaX: 0, sigmaY: 0)
                        : ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: glass,
                        borderRadius: BorderRadius.circular(32),
                        border: Border.all(color: edge, width: 1),
                      ),
                      child: Row(
                        children: [
                          // Left group: two buttons
                          Expanded(
                            child: Row(
                              children: [
                                for (final t in _left)
                                  Expanded(
                                    child: TourTarget(
                                      id: _getTourId(t),
                                      child: _NavItem(
                                        spec: t,
                                        active: _isActive(t),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          // Middle slot reserved for the raised center button
                          const SizedBox(width: 78),
                          // Right group: two buttons
                          Expanded(
                            child: Row(
                              children: [
                                for (final t in _right)
                                  Expanded(
                                    child: TourTarget(
                                      id: _getTourId(t),
                                      child: _NavItem(
                                        spec: t,
                                        active: _isActive(t),
                                      ),
                                    ),
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
            ),

            // Raised Academics button, centered on the pill
            Positioned(
              top: 0,
              child: TourTarget(
                id: 'nav_academics',
                child: _CenterFab(
                  active: academicsActive,
                  isDark: isDark,
                  isBlack: isBlack,
                  ringColor: isBlack
                      ? const Color(0xFF000000)
                      : (isDark ? const Color(0xFF101426) : Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.spec, required this.active});
  final _TabSpec spec;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final color = active ? tokens.primaryAccent : tokens.textMuted;

    return BouncyPressable(
      onTap: () {
        HapticFeedback.selectionClick();
        context.go(spec.path);
      },
      scaleDown: 0.90,
      duration: const Duration(milliseconds: 90),
      reverseDuration: const Duration(milliseconds: 160),
      child: SizedBox(
        height: double.infinity,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: active
                    ? tokens.primaryAccent.withValues(alpha: 0.14)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
              ),
              child: AnimatedScale(
                scale: active ? 1.08 : 1.0,
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                child: Icon(
                  active ? spec.activeIcon : spec.icon,
                  size: 22,
                  color: color,
                ),
              ),
            ),
            const SizedBox(height: 2),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              style: TextStyle(
                fontSize: 10.5,
                letterSpacing: 0.1, // small text: slightly positive tracking
                color: color,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                fontFamily: 'Manrope',
              ),
              child: Text(spec.label),
            ),
          ],
        ),
      ),
    );
  }
}

class _CenterFab extends StatelessWidget {
  const _CenterFab({
    required this.active,
    required this.isDark,
    required this.ringColor,
    this.isBlack = false,
  });
  final bool active;
  final bool isDark;
  final bool isBlack;
  final Color ringColor;

  @override
  Widget build(BuildContext context) {
    final gradient = isBlack
        ? (active
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFFFFFFF), Color(0xFFD4D4D8)],
              )
            : const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF27272A), Color(0xFF18181B)],
              ))
        : (active
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF8B5CF6), Color(0xFF4F46E5)],
              )
            : const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF7C3AED), Color(0xFF6366F1)],
              ));

    final borderColor = ringColor;
    final iconColor = isBlack
        ? (active ? Colors.black : Colors.white)
        : Colors.white;

    final tokens = context.tokens;

    return BouncyPressable(
      onTap: () {
        HapticFeedback.selectionClick();
        context.go('/academics');
      },
      scaleDown: 0.92,
      duration: const Duration(milliseconds: 90),
      reverseDuration: const Duration(milliseconds: 180),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedScale(
            scale: active ? 1.06 : 1.0,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutCubic,
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: gradient,
                border: Border.all(color: borderColor, width: 4),
                boxShadow: [
                  BoxShadow(
                    color: isBlack
                        ? const Color(0x33000000)
                        : const Color(0x596366F1), // soft brand glow
                    offset: const Offset(0, 6),
                    blurRadius: 16,
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: Icon(
                Icons.school_outlined,
                color: iconColor,
                size: 26,
              ),
            ),
          ),
          const SizedBox(height: 2),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            style: TextStyle(
              fontSize: 10.5,
              color: active
                  ? (isBlack ? tokens.primaryAccent : AppColors.brand)
                  : tokens.textMuted,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              fontFamily: 'Manrope',
            ),
            child: const Text('Academics'),
          ),
        ],
      ),
    );
  }
}

class _TabSpec {
  const _TabSpec(this.label, this.icon, this.activeIcon, this.path);
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final String path;
}
