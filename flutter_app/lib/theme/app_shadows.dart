import 'package:material_ui/material_ui.dart';

/// Light "card lift" shadow recipes matching the design canvas. The redesign
/// dropped the heavy neumorphic dual-shadow look in favour of single soft
/// drop-shadows on white surfaces.
class AppShadows {
  AppShadows._();

  // 0 4px 12px rgba(20,18,60,0.03)
  static const List<BoxShadow> sm = [
    BoxShadow(color: Color(0x08141260), offset: Offset(0, 4), blurRadius: 12),
  ];

  // 0 6px 18px rgba(20,18,60,0.04)
  static const List<BoxShadow> base = [
    BoxShadow(color: Color(0x0A141260), offset: Offset(0, 6), blurRadius: 18),
  ];

  // 0 8px 24px rgba(20,18,60,0.06)
  static const List<BoxShadow> md = [
    BoxShadow(color: Color(0x0F141260), offset: Offset(0, 8), blurRadius: 24),
  ];

  // 0 14px 32px rgba(20,18,60,0.10)
  static const List<BoxShadow> lg = [
    BoxShadow(color: Color(0x1A141260), offset: Offset(0, 14), blurRadius: 32),
  ];

  /// Used by floating heros / featured banners.
  static const List<BoxShadow> cardFloat = base;

  /// Coloured glow under a pill icon button.
  static List<BoxShadow> pillGlow(Color color) => [
        BoxShadow(
          color: color.withOpacity(0.22),
          offset: const Offset(0, 6),
          blurRadius: 14,
        ),
      ];
}
