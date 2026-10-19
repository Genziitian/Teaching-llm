import 'dart:async';
import 'dart:math';
import 'package:material_ui/material_ui.dart';

/// Floating, slowly drifting anti-piracy watermark overlay for lecture videos.
/// Displays student identifier, email, and security hash across the video surface.
class FloatingVideoWatermark extends StatefulWidget {
  const FloatingVideoWatermark({
    super.key,
    required this.userText,
    this.opacity = 0.28,
  });

  final String userText;
  final double opacity;

  @override
  State<FloatingVideoWatermark> createState() => _FloatingVideoWatermarkState();
}

class _FloatingVideoWatermarkState extends State<FloatingVideoWatermark> {
  double _alignX = 0.0;
  double _alignY = 0.0;
  Timer? _driftTimer;
  final Random _rng = Random();

  @override
  void initState() {
    super.initState();
    _pickNewCoordinates();
    // Re-position the watermark gently every 7 seconds to prevent static crop filtering
    _driftTimer = Timer.periodic(const Duration(seconds: 7), (_) {
      if (mounted) {
        setState(() {
          _pickNewCoordinates();
        });
      }
    });
  }

  void _pickNewCoordinates() {
    // Generate random alignment between -0.75 and 0.75
    _alignX = (_rng.nextDouble() * 1.5) - 0.75;
    _alignY = (_rng.nextDouble() * 1.5) - 0.75;
  }

  @override
  void dispose() {
    _driftTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.userText.isEmpty) return const SizedBox.shrink();

    return IgnorePointer(
      child: AnimatedAlign(
        alignment: Alignment(_alignX, _alignY),
        duration: const Duration(seconds: 6),
        curve: Curves.easeInOut,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(widget.opacity * 0.4),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            widget.userText,
            style: TextStyle(
              color: Colors.white.withOpacity(widget.opacity),
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
              decoration: TextDecoration.none,
            ),
          ),
        ),
      ),
    );
  }
}
