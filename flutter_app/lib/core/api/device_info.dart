import 'dart:math';

import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Device details sent with every API call (X-Device-*), used for "Login activity" and
/// new-device login alerts (src/lib/login-device.ts). The id is a random per-install value,
/// not a hardware id. Model/OS/version come from MainActivity's "device" channel.
class DeviceInfo {
  static Map<String, String> headers = const {};

  static Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var id = prefs.getString('install_device_id');
      if (id == null) {
        final r = Random.secure();
        id = List.generate(16, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
        await prefs.setString('install_device_id', id);
      }
      final info = await const MethodChannel('com.teaching.lms/device')
          .invokeMapMethod<String, dynamic>('info') ??
          const {};
      headers = {
        'X-Device-Id': id,
        for (final (key, header) in const [
          ('name', 'X-Device-Name'),
          ('os', 'X-Device-OS'),
          ('appVersion', 'X-App-Version'),
        ])
          if (info[key] != null) header: '${info[key]}',
      };
    } catch (_) {
      // Not fatal: logins still work, they just show up as an unknown device.
    }
  }
}
