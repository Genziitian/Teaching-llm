import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_theme_tokens.dart';

/// "Yupp! Discount added" popup with a springy check and a confetti burst.
Future<void> showCouponCelebration(
  BuildContext context, {
  required String code,
  required double saved,
}) {
  HapticFeedback.heavyImpact();
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Discount added',
    barrierColor: Colors.black.withValues(alpha: 0.45),
    transitionDuration: const Duration(milliseconds: 320),
    pageBuilder: (_, __, ___) => _CouponCelebration(code: code, saved: saved),
    transitionBuilder: (_, anim, __, child) => FadeTransition(
      opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
      child: child,
    ),
  );
}

class _CouponCelebration extends StatefulWidget {
  const _CouponCelebration({required this.code, required this.saved});
  final String code;
  final double saved;

  @override
  State<_CouponCelebration> createState() => _CouponCelebrationState();
}

class _CouponCelebrationState extends State<_CouponCelebration>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 2600))
    ..forward();
  late final List<_Piece> _pieces;

  @override
  void initState() {
    super.initState();
    final r = math.Random();
    const colors = [
      Color(0xFFFF375F),
      Color(0xFFFFB800),
      Color(0xFF30D158),
      Color(0xFF0A84FF),
      Color(0xFFBF5AF2),
      Color(0xFFFF9F0A),
    ];
    _pieces = List.generate(
      70,
      (_) => _Piece(
        angle: -math.pi / 2 + (r.nextDouble() - 0.5) * math.pi * 1.25,
        speed: 260 + r.nextDouble() * 420,
        size: 6 + r.nextDouble() * 6,
        spin: (r.nextDouble() - 0.5) * 14,
        color: colors[r.nextInt(colors.length)],
        round: r.nextBool(),
      ),
    );
    Future.delayed(const Duration(milliseconds: 2800), () {
      if (mounted && Navigator.of(context).canPop()) Navigator.of(context).pop();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  String _money(double v) =>
      '₹${v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Material(
      type: MaterialType.transparency,
      child: Stack(
        fit: StackFit.expand,
        children: [
          IgnorePointer(
            child: AnimatedBuilder(
              animation: _c,
              builder: (_, __) => CustomPaint(
                painter: _ConfettiPainter(_pieces, _c.value),
              ),
            ),
          ),
          Center(
            child: ScaleTransition(
              scale: CurvedAnimation(
                  parent: _c, curve: const Interval(0, 0.28, curve: Curves.elasticOut)),
              child: Container(
                width: 300,
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 22),
                decoration: BoxDecoration(
                  color: tokens.cardBg,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: tokens.border, width: 0.5),
                  boxShadow: const [
                    BoxShadow(
                        color: Color(0x33000000),
                        blurRadius: 30,
                        offset: Offset(0, 12)),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ScaleTransition(
                      scale: CurvedAnimation(
                          parent: _c,
                          curve: const Interval(0.12, 0.45, curve: Curves.elasticOut)),
                      child: Container(
                        width: 76,
                        height: 76,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                              colors: [Color(0xFF34D399), Color(0xFF16A34A)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight),
                        ),
                        child: const Icon(Symbols.check_rounded,
                            size: 46, weight: 700, color: Colors.white),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text('Yupp! Discount added',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                            color: tokens.textPrimary)),
                    const SizedBox(height: 8),
                    Text('You saved ${_money(widget.saved)} with ${widget.code}',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 15,
                            height: 1.35,
                            color: tokens.textSecondary)),
                    const SizedBox(height: 20),
                    ApplePressable(
                      onTap: () => Navigator.of(context).maybePop(),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: tokens.textPrimary,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        alignment: Alignment.center,
                        child: Text('Awesome',
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: tokens.cardBg)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Piece {
  _Piece({
    required this.angle,
    required this.speed,
    required this.size,
    required this.spin,
    required this.color,
    required this.round,
  });
  final double angle, speed, size, spin;
  final Color color;
  final bool round;
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.pieces, this.t);
  final List<_Piece> pieces;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final origin = Offset(size.width / 2, size.height * 0.46);
    final secs = t * 2.6;
    for (final p in pieces) {
      // Burst outward, then gravity pulls it down and it fades.
      final dx = math.cos(p.angle) * p.speed * secs * (1 - 0.18 * secs);
      final dy = math.sin(p.angle) * p.speed * secs + 520 * secs * secs * 0.5;
      final fade = (1 - ((t - 0.55) / 0.45)).clamp(0.0, 1.0);
      final paint = Paint()..color = p.color.withValues(alpha: fade);
      canvas.save();
      canvas.translate(origin.dx + dx, origin.dy + dy);
      canvas.rotate(p.spin * secs);
      if (p.round) {
        canvas.drawCircle(Offset.zero, p.size / 2, paint);
      } else {
        canvas.drawRRect(
            RRect.fromRectAndRadius(
                Rect.fromCenter(center: Offset.zero, width: p.size, height: p.size * 0.55),
                const Radius.circular(2)),
            paint);
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.t != t;
}
