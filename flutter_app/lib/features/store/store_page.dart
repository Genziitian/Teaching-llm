import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';

/// Store home: Buy Course and Premium Notes.
class StorePage extends StatelessWidget {
  const StorePage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPageScaffold(
      title: 'Store',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/academics'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
        children: [
          _StoreTile(
            title: 'Buy Premium Notes',
            cta: 'View notes',
            subtitle: 'Formula sheets, notes, solved papers and more',
            icon: Symbols.description_rounded,
            image: 'assets/store/store-notes.webp',
            gradient: const [Color(0xFF1E8E3E), Color(0xFF0F5C28)],
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/store/notes');
            },
          ),
          const SizedBox(height: 16),
          _StoreTile(
            title: 'Buy Course',
            cta: 'View courses',
            subtitle: 'Full courses with lectures and live classes.',
            icon: Symbols.school_rounded,
            image: 'assets/store/store-course.webp',
            gradient: const [Color(0xFF0A84FF), Color(0xFF0A4FB8)],
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/store/courses');
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
    required this.cta,
    this.subtitle,
    required this.icon,
    required this.gradient,
    this.image,
    required this.onTap,
    this.comingSoon = false,
  });

  final String title;
  final String cta;
  final String? subtitle;
  final IconData icon;
  final List<Color> gradient;
  final String? image;
  final VoidCallback onTap;
  final bool comingSoon;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ApplePressable(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: tokens.border, width: 0.5),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Colour "poster" on top, white details below: clearly different
            // from the full-colour term cards on the next screen.
            if (image != null)
              AspectRatio(
                // Narrower than the artwork on purpose: crops the empty left
                // side so the picture sits in the middle of the banner.
                aspectRatio: 2.15,
                child: Image.asset(
                  image!,
                  fit: BoxFit.cover,
                  alignment: const Alignment(1.0, 0),
                  gaplessPlayback: true,
                ),
              )
            else
            Container(
              height: 118,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: gradient,
                ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    right: -10,
                    top: -18,
                    child: Container(
                      width: 110,
                      height: 110,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.12),
                      ),
                    ),
                  ),
                  Positioned(
                    left: -24,
                    bottom: -40,
                    child: Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.10),
                      ),
                    ),
                  ),
                  Center(
                    child: Container(
                      width: 68,
                      height: 68,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.24),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Icon(icon, size: 36, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 18, 22, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.6,
                    ),
                  ),
                  if (subtitle != null && subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      subtitle!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: tokens.textSecondary,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w500,
                        height: 1.35,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Container(
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: gradient.last,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          cta,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Symbols.arrow_forward_rounded,
                            size: 19, color: Colors.white),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
