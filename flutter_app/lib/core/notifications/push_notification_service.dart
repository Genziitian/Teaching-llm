import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

/// Owns the complete native push lifecycle for the Flutter application.
///
/// FCM supplies `ctaLink` and `url`. Internal links are routed inside Flutter,
/// external links open in the system browser, and private links tapped while
/// signed out are queued until authentication has completed.
class PushNotificationService {
  PushNotificationService._();

  static final instance = PushNotificationService._();

  static const _channel = AndroidNotificationChannel(
    'class_updates',
    'Class Updates (Urgent)',
    description: 'Live classes, announcements, and important study updates',
    importance: Importance.max,
  );

  FirebaseMessaging get _messaging => FirebaseMessaging.instance;
  final _localNotifications = FlutterLocalNotificationsPlugin();
  final _api = ApiClient();

  GoRouter? _router;
  String? _pendingLink;
  String? _registeredToken;
  bool _signedIn = false;
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized || kIsWeb) return;

    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      const initializationSettings = InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcherh'),
      );
      await _localNotifications.initialize(
        initializationSettings,
        onDidReceiveNotificationResponse: (response) {
          final payload = response.payload;
          if (payload == null || payload.isEmpty) return;
          try {
            final data = jsonDecode(payload);
            if (data is Map) {
              _handleData(Map<String, dynamic>.from(data));
            }
          } catch (_) {
            _handleLink(payload);
          }
        },
      );

      final androidPlugin =
          _localNotifications.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(_channel);

      FirebaseMessaging.onMessage.listen(_showForegroundNotification);
      FirebaseMessaging.onMessageOpenedApp.listen(
        (message) => _handleData(message.data),
      );
      _messaging.onTokenRefresh.listen((token) async {
        _registeredToken = null;
        if (_signedIn) await _registerToken(token);
      });

      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        _pendingLink = _linkFromData(initialMessage.data);
      }
      _initialized = true;
    } catch (e, st) {
      debugPrint('PushNotificationService initialize error: $e\n$st');
    }
  }

  void attachRouter(GoRouter router) {
    _router = router;
    _drainPendingLink();
  }

  Future<void> updateAuthentication(bool signedIn) async {
    if (_signedIn == signedIn) {
      if (signedIn) _drainPendingLink();
      return;
    }

    _signedIn = signedIn;
    if (signedIn) {
      await enableAndSync();
      _drainPendingLink();
    } else {
      _registeredToken = null;
    }
  }

  /// Requests OS permission and synchronizes this device token to the backend.
  Future<bool> enableAndSync() async {
    if (!_initialized || kIsWeb) return false;

    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    final allowed =
        settings.authorizationStatus == AuthorizationStatus.authorized ||
            settings.authorizationStatus == AuthorizationStatus.provisional;
    if (!allowed) return false;

    final token = await _messaging.getToken();
    if (token == null || token.isEmpty) return false;
    await _registerToken(token);
    return true;
  }

  /// Must run before auth storage is cleared so the endpoint remains authorized.
  Future<void> unregisterCurrentToken() async {
    if (!_initialized || kIsWeb) return;
    try {
      final token = _registeredToken ?? await _messaging.getToken();
      if (token != null && token.isNotEmpty) {
        await _api.delete('/api/fcm/register', body: {'token': token});
      }
    } catch (_) {
      // Logout must still complete if network/token cleanup is unavailable.
    } finally {
      _registeredToken = null;
      _signedIn = false;
    }
  }

  Future<void> _registerToken(String token) async {
    if (!_signedIn || token == _registeredToken) return;
    try {
      await _api.post(
        '/api/fcm/register',
        body: {'token': token, 'platform': 'ANDROID'},
      );
      _registeredToken = token;
    } catch (_) {
      // A later sign-in, app launch, or token refresh retries registration.
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    await _localNotifications.show(
      message.messageId?.hashCode ?? DateTime.now().millisecondsSinceEpoch,
      notification.title ?? 'Gen-Z IITian',
      notification.body ?? 'You have a new update.',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'class_updates',
          'Class Updates (Urgent)',
          channelDescription:
              'Live classes, announcements, and important study updates',
          importance: Importance.max,
          priority: Priority.high,
          icon: '@mipmap/ic_launcherh',
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }

  void _handleData(Map<String, dynamic> data) {
    _handleLink(_linkFromData(data));
  }

  String _linkFromData(Map<String, dynamic> data) {
    final ctaLink = data['ctaLink']?.toString().trim();
    if (ctaLink != null && ctaLink.isNotEmpty) return ctaLink;
    final url = data['url']?.toString().trim();
    if (url != null && url.isNotEmpty) return url;
    return '/announcements';
  }

  void _handleLink(String link) {
    final uri = Uri.tryParse(link.trim());
    if (uri == null) return;

    if (uri.scheme == 'http' || uri.scheme == 'https') {
      if (!_isAppHost(uri.host)) {
        launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
      link = uri.hasQuery ? '${uri.path}?${uri.query}' : uri.path;
    }

    final internalLink = _normalizeInternalLink(link);
    if (!_signedIn) {
      _pendingLink = internalLink;
      return;
    }

    final router = _router;
    if (router == null) {
      _pendingLink = internalLink;
      return;
    }
    router.go(internalLink);
  }

  void _drainPendingLink() {
    final link = _pendingLink;
    if (!_signedIn || _router == null || link == null) return;
    _pendingLink = null;
    _router!.go(link);
  }

  bool _isAppHost(String host) =>
      host == 'class.genziitian.in' || host == 'teaching-llm.onrender.com';

  String _normalizeInternalLink(String link) {
    var normalized = link.startsWith('/') ? link : '/$link';
    if (normalized == '/') return '/dashboard';

    // Map web-only destinations to their closest native Flutter surface.
    if (normalized.startsWith('/materials')) {
      return '/free-resources';
    }
    if (normalized.startsWith('/courses/explore')) return '/courses';

    const supportedPrefixes = [
      '/dashboard',
      '/announcements',
      '/live',
      '/calendar',
      '/courses',
      '/community',
      '/support',
      '/profile',
      '/settings',
      '/notifications',
      '/academics',
      '/downloads',
      '/free-resources',
      '/watch',
      '/material',
    ];
    if (!supportedPrefixes.any(normalized.startsWith)) {
      normalized = '/announcements';
    }
    return normalized;
  }
}
