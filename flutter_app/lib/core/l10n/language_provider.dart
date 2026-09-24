import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persisted across launches via SharedPreferences. Default is 'en'.
class LanguageNotifier extends AsyncNotifier<String> {
  static const _key = 'app_language';

  @override
  Future<String> build() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_key);
    if (v == 'hi') {
      return 'hi';
    }
    return 'en';
  }

  Future<void> set(String languageCode) async {
    state = AsyncData(languageCode);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, languageCode);
  }
}

final languageProvider = AsyncNotifierProvider<LanguageNotifier, String>(LanguageNotifier.new);
