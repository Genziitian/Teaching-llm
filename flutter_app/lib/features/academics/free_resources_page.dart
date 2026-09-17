import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_shadows.dart';
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

    final coursesCount = coursesAsync.valueOrNull?.length ?? 0;
    final materialsCount = materialsAsync.valueOrNull?.length ?? 0;
    final purchasedCount = purchasedAsync.valueOrNull?.length ?? 0;

    final anyLoading = coursesAsync.isLoading ||
        materialsAsync.isLoading ||
        purchasedAsync.isLoading;

    return AppPageScaffold(
      title: 'Free Resources',
      subtitle: 'Access free courses and study materials',
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
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _BigCard(
                    icon: Icons.menu_book_outlined,
                    iconBg: [tokens.primaryAccent, const Color(0xFF7C3AED)],
                    title: 'Free Courses',
                    desc:
                        'Browse and self-enroll in free courses with full content access.',
                    pillLabel: coursesCount == 0
                        ? '0 COURSES AVAILABLE'
                        : '$coursesCount ${coursesCount == 1 ? 'COURSE' : 'COURSES'} AVAILABLE',
                    pillColor: tokens.primaryAccent,
                    pillBg: tokens.primaryAccent.withOpacity(0.12),
                    exploreColor: tokens.primaryAccent,
                    loading: coursesAsync.isLoading,
                    error: coursesAsync.hasError,
                    onTap: () => context.go('/free-resources/courses'),
                  ),
                  const SizedBox(height: 16),
                  _BigCard(
                    icon: Icons.folder_open_outlined,
                    iconBg: [
                      tokens.success,
                      const Color(0xFF14B8A6),
                    ],
                    title: 'Free Materials',
                    desc:
                        'Search and download notes, summaries, and formula sheets.',
                    pillLabel: materialsCount == 0
                        ? '0 MATERIALS'
                        : '$materialsCount ${materialsCount == 1 ? 'MATERIAL' : 'MATERIALS'}',
                    pillColor: tokens.success,
                    pillBg: tokens.success.withOpacity(0.12),
                    exploreColor: tokens.success,
                    loading: materialsAsync.isLoading,
                    error: materialsAsync.hasError,
                    onTap: () => context.push('/free-resources/materials'),
                  ),
                  const SizedBox(height: 16),
                  _BigCard(
                    icon: Icons.lock_open_outlined,
                    iconBg: [
                      tokens.warning,
                      const Color(0xFFF97316),
                    ],
                    title: 'Purchased Materials',
                    desc:
                        'Access study materials and mock papers unlocked through your courses.',
                    pillLabel: purchasedCount == 0
                        ? '0 PURCHASED'
                        : '$purchasedCount ${purchasedCount == 1 ? 'ITEM' : 'ITEMS'} UNLOCKED',
                    pillColor: tokens.warning,
                    pillBg: tokens.warning.withOpacity(0.12),
                    exploreColor: tokens.warning,
                    loading: purchasedAsync.isLoading,
                    error: purchasedAsync.hasError,
                    onTap: () => context.push('/free-resources/purchased'),
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
    required this.pillLabel,
    required this.pillColor,
    required this.pillBg,
    required this.exploreColor,
    required this.loading,
    required this.error,
    required this.onTap,
  });
  final IconData icon;
  final List<Color> iconBg;
  final String title;
  final String desc;
  final String pillLabel;
  final Color pillColor;
  final Color pillBg;
  final Color exploreColor;
  final bool loading;
  final bool error;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Material(
      color: tokens.cardBg,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: tokens.border),
            boxShadow: AppShadows.md,
          ),
          child: Column(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: iconBg,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: AppShadows.pillGlow(iconBg.first),
                ),
                child: const Icon(Icons.school, color: Colors.white, size: 32),
              ),
              const SizedBox(height: 14),
              Text(
                title,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: tokens.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                desc,
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.45,
                  fontWeight: FontWeight.w500,
                  color: tokens.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
              if (loading)
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: tokens.primaryAccent,
                  ),
                )
              else if (error)
                Text(
                  'Could not load',
                  style: TextStyle(
                    color: tokens.danger,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                )
              else
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: pillBg,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    pillLabel,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: pillColor,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Explore Now',
                    style: TextStyle(
                      color: exploreColor,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(Icons.arrow_forward, color: exploreColor, size: 14),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// _QuickStats / _Mini / _Divider removed — the QUICK STATS card duplicated
// the counts already shown on the three big status cards above it.
