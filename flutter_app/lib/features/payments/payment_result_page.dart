import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../shared/widgets/apple_pressable.dart';
import 'payment_feedback_sheet.dart';
import '../../theme/app_theme_tokens.dart';

/// How a checkout ended.
enum PaymentOutcome { success, failed, cancelled, pending }

/// Which button the person chose on the result screen.
enum PaymentResultAction { primary, secondary, none }

/// Full-page result after a payment: an animated buddy, a receipt, and what
/// happens next. One screen for success, failure, cancellation and
/// "we are still confirming", on every phone and tablet size.
Future<PaymentResultAction> showPaymentResult(
  BuildContext context, {
  required PaymentOutcome outcome,
  required String title,
  double? amount,
  String? orderId,
  String? paymentId,
  String method = 'Razorpay',
  String? reason,
  List<String> grants = const [],
  DateTime? validUntil,
  String? primaryLabel,
  String? secondaryLabel,
  String? secondaryRoute,
}) async {
  final res = await Navigator.of(context, rootNavigator: true)
      .push<PaymentResultAction>(
    PageRouteBuilder<PaymentResultAction>(
      fullscreenDialog: true,
      transitionDuration: const Duration(milliseconds: 320),
      reverseTransitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (ctx, _, __) => _PaymentResultPage(
        rootContext: context,
        outcome: outcome,
        title: title,
        amount: amount,
        orderId: orderId,
        paymentId: paymentId,
        method: method,
        reason: reason,
        grants: grants,
        validUntil: validUntil,
        primaryLabel: primaryLabel,
        secondaryLabel: secondaryLabel,
        secondaryRoute: secondaryRoute,
      ),
      transitionsBuilder: (ctx, anim, _, child) {
        final c = CurvedAnimation(parent: anim, curve: Curves.easeOutCubic);
        return FadeTransition(
          opacity: c,
          child: SlideTransition(
            position: Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero)
                .animate(c),
            child: child,
          ),
        );
      },
    ),
  );
  if (outcome != PaymentOutcome.success && context.mounted) {
    // Ask once why they did not finish; the server decides whether to show it.
    await maybeAskWhatsStopping(context, justNow: true);
  }
  return res ?? PaymentResultAction.none;
}

Color _moodColor(PaymentOutcome o) {
  switch (o) {
    case PaymentOutcome.success:
      return const Color(0xFF30C46F);
    case PaymentOutcome.failed:
      return const Color(0xFFFF453A);
    case PaymentOutcome.cancelled:
      return const Color(0xFFFF9F0A);
    case PaymentOutcome.pending:
      return const Color(0xFF0A84FF);
  }
}

class _PaymentResultPage extends StatefulWidget {
  const _PaymentResultPage({
    required this.rootContext,
    required this.outcome,
    required this.title,
    required this.amount,
    required this.orderId,
    required this.paymentId,
    required this.method,
    required this.reason,
    required this.grants,
    required this.validUntil,
    required this.primaryLabel,
    required this.secondaryLabel,
    required this.secondaryRoute,
  });
  final BuildContext rootContext;
  final PaymentOutcome outcome;
  final String title;
  final double? amount;
  final String? orderId;
  final String? paymentId;
  final String method;
  final String? reason;
  final List<String> grants;
  final DateTime? validUntil;
  final String? primaryLabel;
  final String? secondaryLabel;
  final String? secondaryRoute;

  @override
  State<_PaymentResultPage> createState() => _PaymentResultPageState();
}

class _PaymentResultPageState extends State<_PaymentResultPage>
    with TickerProviderStateMixin {
  late final AnimationController _loop = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3200),
  );
  late final AnimationController _enter = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  final DateTime _when = DateTime.now();

  @override
  void initState() {
    super.initState();
    _enter.forward();
    _loop.repeat();
    if (widget.outcome == PaymentOutcome.success) {
      HapticFeedback.mediumImpact();
    } else {
      HapticFeedback.heavyImpact();
    }
  }

  @override
  void dispose() {
    _loop.dispose();
    _enter.dispose();
    super.dispose();
  }

  bool get _ok => widget.outcome == PaymentOutcome.success;

  String get _headline {
    switch (widget.outcome) {
      case PaymentOutcome.success:
        return 'Payment successful';
      case PaymentOutcome.failed:
        return 'Payment failed';
      case PaymentOutcome.cancelled:
        return 'Payment cancelled';
      case PaymentOutcome.pending:
        return 'We are confirming your payment';
    }
  }

  String get _subline {
    switch (widget.outcome) {
      case PaymentOutcome.success:
        return 'You now have access to ${widget.title}.';
      case PaymentOutcome.failed:
        final r = (widget.reason ?? '').trim();
        return r.isNotEmpty ? r : 'Something went wrong while paying.';
      case PaymentOutcome.cancelled:
        return 'You closed checkout before paying, so nothing was charged.';
      case PaymentOutcome.pending:
        return 'This can take a few minutes. Your access appears on its own once it is confirmed.';
    }
  }

  String get _primary =>
      widget.primaryLabel ??
      (_ok
          ? 'Start learning'
          : widget.outcome == PaymentOutcome.pending
              ? 'Done'
              : 'Try again');

  String get _secondary =>
      widget.secondaryLabel ??
      (_ok
          ? 'View purchase history'
          : widget.outcome == PaymentOutcome.cancelled
              ? 'Back to store'
              : 'Get help');

  String get _secondaryRoute =>
      widget.secondaryRoute ??
      (_ok
          ? '/purchase-history'
          : widget.outcome == PaymentOutcome.cancelled
              ? '/store'
              : '/support');

  void _primaryTap() => Navigator.of(context).pop(PaymentResultAction.primary);

  void _secondaryTap() {
    final root = widget.rootContext;
    Navigator.of(context).pop(PaymentResultAction.secondary);
    if (root.mounted) {
      try {
        root.push(_secondaryRoute);
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final reduce = MediaQuery.of(context).disableAnimations;
    final accent = _moodColor(widget.outcome);

    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: tokens.bg,
        body: LayoutBuilder(builder: (context, box) {
          final wide = box.maxWidth >= 760;
          final shortScreen = box.maxHeight < 640;
          final buddySize = wide
              ? math.min(340.0, box.maxWidth * 0.30)
              : math.min(shortScreen ? 150.0 : 220.0, box.maxWidth * 0.6);

          final hero = Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ScaleTransition(
                scale: reduce
                    ? const AlwaysStoppedAnimation(1.0)
                    : CurvedAnimation(parent: _enter, curve: Curves.easeOutBack),
                child: SizedBox(
                  width: buddySize,
                  height: buddySize,
                  child: AnimatedBuilder(
                    animation: _loop,
                    builder: (_, __) => CustomPaint(
                      painter: _BuddyPainter(
                        mood: widget.outcome,
                        t: reduce ? 0 : _loop.value,
                        color: accent,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                _headline,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: wide ? 34 : 28,
                  height: 1.1,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.9,
                  color: tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  _subline,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    height: 1.4,
                    color: tokens.textSecondary,
                  ),
                ),
              ),
            ],
          );

          final details = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Receipt(
                outcome: widget.outcome,
                accent: accent,
                title: widget.title,
                amount: widget.amount,
                method: widget.method,
                when: _when,
                orderId: widget.orderId,
                paymentId: widget.paymentId,
              ),
              const SizedBox(height: 14),
              if (_ok)
                _InfoCard(
                  icon: Symbols.lock_open_rounded,
                  accent: accent,
                  title: 'Access granted',
                  lines: [
                    ...widget.grants,
                    if (widget.validUntil != null)
                      'Valid until ${_fmtDate(widget.validUntil!)}',
                  ],
                  fallback: 'Your purchase is unlocked and ready to use.',
                )
              else
                _InfoCard(
                  icon: Symbols.lightbulb_rounded,
                  accent: accent,
                  title: 'What you can do',
                  lines: _tips(widget.outcome),
                  fallback: '',
                ),
            ],
          );

          final actions = _Actions(
            accent: accent,
            primary: _primary,
            secondary: _secondary,
            onPrimary: _primaryTap,
            onSecondary: _secondaryTap,
          );

          final body = wide
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(child: hero),
                    const SizedBox(width: 40),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [details, const SizedBox(height: 18), actions],
                      ),
                    ),
                  ],
                )
              : Column(
                  children: [hero, const SizedBox(height: 22), details],
                );

          return Stack(
            children: [
              if (_ok && !reduce)
                Positioned.fill(
                  child: IgnorePointer(
                    child: AnimatedBuilder(
                      animation: _loop,
                      builder: (_, __) => CustomPaint(
                        painter: _ConfettiPainter(t: _loop.value),
                      ),
                    ),
                  ),
                ),
              SafeArea(
                child: Column(
                  children: [
                    Expanded(
                      child: Center(
                        child: SingleChildScrollView(
                          padding: EdgeInsets.fromLTRB(
                              20, shortScreen ? 8 : 24, 20, wide ? 24 : 12),
                          child: ConstrainedBox(
                            constraints:
                                BoxConstraints(maxWidth: wide ? 1020 : 520),
                            child: body,
                          ),
                        ),
                      ),
                    ),
                    if (!wide)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 520),
                          child: actions,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          );
        }),
      ),
    );
  }
}

List<String> _tips(PaymentOutcome o) {
  switch (o) {
    case PaymentOutcome.failed:
      return const [
        'Check your internet connection and try again.',
        'Try another UPI app, card or net banking.',
        'If money was deducted, your bank usually returns it within 5 to 7 working days. Contact us if it does not arrive.',
      ];
    case PaymentOutcome.cancelled:
      return const [
        'Nothing was charged. Your cart is still there.',
        'Tap Try again whenever you are ready.',
      ];
    case PaymentOutcome.pending:
      return const [
        'Keep the app open for a minute, then check your purchase history.',
        'If money was deducted and access does not appear, contact us with the order ID above.',
      ];
    case PaymentOutcome.success:
      return const [];
  }
}

String _fmtDate(DateTime d) {
  const m = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${d.day} ${m[d.month - 1]} ${d.year}';
}

String _fmtDateTime(DateTime d) {
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final mm = d.minute.toString().padLeft(2, '0');
  return '${_fmtDate(d)}, $h:$mm ${d.hour >= 12 ? 'PM' : 'AM'}';
}

// ───────────────────────────── Receipt ─────────────────────────────

class _Receipt extends StatelessWidget {
  const _Receipt({
    required this.outcome,
    required this.accent,
    required this.title,
    required this.amount,
    required this.method,
    required this.when,
    required this.orderId,
    required this.paymentId,
  });
  final PaymentOutcome outcome;
  final Color accent;
  final String title;
  final double? amount;
  final String method;
  final DateTime when;
  final String? orderId;
  final String? paymentId;

  String get _status {
    switch (outcome) {
      case PaymentOutcome.success:
        return 'Paid';
      case PaymentOutcome.failed:
        return 'Failed';
      case PaymentOutcome.cancelled:
        return 'Cancelled';
      case PaymentOutcome.pending:
        return 'Confirming';
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final amt = amount == null ? null : '₹${amount!.round()}';
    return Container(
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: tokens.border, width: 0.5),
        boxShadow: const [
          BoxShadow(
              color: Color(0x14000000), blurRadius: 24, offset: Offset(0, 10)),
        ],
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Symbols.receipt_long_rounded,
                      size: 22, color: accent),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    outcome == PaymentOutcome.success ? 'Receipt' : 'Attempt receipt',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                      color: tokens.textPrimary,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(_status,
                      style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          color: accent)),
                ),
              ],
            ),
          ),
          _Perforation(color: tokens.bg, line: tokens.border),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
            child: Column(
              children: [
                _Row('Item', title),
                if (amt != null)
                  _Row(
                    outcome == PaymentOutcome.success ? 'Amount paid' : 'Amount',
                    outcome == PaymentOutcome.success ? amt : '$amt (not charged)',
                    strong: true,
                    note: outcome == PaymentOutcome.success,
                  ),
                _Row('Date and time', _fmtDateTime(when)),
                _Row('Paid with', method),
                if (orderId != null && orderId!.isNotEmpty)
                  _Row('Order ID', orderId!, copy: true),
                if (paymentId != null && paymentId!.isNotEmpty)
                  _Row('Payment ID', paymentId!, copy: true),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.k, this.v, {this.strong = false, this.copy = false, this.note = false});
  final String k;
  final String v;
  final bool strong;
  final bool copy;
  final bool note;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 104,
            child: Text(k,
                style: TextStyle(fontSize: 13.5, color: tokens.textSecondary)),
          ),
          Expanded(
            child: Text(
              v,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: strong ? 17 : 13.5,
                fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
                color: tokens.textPrimary,
              ),
            ),
          ),
          if (copy) ...[
            const SizedBox(width: 6),
            Icon(Symbols.content_copy_rounded,
                size: 15, color: tokens.textMuted),
          ],
        ],
      ),
    );
    if (!copy) return row;
    return ApplePressable(
      onTap: () {
        HapticFeedback.selectionClick();
        Clipboard.setData(ClipboardData(text: v));
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text('$k copied')));
      },
      pressedScale: 0.99,
      child: row,
    );
  }
}

/// Ticket-style divider: dashed line with a notch on each side.
class _Perforation extends StatelessWidget {
  const _Perforation({required this.color, required this.line});
  final Color color;
  final Color line;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 18,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: CustomPaint(painter: _DashPainter(line)),
            ),
          ),
          Positioned(
            left: -9,
            child: Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          ),
          Positioned(
            right: -9,
            child: Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          ),
        ],
      ),
    );
  }
}

class _DashPainter extends CustomPainter {
  _DashPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 1.2;
    var x = 0.0;
    while (x < size.width) {
      canvas.drawLine(Offset(x, size.height / 2),
          Offset(math.min(x + 6, size.width), size.height / 2), p);
      x += 11;
    }
  }

  @override
  bool shouldRepaint(covariant _DashPainter old) => old.color != color;
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.icon,
    required this.accent,
    required this.title,
    required this.lines,
    required this.fallback,
  });
  final IconData icon;
  final Color accent;
  final String title;
  final List<String> lines;
  final String fallback;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final items = lines.isEmpty && fallback.isNotEmpty ? [fallback] : lines;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: accent.withValues(alpha: 0.22), width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 20, color: accent),
            const SizedBox(width: 8),
            Text(title,
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: tokens.textPrimary)),
          ]),
          const SizedBox(height: 10),
          for (final l in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Icon(Symbols.check_circle_rounded,
                        fill: 1, size: 17, color: accent),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(l,
                        style: TextStyle(
                            fontSize: 13.5,
                            height: 1.38,
                            color: tokens.textPrimary)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.accent,
    required this.primary,
    required this.secondary,
    required this.onPrimary,
    required this.onSecondary,
  });
  final Color accent;
  final String primary;
  final String secondary;
  final VoidCallback onPrimary;
  final VoidCallback onSecondary;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ApplePressable(
          onTap: onPrimary,
          pressedScale: 0.98,
          child: Container(
            height: 54,
            width: double.infinity,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: accent,
              borderRadius: BorderRadius.circular(27),
              boxShadow: [
                BoxShadow(
                    color: accent.withValues(alpha: 0.35),
                    blurRadius: 16,
                    offset: const Offset(0, 6)),
              ],
            ),
            child: Text(primary,
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.3,
                    color: Colors.white)),
          ),
        ),
        const SizedBox(height: 10),
        ApplePressable(
          onTap: onSecondary,
          pressedScale: 0.98,
          child: Container(
            height: 48,
            width: double.infinity,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: tokens.textMuted.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Text(secondary,
                style: TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary)),
          ),
        ),
      ],
    );
  }
}

// ───────────────────────────── Buddy ─────────────────────────────

/// A friendly blob drawn in code: happy and waving, worried with a sweat
/// drop, shrugging, or puzzled with dots orbiting its head.
class _BuddyPainter extends CustomPainter {
  _BuddyPainter({required this.mood, required this.t, required this.color});
  final PaymentOutcome mood;
  final double t; // 0..1 looping
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final tau = math.pi * 2;
    final bob = math.sin(t * tau) * s * 0.018;
    final cx = s / 2;
    final bodyW = s * 0.56, bodyH = s * 0.60;
    final top = s * 0.26 + bob;
    final bodyRect = Rect.fromLTWH(cx - bodyW / 2, top, bodyW, bodyH);
    final tilt = mood == PaymentOutcome.failed
        ? -0.06 + math.sin(t * tau) * 0.015
        : (mood == PaymentOutcome.pending ? math.sin(t * tau) * 0.05 : 0.0);

    // ground shadow
    final sh = 1 - (bob / (s * 0.04)).clamp(-0.5, 0.5) * 0.15;
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(cx, s * 0.90),
          width: bodyW * 0.82 * sh,
          height: s * 0.055),
      Paint()..color = Colors.black.withValues(alpha: 0.12),
    );

    canvas.save();
    canvas.translate(cx, top + bodyH);
    canvas.rotate(tilt);
    canvas.translate(-cx, -(top + bodyH));

    // feet
    final footPaint = Paint()..color = _shade(color, -0.22);
    canvas.drawOval(
        Rect.fromCenter(
            center: Offset(cx - bodyW * 0.22, top + bodyH + s * 0.005),
            width: s * 0.15,
            height: s * 0.075),
        footPaint);
    canvas.drawOval(
        Rect.fromCenter(
            center: Offset(cx + bodyW * 0.22, top + bodyH + s * 0.005),
            width: s * 0.15,
            height: s * 0.075),
        footPaint);

    // arms (behind body edges)
    final armPaint = Paint()
      ..color = _shade(color, -0.1)
      ..strokeWidth = s * 0.06
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final shoulderY = top + bodyH * 0.55;
    final lx = cx - bodyW / 2 + s * 0.01, rx = cx + bodyW / 2 - s * 0.01;
    switch (mood) {
      case PaymentOutcome.success:
        final w = math.sin(t * tau * 2) * 0.35;
        canvas.drawLine(Offset(lx, shoulderY),
            Offset(lx - s * 0.12, shoulderY - s * (0.20 + w * 0.06)), armPaint);
        canvas.drawLine(Offset(rx, shoulderY),
            Offset(rx + s * 0.12, shoulderY - s * (0.20 - w * 0.06)), armPaint);
        break;
      case PaymentOutcome.failed:
        canvas.drawLine(Offset(lx, shoulderY),
            Offset(lx - s * 0.07, shoulderY + s * 0.16), armPaint);
        canvas.drawLine(Offset(rx, shoulderY),
            Offset(rx + s * 0.07, shoulderY + s * 0.16), armPaint);
        break;
      case PaymentOutcome.cancelled:
        final sh2 = math.sin(t * tau) * 0.02;
        canvas.drawLine(Offset(lx, shoulderY),
            Offset(lx - s * 0.12, shoulderY - s * (0.02 + sh2)), armPaint);
        canvas.drawLine(Offset(rx, shoulderY),
            Offset(rx + s * 0.12, shoulderY - s * (0.02 - sh2)), armPaint);
        break;
      case PaymentOutcome.pending:
        canvas.drawLine(Offset(lx, shoulderY),
            Offset(lx - s * 0.09, shoulderY + s * 0.10), armPaint);
        // one hand on the chin / head scratch
        canvas.drawLine(Offset(rx, shoulderY),
            Offset(rx + s * 0.07, shoulderY - s * 0.16), armPaint);
        break;
    }

    // body
    final bodyShader = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [_shade(color, 0.18), _shade(color, -0.12)],
    ).createShader(bodyRect);
    final rr = RRect.fromRectAndRadius(bodyRect, Radius.circular(s * 0.26));
    canvas.drawRRect(rr, Paint()..shader = bodyShader);
    // belly shine
    canvas.drawOval(
      Rect.fromLTWH(bodyRect.left + bodyW * 0.14, bodyRect.top + bodyH * 0.08,
          bodyW * 0.26, bodyH * 0.14),
      Paint()..color = Colors.white.withValues(alpha: 0.28),
    );

    // face
    final eyeY = top + bodyH * 0.38;
    final eyeDx = bodyW * 0.22;
    final eyeR = s * 0.066;
    final white = Paint()..color = Colors.white;
    final ink = Paint()..color = const Color(0xFF1C1C1E);
    final blinkPhase = (t * 3) % 1;
    final blink = blinkPhase > 0.94 ? 0.12 : 1.0;

    void eye(double dx, {Offset look = Offset.zero}) {
      final c = Offset(cx + dx, eyeY);
      canvas.save();
      canvas.translate(c.dx, c.dy);
      canvas.scale(1, blink);
      canvas.drawCircle(Offset.zero, eyeR, white);
      canvas.drawCircle(look, eyeR * 0.55, ink);
      canvas.drawCircle(look + Offset(eyeR * 0.18, -eyeR * 0.2), eyeR * 0.16, white);
      canvas.restore();
    }

    final stroke = Paint()
      ..color = const Color(0xFF1C1C1E)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.02
      ..strokeCap = StrokeCap.round;

    switch (mood) {
      case PaymentOutcome.success:
        // happy ^ ^ eyes
        for (final dx in [-eyeDx, eyeDx]) {
          final c = Offset(cx + dx, eyeY + s * 0.01);
          canvas.drawArc(
              Rect.fromCenter(center: c, width: eyeR * 2.1, height: eyeR * 1.7),
              math.pi, math.pi, false,
              stroke..strokeWidth = s * 0.026);
        }
        // big smile
        final mouth = Path()
          ..moveTo(cx - bodyW * 0.15, top + bodyH * 0.56)
          ..quadraticBezierTo(cx, top + bodyH * 0.80, cx + bodyW * 0.15, top + bodyH * 0.56)
          ..close();
        canvas.drawPath(mouth, ink);
        canvas.drawOval(
            Rect.fromCenter(
                center: Offset(cx, top + bodyH * 0.69),
                width: bodyW * 0.14,
                height: bodyH * 0.06),
            Paint()..color = const Color(0xFFFF6B7A));
        // cheeks
        final cheek = Paint()..color = Colors.white.withValues(alpha: 0.28);
        canvas.drawCircle(Offset(cx - bodyW * 0.33, top + bodyH * 0.55), s * 0.035, cheek);
        canvas.drawCircle(Offset(cx + bodyW * 0.33, top + bodyH * 0.55), s * 0.035, cheek);
        break;
      case PaymentOutcome.failed:
        eye(-eyeDx, look: Offset(0, eyeR * 0.25));
        eye(eyeDx, look: Offset(0, eyeR * 0.25));
        // sad brows
        canvas.drawLine(Offset(cx - eyeDx - eyeR * 1.1, eyeY - eyeR * 1.9),
            Offset(cx - eyeDx + eyeR * 0.9, eyeY - eyeR * 1.4), stroke);
        canvas.drawLine(Offset(cx + eyeDx + eyeR * 1.1, eyeY - eyeR * 1.9),
            Offset(cx + eyeDx - eyeR * 0.9, eyeY - eyeR * 1.4), stroke);
        // frown
        canvas.drawArc(
            Rect.fromCenter(
                center: Offset(cx, top + bodyH * 0.74),
                width: bodyW * 0.28,
                height: bodyH * 0.16),
            math.pi, math.pi, false, stroke);
        // sweat drop sliding down
        final dropT = (t * 1.5) % 1;
        final dp = Offset(cx + bodyW * 0.36, top + bodyH * (0.12 + dropT * 0.28));
        final drop = Path()
          ..moveTo(dp.dx, dp.dy - s * 0.04)
          ..quadraticBezierTo(dp.dx + s * 0.035, dp.dy + s * 0.005, dp.dx, dp.dy + s * 0.03)
          ..quadraticBezierTo(dp.dx - s * 0.035, dp.dy + s * 0.005, dp.dx, dp.dy - s * 0.04);
        canvas.drawPath(drop,
            Paint()..color = const Color(0xFF64D2FF).withValues(alpha: 1 - dropT * 0.6));
        break;
      case PaymentOutcome.cancelled:
        eye(-eyeDx);
        eye(eyeDx);
        // flat, slightly wavy mouth
        final m = Path()
          ..moveTo(cx - bodyW * 0.12, top + bodyH * 0.70)
          ..quadraticBezierTo(cx - bodyW * 0.04, top + bodyH * 0.67, cx, top + bodyH * 0.70)
          ..quadraticBezierTo(cx + bodyW * 0.04, top + bodyH * 0.73, cx + bodyW * 0.12, top + bodyH * 0.70);
        canvas.drawPath(m, stroke);
        // raised brow
        canvas.drawLine(Offset(cx + eyeDx - eyeR, eyeY - eyeR * 1.8),
            Offset(cx + eyeDx + eyeR, eyeY - eyeR * 2.1), stroke);
        break;
      case PaymentOutcome.pending:
        final look = Offset(math.sin(t * tau) * eyeR * 0.45, -eyeR * 0.15);
        eye(-eyeDx, look: look);
        eye(eyeDx, look: look);
        canvas.drawOval(
            Rect.fromCenter(
                center: Offset(cx, top + bodyH * 0.72),
                width: bodyW * 0.10,
                height: bodyH * 0.11),
            stroke);
        break;
    }
    canvas.restore();

    // accessories above the head
    if (mood == PaymentOutcome.pending) {
      final ctr = Offset(cx, top - s * 0.04);
      for (var i = 0; i < 3; i++) {
        final a = t * tau + i * tau / 3;
        final p = ctr + Offset(math.cos(a) * s * 0.14, math.sin(a) * s * 0.035);
        canvas.drawCircle(
            p,
            s * 0.022,
            Paint()
              ..color = color.withValues(alpha: 0.35 + 0.65 * ((math.sin(a) + 1) / 2)));
      }
    }
    if (mood == PaymentOutcome.success) {
      // twinkling stars
      for (var i = 0; i < 3; i++) {
        final ph = (t * 2 + i * 0.33) % 1;
        final scale = math.sin(ph * math.pi);
        final c = [Offset(s * 0.16, s * 0.28), Offset(s * 0.86, s * 0.22), Offset(s * 0.80, s * 0.58)][i];
        _star(canvas, c, s * 0.04 * scale, const Color(0xFFFFD60A));
      }
    }
    if (mood == PaymentOutcome.cancelled) {
      final ph = (t * 1.2) % 1;
      final tp = TextPainter(
        text: TextSpan(
            text: '?',
            style: TextStyle(
                fontSize: s * 0.14,
                fontWeight: FontWeight.w800,
                color: color.withValues(alpha: 1 - ph * 0.7))),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(cx + bodyW * 0.30, top - s * (0.02 + ph * 0.07)));
    }
  }

  void _star(Canvas canvas, Offset c, double r, Color col) {
    if (r <= 0.1) return;
    final path = Path();
    for (var i = 0; i < 8; i++) {
      final a = i * math.pi / 4;
      final rr = i.isEven ? r : r * 0.38;
      final p = c + Offset(math.cos(a) * rr, math.sin(a) * rr);
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    path.close();
    canvas.drawPath(path, Paint()..color = col);
  }

  Color _shade(Color c, double amt) {
    final hsl = HSLColor.fromColor(c);
    return hsl.withLightness((hsl.lightness + amt).clamp(0.0, 1.0)).toColor();
  }

  @override
  bool shouldRepaint(covariant _BuddyPainter old) =>
      old.t != t || old.mood != mood || old.color != color;
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter({required this.t});
  final double t;
  static const _colors = [
    Color(0xFF30C46F), Color(0xFFFFD60A), Color(0xFF0A84FF),
    Color(0xFFFF453A), Color(0xFFBF5AF2), Color(0xFFFF9F0A),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(7);
    for (var i = 0; i < 34; i++) {
      final x0 = rnd.nextDouble();
      final speed = 0.5 + rnd.nextDouble() * 0.9;
      final phase = rnd.nextDouble();
      final sway = (rnd.nextDouble() - 0.5) * 0.12;
      final w = 5.0 + rnd.nextDouble() * 6;
      final yy = ((t * speed + phase) % 1.0);
      final x = (x0 + math.sin((t + phase) * math.pi * 2) * sway) * size.width;
      final y = yy * (size.height + 40) - 20;
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate((t * 6 + phase * 6) * (i.isEven ? 1 : -1));
      canvas.drawRRect(
        RRect.fromRectAndRadius(
            Rect.fromCenter(center: Offset.zero, width: w, height: w * 1.7),
            const Radius.circular(2)),
        Paint()..color = _colors[i % _colors.length].withValues(alpha: 0.85),
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter old) => old.t != t;
}
