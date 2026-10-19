import 'dart:async';
import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../theme/theme_mode_provider.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/l10n/app_translations.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../shared/widgets/apple_alert.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
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
    final confirmed = await showAppleAlert<bool>(
      context,
      icon: Symbols.shield_rounded,
      title: 'Keep your account?',
      message:
          'Cancelling will stop the current account deletion request and restore full normal account access immediately.',
      actions: const [
        AppleAlertAction(label: 'Continue With Deletion', value: false),
        AppleAlertAction(
            label: 'Keep My Account', value: true, isDefault: true),
      ],
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
            backgroundColor: Color(0xFF34C759),
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
        ref.watch(themeModeProvider).value ?? AppThemeMode.system;

    final currentLanguage = ref.watch(languageProvider).value ?? 'en';

    final notifAsync = ref.watch(notificationPrefsProvider);
    final prefs = notifAsync.value ??
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
            _SectionHeader(
                title: AppTranslations.t('settings.appearance', currentLanguage),
                color: textSecondary),
            _Segmented(
              selected: switch (currentThemeMode) {
                AppThemeMode.system => 0,
                AppThemeMode.light => 1,
                AppThemeMode.dark => 2,
                AppThemeMode.black => 3,
              },
              items: [
                _SegItem(
                    AppTranslations.t('settings.theme.system', currentLanguage),
                    Symbols.brightness_auto_rounded),
                _SegItem(
                    AppTranslations.t('settings.theme.light', currentLanguage),
                    Symbols.light_mode_rounded),
                _SegItem(
                    AppTranslations.t('settings.theme.dark', currentLanguage),
                    Symbols.dark_mode_rounded),
                _SegItem(
                    AppTranslations.t('settings.theme.black', currentLanguage),
                    Symbols.contrast_rounded),
              ],
              onChanged: (i) {
                HapticFeedback.selectionClick();
                ref.read(themeModeProvider.notifier).set(const [
                  AppThemeMode.system,
                  AppThemeMode.light,
                  AppThemeMode.dark,
                  AppThemeMode.black,
                ][i]);
              },
            ),

            const SizedBox(height: 28),

            // ── 1.5 LANGUAGE ─────────────────────────────────────────
            _SectionHeader(
                title: AppTranslations.t('settings.language', currentLanguage),
                color: textSecondary),
            _Segmented(
              selected: currentLanguage == 'hi' ? 1 : 0,
              items: const [
                _SegItem('English', Symbols.language_rounded),
                _SegItem('हिंदी', Symbols.translate_rounded),
              ],
              onChanged: (i) {
                HapticFeedback.selectionClick();
                ref.read(languageProvider.notifier).set(i == 1 ? 'hi' : 'en');
              },
            ),

            const SizedBox(height: 28),

            // ── 2. PUSH NOTIFICATIONS ──────────────────────────────
            _SectionHeader(
                title: AppTranslations.t('settings.pushNotifications', currentLanguage),
                color: textSecondary),
            _Group(
              children: [
                _SwitchRow(
                  icon: Symbols.campaign_rounded,
                  tile: const Color(0xFF5856D6),
                  title: AppTranslations.t('settings.notif.announcements', currentLanguage),
                  subtitle: AppTranslations.t('settings.notif.announcements.sub', currentLanguage),
                  value: prefs.announcements,
                  onChanged: (v) => ref
                      .read(notificationPrefsProvider.notifier)
                      .setAnnouncements(v),
                ),
                _SwitchRow(
                  icon: Symbols.forum_rounded,
                  tile: const Color(0xFF34C759),
                  title: AppTranslations.t('settings.notif.community', currentLanguage),
                  subtitle: AppTranslations.t('settings.notif.community.sub', currentLanguage),
                  value: prefs.community,
                  isLast: true,
                  onChanged: (v) => ref
                      .read(notificationPrefsProvider.notifier)
                      .setCommunity(v),
                ),
              ],
            ),

            const SizedBox(height: 28),

            // ── 3. DANGER ZONE (ACCOUNT DELETION) ──────────────────
            _SectionHeader(title: 'DANGER ZONE', color: tokens.danger),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: hasRequested && deletionReq != null
                  ? Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: tokens.danger.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(22),
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
                                      ? const Color(0xFF007AFF).withOpacity(0.15)
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
                                        ? const Color(0xFF007AFF)
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
                                color: const Color(0xFFFF9500).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                    color: const Color(0xFFFF9500).withOpacity(0.3)),
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
                  : _Group(
                      margin: EdgeInsets.zero,
                      children: [
                        _SettingsRow(
                          icon: Symbols.delete_forever_rounded,
                          tile: tokens.danger,
                          title: AppTranslations.t('settings.deleteAccount', currentLanguage),
                          titleColor: tokens.danger,
                          subtitle: 'Permanently delete your account and access',
                          isLast: true,
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
                      ],
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(36, 0, 20, 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
          color: color,
        ),
      ),
    );
  }
}

/// Inset grouped list surface.
class _Group extends StatelessWidget {
  const _Group({required this.children, this.margin});
  final List<Widget> children;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: margin ?? const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.cardBg,
          borderRadius: BorderRadius.circular(18),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(children: children),
      ),
    );
  }
}

/// Row shell: highlights on touch-down, inset hairline separator.
class _RowShell extends StatefulWidget {
  const _RowShell({required this.child, this.onTap, this.isLast = false});
  final Widget child;
  final VoidCallback? onTap;
  final bool isLast;

  @override
  State<_RowShell> createState() => _RowShellState();
}

class _RowShellState extends State<_RowShell> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: widget.onTap == null ? null : (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: Container(
        color: _down ? tokens.surfaceSecondary : Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            widget.child,
            if (!widget.isLast)
              Padding(
                padding: const EdgeInsets.only(left: 62),
                child: Divider(
                    height: 0.5, thickness: 0.5, color: tokens.border),
              ),
          ],
        ),
      ),
    );
  }
}

Widget _tile(IconData icon, Color color) => Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Icon(icon, fill: 1, color: Colors.white, size: 19),
    );

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.tile,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.titleColor,
    this.isLast = false,
  });

  final IconData icon;
  final Color tile;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Color? titleColor;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return _RowShell(
      onTap: onTap,
      isLast: isLast,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            _tile(icon, tile),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                      color: titleColor ?? tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                        fontSize: 13, height: 1.3, color: tokens.textSecondary),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Symbols.arrow_forward_ios_rounded,
                weight: 700, size: 13, color: tokens.textMuted),
          ],
        ),
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    required this.icon,
    required this.tile,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.isLast = false,
  });

  final IconData icon;
  final Color tile;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return _RowShell(
      onTap: () {
        HapticFeedback.selectionClick();
        onChanged(!value);
      },
      isLast: isLast,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 14, 12),
        child: Row(
          children: [
            _tile(icon, tile),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                      color: tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                        fontSize: 13, height: 1.3, color: tokens.textSecondary),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Switch(
              value: value,
              onChanged: (v) {
                HapticFeedback.selectionClick();
                onChanged(v);
              },
              thumbColor: const WidgetStatePropertyAll(Colors.white),
              trackColor: WidgetStateProperty.resolveWith((st) =>
                  st.contains(WidgetState.selected)
                      ? const Color(0xFF34C759)
                      : (tokens.isDark
                          ? const Color(0xFF39393D)
                          : const Color(0xFFE9E9EA))),
              trackOutlineColor:
                  const WidgetStatePropertyAll(Colors.transparent),
            ),
          ],
        ),
      ),
    );
  }
}

class _SegItem {
  const _SegItem(this.label, this.icon);
  final String label;
  final IconData icon;
}

/// iOS-style segmented control: the thumb slides (ease-out, no bounce) and
/// every segment responds on press-down.
class _Segmented extends StatelessWidget {
  const _Segmented({
    required this.selected,
    required this.items,
    required this.onChanged,
  });

  final int selected;
  final List<_SegItem> items;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final reduce = MediaQuery.of(context).disableAnimations;
    final track = tokens.isDark
        ? const Color(0xFF1C1C1E)
        : const Color(0xFFE3E3E8);
    final thumb = tokens.isDark ? const Color(0xFF636366) : Colors.white;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        height: 44,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: track,
          borderRadius: BorderRadius.circular(13),
        ),
        child: LayoutBuilder(
          builder: (context, c) {
            final w = c.maxWidth / items.length;
            return Stack(
              children: [
                AnimatedPositioned(
                  duration: reduce
                      ? Duration.zero
                      : const Duration(milliseconds: 260),
                  curve: kEaseOutStrong,
                  left: selected * w,
                  width: w,
                  top: 0,
                  bottom: 0,
                  child: Container(
                    decoration: BoxDecoration(
                      color: thumb,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: tokens.isDark
                          ? null
                          : const [
                              BoxShadow(
                                color: Color(0x1F000000),
                                blurRadius: 4,
                                offset: Offset(0, 1.5),
                              ),
                            ],
                    ),
                  ),
                ),
                Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      Expanded(
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTapDown: (_) {
                            if (i != selected) onChanged(i);
                          },
                          child: Center(
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  items[i].icon,
                                  fill: i == selected ? 1 : 0,
                                  size: 17,
                                  color: i == selected
                                      ? tokens.primaryAccent
                                      : tokens.textSecondary,
                                ),
                                const SizedBox(width: 5),
                                Flexible(
                                  child: Text(
                                    items[i].label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: i == selected
                                          ? FontWeight.w600
                                          : FontWeight.w500,
                                      color: i == selected
                                          ? tokens.textPrimary
                                          : tokens.textSecondary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            );
          },
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 14),
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
                          color: tokens.danger,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Symbols.warning_rounded,
                            fill: 1, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Delete Your Account',
                            style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.4,
                              color: tokens.textPrimary,
                            ),
                          ),
                          Text(
                            'Step $_step of 3',
                            style: TextStyle(
                              fontSize: 13,
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
                        width: 16,
                        height: 4,
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
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.2,
                    color: tokens.textPrimary,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: tokens.surfaceSecondary,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Please note:',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
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
                    fontSize: 14,
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
                Container(
                  decoration: BoxDecoration(
                    color: tokens.surfaceSecondary,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      for (var i = 0; i < _kDeletionReasons.length; i++)
                        Builder(builder: (context) {
                          final r = _kDeletionReasons[i];
                          final isSelected =
                              _selectedReasonCodes.contains(r['code']);
                          return InkWell(
                            splashFactory: NoSplash.splashFactory,
                            highlightColor:
                                tokens.textPrimary.withValues(alpha: 0.06),
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
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                border: i == _kDeletionReasons.length - 1
                                    ? null
                                    : Border(
                                        bottom: BorderSide(
                                            color: tokens.border, width: 0.5)),
                              ),
                              child: Row(
                                children: [
                                  _RoundCheck(
                                      selected: isSelected,
                                      color: tokens.danger),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      r['label']!,
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w500,
                                        color: tokens.textPrimary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
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
                  style: TextStyle(fontSize: 15, color: tokens.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Tell us what made you decide to leave...',
                    hintStyle: TextStyle(fontSize: 15, color: tokens.textMuted),
                    filled: true,
                    fillColor: tokens.surfaceSecondary,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide:
                          BorderSide(color: tokens.danger, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // Selected reasons summary
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: tokens.surfaceSecondary,
                    borderRadius: BorderRadius.circular(16),
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

                // Confirmation
                InkWell(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _agreed = !_agreed);
                  },
                  splashFactory: NoSplash.splashFactory,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: _agreed
                          ? tokens.danger.withOpacity(0.10)
                          : tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        _RoundCheck(selected: _agreed, color: tokens.danger),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'I understand I have 24 hours to cancel before deletion processing.',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
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
                        style: TextStyle(fontSize: 16, color: tokens.textSecondary),
                      ),
                    )
                  else
                    TextButton(
                      onPressed: _loading ? null : () => Navigator.of(context, rootNavigator: true).pop(false),
                      child: Text(
                        'Cancel',
                        style: TextStyle(fontSize: 16, color: tokens.textSecondary),
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
                        shape: const StadiumBorder(),
                        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
                      ),
                      child: const Text(
                        'Continue →',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
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
                        shape: const StadiumBorder(),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
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
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
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

class _RoundCheck extends StatelessWidget {
  const _RoundCheck({required this.selected, required this.color});
  final bool selected;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    return AnimatedContainer(
      duration: reduce ? Duration.zero : const Duration(milliseconds: 160),
      curve: kEaseOutStrong,
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? color : Colors.transparent,
        border: Border.all(
          color: selected ? color : context.tokens.textMuted,
          width: 1.5,
        ),
      ),
      child: selected
          ? const Icon(Symbols.check_rounded,
              weight: 700, size: 16, color: Colors.white)
          : null,
    );
  }
}
