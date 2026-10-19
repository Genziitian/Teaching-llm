import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../theme/app_theme_tokens.dart';

/// One button of an [showAppleAlert] dialog.
class AppleAlertAction<T> {
  const AppleAlertAction({
    required this.label,
    this.value,
    this.isDefault = false,
    this.isDestructive = false,
  });

  final String label;
  final T? value;

  /// Bold, the "recommended" action.
  final bool isDefault;
  final bool isDestructive;
}

/// Apple-style alert: centred title + message on a rounded surface, hairline
/// separated full-width buttons that highlight on press-down. Two actions sit
/// side by side, three or more stack.
Future<T?> showAppleAlert<T>(
  BuildContext context, {
  required String title,
  String? message,
  IconData? icon,
  Color? iconColor,
  required List<AppleAlertAction<T>> actions,
}) {
  return showDialog<T>(
    context: context,
    useRootNavigator: true,
    barrierColor: Colors.black.withValues(alpha: 0.35),
    builder: (ctx) {
      final tokens = ctx.tokens;
      final horizontal = actions.length == 2;

      Widget button(AppleAlertAction<T> a) => _AlertButton(
            action: a,
            onTap: () => Navigator.of(ctx, rootNavigator: true).pop(a.value),
          );

      final hair = Container(
        height: 0.5,
        color: tokens.border,
      );
      final vHair = Container(width: 0.5, height: 48, color: tokens.border);

      return Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        insetPadding: const EdgeInsets.symmetric(horizontal: 44, vertical: 24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Container(
                color: tokens.cardBg,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (icon != null) ...[
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: (iconColor ?? tokens.primaryAccent)
                                    .withValues(alpha: 0.14),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(icon,
                                  fill: 1,
                                  size: 26,
                                  color: iconColor ?? tokens.primaryAccent),
                            ),
                            const SizedBox(height: 14),
                          ],
                          Text(
                            title,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.4,
                              color: tokens.textPrimary,
                            ),
                          ),
                          if (message != null) ...[
                            const SizedBox(height: 6),
                            Text(
                              message,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                height: 1.35,
                                color: tokens.textSecondary,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    hair,
                    if (horizontal)
                      IntrinsicHeight(
                        child: Row(
                          children: [
                            Expanded(child: button(actions[0])),
                            vHair,
                            Expanded(child: button(actions[1])),
                          ],
                        ),
                      )
                    else
                      for (var i = 0; i < actions.length; i++) ...[
                        if (i > 0) hair,
                        button(actions[i]),
                      ],
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

class _AlertButton<T> extends StatefulWidget {
  const _AlertButton({required this.action, required this.onTap});
  final AppleAlertAction<T> action;
  final VoidCallback onTap;

  @override
  State<_AlertButton<T>> createState() => _AlertButtonState<T>();
}

class _AlertButtonState<T> extends State<_AlertButton<T>> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final a = widget.action;
    final color = a.isDestructive ? tokens.danger : tokens.primaryAccent;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: Container(
        height: 48,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        color: _down ? tokens.surfaceSecondary : Colors.transparent,
        child: Text(
          a.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 16,
            fontWeight: a.isDefault ? FontWeight.w700 : FontWeight.w500,
            color: color,
          ),
        ),
      ),
    );
  }
}

/// Convenience: warning glyph used by destructive alerts.
const IconData kAlertWarningIcon = Symbols.warning_rounded;
