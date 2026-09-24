import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../theme/theme_mode_provider.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/l10n/app_translations.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import 'notification_settings_page.dart';

const _kDeletionReasons = [
  {'code': 'NO_LONGER_NEEDED', 'label': 'I no longer need the platform'},
  {'code': 'CONTENT_DISSATISFACTION', 'label': "I'm not satisfied with the courses/content"},
  {'code': 'TECHNICAL_PROBLEMS', 'label': "I'm having technical problems"},
  {'code': 'DIFFICULT_TO_USE', 'label': 'The platform is difficult to use'},
  {'code': 'PRICING', 'label': 'The pricing is too high'},
  {'code': 'PRIVACY_CONCERNS', 'label': 'I have privacy/account concerns'},
  {'code': 'SWITCHING_PLATFORM', 'label': "I'm switching to another learning platform"},
  {'code': 'OTHER', 'label': 'Other'},
];

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  Map<String, dynamic>? _deletionData;
  Timer? _countdownTimer;
  String _timeRemainingStr = '';

  @override
  void initState() {
    super.initState();
    _fetchDeletionStatus();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchDeletionStatus() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<Map<String, dynamic>>('/api/user/delete-request');
      if (mounted && res.data != null) {
        setState(() {
          _deletionData = res.data;
        });
        _startCountdown();
      }
    } catch (_) {}
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    final req = _deletionData?['request'] as Map<String, dynamic>?;
    if (_deletionData?['hasRequested'] != true || req == null || req['cancelUntil'] == null) {
      setState(() => _timeRemainingStr = '');
      return;
    }

    void update() {
      final cancelUntilStr = req['cancelUntil'] as String;
      final deadline = DateTime.tryParse(cancelUntilStr)?.toLocal();
      if (deadline == null) return;

      final diff = deadline.difference(DateTime.now());
      if (diff.isNegative) {
        setState(() => _timeRemainingStr = 'Cancellation period expired');
        _countdownTimer?.cancel();
        return;
      }

      final hours = diff.inHours;
      final minutes = diff.inMinutes.remainder(60);
      final seconds = diff.inSeconds.remainder(60);
      setState(() {
        _timeRemainingStr = '${hours}h ${minutes}m ${seconds}s remaining to cancel';
      });
    }

    update();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) => update());
  }

  Future<void> _openCancelConfirmation(Map<String, dynamic> req) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => const _CancelConfirmDialog(),
    );

    if (confirmed == true && mounted) {
      try {
        final api = ref.read(apiClientProvider);
        await api.delete('/api/user/delete-request');
        if (!mounted) return;
        await _fetchDeletionStatus();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Your account deletion request has been cancelled.'),
            backgroundColor: Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to cancel request: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentThemeMode =
        ref.watch(themeModeProvider).valueOrNull ?? AppThemeMode.system;

    final currentLanguage = ref.watch(languageProvider).value ?? 'en';

    final notifAsync = ref.watch(notificationPrefsProvider);
    final prefs = notifAsync.valueOrNull ??
        const NotificationPrefs(announcements: true, community: true);

    final tokens = context.tokens;
    final cardBg = tokens.cardBg;
    final borderColor = tokens.border;
    final textPrimary = tokens.textPrimary;
    final textSecondary = tokens.textSecondary;

    final hasRequested = _deletionData?['hasRequested'] == true;
    final deletionReq = _deletionData?['request'] as Map<String, dynamic>?;

    return AppPageScaffold(
      title: AppTranslations.t('settings.title', currentLanguage),
      subtitle: AppTranslations.t('settings.preferences', currentLanguage),
      onBack: () => context.canPop() ? context.pop() : context.go('/more'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(0, 16, 0, 60),
        children: [

            // ── 1. APPEARANCE (THEME) ──────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _SectionHeader(title: AppTranslations.t('settings.appearance', currentLanguage), color: textSecondary),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: borderColor),
                  boxShadow: AppShadows.sm,
                ),
                child: Row(
                  children: [
                    _ThemeTab(
                      label: AppTranslations.t('settings.theme.system', currentLanguage),
                      icon: Icons.brightness_auto_rounded,
                      isSelected: currentThemeMode == AppThemeMode.system,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        ref
                            .read(themeModeProvider.notifier)
                            .set(AppThemeMode.system);
                      },
                    ),
                    _ThemeTab(
                      label: AppTranslations.t('settings.theme.light', currentLanguage),
                      icon: Icons.light_mode_rounded,
                      isSelected: currentThemeMode == AppThemeMode.light,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        ref
                            .read(themeModeProvider.notifier)
                            .set(AppThemeMode.light);
                      },
                    ),
                    _ThemeTab(
                      label: AppTranslations.t('settings.theme.dark', currentLanguage),
                      icon: Icons.dark_mode_rounded,
                      isSelected: currentThemeMode == AppThemeMode.dark,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        ref
                            .read(themeModeProvider.notifier)
                            .set(AppThemeMode.dark);
                      },
                    ),
                    _ThemeTab(
                      label: AppTranslations.t('settings.theme.black', currentLanguage),
                      icon: Icons.contrast_rounded,
                      isSelected: currentThemeMode == AppThemeMode.black,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        ref
                            .read(themeModeProvider.notifier)
                            .set(AppThemeMode.black);
                      },
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // ── 1.5 LANGUAGE ─────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _SectionHeader(title: AppTranslations.t('settings.language', currentLanguage), color: textSecondary),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: borderColor),
                  boxShadow: AppShadows.sm,
                ),
                child: Row(
                  children: [
                    _ThemeTab(
                      label: 'English',
                      icon: Icons.language_rounded,
                      isSelected: currentLanguage == 'en',
                      onTap: () {
                        HapticFeedback.lightImpact();
                        ref.read(languageProvider.notifier).set('en');
                      },
                    ),
                    _ThemeTab(
                      label: 'हिंदी',
                      icon: Icons.language_rounded,
                      isSelected: currentLanguage == 'hi',
                      onTap: () {
                        HapticFeedback.lightImpact();
                        ref.read(languageProvider.notifier).set('hi');
                      },
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),

            // ── 2. PUSH NOTIFICATIONS ──────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _SectionHeader(
                  title: AppTranslations.t('settings.pushNotifications', currentLanguage), color: textSecondary),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: borderColor),
                  boxShadow: AppShadows.sm,
                ),
                child: Column(
                  children: [
                    SwitchListTile(
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 4),
                      secondary: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: tokens.primaryAccent.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.campaign_outlined,
                            color: tokens.primaryAccent, size: 20),
                      ),
                      title: Text(
                        AppTranslations.t('settings.notif.announcements', currentLanguage),
                        style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: textPrimary),
                      ),
                      subtitle: Text(
                        AppTranslations.t('settings.notif.announcements.sub', currentLanguage),
                        style: TextStyle(fontSize: 12, color: textSecondary),
                      ),
                      value: prefs.announcements,
                      activeColor: tokens.primaryAccent,
                      onChanged: (v) {
                        ref
                            .read(notificationPrefsProvider.notifier)
                            .setAnnouncements(v);
                      },
                    ),
                    Divider(
                      height: 1,
                      color: tokens.borderLight,
                    ),
                    SwitchListTile(
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 4),
                      secondary: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: tokens.success.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.forum_outlined,
                            color: tokens.success, size: 20),
                      ),
                      title: Text(
                        AppTranslations.t('settings.notif.community', currentLanguage),
                        style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: textPrimary),
                      ),
                      subtitle: Text(
                        AppTranslations.t('settings.notif.community.sub', currentLanguage),
                        style: TextStyle(fontSize: 12, color: textSecondary),
                      ),
                      value: prefs.community,
                      activeColor: tokens.success,
                      onChanged: (v) {
                        ref
                            .read(notificationPrefsProvider.notifier)
                            .setCommunity(v);
                      },
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 28),

            // ── 3. DANGER ZONE (ACCOUNT DELETION) ──────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _SectionHeader(
                  title: 'DANGER ZONE', color: tokens.danger),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: hasRequested && deletionReq != null
                  ? Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: tokens.danger.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                            color: tokens.danger.withOpacity(0.35), width: 1.5),
                        boxShadow: AppShadows.sm,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: deletionReq['status'] == 'APPROVED'
                                      ? const Color(0xFF3B82F6).withOpacity(0.15)
                                      : tokens.danger.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  deletionReq['status'] == 'APPROVED'
                                      ? 'ACCEPTED & SCHEDULED'
                                      : 'SCHEDULED FOR DELETION',
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    color: deletionReq['status'] == 'APPROVED'
                                        ? const Color(0xFF3B82F6)
                                        : tokens.danger,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            deletionReq['status'] == 'APPROVED'
                                ? 'Manager Accepted Deletion Request'
                                : 'Account Deletion Request Active',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            deletionReq['status'] == 'APPROVED'
                                ? 'Manager has accepted your request. Deletion will proceed after the 24-hour window expires.'
                                : 'Your request has been received. You have 24 hours to cancel.',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: textSecondary,
                            ),
                          ),
                          const SizedBox(height: 14),

                          // Live Countdown Box
                          if (_timeRemainingStr.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF59E0B).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                    color: const Color(0xFFF59E0B).withOpacity(0.3)),
                              ),
                              child: Row(
                                children: [
                                  const Text('⏳', style: TextStyle(fontSize: 14)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _timeRemainingStr,
                                      style: const TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFFD97706),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          const SizedBox(height: 14),

                          // Reason & Feedback Box
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: cardBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: borderColor),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Reason: ${deletionReq['reasonLabel'] ?? 'Not specified'}',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: textPrimary,
                                  ),
                                ),
                                if (deletionReq['userComment'] != null &&
                                    (deletionReq['userComment'] as String).isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    '"${deletionReq['userComment']}"',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontStyle: FontStyle.italic,
                                      color: textSecondary,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Cancel Request Button
                          if (deletionReq['isCancellationEligible'] == true)
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton(
                                onPressed: () => _openCancelConfirmation(deletionReq),
                                style: OutlinedButton.styleFrom(
                                  side: BorderSide(
                                      color: tokens.danger.withOpacity(0.5)),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                child: Text(
                                  'Cancel Deletion Request',
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                    color: tokens.danger,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    )
                  : Container(
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: tokens.danger.withOpacity(0.25)),
                        boxShadow: AppShadows.sm,
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 6),
                        leading: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: tokens.danger.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(Icons.delete_forever_rounded,
                              color: tokens.danger, size: 22),
                        ),
                        title: Text(
                          AppTranslations.t('settings.deleteAccount', currentLanguage),
                          style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                              color: tokens.danger),
                        ),
                        subtitle: Text(
                          'Permanently delete your account and access',
                          style: TextStyle(fontSize: 12, color: textSecondary),
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded,
                            color: Colors.grey, size: 22),
                        onTap: () async {
                          HapticFeedback.mediumImpact();
                          final submitted = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => _DeleteAccountDialog(ref: ref),
                          );
                          if (submitted == true && mounted) {
                            _fetchDeletionStatus();
                          }
                        },
                      ),
                    ),
            ),
          ],
        ),
      );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.color});
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

class _ThemeTab extends StatelessWidget {
  const _ThemeTab({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Expanded(
      child: BouncyPressable(
        onTap: onTap,
        scaleDown: 0.96,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? tokens.surfaceSecondary : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: isSelected ? tokens.primaryAccent : tokens.textMuted,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? tokens.primaryAccent : tokens.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 3-Step Account Deletion Flow Dialog
class _DeleteAccountDialog extends StatefulWidget {
  const _DeleteAccountDialog({required this.ref});
  final WidgetRef ref;

  @override
  State<_DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<_DeleteAccountDialog> {
  int _step = 1;
  final Set<String> _selectedReasonCodes = {};
  final _commentController = TextEditingController();
  bool _agreed = false;
  bool _loading = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_agreed || _selectedReasonCodes.isEmpty || _loading) return;
    setState(() => _loading = true);

    try {
      final api = widget.ref.read(apiClientProvider);
      final res = await api.post(
        '/api/user/delete-request',
        body: {
          'reasonCodes': _selectedReasonCodes.toList(),
          'reasonCode': _selectedReasonCodes.join(','),
          'userComment': _commentController.text.trim(),
          'agreeTerms': true,
        },
      );

      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop(true);

      final msg = res.data is Map && res.data['message'] is String
          ? res.data['message'] as String
          : 'Your account deletion request has been submitted.';

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.info_outline, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(child: Text(msg)),
            ],
          ),
          backgroundColor: const Color(0xFF1E293B),
          duration: const Duration(seconds: 6),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Dialog(
      backgroundColor: tokens.cardBg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: tokens.danger.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(Icons.warning_amber_rounded,
                            color: tokens.danger, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Delete Your Account',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: tokens.textPrimary,
                            ),
                          ),
                          Text(
                            'Step $_step of 3',
                            style: TextStyle(
                              fontSize: 12,
                              color: tokens.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  // Step Indicator Dots
                  Row(
                    children: [1, 2, 3].map((s) {
                      return Container(
                        margin: const EdgeInsets.only(left: 4),
                        width: 18,
                        height: 5,
                        decoration: BoxDecoration(
                          color: _step >= s ? tokens.danger : tokens.border,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // ── Step 1: Warning & Terms ──
              if (_step == 1) ...[
                Text(
                  'You are about to permanently delete your account from our platform.',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: tokens.textPrimary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: tokens.surfaceSecondary,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: tokens.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Please note:',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: tokens.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _bulletPoint('Any active subscriptions or course access will be closed.', tokens),
                      _bulletPoint('You will be removed from all teams, communities, and channels.', tokens),
                      _bulletPoint('No refund will be provided for remaining periods or unused access.', tokens),
                      _bulletPoint('You have a 24-hour window to cancel this request.', tokens),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'We’re sorry to see you go. If you are sure you want to proceed, tap Continue.',
                  style: TextStyle(
                    fontSize: 13,
                    color: tokens.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],

              // ── Step 2: Reason for Leaving ──
              if (_step == 2) ...[
                Text(
                  'Why are you leaving GenZ IITIAN? *',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Please select all reasons that apply:',
                  style: TextStyle(fontSize: 12.5, color: tokens.textSecondary),
                ),
                const SizedBox(height: 12),
                Column(
                  children: _kDeletionReasons.map((r) {
                    final isSelected = _selectedReasonCodes.contains(r['code']);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() {
                            if (isSelected) {
                              _selectedReasonCodes.remove(r['code']);
                            } else {
                              _selectedReasonCodes.add(r['code']!);
                            }
                          });
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? tokens.danger.withOpacity(0.08)
                                : tokens.surfaceSecondary,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected ? tokens.danger : tokens.border,
                              width: isSelected ? 1.5 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Checkbox(
                                value: isSelected,
                                activeColor: tokens.danger,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                onChanged: (v) {
                                  setState(() {
                                    if (v == true) {
                                      _selectedReasonCodes.add(r['code']!);
                                    } else {
                                      _selectedReasonCodes.remove(r['code']);
                                    }
                                  });
                                },
                              ),
                              Expanded(
                                child: Text(
                                  r['label']!,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                    color: tokens.textPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],

              // ── Step 3: Optional Feedback & Final Confirmation ──
              if (_step == 3) ...[
                Text(
                  'Anything you\'d like to tell us? (Optional)',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Your feedback helps us understand what we could improve.',
                  style: TextStyle(fontSize: 12, color: tokens.textSecondary),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _commentController,
                  maxLines: 3,
                  maxLength: 1000,
                  style: TextStyle(fontSize: 13, color: tokens.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Tell us what made you decide to leave...',
                    hintStyle: TextStyle(fontSize: 13, color: tokens.textMuted),
                    filled: true,
                    fillColor: tokens.surfaceSecondary,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: tokens.border),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // Selected reasons summary
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: tokens.surfaceSecondary,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: tokens.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Selected Reasons (${_selectedReasonCodes.length}):',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: tokens.textPrimary),
                      ),
                      const SizedBox(height: 6),
                      ..._selectedReasonCodes.map((code) {
                        final label = _kDeletionReasons.firstWhere(
                          (r) => r['code'] == code,
                          orElse: () => {'label': code},
                        )['label']!;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 3),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('• ', style: TextStyle(color: tokens.danger, fontSize: 12, fontWeight: FontWeight.bold)),
                              Expanded(
                                child: Text(
                                  label,
                                  style: TextStyle(fontSize: 12, color: tokens.textSecondary),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Confirmation Checkbox
                InkWell(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _agreed = !_agreed);
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _agreed ? tokens.danger.withOpacity(0.08) : tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _agreed ? tokens.danger : tokens.border,
                        width: 1.5,
                      ),
                    ),
                    child: Row(
                      children: [
                        Checkbox(
                          value: _agreed,
                          activeColor: tokens.danger,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                          onChanged: (v) => setState(() => _agreed = v ?? false),
                        ),
                        Expanded(
                          child: Text(
                            'I understand I have 24 hours to cancel before deletion processing.',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: tokens.textPrimary,
                              height: 1.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 22),

              // Action Buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (_step > 1)
                    TextButton(
                      onPressed: _loading ? null : () => setState(() => _step--),
                      child: Text(
                        '← Back',
                        style: TextStyle(fontSize: 13.5, color: tokens.textSecondary),
                      ),
                    )
                  else
                    TextButton(
                      onPressed: _loading ? null : () => Navigator.of(context, rootNavigator: true).pop(false),
                      child: Text(
                        'Cancel',
                        style: TextStyle(fontSize: 13.5, color: tokens.textSecondary),
                      ),
                    ),

                  if (_step < 3)
                    ElevatedButton(
                      onPressed: (_step == 2 && _selectedReasonCodes.isEmpty)
                          ? null
                          : () => setState(() => _step++),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: tokens.danger,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                      ),
                      child: const Text(
                        'Continue →',
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                      ),
                    )
                  else
                    ElevatedButton(
                      onPressed: (_agreed && !_loading) ? _submit : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: tokens.danger,
                        disabledBackgroundColor: tokens.border,
                        foregroundColor: Colors.white,
                        disabledForegroundColor: tokens.textMuted,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                      ),
                      child: _loading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Text(
                              'Request Account Deletion',
                              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                            ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bulletPoint(String text, AppThemeTokens tokens) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('• ', style: TextStyle(color: tokens.textSecondary, fontWeight: FontWeight.bold)),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12.5,
                color: tokens.textSecondary,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CancelConfirmDialog extends StatelessWidget {
  const _CancelConfirmDialog();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Dialog(
      backgroundColor: tokens.cardBg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Keep your account?',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Cancelling will stop the current account deletion request and restore full normal account access immediately.',
              style: TextStyle(
                fontSize: 13.5,
                color: tokens.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: Text(
                    'Continue With Deletion',
                    style: TextStyle(color: tokens.textSecondary, fontSize: 13),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: tokens.primaryAccent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Keep My Account'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
