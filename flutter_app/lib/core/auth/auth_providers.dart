import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../models/user.dart';
import 'auth_service.dart';
import 'token_storage.dart';

/// Singleton plumbing. Tests can override these to inject fakes.
final tokenStorageProvider = Provider<TokenStorage>((ref) => const TokenStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(tokenStorage: ref.watch(tokenStorageProvider));
});

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(
    api: ref.watch(apiClientProvider),
    tokens: ref.watch(tokenStorageProvider),
  );
});

/// AsyncValue<User?> — null = signed out, populated = signed in.
/// Drives the router redirect and the top-level "am I logged in?" state.
class AuthState extends AsyncNotifier<User?> {
  @override
  Future<User?> build() async {
    final svc = ref.read(authServiceProvider);
    final tokens = ref.read(tokenStorageProvider);

    // Returning user: open straight into the app with the profile saved on
    // the device, and confirm the session with the server in the background.
    // Waiting for the network here is what used to flash the login screen
    // (sometimes for many seconds on a slow connection or a cold server).
    final token = await tokens.read();
    if (token == null || token.isEmpty) return null;
    final cached = await tokens.readCachedUser();
    if (cached != null) {
      unawaited(_revalidate());
      return cached;
    }
    return svc.currentUser();
  }

  /// Re-checks the saved session with the server after a cached launch:
  /// refreshes the profile, or signs out if the server rejected the session.
  Future<void> _revalidate() async {
    try {
      final fresh = await ref.read(authServiceProvider).currentUser();
      // The user signed out (or the app is mid sign-in) while we were waiting:
      // leave that newer state alone.
      if (state.isLoading || state.valueOrNull == null) return;
      final token = await ref.read(tokenStorageProvider).read();
      if (fresh != null && (token == null || token.isEmpty)) return;
      state = AsyncData<User?>(fresh);
    } catch (_) {
      // Network problems keep the cached session, same as before.
    }
  }

  Future<void> signInWithGoogle() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(authServiceProvider).signInWithGoogle();
    });
  }

  Future<void> quickStudentLogin() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(authServiceProvider).quickStudentLogin();
    });
  }

  Future<void> devLogin(String role) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(authServiceProvider).devLogin(role: role);
    });
  }

  void updateCurrentUser(User updatedUser) {
    state = AsyncData<User?>(updatedUser);
    ref.read(tokenStorageProvider).saveUser(updatedUser);
  }

  Future<void> signOut() async {
    await ref.read(authServiceProvider).signOut();
    state = const AsyncData<User?>(null);
  }
}

final authStateProvider =
    AsyncNotifierProvider<AuthState, User?>(AuthState.new);
