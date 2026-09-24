import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  AnimationController? _fade;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (!playStoreLaunchApplies()) return;
    if (ref.read(playStoreLaunchSeenProvider)) return;
    _fade = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
      value: 1,
    );
  }

  @override
  void dispose() {
    _fade?.dispose();
    super.dispose();
  }

  Future<void> _enter() async {
    if (_busy) return;
    _busy = true;
    await PlayStoreLaunch.markSeen();
    final fade = _fade;
    if (!mounted || fade == null) return;
    await fade.reverse();
    if (!mounted) return;
    ref.read(playStoreLaunchSeenProvider.notifier).state = true;
  }

  @override
  Widget build(BuildContext context) {
    final seen = ref.watch(playStoreLaunchSeenProvider);
    final fade = _fade;
    if (seen || fade == null) return widget.child;

    return Stack(
      children: [
        widget.child,
        FadeTransition(
          opacity: fade,
          child: _CelebrationScreen(onEnter: _enter),
        ),
      ],
    );
  }
}

class _CelebrationScreen extends StatelessWidget {
  const _CelebrationScreen({required this.onEnter});

  final VoidCallback onEnter;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Material(
        color: const Color(0xFFFFF6EE),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFFFFF1F4),
                Color(0xFFFFF7E8),
                Color(0xFFF3E8FF),
                Color(0xFFE8EEFF),
              ],
              stops: [0.0, 0.34, 0.68, 1.0],
            ),
          ),
          child: Stack(
            children: [
              const Positioned(
                top: -90,
                left: -70,
                child: _Glow(color: Color(0xFFFF8FAB), size: 260),
              ),
              const Positioned(
                top: 80,
                right: -90,
                child: _Glow(color: Color(0xFFFFD166), size: 240),
              ),
              const Positioned(
                bottom: -40,
                left: -20,
                child: _Glow(color: Color(0xFFC4B5FD), size: 280),
              ),
              const Positioned.fill(child: _PartyField()),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(22, 8, 22, 16),
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
                                child: const Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    _Eyebrow(),
                                    SizedBox(height: 18),
                                    _Headline(),
                                    SizedBox(height: 16),
                                    _Thanks(),
                                    SizedBox(height: 18),
                                    _NoteCard(),
                                    SizedBox(height: 18),
                                    _SignOff(),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 14),
                      _EnterButton(onPressed: onEnter),
                    ],
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.82),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFFFC2D4)),
      ),
      child: Text(
        'OUR FIRST PLAY STORE APP',
        style: AppTypography.uppercase.copyWith(
          color: const Color(0xFFBE185D),
          fontSize: 11,
          letterSpacing: 1.15,
        ),
      ),
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline();

  @override
  Widget build(BuildContext context) {
    return Text(
      'Welcome to the new app',
      textAlign: TextAlign.center,
      style: AppTypography.h1.copyWith(
        fontSize: 32,
        height: 1.12,
        color: AppColors.ink,
      ),
    );
  }
}

class _Thanks extends StatelessWidget {
  const _Thanks();

  @override
  Widget build(BuildContext context) {
    final style = AppTypography.body.copyWith(
      fontSize: 16,
      height: 1.45,
      color: AppColors.ink2,
      fontWeight: FontWeight.w600,
    );
    return Column(
      children: [
        Text(
          'Thank you for supporting us. Because of you, we are here.',
          textAlign: TextAlign.center,
          style: style,
        ),
        const SizedBox(height: 8),
        Text(
          'Please use this app.',
          textAlign: TextAlign.center,
          style: style.copyWith(
            color: AppColors.ink,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.94),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF7C3AED).withOpacity(0.08),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'A small heads-up',
            style: AppTypography.title.copyWith(
              fontSize: 15,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'This is our first app on the Play Store. Even after testing day and night, you may still run into a bug or find something missing. Please be patient with us.',
            style: AppTypography.body.copyWith(
              fontSize: 14,
              height: 1.5,
              color: AppColors.ink2,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'If something feels off, open the Support tab and raise a ticket. We will fix it as fast as we can.',
            style: AppTypography.body.copyWith(
              fontSize: 14,
              height: 1.5,
              color: AppColors.ink2,
            ),
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
        color: const Color(0xFF6D28D9),
      ),
    );
  }
}

class _EnterButton extends StatefulWidget {
  const _EnterButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  State<_EnterButton> createState() => _EnterButtonState();
}

class _EnterButtonState extends State<_EnterButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final scale = 1 + (_pulse.value * 0.025);
        return Transform.scale(scale: scale, child: child);
      },
      child: BouncyPressable(
        onTap: widget.onPressed,
        scaleDown: 0.97,
        child: Container(
          key: const Key('play-store-launch-enter'),
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(50),
            gradient: const LinearGradient(
              colors: [Color(0xFF7C3AED), Color(0xFFDB2777)],
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFDB2777).withOpacity(0.32),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Text(
            'ENTER',
            style: AppTypography.buttonLabel.copyWith(
              fontSize: 16,
              letterSpacing: 1.4,
            ),
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
    Color(0xFFF59E0B),
    Color(0xFFFBBF24),
    Color(0xFF8B5CF6),
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

    _untilBurst -= dt;
    if (_untilBurst <= 0) {
      _spawnBurst(0.12 + _rng.nextDouble() * 0.76, 0.08 + _rng.nextDouble() * 0.7);
      _untilBurst = 0.65 + _rng.nextDouble() * 0.55;
    }
    if (_bits.length < 42) _spawnRain();

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
