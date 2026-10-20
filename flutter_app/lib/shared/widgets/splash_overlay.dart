import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/facts/loading_fact_service.dart';
import '../../core/facts/loading_facts_data.dart';
import '../../features/launch/play_store_launch_overlay.dart';
import '../../features/prompts/admin_messages_host.dart';
import '../../features/updates/play_update.dart';
import '../../features/updates/policy_update_dialog.dart';
import '../../features/updates/whats_new_dialog.dart';
import 'loading_fact_card.dart';

/// Fullscreen launch splash overlay that matches Capacitor's SplashOverlay.tsx.
/// Plays once per app launch session:
///  - Brand logo + smooth red progress bar ("LOADING...")
///  - Smooth fade-out reveal of the underlying app
class SplashOverlay extends ConsumerStatefulWidget {
  const SplashOverlay({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<SplashOverlay> createState() => _SplashOverlayState();
}

class _SplashOverlayState extends ConsumerState<SplashOverlay>
    with SingleTickerProviderStateMixin {
  static bool _hasShownThisSession = false;

  bool _loaderVisible = true;
  double _progress = 0.0;
  AnimationController? _progressController;
  LoadingFact? _fact;

  @override
  void initState() {
    super.initState();
    if (_hasShownThisSession) {
      _loaderVisible = false;
      return;
    }

    // The one-time welcome is the first screen. Skip the loader so it cannot
    // cover that welcome, and so Enter opens the app directly.
    final launchPending = ref.read(playStoreWelcomePendingProvider);
    if (launchPending) {
      _loaderVisible = false;
      _hasShownThisSession = true;
      return;
    }

    _fact = LoadingFactService.instance.getNextFact();

    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..addListener(() {
        setState(() {
          _progress =
              Curves.easeInOutCubic.transform(_progressController?.value ?? 0.0);
        });
      });

    _startSplashSequence();
  }

  Future<void> _startSplashSequence() async {
    _progressController?.forward();

    // Keep the branded loading state visible long enough to avoid a flash.
    await Future<void>.delayed(const Duration(milliseconds: 1500));
    if (!mounted || !_loaderVisible) return;

    // Keep the splash up until we know whether the saved login is valid, so a
    // signed-in user never sees the login screen flash by. Capped so a dead
    // connection can't hold the splash forever.
    try {
      await ref
          .read(authStateProvider.future)
          .timeout(const Duration(seconds: 10));
    } catch (_) {}
    // One more frame so the router has moved off /login before we reveal it.
    await Future<void>.delayed(const Duration(milliseconds: 120));
    if (!mounted || !_loaderVisible) return;
    _dismissLoader();
  }

  void _dismissLoader() {
    if (!_loaderVisible) return;
    _hasShownThisSession = true;
    setState(() {
      _loaderVisible = false;
    });
  }

  @override
  void dispose() {
    _progressController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final overlayVisible = _loaderVisible;
    final showingLaunch = ref.watch(playStoreWelcomePendingProvider);

    // Once the splash / welcome is out of the way, ask Google Play whether a
    // newer version exists (runs once per launch).
    if (!_loaderVisible && !showingLaunch) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(checkPlayUpdateOnLaunch());
        unawaited(checkWhatsNewOnLaunch());
        unawaited(checkPolicyUpdateOnLaunch(ref.read(apiClientProvider)));
      });
    }

    return Stack(
      children: [
        AdminMessagesHost(
          enabled: !_loaderVisible && !showingLaunch,
          child: widget.child,
        ),
        // Fades out smoothly instead of disappearing in one frame.
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 380),
          switchOutCurve: Curves.easeOut,
          transitionBuilder: (child, animation) =>
              FadeTransition(opacity: animation, child: child),
          child: overlayVisible
              ? Material(
                  key: const ValueKey('splash'),
                  color: Colors.white,
                  child: SizedBox.expand(
                    child: SafeArea(child: _buildLogoAndProgress()),
                  ),
                )
              : const SizedBox.shrink(key: ValueKey('no-splash')),
        ),
      ],
    );
  }

  Widget _buildLogoAndProgress() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // GenZ IITIAN Logo (eases in: fade + slight scale)
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 650),
            curve: Curves.easeOutCubic,
            builder: (context, t, child) => Opacity(
              opacity: t,
              child: Transform.scale(scale: 0.92 + 0.08 * t, child: child),
            ),
            child: Image.asset(
            'assets/mobile-login-logo.png',
            width: 170,
            height: 65,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) {
              return const Text(
                'GenZ® IITIAN',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.5,
                ),
              );
            },
          ),
          ),
          const SizedBox(height: 40),

          // Loading Bar Container
          Container(
            width: 200,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFE5E5EA),
              borderRadius: BorderRadius.circular(999),
            ),
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: _progress.clamp(0.0, 1.0),
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFDC2626), // GenZ Red brand color
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),

          const Text(
            'LOADING...',
            style: TextStyle(
              fontSize: 11.5,
              color: Color(0xFF8E8E93),
              fontWeight: FontWeight.w600,
              letterSpacing: 1.6,
            ),
          ),
          if (_fact != null) ...[
            const SizedBox(height: 28),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 700),
              curve: Curves.easeOut,
              builder: (context, t, child) => Opacity(
                opacity: t,
                child: Transform.translate(
                    offset: Offset(0, 8 * (1 - t)), child: child),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: LoadingFactCard(fact: _fact, maxWidth: 360),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
