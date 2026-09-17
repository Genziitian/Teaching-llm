import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/auth/auth_providers.dart';

const _kCachedDashboardKey = 'cached_dashboard_payload';

/// Indicates if the latest sync was offline/cached.
final isOfflineModeProvider = StateProvider<bool>((ref) => false);

/// Single GET /api/dashboard call with offline cache persistence.
/// Ensures the dashboard structure and saved courses/announcements always display offline.
final dashboardProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);

  try {
    final res = await api.get<Map<String, dynamic>>('/api/dashboard');
    if (res.data != null && res.data!.isNotEmpty) {
      final data = res.data!;
      // Save cache to disk
      SharedPreferences.getInstance().then((prefs) {
        prefs.setString(_kCachedDashboardKey, jsonEncode(data));
      }).catchError((_) {});

      ref.read(isOfflineModeProvider.notifier).state = false;
      return data;
    }
  } catch (err) {
    if (err is DioException) {
      final statusCode = err.response?.statusCode;
      final errMsg = (err.message ?? '').toLowerCase();
      if (statusCode == 401 ||
          statusCode == 403 ||
          errMsg.contains('not authenticated') ||
          errMsg.contains('unauthorized')) {
        // Token expired/revoked: trigger clean sign-out instead of falsely showing offline mode
        Future.microtask(() => ref.read(authStateProvider.notifier).signOut());
        return {
          'liveSessions': const <dynamic>[],
          'recentViewedLecture': null,
          'announcements': const <dynamic>[],
        };
      }

      final isNetwork = err.type == DioExceptionType.connectionTimeout ||
          err.type == DioExceptionType.sendTimeout ||
          err.type == DioExceptionType.receiveTimeout ||
          err.type == DioExceptionType.connectionError;

      if (isNetwork) {
        ref.read(isOfflineModeProvider.notifier).state = true;
      }
    }

    // Read from disk cache on network error or offline launch
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedStr = prefs.getString(_kCachedDashboardKey);
      if (cachedStr != null && cachedStr.isNotEmpty) {
        final decoded = jsonDecode(cachedStr) as Map<String, dynamic>;
        return decoded;
      }
    } catch (_) {}
  }

  return {
    'liveSessions': const <dynamic>[],
    'recentViewedLecture': null,
    'announcements': const <dynamic>[],
  };
});

/// Fetches active deletion request status for the logged-in user
final userDeletionRequestProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<Map<String, dynamic>>('/api/user/delete-request');
    return res.data;
  } catch (_) {
    return null;
  }
});

