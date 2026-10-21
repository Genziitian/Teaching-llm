import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api/api_client.dart';
import '../../core/router/app_router.dart';
import '../../core/router/modal_observer.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_theme_tokens.dart';

const String _kPolicyUpdateSeenKey = 'genz_policy_update_oct_2026';

/// Shows the October 2026 Policy Update once, ever. The account remembers it
/// (so web and app share one answer); this phone remembers it too, and it is
/// marked as seen the moment it appears so closing the app cannot bring it back.
Future<void> checkPolicyUpdateOnLaunch([ApiClient? api]) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_kPolicyUpdateSeenKey) ?? false) return;

    // Already seen on this account (web or another phone)?
    if (api != null) {
      try {
        final res = await api.get<dynamic>('/api/user/seen-notices');
        final d = res.data;
        final seen = d is Map ? d['seen'] : null;
        if (seen is List && seen.contains(_kPolicyUpdateSeenKey)) {
          await prefs.setBool(_kPolicyUpdateSeenKey, true);
          return;
        }
      } catch (_) {}
    }

    // Wait for the app and any other dialogs (like update/whats new) to complete
    await Future<void>.delayed(const Duration(seconds: 4));

    for (var attempt = 0; attempt < 15; attempt++) {
      final context = rootNavigatorKey.currentContext;
      if (context != null && context.mounted && !rootModalObserver.hasPopup) {
        await prefs.setBool(_kPolicyUpdateSeenKey, true);
        if (api != null) {
          unawaited(() async {
            try {
              await api.post<dynamic>('/api/user/seen-notices',
                  body: {'key': _kPolicyUpdateSeenKey});
            } catch (_) {}
          }());
        }
        await showDialog<void>(
          context: context,
          useRootNavigator: true,
          barrierDismissible: false,
          barrierColor: Colors.black.withValues(alpha: 0.55),
          builder: (_) => PolicyUpdateDialog(api: api),
        );
        return;
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
  } catch (e) {
    debugPrint('Could not show PolicyUpdate dialog: $e');
  }
}

class PolicyUpdateDialog extends StatefulWidget {
  const PolicyUpdateDialog({super.key, this.api});

  final ApiClient? api;

  @override
  State<PolicyUpdateDialog> createState() => _PolicyUpdateDialogState();
}

class _PolicyUpdateDialogState extends State<PolicyUpdateDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _in = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (MediaQuery.of(context).disableAnimations) {
        _in.value = 1;
      } else {
        _in.forward();
      }
    });
  }

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  /// Staggered fade + rise, [start] in 0..0.6 of the intro.
  Widget _rise(double start, Widget child) {
    final curve = Interval(start, start + 0.4);
    return AnimatedBuilder(
      animation: _in,
      child: child,
      builder: (context, child) {
        final v = Curves.easeOutCubic.transform(curve.transform(_in.value));
        return Opacity(
          opacity: v,
          child: Transform.translate(offset: Offset(0, (1 - v) * 14), child: child),
        );
      },
    );
  }

  void _openDoc(BuildContext context, String route) {
    Navigator.of(context, rootNavigator: true).pop();
    context.push(route);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Container(
            decoration: BoxDecoration(
              color: tokens.cardBg,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: tokens.border, width: 0.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.30),
                  blurRadius: 40,
                  offset: const Offset(0, 18),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _rise(
                    0.0,
                    Center(
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: const LinearGradient(
                            colors: [Color(0xFF7D7AFF), Color(0xFF5E5CE6)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF5E5CE6).withValues(alpha: 0.45),
                              blurRadius: 24,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: const Icon(Symbols.policy_rounded,
                            fill: 1, color: Colors.white, size: 32),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _rise(
                    0.06,
                    Text(
                      'Updated Policies',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.7,
                        color: tokens.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  _rise(
                    0.10,
                    Text(
                      'Effective October 2026',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  _rise(
                    0.14,
                    Text(
                      'We have updated our Terms & Conditions, Privacy Policy, and Refund Policy with comprehensive disclosures:',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.45,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _rise(
                    0.18,
                    const _PolicyHighlightRow(
                      icon: Symbols.school_rounded,
                      iconColor: Color(0xFF5E5CE6),
                      title: 'Courses & Bundles',
                      description:
                          'Terms for buying courses and bundles (Recorded, Live Pro, Champion): website via Razorpay, app via Google Play.',
                    ),
                  ),
                  const SizedBox(height: 14),
                  _rise(
                    0.20,
                    const _PolicyHighlightRow(
                      icon: Symbols.emoji_events_rounded,
                      iconColor: Color(0xFFFF453A),
                      title: 'Champion Refund Rule',
                      description:
                          'The Champion refund rule has been updated.',
                    ),
                  ),
                  const SizedBox(height: 14),
                  _rise(
                    0.22,
                    const _PolicyHighlightRow(
                      icon: Symbols.payments_rounded,
                      iconColor: Color(0xFF30B368),
                      title: 'Google Play In-App Purchases',
                      description:
                          'Official terms for purchasing study notes & materials via Google Play Billing.',
                    ),
                  ),
                  const SizedBox(height: 14),
                  _rise(
                    0.29,
                    const _PolicyHighlightRow(
                      icon: Symbols.schedule_rounded,
                      iconColor: Color(0xFF0A84FF),
                      title: 'Validity & Pricing in ₹',
                      description:
                          'Transparent pricing with clear access validity and instant fulfillment.',
                    ),
                  ),
                  const SizedBox(height: 14),
                  _rise(
                    0.36,
                    const _PolicyHighlightRow(
                      icon: Symbols.sync_rounded,
                      iconColor: Color(0xFFFF9F0A),
                      title: 'Cross-Platform Sync & Refunds',
                      description:
                          'Unlocked notes sync to web; refunds follow Google Play policies.',
                    ),
                  ),
                ],
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + MediaQuery.of(context).padding.bottom * 0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                  _rise(
                    0.46,
                    Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _DocLinkButton(
                          label: 'Terms',
                          onTap: () => _openDoc(context, '/terms-and-conditions'),
                        ),
                        _DocLinkButton(
                          label: 'Privacy',
                          onTap: () => _openDoc(context, '/privacy-policy'),
                        ),
                        _DocLinkButton(
                          label: 'Refund Policy',
                          onTap: () => _openDoc(context, '/refund-policy'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  _rise(
                    0.54,
                    ApplePressable(
                      onTap: () {
                        HapticFeedback.mediumImpact();
                        final api = widget.api;
                        if (api != null) {
                          unawaited(() async {
                            try {
                              await api.post<dynamic>('/api/user/seen-notices',
                                  body: {
                                    'key': _kPolicyUpdateSeenKey,
                                    'accepted': true,
                                    'platform': 'app',
                                  });
                            } catch (_) {}
                          }());
                        }
                        Navigator.of(context, rootNavigator: true).pop();
                      },
                      child: Container(
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: tokens.primaryAccent,
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: Text(
                          'I Understand & Agree',
                          style: TextStyle(
                            color: tokens.isBlack ? Colors.black : tokens.onPrimaryAccent,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                    ],
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
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Icon(icon, color: iconColor, size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.4,
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
    return ApplePressable(
      pressedScale: 0.96,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: tokens.textMuted.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(width: 3),
            Icon(Symbols.chevron_right_rounded,
                size: 17, weight: 600, color: tokens.textSecondary),
          ],
        ),
      ),
    );
  }
}
