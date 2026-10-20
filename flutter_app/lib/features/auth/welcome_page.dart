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

class _WelcomePageState extends ConsumerState<WelcomePage>
    with SingleTickerProviderStateMixin {
  final _controller = PageController();
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _intro.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _intro.dispose();
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

  Color _accentAt(double p) {
    final last = _slides.length - 1;
    final i = p.floor().clamp(0, last);
    final j = (i + 1).clamp(0, last);
    return Color.lerp(
        _slides[i].accent, _slides[j].accent, (p - i).clamp(0.0, 1.0))!;
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _slides.length - 1;
    final reduce = MediaQuery.of(context).disableAnimations;
    final width = MediaQuery.of(context).size.width;
    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F7),
      body: SafeArea(
        child: AnimatedBuilder(
          animation: Listenable.merge([_controller, _intro]),
          builder: (context, _) {
            final page = _page;
            final accent = _accentAt(page);
            final intro = reduce ? 1.0 : _intro.value;
            return Stack(
              children: [
                // Soft colour wash that follows the swipe (parallax + tint).
                Positioned(
                  top: -90,
                  left: -70 - page * 36,
                  child: _Blob(color: accent.withOpacity(0.20), size: 280),
                ),
                Positioned(
                  bottom: -110,
                  right: -90 + page * 36,
                  child: _Blob(color: accent.withOpacity(0.14), size: 340),
                ),
                Column(
                  children: [
                    _TopBar(onSkip: _finish, showSkip: !isLast),
                    Expanded(
                      child: PageView.builder(
                        controller: _controller,
                        physics: const BouncingScrollPhysics(),
                        itemCount: _slides.length,
                        onPageChanged: (i) {
                          HapticFeedback.selectionClick();
                          setState(() => _index = i);
                        },
                        itemBuilder: (_, i) => _SlideView(
                          slide: _slides[i],
                          delta: i - page,
                          intro: intro,
                          width: width,
                          reduce: reduce,
                        ),
                      ),
                    ),
                    _Dots(count: _slides.length, page: page),
                    const SizedBox(height: 22),
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
            );
          },
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
          AnimatedOpacity(
            duration: const Duration(milliseconds: 220),
            opacity: showSkip ? 1 : 0,
            child: IgnorePointer(
              ignoring: !showSkip,
              child: TextButton(
                onPressed: onSkip,
                child: Text('Skip',
                    style: AppTypography.title.copyWith(
                      fontSize: 13,
                      color: AppColors.muted,
                    )),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({
    required this.slide,
    required this.delta,
    required this.intro,
    required this.width,
    required this.reduce,
  });
  final _Slide slide;
  // Distance from the centred page: 0 = centred, +-1 = one page away.
  final double delta;
  final double intro; // 0..1 first-show entrance
  final double width;
  final bool reduce;

  double _stage(double start) => reduce
      ? 1.0
      : Curves.easeOutCubic.transform(((intro - start) / 0.55).clamp(0.0, 1.0));

  @override
  Widget build(BuildContext context) {
    final d = delta.abs().clamp(0.0, 1.0);
    final focus = 1.0 - d;
    final fade = Curves.easeOut.transform(focus);

    // Layers move at slightly different speeds while swiping (depth).
    double shift(double k) => reduce ? 0 : -delta * width * k;

    Widget layer({
      required double enterStart,
      required double parallax,
      required Widget child,
    }) {
      final st = _stage(enterStart);
      return Opacity(
        opacity: (fade * st).clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(shift(parallax), (1 - st) * 20),
          child: child,
        ),
      );
    }

    final heroIn = _stage(0.0);
    final heroScale = (0.82 + 0.18 * heroIn) * (0.92 + 0.08 * focus);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        children: [
          const Spacer(flex: 2),
          // Hero: soft rings + gradient tile.
          Opacity(
            opacity: (fade * heroIn).clamp(0.0, 1.0),
            child: Transform.translate(
              offset: Offset(shift(0.30), 0),
              child: Transform.scale(
                scale: heroScale,
                child: SizedBox(
                  width: 230,
                  height: 230,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      for (final r in const [
                        [230.0, 0.07],
                        [178.0, 0.10],
                      ])
                        Container(
                          width: r[0],
                          height: r[0],
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: slide.accent.withOpacity(r[1]),
                          ),
                        ),
                      Container(
                        width: 112,
                        height: 112,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(34),
                          gradient: LinearGradient(
                            colors: [
                              slide.accent,
                              slide.accent.withOpacity(0.72)
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: slide.accent.withOpacity(0.32),
                              blurRadius: 28,
                              offset: const Offset(0, 14),
                            ),
                          ],
                        ),
                        child: Icon(slide.icon, color: Colors.white, size: 52),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 30),
          layer(
            enterStart: 0.15,
            parallax: 0.16,
            child: Text(
              slide.eyebrow.toUpperCase(),
              textAlign: TextAlign.center,
              style: AppTypography.uppercase.copyWith(
                color: slide.accent,
                fontSize: 11.5,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 10),
          layer(
            enterStart: 0.25,
            parallax: 0.22,
            child: Text(
              slide.title,
              textAlign: TextAlign.center,
              style: AppTypography.h1.copyWith(
                fontSize: 28,
                height: 1.15,
                letterSpacing: -0.6,
                color: AppColors.ink,
              ),
            ),
          ),
          const SizedBox(height: 14),
          layer(
            enterStart: 0.35,
            parallax: 0.28,
            child: Text(
              slide.quote,
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(
                fontSize: 15,
                height: 1.55,
                color: AppColors.muted,
              ),
            ),
          ),
          const Spacer(flex: 3),
        ],
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
