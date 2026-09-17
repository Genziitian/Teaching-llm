import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_router.dart';
import 'modal_observer.dart';

/// Tracks navigation history and intercepts the Android system/hardware
/// Back button to ensure predictable back flow:
///   Lecture (/watch or /material) -> Course (/courses/:id or /courses) -> Home (/dashboard) -> Exit
///
/// It also persists the last meaningful screen visited to SharedPreferences so that
/// if Android kills the app process under memory pressure, returning to the app restores
/// the user's session and exact screen/lecture instead of restarting at /dashboard.
class AppNavHistoryObserver extends NavigatorObserver
    with WidgetsBindingObserver {
  AppNavHistoryObserver._();
  static final AppNavHistoryObserver instance = AppNavHistoryObserver._();

  static const String _lastLocationKey = 'last_nav_location';
  GoRouter? _router;

  /// Ordered stack of visited route paths/URIs for back navigation.
  final List<String> _history = [];

  bool _initialized = false;

  void attachRouter(GoRouter router) {
    _router = router;
    if (!_initialized) {
      _initialized = true;
      WidgetsBinding.instance.addObserver(this);
    }
  }

  void dispose() {
    if (_initialized) {
      WidgetsBinding.instance.removeObserver(this);
      _initialized = false;
    }
  }

  /// Records a navigation event, avoiding consecutive duplicates and loops.
  void recordNavigation(String location) {
    if (_isTransientRoute(location)) return;

    if (_history.isEmpty || _history.last != location) {
      final existingIndex = _history.lastIndexOf(location);
      if (existingIndex != -1 && existingIndex < _history.length - 1) {
        // If user navigated back to a screen earlier in the history, trim up to it
        _history.removeRange(existingIndex + 1, _history.length);
      } else {
        _history.add(location);
      }
      // Routes are kept in-memory for the active session and not persisted
      // to disk so that fresh launches always start at Home (/dashboard).
    }
  }

  bool _isTransientRoute(String path) {
    final uri = Uri.tryParse(path);
    final cleanPath = uri?.path ?? path;
    return cleanPath == '/login' ||
        cleanPath == '/welcome' ||
        cleanPath == '/offline';
  }

  static Future<String?> getSavedLastLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final loc = prefs.getString(_lastLocationKey);
      if (loc != null &&
          loc.isNotEmpty &&
          loc != '/login' &&
          loc != '/welcome' &&
          loc != '/offline') {
        return loc;
      }
    } catch (_) {}
    return null;
  }

  static Future<void> clearSavedLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_lastLocationKey);
    } catch (_) {}
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    _onRouteChanged();
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    _onRouteChanged();
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
    _onRouteChanged();
  }

  void _onRouteChanged() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final router = _router;
      if (router == null) return;
      try {
        final loc = router.routeInformationProvider.value.uri.toString();
        recordNavigation(loc);
      } catch (_) {}
    });
  }

  @override
  Future<bool> didPopRoute() async {
    // 1. If any modal / bottom sheet / dialog is open, dismiss it first
    if (rootModalObserver.hasPopup) {
      final ctx = rootNavigatorKey.currentContext;
      if (ctx != null && Navigator.of(ctx).canPop()) {
        Navigator.of(ctx).pop();
        return true;
      }
    }

    final router = _router;
    if (router == null) return false;

    // 2. If the GoRouter navigator stack itself has a page to pop, pop it
    if (router.canPop()) {
      router.pop();
      return true;
    }

    // 3. canPop is false. Check current location.
    final currentUri = router.routeInformationProvider.value.uri;
    final currentPath = currentUri.path;

    // If at root /dashboard or auth gates, allow normal Android exit / background behavior
    if (currentPath == '/dashboard' ||
        currentPath == '/' ||
        currentPath == '/login' ||
        currentPath == '/welcome') {
      return false; // Tells Android to exit/background the app
    }

    // If we have history before the current screen, navigate to the previous screen
    if (_history.length > 1) {
      _history.removeLast(); // remove current location
      while (_history.isNotEmpty && _history.last == currentUri.toString()) {
        _history.removeLast();
      }
      if (_history.isNotEmpty) {
        final prev = _history.last;
        router.go(prev);
        return true;
      }
    }

    // Fallback based on route hierarchy if history stack is empty:
    // Lecture (/watch) or Material (/material) -> Course
    if (currentPath == '/watch' || currentPath == '/material') {
      final courseId = currentUri.queryParameters['courseId'];
      if (courseId != null && courseId.isNotEmpty) {
        router.go('/courses/$courseId');
      } else {
        router.go('/courses');
      }
      return true;
    }

    // Course detail -> Courses list
    if (currentPath.startsWith('/courses/')) {
      router.go('/courses');
      return true;
    }

    // Support ticket detail -> Support page
    if (currentPath.startsWith('/support/tickets/')) {
      router.go('/support');
      return true;
    }

    // Secondary subpages -> /more or /dashboard
    if (currentPath == '/settings' ||
        currentPath == '/settings/notifications' ||
        currentPath == '/transactions' ||
        currentPath == '/faq' ||
        currentPath == '/notifications' ||
        currentPath == '/support' ||
        currentPath == '/about-us' ||
        currentPath == '/privacy-policy' ||
        currentPath == '/refund-policy' ||
        currentPath == '/terms' ||
        currentPath == '/terms-and-conditions' ||
        currentPath == '/copyright' ||
        currentPath == '/copyright-policy' ||
        currentPath == '/contact-us') {
      router.go('/more');
      return true;
    }

    if (currentPath.startsWith('/free-resources/')) {
      router.go('/free-resources');
      return true;
    }

    if (currentPath == '/free-resources') {
      router.go('/academics');
      return true;
    }

    // Inner tabs (/courses, /academics, /community, /more, /live, /calendar, /announcements, etc.) -> /dashboard
    router.go('/dashboard');
    return true;
  }
}
