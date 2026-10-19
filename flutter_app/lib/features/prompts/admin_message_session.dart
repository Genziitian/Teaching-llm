import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../../core/auth/auth_providers.dart';

/// A fresh session on logout/account change; eligibility still comes from APIs.
final adminMessageSessionProvider = ChangeNotifierProvider<AdminMessageSession>(
  (ref) => AdminMessageSession(
    ref.watch(authStateProvider.select((auth) => auth.value?.id)),
  ),
);

class AdminMessageSession extends ChangeNotifier {
  AdminMessageSession(this.userId);

  final String? userId;
  final cancelled = Completer<void>();
  bool ready = false;
  final dismissedUpdates = <String>{};
  final answeredPrompts = <String>{};
  DateTime? lastMessageCheck;
  final promoChecks = <String, DateTime>{};

  void markReady() {
    if (ready || userId == null) return;
    ready = true;
    notifyListeners();
  }

  @override
  void dispose() {
    if (!cancelled.isCompleted) cancelled.complete();
    super.dispose();
  }
}
