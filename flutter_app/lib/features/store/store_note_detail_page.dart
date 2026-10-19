import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/downloads/download_providers.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../downloads/download_button.dart';
import 'store_notes_data.dart';

/// Full page about one note. Highlights and rules come from the server so
/// the website's Details popup shows exactly the same text.
class StoreNoteDetailPage extends ConsumerWidget {
  const StoreNoteDetailPage({super.key, required this.noteId});
  final String noteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(storeNoteProvider(noteId));

    return AppPageScaffold(
      title: 'Details',
      showBack: true,
      onBack: () =>
          context.canPop() ? context.pop() : context.go('/store/notes'),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('This note is not available.',
                style: TextStyle(color: tokens.textSecondary)),
          ),
        ),
        data: (note) => _Body(note: note),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.note});
  final StoreNote note;

  Future<void> _download(BuildContext context, WidgetRef ref) {
    return startDownloadFlow(
      context,
      ref,
      contentId: note.id,
      contentType: 'STORE_NOTE',
      title: note.title,
      courseName: 'Premium Notes',
      // Saved with the file so it can be removed on expiry, even offline.
      version: note.expiresAt?.toUtc().toIso8601String(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final localPath = ref.watch(downloadStatusProvider(note.id)).value;
    final expired = note.isExpired;
    final active = note.hasAccess;

    String cta;
    Color ctaColor = tokens.primaryAccent;
    IconData ctaIcon;
    Future<void> Function() onCta;

    if (active && localPath != null) {
      cta = 'Open';
      ctaIcon = Symbols.menu_book_rounded;
      onCta = () async {
        final uri = Uri(path: '/material', queryParameters: {
          'contentId': note.id,
          'title': note.title,
          'contentType': 'STORE_NOTE',
          'localPath': localPath,
          'courseName': 'Premium Notes',
        });
        context.push(uri.toString());
      };
    } else if (active) {
      cta = 'Download';
      ctaColor = tokens.success;
      ctaIcon = Symbols.download_rounded;
      onCta = () => _download(context, ref);
    } else if (expired) {
      cta = note.price > 0
          ? 'Restore now · ${formatNotePrice(note.price)}'
          : 'Restore now';
      ctaColor = tokens.warning;
      ctaIcon = Symbols.restore_rounded;
      onCta = () async {
        await buyStoreNote(context, ref, noteId: note.id, title: note.title);
      };
    } else {
      cta = note.isFree ? 'Get free' : 'Buy now · ${formatNotePrice(note.price)}';
      ctaIcon = Symbols.shopping_bag_rounded;
      onCta = () async {
        await buyStoreNote(context, ref, noteId: note.id, title: note.title);
      };
    }

    final meta = [note.category, note.subject]
        .where((e) => e != null && e.isNotEmpty)
        .join(' · ');

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: tokens.cardBg,
                  borderRadius: BorderRadius.circular(26),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: tokens.textMuted.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(Symbols.description_rounded,
                          fill: 1, size: 28, color: tokens.textSecondary),
                    ),
                    const SizedBox(height: 14),
                    if (meta.isNotEmpty)
                      Text(meta.toUpperCase(),
                          style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                              color: tokens.textSecondary)),
                    const SizedBox(height: 4),
                    Text(
                      note.title,
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.6,
                        height: 1.15,
                        color: tokens.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          formatNotePrice(note.price),
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            color: note.isFree
                                ? tokens.success
                                : tokens.textPrimary,
                          ),
                        ),
                        if ((note.originalPrice ?? 0) > note.price) ...[
                          const SizedBox(width: 8),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(
                              formatNotePrice(note.originalPrice!),
                              style: TextStyle(
                                decoration: TextDecoration.lineThrough,
                                color: tokens.textMuted,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ],
                        const Spacer(),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text('${note.validityDays} days access',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: tokens.textSecondary)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (note.state != NoteAccessState.none && note.expiresAt != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: (expired ? tokens.danger : tokens.success)
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        expired
                            ? Symbols.timer_off_rounded
                            : Symbols.check_circle_rounded,
                        fill: 1,
                        size: 22,
                        color: expired ? tokens.danger : tokens.success,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          expired
                              ? 'Expired on ${formatNoteDate(note.expiresAt!)}. Restore to read it again.'
                              : 'Active · expires on ${formatNoteDate(note.expiresAt!)}',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: expired ? tokens.danger : tokens.success,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if ((note.description ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 22),
                _Heading('About'),
                const SizedBox(height: 8),
                Text(
                  note.description!.trim(),
                  style: TextStyle(
                      fontSize: 14.5, height: 1.5, color: tokens.textSecondary),
                ),
              ],
              if (note.highlights.isNotEmpty) ...[
                const SizedBox(height: 22),
                _Heading("What's inside"),
                const SizedBox(height: 8),
                _Group(
                  children: [
                    for (final h in note.highlights)
                      _Line(
                        icon: Symbols.auto_awesome_rounded,
                        text: h,
                        color: tokens.textSecondary,
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 22),
              _Heading('Rules & validity'),
              const SizedBox(height: 8),
              _Group(
                children: [
                  for (final r in note.rules)
                    _Line(
                      icon: Symbols.check_circle_rounded,
                      text: r,
                      color: tokens.success,
                    ),
                ],
              ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
            decoration: BoxDecoration(
              color: tokens.bg,
              border: Border(
                top: BorderSide(color: tokens.border, width: 0.5),
              ),
            ),
            child: ApplePressable(
              onTap: () {
                HapticFeedback.lightImpact();
                onCta();
              },
              child: Container(
                height: 52,
                decoration: BoxDecoration(
                  color: ctaColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(ctaIcon, color: Colors.white, size: 22),
                    const SizedBox(width: 8),
                    Text(cta,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16.5,
                            fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 4),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3,
            color: context.tokens.textPrimary,
          ),
        ),
      );
}

class _Group extends StatelessWidget {
  const _Group({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0)
              Divider(
                  height: 0.5,
                  thickness: 0.5,
                  indent: 48,
                  color: tokens.border),
            children[i],
          ],
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.text, required this.color});
  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 13, 16, 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, fill: 1, size: 20, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                  fontSize: 14, height: 1.4, color: tokens.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}
