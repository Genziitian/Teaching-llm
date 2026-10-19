import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import '../api/api_client.dart';
import '../auth/auth_providers.dart';
import '../models/user.dart';
import 'flutter_tour_steps.dart';

const int kCurrentFlutterTourVersion = 1;

class AppTourState {
  const AppTourState({
    this.isActive = false,
    this.currentIndex = 0,
    this.isManualReplay = false,
    this.showSkipModal = false,
  });

  final bool isActive;
  final int currentIndex;
  final bool isManualReplay;
  final bool showSkipModal;

  FlutterTourStep? get currentStep =>
      (currentIndex >= 0 && currentIndex < flutterTourSteps.length)
          ? flutterTourSteps[currentIndex]
          : null;

  AppTourState copyWith({
    bool? isActive,
    int? currentIndex,
    bool? isManualReplay,
    bool? showSkipModal,
  }) {
    return AppTourState(
      isActive: isActive ?? this.isActive,
      currentIndex: currentIndex ?? this.currentIndex,
      isManualReplay: isManualReplay ?? this.isManualReplay,
      showSkipModal: showSkipModal ?? this.showSkipModal,
    );
  }
}

class AppTourNotifier extends StateNotifier<AppTourState> {
  AppTourNotifier(this._ref) : super(const AppTourState()) {
    _ref.listen<AsyncValue<User?>>(authStateProvider, (prev, next) {
      final user = next.value;
      if (user != null) {
        _checkAutoStart(user);
      }
    });
  }

  final Ref _ref;
  final ApiClient _api = ApiClient();
  bool _sessionDismissed = false;

  void _checkAutoStart(User user) {
    if (state.isActive || _sessionDismissed) return;

    if (user.needsIdentitySetup || !user.isProfileComplete) return;

    final isCompleted = user.appTourCompleted;
    final completedVersion = user.completedTourVersion;

    if (isCompleted || completedVersion >= kCurrentFlutterTourVersion) {
      _sessionDismissed = true;
      return;
    }

    if (!isCompleted || completedVersion < kCurrentFlutterTourVersion) {
      Timer(const Duration(milliseconds: 1600), () {
        if (!state.isActive && !_sessionDismissed) {
          state = state.copyWith(
            isActive: true,
            isManualReplay: false,
            currentIndex: 0,
            showSkipModal: false,
          );
        }
      });
    }
  }

  void startManualTour() {
    state = state.copyWith(
      isActive: true,
      isManualReplay: true,
      currentIndex: 0,
      showSkipModal: false,
    );
  }

  void nextStep() {
    if (state.currentIndex < flutterTourSteps.length - 1) {
      state = state.copyWith(currentIndex: state.currentIndex + 1);
    } else {
      finishTour();
    }
  }

  void previousStep() {
    if (state.currentIndex > 0) {
      state = state.copyWith(currentIndex: state.currentIndex - 1);
    }
  }

  void requestSkip() {
    state = state.copyWith(showSkipModal: true);
  }

  void cancelSkip() {
    state = state.copyWith(showSkipModal: false);
  }

  Future<void> confirmSkip() async {
    final isManual = state.isManualReplay;
    _sessionDismissed = true;
    state = const AppTourState();
    if (!isManual) {
      await _syncTourStatusToBackend(skipped: true);
    }
  }

  Future<void> finishTour() async {
    final isManual = state.isManualReplay;
    _sessionDismissed = true;
    state = const AppTourState();
    if (!isManual) {
      await _syncTourStatusToBackend(skipped: false);
    }
  }

  Future<void> _syncTourStatusToBackend({required bool skipped}) async {
    try {
      await _api.post(
        '/api/user/tour-status',
        body: {
          'skipped': skipped,
          'version': kCurrentFlutterTourVersion,
        },
      );
    } catch (_) {
      // Best effort API sync
    }
  }
}

final appTourControllerProvider =
    StateNotifierProvider<AppTourNotifier, AppTourState>((ref) {
  return AppTourNotifier(ref);
});
