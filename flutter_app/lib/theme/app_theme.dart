import 'package:flutter/material.dart';

import 'app_theme_tokens.dart';
import 'app_typography.dart';

class AppTheme {
  AppTheme._();

  static const _pageTransitionsTheme = PageTransitionsTheme(
    builders: {
      TargetPlatform.android: CupertinoPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
    },
  );

  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    const tokens = AppThemeTokens.light;

    return base.copyWith(
      scaffoldBackgroundColor: tokens.bg,
      colorScheme: ColorScheme.light(
        primary: tokens.primaryAccent,
        secondary: tokens.primaryAccent,
        surface: tokens.surface,
        onPrimary: Colors.white,
        onSurface: tokens.textPrimary,
        error: tokens.danger,
      ),
      cardColor: tokens.cardBg,
      dividerColor: tokens.border,
      textTheme: AppTypography.textTheme(
        base.textTheme,
        primaryColor: tokens.textPrimary,
        secondaryColor: tokens.textSecondary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: tokens.bg,
        foregroundColor: tokens.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
      ),
      extensions: const [
        AppThemeTokens.light,
      ],
      pageTransitionsTheme: _pageTransitionsTheme,
      splashFactory: InkRipple.splashFactory,
      highlightColor: const Color(0x0A4F46E5),
      splashColor: const Color(0x144F46E5),
    );
  }

  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    const tokens = AppThemeTokens.dark;

    return base.copyWith(
      scaffoldBackgroundColor: tokens.bg,
      colorScheme: ColorScheme.dark(
        primary: tokens.primaryAccent,
        secondary: tokens.primaryAccent,
        surface: tokens.surface,
        onPrimary: Colors.white,
        onSurface: tokens.textPrimary,
        error: tokens.danger,
      ),
      cardColor: tokens.cardBg,
      dividerColor: tokens.border,
      textTheme: AppTypography.textTheme(
        base.textTheme,
        primaryColor: tokens.textPrimary,
        secondaryColor: tokens.textSecondary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: tokens.bg,
        foregroundColor: tokens.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
      ),
      extensions: const [
        AppThemeTokens.dark,
      ],
      pageTransitionsTheme: _pageTransitionsTheme,
      splashFactory: InkRipple.splashFactory,
      highlightColor: const Color(0x14FFFFFF),
      splashColor: const Color(0x1A4F46E5),
    );
  }

  static ThemeData black() {
    final base = ThemeData.dark(useMaterial3: true);
    const tokens = AppThemeTokens.black;

    return base.copyWith(
      scaffoldBackgroundColor: tokens.bg,
      colorScheme: ColorScheme.dark(
        primary: tokens.primaryAccent,
        secondary: tokens.primaryAccent,
        surface: tokens.surface,
        onPrimary: Colors.black,
        onSurface: tokens.textPrimary,
        error: tokens.danger,
      ),
      cardColor: tokens.cardBg,
      dividerColor: tokens.border,
      textTheme: AppTypography.textTheme(
        base.textTheme,
        primaryColor: tokens.textPrimary,
        secondaryColor: tokens.textSecondary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: tokens.bg,
        foregroundColor: tokens.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
      ),
      extensions: const [
        AppThemeTokens.black,
      ],
      pageTransitionsTheme: _pageTransitionsTheme,
      splashFactory: InkRipple.splashFactory,
      highlightColor: const Color(0x14FFFFFF),
      splashColor: const Color(0x1AFFFFFF),
    );
  }
}
