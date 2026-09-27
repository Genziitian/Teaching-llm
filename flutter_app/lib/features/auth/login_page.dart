import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme_tokens.dart';
import '../../theme/app_typography.dart';

/// Clean, minimal, premium sign-in surface.
/// Responsive:
/// - Tablet / Wide screen (>= 720dp): Split two-panel layout with branded
///   showcase on the left and elevated auth card on the right (matches Capacitor web app).
/// - Phone (< 720dp): Single column focused mobile layout.
class LoginPage extends ConsumerWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStateProvider);
    final loading = auth.isLoading;
    final error = auth.error;
    final tokens = context.tokens;
    final isDark = context.isDark;

    final bgColor = tokens.bg;
    final textPrimary = tokens.textPrimary;
    final textSecondary = tokens.textSecondary;
    final borderColor = tokens.border;
    final btnBg = tokens.cardBg;

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isTablet = constraints.maxWidth >= 720;

            if (isTablet) {
              return _TabletLoginLayout(
                isDark: isDark,
                loading: loading,
                error: error,
                tokens: tokens,
                textPrimary: textPrimary,
                textSecondary: textSecondary,
                borderColor: borderColor,
                btnBg: btnBg,
                ref: ref,
              );
            }

            // Phone layout
            return SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 480),
                    child: IntrinsicHeight(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: 24),

                            // 1. Brand Logo
                            Center(
                              child: _BrandLogo(isDark: isDark),
                            ),

                            const Spacer(flex: 2),

                            // 2. Main Content
                            Text(
                              'Welcome Back!',
                              textAlign: TextAlign.center,
                              style: AppTypography.h1.copyWith(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: textPrimary,
                                letterSpacing: -0.4,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                'Log in or create a new account with Google',
                                textAlign: TextAlign.center,
                                style: AppTypography.body.copyWith(
                                  fontSize: 13.5,
                                  color: textSecondary,
                                  height: 1.4,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),

                            if (error != null) ...[
                              const SizedBox(height: 16),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 12),
                                decoration: BoxDecoration(
                                  color: isDark
                                      ? const Color(0x33EF4444)
                                      : const Color(0xFFFEE2E2),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isDark
                                        ? const Color(0x66EF4444)
                                        : const Color(0xFFFCA5A5),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.error_outline,
                                        color: Color(0xFFDC2626), size: 18),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        error.toString(),
                                        style: AppTypography.body.copyWith(
                                          color: const Color(0xFFDC2626),
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            const SizedBox(height: 24),

                            // 3. Google Login Button
                            _GoogleLoginButton(
                              loading: loading,
                              backgroundColor: btnBg,
                              borderColor: borderColor,
                              textColor: textPrimary,
                              onPressed: () {
                                HapticFeedback.lightImpact();
                                ref
                                    .read(authStateProvider.notifier)
                                    .signInWithGoogle();
                              },
                            ),

                            const Spacer(flex: 2),

                            // 4. Divider
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 32),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Divider(
                                      color: borderColor,
                                      thickness: 1,
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 14),
                                    child: Text(
                                      'or',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: textSecondary,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    child: Divider(
                                      color: borderColor,
                                      thickness: 1,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(height: 16),

                            // 5. Explore Courses Action
                            Center(
                              child: BouncyPressable(
                                onTap: () {
                                  HapticFeedback.selectionClick();
                                  context.go('/courses');
                                },
                                scaleDown: 0.96,
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 6),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'Explore Courses',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.brand,
                                          fontFamily: 'Manrope',
                                        ),
                                      ),
                                      SizedBox(width: 6),
                                      Icon(
                                        Icons.arrow_forward_rounded,
                                        size: 16,
                                        color: AppColors.brand,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),

                            const Spacer(flex: 1),

                            // 6. Bottom Legal Section
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Column(
                                children: [
                                  Text(
                                    'By continuing, you agree to our',
                                    style: TextStyle(
                                      color: textSecondary,
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      _LegalLink(
                                        label: 'Terms',
                                        onTap: () =>
                                            context.push('/terms-and-conditions'),
                                      ),
                                      Text(
                                        ' · ',
                                        style: TextStyle(
                                          color: textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                      _LegalLink(
                                        label: 'Privacy',
                                        onTap: () =>
                                            context.push('/privacy-policy'),
                                      ),
                                      Text(
                                        ' · ',
                                        style: TextStyle(
                                          color: textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                      _LegalLink(
                                        label: 'Refund',
                                        onTap: () =>
                                            context.push('/refund-policy'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
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
    required this.textPrimary,
    required this.textSecondary,
    required this.borderColor,
    required this.btnBg,
    required this.ref,
  });

  final bool isDark;
  final bool loading;
  final Object? error;
  final AppThemeTokens tokens;
  final Color textPrimary;
  final Color textSecondary;
  final Color borderColor;
  final Color btnBg;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Row(
        children: [
          // ── Left: Branded Showcase Panel ──
          Expanded(
            flex: 6,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: isDark
                      ? const [
                          Color(0xFF1E1B4B),
                          Color(0xFF0F172A),
                          Color(0xFF13182C),
                        ]
                      : const [
                          Color(0xFFEEF2FF),
                          Color(0xFFF5F3FF),
                          Color(0xFFFAF5FF),
                        ],
                ),
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF312E81).withOpacity(0.5)
                      : const Color(0xFFE0E7FF),
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0A000000),
                    offset: Offset(0, 8),
                    blurRadius: 24,
                  ),
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 36),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Logo + Badge
                  Row(
                    children: [
                      _BrandLogo(isDark: isDark),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF6366F1).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: const Color(0xFF6366F1).withOpacity(0.3),
                          ),
                        ),
                        child: const Text(
                          'IITM BS PORTAL',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.1,
                            color: Color(0xFF6366F1),
                            fontFamily: 'Manrope',
                          ),
                        ),
                      ),
                    ],
                  ),

                  const Spacer(flex: 2),

                  // Headline
                  Text(
                    'Upgrade How You Learn.',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      color: isDark ? Colors.white : const Color(0xFF0F172A),
                      letterSpacing: -0.8,
                      height: 1.15,
                      fontFamily: 'Manrope',
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'The all-in-one learning ecosystem built by IITians for BS Degree aspirants.',
                    style: TextStyle(
                      fontSize: 14.5,
                      color: isDark
                          ? const Color(0xFF94A3B8)
                          : const Color(0xFF475569),
                      height: 1.45,
                      fontFamily: 'Manrope',
                    ),
                  ),

                  const Spacer(flex: 2),

                  // Feature Cards
                  _ShowcaseFeature(
                    icon: Icons.school_rounded,
                    iconBg: const Color(0xFF6366F1),
                    title: 'Tailored Curriculum',
                    subtitle:
                        'Structured coursework specifically mapped to your semester syllabus',
                    isDark: isDark,
                  ),
                  const SizedBox(height: 14),
                  _ShowcaseFeature(
                    icon: Icons.video_library_rounded,
                    iconBg: const Color(0xFF8B5CF6),
                    title: 'Live & Recorded Sessions',
                    subtitle:
                        'Interactive live streams, offline study notes, and full PYQ solutions',
                    isDark: isDark,
                  ),
                  const SizedBox(height: 14),
                  _ShowcaseFeature(
                    icon: Icons.forum_rounded,
                    iconBg: const Color(0xFFEC4899),
                    title: 'Active Community & TAs',
                    subtitle:
                        'Never get stuck with rapid doubt resolution and peer discussion groups',
                    isDark: isDark,
                  ),

                  const Spacer(flex: 3),

                  // Footer trust note
                  Row(
                    children: [
                      Icon(
                        Icons.verified_rounded,
                        size: 16,
                        color: isDark
                            ? const Color(0xFF818CF8)
                            : const Color(0xFF4F46E5),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Trusted by thousands of IITM BS learners nationwide',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isDark
                              ? const Color(0xFF94A3B8)
                              : const Color(0xFF64748B),
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
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: tokens.cardBg,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: borderColor),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x0E000000),
                        offset: Offset(0, 12),
                        blurRadius: 32,
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Welcome Back!',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: textPrimary,
                          letterSpacing: -0.4,
                          fontFamily: 'Manrope',
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Sign in to access your courses, live classes, and study materials',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          color: textSecondary,
                          height: 1.45,
                          fontFamily: 'Manrope',
                        ),
                      ),
                      const SizedBox(height: 28),

                      if (error != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: isDark
                                ? const Color(0x33EF4444)
                                : const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isDark
                                  ? const Color(0x66EF4444)
                                  : const Color(0xFFFCA5A5),
                            ),
                          ),
                          child: Text(
                            error.toString(),
                            style: const TextStyle(
                              color: Color(0xFFDC2626),
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // Google Sign In button
                      _GoogleLoginButton(
                        loading: loading,
                        backgroundColor: btnBg,
                        borderColor: borderColor,
                        textColor: textPrimary,
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          ref
                              .read(authStateProvider.notifier)
                              .signInWithGoogle();
                        },
                      ),

                      const SizedBox(height: 24),

                      // Divider
                      Row(
                        children: [
                          Expanded(
                              child: Divider(color: borderColor, thickness: 1)),
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 14),
                            child: Text(
                              'or',
                              style: TextStyle(
                                fontSize: 13,
                                color: textSecondary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          Expanded(
                              child: Divider(color: borderColor, thickness: 1)),
                        ],
                      ),

                      const SizedBox(height: 20),

                      // Explore Courses Button
                      Center(
                        child: BouncyPressable(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            context.go('/courses');
                          },
                          scaleDown: 0.96,
                          child: const Padding(
                            padding: EdgeInsets.symmetric(
                                horizontal: 16, vertical: 6),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Explore Courses',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.brand,
                                    fontFamily: 'Manrope',
                                  ),
                                ),
                                SizedBox(width: 6),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  size: 16,
                                  color: AppColors.brand,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 28),

                      // Legal Links
                      Column(
                        children: [
                          Text(
                            'By continuing, you agree to our',
                            style: TextStyle(
                              color: textSecondary,
                              fontSize: 11.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _LegalLink(
                                label: 'Terms',
                                onTap: () =>
                                    context.push('/terms-and-conditions'),
                              ),
                              Text(' · ',
                                  style: TextStyle(
                                      color: textSecondary, fontSize: 11.5)),
                              _LegalLink(
                                label: 'Privacy',
                                onTap: () => context.push('/privacy-policy'),
                              ),
                              Text(' · ',
                                  style: TextStyle(
                                      color: textSecondary, fontSize: 11.5)),
                              _LegalLink(
                                label: 'Refund',
                                onTap: () => context.push('/refund-policy'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
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
    required this.isDark,
  });

  final IconData icon;
  final Color iconBg;
  final String title;
  final String subtitle;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: iconBg.withOpacity(0.18),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: iconBg, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : const Color(0xFF0F172A),
                  fontFamily: 'Manrope',
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.35,
                  color: isDark
                      ? const Color(0xFF94A3B8)
                      : const Color(0xFF64748B),
                  fontFamily: 'Manrope',
                ),
              ),
            ],
          ),
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
      width: 140,
      height: 52,
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
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                    letterSpacing: -0.5,
                    fontFamily: 'Manrope',
                  ),
                ),
                const Text(
                  'Z',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFEF4444),
                    letterSpacing: -0.5,
                    fontFamily: 'Manrope',
                  ),
                ),
                Text(
                  '®',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isDark
                        ? const Color(0xFF94A3B8)
                        : const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                    width: 8, height: 1.5, color: const Color(0xFFEF4444)),
                const SizedBox(width: 6),
                Text(
                  'IITIAN',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 3.5,
                    color: isDark
                        ? const Color(0xFFCBD5E1)
                        : const Color(0xFF1E293B),
                    fontFamily: 'Manrope',
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                    width: 8, height: 1.5, color: const Color(0xFFEF4444)),
              ],
            ),
          ],
        );
      },
    );
  }
}

/// Normal, premium Google login authentication button.
/// 12px border radius, subtle border, no shadows or glows.
class _GoogleLoginButton extends StatelessWidget {
  const _GoogleLoginButton({
    required this.loading,
    required this.backgroundColor,
    required this.borderColor,
    required this.textColor,
    required this.onPressed,
  });

  final bool loading;
  final Color backgroundColor;
  final Color borderColor;
  final Color textColor;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return BouncyPressable(
      onTap: loading ? null : onPressed,
      scaleDown: 0.98,
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor, width: 1),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (loading)
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  color: textColor,
                ),
              )
            else
              const _GoogleGlyph(),
            const SizedBox(width: 12),
            Text(
              loading ? 'Signing in…' : 'Continue with Google',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: textColor,
                fontFamily: 'Manrope',
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
  const _LegalLink({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.brand,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}
