import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_theme_tokens.dart';

/// /api/free-resources/courses → list of free courses (with enrollment).
final freeCoursesProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/free-resources/courses');
  return res.data is List ? res.data as List : const [];
});

/// /api/free-resources/materials → list of free materials.
final freeMaterialsProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/free-resources/materials');
  return res.data is List ? res.data as List : const [];
});

/// /api/free-resources/purchased → list of purchased note packs.
final purchasedMaterialsProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/free-resources/purchased');
  final data = res.data;
  // The server answers { materials: [...] }; older builds sent a bare list.
  if (data is Map && data['materials'] is List) return data['materials'] as List;
  return data is List ? data : const [];
});

/// Free Resources sub-page — three big status cards backed by real counts
/// from /api/free-resources/{courses,materials,purchased}.
class FreeResourcesPage extends ConsumerWidget {
  const FreeResourcesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final coursesAsync = ref.watch(freeCoursesProvider);
    final materialsAsync = ref.watch(freeMaterialsProvider);
    final purchasedAsync = ref.watch(purchasedMaterialsProvider);

    final anyLoading = coursesAsync.isLoading ||
        materialsAsync.isLoading ||
        purchasedAsync.isLoading;

    return AppPageScaffold(
      title: 'Free Resources',
      showBack: true,
      onBack: () {
        if (Navigator.of(context).canPop()) {
          Navigator.of(context).pop();
        } else if (context.canPop()) {
          context.pop();
        } else {
          context.go('/dashboard');
        }
      },
      right: anyLoading
          ? SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: tokens.primaryAccent,
              ),
            )
          : null,
      body: AppRefresh(
        onRefresh: () async {
          ref.invalidate(freeCoursesProvider);
          ref.invalidate(freeMaterialsProvider);
          ref.invalidate(purchasedMaterialsProvider);
        },
        child: _FreeBody(
          courses: coursesAsync.value ?? const [],
          materials: materialsAsync.value ?? const [],
          coursesError: coursesAsync.hasError,
          materialsError: materialsAsync.hasError,
        ),
      ),
    );
  }
}

/// Search + banners + "Recently added", top-aligned so the page never looks empty.
class _FreeBody extends StatefulWidget {
  const _FreeBody({
    required this.courses,
    required this.materials,
    required this.coursesError,
    required this.materialsError,
  });
  final List<dynamic> courses;
  final List<dynamic> materials;
  final bool coursesError;
  final bool materialsError;

  @override
  State<_FreeBody> createState() => _FreeBodyState();
}

class _FreeBodyState extends State<_FreeBody> {
  final TextEditingController _q = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  String _nameOf(dynamic m, {required bool course}) {
    if (m is! Map) return '';
    final v = course ? (m['name'] ?? m['title']) : (m['title'] ?? m['name']);
    return (v ?? '').toString().trim();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final q = _query.trim().toLowerCase();

    // (title, subtitle, isCourse)
    final all = <({String title, String sub, bool course})>[
      for (final c in widget.courses)
        if (_nameOf(c, course: true).isNotEmpty)
          (title: _nameOf(c, course: true), sub: 'Free course', course: true),
      for (final m in widget.materials)
        if (_nameOf(m, course: false).isNotEmpty)
          (
            title: _nameOf(m, course: false),
            sub: m is Map && (m['subject'] ?? '').toString().isNotEmpty
                ? 'Free material · ${m['subject']}'
                : 'Free material',
            course: false
          ),
    ];
    final List<({String title, String sub, bool course})> rows;
    if (q.isEmpty) {
      final cs = all.where((e) => e.course).take(3);
      final ms = all.where((e) => !e.course).take(3);
      rows = [...cs, ...ms];
    } else {
      rows = all.where((e) => e.title.toLowerCase().contains(q)).take(40).toList();
    }

    Widget header(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(4, 22, 4, 10),
          child: Text(t,
              style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: tokens.textPrimary)),
        );

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(0, 12, 0, 28),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _q,
                  onChanged: (v) => setState(() => _query = v),
                  textInputAction: TextInputAction.search,
                  style: TextStyle(fontSize: 16, color: tokens.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Search free courses and materials',
                    hintStyle: TextStyle(fontSize: 15, color: tokens.textMuted),
                    prefixIcon: Icon(Symbols.search_rounded,
                        size: 22, color: tokens.textMuted),
                    suffixIcon: q.isEmpty
                        ? null
                        : IconButton(
                            icon: Icon(Symbols.close_rounded,
                                size: 20, color: tokens.textMuted),
                            onPressed: () {
                              _q.clear();
                              setState(() => _query = '');
                            },
                          ),
                    isDense: true,
                    filled: true,
                    fillColor: tokens.cardBg,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide(color: tokens.border, width: 0.6)),
                    enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide(color: tokens.border, width: 0.6)),
                    focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide(color: tokens.textPrimary, width: 1.2)),
                  ),
                ),
                if (q.isEmpty) ...[
                  const SizedBox(height: 16),
                  _BannerCard(
                    asset: 'assets/store/free-courses-banner.webp',
                    label: 'Free Courses. Browse and enroll for free.',
                    error: widget.coursesError,
                    onTap: () => context.go('/free-resources/courses'),
                  ),
                  const SizedBox(height: 14),
                  _BannerCard(
                    asset: 'assets/store/free-materials-banner.webp',
                    label: 'Free Materials. Notes, summaries and formula sheets.',
                    error: widget.materialsError,
                    onTap: () => context.push('/free-resources/materials'),
                  ),
                ],
                if (rows.isNotEmpty) header(q.isEmpty ? 'Recently added' : 'Results'),
                if (rows.isEmpty && q.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: Text('Nothing found for "$_query"',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 15, color: tokens.textMuted)),
                  ),
                for (final r in rows)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: ApplePressable(
                      onTap: () => r.course
                          ? context.go('/free-resources/courses')
                          : context.push('/free-resources/materials'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: tokens.cardBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: tokens.border, width: 0.5),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: (r.course
                                        ? const Color(0xFF6366F1)
                                        : const Color(0xFFFFB800))
                                    .withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(
                                  r.course
                                      ? Symbols.school_rounded
                                      : Symbols.description_rounded,
                                  size: 22,
                                  color: r.course
                                      ? const Color(0xFF6366F1)
                                      : const Color(0xFFE0A100)),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(r.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w700,
                                          color: tokens.textPrimary)),
                                  const SizedBox(height: 2),
                                  Text(r.sub,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          fontSize: 12.5,
                                          color: tokens.textMuted)),
                                ],
                              ),
                            ),
                            Icon(Symbols.chevron_right_rounded,
                                size: 22, color: tokens.textMuted),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Full-width illustrated banner (3:1, ~30 KB WebP). Tapping opens the section.
class _BannerCard extends StatelessWidget {
  const _BannerCard({
    required this.asset,
    required this.label,
    required this.error,
    required this.onTap,
  });
  final String asset;
  final String label;
  final bool error;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ApplePressable(
      onTap: onTap,
      child: Semantics(
        button: true,
        label: label,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(color: Color(0x14000000), blurRadius: 18, offset: Offset(0, 6)),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Stack(
              children: [
                AspectRatio(
                  aspectRatio: 3,
                  child: Image.asset(
                    asset,
                    fit: BoxFit.cover,
                    cacheWidth: 1080,
                    filterQuality: FilterQuality.medium,
                    gaplessPlayback: true,
                    excludeFromSemantics: true,
                  ),
                ),
                if (error)
                  Positioned(
                    left: 12,
                    bottom: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: tokens.danger,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text('Could not load',
                          style: TextStyle(
                              color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BigCard extends StatelessWidget {
  const _BigCard({
    required this.icon,
    required this.iconBg,
    required this.title,
    required this.desc,
    required this.loading,
    required this.error,
    required this.onTap,
  });
  final IconData icon;
  final List<Color> iconBg;
  final String title;
  final String desc;
  final bool loading;
  final bool error;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    Widget trailing;
    if (loading) {
      trailing = SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: tokens.textMuted,
        ),
      );
    } else {
      trailing = Icon(Symbols.arrow_forward_ios_rounded,
          color: tokens.textMuted, size: 14, weight: 700);
    }

    return ApplePressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 16, 18, 16),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: iconBg,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon,
                  color: Colors.white, size: 30, fill: 1, weight: 500),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.4,
                      color: tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    error ? 'Could not load' : desc,
                    style: TextStyle(
                      fontSize: 14.5,
                      height: 1.35,
                      color: error ? tokens.danger : tokens.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            trailing,
          ],
        ),
      ),
    );
  }
}

// _QuickStats / _Mini / _Divider removed — the QUICK STATS card duplicated
// the counts already shown on the three big status cards above it.
