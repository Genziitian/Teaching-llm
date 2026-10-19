import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../shared/widgets/bouncy_pressable.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_typography.dart';

/// Whether the user has finished (or skipped) the welcome carousel. Mutated
/// from [WelcomePage.markSeen]; read by the router redirect so unauthenticated
/// first-launch users land on /welcome instead of /login. Defaulted via
/// override in `main.dart` after we eagerly read SharedPreferences.
final welcomeSeenProvider = StateProvider<bool>((_) => false);

// Persisted once the user finishes (or skips) the 3-slide welcome. Subsequent
// launches land directly on /login. Lines up 1:1 with the Capacitor app's
// `genz_mobile_onboarded` flag so a user who used the web/Capacitor build
// before doesn't see onboarding again on the Flutter install (and vice versa
// once we surface a cross-platform sync layer).
const _kWelcomeSeenKey = 'genz_mobile_onboarded';

/// Three-slide onboarding (Built for IITM BS → Live + Recorded → Qualify Excel
/// Graduate), modelled after `MobileLoginExperience` in the web/Capacitor
/// build. Shown only on the first launch; pushes /login on completion.
class WelcomePage extends ConsumerStatefulWidget {
  const WelcomePage({super.key});

  /// Read once at app start to decide whether to land at /welcome or /login.
  static Future<bool> hasBeenSeen() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_kWelcomeSeenKey) ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> markSeen() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_kWelcomeSeenKey, true);
    } catch (_) {}
  }

  @override
  ConsumerState<WelcomePage> createState() => _WelcomePageState();
}

class _Slide {
  const _Slide({
    required this.eyebrow,
    required this.title,
    required this.quote,
    required this.accent,
    required this.icon,
  });
  final String eyebrow;
  final String title;
  final String quote;
  final Color accent;
  final IconData icon;
}

const _slides = <_Slide>[
  _Slide(
    eyebrow: 'Built for IITM BS',
    title: 'Made for BS Degree Aspirants',
    quote:
        '"By IITians who know your syllabus, your pace, and the exam pressure — because we have been through it ourselves."',
    accent: Color(0xFF5856D6),
    icon: Icons.school_outlined,
  ),
  _Slide(
    eyebrow: 'Live + Recorded',
    title: 'Master Every Topic, Your Way',
    quote:
        '"Structured live classes, on-demand recordings, premium notes, and PYQs — with doubt support that never sleeps."',
    accent: Color(0xFF0EA5E9),
    icon: Icons.live_tv_outlined,
  ),
  _Slide(
    eyebrow: 'Qualify · Excel · Graduate',
    title: 'Your Complete BS Companion',
    quote:
        '"From Qualifier prep to Term-wise live batches — one focused platform from your first attempt to your final degree."',
    accent: Color(0xFF34C759),
    icon: Icons.workspace_premium_outlined,
  ),
];

class _WelcomePageState extends ConsumerState<WelcomePage> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await WelcomePage.markSeen();
    if (!mounted) return;
    // Flip the provider so the router redirect stops sending us back here.
    ProviderScope.containerOf(context).read(welcomeSeenProvider.notifier).state = true;
    context.go('/login');
  }

  void _next() {
    if (_index < _slides.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
      );
    } else {
      _finish();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _slides.length - 1;
    return Scaffold(
      backgroundColor: const Color(0xFFE8EAF0),
      body: SafeArea(
        child: Stack(
          children: [
            // Decorative blurred blobs — matches the web onboarding aesthetic.
            Positioned(
              top: -80,
              left: -60,
              child: _Blob(color: const Color(0xFF5856D6).withOpacity(0.18), size: 260),
            ),
            Positioned(
              bottom: -100,
              right: -80,
              child: _Blob(color: const Color(0xFF6E6CF0).withOpacity(0.14), size: 320),
            ),

            Column(
              children: [
                _TopBar(onSkip: _finish, showSkip: !isLast),
                Expanded(
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: _slides.length,
                    onPageChanged: (i) => setState(() => _index = i),
                    itemBuilder: (_, i) => _SlideView(slide: _slides[i]),
                  ),
                ),
                _Dots(count: _slides.length, active: _index),
                const SizedBox(height: 18),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  child: _PrimaryButton(
                    label: isLast ? 'Get Started' : 'Next',
                    icon: isLast ? Icons.arrow_forward : Icons.chevron_right,
                    onPressed: _next,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onSkip, required this.showSkip});
  final VoidCallback onSkip;
  final bool showSkip;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 18, 24, 0),
      child: Row(
        children: [
          // Brand mark
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [AppColors.brand, AppColors.brandDk],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: AppShadows.pillGlow(AppColors.brand),
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.school, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          Text('Gen-Z IITian',
              style: AppTypography.title.copyWith(
                fontSize: 15,
                color: AppColors.ink,
              )),
          const Spacer(),
          if (showSkip)
            TextButton(
              onPressed: onSkip,
              child: Text('Skip',
                  style: AppTypography.title.copyWith(
                    fontSize: 13,
                    color: AppColors.muted,
                  )),
            ),
        ],
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});
  final _Slide slide;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Spacer(flex: 2),
          // Icon tile
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(26),
              gradient: LinearGradient(
                colors: [slide.accent, slide.accent.withOpacity(0.7)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: slide.accent.withOpacity(0.35),
                  blurRadius: 24,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Icon(slide.icon, color: Colors.white, size: 38),
          ),
          const SizedBox(height: 28),
          Text(
            slide.eyebrow.toUpperCase(),
            style: AppTypography.uppercase.copyWith(
              color: slide.accent,
              fontSize: 11.5,
              letterSpacing: 1.4,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            slide.title,
            style: AppTypography.h1.copyWith(
              fontSize: 26,
              height: 1.18,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            slide.quote,
            style: AppTypography.body.copyWith(
              fontSize: 14.5,
              height: 1.55,
              color: AppColors.muted,
            ),
          ),
          const Spacer(flex: 3),
        ],
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.active});
  final int count;
  final int active;
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final on = i == active;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: on ? 22 : 7,
          height: 7,
          decoration: BoxDecoration(
            color: on ? AppColors.brand : AppColors.line2,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });
  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) {
    return BouncyPressable(
      onTap: onPressed,
      scaleDown: 0.97,
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          color: AppColors.ink,
          borderRadius: BorderRadius.circular(50),
          boxShadow: AppShadows.pillGlow(AppColors.ink),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label,
                style: AppTypography.title.copyWith(
                  fontSize: 15,
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                )),
            const SizedBox(width: 8),
            Icon(icon, color: Colors.white, size: 18),
          ],
        ),
      ),
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({required this.color, required this.size});
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [color, color.withOpacity(0)],
            stops: const [0.0, 0.7],
          ),
        ),
      ),
    );
  }
}
