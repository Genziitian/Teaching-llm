import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'config/api_config.dart';
import 'core/notifications/push_notification_service.dart';
import 'core/router/nav_history_observer.dart';
import 'features/auth/welcome_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await PushNotificationService.instance.initialize();
  } catch (e) {
    debugPrint('PushNotificationService init error in main: $e');
  }

  // Lock to portrait for the mobile-first UX; the web app is mobile-portrait
  // by design and the Flutter app should match.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  // Enable edge-to-edge display mode for Android 15+ and backward compatibility.
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

  // Light status bar and nav bar icons (matches the cream/lavender theme on the web app).
  // Colors are omitted so Flutter does not invoke deprecated Window color APIs.
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));

  // Fire-and-forget warmup ping so Render's free-tier dyno is awake by the
  // time the user taps Login. Cold start can otherwise burn ~30-45 s on the
  // very first auth call. We don't await — UI starts immediately.
  _warmupApi();

  // Clear any legacy saved location so the app always opens afresh at Home (/dashboard)
  // when launched anew after being closed from recent apps.
  await AppNavHistoryObserver.clearSavedLocation();

  // Read the welcome-seen flag eagerly so the router's synchronous redirect
  // can decide between /welcome and /login without flicker.
  final welcomeSeen = await WelcomePage.hasBeenSeen();

  runApp(ProviderScope(
    overrides: [
      welcomeSeenProvider.overrideWith((_) => welcomeSeen),
    ],
    child: const TeachingLlmApp(),
  ));
}

void _warmupApi() {
  // `/api/auth/me` is the lightest authenticated endpoint we have; it
  // returns 401 quickly when no token is present, which is fine — the
  // goal is purely to wake the dyno, not to authenticate.
  final dio = Dio(BaseOptions(
    baseUrl: ApiConfig.baseUrl,
    connectTimeout: const Duration(seconds: 60),
    receiveTimeout: const Duration(seconds: 60),
    headers: const {'X-Requested-With': 'XMLHttpRequest'},
  ));
  dio.get<dynamic>('/api/auth/me').catchError((_) =>
      // Swallow — warmup failures are non-fatal.
      Response<dynamic>(requestOptions: RequestOptions(path: '')));
}
