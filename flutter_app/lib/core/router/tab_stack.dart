import 'package:material_ui/material_ui.dart';

/// Keeps every main tab alive (scroll position and loaded data are kept, so
/// coming back to a tab shows it fully drawn) and switches between them
/// instantly, with no fade, so a tab never appears half-drawn.
class TabStack extends StatelessWidget {
  const TabStack({super.key, required this.index, required this.children});

  final int index;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < children.length; i++)
          Offstage(
            offstage: i != index,
            child: TickerMode(
              enabled: i == index,
              child: RepaintBoundary(child: children[i]),
            ),
          ),
      ],
    );
  }
}
