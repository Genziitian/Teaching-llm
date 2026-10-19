import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import 'store_notes_data.dart';

/// Premium Notes: every note as a card with Buy now / Details.
class StoreNotesPage extends ConsumerStatefulWidget {
  const StoreNotesPage({super.key});

  @override
  ConsumerState<StoreNotesPage> createState() => _StoreNotesPageState();
}

class _StoreNotesPageState extends ConsumerState<StoreNotesPage> {
  String _category = 'All';

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final async = ref.watch(storeNotesProvider);

    return AppPageScaffold(
      title: 'Premium Notes',
      subtitle: 'Buy once, use on app and web',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/store'),
      body: AppRefresh(
        onRefresh: () async {
          ref.invalidate(storeNotesProvider);
          await ref.read(storeNotesProvider.future).catchError((_) => <StoreNote>[]);
        },
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const SizedBox(height: 120),
              Center(
                child: Text('Could not load notes.\nPull down to retry.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: tokens.textSecondary)),
              ),
            ],
          ),
          data: (notes) {
            if (notes.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  const SizedBox(height: 120),
                  Icon(Symbols.description_rounded,
                      size: 48, color: tokens.textMuted),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('No notes yet. Check back soon.',
                        style: TextStyle(
                            color: tokens.textSecondary,
                            fontWeight: FontWeight.w600)),
                  ),
                ],
              );
            }

            final cats = <String>['All', ...{for (final n in notes) n.category}];
            final cat = cats.contains(_category) ? _category : 'All';
            final shown =
                cat == 'All' ? notes : notes.where((n) => n.category == cat).toList();

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                if (cats.length > 2)
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: 56,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                        itemCount: cats.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final selected = cats[i] == cat;
                          return ApplePressable(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setState(() => _category = cats[i]);
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: selected
                                    ? tokens.textPrimary
                                    : tokens.textMuted.withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                cats[i],
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: selected ? tokens.bg : tokens.textPrimary,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      mainAxisExtent: 246,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => _NoteCard(note: shown[i]),
                      childCount: shown.length,
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _NoteCard extends ConsumerWidget {
  const _NoteCard({required this.note});
  final StoreNote note;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final expired = note.isExpired;
    final owned = note.hasAccess && !note.isFree;

    final label = expired
        ? 'Restore now'
        : (note.hasAccess ? 'Open' : (note.isFree ? 'Get free' : 'Buy now'));

    Future<void> primary() async {
      if (note.hasAccess) {
        context.push('/store/notes/${note.id}');
        return;
      }
      await buyStoreNote(context, ref, noteId: note.id, title: note.title);
    }

    return ApplePressable(
      onTap: () => context.push('/store/notes/${note.id}'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: tokens.textMuted.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Symbols.description_rounded,
                      fill: 1, size: 22, color: tokens.textSecondary),
                ),
                const Spacer(),
                if (expired)
                  _Tag('Expired', tokens.danger)
                else if (owned)
                  _Tag('Owned', tokens.success),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              note.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                height: 1.25,
                letterSpacing: -0.2,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              [note.subject, note.category]
                  .where((e) => e != null && e.isNotEmpty)
                  .join(' · '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: tokens.textSecondary),
            ),
            const Spacer(),
            Text(
              formatNotePrice(note.price),
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: note.isFree ? tokens.success : tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            _CardButton(
              label: label,
              filled: true,
              color: expired ? tokens.warning : tokens.primaryAccent,
              onTap: primary,
            ),
            const SizedBox(height: 6),
            _CardButton(
              label: 'Details',
              filled: false,
              color: tokens.textPrimary,
              onTap: () => context.push('/store/notes/${note.id}'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.text, this.color);
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(text,
            style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700, color: color)),
      );
}

class _CardButton extends StatelessWidget {
  const _CardButton({
    required this.label,
    required this.filled,
    required this.color,
    required this.onTap,
  });
  final String label;
  final bool filled;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ApplePressable(
      onTap: onTap,
      child: Container(
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: filled ? color : tokens.textMuted.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: filled ? Colors.white : color,
          ),
        ),
      ),
    );
  }
}
