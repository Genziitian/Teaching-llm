import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';

/// Per-user push-notification category toggles.
class NotificationPrefs {
  const NotificationPrefs({
    required this.announcements,
    required this.community,
  });
  final bool announcements;
  final bool community;

  NotificationPrefs copyWith({bool? announcements, bool? community}) =>
      NotificationPrefs(
        announcements: announcements ?? this.announcements,
        community: community ?? this.community,
      );

  factory NotificationPrefs.fromJson(Map<String, dynamic> j) =>
      NotificationPrefs(
        announcements: (j['announcements'] as bool?) ?? true,
        community: (j['community'] as bool?) ?? true,
      );
}

class NotificationPrefsNotifier
    extends AsyncNotifier<NotificationPrefs> {
  @override
  Future<NotificationPrefs> build() async {
    final api = ref.watch(apiClientProvider);
    final res = await api.get<dynamic>('/api/notification-preferences');
    return NotificationPrefs.fromJson(
        Map<String, dynamic>.from(res.data as Map));
  }

  Future<void> setAnnouncements(bool v) => _patch({'announcements': v});
  Future<void> setCommunity(bool v) => _patch({'community': v});

  Future<void> _patch(Map<String, dynamic> body) async {
    final api = ref.read(apiClientProvider);
    final prev = state.value;
    if (prev != null) {
      state = AsyncData(prev.copyWith(
        announcements: body['announcements'] as bool? ?? prev.announcements,
        community: body['community'] as bool? ?? prev.community,
      ));
    }
    try {
      final res =
          await api.patch<dynamic>('/api/notification-preferences', body: body);
      state = AsyncData(NotificationPrefs.fromJson(
          Map<String, dynamic>.from(res.data as Map)));
    } catch (e, st) {
      if (prev != null) state = AsyncData(prev);
      state = AsyncError(e, st);
    }
  }
}

final notificationPrefsProvider = AsyncNotifierProvider.autoDispose<
    NotificationPrefsNotifier, NotificationPrefs>(
  NotificationPrefsNotifier.new,
);

class NotificationSettingsPage extends ConsumerWidget {
  const NotificationSettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationPrefsProvider);
    final tokens = context.tokens;

    return AppPageScaffold(
      title: 'Notifications',
      subtitle: 'Choose what gets a push',
      showBack: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(0, 16, 0, 24),
        children: [
          async.when(
              loading: () => Padding(
                padding: const EdgeInsets.symmetric(vertical: 60),
                child: Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: tokens.primaryAccent,
                  ),
                ),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: 40, horizontal: 20),
                child: Column(
                  children: [
                    Icon(Icons.cloud_off,
                        color: tokens.textMuted, size: 40),
                    const SizedBox(height: 8),
                    Text(
                      "Couldn't load preferences",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: tokens.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      e.toString(),
                      style: TextStyle(
                        fontSize: 13,
                        color: tokens.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () =>
                          ref.invalidate(notificationPrefsProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (prefs) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    _PrefTile(
                      icon: Icons.campaign_outlined,
                      iconColor: tokens.textSecondary,
                      iconBg: tokens.textMuted.withValues(alpha: 0.14),
                      title: 'Announcements',
                      sub:
                          'Course updates, schedule changes, exam notices.',
                      value: prefs.announcements,
                      onChanged: (v) => ref
                          .read(notificationPrefsProvider.notifier)
                          .setAnnouncements(v),
                    ),
                    const SizedBox(height: 10),
                    _PrefTile(
                      icon: Icons.forum_outlined,
                      iconColor: tokens.success,
                      iconBg: tokens.success.withOpacity(0.12),
                      title: 'Community chats',
                      sub:
                          'New messages in the course community and direct chats.',
                      value: prefs.community,
                      onChanged: (v) => ref
                          .read(notificationPrefsProvider.notifier)
                          .setCommunity(v),
                    ),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: tokens.surfaceSecondary,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: tokens.border),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_outline,
                              color: tokens.primaryAccent, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              "Turning a category off stops pushes to your device. "
                              "You'll still see history in the in-app notifications list and the chat itself.",
                              style: TextStyle(
                                fontSize: 12,
                                color: tokens.textSecondary,
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
          ],
        ),
      );
  }
}

class _PrefTile extends StatelessWidget {
  const _PrefTile({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.title,
    required this.sub,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String title;
  final String sub;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sub,
                  style: TextStyle(
                    fontSize: 11.5,
                    color: tokens.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: tokens.primaryAccent,
          ),
        ],
      ),
    );
  }
}
