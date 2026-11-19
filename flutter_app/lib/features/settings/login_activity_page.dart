import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';

/// GET /api/user/login-activity[?userId=] — one row per device, latest login first.
final loginActivityProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, userId) async {
  final res = await ref.watch(apiClientProvider).get<dynamic>(
      '/api/user/login-activity${userId == null ? '' : '?userId=${Uri.encodeComponent(userId)}'}');
  final data = res.data;
  return ((data is Map ? data['devices'] : null) as List? ?? [])
      .cast<Map<String, dynamic>>();
});

class LoginActivityPage extends StatelessWidget {
  const LoginActivityPage({super.key});

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return AppPageScaffold(
      title: 'Login activity',
      subtitle: "Where you're logged in",
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/settings'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Text(
            'Devices and approximate places your account logged in from. '
            "We'll alert you when a new device logs in. If you don't recognise one, contact support.",
            style: TextStyle(fontSize: 13.5, color: tokens.textMuted),
          ),
          const SizedBox(height: 16),
          const LoginActivityList(),
        ],
      ),
    );
  }
}

/// The device list; [userId] = someone else's (managers, also shows IP).
class LoginActivityList extends ConsumerWidget {
  const LoginActivityList({super.key, this.userId});
  final String? userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    return ref.watch(loginActivityProvider(userId)).when(
          loading: () => const LinearProgressIndicator(minHeight: 2),
          error: (_, _) => Text('Could not load login activity',
              style: TextStyle(color: tokens.textMuted)),
          data: (devices) => devices.isEmpty
              ? Text('No login activity yet. It appears from the next login.',
                  style: TextStyle(color: tokens.textMuted))
              : Column(children: [
                  for (final d in devices)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: tokens.cardBg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: tokens.border, width: 0.5),
                      ),
                      child: ListTile(
                        leading: Icon(
                          d['platform'] == 'android'
                              ? Symbols.smartphone_rounded
                              : Symbols.computer_rounded,
                          color: tokens.textPrimary,
                        ),
                        title: Text.rich(TextSpan(children: [
                          TextSpan(text: '${d['deviceName'] ?? 'Unknown device'}'),
                          if (d['isCurrent'] == true)
                            const TextSpan(
                                text: '  This device',
                                style: TextStyle(
                                    fontSize: 12, color: Color(0xFF34C759))),
                        ]),
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: tokens.textPrimary)),
                        subtitle: Text(
                          [
                            [d['city'], d['region'] == d['city'] ? null : d['region'], d['country']]
                                    .where((x) => x != null && '$x'.isNotEmpty)
                                    .join(', ')
                                    .ifEmpty('Location unknown'),
                            d['os'],
                            if (d['ip'] != null) 'IP ${d['ip']}',
                          ].where((x) => x != null).join(' · ') +
                              '\nLast login ${_fmt(d['lastLoginAt'])} · ${d['logins']} login${d['logins'] == 1 ? '' : 's'}',
                          style: TextStyle(color: tokens.textMuted),
                        ),
                      ),
                    ),
                ]),
        );
  }

  static String _fmt(dynamic iso) {
    final d = DateTime.tryParse('${iso ?? ''}')?.toLocal();
    return d == null ? '' : DateFormat('d MMM yyyy, h:mm a').format(d);
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
