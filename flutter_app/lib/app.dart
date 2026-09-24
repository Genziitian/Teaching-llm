import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_providers.dart';
import 'core/notifications/push_notification_service.dart';
import 'core/router/app_router.dart';
import 'core/router/nav_history_observer.dart';
import 'features/launch/play_store_launch_overlay.dart';
import 'shared/widgets/splash_overlay.dart';
import 'theme/app_theme.dart';
import 'theme/theme_mode_provider.dart';

/// Configures bouncy elastic scrolling across the entire app on all platforms,
/// matching the momentum physics of Capacitor / iOS / modern mobile web.
class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    return const BouncingScrollPhysics(
      parent: AlwaysScrollableScrollPhysics(),
    );
  }
}

class TeachingLlmApp extends ConsumerWidget {
  const TeachingLlmApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final isSignedIn = ref.watch(authStateProvider).value != null;
    final themeMode =
        ref.watch(themeModeProvider).valueOrNull ?? ThemeMode.system;
    PushNotificationService.instance.attachRouter(router);
    AppNavHistoryObserver.instance.attachRouter(router);
    unawaited(
      PushNotificationService.instance.updateAuthentication(isSignedIn),
    );

    return MaterialApp.router(
      title: 'Gen-Z IITian',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: themeMode,
      routerConfig: router,
      scrollBehavior: const AppScrollBehavior(),
      // The Play Store welcome sits above the router and the loading splash,
      // so it is the first screen whether or not someone is signed in.
      builder: (context, child) => PlayStoreLaunchOverlay(
        child: SplashOverlay(
          child: child ?? const SizedBox.shrink(),
        ),
      ),
    );
  }
}
