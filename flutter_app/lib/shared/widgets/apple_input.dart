import 'package:material_ui/material_ui.dart';

import '../../theme/app_theme_tokens.dart';

/// Apple-style text field look: soft filled surface, no outline, accent ring
/// only while focused. Use with [TextField] / [DropdownButtonFormField].
InputDecoration appleInputDecoration(
  BuildContext context, {
  String? label,
  String? hint,
  Widget? prefixIcon,
  bool alignLabelWithHint = false,
  String? counterText,
  double radius = 14,
  Color? fill,
}) {
  final t = context.tokens;
  final none = OutlineInputBorder(
    borderRadius: BorderRadius.circular(radius),
    borderSide: BorderSide.none,
  );
  return InputDecoration(
    labelText: label,
    hintText: hint,
    prefixIcon: prefixIcon,
    alignLabelWithHint: alignLabelWithHint,
    counterText: counterText,
    filled: true,
    fillColor: fill ?? t.cardBg,
    border: none,
    enabledBorder: none,
    disabledBorder: none,
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(radius),
      borderSide: BorderSide(color: t.primaryAccent, width: 1.5),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    hintStyle: TextStyle(color: t.textMuted, fontWeight: FontWeight.w400),
    labelStyle: TextStyle(color: t.textSecondary),
  );
}
