import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';

/// Anyone can check whether a person works (or worked) at GenZ IITian.
/// GET /api/site/employee/verify?id=GENZ-EMP-0000[&name=Full Name]
/// Returns only public fields: employee_id, full_name, department, role, tenure, status.
class VerifyEmployeePage extends ConsumerStatefulWidget {
  const VerifyEmployeePage({super.key});
  @override
  ConsumerState<VerifyEmployeePage> createState() => _VerifyEmployeePageState();
}

class _VerifyEmployeePageState extends ConsumerState<VerifyEmployeePage> {
  final _id = TextEditingController();
  final _name = TextEditingController();
  bool _busy = false;
  bool _searched = false;
  String _error = '';
  Map<String, dynamic>? _employee;

  @override
  void dispose() {
    _id.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final id = _id.text.trim().toUpperCase();
    if (id.isEmpty) {
      setState(() => _error = 'Enter the Employee ID.');
      return;
    }
    setState(() { _busy = true; _error = ''; _employee = null; _searched = false; });
    try {
      final res = await ref.read(apiClientProvider).get<dynamic>(
        '/api/site/employee/verify',
        query: {'id': id, if (_name.text.trim().isNotEmpty) 'name': _name.text.trim()},
      );
      final data = res.data;
      final emp = (data is Map && data['employee'] is Map) ? Map<String, dynamic>.from(data['employee'] as Map) : null;
      setState(() { _employee = emp; _searched = true; });
    } on DioException catch (e) {
      setState(() => _error = e.message ?? 'Could not verify. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final emp = _employee;

    Widget row(String k, String v) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 96, child: Text(k, style: TextStyle(fontSize: 12, color: tokens.textMuted))),
              Expanded(child: Text(v.isEmpty ? '-' : v, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: tokens.textPrimary))),
            ],
          ),
        );

    return AppPageScaffold(
      title: 'Verify Employee',
      subtitle: 'Check a GenZ IITian employee record',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/more'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          TextField(
            controller: _id,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(labelText: 'Employee ID', hintText: 'GENZ-EMP-0010', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Full name (optional)', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(onPressed: _busy ? null : _verify, child: Text(_busy ? 'Checking…' : 'Verify')),
          ),
          if (_error.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
            ),
          if (_searched && emp == null)
            Container(
              margin: const EdgeInsets.only(top: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: tokens.cardBg, borderRadius: BorderRadius.circular(14), border: Border.all(color: tokens.border)),
              child: Text('No matching employee record found. Check the ID and name.',
                  style: TextStyle(fontSize: 14, color: tokens.textSecondary)),
            ),
          if (emp != null)
            Container(
              margin: const EdgeInsets.only(top: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: tokens.cardBg, borderRadius: BorderRadius.circular(14), border: Border.all(color: tokens.border)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    const Icon(Icons.verified_rounded, color: Color(0xFF16A34A)),
                    const SizedBox(width: 8),
                    Text('Verified', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: tokens.textPrimary)),
                  ]),
                  const SizedBox(height: 8),
                  row('Name', '${emp['full_name'] ?? ''}'),
                  row('Employee ID', '${emp['employee_id'] ?? ''}'),
                  row('Role', '${emp['role'] ?? ''}'),
                  row('Department', '${emp['department'] ?? ''}'),
                  row('Tenure', '${emp['tenure'] ?? ''}'),
                  row('Status', '${emp['status'] ?? ''}'),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
