import 'dart:ui' as ui;
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/tour/tour_target_registry.dart';
import '../../theme/app_theme_tokens.dart';

/// Five equal tabs in one floating frosted-glass bar with a sliding selection capsule.
/// Home · Courses · Academics · Community · More.
/// Matches the Capacitor UI / mobile web design one-to-one with spring micro-interactions.
class MobileBottomNav extends StatelessWidget {
  const MobileBottomNav({super.key, required this.currentLocation});

  final String currentLocation;

  static const _left = <_TabSpec>[
    _TabSpec('Home', Symbols.home_rounded, Symbols.home_rounded, '/dashboard'),
    _TabSpec('Courses', Symbols.menu_book_rounded, Symbols.menu_book_rounded, '/courses'),
  ];
  static const _right = <_TabSpec>[
    _TabSpec('Community', Symbols.groups_rounded, Symbols.groups_rounded, '/community'),
    _TabSpec('More', Symbols.menu_rounded, Symbols.menu_rounded, '/more'),
  ];
  static const _center =
      _TabSpec('Academics', Symbols.school_rounded, Symbols.school_rounded, '/academics');

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

  static const _tabs = <_TabSpec>[..._left, _center, ..._right];

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = context.isDark;
    final isBlack = tokens.isBlack;
    final media = MediaQuery.of(context);
    // Increased-contrast setting -> near-solid surface, no blur.
    final solid = media.highContrast;
    final reduce = media.disableAnimations;

    final glass = isBlack
        ? Color(solid ? 0xFF000000 : 0xB8000000)
        : (isDark
            ? Color(solid ? 0xFF1C1C1E : 0xB81C1C1E)
            : Color(solid ? 0xFFFFFFFF : 0xCCFFFFFF));
    final edge = isBlack
        ? const Color(0x24FFFFFF)
        : (isDark ? const Color(0x1FFFFFFF) : const Color(0xE6FFFFFF));
    final shadow = Color(isDark || isBlack ? 0x66000000 : 0x240B1020);

    final bottomInset = media.viewPadding.bottom;
    final activeIndex = _tabs.indexWhere(_isActive);

    return Padding(
      padding: EdgeInsets.fromLTRB(14, 0, 14, 8 + bottomInset),
      child: SizedBox(
        height: 64,
        child: _GlassPiece(
          glass: glass,
          edge: edge,
          shadow: shadow,
          solid: solid,
          child: LayoutBuilder(builder: (context, c) {
            final w = c.maxWidth / _tabs.length;
            return Stack(
              children: [
                // One capsule that slides to the selected tab.
                AnimatedPositioned(
                  duration: reduce
                      ? Duration.zero
                      : const Duration(milliseconds: 320),
                  curve: const Cubic(0.23, 1, 0.32, 1),
                  left: (activeIndex < 0 ? 0 : activeIndex) * w + 5,
                  top: 6,
                  bottom: 6,
                  width: w - 10,
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 180),
                    opacity: activeIndex < 0 ? 0 : 1,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: tokens.primaryAccent
                            .withValues(alpha: isDark ? 0.20 : 0.12),
                        borderRadius: BorderRadius.circular(26),
                      ),
                    ),
                  ),
                ),
                Row(
                  children: [
                    for (final t in _tabs)
                      Expanded(
                        child: TourTarget(
                          id: _getTourId(t),
                          child: _NavItem(spec: t, active: _isActive(t)),
                        ),
                      ),
                  ],
                ),
              ],
            );
          }),
        ),
      ),
    );
  }
}

/// One floating frosted-glass piece of the nav (shadow outside, blur inside).
class _GlassPiece extends StatelessWidget {
  const _GlassPiece({
    required this.glass,
    required this.edge,
    required this.shadow,
    required this.solid,
    required this.child,
  });

  final Color glass;
  final Color edge;
  final Color shadow;
  final bool solid;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(32);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          BoxShadow(color: shadow, offset: const Offset(0, 10), blurRadius: 30),
          const BoxShadow(
            color: Color(0x0F0B1020),
            offset: Offset(0, 2),
            blurRadius: 6,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: solid
              ? ui.ImageFilter.blur(sigmaX: 0, sigmaY: 0)
              : ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: glass,
              borderRadius: radius,
              border: Border.all(color: edge, width: 1),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Apple-style press: reacts the instant a finger touches down (no waiting for
/// release), scales with a critically-damped curve (no bounce), and lets go
/// smoothly. Bounce is reserved for momentum gestures, not taps.
class _PressScale extends StatefulWidget {
  const _PressScale({
    required this.onTap,
    required this.pressedScale,
    required this.builder,
  });

  final VoidCallback onTap;
  final double pressedScale;
  final Widget Function(BuildContext context, bool pressed) builder;

  @override
  State<_PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<_PressScale> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: (_down && !reduceMotion) ? widget.pressedScale : 1.0,
        // quick in, slightly slower out; easeOutCubic = no overshoot
        duration: Duration(milliseconds: _down ? 100 : 200),
        curve: const Cubic(0.23, 1, 0.32, 1),
        child: widget.builder(context, _down),
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
    // Slightly stronger than textMuted so labels stay legible on glass.
    final inactive =
        Color.lerp(tokens.textMuted, tokens.textSecondary, 0.45)!;
    final color = active
        ? (tokens.isBlack ? Colors.white : tokens.primaryAccent)
        : inactive;

    return _PressScale(
      pressedScale: 0.92,
      onTap: () {
        HapticFeedback.selectionClick();
        context.go(spec.path);
      },
      builder: (context, pressed) {
        return SizedBox(
          height: double.infinity,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                active ? spec.activeIcon : spec.icon,
                // Material Symbols: filled when active, outline otherwise
                fill: active ? 1 : 0,
                weight: active ? 600 : 500,
                size: 25,
                color: color,
              ),
              const SizedBox(height: 3),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                style: DefaultTextStyle.of(context).style.copyWith(
                      fontSize: 10.5,
                      letterSpacing: 0.1,
                      color: color,
                      fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                      decoration: TextDecoration.none,
                    ),
                child: Text(spec.label, maxLines: 1, softWrap: false),
              ),
            ],
          ),
        );
      },
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
