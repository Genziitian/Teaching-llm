import 'dart:math';
import 'package:flutter/material.dart';

/// Lightweight, zero-dependency confetti particle burst matching the web Party Pips.
/// Spawns physics-based particles that burst outwards and gently drift down with gravity.
class PartyPips {
  PartyPips._();

  static const List<Color> _palette = [
    Color(0xFF6366F1), // Indigo
    Color(0xFF8B5CF6), // Violet
    Color(0xFFEC4899), // Pink
    Color(0xFFF59E0B), // Amber
    Color(0xFF10B981), // Emerald
    Color(0xFF06B6D4), // Cyan
    Color(0xFFF97316), // Orange
    Color(0xFFEF4444), // Red
  ];

  /// Pop confetti particles centered on [origin] or in the screen center.
  static void pop(BuildContext context, {Offset? origin}) {
    final overlayState = Overlay.of(context);
    late OverlayEntry entry;

    final mediaQuery = MediaQuery.of(context);
    final target = origin ??
        Offset(mediaQuery.size.width / 2, mediaQuery.size.height / 2.5);

    entry = OverlayEntry(
      builder: (ctx) => _PartyPipsOverlay(
        origin: target,
        onFinished: () {
          entry.remove();
        },
      ),
    );

    overlayState.insert(entry);
  }
}

class _PartyPipsOverlay extends StatefulWidget {
  const _PartyPipsOverlay({
    required this.origin,
    required this.onFinished,
  });

  final Offset origin;
  final VoidCallback onFinished;

  @override
  State<_PartyPipsOverlay> createState() => _PartyPipsOverlayState();
}

class _Particle {
  _Particle({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
    required this.size,
    required this.color,
    required this.shape,
    required this.rotation,
    required this.rotationSpeed,
  });

  double x;
  double y;
  double vx;
  double vy;
  final double size;
  final Color color;
  final int shape; // 0 = circle, 1 = rect, 2 = star/cross
  double rotation;
  final double rotationSpeed;
}

class _PartyPipsOverlayState extends State<_PartyPipsOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<_Particle> _particles = [];
  final Random _rng = Random();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    );

    // Create 36 particles bursting in 360 degrees
    for (int i = 0; i < 36; i++) {
      final angle = _rng.nextDouble() * 2 * pi;
      final speed = 120.0 + _rng.nextDouble() * 260.0;
      _particles.add(
        _Particle(
          x: widget.origin.dx,
          y: widget.origin.dy,
          vx: cos(angle) * speed,
          vy: sin(angle) * speed - 60.0, // Initial upward lift
          size: 4.5 + _rng.nextDouble() * 6.5,
          color: PartyPips._palette[_rng.nextInt(PartyPips._palette.length)],
          shape: _rng.nextInt(3),
          rotation: _rng.nextDouble() * pi,
          rotationSpeed: (_rng.nextDouble() - 0.5) * 8.0,
        ),
      );
    }

    _controller.forward().then((_) {
      if (mounted) widget.onFinished();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final progress = _controller.value;
          final opacity = (1.0 - progress).clamp(0.0, 1.0);

          return CustomPaint(
            size: Size.infinite,
            painter: _PartyPipsPainter(
              particles: _particles,
              progress: progress,
              opacity: opacity,
            ),
          );
        },
      ),
    );
  }
}

class _PartyPipsPainter extends CustomPainter {
  _PartyPipsPainter({
    required this.particles,
    required this.progress,
    required this.opacity,
  });

  final List<_Particle> particles;
  final double progress;
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    if (opacity <= 0) return;

    final dt = progress;
    final gravity = 420.0 * dt * dt; // Quad gravity acceleration
    final drag = 1.0 - (dt * 0.35);

    for (final p in particles) {
      final currentX = p.x + (p.vx * dt * drag);
      final currentY = p.y + (p.vy * dt * drag) + gravity;
      final currentRotation = p.rotation + (p.rotationSpeed * dt);

      final paint = Paint()
        ..color = p.color.withOpacity(opacity * p.color.opacity)
        ..style = PaintingStyle.fill;

      canvas.save();
      canvas.translate(currentX, currentY);
      canvas.rotate(currentRotation);

      if (p.shape == 0) {
        // Circle
        canvas.drawCircle(Offset.zero, p.size / 2, paint);
      } else if (p.shape == 1) {
        // Confetti rectangle
        canvas.drawRect(
          Rect.fromCenter(
            center: Offset.zero,
            width: p.size * 1.6,
            height: p.size * 0.8,
          ),
          paint,
        );
      } else {
        // Cross / Star particle
        final half = p.size / 2;
        canvas.drawRect(
          Rect.fromCenter(center: Offset.zero, width: p.size, height: half * 0.5),
          paint,
        );
        canvas.drawRect(
          Rect.fromCenter(center: Offset.zero, width: half * 0.5, height: p.size),
          paint,
        );
      }

      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _PartyPipsPainter oldDelegate) => true;
}
