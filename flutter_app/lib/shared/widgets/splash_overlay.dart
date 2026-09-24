import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/facts/loading_fact_service.dart';
import '../../core/facts/loading_facts_data.dart';
import '../../features/launch/play_store_launch_overlay.dart';
import '../../features/prompts/admin_messages_host.dart';
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
    final launchPending = playStoreLaunchApplies() &&
        !ref.read(playStoreLaunchSeenProvider);
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
          _progress = _progressController?.value ?? 0.0;
        });
      });

    _startSplashSequence();
  }

  Future<void> _startSplashSequence() async {
    _progressController?.forward();

    // Keep the branded loading state visible long enough to avoid a flash.
    await Future<void>.delayed(const Duration(milliseconds: 1500));
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
    final showingLaunch =
        playStoreLaunchApplies() && !ref.watch(playStoreLaunchSeenProvider);

    return Stack(
      children: [
        AdminMessagesHost(
          enabled: !_loaderVisible && !showingLaunch,
          child: widget.child,
        ),
        if (overlayVisible)
          AnimatedOpacity(
            opacity: overlayVisible ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
            child: IgnorePointer(
              ignoring: !overlayVisible,
              child: Material(
                color: Colors.white,
                child: SizedBox.expand(
                  child: SafeArea(
                    child: _buildLogoAndProgress(),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildLogoAndProgress() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // GenZ IITIAN Logo
          Image.asset(
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
          const SizedBox(height: 36),

          // Loading Bar Container
          Container(
            width: 240,
            height: 6,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(999),
            ),
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: _progress.clamp(0.0, 1.0),
              child: Container(
                height: 6,
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
              fontSize: 12,
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          if (_fact != null) ...[
            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: LoadingFactCard(fact: _fact, maxWidth: 360),
            ),
          ],
        ],
      ),
    );
  }
}
