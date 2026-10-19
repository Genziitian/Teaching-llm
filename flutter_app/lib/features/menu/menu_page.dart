import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/neu_card.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_typography.dart';

class MenuPage extends ConsumerWidget {
  const MenuPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).value;
    final name = user?.name ?? 'Student';
    final role = user?.role ?? 'STUDENT';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
      children: [
        NeuCard(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: AppShadows.sm,
                ),
                alignment: Alignment.center,
                child: Text(
                  name[0].toUpperCase(),
                  style: const TextStyle(
                    fontFamily: 'Outfit',
                    color: AppColors.textInverse,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: AppTypography.title),
                    const SizedBox(height: 2),
                    Text(
                      '${role[0]}${role.substring(1).toLowerCase()}',
                      style: AppTypography.bodyMuted.copyWith(fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        const _SectionLabel('ACCOUNT'),
        const SizedBox(height: 8),
        _Tile(
            icon: Icons.person_outline,
            label: 'Profile',
            onTap: () => context.go('/profile')),
        _Tile(
            icon: Icons.download_done_rounded,
            label: 'Downloads',
            onTap: () => context.push('/downloads')),
        _Tile(
            icon: Icons.notifications_outlined,
            label: 'Notifications',
            onTap: () => context.go('/notifications')),
        const SizedBox(height: 22),
        const _SectionLabel('INFORMATION'),
        const SizedBox(height: 8),
        _Tile(
            icon: Icons.help_outline,
            label: 'FAQ',
            onTap: () => context.go('/faq')),
        _Tile(icon: Icons.info_outline,            label: 'About Us',           onTap: () {}),
        _Tile(icon: Icons.shield_outlined,         label: 'Privacy Policy',     onTap: () {}),
        _Tile(icon: Icons.description_outlined,    label: 'Terms & Conditions', onTap: () {}),
        _Tile(icon: Icons.replay_outlined,         label: 'Refund Policy',      onTap: () {}),
        const SizedBox(height: 22),
        const _SectionLabel('SOCIAL'),
        const SizedBox(height: 8),
        const _SocialTile(
          label: 'Instagram',
          icon: Icons.camera_alt_outlined,
          background: LinearGradient(colors: [
            Color(0xFFF09433), Color(0xFFE6683C), Color(0xFFDC2743),
            Color(0xFFCC2366), Color(0xFFBC1888)
          ]),
          url: 'https://www.instagram.com/genz_iitian/',
        ),
        const _SocialTile(
          label: 'YouTube',
          icon: Icons.play_circle_filled,
          background: Color(0xFFFFFFFF),
          iconColor: Color(0xFFFF0000),
          url: 'https://www.youtube.com/@Gen-ZIITian/videos',
        ),
        const _SocialTile(
          label: 'LinkedIn',
          icon: Icons.business_center_outlined,
          background: Color(0xFF0A66C2),
          url: 'https://www.linkedin.com/company/genz-iitian',
        ),
        const _SocialTile(
          label: 'Telegram',
          icon: Icons.send,
          background: Color(0xFF229ED9),
          url: 'https://t.me/IIT_madras_Resources',
        ),
        const SizedBox(height: 22),
        const _SectionLabel('SESSION'),
        const SizedBox(height: 8),
        _Tile(
          icon: Icons.logout,
          label: 'Sign Out',
          danger: true,
          onTap: () async {
            await ref.read(authStateProvider.notifier).signOut();
          },
        ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(text,
          style: AppTypography.uppercase.copyWith(letterSpacing: 1.8)),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: NeuCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        onTap: onTap,
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: danger
                    ? AppColors.dangerLight
                    : AppColors.primary.withOpacity(0.10),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Icon(icon,
                  size: 18,
                  color: danger ? AppColors.danger : AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: AppTypography.title.copyWith(
                  fontSize: 14.5,
                  color: danger ? AppColors.danger : AppColors.textPrimary,
                ),
              ),
            ),
            Icon(Icons.chevron_right,
                color: danger ? AppColors.danger : AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class _SocialTile extends StatelessWidget {
  const _SocialTile({
    required this.label,
    required this.icon,
    required this.background,
    required this.url,
    this.iconColor = Colors.white,
  });

  final String label;
  final IconData icon;
  final Object background; // Color or Gradient
  final String url;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    // Type-promote through if/else so the BoxDecoration arguments are
    // strongly typed. A ternary on a generic Object parameter doesn't
    // promote in Dart's flow analysis.
    Color? bgColor;
    Gradient? bgGradient;
    final bg = background;
    if (bg is Color) {
      bgColor = bg;
    } else if (bg is Gradient) {
      bgGradient = bg;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: NeuCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Opening $label: $url')),
          );
        },
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: bgColor,
                gradient: bgGradient,
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [
                  BoxShadow(color: Color(0x1A0F172A), offset: Offset(0, 4), blurRadius: 10),
                ],
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: iconColor, size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(child: Text(label, style: AppTypography.title.copyWith(fontSize: 14))),
            const Icon(Icons.north_east, color: AppColors.textMuted, size: 16),
          ],
        ),
      ),
    );
  }
}
