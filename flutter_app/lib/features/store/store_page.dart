import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';

/// Store home: Buy Course (coming soon) and Premium Notes.
class StorePage extends StatelessWidget {
  const StorePage({super.key});

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return AppPageScaffold(
      title: 'Store',
      subtitle: 'Buy course and premium study material',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/academics'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
        children: [
          _StoreTile(
            title: 'Buy Premium Notes',
            subtitle: 'Formula sheets, notes, solved papers and more',
            icon: Symbols.description_rounded,
            gradient: const [Color(0xFF1E8E3E), Color(0xFF0F5C28)],
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/store/notes');
            },
          ),
          const SizedBox(height: 14),
          _StoreTile(
            title: 'Buy Course',
            subtitle: 'Full courses with lectures and live classes.',
            icon: Symbols.school_rounded,
            gradient: [
              tokens.textMuted.withValues(alpha: 0.9),
              tokens.textMuted.withValues(alpha: 0.6),
            ],
            comingSoon: true,
            onTap: () {
              HapticFeedback.selectionClick();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Courses are coming soon.')),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _StoreTile extends StatelessWidget {
  const _StoreTile({
    required this.title,
    this.subtitle,
    required this.icon,
    required this.gradient,
    required this.onTap,
    this.comingSoon = false,
  });

  final String title;
  final String? subtitle;
  final IconData icon;
  final List<Color> gradient;
  final VoidCallback onTap;
  final bool comingSoon;

  @override
  Widget build(BuildContext context) {
    return ApplePressable(
      onTap: onTap,
      child: Container(
        height: 168,
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradient,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Positioned(
              right: -14,
              bottom: -26,
              child: Icon(icon,
                  size: 130, color: Colors.white.withValues(alpha: 0.16)),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 28, color: Colors.white),
                    const Spacer(),
                    if (comingSoon)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.22),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          'Coming soon',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
                const Spacer(),
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.92),
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                      height: 1.3,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
