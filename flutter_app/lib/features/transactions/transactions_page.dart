import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/app_refresh.dart';

import '../../shared/widgets/sub_page_header.dart';

/// GET /api/my-transactions → { transactions: [...] }.
/// Aggregates upgrades, orders, mentorships, test series, store notes.
final transactionsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<Map<String, dynamic>>('/api/my-transactions');
  final list = (res.data?['transactions'] as List?) ?? const [];
  return [for (final j in list) j as Map<String, dynamic>];
});

class TransactionsPage extends ConsumerWidget {
  const TransactionsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(transactionsProvider);
    final tokens = context.tokens;

    return AppPageScaffold(
      title: 'Transactions',
      subtitle: 'Payment history & invoices',
      showBack: true,
      onBack: () =>
          context.canPop() ? context.pop() : context.go('/more'),
      body: AppRefresh(
        onRefresh: () async => ref.invalidate(transactionsProvider),
        child: async.when(
          loading: () => Center(
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: tokens.primaryAccent,
            ),
          ),
          error: (e, _) => _Error(message: e.toString()),
          data: (list) {
            if (list.isEmpty) return const _Empty();
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _TxnCard(txn: list[i]),
            );
          },
        ),
      ),
    );
  }
}

class _TxnCard extends StatelessWidget {
  const _TxnCard({required this.txn});
  final Map<String, dynamic> txn;

  static const _typeLabels = {
    'UPGRADE': 'Course Upgrade',
    'PURCHASE': 'Course Purchase',
    'MENTORSHIP': 'Mentorship',
    'TEST_SERIES': 'Test Series',
    'STUDY_NOTE': 'Study Notes',
  };

  static const _typeIcons = {
    'UPGRADE': Icons.arrow_upward,
    'PURCHASE': Icons.shopping_bag_outlined,
    'MENTORSHIP': Icons.people_outline,
    'TEST_SERIES': Icons.quiz_outlined,
    'STUDY_NOTE': Icons.description_outlined,
  };

  String _formatDate(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    const months = [
      'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
    ];
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final type = (txn['type'] as String?) ?? 'PURCHASE';
    final status = (txn['status'] as String?) ?? 'SUCCESS';
    final amount = (txn['amount'] as num?)?.toInt() ?? 0;
    final courses = (txn['courses'] as List?) ?? const [];
    final firstName = courses.isNotEmpty
        ? ((courses.first as Map)['name'] as String?) ?? ''
        : '';
    final isOk = status == 'SUCCESS' || status == 'PAID' || status == 'COMPLETED';
    final dotColor = isOk ? tokens.success : tokens.warning;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.border),
        boxShadow: AppShadows.sm,
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: tokens.textMuted.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: Icon(
              _typeIcons[type] ?? Icons.receipt_long,
              color: tokens.textSecondary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (_typeLabels[type] ?? type).toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: tokens.primaryAccent,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  firstName.isEmpty ? 'Transaction' : firstName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: dotColor,
                        shape: BoxShape.circle,
                        boxShadow: AppShadows.pillGlow(dotColor),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      status,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: tokens.textSecondary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _formatDate(txn['createdAt'] as String?),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '₹$amount',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: tokens.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ListView(
      padding: const EdgeInsets.all(40),
      children: [
        Icon(Icons.receipt_long_outlined,
            color: tokens.textMuted, size: 40),
        const SizedBox(height: 8),
        Text(
          'No transactions yet',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: tokens.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          'Purchases and upgrades will appear here.',
          style: TextStyle(
            fontSize: 13,
            color: tokens.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ListView(
      padding: const EdgeInsets.all(40),
      children: [
        Icon(Icons.cloud_off, color: tokens.textMuted, size: 40),
        const SizedBox(height: 8),
        Text(
          'Could not load transactions',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: tokens.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          message,
          style: TextStyle(
            fontSize: 13,
            color: tokens.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
