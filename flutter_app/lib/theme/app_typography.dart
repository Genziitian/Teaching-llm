import 'package:material_ui/material_ui.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Manrope-based typography matching the design system.
/// Text styles omit hardcoded black colors so they automatically inherit
/// high-contrast theme foreground colors in both Light and Dark modes.
class AppTypography {
  AppTypography._();

  static TextStyle _m(
    double size,
    FontWeight w, {
    Color? color,
    double? letterSpacing,
    double height = 1.25,
  }) =>
      GoogleFonts.manrope(
        fontSize: size,
        fontWeight: w,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );

  // Page heading: 26/800 -0.4
  static TextStyle h1 =
      _m(26, FontWeight.w800, letterSpacing: -0.4, height: 1.1);
  // Hero heading on dark gradients: 22/800 -0.3
  static TextStyle heroHeading = _m(22, FontWeight.w800,
      color: AppColors.textInverse, letterSpacing: -0.3, height: 1.2);
  // Section title: 17/800 -0.2
  static TextStyle h2 =
      _m(17, FontWeight.w800, letterSpacing: -0.2, height: 1.15);
  // Card title: 14.5/700-800
  static TextStyle title = _m(14.5, FontWeight.w800, height: 1.25);
  // Body: 13/500
  static TextStyle body = _m(13, FontWeight.w500, height: 1.45);
  // Muted body: 12.5/600
  static TextStyle bodyMuted = _m(12.5, FontWeight.w600, height: 1.4);
  // Caption: 11.5/600
  static TextStyle caption =
      _m(11.5, FontWeight.w600, letterSpacing: 0.08);
  // Tiny uppercase eyebrow: 10.5/800 letter-spacing 1.2
  static TextStyle uppercase =
      _m(10.5, FontWeight.w800, letterSpacing: 1.2);
  // Button label: 14/800
  static TextStyle buttonLabel = _m(14, FontWeight.w800,
      color: AppColors.textInverse, height: 1.0);

  /// Apply Manrope to the entire MaterialApp via theme.textTheme.
  static TextTheme textTheme(
    TextTheme base, {
    required Color primaryColor,
    required Color secondaryColor,
  }) =>
      GoogleFonts.manropeTextTheme(base).copyWith(
        displayLarge: _m(26, FontWeight.w800,
            color: primaryColor, letterSpacing: -0.4, height: 1.1),
        headlineMedium: _m(17, FontWeight.w800,
            color: primaryColor, letterSpacing: -0.2, height: 1.15),
        titleMedium: _m(14.5, FontWeight.w800,
            color: primaryColor, height: 1.25),
        bodyMedium: _m(13, FontWeight.w500,
            color: secondaryColor, height: 1.45),
        bodySmall: _m(12.5, FontWeight.w600,
            color: secondaryColor, height: 1.4),
        labelSmall: _m(11.5, FontWeight.w600,
            color: secondaryColor, letterSpacing: 0.08),
      );
}
