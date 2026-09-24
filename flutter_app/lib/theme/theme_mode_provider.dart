import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppThemeMode {
  system,
  light,
  dark,
  black,
}

/// Persisted across launches via SharedPreferences. Default is `light` so
/// new installs start in the brand-consistent light theme; users can opt
/// into dark, black, or system from More → Appearance.
class ThemeModeNotifier extends AsyncNotifier<AppThemeMode> {
  static const _key = 'app_theme_mode';

  @override
  Future<AppThemeMode> build() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_key);
    switch (v) {
      case 'light':
        return AppThemeMode.light;
      case 'dark':
        return AppThemeMode.dark;
      case 'black':
        return AppThemeMode.black;
      case 'system':
        return AppThemeMode.system;
      default:
        return AppThemeMode.light;
    }
  }

  Future<void> set(AppThemeMode mode) async {
    state = AsyncData(mode);
    final prefs = await SharedPreferences.getInstance();
    switch (mode) {
      case AppThemeMode.light:
        await prefs.setString(_key, 'light');
        break;
      case AppThemeMode.dark:
        await prefs.setString(_key, 'dark');
        break;
      case AppThemeMode.black:
        await prefs.setString(_key, 'black');
        break;
      case AppThemeMode.system:
        await prefs.setString(_key, 'system');
        break;
    }
  }
}

final themeModeProvider =
    AsyncNotifierProvider<ThemeModeNotifier, AppThemeMode>(ThemeModeNotifier.new);
