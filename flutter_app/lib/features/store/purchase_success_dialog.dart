import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../theme/app_theme_tokens.dart';

const _kGreenA = Color(0xFF34C77B);
const _kGreenB = Color(0xFF1F9A5A);

/// "Purchase successful" modal: the badge scales in, a ring pulses out, the
/// tick draws itself, a small burst of dots flies off, then the text rises in.
/// Returns true when the primary action ("Open note") was chosen.
Future<bool> showPurchaseSuccessDialog(
  BuildContext context, {
  required String title,
  DateTime? validUntil,
  bool offerOpen = true,
}) async {
  final reduce = MediaQuery.of(context).disableAnimations;
  final res = await showGeneralDialog<bool>(
    context: context,
    useRootNavigator: true,
    barrierDismissible: true,
    barrierLabel: 'Close',
    barrierColor: Colors.black.withValues(alpha: 0.38),
    transitionDuration: Duration(milliseconds: reduce ? 1 : 320),
    pageBuilder: (ctx, _, __) => _SuccessCard(
      title: title,
      validUntil: validUntil,
      offerOpen: offerOpen,
      reduce: reduce,
    ),
    transitionBuilder: (ctx, anim, _, child) {
      final c = CurvedAnimation(
        parent: anim,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      return BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 6 * c.value, sigmaY: 6 * c.value),
        child: FadeTransition(
          opacity: c,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.92, end: 1).animate(c),
            child: child,
          ),
        ),
      );
    },
  );
  return res == true;
}

class _SuccessCard extends StatefulWidget {
  const _SuccessCard({
    required this.title,
    required this.validUntil,
    required this.offerOpen,
    required this.reduce,
  });
  final String title;
  final DateTime? validUntil;
  final bool offerOpen;
  final bool reduce;

  @override
  State<_SuccessCard> createState() => _SuccessCardState();
}

class _SuccessCardState extends State<_SuccessCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1900),
  );
  bool _ticked = false;

  @override
  void initState() {
    super.initState();
    if (widget.reduce) {
      _c.value = 1;
    } else {
      _c.addListener(() {
        if (!_ticked && _c.value >= 0.42) {
          _ticked = true;
          HapticFeedback.mediumImpact();
        }
      });
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  double _seg(double a, double b, [Curve curve = Curves.easeOutCubic]) =>
      curve.transform(((_c.value - a) / (b - a)).clamp(0.0, 1.0));

  String _date(DateTime d) {
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${d.day} ${m[d.month - 1]} ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: math.min(MediaQuery.of(context).size.width - 48, 360),
          padding: const EdgeInsets.fromLTRB(24, 30, 24, 20),
          decoration: BoxDecoration(
            color: t.surface,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: t.border, width: 0.5),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 40,
                offset: Offset(0, 18),
              ),
            ],
          ),
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              final badge = _seg(0.00, 0.28, Curves.easeOutBack);
              final text1 = _seg(0.40, 0.62);
              final text2 = _seg(0.48, 0.70);
              final chip = _seg(0.56, 0.78);
              final btn = _seg(0.64, 0.86);
              Widget rise(double v, Widget w) => Opacity(
                    opacity: v.clamp(0.0, 1.0),
                    child: Transform.translate(
                      offset: Offset(0, (1 - v) * 14),
                      child: w,
                    ),
                  );
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 190,
                    height: 150,
                    child: CustomPaint(
                      painter: _BadgePainter(
                        badge: badge,
                        ring: _seg(0.14, 0.52),
                        tick: _seg(0.22, 0.46, Curves.easeInOutCubic),
                        burst: _seg(0.22, 0.80),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  rise(
                    text1,
                    Text(
                      'Purchase successful',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                        color: t.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  rise(
                    text2,
                    Text(
                      '"${widget.title}" is unlocked and ready to download.',
                      textAlign: TextAlign.center,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        height: 1.4,
                        color: t.textSecondary,
                      ),
                    ),
                  ),
                  if (widget.validUntil != null) ...[
                    const SizedBox(height: 16),
                    rise(
                      chip,
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: _kGreenB.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Symbols.event_available_rounded,
                                size: 17, color: _kGreenB),
                            const SizedBox(width: 6),
                            Text(
                              'Access until ${_date(widget.validUntil!)}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: _kGreenB,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 22),
                  rise(
                    btn,
                    Column(
                      children: [
                        _DialogButton(
                          label: widget.offerOpen ? 'Open note' : 'Done',
                          filled: true,
                          onTap: () => Navigator.of(context, rootNavigator: true)
                              .pop(widget.offerOpen),
                        ),
                        if (widget.offerOpen) ...[
                          const SizedBox(height: 8),
                          _DialogButton(
                            label: 'Done',
                            filled: false,
                            onTap: () =>
                                Navigator.of(context, rootNavigator: true)
                                    .pop(false),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _DialogButton extends StatefulWidget {
  const _DialogButton({
    required this.label,
    required this.filled,
    required this.onTap,
  });
  final String label;
  final bool filled;
  final VoidCallback onTap;
  @override
  State<_DialogButton> createState() => _DialogButtonState();
}

class _DialogButtonState extends State<_DialogButton> {
  bool _down = false;
  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? 0.97 : 1,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        child: Container(
          height: 52,
          width: double.infinity,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: widget.filled
                ? const LinearGradient(
                    colors: [_kGreenA, _kGreenB],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            color: widget.filled ? null : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            widget.label,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: widget.filled ? Colors.white : t.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class _BadgePainter extends CustomPainter {
  _BadgePainter({
    required this.badge,
    required this.ring,
    required this.tick,
    required this.burst,
  });
  final double badge; // 0..1 (can overshoot slightly with easeOutBack)
  final double ring; // expanding pulse
  final double tick; // tick draw progress
  final double burst; // confetti dots

  static const _dots = [
    Color(0xFF34C77B), Color(0xFF5AC8FA), Color(0xFFFFB340), Color(0xFFBF5AF2),
    Color(0xFFFF6482), Color(0xFF7D7AFF),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    const r = 46.0;

    // Pulse ring.
    if (ring > 0 && ring < 1) {
      canvas.drawCircle(
        c,
        r + 6 + ring * 34,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3 * (1 - ring)
          ..color = _kGreenA.withValues(alpha: 0.45 * (1 - ring)),
      );
    }

    // Burst of small dots.
    if (burst > 0 && burst < 1) {
      final fade = (1 - burst).clamp(0.0, 1.0);
      for (var i = 0; i < 12; i++) {
        final a = (i / 12) * math.pi * 2 + 0.3;
        final dist = r + 10 + Curves.easeOutCubic.transform(burst) * (28 + (i % 3) * 10);
        final p = c + Offset(math.cos(a), math.sin(a)) * dist;
        canvas.drawCircle(
          p,
          (i.isEven ? 3.6 : 2.4) * fade + 0.4,
          Paint()..color = _dots[i % _dots.length].withValues(alpha: fade),
        );
      }
    }

    // Badge disc.
    final s = badge.clamp(0.0, 1.2);
    if (s > 0) {
      final rect = Rect.fromCircle(center: c, radius: r * s);
      canvas.drawShadow(
        Path()..addOval(rect.translate(0, 6)),
        _kGreenB.withValues(alpha: 0.55),
        10 * s,
        false,
      );
      canvas.drawCircle(
        c,
        r * s,
        Paint()
          ..shader = const LinearGradient(
            colors: [_kGreenA, _kGreenB],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ).createShader(rect),
      );
    }

    // Tick that draws itself.
    if (tick > 0) {
      final path = Path()
        ..moveTo(c.dx - 17, c.dy + 1)
        ..lineTo(c.dx - 5, c.dy + 13)
        ..lineTo(c.dx + 19, c.dy - 12);
      final metric = path.computeMetrics().first;
      canvas.drawPath(
        metric.extractPath(0, metric.length * tick),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 7
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = Colors.white,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BadgePainter o) =>
      o.badge != badge || o.ring != ring || o.tick != tick || o.burst != burst;
}
