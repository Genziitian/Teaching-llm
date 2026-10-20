import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/share_link_sheet.dart';
import '../downloads/download_button.dart' show startDownloadFlow;
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/shimmer_loading.dart';

enum _Category { assignment, pyq, note }

extension on _Category {
  String get apiValue {
    switch (this) {
      case _Category.assignment:
        return 'ASSIGNMENT';
      case _Category.pyq:
        return 'PYQ';
      case _Category.note:
        return 'NOTE';
    }
  }

  String get label {
    switch (this) {
      case _Category.assignment:
        return 'Assignments';
      case _Category.pyq:
        return 'PYQs';
      case _Category.note:
        return 'Notes';
    }
  }

  IconData get icon {
    switch (this) {
      case _Category.assignment:
        return Symbols.edit_note_rounded;
      case _Category.pyq:
        return Symbols.history_edu_rounded;
      case _Category.note:
        return Symbols.menu_book_rounded;
    }
  }
}

/// /api/free-resources/materials/options → { levels, subjects, bySubject }
final _optionsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res =
      await api.get<dynamic>('/api/free-resources/materials/options');
  return (res.data is Map) ? Map<String, dynamic>.from(res.data as Map) : {};
});

/// Family on (level?, subject?, category) → list of matching materials.
final _materialsProvider = FutureProvider.family<
    List<Map<String, dynamic>>, _MaterialQuery>((ref, q) async {
  final api = ref.watch(apiClientProvider);
  final params = <String, String>{};
  if (q.level != null) params['level'] = q.level!;
  if (q.subject != null) params['subject'] = q.subject!;
  params['category'] = q.category.apiValue;
  final res =
      await api.get<dynamic>('/api/free-resources/materials', query: params);
  final list = res.data is List ? res.data as List : const [];
  return [for (final j in list) Map<String, dynamic>.from(j as Map)];
});

class _MaterialQuery {
  const _MaterialQuery({this.level, this.subject, required this.category});
  final String? level;
  final String? subject;
  final _Category category;

  @override
  bool operator ==(Object other) =>
      other is _MaterialQuery &&
      other.level == level &&
      other.subject == subject &&
      other.category == category;

  @override
  int get hashCode => Object.hash(level, subject, category);
}

class FreeMaterialsBrowsePage extends ConsumerStatefulWidget {
  const FreeMaterialsBrowsePage({super.key});
  @override
  ConsumerState<FreeMaterialsBrowsePage> createState() =>
      _FreeMaterialsBrowsePageState();
}

class _FreeMaterialsBrowsePageState
    extends ConsumerState<FreeMaterialsBrowsePage> {
  String? _level;
  String? _subject;
  int _tab = 0;

  _Category get _activeCategory => _Category.values[_tab];

  @override
  Widget build(BuildContext context) {
    final optionsAsync = ref.watch(_optionsProvider);

    return AppPageScaffold(
      title: 'Free Materials',
      subtitle: 'Notes · PYQs · Assignments',
      showBack: true,
      body: Column(
        children: [
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _LevelSubjectPicker(
              options: optionsAsync.value ?? const {},
              level: _level,
              subject: _subject,
              onLevel: (l) => setState(() {
                _level = l;
                _subject = null;
              }),
              onSubject: (s) => setState(() => _subject = s),
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _TabBar(
              index: _tab,
              onChanged: (i) => setState(() => _tab = i),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _MaterialList(
              query: _MaterialQuery(
                level: _level,
                subject: _subject,
                category: _activeCategory,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LevelSubjectPicker extends StatelessWidget {
  const _LevelSubjectPicker({
    required this.options,
    required this.level,
    required this.subject,
    required this.onLevel,
    required this.onSubject,
  });
  final Map<String, dynamic> options;
  final String? level;
  final String? subject;
  final ValueChanged<String?> onLevel;
  final ValueChanged<String?> onSubject;

  @override
  Widget build(BuildContext context) {
    final levels = (options['levels'] as List?)?.cast<String>() ?? const [];
    final bySubject = options['bySubject'] is Map
        ? Map<String, dynamic>.from(options['bySubject'] as Map)
        : <String, dynamic>{};
    final allSubjects =
        (options['subjects'] as List?)?.cast<String>() ?? const [];

    final subjectsForLevel = level != null && bySubject[level] is List
        ? List<String>.from(bySubject[level] as List)
        : allSubjects;

    return Row(
      children: [
        Expanded(
          child: _DropdownTile(
            label: 'Level',
            icon: Symbols.bar_chart_rounded,
            value: level,
            options: levels,
            onChanged: onLevel,
            emptyHint: 'Any level',
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _DropdownTile(
            label: 'Subject',
            icon: Symbols.menu_book_rounded,
            value: subject,
            options: subjectsForLevel,
            onChanged: onSubject,
            emptyHint: 'Any subject',
          ),
        ),
      ],
    );
  }
}

const _anyValue = '__any__';

Future<void> _pickOption(
  BuildContext context, {
  required String title,
  required List<String> options,
  required String? current,
  required String anyLabel,
  required ValueChanged<String?> onChanged,
}) async {
  final tokens = context.tokens;
  final picked = await showModalBottomSheet<String>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      final maxH = MediaQuery.of(ctx).size.height * 0.7;
      Widget row(String label, String value, bool selected, bool last) {
        return ApplePressable(
          onTap: () => Navigator.of(ctx).pop(value),
          pressedScale: 0.99,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            color: Colors.transparent,
            child: Container(
              height: 52,
              decoration: BoxDecoration(
                border: last
                    ? null
                    : Border(
                        bottom:
                            BorderSide(color: tokens.border, width: 0.5)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight:
                            selected ? FontWeight.w600 : FontWeight.w400,
                        color: tokens.textPrimary,
                      ),
                    ),
                  ),
                  if (selected)
                    Icon(Symbols.check_rounded,
                        weight: 700, size: 22, color: tokens.primaryAccent),
                ],
              ),
            ),
          ),
        );
      }

      return Container(
        constraints: BoxConstraints(maxHeight: maxH),
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).padding.bottom),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 36,
              height: 5,
              decoration: BoxDecoration(
                color: tokens.textMuted.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.5,
                    color: tokens.textPrimary,
                  ),
                ),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                children: [
                  row(anyLabel, _anyValue, current == null, options.isEmpty),
                  for (var i = 0; i < options.length; i++)
                    row(options[i], options[i], current == options[i],
                        i == options.length - 1),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      );
    },
  );
  if (picked == null) return;
  onChanged(picked == _anyValue ? null : picked);
}

class _DropdownTile extends StatelessWidget {
  const _DropdownTile({
    required this.label,
    required this.icon,
    required this.value,
    required this.options,
    required this.onChanged,
    required this.emptyHint,
  });
  final String label;
  final IconData icon;
  final String? value;
  final List<String> options;
  final ValueChanged<String?> onChanged;
  final String emptyHint;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return ApplePressable(
      onTap: () => _pickOption(
        context,
        title: label,
        options: options,
        current: value,
        anyLabel: emptyHint,
        onChanged: onChanged,
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: tokens.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    value ?? emptyHint,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                      color: value == null
                          ? tokens.textMuted
                          : tokens.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Symbols.unfold_more_rounded,
                size: 20, weight: 500, color: tokens.textMuted),
          ],
        ),
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({required this.index, required this.onChanged});
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final reduce = MediaQuery.of(context).disableAnimations;
    final track =
        tokens.isDark ? const Color(0xFF1C1C1E) : const Color(0xFFE3E3E8);
    final thumb = tokens.isDark ? const Color(0xFF636366) : Colors.white;
    const cats = _Category.values;

    return Container(
      height: 40,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: track,
        borderRadius: BorderRadius.circular(12),
      ),
      child: LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth / cats.length;
        return Stack(
          children: [
            AnimatedPositioned(
              duration:
                  reduce ? Duration.zero : const Duration(milliseconds: 260),
              curve: kEaseOutStrong,
              left: w * index,
              width: w,
              top: 0,
              bottom: 0,
              child: Container(
                decoration: BoxDecoration(
                  color: thumb,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: tokens.isDark
                      ? null
                      : const [
                          BoxShadow(
                            color: Color(0x1F000000),
                            blurRadius: 4,
                            offset: Offset(0, 1.5),
                          ),
                        ],
                ),
              ),
            ),
            Row(
              children: [
                for (var i = 0; i < cats.length; i++)
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTapDown: (_) {
                        if (i != index) onChanged(i);
                      },
                      child: Center(
                        child: Text(
                          cats[i].label,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: i == index
                                ? FontWeight.w600
                                : FontWeight.w500,
                            color: i == index
                                ? tokens.textPrimary
                                : tokens.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        );
      }),
    );
  }
}

class _MaterialList extends ConsumerWidget {
  const _MaterialList({required this.query});
  final _MaterialQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_materialsProvider(query));
    final tokens = context.tokens;

    return AppRefresh(
      onRefresh: () async => ref.invalidate(_materialsProvider(query)),
      child: async.when(
        loading: () => const PageLoading(),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              "Couldn't load materials\n$e",
              textAlign: TextAlign.center,
              style: TextStyle(color: tokens.textSecondary),
            ),
          ),
        ),
        data: (list) {
          if (list.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(query.category.icon,
                      color: tokens.textMuted, size: 44),
                  const SizedBox(height: 10),
                  Text(
                    'No ${query.category.label.toLowerCase()} yet',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.4,
                      color: tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    query.level == null && query.subject == null
                        ? 'Check back soon — the team uploads new resources regularly.'
                        : 'Try a different level or subject above.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      color: tokens.textSecondary,
                    ),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            itemCount: list.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) => _MaterialRow(material: list[i]),
          );
        },
      ),
    );
  }
}

class _MaterialRow extends ConsumerWidget {
  const _MaterialRow({required this.material});
  final Map<String, dynamic> material;

  Future<void> _open(BuildContext context) async {
    final id = material['id'] as String?;
    final title = (material['title'] as String?) ?? 'Material';
    final url = material['fileUrl'] as String?;
    final fileType = (material['fileType'] as String?)?.toLowerCase() ?? '';
    final isPdf = fileType.isEmpty ||
        fileType.contains('pdf') ||
        (url != null && url.contains('.pdf'));

    if (isPdf && id != null && id.isNotEmpty) {
      final uri = Uri(
        path: '/material',
        queryParameters: {
          'contentId': id,
          'title': title,
          'contentType': 'MATERIAL',
          'courseName': (material['subject'] as String?) ?? 'Free Resources',
        },
      );
      context.push(uri.toString());
      return;
    }

    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Couldn't open this file.")),
      );
    }
  }

  Future<void> _showMenu(BuildContext context, WidgetRef ref) async {
    final tokens = context.tokens;
    final id = material['id'] as String?;
    final title = (material['title'] as String?) ?? 'Material';
    HapticFeedback.selectionClick();

    final action = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        Widget row(String label, IconData icon, String value, bool last) {
          return ApplePressable(
            onTap: () => Navigator.of(ctx).pop(value),
            pressedScale: 0.99,
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              decoration: BoxDecoration(
                border: last
                    ? null
                    : Border(
                        bottom: BorderSide(color: tokens.border, width: 0.5)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 17,
                        color: tokens.textPrimary,
                      ),
                    ),
                  ),
                  Icon(icon, size: 22, color: tokens.textSecondary),
                ],
              ),
            ),
          );
        }

        return Container(
          padding: EdgeInsets.fromLTRB(
              16, 10, 16, 16 + MediaQuery.of(ctx).padding.bottom),
          decoration: BoxDecoration(
            color: tokens.cardBg,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(28)),
          ),
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
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 17,
                    height: 1.25,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.3,
                    color: tokens.textPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Container(
                decoration: BoxDecoration(
                  color: tokens.isDark
                      ? const Color(0xFF2C2C2E)
                      : const Color(0xFFF2F2F7),
                  borderRadius: BorderRadius.circular(18),
                ),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    row('Open', Symbols.open_in_new_rounded, 'open', false),
                    if (id != null && id.isNotEmpty) ...[
                      row('Share', Symbols.ios_share_rounded, 'share', false),
                      row('Download', Symbols.download_rounded, 'download',
                          true),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );

    if (action == null || !context.mounted) return;
    switch (action) {
      case 'open':
        await _open(context);
        break;
      case 'share':
        if (id == null) return;
        await showShareLinkSheet(
          context,
          title: title,
          message: 'Check out this free material on GenZ IITIAN: $title',
          link: 'https://class.genziitian.in/free-resources/materials/$id/view',
        );
        break;
      case 'download':
        if (id == null) return;
        await startDownloadFlow(
          context,
          ref,
          contentId: id,
          contentType: 'MATERIAL',
          title: title,
          courseName: (material['subject'] as String?) ?? 'Free Resources',
        );
        break;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final title = (material['title'] as String?) ?? 'Untitled';
    final term = (material['term'] as String?)?.trim();
    final subject = (material['subject'] as String?)?.trim();
    final level = (material['level'] as String?)?.trim();
    final fileType = (material['fileType'] as String?)?.trim();
    final isPdf = fileType == null || fileType.toLowerCase().contains('pdf');

    final meta = [
      if (subject != null && subject.isNotEmpty) subject,
      if (level != null && level.isNotEmpty) level,
      if (term != null && term.isNotEmpty) term,
    ].join(' · ');

    return ApplePressable(
      onTap: () => _open(context),
      pressedScale: 0.98,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: isPdf
                    ? tokens.danger.withValues(alpha: 0.12)
                    : tokens.textMuted.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                isPdf
                    ? Symbols.picture_as_pdf_rounded
                    : Symbols.description_rounded,
                fill: 1,
                color: isPdf ? tokens.danger : tokens.textSecondary,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 16,
                      height: 1.25,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.3,
                      color: tokens.textPrimary,
                    ),
                  ),
                  if (meta.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      meta,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13.5,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 4),
            ApplePressable(
              onTap: () => _showMenu(context, ref),
              pressedScale: 0.9,
              child: SizedBox(
                width: 40,
                height: 40,
                child: Icon(Symbols.more_horiz_rounded,
                    weight: 600, size: 24, color: tokens.textSecondary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
