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
                            bottom: i == shown.length - 1 ? 0 : 16),
                        child: _NoteCard(note: shown[i], index: i),
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
      return const [Color(0xFF3A9D6B), Color(0xFF237A52)];
  }
}

class _NoteCard extends ConsumerWidget {
  const _NoteCard({required this.note, this.index = 0});
  final StoreNote note;
  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final expired = note.isExpired;
    final owned = note.hasAccess && !note.isFree;
    final colors = _categoryColors(note.category);

    final label = expired
        ? 'Restore now'
        : (note.hasAccess ? 'Open' : (note.isFree ? 'Get free' : 'Buy now'));

    void openDetails() => context.push('/store/notes/${note.id}');

    Future<void> primary() async {
      if (note.hasAccess) {
        openDetails();
        return;
      }
      await buyStoreNote(
        context,
        ref,
        noteId: note.id,
        title: note.title,
        price: note.price,
      );
    }

    void share() {
      HapticFeedback.selectionClick();
      showShareLinkSheet(
        context,
        title: note.title,
        message: 'Check out these premium notes on GenZ IITIAN: ${note.title}',
        link:
            'https://class.genziitian.in/courses/explore?note=${Uri.encodeQueryComponent(note.id)}',
      );
    }

    final buttonColor = expired
        ? const Color(0xFFD98A00)
        : (note.hasAccess ? tokens.success : tokens.textPrimary);
    final buttonText = (expired || note.hasAccess) ? Colors.white : tokens.bg;

    final desc = (note.description ?? '').trim();
    final blurb = desc.isNotEmpty ? desc : (note.subject ?? '').trim();

    final card = ApplePressable(
      onTap: openDetails,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: tokens.border, width: 0.5),
          boxShadow: const [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 24,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Cover: category colour, paper sheets, glass chips ──────
            SizedBox(
              height: 140,
              child: Stack(
                clipBehavior: Clip.hardEdge,
                children: [
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: colors,
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: -70,
                    left: -50,
                    child: Container(
                      width: 220,
                      height: 220,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            Colors.white.withValues(alpha: 0.30),
                            Colors.white.withValues(alpha: 0),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    right: 30,
                    bottom: -30,
                    child: Transform.rotate(
                      angle: 0.13,
                      child: const _Sheet(alpha: 0.5),
                    ),
                  ),
                  Positioned(
                    right: 58,
                    bottom: -20,
                    child: Transform.rotate(
                      angle: -0.10,
                      child: _Sheet(alpha: 0.96, accent: colors.last),
                    ),
                  ),
                  Positioned(
                    top: 14,
                    right: 14,
                    child: ApplePressable(
                      onTap: share,
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.22),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.30),
                              width: 0.8),
                        ),
                        child: const Icon(Symbols.ios_share_rounded,
                            size: 20, color: Colors.white),
                      ),
                    ),
                  ),
                  if (expired || owned)
                    Positioned(
                      top: 16,
                      left: 16,
                      child: _GlassPill(
                        icon: expired
                            ? Symbols.schedule_rounded
                            : Symbols.check_circle_rounded,
                        text: expired ? 'Expired' : 'Owned',
                      ),
                    ),
                  Positioned(
                    left: 16,
                    bottom: 16,
                    child: Row(
                      children: [
                        if (note.category.isNotEmpty)
                          _GlassPill(text: note.category),
                        if (note.category.isNotEmpty) const SizedBox(width: 8),
                        _GlassPill(
                          icon: Symbols.event_available_rounded,
                          text: '${note.validityDays} days',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── Body ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    note.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      height: 1.15,
                      letterSpacing: -0.6,
                      color: tokens.textPrimary,
                    ),
                  ),
                  if (blurb.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      blurb,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14.5,
                        height: 1.35,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        formatNotePrice(note.price),
                        style: TextStyle(
                          fontSize: 30,
                          height: 1,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.9,
                          color: note.isFree
                              ? tokens.success
                              : tokens.textPrimary,
                        ),
                      ),
                      if ((note.originalPrice ?? 0) > note.price) ...[
                        const SizedBox(width: 10),
                        Text(
                          formatNotePrice(note.originalPrice!),
                          style: TextStyle(
                            decoration: TextDecoration.lineThrough,
                            color: tokens.textMuted,
                            fontSize: 16,
                          ),
                        ),
                      ],
                      const Spacer(),
                      if (note.files.length > 1)
                        Text(
                          '${note.files.length} files',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: tokens.textSecondary,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: ApplePressable(
                          onTap: primary,
                          child: Container(
                            height: 54,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: buttonColor,
                              borderRadius: BorderRadius.circular(27),
                            ),
                            child: Text(
                              label,
                              style: TextStyle(
                                color: buttonText,
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: ApplePressable(
                          onTap: openDetails,
                          child: Container(
                            height: 54,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: tokens.textMuted.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(27),
                            ),
                            child: Text(
                              'Details',
                              style: TextStyle(
                                color: tokens.textPrimary,
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
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
          ],
        ),
      ),
    );

    // Each card rises in once, a little after the one above it.
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 420 + (index > 5 ? 5 : index) * 70),
      curve: Curves.easeOutCubic,
      builder: (_, v, child) => Opacity(
        opacity: v,
        child: Transform.translate(offset: Offset(0, (1 - v) * 18), child: child),
      ),
      child: card,
    );
  }
}

/// A small frosted chip that sits on the coloured cover.
class _GlassPill extends StatelessWidget {
  const _GlassPill({required this.text, this.icon});
  final String text;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.30), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 15, color: Colors.white),
            const SizedBox(width: 5),
          ],
          Text(
            text,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.1,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

/// A sheet of notes: used twice, tilted, to give the cover some depth.
class _Sheet extends StatelessWidget {
  const _Sheet({required this.alpha, this.accent});
  final double alpha;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    Widget line(double w) => Container(
          width: w,
          height: 5,
          margin: const EdgeInsets.only(bottom: 7),
          decoration: BoxDecoration(
            color: const Color(0x1F000000),
            borderRadius: BorderRadius.circular(3),
          ),
        );
    return Container(
      width: 88,
      height: 112,
      padding: const EdgeInsets.fromLTRB(13, 14, 13, 0),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: alpha),
        borderRadius: BorderRadius.circular(13),
        boxShadow: const [
          BoxShadow(color: Color(0x26000000), blurRadius: 14, offset: Offset(0, 6)),
        ],
      ),
      child: accent == null
          ? null
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 34,
                  height: 7,
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: accent!.withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                line(58),
                line(50),
                line(58),
                line(36),
              ],
            ),
    );
  }
}

