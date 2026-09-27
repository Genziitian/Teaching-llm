import 'package:flutter/material.dart';

/// Responsive breakpoints matching Material Design guidelines.
/// Phone: < 600dp, Tablet: 600-899dp, Large Tablet/Desktop: >= 900dp.
class Responsive {
  Responsive._();

  static const double phoneMax = 599;
  static const double tabletMin = 600;
  static const double tabletMax = 899;
  static const double desktopMin = 900;

  /// Maximum content width on tablets so text doesn't stretch edge-to-edge.
  /// Matches the Capacitor web app's max-w-2xl (672px) for content areas.
  static const double contentMaxWidth = 672;

  /// Wider max for pages that benefit from more space (dashboard grids, etc.).
  static const double wideContentMaxWidth = 960;

  static bool isPhone(BuildContext context) =>
      MediaQuery.sizeOf(context).shortestSide < tabletMin;

  static bool isTablet(BuildContext context) {
    final shortest = MediaQuery.sizeOf(context).shortestSide;
    return shortest >= tabletMin && shortest < desktopMin;
  }

  static bool isLargeTablet(BuildContext context) =>
      MediaQuery.sizeOf(context).shortestSide >= desktopMin;

  static bool isTabletOrLarger(BuildContext context) =>
      MediaQuery.sizeOf(context).shortestSide >= tabletMin;

  /// Current width of the screen.
  static double screenWidth(BuildContext context) =>
      MediaQuery.sizeOf(context).width;

  /// Returns responsive horizontal padding: tighter on phones, wider on tablets.
  static EdgeInsets horizontalPadding(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= desktopMin) return const EdgeInsets.symmetric(horizontal: 48);
    if (width >= tabletMin) return const EdgeInsets.symmetric(horizontal: 32);
    return const EdgeInsets.symmetric(horizontal: 16);
  }

  /// Returns the number of grid columns based on screen width.
  static int gridColumns(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= desktopMin) return 3;
    if (width >= tabletMin) return 2;
    return 1;
  }

  /// Responsive font scale multiplier for tablets (slightly larger text).
  static double fontScale(BuildContext context) {
    if (isLargeTablet(context)) return 1.15;
    if (isTablet(context)) return 1.08;
    return 1.0;
  }
}

/// A wrapper widget that constrains its child to a max width and centers it.
/// Use this to wrap page content on tablets so it doesn't stretch edge-to-edge.
class ResponsiveContentWrapper extends StatelessWidget {
  const ResponsiveContentWrapper({
    super.key,
    required this.child,
    this.maxWidth = Responsive.contentMaxWidth,
    this.padding,
  });

  final Widget child;
  final double maxWidth;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width <= maxWidth) {
      // Phone or narrow screen — no constraint needed
      return padding != null ? Padding(padding: padding!, child: child) : child;
    }
    // Tablet/wide screen — center content with max width
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: padding != null
            ? Padding(padding: padding!, child: child)
            : child,
      ),
    );
  }
}

/// Extension on BuildContext for quick responsive checks.
extension ResponsiveContext on BuildContext {
  bool get isPhone => Responsive.isPhone(this);
  bool get isTablet => Responsive.isTablet(this);
  bool get isTabletOrLarger => Responsive.isTabletOrLarger(this);
  bool get isLargeTablet => Responsive.isLargeTablet(this);
  int get gridColumns => Responsive.gridColumns(this);
  double get fontScale => Responsive.fontScale(this);
  EdgeInsets get responsivePadding => Responsive.horizontalPadding(this);
}
