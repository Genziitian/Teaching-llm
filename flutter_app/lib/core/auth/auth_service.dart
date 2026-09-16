import 'package:dio/dio.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../config/api_config.dart';
import '../api/api_client.dart';
import '../models/user.dart';
import '../notifications/push_notification_service.dart';
import '../router/nav_history_observer.dart';
import 'token_storage.dart';

/// Handles the Google → backend → JWT flow.
class AuthService {
  AuthService({
    ApiClient? api,
    TokenStorage? tokens,
    GoogleSignIn? googleSignIn,
  })  : _api = api ?? ApiClient(),
        _tokens = tokens ?? const TokenStorage(),
        _google = googleSignIn ??
            GoogleSignIn(
              serverClientId: ApiConfig.googleWebClientId,
              scopes: const ['email', 'profile'],
            );

  final ApiClient _api;
  final TokenStorage _tokens;
  final GoogleSignIn _google;

  /// Returns the signed-in user on success. Throws on cancellation / failure.
  ///
  /// Tries [GoogleSignIn.signInSilently] first — when the user has already
  /// granted consent (which is true after their first sign-in on this
  /// device) Google returns the cached account without showing the picker.
  /// Cuts ~1-2 s off return-user sign-ins.
  Future<User> signInWithGoogle() async {
    GoogleSignInAccount? account = await _google.signInSilently(
      suppressErrors: true,
    );
    account ??= await _google.signIn();
    if (account == null) {
      throw AuthException('Sign-in was cancelled.');
    }
    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw AuthException('Google did not return an ID token.');
    }

    final res = await _api.post<Map<String, dynamic>>(
      '/api/auth/google',
      body: {'credential': idToken},
    );
    final data = res.data;
    if (data == null) throw AuthException('Empty response from server.');

    final token = data['token'] as String?;
    final userJson = data['user'] as Map<String, dynamic>?;
    if (token == null || userJson == null) {
      throw AuthException('Malformed auth response from server.');
    }
    final loginUser = User.fromJson(userJson);

    await _tokens.save(
      token: token,
      userId: loginUser.id,
      role: loginUser.role,
      user: loginUser,
    );

    // The token is now available to ApiClient. Refresh from the authoritative
    // profile endpoint before opening the dashboard so older deployed login
    // responses or stale cached flags cannot re-trigger completed setup flows.
    try {
      final profileRes = await _api.get<Map<String, dynamic>>('/api/auth/me');
      final freshJson = profileRes.data?['user'] as Map<String, dynamic>?;
      if (freshJson != null) {
        final freshUser = User.fromJson(freshJson);
        await _tokens.saveUser(freshUser);
        return freshUser;
      }
    } catch (_) {
      // Login itself succeeded; retain its user payload if profile refresh is
      // temporarily unavailable.
    }

    return loginUser;
  }

  /// Dev / Tester quick-login for Manager or Student without Google sign-in.
  Future<User> devLogin({required String role, String? email}) async {
    final normalizedRole = role.toUpperCase();
    try {
      final res = await _api.post<Map<String, dynamic>>(
        '/api/auth/dev-login',
        body: {
          'role': normalizedRole,
          if (email != null) 'email': email,
        },
      );
      final data = res.data;
      if (data != null && data['token'] != null && data['user'] != null) {
        final token = data['token'] as String;
        final user = User.fromJson(data['user'] as Map<String, dynamic>);
        await _tokens.save(
          token: token,
          userId: user.id,
          role: user.role,
          user: user,
        );
        return user;
      }
    } catch (_) {
      // Fall through to offline mock login
    }

    // Direct local fallback so testing is 100% reliable even offline
    final dummyUser = User(
      id: normalizedRole == 'MANAGER' ? 'demo-manager-id' : 'demo-student-id',
      name: normalizedRole == 'MANAGER' ? 'Demo Manager' : 'Demo Student',
      email: normalizedRole == 'MANAGER'
          ? 'manager@genziitian.in'
          : 'student@genziitian.in',
      role: normalizedRole,
      firstName: normalizedRole == 'MANAGER' ? 'Manager' : 'Student',
      lastName: 'Demo',
      isIdentityUpdated: true,
      isProfileComplete: true,
      iitmJoinYear: '2024',
      iitmJoinMonth: 'January',
      iitmLevel: 'Foundation',
    );
    await _tokens.save(
      token: 'demo-token-${normalizedRole.toLowerCase()}',
      userId: dummyUser.id,
      role: dummyUser.role,
      user: dummyUser,
    );
    return dummyUser;
  }

  /// Fallback for testers when STUDENT_QUICK_LOGIN_EMAIL is set on the server.
  Future<User> quickStudentLogin() async {
    final res = await _api.post<Map<String, dynamic>>(
      '/api/auth/student-quick-login',
    );
    final data = res.data;
    if (data == null) throw AuthException('Empty response from server.');
    final token = data['token'] as String?;
    final userJson = data['user'] as Map<String, dynamic>?;
    if (token == null || userJson == null) {
      throw AuthException('Malformed auth response from server.');
    }
    final user = User.fromJson(userJson);
    await _tokens.save(
      token: token,
      userId: user.id,
      role: user.role,
      user: user,
    );
    return user;
  }

  /// Loads the current user via stored token and cached profile.
  /// Uses offline-first strategy:
  /// 1. Reads the cached token and cached User from disk immediately.
  /// 2. If token exists, tries to refresh user from /api/auth/me.
  /// 3. If /api/auth/me returns 401/403 (expired/revoked), clears storage and returns null.
  /// 4. If /api/auth/me fails from network error/timeout/offline, keeps the user logged in!
  Future<User?> currentUser() async {
    final token = await _tokens.read();
    if (token == null || token.isEmpty) return null;

    final cachedUser = await _tokens.readCachedUser();

    try {
      final res = await _api.get<Map<String, dynamic>>('/api/auth/me');
      final data = res.data;
      final userJson = (data?['user'] as Map<String, dynamic>?);
      if (userJson != null) {
        final freshUser = User.fromJson(userJson);
        await _tokens.saveUser(freshUser);
        return freshUser;
      }
    } catch (err) {
      // Check for explicit 401 Unauthorized or 403 Forbidden or "Not authenticated"
      bool isAuthExpired = false;
      if (err is DioException) {
        final code = err.response?.statusCode;
        if (code == 401 || code == 403) {
          isAuthExpired = true;
        }
      }
      final errStr = err.toString().toLowerCase();
      if (isAuthExpired ||
          errStr.contains('401') ||
          errStr.contains('unauthorized') ||
          errStr.contains('not authenticated') ||
          errStr.contains('403')) {
        await _tokens.clear();
        return null;
      }
      // On network error or offline, keep the cached user logged in!
      if (cachedUser != null) {
        return cachedUser;
      }
    }
    return cachedUser;
  }

  Future<void> signOut() async {
    await PushNotificationService.instance.unregisterCurrentToken();
    try {
      await _google.signOut();
    } catch (_) {/* best effort */}
    try {
      await _api.post('/api/auth/logout');
    } catch (_) {/* best effort */}
    await _tokens.clear();
    await AppNavHistoryObserver.clearSavedLocation();
  }
}

class AuthException implements Exception {
  AuthException(this.message);
  final String message;
  @override
  String toString() => message;
}
