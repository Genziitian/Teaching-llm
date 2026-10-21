import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../store/store_notes_data.dart';
import '../support/support_providers.dart';
import '../../shared/widgets/shimmer_loading.dart';
import '../payments/payment_result_page.dart';

/// One row from /api/my-transactions (courses, bundles, notes, upgrades...).
class _Txn {
  _Txn(this.title, this.type, this.source, this.amount, this.createdAt,
      this.status, this.orderId, this.reason);
  final String title;
  final String type;
  final String source; // GOOGLE_PLAY or RAZORPAY
  final double amount;
  final DateTime? createdAt;
  final String status;
  final String orderId;
  final String? reason; // why a payment did not complete
}

final _myTransactionsProvider =
    FutureProvider.autoDispose<List<_Txn>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/my-transactions');
  final data = res.data;
  final list = (data is Map ? data['transactions'] : null) as List? ?? const [];
  final out = <_Txn>[];
  for (final j in list) {
    if (j is! Map) continue;
    final status = (j['status'] ?? '').toString().toUpperCase();
    final courses = (j['courses'] as List? ?? const [])
        .whereType<Map>()
        .map((c) => (c['name'] ?? '').toString())
        .where((n) => n.isNotEmpty)
        .toList();
    var title = courses.join(', ');
    if (title.isEmpty) title = 'Purchase';
    out.add(_Txn(
      title.replaceFirst('Study Note: ', ''),
      (j['type'] ?? 'PURCHASE').toString(),
      (j['source'] ?? 'RAZORPAY').toString(),
      (j['amount'] is num) ? (j['amount'] as num).toDouble() : 0,
      DateTime.tryParse((j['createdAt'] ?? '').toString())?.toLocal(),
      status,
      (j['orderId'] ?? '').toString(),
      (j['failureReason'] as String?),
    ));
  }
  return out;
});

/// Every purchase made with this account, on the app or the website:
/// courses, bundles, notes and upgrades, tagged with where it was paid.
class PurchaseHistoryPage extends ConsumerWidget {
  const PurchaseHistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(_myTransactionsProvider);
    final role = ref.watch(authStateProvider).value?.role;

    Widget contact() => _ContactCard(
          onTap: () {
            HapticFeedback.lightImpact();
            context.push(canAccessSupport(role) ? '/support' : '/contact-us');
          },
        );

    return AppPageScaffold(
      title: 'Purchase History',
      showBack: true,
      onBack: () =>
          context.canPop() ? context.pop() : context.go('/academics'),
      body: AppRefresh(
        onRefresh: () async {
          ref.invalidate(_myTransactionsProvider);
          await ref
              .read(_myTransactionsProvider.future)
              .catchError((_) => <_Txn>[]);
        },
        child: async.when(
          loading: () => const PageLoading(),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 120, 16, 40),
            children: [
              Center(
                child: Text('Could not load purchases.\nPull down to retry.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: tokens.textSecondary)),
              ),
            ],
          ),
          data: (items) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
            children: [
              if (items.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 56),
                  child: Column(
                    children: [
                      Icon(Symbols.receipt_long_rounded,
                          size: 46, color: tokens.textMuted),
                      const SizedBox(height: 12),
                      Text('No purchases yet',
                          style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: tokens.textPrimary)),
                      const SizedBox(height: 4),
                      Text(
                        'Courses and notes you buy on the app or the website show up here.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 13, color: tokens.textSecondary),
                      ),
                    ],
                  ),
                )
              else
                for (final n in items) ...[
                  _PurchaseCard(item: n),
                  const SizedBox(height: 12),
                ],
              const SizedBox(height: 8),
              contact(),
            ],
          ),
        ),
      ),
    );
  }
}

List<Color> _colorsForType(String type) {
  switch (type) {
    case 'STUDY_NOTE':
      return const [Color(0xFF3A9D6B), Color(0xFF237A52)];
    case 'UPGRADE':
      return const [Color(0xFFFFB340), Color(0xFFFF7A00)];
    case 'MENTORSHIP':
      return const [Color(0xFFBF5AF2), Color(0xFF7D3CE0)];
    case 'TEST_SERIES':
      return const [Color(0xFFFF6482), Color(0xFFFF2D55)];
    default:
      return const [Color(0xFF5AC8FA), Color(0xFF0A84FF)];
  }
}

IconData _iconForType(String type) {
  switch (type) {
    case 'STUDY_NOTE':
      return Symbols.description_rounded;
    case 'UPGRADE':
      return Symbols.trending_up_rounded;
    case 'MENTORSHIP':
      return Symbols.person_rounded;
    case 'TEST_SERIES':
      return Symbols.quiz_rounded;
    default:
      return Symbols.school_rounded;
  }
}

String _labelForType(String type) {
  switch (type) {
    case 'STUDY_NOTE':
      return 'Premium Notes';
    case 'UPGRADE':
      return 'Upgrade';
    case 'MENTORSHIP':
      return 'Mentorship';
    case 'TEST_SERIES':
      return 'Test Series';
    default:
      return 'Course';
  }
}

bool _isPaid(String s) => s == 'SUCCESS' || s == 'PAID';

(String, Color, PaymentOutcome?) _statusLook(String s, AppThemeTokens tokens) {
  switch (s) {
    case 'SUCCESS':
    case 'PAID':
      return ('Paid', tokens.success, null);
    case 'FAILED':
      return ('Failed', const Color(0xFFFF453A), PaymentOutcome.failed);
    case 'CANCELLED':
      return ('Cancelled', const Color(0xFFFF9F0A), PaymentOutcome.cancelled);
    case 'PENDING_VERIFY':
      return ('Confirming', const Color(0xFF0A84FF), PaymentOutcome.pending);
    case 'TIMED_OUT':
      return ('Timed out', tokens.textMuted, PaymentOutcome.cancelled);
    case 'STARTED':
      return ('Waiting for payment', const Color(0xFFFF9F0A), PaymentOutcome.cancelled);
    default:
      return ('Not completed', tokens.textMuted, PaymentOutcome.cancelled);
  }
}

class _PurchaseCard extends StatelessWidget {
  const _PurchaseCard({required this.item});
  final _Txn item;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colors = _colorsForType(item.type);
    final isPlay = item.source == 'GOOGLE_PLAY';
    final srcColor = isPlay ? const Color(0xFF0A84FF) : tokens.textSecondary;
    final paid = _isPaid(item.status);
    final look = _statusLook(item.status, tokens);

    return ApplePressable(
      onTap: paid || look.$3 == null
          ? null
          : () => showPaymentResult(
                context,
                outcome: look.$3!,
                title: item.title,
                amount: item.amount > 0 ? item.amount : null,
                orderId: item.orderId.isEmpty ? null : item.orderId,
                method: isPlay ? 'Google Play' : 'Razorpay',
                reason: item.reason,
              ),
      pressedScale: 0.98,
      child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(15),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: colors,
              ),
            ),
            child: Icon(_iconForType(item.type),
                fill: 1, size: 26, color: Colors.white),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  [
                    _labelForType(item.type),
                    if (item.createdAt != null) formatNoteDate(item.createdAt!),
                  ].join(' · '),
                  style:
                      TextStyle(fontSize: 12.5, color: tokens.textSecondary),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: srcColor.withValues(alpha: 0.13),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(isPlay ? 'Google Play' : 'Razorpay',
                          style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                              color: srcColor)),
                    ),
                    const SizedBox(width: 8),
                    Text(look.$1,
                        style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: look.$2)),
                  ],
                ),
                if (!paid && (item.reason ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(item.reason!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 12, height: 1.3, color: tokens.textSecondary)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            formatNotePrice(item.amount),
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: paid ? tokens.textPrimary : tokens.textMuted,
              decoration: paid ? null : TextDecoration.lineThrough,
            ),
          ),
        ],
      ),
    ));
  }
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ApplePressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF5AC8FA), Color(0xFF0A84FF)],
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.22),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Symbols.headset_mic_rounded,
                  fill: 1, size: 24, color: Colors.white),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Contact us',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w800)),
                  SizedBox(height: 2),
                  Text('Problem with a purchase? We will help.',
                      style: TextStyle(color: Colors.white, fontSize: 13)),
                ],
              ),
            ),
            const Icon(Symbols.chevron_right_rounded,
                size: 24, color: Colors.white),
          ],
        ),
      ),
    );
  }
}
