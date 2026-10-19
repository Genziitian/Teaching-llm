import 'package:material_ui/material_ui.dart';

/// Semantic design tokens for the Flutter app.
/// Matches the design system in Capacitor (`src/app/globals.css`).
@immutable
class AppThemeTokens extends ThemeExtension<AppThemeTokens> {
  const AppThemeTokens({
    required this.bg,
    required this.surface,
    required this.surfaceSecondary,
    required this.cardBg,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.border,
    required this.borderLight,
    required this.divider,
    required this.primaryAccent,
    required this.danger,
    required this.success,
    required this.warning,
    required this.info,
    required this.isDark,
    this.isBlack = false,
  });

  final Color bg;
  final Color surface;
  final Color surfaceSecondary;
  final Color cardBg;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color border;
  final Color borderLight;
  final Color divider;
  final Color primaryAccent;
  final Color danger;
  final Color success;
  final Color warning;
  final Color info;
  final bool isDark;
  final bool isBlack;

  static const light = AppThemeTokens(
    bg: Color(0xFFF2F2F7),
    surface: Color(0xFFFFFFFF),
    surfaceSecondary: Color(0xFFF2F2F7),
    cardBg: Color(0xFFFFFFFF),
    textPrimary: Color(0xFF1C1C1E),
    textSecondary: Color(0xFF48484A),
    textMuted: Color(0xFF737378),
    border: Color(0xFFE5E5EA),
    borderLight: Color(0xFFF2F2F7),
    divider: Color(0xFFE5E5EA),
    primaryAccent: Color(0xFF5856D6),
    danger: Color(0xFFFF3B30),
    success: Color(0xFF34C759),
    warning: Color(0xFFFF9500),
    info: Color(0xFF007AFF),
    isDark: false,
    isBlack: false,
  );

  static const dark = AppThemeTokens(
    bg: Color(0xFF000000),
    surface: Color(0xFF1C1C1E),
    surfaceSecondary: Color(0xFF2C2C2E),
    cardBg: Color(0xFF1C1C1E),
    textPrimary: Color(0xFFFFFFFF),
    textSecondary: Color(0xFFAEAEB2),
    textMuted: Color(0xFF8E8E93),
    border: Color(0xFF38383A),
    borderLight: Color(0xFF2C2C2E),
    divider: Color(0xFF38383A),
    primaryAccent: Color(0xFF7D7AFF),
    danger: Color(0xFFFF453A),
    success: Color(0xFF30D158),
    warning: Color(0xFFFF9F0A),
    info: Color(0xFF0A84FF),
    isDark: true,
    isBlack: false,
  );

  static const black = AppThemeTokens(
    bg: Color(0xFF000000),
    surface: Color(0xFF0A0A0A),
    surfaceSecondary: Color(0xFF141414),
    cardBg: Color(0xFF0D0D0D),
    textPrimary: Color(0xFFFFFFFF),
    textSecondary: Color(0xFFA1A1AA),
    textMuted: Color(0xFF71717A),
    border: Color(0xFF27272A),
    borderLight: Color(0xFF18181B),
    divider: Color(0xFF27272A),
    primaryAccent: Color(0xFFFFFFFF),
    danger: Color(0xFFFF453A),
    success: Color(0xFF30D158),
    warning: Color(0xFFFF9F0A),
    info: Color(0xFF0A84FF),
    isDark: true,
    isBlack: true,
  );

  @override
  AppThemeTokens copyWith({
    Color? bg,
    Color? surface,
    Color? surfaceSecondary,
    Color? cardBg,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? border,
    Color? borderLight,
    Color? divider,
    Color? primaryAccent,
    Color? danger,
    Color? success,
    Color? warning,
    Color? info,
    bool? isDark,
    bool? isBlack,
  }) {
    return AppThemeTokens(
      bg: bg ?? this.bg,
      surface: surface ?? this.surface,
      surfaceSecondary: surfaceSecondary ?? this.surfaceSecondary,
      cardBg: cardBg ?? this.cardBg,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      border: border ?? this.border,
      borderLight: borderLight ?? this.borderLight,
      divider: divider ?? this.divider,
      primaryAccent: primaryAccent ?? this.primaryAccent,
      danger: danger ?? this.danger,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      info: info ?? this.info,
      isDark: isDark ?? this.isDark,
      isBlack: isBlack ?? this.isBlack,
    );
  }

  @override
  ThemeExtension<AppThemeTokens> lerp(
      ThemeExtension<AppThemeTokens>? other, double t) {
    if (other is! AppThemeTokens) return this;
    return AppThemeTokens(
      bg: Color.lerp(bg, other.bg, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceSecondary:
          Color.lerp(surfaceSecondary, other.surfaceSecondary, t)!,
      cardBg: Color.lerp(cardBg, other.cardBg, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderLight: Color.lerp(borderLight, other.borderLight, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      primaryAccent: Color.lerp(primaryAccent, other.primaryAccent, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
      isDark: t < 0.5 ? isDark : other.isDark,
      isBlack: t < 0.5 ? isBlack : other.isBlack,
    );
  }
}

/// Convenience extensions on BuildContext to access tokens and theme helpers.
extension AppThemeContextExtension on BuildContext {
  AppThemeTokens get tokens =>
      Theme.of(this).extension<AppThemeTokens>() ??
      (Theme.of(this).brightness == Brightness.dark
          ? AppThemeTokens.dark
          : AppThemeTokens.light);

  bool get isDark => Theme.of(this).brightness == Brightness.dark;

  bool get isBlack => tokens.isBlack;
}
