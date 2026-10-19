import 'package:material_ui/material_ui.dart';

/// Tokens for the IITM BS DS redesign. Mirrors the `C.*` palette from
/// the design canvas (screens.jsx) one-to-one.
class AppColors {
  AppColors._();

  // Base surfaces
  static const Color bg = Color(0xFFF2F2F7);          // Apple systemGroupedBackground
  static const Color surface = Color(0xFFFFFFFF);     // cards
  static const Color card2 = Color(0xFFF9F9FB);       // soft card alt
  static const Color sidebarBg = Color(0xFFE5E5EA);   // legacy

  // Text
  static const Color ink = Color(0xFF1C1C1E);
  static const Color ink2 = Color(0xFF48484A);
  static const Color muted = Color(0xFF737378);
  static const Color mute2 = Color(0xFFAEAEB2);

  // Brand = Apple systemIndigo
  static const Color brand = Color(0xFF5856D6);
  static const Color brandDk = Color(0xFF4543B8);
  static const Color brandSoft = Color(0xFFEEEEFC);
  static const Color brandSft2 = Color(0xFFE2E2F9);

  // Accents
  static const Color green = Color(0xFF34C759);
  static const Color greenSft = Color(0xFFE9F8EE);
  static const Color amber = Color(0xFFFF9500);
  static const Color amberSft = Color(0xFFFFF3E0);
  static const Color red = Color(0xFFFF3B30);
  static const Color redSft = Color(0xFFFFEBEA);

  // Lines
  static const Color line = Color(0xFFE5E5EA);
  static const Color line2 = Color(0xFFD1D1D6);

  // Dark surfaces
  static const Color videoBg = Color(0xFF0E1230);

  // ── Legacy aliases (don't break code from earlier phases) ─────────
  static const Color primary = brand;
  static const Color primaryDark = brandDk;
  static const Color primaryLight = Color(0x145856D6);
  static const Color accent = Color(0xFF5E5CE6);

  static const Color success = green;
  static const Color successLight = Color(0x1A34C759);
  static const Color warning = amber;
  static const Color warningLight = Color(0x1AFF9500);
  static const Color danger = red;
  static const Color dangerLight = Color(0x1AFF3B30);
  static const Color info = Color(0xFF007AFF);

  static const Color textPrimary = ink;
  static const Color textSecondary = ink2;
  static const Color textMuted = muted;
  static const Color textInverse = Color(0xFFFFFFFF);

  static const Color neuLight = Color(0xFFFFFFFF);
  static const Color neuDark = Color(0xFFC5C7CF);

  static const Color cardWhite = surface;
  static const Color heroNavy = Color(0xFF0F172A);

  static const Color tabActive = brand;
  static const Color tabInactive = mute2;
}
