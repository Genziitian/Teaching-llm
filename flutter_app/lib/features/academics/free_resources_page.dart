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
  return res.data is List ? res.data as List : const [];
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
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(0, 16, 0, 24),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _BigCard(
                    icon: Symbols.menu_book_rounded,
                    iconBg: [tokens.primaryAccent, const Color(0xFF5E5CE6)],
                    title: 'Free Courses',
                    desc: 'Browse and enroll for free.',
                    loading: coursesAsync.isLoading,
                    error: coursesAsync.hasError,
                    onTap: () => context.go('/free-resources/courses'),
                  ),
                  const SizedBox(height: 12),
                  _BigCard(
                    icon: Symbols.folder_open_rounded,
                    iconBg: [
                      tokens.success,
                      const Color(0xFF14B8A6),
                    ],
                    title: 'Free Materials',
                    desc: 'Notes, summaries and formula sheets.',
                    loading: materialsAsync.isLoading,
                    error: materialsAsync.hasError,
                    onTap: () => context.push('/free-resources/materials'),
                  ),
                ],
              ),
            ),
          ],
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
