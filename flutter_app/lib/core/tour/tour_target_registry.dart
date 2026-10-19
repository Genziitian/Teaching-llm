import 'package:material_ui/material_ui.dart';

/// Global registry mapping tour target string IDs (e.g. 'dashboard_hero', 'nav_courses')
/// to GlobalKeys mounted in the active Flutter widget tree.
class TourTargetRegistry {
  TourTargetRegistry._();
  static final TourTargetRegistry instance = TourTargetRegistry._();

  final Map<String, GlobalKey> _keys = {};

  GlobalKey register(String id) {
    return _keys.putIfAbsent(id, () => GlobalKey(debugLabel: 'tour_target_$id'));
  }

  GlobalKey? getKey(String id) => _keys[id];

  Rect? getTargetBounds(String id) {
    final key = _keys[id];
    if (key == null) return null;
    final context = key.currentContext;
    if (context == null) return null;
    final renderBox = context.findRenderObject() as RenderBox?;
    if (renderBox == null || !renderBox.attached) return null;

    final position = renderBox.localToGlobal(Offset.zero);
    final size = renderBox.size;
    return Rect.fromLTWH(position.dx, position.dy, size.width, size.height);
  }
}

/// Helper widget that automatically registers and binds a GlobalKey for tour targeting.
class TourTarget extends StatefulWidget {
  const TourTarget({
    super.key,
    required this.id,
    required this.child,
  });

  final String id;
  final Widget child;

  @override
  State<TourTarget> createState() => _TourTargetState();
}

class _TourTargetState extends State<TourTarget> {
  late GlobalKey _key;

  @override
  void initState() {
    super.initState();
    _key = TourTargetRegistry.instance.register(widget.id);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      key: _key,
      child: widget.child,
    );
  }
}
