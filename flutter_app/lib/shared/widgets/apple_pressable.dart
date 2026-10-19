import 'package:material_ui/material_ui.dart';

/// Apple-style press feedback: reacts the instant a finger touches down,
/// scales with a critically-damped curve (no bounce) and eases back on
/// release. Respects the system "remove animations" setting.
/// Strong ease-out (cubic-bezier(0.23, 1, 0.32, 1)): the built-in Flutter
/// curves are too weak; this one starts fast so feedback feels instant.
const Curve kEaseOutStrong = Cubic(0.23, 1, 0.32, 1);

class ApplePressable extends StatefulWidget {
  const ApplePressable({
    super.key,
    required this.child,
    this.onTap,
    this.pressedScale = 0.97,
    this.pressedOpacity = 1.0,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double pressedScale;
  final double pressedOpacity;

  @override
  State<ApplePressable> createState() => _ApplePressableState();
}

class _ApplePressableState extends State<ApplePressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final enabled = widget.onTap != null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: enabled ? (_) => _set(true) : null,
      onTapUp: enabled ? (_) => _set(false) : null,
      onTapCancel: enabled ? () => _set(false) : null,
      onTap: widget.onTap,
      child: AnimatedOpacity(
        opacity: _down ? widget.pressedOpacity : 1.0,
        duration: Duration(milliseconds: _down ? 80 : 200),
        child: AnimatedScale(
          scale: (_down && !reduceMotion) ? widget.pressedScale : 1.0,
          duration: Duration(milliseconds: _down ? 100 : 200),
          curve: kEaseOutStrong,
          child: widget.child,
        ),
      ),
    );
  }
}
