import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/share_link_sheet.dart';
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

  void _showInfo(BuildContext context) {
    final tokens = context.tokens;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 5,
                  decoration: BoxDecoration(
                    color: tokens.textMuted.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Where are my notes?',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.4,
                  color: tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You can access your notes in Free Resources > Purchased Materials.',
                style: TextStyle(
                    fontSize: 14.5, height: 1.45, color: tokens.textSecondary),
              ),
              const SizedBox(height: 18),
              ApplePressable(
                onTap: () {
                  Navigator.of(sheet).pop();
                  context.push('/free-resources/purchased');
                },
                child: Container(
                  height: 50,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tokens.primaryAccent,
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: const Text(
                    'Open Purchased Materials',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final async = ref.watch(storeNotesProvider);

    return AppPageScaffold(
      title: 'Premium Notes',
      subtitle: 'Buy once, use on app and web',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/store'),
      right: ApplePressable(
        onTap: () {
          HapticFeedback.selectionClick();
          _showInfo(context);
        },
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: tokens.textMuted.withValues(alpha: 0.14),
            shape: BoxShape.circle,
          ),
          child: Icon(Symbols.info_rounded,
              size: 20, color: tokens.textSecondary),
        ),
      ),
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
                                gradient: selected
                                    ? LinearGradient(
                                        colors: cats[i] == 'All'
                                            ? const [Color(0xFF8E8E93), Color(0xFF636366)]
                                            : _categoryColors(cats[i]))
                                    : null,
                                color: selected
                                    ? null
                                    : tokens.textMuted.withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                cats[i],
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: selected ? Colors.white : tokens.textPrimary,
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
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => Padding(
                        padding: EdgeInsets.only(
                            bottom: i == shown.length - 1 ? 0 : 12),
                        child: _NoteCard(note: shown[i]),
                      ),
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

/// Accent colour per category, so every note has its own identity.
List<Color> _categoryColors(String category) {
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

class _NoteCard extends ConsumerWidget {
  const _NoteCard({required this.note});
  final StoreNote note;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final expired = note.isExpired;
    final owned = note.hasAccess && !note.isFree;
    final colors = _categoryColors(note.category);
    final accent = colors.last;

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

    final buttonColors = expired
        ? const [Color(0xFFFFB340), Color(0xFFFF9F0A)]
        : (note.hasAccess ? const [Color(0xFF30D158), Color(0xFF1E9E48)] : colors);

    return ApplePressable(
      onTap: () => context.push('/store/notes/${note.id}'),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(26),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color.alphaBlend(accent.withValues(alpha: 0.22), tokens.cardBg),
              Color.alphaBlend(accent.withValues(alpha: 0.06), tokens.cardBg),
            ],
          ),
          border: Border.all(color: accent.withValues(alpha: 0.28), width: 0.8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: colors,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.38),
                        blurRadius: 14,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Icon(Symbols.description_rounded,
                      fill: 1, size: 28, color: Colors.white),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        note.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                          letterSpacing: -0.4,
                          color: tokens.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          if (note.category.isNotEmpty)
                            _Tag(note.category, accent),
                          if ((note.subject ?? '').isNotEmpty)
                            _Tag(note.subject!, tokens.textSecondary),
                          _Tag('${note.validityDays} days', tokens.textSecondary),
                          if (expired) _Tag('Expired', tokens.danger),
                          if (owned) _Tag('Owned', tokens.success),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  formatNotePrice(note.price),
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.6,
                    color: note.isFree ? tokens.success : tokens.textPrimary,
                  ),
                ),
                if ((note.originalPrice ?? 0) > note.price) ...[
                  const SizedBox(width: 8),
                  Text(
                    formatNotePrice(note.originalPrice!),
                    style: TextStyle(
                      decoration: TextDecoration.lineThrough,
                      color: tokens.textMuted,
                      fontSize: 14,
                    ),
                  ),
                ],
                const Spacer(),
                ApplePressable(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    showShareLinkSheet(
                      context,
                      title: note.title,
                      message:
                          'Check out these premium notes on GenZ IITIAN: ${note.title}',
                      link:
                          'https://class.genziitian.in/courses/explore?note=${Uri.encodeQueryComponent(note.id)}',
                    );
                  },
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.16),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Symbols.ios_share_rounded,
                        size: 20, color: accent),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: ApplePressable(
                    onTap: primary,
                    child: Container(
                      height: 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(24),
                        gradient: LinearGradient(colors: buttonColors),
                        boxShadow: [
                          BoxShadow(
                            color: buttonColors.last.withValues(alpha: 0.35),
                            blurRadius: 14,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Text(
                        label,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: ApplePressable(
                    onTap: () => context.push('/store/notes/${note.id}'),
                    child: Container(
                      height: 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(24),
                        color: tokens.textMuted.withValues(alpha: 0.16),
                      ),
                      child: Text(
                        'Details',
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
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
