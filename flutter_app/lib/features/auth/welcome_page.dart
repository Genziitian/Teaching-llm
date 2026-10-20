import 'package:flutter/services.dart';
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
    required this.title,
    required this.text,
    required this.asset,
    required this.accent,
    required this.eyebrow,
    this.tagline,
  });
  final String eyebrow;
  final String? tagline;
  final String title;
  final String text;
  final String asset;
  final Color accent;
}

// A three-part story: the problem, the idea, the result. The art carries no
// text; the words below are real text so they stay sharp and editable.
const _slides = <_Slide>[
  _Slide(
    eyebrow: 'Story of every BS degree student',
    title: 'It was everywhere.',
    text:
        'Notes in one place, videos in another, updates in a chat you missed. For a new BS student, finding the right support on time was almost impossible.',
    asset: 'assets/onboarding-story/story-1.webp',
    accent: Color(0xFF5856D6),
  ),
  _Slide(
    eyebrow: 'Chapter 2',
    title: 'So we built it.',
    text:
        'Gen-Z IITian began with one idea: IIT-level learning in one place, for everyone, wherever you are.',
    asset: 'assets/onboarding-story/story-2.webp',
    accent: Color(0xFFFF9F0A),
  ),
  _Slide(
    eyebrow: 'Chapter 3',
    title: 'So here we are.',
    text: '',
    asset: 'assets/onboarding-story/story-3.webp',
    accent: Color(0xFF34C759),
    tagline:
        'Learn from seniors who have been through it. Learn from experience. Learn from us.',
  ),
];

class _WelcomePageState extends ConsumerState<WelcomePage> {
  final _controller = PageController();
  int _index = 0;
  bool _precached = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_precached) return;
    _precached = true;
    for (final s in _slides) {
      precacheImage(AssetImage(s.asset), context);
    }
  }

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
      _controller.animateToPage(
        _index + 1,
        duration: const Duration(milliseconds: 460),
        curve: Curves.easeOutQuart,
      );
    } else {
      HapticFeedback.mediumImpact();
      _finish();
    }
  }

  double get _page {
    if (_controller.hasClients && _controller.position.haveDimensions) {
      return _controller.page ?? _index.toDouble();
    }
    return _index.toDouble();
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _slides.length - 1;
    final reduce = MediaQuery.of(context).disableAnimations;
    final media = MediaQuery.of(context);
    final width = media.size.width;
    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F7),
      body: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final page = _page;
          return Stack(
            children: [
              // Full-page illustrations, swipeable, with a light parallax.
              Positioned.fill(
                child: PageView.builder(
                  controller: _controller,
                  physics: const BouncingScrollPhysics(),
                  itemCount: _slides.length,
                  onPageChanged: (i) {
                    HapticFeedback.selectionClick();
                    setState(() => _index = i);
                  },
                  itemBuilder: (_, i) {
                    final delta = i - page;
                    return ClipRect(
                      child: Transform.translate(
                        offset: Offset(reduce ? 0 : -delta * width * 0.18, 0),
                        child: Image.asset(
                          _slides[i].asset,
                          fit: BoxFit.cover,
                          alignment: Alignment.topCenter,
                          gaplessPlayback: true,
                        ),
                      ),
                    );
                  },
                ),
              ),

              // Top bar on a frosted pill so it reads on any artwork.
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  bottom: false,
                  child: _TopBar(onSkip: _finish, showSkip: !isLast),
                ),
              ),

              // Floating story card: label, words, button.
              Positioned(
                left: 14,
                right: 14,
                bottom: media.padding.bottom + 14,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(22, 20, 22, 16),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.94),
                    borderRadius: BorderRadius.circular(32),
                    border: Border.all(
                        color: Colors.white.withOpacity(0.9), width: 1),
                    boxShadow: [
                      BoxShadow(
                        color: _slides[_index].accent.withOpacity(0.22),
                        blurRadius: 36,
                        offset: const Offset(0, 14),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 320),
                        switchInCurve: Curves.easeOutCubic,
                        transitionBuilder: (child, anim) => FadeTransition(
                          opacity: anim,
                          child: SlideTransition(
                            position: Tween<Offset>(
                              begin: const Offset(0, 0.06),
                              end: Offset.zero,
                            ).animate(anim),
                            child: child,
                          ),
                        ),
                        child: SizedBox(
                          key: ValueKey(_index),
                          width: double.infinity,
                          // Fixed height so the card does not jump between slides.
                          height: 150,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 18,
                                    height: 2,
                                    color: _slides[_index].accent,
                                  ),
                                  const SizedBox(width: 8),
                                  Flexible(
                                    child: Text(
                                      _slides[_index].eyebrow.toUpperCase(),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTypography.title.copyWith(
                                        fontSize: 10.5,
                                        letterSpacing: 1.5,
                                        fontWeight: FontWeight.w800,
                                        color: _slides[_index].accent,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _slides[_index].title,
                                style: const TextStyle(
                                  fontFamily: 'serif',
                                  fontFamilyFallback: ['Georgia', 'Times New Roman'],
                                  fontSize: 26,
                                  height: 1.1,
                                  fontWeight: FontWeight.w700,
                                  fontStyle: FontStyle.italic,
                                  letterSpacing: -0.3,
                                  color: AppColors.ink,
                                ),
                              ),
                              if (_slides[_index].text.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  _slides[_index].text,
                                  maxLines: 4,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.body.copyWith(
                                    fontSize: 13,
                                    height: 1.5,
                                    color: AppColors.muted,
                                  ),
                                ),
                              ],
                              if (_slides[_index].tagline != null) ...[
                                const SizedBox(height: 8),
                                Text(
                                  _slides[_index].tagline!,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.title.copyWith(
                                    fontSize: 13,
                                    height: 1.4,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.brand,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      _PrimaryButton(
                        label: isLast ? 'Get Started' : 'Next',
                        icon: isLast ? Icons.arrow_forward : Icons.chevron_right,
                        onPressed: _next,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
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
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
      child: SizedBox(
        height: 38,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Plain brand name, top-left corner.
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Gen-Z IITian',
                style: AppTypography.title.copyWith(
                  fontSize: 17,
                  letterSpacing: -0.3,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                  shadows: [
                    Shadow(
                      color: Colors.white.withOpacity(0.7),
                      blurRadius: 10,
                    ),
                  ],
                ),
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 220),
                opacity: showSkip ? 1 : 0,
                child: IgnorePointer(
                  ignoring: !showSkip,
                  child: GestureDetector(
                    onTap: onSkip,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 9),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.82),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Text('Skip',
                          style: AppTypography.title.copyWith(
                            fontSize: 13,
                            color: AppColors.ink,
                          )),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.page});
  final int count;
  final double page; // continuous page position
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final t = (1 - (page - i).abs()).clamp(0.0, 1.0);
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: 7 + 15 * t,
          height: 7,
          decoration: BoxDecoration(
            color: Color.lerp(AppColors.line2, AppColors.brand, t),
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
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              child: Text(label,
                  key: ValueKey(label),
                  style: AppTypography.title.copyWith(
                    fontSize: 15,
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  )),
            ),
            const SizedBox(width: 8),
            Icon(icon, color: Colors.white, size: 18),
          ],
        ),
      ),
    );
  }
}
