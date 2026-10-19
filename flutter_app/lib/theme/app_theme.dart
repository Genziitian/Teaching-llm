import 'package:cupertino_ui/cupertino_ui.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:material_ui/material_ui.dart';

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


  // ── Apple-style buttons: flat, rounded, semibold, dim on press ────────
  static final _shape =
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));
  static final _label =
      GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w600);

  static WidgetStateProperty<Color?> _pressDim(Color c) =>
      WidgetStateProperty.resolveWith((s) {
        if (s.contains(WidgetState.disabled)) return c.withValues(alpha: 0.35);
        if (s.contains(WidgetState.pressed)) return c.withValues(alpha: 0.78);
        return c;
      });

  static FilledButtonThemeData _filledButton(Color bg, Color fg) =>
      FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: _pressDim(bg),
          foregroundColor: WidgetStatePropertyAll(fg),
          elevation: const WidgetStatePropertyAll(0),
          shape: WidgetStatePropertyAll(_shape),
          textStyle: WidgetStatePropertyAll(_label),
        ),
      );

  static ElevatedButtonThemeData _elevatedButton(Color bg, Color fg) =>
      ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: _pressDim(bg),
          foregroundColor: WidgetStatePropertyAll(fg),
          elevation: const WidgetStatePropertyAll(0),
          shadowColor: const WidgetStatePropertyAll(Colors.transparent),
          shape: WidgetStatePropertyAll(_shape),
          textStyle: WidgetStatePropertyAll(_label),
        ),
      );

  static OutlinedButtonThemeData _outlinedButton(Color fg, Color line) =>
      OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: _pressDim(fg),
          side: WidgetStatePropertyAll(BorderSide(color: line)),
          shape: WidgetStatePropertyAll(_shape),
          textStyle: WidgetStatePropertyAll(_label),
        ),
      );

  static TextButtonThemeData _textButton(Color fg) => TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: _pressDim(fg),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          textStyle: WidgetStatePropertyAll(_label),
        ),
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
      splashFactory: NoSplash.splashFactory,
      highlightColor: const Color(0x0F5856D6),
      splashColor: Colors.transparent,
      filledButtonTheme: _filledButton(tokens.primaryAccent, Colors.white),
      elevatedButtonTheme: _elevatedButton(tokens.primaryAccent, Colors.white),
      outlinedButtonTheme: _outlinedButton(tokens.primaryAccent, tokens.border),
      textButtonTheme: _textButton(tokens.primaryAccent),
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
      splashFactory: NoSplash.splashFactory,
      highlightColor: const Color(0x14FFFFFF),
      splashColor: Colors.transparent,
      filledButtonTheme: _filledButton(tokens.primaryAccent, Colors.white),
      elevatedButtonTheme: _elevatedButton(tokens.primaryAccent, Colors.white),
      outlinedButtonTheme: _outlinedButton(tokens.primaryAccent, tokens.border),
      textButtonTheme: _textButton(tokens.primaryAccent),
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
      splashFactory: NoSplash.splashFactory,
      highlightColor: const Color(0x14FFFFFF),
      splashColor: Colors.transparent,
      filledButtonTheme: _filledButton(tokens.primaryAccent, Colors.black),
      elevatedButtonTheme: _elevatedButton(tokens.primaryAccent, Colors.black),
      outlinedButtonTheme: _outlinedButton(tokens.primaryAccent, tokens.border),
      textButtonTheme: _textButton(tokens.primaryAccent),
    );
  }
}
