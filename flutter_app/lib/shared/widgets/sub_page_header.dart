import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/nav_history_observer.dart';
import '../../theme/app_theme_tokens.dart';
import 'bouncy_pressable.dart';

/// Permanent / Sticky header used across the Flutter app.
/// Provides a consistent, responsive header with:
/// - Compact back button (left)
/// - Left-aligned bold title + optional subtitle
/// - Optional right action slot
/// - Optional bottom slot (e.g. tab bar)
/// - Clean subtle theme-aware bottom divider
class SubPageHeader extends StatelessWidget {
  const SubPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.right,
    this.onBack,
    this.showBack = true,
    this.showLine = true,
    this.bottom,
    this.padding,
    this.backgroundColor,
  });

  final String title;
  final String? subtitle;
  final Widget? right;
  final VoidCallback? onBack;
  final bool showBack;
  final bool showLine;
  final Widget? bottom;
  final EdgeInsetsGeometry? padding;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final bg = backgroundColor ?? tokens.bg;

    return Container(
      color: bg,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: padding ?? const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                if (showBack) ...[
                  BouncyPressable(
                    onTap: () async {
                      HapticFeedback.lightImpact();
                      if (onBack != null) {
                        onBack!();
                      } else if (Navigator.of(context).canPop()) {
                        Navigator.of(context).pop();
                      } else if (context.canPop()) {
                        context.pop();
                      } else {
                        final handled =
                            await AppNavHistoryObserver.instance.didPopRoute();
                        if (!handled && context.mounted) {
                          context.go('/dashboard');
                        }
                      }
                    },
                    scaleDown: 0.92,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: tokens.surfaceSecondary,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: tokens.border),
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        Icons.chevron_left,
                        size: 22,
                        color: tokens.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          color: tokens.textPrimary,
                          letterSpacing: -0.5,
                          height: 1.15,
                        ),
                      ),
                      if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w500,
                            color: tokens.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (right != null) ...[
                  const SizedBox(width: 8),
                  right!,
                ],
              ],
            ),
          ),
          if (bottom != null) bottom!,
          if (showLine)
            Container(
              height: 1,
              color: tokens.border,
            ),
        ],
      ),
    );
  }
}

/// Standard page scaffold with a sticky, permanent page header and scrollable body.
class AppPageScaffold extends StatelessWidget {
  const AppPageScaffold({
    super.key,
    required this.title,
    this.subtitle,
    this.showBack = true,
    this.onBack,
    this.right,
    this.bottom,
    this.showLine = true,
    this.headerBackgroundColor,
    this.backgroundColor,
    required this.body,
    this.floatingActionButton,
    this.bottomNavigationBar,
    this.resizeToAvoidBottomInset,
  });

  final String title;
  final String? subtitle;
  final bool showBack;
  final VoidCallback? onBack;
  final Widget? right;
  final Widget? bottom;
  final bool showLine;
  final Color? headerBackgroundColor;
  final Color? backgroundColor;
  final Widget body;
  final Widget? floatingActionButton;
  final Widget? bottomNavigationBar;
  final bool? resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final bg = backgroundColor ?? tokens.bg;

    return Scaffold(
      backgroundColor: bg,
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomNavigationBar,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SubPageHeader(
              title: title,
              subtitle: subtitle,
              showBack: showBack,
              onBack: onBack,
              right: right,
              bottom: bottom,
              showLine: showLine,
              backgroundColor: headerBackgroundColor,
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

/// Circle icon button matching CircleIcon in screens.jsx.
class CircleIconBtn extends StatelessWidget {
  const CircleIconBtn({
    super.key,
    required this.icon,
    this.color,
    this.onTap,
  });
  final IconData icon;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final iconColor = color ?? tokens.textPrimary;

    return InkResponse(
      onTap: onTap,
      radius: 20,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: tokens.surfaceSecondary,
          shape: BoxShape.circle,
          border: Border.all(color: tokens.border),
        ),
        child: Icon(icon, size: 18, color: iconColor),
      ),
    );
  }
}
