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
import '../../shared/widgets/shimmer_loading.dart';

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
        loading: () => const PageLoading(),
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
    final multi = note.files.length > 1;

    String cta;
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
      ctaIcon = Symbols.download_rounded;
      onCta = () => _download(context, ref);
    } else if (expired) {
      cta = note.price > 0
          ? 'Restore now · ${formatNotePrice(note.price)}'
          : 'Restore now';
      ctaIcon = Symbols.restore_rounded;
      onCta = () async {
        await buyStoreNote(
          context,
          ref,
          noteId: note.id,
          title: note.title,
          price: note.price,
        );
      };
    } else {
      cta = note.isFree ? 'Get free' : 'Buy now · ${formatNotePrice(note.price)}';
      ctaIcon = Symbols.shopping_bag_rounded;
      onCta = () async {
        await buyStoreNote(
          context,
          ref,
          noteId: note.id,
          title: note.title,
          price: note.price,
        );
      };
    }

    final colors = _detailColors(note.category);
    final accent = colors.last;
    final ctaColors = expired
        ? const [Color(0xFFFFB340), Color(0xFFFF9F0A)]
        : (active ? const [Color(0xFF3A9D6B), Color(0xFF237A52)] : colors);

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
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(30),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: colors,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.2),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  children: [
                    Positioned(
                      right: -18,
                      top: -10,
                      child: Icon(Symbols.description_rounded,
                          fill: 1,
                          size: 150,
                          color: Colors.white.withValues(alpha: 0.14)),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 54,
                          height: 54,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.24),
                            borderRadius: BorderRadius.circular(17),
                          ),
                          child: const Icon(Symbols.description_rounded,
                              fill: 1, size: 28, color: Colors.white),
                        ),
                        const SizedBox(height: 18),
                        if (meta.isNotEmpty)
                          Text(meta.toUpperCase(),
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.8,
                                  color: Colors.white.withValues(alpha: 0.85))),
                        const SizedBox(height: 4),
                        Text(
                          note.title,
                          style: const TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.9,
                            height: 1.1,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 18),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text(
                              formatNotePrice(note.price),
                              style: const TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.8,
                                color: Colors.white,
                              ),
                            ),
                            if ((note.originalPrice ?? 0) > note.price) ...[
                              const SizedBox(width: 8),
                              Text(
                                formatNotePrice(note.originalPrice!),
                                style: TextStyle(
                                  decoration: TextDecoration.lineThrough,
                                  decorationColor:
                                      Colors.white.withValues(alpha: 0.7),
                                  color: Colors.white.withValues(alpha: 0.7),
                                  fontSize: 15,
                                ),
                              ),
                            ],
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 7),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.22),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text('${note.validityDays} days access',
                                  style: const TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white)),
                            ),
                          ],
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
                        color: accent,
                      ),
                  ],
                ),
              ],
              if (active && multi) ...[
                const SizedBox(height: 22),
                _Heading('Files'),
                const SizedBox(height: 8),
                _Group(
                  children: [
                    for (final f in note.files)
                      _FileRow(note: note, file: f),
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
        if (!(active && multi))
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
            child: (active && localPath == null)
                // Bought but not on the device yet: Download and Open together.
                ? Row(
                    children: [
                      Expanded(
                        child: _CtaButton(
                          label: 'Download',
                          icon: Symbols.download_rounded,
                          colors: ctaColors,
                          filled: false,
                          onTap: () => _download(context, ref),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _CtaButton(
                          label: 'Open',
                          icon: Symbols.menu_book_rounded,
                          colors: ctaColors,
                          filled: true,
                          onTap: () async {
                            context.push(Uri(path: '/material', queryParameters: {
                              'contentId': note.id,
                              'title': note.title,
                              'contentType': 'STORE_NOTE',
                              'courseName': 'Premium Notes',
                            }).toString());
                          },
                        ),
                      ),
                    ],
                  )
                : _CtaButton(
                    label: cta,
                    icon: ctaIcon,
                    colors: ctaColors,
                    filled: true,
                    onTap: onCta,
                  ),
          ),
        ),
      ],
    );
  }
}

List<Color> _detailColors(String category) {
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


/// One file of a multi-file note: Download, then Open once it is on the device.
class _FileRow extends ConsumerWidget {
  const _FileRow({required this.note, required this.file});
  final StoreNote note;
  final StoreNoteFile file;

  String get _contentId => '${note.id}__${file.id}';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final localPath = ref.watch(downloadStatusProvider(_contentId)).value;
    final downloaded = localPath != null;

    return ApplePressable(
      onTap: () {
        HapticFeedback.lightImpact();
        if (downloaded) {
          final uri = Uri(path: '/material', queryParameters: {
            'contentId': _contentId,
            'title': file.title,
            'contentType': 'STORE_NOTE',
            'localPath': localPath,
            'courseName': 'Premium Notes',
          });
          context.push(uri.toString());
        } else {
          startDownloadFlow(
            context,
            ref,
            contentId: _contentId,
            contentType: 'STORE_NOTE',
            title: file.title,
            courseName: 'Premium Notes',
            version: note.expiresAt?.toUtc().toIso8601String(),
          );
        }
      },
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
        child: Row(
          children: [
            Icon(Symbols.description_rounded,
                fill: 1, size: 20, color: tokens.textSecondary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                file.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: tokens.textPrimary),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              downloaded ? 'Open' : 'Download',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: downloaded ? tokens.primaryAccent : tokens.success,
              ),
            ),
          ],
        ),
      ),
    );
  }
}


/// Bottom-bar action: gradient when [filled], soft tinted outline otherwise.
class _CtaButton extends StatelessWidget {
  const _CtaButton({
    required this.label,
    required this.icon,
    required this.colors,
    required this.filled,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final List<Color> colors;
  final bool filled;
  final Future<void> Function() onTap;

  @override
  Widget build(BuildContext context) {
    final fg = filled ? Colors.white : colors.last;
    return ApplePressable(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        height: 56,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          gradient: filled ? LinearGradient(colors: colors) : null,
          color: filled ? null : colors.last.withValues(alpha: 0.10),
          border: filled
              ? null
              : Border.all(color: colors.last.withValues(alpha: 0.35)),
          boxShadow: filled
              ? [
                  BoxShadow(
                    color: colors.last.withValues(alpha: 0.22),
                    blurRadius: 16,
                    offset: const Offset(0, 7),
                  ),
                ]
              : null,
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: fg, size: 22),
            const SizedBox(width: 8),
            Text(label,
                style: TextStyle(
                    color: fg, fontSize: 16.5, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
