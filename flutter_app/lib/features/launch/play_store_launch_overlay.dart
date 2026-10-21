import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_typography.dart';

/// True after this phone has tapped Enter on the Play Store welcome.
/// Read only by the Android Flutter app.
final playStoreLaunchSeenProvider = StateProvider<bool>((_) => false);

/// The public Play Store build is Android. Web, desktop, and the other
/// apps never show this screen.
bool playStoreLaunchApplies() {
  if (kIsWeb) return false;
  return defaultTargetPlatform == TargetPlatform.android;
}

/// Has this account already seen the welcome? Asked once per signed-in user.
/// If the server cannot be reached we say "seen" so nobody is nagged.
final playStoreWelcomeServerSeenProvider =
    FutureProvider.autoDispose.family<bool, String>((ref, userId) async {
  try {
    final res = await ref
        .watch(apiClientProvider)
        .get<dynamic>('/api/user/play-welcome');
    final d = res.data;
    return d is Map && d['seen'] == true;
  } catch (_) {
    return true;
  }
});

/// True only while the welcome should be on screen: Android, signed in, not
/// seen on this phone, and not seen by this account on any phone.
final playStoreWelcomePendingProvider = Provider<bool>((ref) {
  // "Welcome to the new app" screen is switched off for everyone.
  const welcomeEnabled = false;
  if (!welcomeEnabled) return false;
  if (!playStoreLaunchApplies()) return false;
  if (ref.watch(playStoreLaunchSeenProvider)) return false;
  final user = ref.watch(authStateProvider).value;
  if (user == null) return false;
  final seen = ref.watch(playStoreWelcomeServerSeenProvider(user.id));
  return seen.maybeWhen(data: (v) => !v, orElse: () => false);
});

const _kSeenKey = 'genz_flutter_playstore_launch_seen';

/// One-time full-screen welcome for the first public Play Store release.
/// Shown once per install, then never again.
class PlayStoreLaunch {
  PlayStoreLaunch._();

  static Future<bool> hasBeenSeen() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_kSeenKey) ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> markSeen() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_kSeenKey, true);
    } catch (_) {}
  }
}

/// First screen of the Android app, before login and before the home page.
/// Login state is ignored. Enter dismisses it for the rest of this install.
class PlayStoreLaunchOverlay extends ConsumerStatefulWidget {
  const PlayStoreLaunchOverlay({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<PlayStoreLaunchOverlay> createState() =>
      _PlayStoreLaunchOverlayState();
}

class _PlayStoreLaunchOverlayState extends ConsumerState<PlayStoreLaunchOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fade = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
    value: 1,
  );
  bool _busy = false;
  bool _synced = false;

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  void _saveSeenOnAccount() {
    unawaited(() async {
      try {
        await ref.read(apiClientProvider).post<dynamic>('/api/user/play-welcome');
      } catch (_) {}
    }());
  }

  Future<void> _enter() async {
    if (_busy) return;
    _busy = true;
    HapticFeedback.mediumImpact();
    await PlayStoreLaunch.markSeen();
    _saveSeenOnAccount();
    if (!mounted) return;
    await _fade.reverse();
    if (!mounted) return;
    ref.read(playStoreLaunchSeenProvider.notifier).state = true;
    _busy = false;
    _fade.value = 1;
  }

  @override
  Widget build(BuildContext context) {
    if (!playStoreLaunchApplies()) return widget.child;

    // Tapped Enter on this phone before signing in: remember it on the
    // account once, so a reinstall never shows it again.
    final signedIn = ref.watch(authStateProvider).value != null;
    if (signedIn && ref.watch(playStoreLaunchSeenProvider) && !_synced) {
      _synced = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _saveSeenOnAccount();
      });
    }

    final pending = ref.watch(playStoreWelcomePendingProvider);
    if (!pending) return widget.child;

    return Stack(
      children: [
        widget.child,
        FadeTransition(
          opacity: _fade,
          child: _CelebrationScreen(onEnter: _enter),
        ),
      ],
    );
  }
}

class _CelebrationScreen extends StatefulWidget {
  const _CelebrationScreen({required this.onEnter});

  final VoidCallback onEnter;

  @override
  State<_CelebrationScreen> createState() => _CelebrationScreenState();
}

class _CelebrationScreenState extends State<_CelebrationScreen>
    with SingleTickerProviderStateMixin {
  static const _indigo = Color(0xFF5E5CE6);

  late final AnimationController _in = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );
  bool _partyFading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (MediaQuery.of(context).disableAnimations) {
        _in.value = 1;
      } else {
        _in.forward();
      }
    });
    // The celebration is a short burst, not a loop.
    Future.delayed(const Duration(milliseconds: 2600), () {
      if (mounted) setState(() => _partyFading = true);
    });
  }

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  /// Staggered fade + rise; [start] is when (0..0.6 of the intro) it begins.
  Widget _rise(double start, Widget child) {
    final curve = Interval(start, math.min(start + 0.4, 1.0));
    return AnimatedBuilder(
      animation: _in,
      child: child,
      builder: (context, child) {
        final v = Curves.easeOutCubic.transform(curve.transform(_in.value));
        return Opacity(
          opacity: v,
          child: Transform.translate(offset: Offset(0, (1 - v) * 16), child: child),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Material(
        color: const Color(0xFFF7F6FB),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFFFFF4F7), Color(0xFFF7F6FB), Color(0xFFF1EEFF)],
            ),
          ),
          child: Stack(
            children: [
              const Positioned(
                top: -110,
                left: -80,
                child: _Glow(color: Color(0xFFFF8FAB), size: 280),
              ),
              const Positioned(
                bottom: -60,
                right: -70,
                child: _Glow(color: Color(0xFFB4A9FF), size: 300),
              ),
              if (!reduce)
                Positioned.fill(
                  child: AnimatedOpacity(
                    opacity: _partyFading ? 0 : 1,
                    duration: const Duration(milliseconds: 900),
                    child: const _PartyField(),
                  ),
                ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: Column(
                        children: [
                          Expanded(
                            child: LayoutBuilder(
                              builder: (context, constraints) {
                                return SingleChildScrollView(
                                  physics: const BouncingScrollPhysics(),
                                  child: ConstrainedBox(
                                    constraints: BoxConstraints(
                                      minHeight: constraints.maxHeight,
                                    ),
                                    child: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        _rise(
                                          0.00,
                                          Image.asset(
                                            'assets/mobile-login-logo.png',
                                            height: 64,
                                            fit: BoxFit.contain,
                                          ),
                                        ),
                                        const SizedBox(height: 18),
                                        _rise(0.08, const _Eyebrow()),
                                        const SizedBox(height: 20),
                                        _rise(0.16, const _Headline()),
                                        const SizedBox(height: 12),
                                        _rise(0.24, const _Thanks()),
                                        const SizedBox(height: 24),
                                        _rise(0.34, const _NoteCard()),
                                        const SizedBox(height: 20),
                                        _rise(0.44, const _SignOff()),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                          const SizedBox(height: 14),
                          _rise(0.54, _EnterButton(onPressed: widget.onEnter)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x145E5CE6)),
      ),
      child: Text(
        'OUR FIRST PLAY STORE APP',
        style: AppTypography.uppercase.copyWith(
          color: const Color(0xFF5E5CE6),
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.0,
        ),
      ),
    );
  }
}

/// One line, always: scales down a little on narrow phones instead of leaving
/// a single word alone on the second line.
class _Headline extends StatelessWidget {
  const _Headline();

  @override
  Widget build(BuildContext context) {
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(
        'Welcome to the new app',
        maxLines: 1,
        softWrap: false,
        textAlign: TextAlign.center,
        style: AppTypography.h1.copyWith(
          fontSize: 32,
          height: 1.1,
          letterSpacing: -0.8,
          fontWeight: FontWeight.w800,
          color: AppColors.ink,
        ),
      ),
    );
  }
}

class _Thanks extends StatelessWidget {
  const _Thanks();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Text(
        'Thank you for supporting us. Because of you, we are here.',
        textAlign: TextAlign.center,
        style: AppTypography.body.copyWith(
          fontSize: 16,
          height: 1.45,
          color: AppColors.ink2,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard();

  @override
  Widget build(BuildContext context) {
    final body = AppTypography.body.copyWith(
      fontSize: 14.5,
      height: 1.5,
      color: AppColors.ink2,
    );
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x0F000000), width: 0.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x145E5CE6),
            blurRadius: 28,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFFF9F0A),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Symbols.info_rounded,
                    fill: 1, size: 19, color: Colors.white),
              ),
              const SizedBox(width: 10),
              Text(
                'A small heads-up',
                style: AppTypography.title.copyWith(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'This is our first app on the Play Store. Even after testing day and night, you may still run into a bug or find something missing. Please be patient with us.',
            style: body,
          ),
          const SizedBox(height: 10),
          Text(
            'If something feels off, open the Support tab and raise a ticket. We will fix it as fast as we can.',
            style: body,
          ),
        ],
      ),
    );
  }
}

class _SignOff extends StatelessWidget {
  const _SignOff();

  @override
  Widget build(BuildContext context) {
    return Text(
      'Team GenZ IITian',
      textAlign: TextAlign.center,
      style: AppTypography.title.copyWith(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: const Color(0xFF5E5CE6),
      ),
    );
  }
}

class _EnterButton extends StatelessWidget {
  const _EnterButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return BouncyPressable(
      onTap: onPressed,
      scaleDown: 0.97,
      child: Container(
        key: const Key('play-store-launch-enter'),
        height: 56,
        width: double.infinity,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          gradient: const LinearGradient(
            colors: [Color(0xFF6E6CF0), Color(0xFF5E5CE6)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF5E5CE6).withValues(alpha: 0.30),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Text(
          'Enter',
          style: AppTypography.buttonLabel.copyWith(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
        ),
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  const _Glow({required this.color, required this.size});

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
            colors: [color.withOpacity(0.45), color.withOpacity(0)],
            stops: const [0.0, 0.72],
          ),
        ),
      ),
    );
  }
}

class _Bit {
  _Bit({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
    required this.spin,
    required this.rotation,
    required this.color,
    required this.size,
    required this.life,
    required this.maxLife,
    required this.shape,
    required this.pop,
  });

  double x;
  double y;
  double vx;
  double vy;
  double spin;
  double rotation;
  final Color color;
  final double size;
  double life;
  final double maxLife;
  final int shape;
  final bool pop;
}

class _Ring {
  _Ring({required this.x, required this.y, required this.color});

  final double x;
  final double y;
  final Color color;
  double age = 0;
  final double maxAge = 0.7;
}

class _PartyField extends StatefulWidget {
  const _PartyField();

  @override
  State<_PartyField> createState() => _PartyFieldState();
}

class _PartyFieldState extends State<_PartyField>
    with SingleTickerProviderStateMixin {
  static const _colors = <Color>[
    Color(0xFFF43F5E),
    Color(0xFFFB7185),
    Color(0xFFFF9500),
    Color(0xFFFBBF24),
    Color(0xFF6E6CF0),
    Color(0xFF22C55E),
    Color(0xFF38BDF8),
    Color(0xFFEC4899),
  ];

  final _rng = math.Random();
  final _bits = <_Bit>[];
  final _rings = <_Ring>[];
  final _watch = Stopwatch();
  late final AnimationController _clock;
  double _last = 0;
  double _untilBurst = 0.35;

  @override
  void initState() {
    super.initState();
    _spawnBurst(0.18, 0.22);
    _spawnBurst(0.82, 0.2);
    _spawnBurst(0.5, 0.08);
    _clock = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )
      ..addListener(_step)
      ..repeat();
    _watch.start();
  }

  @override
  void dispose() {
    _clock.dispose();
    _watch.stop();
    super.dispose();
  }

  Color _pickColor() => _colors[_rng.nextInt(_colors.length)];

  void _spawnRain() {
    _bits.add(_Bit(
      x: _rng.nextDouble(),
      y: -0.08,
      vx: (_rng.nextDouble() - 0.5) * 0.06,
      vy: 0.08 + _rng.nextDouble() * 0.12,
      spin: (_rng.nextDouble() - 0.5) * 6,
      rotation: _rng.nextDouble() * math.pi,
      color: _pickColor(),
      size: 3.5 + _rng.nextDouble() * 4.5,
      life: 6,
      maxLife: 6,
      shape: _rng.nextInt(3),
      pop: false,
    ));
  }

  void _spawnBurst(double x, double y) {
    _rings.add(_Ring(x: x, y: y, color: _pickColor()));
    final count = 10 + _rng.nextInt(6);
    for (var i = 0; i < count; i++) {
      final angle = _rng.nextDouble() * math.pi * 2;
      final speed = 0.12 + _rng.nextDouble() * 0.28;
      _bits.add(_Bit(
        x: x,
        y: y,
        vx: math.cos(angle) * speed,
        vy: math.sin(angle) * speed - 0.05,
        spin: (_rng.nextDouble() - 0.5) * 10,
        rotation: _rng.nextDouble() * math.pi,
        color: _pickColor(),
        size: 3.2 + _rng.nextDouble() * 4.2,
        life: 0.85 + _rng.nextDouble() * 0.45,
        maxLife: 1.2,
        shape: _rng.nextInt(3),
        pop: true,
      ));
    }
  }

  void _step() {
    final now = _watch.elapsedMicroseconds / 1e6;
    var dt = now - _last;
    _last = now;
    if (dt <= 0) return;
    if (dt > 0.05) dt = 0.05;

    final spawning = now < 2.4;
    _untilBurst -= dt;
    if (spawning && _untilBurst <= 0) {
      _spawnBurst(0.12 + _rng.nextDouble() * 0.76, 0.08 + _rng.nextDouble() * 0.7);
      _untilBurst = 0.65 + _rng.nextDouble() * 0.55;
    }
    if (spawning && _bits.length < 30) _spawnRain();

    for (final bit in _bits) {
      bit.vy += 0.28 * dt;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
      bit.rotation += bit.spin * dt;
      bit.life -= dt;
    }
    _bits.removeWhere((bit) => bit.life <= 0 || bit.y > 1.2);
    for (final ring in _rings) {
      ring.age += dt;
    }
    _rings.removeWhere((ring) => ring.age >= ring.maxAge);
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _PartyPainter(
            bits: _bits,
            rings: _rings,
            repaint: _clock,
          ),
        ),
      ),
    );
  }
}

class _PartyPainter extends CustomPainter {
  _PartyPainter({
    required this.bits,
    required this.rings,
    required Listenable repaint,
  }) : super(repaint: repaint);

  final List<_Bit> bits;
  final List<_Ring> rings;

  @override
  void paint(Canvas canvas, Size size) {
    for (final ring in rings) {
      final t = (ring.age / ring.maxAge).clamp(0.0, 1.0);
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4 * (1 - t)
        ..color = ring.color.withOpacity((1 - t) * 0.7);
      canvas.drawCircle(
        Offset(ring.x * size.width, ring.y * size.height),
        6 + t * 64,
        paint,
      );
    }

    for (final bit in bits) {
      final lifeT = (bit.life / bit.maxLife).clamp(0.0, 1.0);
      final alpha = lifeT < 0.28 ? lifeT / 0.28 : 1.0;
      final age = 1 - lifeT;
      final pop = !bit.pop
          ? 1.0
          : (age < 0.22 ? Curves.easeOutBack.transform(age / 0.22) : 1.0);
      final center = Offset(bit.x * size.width, bit.y * size.height);
      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(bit.rotation);
      canvas.scale(pop);
      final paint = Paint()..color = bit.color.withOpacity(alpha.clamp(0.0, 1.0));
      switch (bit.shape) {
        case 0:
          canvas.drawCircle(Offset.zero, bit.size, paint);
        case 1:
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromCenter(
                center: Offset.zero,
                width: bit.size * 2.4,
                height: bit.size * 0.75,
              ),
              const Radius.circular(2),
            ),
            paint,
          );
        default:
          canvas.drawPath(_diamond(bit.size), paint);
      }
      canvas.restore();
    }
  }

  Path _diamond(double size) {
    return Path()
      ..moveTo(0, -size)
      ..lineTo(size * 0.72, 0)
      ..lineTo(0, size)
      ..lineTo(-size * 0.72, 0)
      ..close();
  }

  @override
  bool shouldRepaint(covariant _PartyPainter oldDelegate) => false;
}
