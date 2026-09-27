import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../core/tour/app_tour_overlay.dart';
import '../../theme/app_colors.dart';
import 'mobile_bottom_nav.dart';

import 'tablet_nav_rail.dart';

/// Wraps every shell route so the navigation is always visible on tabbed pages.
/// - On wide screens (>= 768dp, tablets in landscape or desktop): Displays an adaptive
///   Side Navigation Rail on the left (matching the Capacitor/web sidebar experience).
/// - On phones and compact screens (< 768dp): Displays the auto-hiding frosted glass
///   bottom navigation bar.
class AppScaffold extends StatefulWidget {
  const AppScaffold({
    super.key,
    required this.child,
    required this.currentLocation,
  });

  final Widget child;
  final String currentLocation;

  @override
  State<AppScaffold> createState() => _AppScaffoldState();
}

class _AppScaffoldState extends State<AppScaffold> {
  bool _navVisible = true;

  @override
  void didUpdateWidget(covariant AppScaffold oldWidget) {
    super.didUpdateWidget(oldWidget);
    // When changing tabs, always restore the navigation bar
    if (oldWidget.currentLocation != widget.currentLocation) {
      if (!_navVisible) {
        setState(() => _navVisible = true);
      }
    }
  }

  bool _onScrollNotification(ScrollNotification notification) {
    if (notification.metrics.axis != Axis.vertical) return false;

    // If at the very top or bouncing at top, always keep navigation visible
    if (notification.metrics.pixels <= 0) {
      if (!_navVisible) {
        setState(() => _navVisible = true);
      }
      return false;
    }

    if (notification is UserScrollNotification) {
      if (notification.direction == ScrollDirection.reverse) {
        // Scrolling DOWN -> hide nav
        if (_navVisible && notification.metrics.pixels > 15) {
          setState(() => _navVisible = false);
        }
      } else if (notification.direction == ScrollDirection.forward) {
        // Scrolling UP (even slightly) -> show nav immediately
        if (!_navVisible) {
          setState(() => _navVisible = true);
        }
      }
    } else if (notification is ScrollUpdateNotification) {
      final delta = notification.scrollDelta ?? 0;
      if (delta > 8 && _navVisible && notification.metrics.pixels > 30) {
        // Distinct downward drag
        setState(() => _navVisible = false);
      } else if (delta < -4 && !_navVisible) {
        // Immediate upward drag
        setState(() => _navVisible = true);
      }
    }

    return false;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg =
        isDark ? Theme.of(context).scaffoldBackgroundColor : AppColors.bg;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final isTabletRail = screenWidth >= 768;

    return AppTourOverlayWrapper(
      child: Material(
        color: bg,
        child: isTabletRail
            ? Row(
                children: [
                  TabletNavRail(currentLocation: widget.currentLocation),
                  Expanded(
                    child: widget.child,
                  ),
                ],
              )
            : Stack(
                children: [
                  // Scrollable Screen Content
                  Positioned.fill(
                    child: NotificationListener<ScrollNotification>(
                      onNotification: _onScrollNotification,
                      child: widget.child,
                    ),
                  ),

                  // Auto-Hiding Bottom Navigation Bar with Smooth Native Slide Animation
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: AnimatedSlide(
                      offset: _navVisible ? Offset.zero : const Offset(0, 1.3),
                      duration: const Duration(milliseconds: 220),
                      curve: Curves.fastOutSlowIn,
                      child: AnimatedOpacity(
                        opacity: _navVisible ? 1.0 : 0.0,
                        duration: const Duration(milliseconds: 180),
                        curve: Curves.easeOut,
                        child: IgnorePointer(
                          ignoring: !_navVisible,
                          child: Center(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 600),
                              child: MobileBottomNav(
                                  currentLocation: widget.currentLocation),
                            ),
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
