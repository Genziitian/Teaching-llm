import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme_tokens.dart';

// Apple system colors used on this screen.
const Color _kIndigo = Color(0xFF5856D6);
const Color _kBlue = Color(0xFF007AFF);
const Color _kPink = Color(0xFFFF2D55);
const Color _kRed = Color(0xFFFF3B30);

/// Sign-in surface.
/// - Phone (< 720dp): brand hero on a soft aurora, with the sign-in actions
///   in a rounded bottom sheet.
/// - Tablet / wide (>= 720dp): showcase panel on the left, auth card right.
class LoginPage extends ConsumerWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStateProvider);
    final loading = auth.isLoading;
    final error = auth.error;
    final tokens = context.tokens;
    final isDark = context.isDark;

    void signIn() {
      HapticFeedback.lightImpact();
      ref.read(authStateProvider.notifier).signInWithGoogle();
    }

    return Scaffold(
      backgroundColor: tokens.bg,
      body: Stack(
        children: [
          Positioned.fill(child: _Aurora(isDark: isDark)),
          LayoutBuilder(
            builder: (context, constraints) {
              final isTablet = constraints.maxWidth >= 720;
              if (isTablet) {
                return SafeArea(
                  child: _TabletLoginLayout(
                    isDark: isDark,
                    loading: loading,
                    error: error,
                    tokens: tokens,
                    onSignIn: signIn,
                  ),
                );
              }

              final media = MediaQuery.of(context);
              return SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: ConstrainedBox(
                  constraints:
                      BoxConstraints(minHeight: constraints.maxHeight),
                  child: IntrinsicHeight(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // ── Hero ──
                        Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(
                                top: media.padding.top + 28, bottom: 28),
                            child: Column(
                              children: [
                                _Entrance(
                                  child: _BrandLogo(isDark: isDark),
                                ),
                                const Spacer(),
                                const _Entrance(
                                  delayMs: 80,
                                  dy: 22,
                                  child: _FeatureCarousel(),
                                ),
                                const Spacer(),
                              ],
                            ),
                          ),
                        ),

                        // ── Sheet ──
                        _Entrance(
                          delayMs: 160,
                          dy: 40,
                          child: Container(
                            padding: EdgeInsets.fromLTRB(
                                24, 32, 24, media.padding.bottom + 20),
                            decoration: BoxDecoration(
                              color: tokens.cardBg,
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(36)),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black
                                      .withValues(alpha: isDark ? 0.5 : 0.08),
                                  blurRadius: 40,
                                  offset: const Offset(0, -8),
                                ),
                              ],
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  'Welcome',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: -0.8,
                                    height: 1.1,
                                    color: tokens.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12),
                                  child: Text(
                                    'Log in or create a new account with Google',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 15,
                                      height: 1.4,
                                      fontWeight: FontWeight.w500,
                                      color: tokens.textSecondary,
                                    ),
                                  ),
                                ),
                                if (error != null) ...[
                                  const SizedBox(height: 18),
                                  _ErrorBanner(message: error.toString()),
                                ],
                                const SizedBox(height: 26),
                                _GoogleLoginButton(
                                  loading: loading,
                                  onPressed: signIn,
                                ),
                                const SizedBox(height: 22),
                                const _OrDivider(),
                                const SizedBox(height: 22),
                                const _ExploreButton(),
                                const SizedBox(height: 26),
                                const _LegalFooter(fontSize: 12.5),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

/// Soft, blurred colour glow behind the hero (cheap radial gradients, no
/// backdrop filters).
class _Aurora extends StatelessWidget {
  const _Aurora({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final k = isDark ? 1.35 : 1.0;
    return IgnorePointer(
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          Positioned(
            top: -150,
            left: -130,
            child: _Orb(size: 400, color: _kIndigo, alpha: 0.30 * k),
          ),
          Positioned(
            top: -70,
            right: -150,
            child: _Orb(size: 360, color: _kBlue, alpha: 0.22 * k),
          ),
          Positioned(
            top: 190,
            left: -90,
            child: _Orb(size: 280, color: _kPink, alpha: 0.15 * k),
          ),
        ],
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb({required this.size, required this.color, required this.alpha});
  final double size;
  final Color color;
  final double alpha;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: alpha.clamp(0.0, 1.0)),
              color.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}

/// Three overlapping glossy app-icon tiles (decorative).
class _Feature {
  const _Feature(this.icon, this.title, this.text, this.from, this.to);
  final IconData icon;
  final String title;
  final String text;
  final Color from;
  final Color to;
}

const _features = [
  _Feature(Symbols.video_library_rounded, 'Recorded & live classes',
      'Learn from lectures and join live sessions.', Color(0xFF7D7AFF), _kIndigo),
  _Feature(Symbols.description_rounded, 'Premium notes',
      'Formula sheets and notes, on the app and the web.', Color(0xFF5AC8FA), _kBlue),
  _Feature(Symbols.forum_rounded, 'Community & support',
      'Ask doubts, get help and stay on track.', Color(0xFFFF6482), _kPink),
];

/// Three feature cards that glide on their own, loop forever and can be
/// swiped. Auto-play pauses while touched and is off when the system asks
/// for reduced motion.
class _FeatureCarousel extends StatefulWidget {
  const _FeatureCarousel();

  @override
  State<_FeatureCarousel> createState() => _FeatureCarouselState();
}

class _FeatureCarouselState extends State<_FeatureCarousel> {
  static const _start = 3000; // multiple of 3, so it begins on the first card
  final _controller = PageController(viewportFraction: 0.78, initialPage: _start);
  Timer? _timer;
  int _index = 0;
  bool _reduceMotion = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduceMotion = MediaQuery.of(context).disableAnimations;
    _restart();
  }

  void _restart() {
    _timer?.cancel();
    if (_reduceMotion) return;
    _timer = Timer.periodic(const Duration(milliseconds: 3600), (_) {
      if (!mounted || !_controller.hasClients) return;
      _controller.nextPage(
        duration: const Duration(milliseconds: 650),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 176,
          child: Listener(
            onPointerDown: (_) => _timer?.cancel(),
            onPointerUp: (_) => _restart(),
            onPointerCancel: (_) => _restart(),
            child: PageView.builder(
              controller: _controller,
              onPageChanged: (i) => setState(() => _index = i % _features.length),
              itemBuilder: (context, i) {
                final f = _features[i % _features.length];
                return AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) {
                    final page = _controller.hasClients &&
                            _controller.position.haveDimensions
                        ? (_controller.page ?? _start.toDouble())
                        : _start.toDouble();
                    final d = (page - i).abs().clamp(0.0, 1.0);
                    return Center(
                      child: Opacity(
                        opacity: 1 - 0.4 * d,
                        child: Transform.scale(scale: 1 - 0.08 * d, child: child),
                      ),
                    );
                  },
                  child: _FeatureCard(feature: f),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < _features.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOut,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _index ? 20 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i == _index
                      ? tokens.textPrimary
                      : tokens.textMuted.withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({required this.feature});
  final _Feature feature;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 6),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [feature.from, feature.to],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.28), width: 1),
        boxShadow: [
          BoxShadow(
            color: feature.to.withValues(alpha: 0.3),
            blurRadius: 26,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.24),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(feature.icon,
                color: Colors.white, size: 25, fill: 1, weight: 500),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                feature.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                feature.text,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontSize: 13.5,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Fade + rise on first show. Skipped when the system asks for reduced motion.
class _Entrance extends StatefulWidget {
  const _Entrance({required this.child, this.delayMs = 0, this.dy = 14});

  final Widget child;
  final int delayMs;
  final double dy;

  @override
  State<_Entrance> createState() => _EntranceState();
}

class _EntranceState extends State<_Entrance>
    with SingleTickerProviderStateMixin {
  static const int _baseMs = 460;
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: _baseMs + widget.delayMs),
  );
  late final Animation<double> _a = CurvedAnimation(
    parent: _c,
    curve: Interval(
      widget.delayMs / (_baseMs + widget.delayMs),
      1,
      curve: kEaseOutStrong,
    ),
  );

  @override
  void initState() {
    super.initState();
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return widget.child;
    return AnimatedBuilder(
      animation: _a,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: _a.value,
        child: Transform.translate(
          offset: Offset(0, (1 - _a.value) * widget.dy),
          child: child,
        ),
      ),
    );
  }
}

/// Tablet two-column layout:
/// - Left: Branded showcase with feature highlights
/// - Right: Focused auth card
class _TabletLoginLayout extends StatelessWidget {
  const _TabletLoginLayout({
    required this.isDark,
    required this.loading,
    required this.error,
    required this.tokens,
    required this.onSignIn,
  });

  final bool isDark;
  final bool loading;
  final Object? error;
  final AppThemeTokens tokens;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final subtle = isDark ? const Color(0xFF98989D) : const Color(0xFF6C6C70);
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Row(
        children: [
          // ── Left: Branded Showcase Panel ──
          Expanded(
            flex: 6,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(32),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: isDark
                      ? const [Color(0xFF2A2A5E), Color(0xFF1C1C1E)]
                      : const [Color(0xFFE6E6FB), Color(0xFFF7F0FF)],
                ),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : Colors.white.withValues(alpha: 0.8),
                ),
              ),
              padding: const EdgeInsets.all(40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _BrandLogo(isDark: isDark),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: _kIndigo.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'IITM BS PORTAL',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.1,
                            color:
                                isDark ? const Color(0xFF7D7AFF) : _kIndigo,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(flex: 2),
                  Text(
                    'Upgrade How You Learn.',
                    style: TextStyle(
                      fontSize: 38,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary,
                      letterSpacing: -1.0,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'The all-in-one learning ecosystem built by IITians for BS Degree aspirants.',
                    style: TextStyle(
                      fontSize: 16,
                      color: subtle,
                      height: 1.45,
                    ),
                  ),
                  const Spacer(flex: 2),
                  _ShowcaseFeature(
                    icon: Symbols.school_rounded,
                    iconBg: _kIndigo,
                    title: 'Tailored Curriculum',
                    subtitle:
                        'Structured coursework specifically mapped to your semester syllabus',
                    tokens: tokens,
                    subtle: subtle,
                  ),
                  const SizedBox(height: 18),
                  _ShowcaseFeature(
                    icon: Symbols.video_library_rounded,
                    iconBg: _kBlue,
                    title: 'Live & Recorded Sessions',
                    subtitle:
                        'Interactive live streams, offline study notes, and full PYQ solutions',
                    tokens: tokens,
                    subtle: subtle,
                  ),
                  const SizedBox(height: 18),
                  _ShowcaseFeature(
                    icon: Symbols.forum_rounded,
                    iconBg: _kPink,
                    title: 'Active Community & TAs',
                    subtitle:
                        'Never get stuck with rapid doubt resolution and peer discussion groups',
                    tokens: tokens,
                    subtle: subtle,
                  ),
                  const Spacer(flex: 3),
                  Row(
                    children: [
                      Icon(
                        Symbols.verified_rounded,
                        size: 18,
                        fill: 1,
                        color: isDark ? const Color(0xFF7D7AFF) : _kIndigo,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Trusted by thousands of IITM BS learners nationwide',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: subtle,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(width: 32),

          // ── Right: Auth Card ──
          Expanded(
            flex: 5,
            child: Center(
              child: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: tokens.cardBg,
                      borderRadius: BorderRadius.circular(32),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black
                              .withValues(alpha: isDark ? 0.45 : 0.07),
                          offset: const Offset(0, 16),
                          blurRadius: 40,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Welcome',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w700,
                            color: tokens.textPrimary,
                            letterSpacing: -0.8,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Sign in to access your courses, live classes, and study materials',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14.5,
                            color: tokens.textSecondary,
                            height: 1.45,
                          ),
                        ),
                        const SizedBox(height: 28),
                        if (error != null) ...[
                          _ErrorBanner(message: error.toString()),
                          const SizedBox(height: 20),
                        ],
                        _GoogleLoginButton(
                          loading: loading,
                          onPressed: onSignIn,
                        ),
                        const SizedBox(height: 22),
                        const _OrDivider(),
                        const SizedBox(height: 22),
                        const _ExploreButton(),
                        const SizedBox(height: 28),
                        const _LegalFooter(fontSize: 12),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShowcaseFeature extends StatelessWidget {
  const _ShowcaseFeature({
    required this.icon,
    required this.iconBg,
    required this.title,
    required this.subtitle,
    required this.tokens,
    required this.subtle,
  });

  final IconData icon;
  final Color iconBg;
  final String title;
  final String subtitle;
  final AppThemeTokens tokens;
  final Color subtle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: iconBg,
            borderRadius: BorderRadius.circular(11),
          ),
          child: Icon(icon, color: Colors.white, size: 22, fill: 1, weight: 500),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 15.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                  color: tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(fontSize: 13.5, height: 1.35, color: subtle),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _kRed.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Icon(Symbols.error_rounded, color: _kRed, size: 20, fill: 1),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
                height: 1.3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final line = Container(height: 0.5, color: tokens.border);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        children: [
          Expanded(child: line),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Text(
              'or',
              style: TextStyle(
                fontSize: 13,
                color: tokens.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(child: line),
        ],
      ),
    );
  }
}

/// Tinted secondary action: "Explore Courses".
class _ExploreButton extends StatelessWidget {
  const _ExploreButton();

  @override
  Widget build(BuildContext context) {
    // Darker indigo on the light tint so the label meets contrast guidelines.
    final accent =
        context.isDark ? const Color(0xFFA5A3FF) : const Color(0xFF3634A3);
    return ApplePressable(
      onTap: () {
        HapticFeedback.selectionClick();
        // Do not send the user out to the website. Ask them to sign in
        // first; the router remembers /store and opens it right after login.
        showDialog<void>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            title: const Text('Please log in first'),
            content: const Text(
              'Sign in to your account to browse and buy courses. '
              'As soon as you are in, we will take you straight to the Store.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Not now'),
              ),
              FilledButton(
                onPressed: () {
                  Navigator.of(dialogContext).pop();
                  // Not signed in: the router stores '/store' as the pending
                  // destination and keeps the user on the login screen.
                  context.go('/store');
                },
                child: const Text('Log in'),
              ),
            ],
          ),
        );
      },
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: AppColors.brand.withValues(alpha: context.isDark ? 0.22 : 0.12),
          borderRadius: BorderRadius.circular(16),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Explore Courses',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.2,
                color: accent,
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              Symbols.arrow_forward_ios_rounded,
              size: 13,
              weight: 700,
              color: accent,
            ),
          ],
        ),
      ),
    );
  }
}

class _LegalFooter extends StatelessWidget {
  const _LegalFooter({required this.fontSize});
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final secondary = context.tokens.textSecondary;
    final dot = Text(' · ', style: TextStyle(color: secondary, fontSize: fontSize));
    return Column(
      children: [
        Text(
          'By continuing, you agree to our',
          style: TextStyle(color: secondary, fontSize: fontSize),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _LegalLink(
              label: 'Terms',
              fontSize: fontSize,
              onTap: () => context.push('/terms-and-conditions'),
            ),
            dot,
            _LegalLink(
              label: 'Privacy',
              fontSize: fontSize,
              onTap: () => context.push('/privacy-policy'),
            ),
            dot,
            _LegalLink(
              label: 'Refund',
              fontSize: fontSize,
              onTap: () => context.push('/refund-policy'),
            ),
          ],
        ),
      ],
    );
  }
}

/// Logo component displayed directly on the background.
class _BrandLogo extends StatelessWidget {
  const _BrandLogo({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/mobile-login-logo.png',
      width: 184,
      height: 68,
      fit: BoxFit.contain,
      color: isDark ? Colors.white : null,
      colorBlendMode: isDark ? BlendMode.srcIn : null,
      errorBuilder: (context, error, stackTrace) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Gen',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: isDark ? Colors.white : const Color(0xFF1C1C1E),
                    letterSpacing: -0.5,
                  ),
                ),
                const Text(
                  'Z',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: _kRed,
                    letterSpacing: -0.5,
                  ),
                ),
                Text(
                  '®',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isDark
                        ? const Color(0xFF98989D)
                        : const Color(0xFF6C6C70),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 8, height: 1.5, color: _kRed),
                const SizedBox(width: 6),
                Text(
                  'IITIAN',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 3.5,
                    color: isDark
                        ? const Color(0xFFD1D1D6)
                        : const Color(0xFF3A3A3C),
                  ),
                ),
                const SizedBox(width: 6),
                Container(width: 8, height: 1.5, color: _kRed),
              ],
            ),
          ],
        );
      },
    );
  }
}

/// Primary "Continue with Google" button: solid ink pill (white on dark mode)
/// with the Google mark on a white disc so it stays legible on both.
class _GoogleLoginButton extends StatelessWidget {
  const _GoogleLoginButton({required this.loading, required this.onPressed});

  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final dark = context.isDark;
    final fill = dark ? Colors.white : const Color(0xFF1C1C1E);
    final fg = dark ? const Color(0xFF1C1C1E) : Colors.white;
    return ApplePressable(
      onTap: loading ? null : onPressed,
      child: Container(
        height: 56,
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: dark ? 0.0 : 0.18),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (loading)
              SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.2, color: fg),
              )
            else
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: dark
                      ? null
                      : Border.all(
                          color: Colors.white.withValues(alpha: 0.0)),
                ),
                alignment: Alignment.center,
                child: const _GoogleGlyph(),
              ),
            const SizedBox(width: 12),
            Text(
              loading ? 'Signing in…' : 'Continue with Google',
              style: TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.2,
                color: fg,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Google "G" 4-color brand glyph
class _GoogleGlyph extends StatelessWidget {
  const _GoogleGlyph();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 18,
      height: 18,
      child: CustomPaint(painter: _GooglePainter()),
    );
  }
}

class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    final r = size.width / 2;
    final center = Offset(r, r);

    void arc(Color c, double startDeg, double sweepDeg) {
      paint.color = c;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: r),
        startDeg * 3.14159 / 180,
        sweepDeg * 3.14159 / 180,
        true,
        paint,
      );
    }

    arc(const Color(0xFFEA4335), 142, 110);
    arc(const Color(0xFFFBBC05), -142, 75);
    arc(const Color(0xFF34A853), -22, 90);
    arc(const Color(0xFF4285F4), 68, 70);

    paint.color = Colors.white;
    canvas.drawCircle(center, r * 0.55, paint);

    paint.color = const Color(0xFF4285F4);
    canvas.drawRect(
      Rect.fromLTWH(r, r - 1.4, r - 0.5, 2.8),
      paint,
    );
  }

  @override
  bool shouldRepaint(_) => false;
}

class _LegalLink extends StatelessWidget {
  const _LegalLink({
    required this.label,
    required this.onTap,
    required this.fontSize,
  });
  final String label;
  final VoidCallback onTap;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final accent =
        context.isDark ? const Color(0xFFA5A3FF) : const Color(0xFF3634A3);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      // 44pt-high tap area, as Apple recommends for touch targets.
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              label,
              style: TextStyle(
                color: accent,
                fontWeight: FontWeight.w600,
                fontSize: fontSize,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
