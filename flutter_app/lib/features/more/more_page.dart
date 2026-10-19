import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/tour/app_tour_controller.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/apple_alert.dart';
import '../../theme/app_theme_tokens.dart';
import '../updates/play_update.dart';

/// "More" tab in Apple Settings style: large title, inset grouped lists,
/// solid colored icon tiles, flat surfaces, and a centered destructive row.
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
    HapticFeedback.mediumImpact();
    checkPlayUpdateManually(context);
  }

  Future<void> _confirmSignOut(
      BuildContext context, WidgetRef ref, AppThemeTokens tokens) async {
    HapticFeedback.mediumImpact();
    final confirm = await showAppleAlert<bool>(
      context,
      title: 'Sign out?',
      message: 'Are you sure you want to log out of your account?',
      actions: const [
        AppleAlertAction(label: 'Cancel', value: false, isDefault: true),
        AppleAlertAction(label: 'Sign out', value: true, isDestructive: true),
      ],
    );
    if (confirm == true) {
      await ref.read(authStateProvider.notifier).signOut();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).value;
    final name = (user?.name ?? 'Student').trim();
    final role = (user?.role ?? 'STUDENT').toUpperCase();

    final tokens = context.tokens;
    final textPrimary = tokens.textPrimary;
    final textSecondary = tokens.textSecondary;

    return SafeArea(
      bottom: false,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          // ── Profile row (flat, like the Apple ID row) ─────────────
          _ActionCard(
            children: [
              _PressRow(
                onTap: () => context.push('/profile'),
                isLast: true,
                separatorInset: 0,
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      AppAvatar(
                        avatarUrl: user?.avatar,
                        gender: user?.gender,
                        size: 60,
                        border: Border.all(color: tokens.border, width: 0.5),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 19,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.2,
                                color: textPrimary,
                                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '$role · View Profile',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w500,
                                color: textSecondary,
                                              ),
                            ),
                          ],
                        ),
                      ),
                      const _Chevron(),
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 28),

          // ── GENERAL ───────────────────────────────────────────────
          _SectionLabel(title: 'GENERAL', color: textSecondary),
          _ActionCard(
            children: [
              _ActionRow(
                icon: Symbols.download_done_rounded,
                tile: const Color(0xFF34C759),
                title: 'Downloads',
                textColor: textPrimary,
                onTap: () => context.push('/downloads'),
              ),
              if (role == 'STUDENT' || role == 'MANAGER')
                _ActionRow(
                  icon: Symbols.headset_mic_rounded,
                  tile: const Color(0xFF007AFF),
                  title: 'Support',
                  textColor: textPrimary,
                  onTap: () => context.push('/support'),
                ),
              if (role == 'STUDENT' || role == 'MANAGER')
                _ActionRow(
                  icon: Symbols.lightbulb_rounded,
                  tile: const Color(0xFFFF9500),
                  title: 'Request a Feature',
                  textColor: textPrimary,
                  onTap: () => context.push('/support/feature-requests'),
                ),
              if (role == 'MANAGER')
                _ActionRow(
                  icon: Symbols.flag_rounded,
                  tile: const Color(0xFFFF3B30),
                  title: 'User Reports',
                  textColor: textPrimary,
                  onTap: () => context.push('/support/user-reports'),
                ),
              _ActionRow(
                icon: Symbols.star_rounded,
                tile: const Color(0xFFFFCC00),
                title: 'Course Feedback',
                textColor: textPrimary,
                onTap: () => context.push('/feedback'),
              ),
              _ActionRow(
                icon: Symbols.settings_rounded,
                tile: const Color(0xFF8E8E93),
                title: 'Settings',
                textColor: textPrimary,
                onTap: () => context.push('/settings'),
              ),
              _ActionRow(
                icon: Symbols.explore_rounded,
                tile: const Color(0xFF5856D6),
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
                icon: Symbols.ios_share_rounded,
                tile: const Color(0xFFFF2D55),
                title: 'Share App',
                textColor: textPrimary,
                onTap: () => _shareApp(context),
              ),
              _ActionRow(
                icon: Symbols.cloud_download_rounded,
                tile: const Color(0xFF32ADE6),
                title: 'Check for Updates',
                textColor: textPrimary,
                isLast: true,
                onTap: () => _checkForUpdates(context),
              ),
            ],
          ),

          const SizedBox(height: 28),

          // ── INFORMATION ───────────────────────────────────────────
          _SectionLabel(title: 'INFORMATION', color: textSecondary),
          _ActionCard(
            children: [
              _ActionRow(
                icon: Symbols.info_rounded,
                tile: const Color(0xFF007AFF),
                title: 'About Us',
                textColor: textPrimary,
                onTap: () => context.push('/about-us'),
              ),
              _ActionRow(
                icon: Symbols.gavel_rounded,
                tile: const Color(0xFF8E8E93),
                title: 'Terms & Conditions',
                textColor: textPrimary,
                onTap: () => context.push('/terms-and-conditions'),
              ),
              _ActionRow(
                icon: Symbols.shield_rounded,
                tile: const Color(0xFF34C759),
                title: 'Privacy Policy',
                textColor: textPrimary,
                onTap: () => context.push('/privacy-policy'),
              ),
              _ActionRow(
                icon: Symbols.replay_rounded,
                tile: const Color(0xFFFF9500),
                title: 'Return & Refund Policy',
                textColor: textPrimary,
                onTap: () => context.push('/refund-policy'),
              ),
              _ActionRow(
                icon: Symbols.copyright_rounded,
                tile: const Color(0xFFAF52DE),
                title: 'Copyright Policy',
                textColor: textPrimary,
                isLast: true,
                onTap: () => context.push('/copyright-policy'),
              ),
            ],
          ),

          const SizedBox(height: 28),

          // ── Sign out: its own group, centered destructive text ────
          _ActionCard(
            children: [
              _PressRow(
                onTap: () => _confirmSignOut(context, ref, tokens),
                isLast: true,
                separatorInset: 0,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  child: Center(
                    child: Text(
                      'Sign out',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: tokens.danger,
                              ),
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          Center(
            child: Text(
              'Gen-Z IITian · v2.6.0',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: tokens.textMuted,
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
    // Apple section header: small, secondary, inset to align with row content.
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
          color: color,
        ),
      ),
    );
  }
}

/// Inset grouped list: flat rounded surface, no border, no shadow.
class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Column(children: children),
      ),
    );
  }
}

class _Chevron extends StatelessWidget {
  const _Chevron();

  @override
  Widget build(BuildContext context) => Icon(
        Symbols.arrow_forward_ios_rounded,
        weight: 700,
        color: context.tokens.textMuted.withValues(alpha: 0.7),
        size: 13,
      );
}

/// A row that highlights the instant it is touched (on press-down) and
/// draws an inset hairline separator, like a UITableView cell.
class _PressRow extends StatefulWidget {
  const _PressRow({
    required this.child,
    required this.onTap,
    this.isLast = false,
    this.separatorInset = 58,
  });

  final Widget child;
  final VoidCallback onTap;
  final bool isLast;
  final double separatorInset;

  @override
  State<_PressRow> createState() => _PressRowState();
}

class _PressRowState extends State<_PressRow> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap,
      child: Container(
        // instant highlight on touch-down, eased fade on release
        color: _down ? tokens.surfaceSecondary : Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            widget.child,
            if (!widget.isLast)
              Padding(
                padding: EdgeInsets.only(left: widget.separatorInset),
                child: Divider(
                  height: 0.5,
                  thickness: 0.5,
                  color: tokens.border,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.tile,
    required this.title,
    required this.textColor,
    required this.onTap,
    this.isLast = false,
  });

  final IconData icon;
  final Color tile; // solid tile color; glyph is white
  final String title;
  final Color textColor;
  final VoidCallback onTap;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return _PressRow(
      onTap: onTap,
      isLast: isLast,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: tile,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, fill: 1, color: Colors.white, size: 19),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  letterSpacing: -0.2,
                  color: textColor,
                  ),
              ),
            ),
            const _Chevron(),
          ],
        ),
      ),
    );
  }
}
