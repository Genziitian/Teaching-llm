import 'package:material_ui/material_ui.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_typography.dart';

import 'bouncy_pressable.dart';

enum NeuButtonVariant { primary, dark, ghost, danger }

/// Pill button — matches the web app's full-width CTAs with tactile press feedback.
class NeuButton extends StatelessWidget {
  const NeuButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.variant = NeuButtonVariant.primary,
    this.expanded = true,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final NeuButtonVariant variant;
  final bool expanded;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final disabled = loading || onPressed == null;
    final (bg, fg) = _palette();
    final shadows = disabled ? <BoxShadow>[] : AppShadows.pillGlow(bg);

    final content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      child: Row(
        mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (loading)
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: fg),
            )
          else if (icon != null)
            Icon(icon, color: fg, size: 18),
          if ((loading || icon != null)) const SizedBox(width: 10),
          Text(label, style: AppTypography.buttonLabel.copyWith(color: fg)),
        ],
      ),
    );

    final button = Material(
      color: bg,
      borderRadius: BorderRadius.circular(50),
      child: InkWell(
        onTap: disabled ? null : onPressed,
        borderRadius: BorderRadius.circular(50),
        child: content,
      ),
    );

    return BouncyPressable(
      onTap: disabled ? null : onPressed,
      scaleDown: 0.97,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: expanded ? double.infinity : null,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(50),
          boxShadow: shadows,
        ),
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 150),
          opacity: disabled ? 0.65 : 1,
          child: button,
        ),
      ),
    );
  }

  (Color, Color) _palette() {
    switch (variant) {
      case NeuButtonVariant.primary:
        return (AppColors.primary, AppColors.textInverse);
      case NeuButtonVariant.dark:
        return (AppColors.textPrimary, AppColors.textInverse);
      case NeuButtonVariant.danger:
        return (AppColors.danger, AppColors.textInverse);
      case NeuButtonVariant.ghost:
        return (AppColors.cardWhite, AppColors.textPrimary);
    }
  }
}
