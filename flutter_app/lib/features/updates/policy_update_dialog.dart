import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/router/app_router.dart';
import '../../core/router/modal_observer.dart';
import '../../theme/app_theme_tokens.dart';

const String _kPolicyUpdateSeenKey = 'genz_policy_update_oct_2026';

/// Checks if the user has seen the October 2026 Policy Update modal.
/// Runs once per user.
Future<void> checkPolicyUpdateOnLaunch() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final seen = prefs.getBool(_kPolicyUpdateSeenKey) ?? false;
    if (seen) return;

    // Wait for the app and any other dialogs (like update/whats new) to complete
    await Future<void>.delayed(const Duration(seconds: 4));

    for (var attempt = 0; attempt < 15; attempt++) {
      final context = rootNavigatorKey.currentContext;
      if (context != null && context.mounted && !rootModalObserver.hasPopup) {
        await showDialog<void>(
          context: context,
          useRootNavigator: true,
          barrierDismissible: false,
          barrierColor: Colors.black.withValues(alpha: 0.55),
          builder: (_) => const PolicyUpdateDialog(),
        );
        await prefs.setBool(_kPolicyUpdateSeenKey, true);
        return;
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
  } catch (e) {
    debugPrint('Could not show PolicyUpdate dialog: $e');
  }
}

class PolicyUpdateDialog extends StatelessWidget {
  const PolicyUpdateDialog({super.key});

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: Container(
            padding: const EdgeInsets.fromLTRB(22, 26, 22, 22),
            decoration: BoxDecoration(
              color: tokens.cardBg,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: tokens.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 32,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: tokens.primaryAccent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        Symbols.policy_rounded,
                        color: tokens.primaryAccent,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Updated Policies',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.4,
                              color: tokens.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Effective October 2026',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: tokens.primaryAccent,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                Text(
                  'We have updated our Terms & Conditions, Privacy Policy, and Refund Policy with comprehensive disclosures:',
                  style: TextStyle(
                    fontSize: 13.5,
                    height: 1.45,
                    color: tokens.textSecondary,
                  ),
                ),
                const SizedBox(height: 16),

                _PolicyHighlightRow(
                  icon: Symbols.payments_rounded,
                  iconColor: const Color(0xFF34C759),
                  title: 'Google Play In-App Purchases',
                  description:
                      'Official terms for purchasing study notes & materials via Google Play Billing.',
                ),
                const SizedBox(height: 12),
                _PolicyHighlightRow(
                  icon: Symbols.schedule_rounded,
                  iconColor: const Color(0xFF007AFF),
                  title: 'Validity & Pricing in ₹',
                  description:
                      'Transparent pricing with 90-day digital access and instant fulfillment.',
                ),
                const SizedBox(height: 12),
                _PolicyHighlightRow(
                  icon: Symbols.sync_rounded,
                  iconColor: const Color(0xFFFF9500),
                  title: 'Cross-Platform Sync & Refunds',
                  description:
                      'Unlocked notes sync to web; refunds follow Google Play policies.',
                ),
                const SizedBox(height: 20),

                // Review links
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _DocLinkButton(
                      label: 'Terms',
                      onTap: () {
                        Navigator.of(context, rootNavigator: true).pop();
                        context.push('/terms-and-conditions');
                      },
                    ),
                    _DocLinkButton(
                      label: 'Privacy',
                      onTap: () {
                        Navigator.of(context, rootNavigator: true).pop();
                        context.push('/privacy-policy');
                      },
                    ),
                    _DocLinkButton(
                      label: 'Refund Policy',
                      onTap: () {
                        Navigator.of(context, rootNavigator: true).pop();
                        context.push('/refund-policy');
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // Primary Action Button
                GestureDetector(
                  onTap: () => Navigator.of(context, rootNavigator: true).pop(),
                  child: Container(
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: tokens.primaryAccent,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Text(
                      'I Understand & Agree',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PolicyHighlightRow extends StatelessWidget {
  const _PolicyHighlightRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(9),
          ),
          alignment: Alignment.center,
          child: Icon(icon, color: iconColor, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: TextStyle(
                  fontSize: 12,
                  height: 1.35,
                  color: tokens.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DocLinkButton extends StatelessWidget {
  const _DocLinkButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: tokens.primaryAccent,
            decoration: TextDecoration.underline,
          ),
        ),
      ),
    );
  }
}
