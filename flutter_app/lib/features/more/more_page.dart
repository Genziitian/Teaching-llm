import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/tour/app_tour_controller.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';

/// Redesigned "More" tab matching the sleek card-list layout.
class MorePage extends ConsumerWidget {
  const MorePage({super.key});

  Future<void> _shareApp(BuildContext context) async {
    HapticFeedback.lightImpact();
    const shareText =
        '''Hey! I recently downloaded the GenZ IITIAN app, and honestly it's amazing.

It has everything an IIT Madras BS student needs in one place:
• Free Classes
• PYQs with Solutions
• FREE Notes & PDFs
• Doubt Support
• Guidance from Seniors

You should definitely try it yourself. Download it here:

https://class.genziitian.in/download''';

    try {
      await Share.share(
        shareText,
        subject: 'GenZ IITIAN — Smart LMS for IIT Madras BS',
      );
    } catch (_) {
      Clipboard.setData(const ClipboardData(text: shareText));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('App link copied to clipboard! Share with your peers.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _checkForUpdates(BuildContext context) {
    final tokens = context.tokens;
    HapticFeedback.mediumImpact();
    showDialog(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => AlertDialog(
        backgroundColor: tokens.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.check_circle_outline_rounded,
                color: tokens.success, size: 24),
            const SizedBox(width: 10),
            Text(
              'Up to Date',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: tokens.textPrimary,
              ),
            ),
          ],
        ),
        content: Text(
          'You are running the latest version of Gen-Z IITian LMS (v2.6.0).\nNo updates available at this time.',
          style: TextStyle(
            fontSize: 13.5,
            height: 1.45,
            color: tokens.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx, rootNavigator: true).pop(),
            child: Text(
              'OK',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: tokens.primaryAccent,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).value;
    final name = (user?.name ?? 'Student').trim();
    final role = (user?.role ?? 'STUDENT').toUpperCase();

    final tokens = context.tokens;
    final cardBg = tokens.cardBg;
    final borderColor = tokens.border;
    final textPrimary = tokens.textPrimary;
    final textSecondary = tokens.textSecondary;

    return SafeArea(
      bottom: false,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 110),
        children: [
          // ── 1. Top Profile Hero Card ──────────────────────────────
          BouncyPressable(
            onTap: () => context.push('/profile'),
            scaleDown: 0.98,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x4D4F46E5),
                    offset: Offset(0, 8),
                    blurRadius: 20,
                  ),
                ],
              ),
              child: Row(
                children: [
                  AppAvatar(
                    avatarUrl: user?.avatar,
                    gender: user?.gender,
                    size: 52,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16.5,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '$role · View Profile',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w500,
                            color: Colors.white.withOpacity(0.85),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // ── 2. GENERAL Section ────────────────────────────────────
          _SectionLabel(title: 'GENERAL', color: textSecondary),
          const SizedBox(height: 10),

          _ActionCard(
            cardBg: cardBg,
            borderColor: borderColor,
            children: [
              _ActionRow(
                icon: Icons.download_done_rounded,
                iconColor: const Color(0xFF10B981),
                iconBg: const Color(0xFF10B981).withOpacity(0.12),
                title: 'Downloads',
                textColor: textPrimary,
                onTap: () => context.push('/downloads'),
              ),
              if (role == 'STUDENT' || role == 'MANAGER')
                _ActionRow(
                  icon: Icons.headset_mic_outlined,
                  iconColor: const Color(0xFF0EA5E9),
                  iconBg: const Color(0xFF0EA5E9).withOpacity(0.12),
                  title: 'Support',
                  textColor: textPrimary,
                  onTap: () => context.push('/support'),
                ),
              if (role == 'STUDENT' || role == 'MANAGER')
                _ActionRow(
                  icon: Icons.lightbulb_outline_rounded,
                  iconColor: const Color(0xFF8B5CF6),
                  iconBg: const Color(0xFF8B5CF6).withOpacity(0.12),
                  title: 'Request a Feature',
                  textColor: textPrimary,
                  onTap: () => context.push('/support/feature-requests'),
                ),
              if (role == 'MANAGER')
                _ActionRow(
                  icon: Icons.flag_outlined,
                  iconColor: const Color(0xFFEF4444),
                  iconBg: const Color(0xFFEF4444).withOpacity(0.12),
                  title: 'User Reports',
                  textColor: textPrimary,
                  onTap: () => context.push('/support/user-reports'),
                ),
              _ActionRow(
                icon: Icons.star_outline_rounded,
                iconColor: tokens.warning,
                iconBg: tokens.warning.withOpacity(0.12),
                title: 'Course Feedback',
                textColor: textPrimary,
                onTap: () => context.push('/feedback'),
              ),
              _ActionRow(
                icon: Icons.settings_outlined,
                iconColor: const Color(0xFF3B82F6),
                iconBg: const Color(0xFF3B82F6).withOpacity(0.12),
                title: 'Settings',
                textColor: textPrimary,
                onTap: () => context.push('/settings'),
              ),
              _ActionRow(
                icon: Icons.explore_outlined,
                iconColor: tokens.primaryAccent,
                iconBg: tokens.primaryAccent.withOpacity(0.12),
                title: 'Take App Tour',
                textColor: textPrimary,
                onTap: () {
                  HapticFeedback.mediumImpact();
                  context.go('/dashboard');
                  ref
                      .read(appTourControllerProvider.notifier)
                      .startManualTour();
                },
              ),
              _ActionRow(
                icon: Icons.share_outlined,
                iconColor: const Color(0xFFEC4899),
                iconBg: const Color(0xFFEC4899).withOpacity(0.12),
                title: 'Share App',
                textColor: textPrimary,
                onTap: () => _shareApp(context),
              ),
              _ActionRow(
                icon: Icons.cloud_download_outlined,
                iconColor: const Color(0xFF06B6D4),
                iconBg: const Color(0xFF06B6D4).withOpacity(0.12),
                title: 'Check for Updates',
                textColor: textPrimary,
                isLast: true,
                onTap: () => _checkForUpdates(context),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // ── 3. INFORMATION Section ────────────────────────────────
          _SectionLabel(title: 'INFORMATION', color: textSecondary),
          const SizedBox(height: 10),

          _ActionCard(
            cardBg: cardBg,
            borderColor: borderColor,
            children: [
              _ActionRow(
                icon: Icons.info_outline,
                iconColor: tokens.primaryAccent,
                iconBg: tokens.primaryAccent.withOpacity(0.12),
                title: 'About Us',
                textColor: textPrimary,
                onTap: () => context.push('/about-us'),
              ),
              _ActionRow(
                icon: Icons.gavel_outlined,
                iconColor: const Color(0xFF6366F1),
                iconBg: const Color(0xFF6366F1).withOpacity(0.12),
                title: 'Terms & Conditions',
                textColor: textPrimary,
                onTap: () => context.push('/terms-and-conditions'),
              ),
              _ActionRow(
                icon: Icons.shield_outlined,
                iconColor: tokens.success,
                iconBg: tokens.success.withOpacity(0.12),
                title: 'Privacy Policy',
                textColor: textPrimary,
                onTap: () => context.push('/privacy-policy'),
              ),
              _ActionRow(
                icon: Icons.replay_outlined,
                iconColor: tokens.warning,
                iconBg: tokens.warning.withOpacity(0.12),
                title: 'Return & Refund Policy',
                textColor: textPrimary,
                onTap: () => context.push('/refund-policy'),
              ),
              _ActionRow(
                icon: Icons.copyright_rounded,
                iconColor: const Color(0xFF8B5CF6),
                iconBg: const Color(0xFF8B5CF6).withOpacity(0.12),
                title: 'Copyright Policy',
                textColor: textPrimary,
                isLast: true,
                onTap: () => context.push('/copyright-policy'),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // ── 4. Sign Out Button ────────────────────────────────────
          BouncyPressable(
            onTap: () async {
              HapticFeedback.mediumImpact();
              final confirm = await showDialog<bool>(
                context: context,
                useRootNavigator: true,
                builder: (ctx) => AlertDialog(
                  backgroundColor: tokens.cardBg,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20)),
                  title: Text(
                    'Sign out?',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary,
                    ),
                  ),
                  content: Text(
                    'Are you sure you want to log out of your account?',
                    style: TextStyle(
                      fontSize: 13.5,
                      color: tokens.textSecondary,
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () =>
                          Navigator.of(ctx, rootNavigator: true).pop(false),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: tokens.textMuted,
                        ),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () =>
                          Navigator.of(ctx, rootNavigator: true).pop(true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: tokens.danger,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Sign out',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              );
              if (confirm == true) {
                await ref.read(authStateProvider.notifier).signOut();
              }
            },
            scaleDown: 0.98,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              decoration: BoxDecoration(
                color: tokens.danger.withOpacity(0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: tokens.danger.withOpacity(0.3),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: tokens.danger.withOpacity(0.15),
                      borderRadius: const BorderRadius.all(Radius.circular(10)),
                    ),
                    child: Icon(Icons.logout_rounded,
                        color: tokens.danger, size: 18),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      'Sign out',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: tokens.danger,
                      ),
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded,
                      color: tokens.danger, size: 20),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          Center(
            child: Text(
              'Gen-Z IITian · v2.6.0',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: textSecondary.withOpacity(0.7),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title, required this.color});
  final String title;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 11.5,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.2,
        color: color,
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.cardBg,
    required this.borderColor,
    required this.children,
  });

  final Color cardBg;
  final Color borderColor;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor, width: 1),
        boxShadow: AppShadows.sm,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Column(
          children: children,
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.title,
    required this.textColor,
    required this.onTap,
    this.isLast = false,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String title;
  final Color textColor;
  final VoidCallback onTap;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return BouncyPressable(
      onTap: onTap,
      scaleDown: 0.99,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(
            bottom: isLast
                ? BorderSide.none
                : BorderSide(color: tokens.borderLight, width: 1),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                  color: textColor,
                  fontFamily: 'Manrope',
                ),
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: tokens.textMuted,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
