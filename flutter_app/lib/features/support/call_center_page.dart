import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../settings/login_activity_page.dart';
import 'support_call.dart';
import 'support_providers.dart';

/// GET /api/support/calls/history[?userId=] — manager call log (who picked up, duration).
final callHistoryProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, userId) async {
  final res = await ref.watch(apiClientProvider).get<dynamic>(
      '/api/support/calls/history${userId == null ? '' : '?userId=${Uri.encodeComponent(userId)}'}');
  final data = res.data;
  return data is List ? data.cast<Map<String, dynamic>>() : [];
});

/// GET /api/users/:id — the same full profile managers see on the web.
final callUserProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, id) async {
  final res = await ref
      .watch(apiClientProvider)
      .get<dynamic>('/api/users/${Uri.encodeComponent(id)}');
  final data = res.data;
  if (data is Map && data['user'] is Map) {
    return Map<String, dynamic>.from(data['user'] as Map);
  }
  return Map<String, dynamic>.from(data as Map);
});

/// Manager call center: search any student (name/email/mobile/security no./#serial) + full call log.
class CallCenterPage extends ConsumerStatefulWidget {
  const CallCenterPage({super.key});
  @override
  ConsumerState<CallCenterPage> createState() => _CallCenterPageState();
}

class _CallCenterPageState extends ConsumerState<CallCenterPage> {
  bool _history = false;
  String _query = '';
  Timer? _debounce;
  bool _searching = false;
  List<Map<String, dynamic>> _hits = const [];

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _search(String q) {
    _query = q.trim();
    _debounce?.cancel();
    if (_query.length < 2) {
      setState(() => _hits = const []);
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      final q = _query;
      try {
        final res = await ref
            .read(apiClientProvider)
            .get<dynamic>('/api/users?search=${Uri.encodeComponent(q)}');
        final users = ((res.data is Map ? res.data['users'] : null) as List? ?? [])
            .cast<Map<String, dynamic>>()
            .where((u) => u['role'] == 'STUDENT')
            .take(50)
            .toList();
        if (mounted && q == _query) setState(() => _hits = users);
      } catch (_) {
        if (mounted) setState(() => _hits = const []);
      } finally {
        if (mounted && q == _query) setState(() => _searching = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return AppPageScaffold(
      title: 'Call center',
      subtitle: 'Find a student, see their profile, call them',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/support'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Directory')),
              ButtonSegment(value: true, label: Text('Call history')),
            ],
            selected: {_history},
            onSelectionChanged: (s) => setState(() => _history = s.first),
          ),
          const SizedBox(height: 16),
          if (!_history) ...[
            TextField(
              onChanged: _search,
              autocorrect: false,
              decoration: const InputDecoration(
                prefixIcon: Icon(Symbols.search_rounded),
                hintText: 'Name, email, mobile, security no. or #serial',
              ),
            ),
            const SizedBox(height: 12),
            if (_searching) const LinearProgressIndicator(minHeight: 2),
            if (!_searching && _query.length >= 2 && _hits.isEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text('No students found',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: tokens.textMuted)),
              ),
            for (final u in _hits)
              _Tile(
                title: '${u['name']}',
                sub: [
                  u['email'],
                  u['mobileNumber'],
                  if (u['securityNumber'] != null) 'Sec ${u['securityNumber']}',
                  if (u['notificationGroupSerial'] != null)
                    '#${u['notificationGroupSerial']}',
                ].where((x) => x != null).join(' · '),
                onTap: () => context.push(
                    '/support/call-center/${Uri.encodeComponent('${u['id']}')}'),
                trailing: IconButton.filled(
                  tooltip: 'Call ${u['name']}',
                  onPressed: () => startSupportCall(context,
                      userId: '${u['id']}', name: '${u['name']}'),
                  icon: const Icon(Symbols.call_rounded, fill: 1),
                ),
              ),
          ] else
            const _HistoryList(userId: null),
        ],
      ),
    );
  }
}

/// Full student profile + call button + their call log, so the manager knows who they're calling.
class StudentCallProfilePage extends ConsumerWidget {
  const StudentCallProfilePage({super.key, required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final user = ref.watch(callUserProvider(userId));
    return AppPageScaffold(
      title: user.asData?.value['name']?.toString() ?? 'Student',
      showBack: true,
      onBack: () =>
          context.canPop() ? context.pop() : context.go('/support/call-center'),
      body: user.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(supportError(e))),
        data: (u) {
          final enrollments = (u['enrollments'] as List? ?? [])
              .map((e) => (e as Map)['course']?['name'])
              .where((n) => n != null)
              .join(', ');
          final created = DateTime.tryParse('${u['createdAt'] ?? ''}');
          final fields = <(String, Object?)>[
            ('Email', u['email']),
            ('Mobile', u['mobileNumber']),
            ('Security no.', u['securityNumber']),
            ('Serial', u['notificationGroupSerial'] == null ? null : '#${u['notificationGroupSerial']}'),
            ('Gender', u['gender']),
            ('Age', u['age']),
            ('State', u['state']),
            ('IITM level', u['iitmLevel']),
            ('IITM type', u['iitmUserType']),
            ('Joined IITM', [u['iitmJoinMonth'], u['iitmJoinYear']].where((x) => x != null).join(' ')),
            ('Courses', enrollments),
            ('Account created', created == null ? null : '${created.toLocal()}'.split('.').first),
            ('Status', u['isTerminated'] == true ? 'Terminated' : 'Active'),
          ].where((f) => f.$2 != null && '${f.$2}'.isNotEmpty);

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              FilledButton.icon(
                onPressed: u['isTerminated'] == true
                    ? null
                    : () => startSupportCall(context,
                        userId: userId, name: '${u['name']}'),
                icon: const Icon(Symbols.call_rounded, fill: 1),
                label: Text('Call ${'${u['name']}'.split(' ').first}'),
              ),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(
                  color: tokens.cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: tokens.border, width: 0.5),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Column(children: [
                  for (final f in fields)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 120,
                            child: Text(f.$1,
                                style: TextStyle(color: tokens.textMuted)),
                          ),
                          Expanded(
                            child: SelectableText('${f.$2}',
                                style: TextStyle(color: tokens.textPrimary)),
                          ),
                        ],
                      ),
                    ),
                ]),
              ),
              const SizedBox(height: 24),
              Text('Login activity',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: tokens.textPrimary)),
              const SizedBox(height: 12),
              LoginActivityList(userId: userId),
              const SizedBox(height: 24),
              Text('Call history',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: tokens.textPrimary)),
              const SizedBox(height: 12),
              _HistoryList(userId: userId),
            ],
          );
        },
      ),
    );
  }
}

class _HistoryList extends ConsumerWidget {
  const _HistoryList({required this.userId});
  final String? userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    return ref.watch(callHistoryProvider(userId)).when(
          loading: () => const LinearProgressIndicator(minHeight: 2),
          error: (e, _) => Text(supportError(e)),
          data: (rows) => rows.isEmpty
              ? Text('No calls yet', style: TextStyle(color: tokens.textMuted))
              : Column(children: [
                  for (final c in rows)
                    () {
                      final d = describeCall(c);
                      return _Tile(
                        title: d.title,
                        sub: [d.sub, if ((c['note'] ?? '').toString().isNotEmpty) '${c['note']}'].join('\n'),
                        trailing: Icon(
                          d.answered ? Symbols.call_received_rounded : Symbols.call_missed_rounded,
                          color: d.answered ? const Color(0xFF34C759) : tokens.textMuted,
                        ),
                      );
                    }(),
                ]),
        );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.title, required this.sub, this.onTap, this.trailing});
  final String title;
  final String sub;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.border, width: 0.5),
      ),
      child: ListTile(
        onTap: onTap,
        title: Text(title,
            style: TextStyle(fontWeight: FontWeight.w600, color: tokens.textPrimary)),
        subtitle: Text(sub, style: TextStyle(color: tokens.textMuted)),
        trailing: trailing,
      ),
    );
  }
}
