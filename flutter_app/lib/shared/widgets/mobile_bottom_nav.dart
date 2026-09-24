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
    final navBg = isBlack
        ? const Color(0xF2000000)
        : (isDark
            ? const Color(0xF2101426)
            : const Color(0xF2FFFFFF));
    final borderColor = tokens.border;

    final academicsActive = _isActive(_center);

    return SizedBox(
      height: 88, // bar + elevated FAB height
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: [
          // Circular Arc Backdrop Cutout behind the Center FAB (matches Capacitor UI CSS)
          Positioned(
            bottom: 54,
            child: Container(
              width: 76,
              height: 38,
              decoration: BoxDecoration(
                color: navBg,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(38)),
                border: Border(
                  top: BorderSide(color: borderColor, width: 1),
                  left: BorderSide(color: borderColor, width: 0.5),
                  right: BorderSide(color: borderColor, width: 0.5),
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x08000000),
                    offset: Offset(0, -6),
                    blurRadius: 10,
                  ),
                ],
              ),
            ),
          ),

          // Frosted Glass Navigation Bar
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: ClipRect(
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                child: Container(
                  decoration: BoxDecoration(
                    color: navBg,
                    border: Border(top: BorderSide(color: borderColor, width: 1)),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x140B1020),
                        offset: Offset(0, -8),
                        blurRadius: 24,
                      ),
                    ],
                  ),
                  child: SafeArea(
                    top: false,
                    child: SizedBox(
                      height: 62,
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
                          // Spacer for center FAB
                          const Expanded(child: SizedBox()),
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
                  ),
                ),
              ),
            ),
          ),

          // Elevated Academics Center Button with Spring Scale & Gradient Glow
          Positioned(
            bottom: 18,
            child: TourTarget(
              id: 'nav_academics',
              child: _CenterFab(
                active: academicsActive,
                isDark: isDark,
                isBlack: isBlack,
              ),
            ),
          ),
        ],
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
            AnimatedScale(
              scale: active ? 1.12 : 1.0,
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutBack,
              child: Icon(
                active ? spec.activeIcon : spec.icon,
                size: 22,
                color: color,
              ),
            ),
            const SizedBox(height: 3),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              style: TextStyle(
                fontSize: 10.5,
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
    this.isBlack = false,
  });
  final bool active;
  final bool isDark;
  final bool isBlack;

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

    final borderColor = isBlack
        ? const Color(0xFF000000)
        : (isDark ? const Color(0xFF101426) : Colors.white);
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
            curve: Curves.easeOutBack,
            child: Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: gradient,
                border: Border.all(color: borderColor, width: 4),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x1F000000),
                    offset: Offset(0, 4),
                    blurRadius: 10,
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
