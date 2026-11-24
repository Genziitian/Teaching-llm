import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/shimmer_loading.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';

/// GET /api/site/careers-roles → { roles: [{ id, title, summary, tags, comp, type, mode, pay, ... }] }
/// Same open roles the website and the dashboard Jobs page show.
final jobRolesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/site/careers-roles');
  final data = res.data;
  final list = (data is Map && data['roles'] is List) ? data['roles'] as List : const [];
  return [for (final r in list) Map<String, dynamic>.from(r as Map)];
});

class JobsPage extends ConsumerWidget {
  const JobsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(jobRolesProvider);
    final tokens = context.tokens;

    return AppPageScaffold(
      title: 'Jobs',
      subtitle: 'Open roles at GenZ IITian',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/more'),
      body: AppRefresh(
        onRefresh: () async => ref.invalidate(jobRolesProvider),
        child: async.when(
          loading: () => const PageLoading(),
          error: (e, _) => ListView(
            padding: const EdgeInsets.all(40),
            children: [
              Icon(Icons.cloud_off, color: tokens.textMuted, size: 40),
              const SizedBox(height: 8),
              Text('Could not load jobs',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: tokens.textPrimary)),
            ],
          ),
          data: (roles) {
            if (roles.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(40),
                children: [
                  Icon(Icons.work_outline, color: tokens.textMuted, size: 40),
                  const SizedBox(height: 8),
                  Text('No open roles right now',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: tokens.textPrimary)),
                  const SizedBox(height: 4),
                  Text('Check back soon.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: tokens.textSecondary)),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: roles.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _RoleCard(role: roles[i]),
            );
          },
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({required this.role});
  final Map<String, dynamic> role;

  String _s(String k) => (role[k] ?? '').toString().trim();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final chips = <String>[
      _s('type'),
      _s('mode'),
      _s('pay'),
      ...((role['tags'] is List) ? (role['tags'] as List).map((e) => e.toString()) : const <String>[]),
    ].where((c) => c.isNotEmpty).toSet().toList();

    final meta = <String>[
      _s('location'),
      _s('experience'),
      if ((role['openings'] ?? 0) is num && (role['openings'] as num) > 0)
        '${(role['openings'] as num).toInt()} opening${(role['openings'] as num) > 1 ? 's' : ''}',
      if (_s('deadline').isNotEmpty) 'Apply by ${_s('deadline')}',
    ].where((m) => m.isNotEmpty).toList();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_s('title'),
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: tokens.textPrimary)),
          if (_s('summary').isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(_s('summary'),
                style: TextStyle(fontSize: 13, height: 1.4, color: tokens.textSecondary)),
          ],
          if (chips.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final c in chips)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: tokens.border),
                    ),
                    child: Text(c,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: tokens.textSecondary)),
                  ),
              ],
            ),
          ],
          if (_s('comp').isNotEmpty || meta.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text([if (_s('comp').isNotEmpty) _s('comp'), ...meta].join(' · '),
                style: TextStyle(fontSize: 12, color: tokens.textMuted)),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                HapticFeedback.lightImpact();
                showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  showDragHandle: true,
                  builder: (_) => _ApplySheet(role: role),
                );
              },
              child: const Text('Apply'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ApplySheet extends ConsumerStatefulWidget {
  const _ApplySheet({required this.role});
  final Map<String, dynamic> role;
  @override
  ConsumerState<_ApplySheet> createState() => _ApplySheetState();
}

class _ApplySheetState extends ConsumerState<_ApplySheet> {
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  final _age = TextEditingController();
  final _resume = TextEditingController();
  final _why = TextEditingController();
  bool _busy = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    final user = ref.read(authStateProvider).value;
    _name = TextEditingController(text: user?.name ?? '');
    _email = TextEditingController(text: user?.email ?? '');
    _phone = TextEditingController(text: user?.mobileNumber ?? '');
  }

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _age, _resume, _why]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final phone = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (_name.text.trim().isEmpty || !_email.text.contains('@') || phone.length < 10) {
      setState(() => _error = 'Please enter your name, a valid email and a 10 digit phone number.');
      return;
    }
    setState(() { _busy = true; _error = ''; });
    try {
      await ref.read(apiClientProvider).post<dynamic>('/api/site/job-applications', body: {
        'role': widget.role['id'],
        'role_title': widget.role['title'],
        'full_name': _name.text.trim(),
        'email': _email.text.trim(),
        'phone': phone.length > 10 ? phone.substring(phone.length - 10) : phone,
        'age': int.tryParse(_age.text.trim()),
        'resume_link': _resume.text.trim(),
        'experience_and_why': _why.text.trim(),
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Application for ${widget.role['title']} submitted.'),
        behavior: SnackBarBehavior.floating,
      ));
    } on DioException catch (e) {
      setState(() => _error = e.message ?? 'Could not submit. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(String label, TextEditingController c,
      {TextInputType? type, int lines = 1, String? hint}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: c,
        keyboardType: type,
        minLines: lines,
        maxLines: lines,
        decoration: InputDecoration(labelText: label, hintText: hint, border: const OutlineInputBorder()),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Apply: ${widget.role['title']}',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: tokens.textPrimary)),
            const SizedBox(height: 14),
            _field('Full name *', _name),
            _field('Email *', _email, type: TextInputType.emailAddress),
            _field('Phone (10 digits) *', _phone, type: TextInputType.phone),
            _field('Age', _age, type: TextInputType.number),
            _field('Resume link', _resume, type: TextInputType.url),
            _field('Experience and why you want this role', _why, lines: 4),
            if (_error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
              ),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(_busy ? 'Submitting…' : 'Submit application'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
