import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/user.dart';

/// Encrypted persistence for the JWT and user session info with SharedPreferences fallback.
class TokenStorage {
  const TokenStorage();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(resetOnError: false, migrateWithBackup: true),
  );

  static const _tokenKey = 'auth_token';
  static const _userIdKey = 'auth_user_id';
  static const _userRoleKey = 'auth_user_role';
  static const _userJsonKey = 'auth_user_cached_json';
  static const _tokenSavedAtKey = 'auth_token_saved_at';

  Future<String?> read() async {
    try {
      final token = await _storage.read(key: _tokenKey);
      if (token != null && token.isNotEmpty) return token;
    } catch (_) {}
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_tokenKey);
    } catch (_) {
      return null;
    }
  }

  Future<String?> userId() async {
    try {
      final id = await _storage.read(key: _userIdKey);
      if (id != null && id.isNotEmpty) return id;
    } catch (_) {}
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_userIdKey);
    } catch (_) {
      return null;
    }
  }

  Future<String?> userRole() async {
    try {
      final role = await _storage.read(key: _userRoleKey);
      if (role != null && role.isNotEmpty) return role;
    } catch (_) {}
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_userRoleKey);
    } catch (_) {
      return null;
    }
  }

  Future<User?> readCachedUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString(_userJsonKey);
      if (str != null && str.isNotEmpty) {
        final decoded = jsonDecode(str) as Map<String, dynamic>;
        return User.fromJson(decoded);
      }
    } catch (_) {}
    return null;
  }

  Future<void> saveUser(User user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_userJsonKey, jsonEncode(user.toJson()));
    } catch (_) {}
  }

  Future<void> save({
    required String token,
    required String userId,
    required String role,
    User? user,
  }) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    try {
      await Future.wait([
        _storage.write(key: _tokenKey, value: token),
        _storage.write(key: _userIdKey, value: userId),
        _storage.write(key: _userRoleKey, value: role),
      ]);
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token);
      await prefs.setString(_userIdKey, userId);
      await prefs.setString(_userRoleKey, role);
      await prefs.setInt(_tokenSavedAtKey, now);
      if (user != null) {
        await prefs.setString(_userJsonKey, jsonEncode(user.toJson()));
      }
    } catch (_) {}
  }

  Future<void> clear() async {
    try {
      await Future.wait([
        _storage.delete(key: _tokenKey),
        _storage.delete(key: _userIdKey),
        _storage.delete(key: _userRoleKey),
      ]);
    } catch (_) {}

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_tokenKey);
      await prefs.remove(_userIdKey);
      await prefs.remove(_userRoleKey);
      await prefs.remove(_userJsonKey);
      await prefs.remove(_tokenSavedAtKey);
    } catch (_) {}
  }
}

