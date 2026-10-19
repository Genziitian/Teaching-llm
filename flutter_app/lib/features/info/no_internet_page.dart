import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../features/dashboard/dashboard_providers.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';

/// Full-fidelity Offline & No Internet screen — matching public/offline.html.
class NoInternetPage extends ConsumerStatefulWidget {
  const NoInternetPage({super.key, this.onRetry});

  final Future<void> Function()? onRetry;

  @override
  ConsumerState<NoInternetPage> createState() => _NoInternetPageState();
}

class _NoInternetPageState extends ConsumerState<NoInternetPage>
    with SingleTickerProviderStateMixin {
  bool _retrying = false;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.85, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _handleRetry() async {
    setState(() => _retrying = true);
    HapticFeedback.lightImpact();

    try {
      if (widget.onRetry != null) {
        await widget.onRetry!();
      } else {
        ref.invalidate(dashboardProvider);
        await Future<void>.delayed(const Duration(milliseconds: 800));
      }

      if (mounted) {
        if (context.canPop()) {
          context.pop();
        } else {
          final isSignedIn = ref.read(authStateProvider).value != null;
          context.go(isSignedIn ? '/dashboard' : '/login');
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Still offline. Please check your network connection.'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _retrying = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = context.isDark;

    return Scaffold(
      backgroundColor: tokens.bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 380),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
              decoration: BoxDecoration(
                color: tokens.cardBg,
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: tokens.border),
                boxShadow: AppShadows.md,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Animated Pulsing Wifi-Off Icon
                  AnimatedBuilder(
                    animation: _pulseAnimation,
                    builder: (context, child) {
                      return Stack(
                        alignment: Alignment.center,
                        children: [
                          Container(
                            width: 88 * _pulseAnimation.value,
                            height: 88 * _pulseAnimation.value,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isDark
                                  ? const Color(0x335856D6)
                                  : const Color(0x1F5856D6),
                            ),
                          ),
                          Container(
                            width: 76,
                            height: 76,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isDark
                                  ? const Color(0xFF1E1B4B)
                                  : const Color(0xFFEEF2FF),
                              border: Border.all(
                                color: const Color(0xFF5856D6),
                                width: 1.5,
                              ),
                            ),
                            child: const Icon(
                              Icons.wifi_off_rounded,
                              size: 36,
                              color: Color(0xFF5856D6),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 28),

                  // Title
                  Text(
                    "You're Offline",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Subtitle
                  Text(
                    "Please check your internet connection and try again. You can still access your downloaded courses and offline study materials.",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.5,
                      color: tokens.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Primary Retry Button
                  BouncyPressable(
                    onTap: _retrying ? null : _handleRetry,
                    child: Container(
                      height: 50,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: const Color(0xFF5856D6),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x3D5856D6),
                            blurRadius: 12,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: _retrying
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                color: Colors.white,
                              ),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.refresh_rounded,
                                  size: 18,
                                  color: Colors.white,
                                ),
                                SizedBox(width: 8),
                                Text(
                                  'Try Again',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Secondary Button: Continue to Cached Dashboard / Courses
                  BouncyPressable(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      final isSignedIn =
                          ref.read(authStateProvider).value != null;
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go(isSignedIn ? '/dashboard' : '/login');
                      }
                    },
                    child: Container(
                      height: 48,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: tokens.border),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Continue in Offline Mode',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: tokens.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Waiting status indicator with pulsing red dot
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFFFF3B30),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Waiting for network…',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          color: tokens.textMuted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
