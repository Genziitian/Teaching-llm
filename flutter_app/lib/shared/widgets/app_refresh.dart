import 'package:material_ui/material_ui.dart';

import '../../theme/app_colors.dart';

/// Centralised pull-to-refresh wrapper. Uses a much smaller displacement
/// than the default Material `RefreshIndicator` (20 vs 40) so the page
/// content barely shifts when the user pulls — the loading ring just
/// appears near the top edge instead of dragging the whole page down.
class AppRefresh extends StatelessWidget {
  const AppRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      displacement: 20,
      edgeOffset: 0,
      strokeWidth: 2.5,
      color: AppColors.brand,
      backgroundColor: AppColors.surface,
      child: child,
    );
  }
}
