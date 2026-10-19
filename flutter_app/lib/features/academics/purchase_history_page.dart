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

/// Every premium-notes purchase made with this account, on the app or the
/// website. Only notes are listed here, not other kinds of purchases.
class PurchaseHistoryPage extends ConsumerWidget {
  const PurchaseHistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(myStoreNotesProvider);
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
          ref.invalidate(myStoreNotesProvider);
          await ref
              .read(myStoreNotesProvider.future)
              .catchError((_) => <MyStoreNote>[]);
        },
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
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
                        'Notes you buy on the app or the website show up here.',
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

List<Color> _colorsFor(String category) {
  switch (category.toLowerCase()) {
    case 'foundation':
      return const [Color(0xFF5AC8FA), Color(0xFF0A84FF)];
    case 'diploma':
      return const [Color(0xFFBF5AF2), Color(0xFF7D3CE0)];
    case 'qualifier':
      return const [Color(0xFFFFB340), Color(0xFFFF7A00)];
    case 're-attempt':
      return const [Color(0xFFFF6482), Color(0xFFFF2D55)];
    default:
      return const [Color(0xFF30D158), Color(0xFF1E9E48)];
  }
}

class _PurchaseCard extends StatelessWidget {
  const _PurchaseCard({required this.item});
  final MyStoreNote item;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final colors = _colorsFor(item.category);
    final expired = item.state == NoteAccessState.expired;
    final statusColor = expired ? tokens.danger : tokens.success;

    return ApplePressable(
      onTap: () => context.push('/store/notes/${item.noteId}'),
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
              child: const Icon(Symbols.description_rounded,
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
                      'Premium Notes',
                      if (item.purchasedAt != null)
                        formatNoteDate(item.purchasedAt!),
                    ].join(' · '),
                    style:
                        TextStyle(fontSize: 12.5, color: tokens.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    expired
                        ? 'Expired${item.expiresAt != null ? ' on ${formatNoteDate(item.expiresAt!)}' : ''}'
                        : 'Active${item.expiresAt != null ? ' until ${formatNoteDate(item.expiresAt!)}' : ''}',
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: statusColor),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              formatNotePrice(item.price),
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: tokens.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
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
