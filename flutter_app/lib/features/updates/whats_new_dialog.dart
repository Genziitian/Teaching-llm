import 'dart:async';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/router/app_router.dart';
import '../../core/router/modal_observer.dart';
import '../../theme/app_theme_tokens.dart';

const int kCurrentAppVersionCode = 57;
const String _kLastSeenVersionKey = 'whats_new_last_seen_version_code';

/// Checks if the user just updated the app, and displays the "What's New" modal.
/// Runs once per version upgrade.
Future<void> checkWhatsNewOnLaunch() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final lastSeen = prefs.getInt(_kLastSeenVersionKey) ?? 0;

    // Only show if user upgraded to this new version code
    if (lastSeen >= kCurrentAppVersionCode) return;

    // Give the app screens and router a moment to settle
    await Future<void>.delayed(const Duration(seconds: 3));

    for (var attempt = 0; attempt < 12; attempt++) {
      final context = rootNavigatorKey.currentContext;
      if (context != null && context.mounted && !rootModalObserver.hasPopup) {
        await showDialog<void>(
          context: context,
          useRootNavigator: true,
          barrierDismissible: false,
          barrierColor: Colors.black.withValues(alpha: 0.5),
          builder: (_) => const WhatsNewDialog(),
        );
        await prefs.setInt(_kLastSeenVersionKey, kCurrentAppVersionCode);
        return;
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
  } catch (e) {
    debugPrint('Could not show WhatsNew dialog: $e');
  }
}

class WhatsNewDialog extends StatelessWidget {
  const WhatsNewDialog({super.key});

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
            decoration: BoxDecoration(
              color: tokens.cardBg,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: tokens.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 30,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top icon
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: tokens.primaryAccent.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        Symbols.auto_awesome_rounded,
                        color: tokens.primaryAccent,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "What's New",
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                              color: tokens.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Latest updates & improvements',
                            style: TextStyle(
                              fontSize: 13,
                              color: tokens.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Feature items
                _FeatureRow(
                  icon: Symbols.credit_card_rounded,
                  iconColor: const Color(0xFF34C759),
                  title: 'Google Play Billing',
                  description:
                      'Purchase Premium Study Notes directly and securely with Google Play.',
                ),
                const SizedBox(height: 18),
                _FeatureRow(
                  icon: Symbols.offline_pin_rounded,
                  iconColor: const Color(0xFF007AFF),
                  title: 'Offline Notes & Materials',
                  description:
                      'Download notes once and study anytime, anywhere without internet.',
                ),
                const SizedBox(height: 18),
                _FeatureRow(
                  icon: Symbols.bolt_rounded,
                  iconColor: const Color(0xFFFF9500),
                  title: 'Faster & Smoother Store',
                  description:
                      'Enjoy quicker note previews, clear terms, and instant access.',
                ),
                const SizedBox(height: 26),

                // Action button
                GestureDetector(
                  onTap: () => Navigator.of(context, rootNavigator: true).pop(),
                  child: Container(
                    height: 50,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: tokens.primaryAccent,
                      borderRadius: BorderRadius.circular(25),
                    ),
                    child: Text(
                      'Got it, continue',
                      style: TextStyle(
                        color: tokens.onPrimaryAccent,
                        fontSize: 15.5,
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

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({
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
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                description,
                style: TextStyle(
                  fontSize: 12.5,
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
