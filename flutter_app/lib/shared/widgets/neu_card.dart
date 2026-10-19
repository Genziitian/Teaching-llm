import 'package:material_ui/material_ui.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_shadows.dart';

import 'bouncy_pressable.dart';

/// Flat white card with a 1px hairline border and a soft single drop shadow.
/// Matches the redesign — features spring micro-interactions on tap.
class NeuCard extends StatelessWidget {
  const NeuCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.borderRadius = 18,
    this.color = AppColors.surface,
    this.shadows,
    this.border,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final Color color;
  final List<BoxShadow>? shadows;
  final BoxBorder? border;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(borderRadius);

    final decorated = Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: radius,
        boxShadow: shadows ?? AppShadows.sm,
        border: border ?? Border.all(color: AppColors.line, width: 1),
      ),
      padding: padding,
      child: child,
    );

    if (onTap == null) return decorated;

    return BouncyPressable(
      onTap: onTap,
      scaleDown: 0.98,
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: decorated,
        ),
      ),
    );
  }
}

