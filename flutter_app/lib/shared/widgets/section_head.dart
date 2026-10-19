import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../theme/app_theme_tokens.dart';

/// Section heading row: bold title, optional subtitle, optional right-aligned
/// "See all →" link, with a theme-aware separator line.
class SectionHead extends StatelessWidget {
  const SectionHead({
    super.key,
    required this.title,
    this.subtitle,
    this.right,
    this.onRightTap,
    this.topPadding = 24,
    this.showLine = false,
  });

  final String title;
  final String? subtitle;
  final String? right;
  final VoidCallback? onRightTap;
  final double topPadding;
  final bool showLine;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Padding(
      padding: EdgeInsets.only(top: topPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                        color: tokens.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                          color: tokens.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (right != null)
                InkWell(
                  onTap: onRightTap,
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                    child: Row(
                      children: [
                        Text(
                          right!,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                            color: tokens.primaryAccent,
                          ),
                        ),
                        const SizedBox(width: 3),
                        Icon(
                          Symbols.arrow_forward_ios_rounded,
                          size: 12,
                          color: tokens.primaryAccent, weight: 700,),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          if (showLine) ...[
            const SizedBox(height: 8),
            Divider(color: tokens.divider, thickness: 1.2, height: 1),
          ],
        ],
      ),
    );
  }
}
