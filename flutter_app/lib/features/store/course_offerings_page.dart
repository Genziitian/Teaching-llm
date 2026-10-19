import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_typography.dart';
import '../../shared/widgets/app_refresh.dart';

/// /api/course-offerings → list of buyable course offerings with prices.
/// Shape (per row, fields we use):
///   id, name, thumbnail, hasRecorded, recordedOriginalPrice,
///   recordedDiscountPrice, hasLive, liveOriginalPrice,
///   liveDiscountPrice, course: { id, name, subject, color, teacherName }.
final courseOfferingsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/course-offerings');
  final list = res.data is List ? res.data as List : const [];
  return [for (final j in list) j as Map<String, dynamic>];
});

class CourseOfferingsPage extends ConsumerStatefulWidget {
  const CourseOfferingsPage({super.key});
  @override
  ConsumerState<CourseOfferingsPage> createState() =>
      _CourseOfferingsPageState();
}

class _CourseOfferingsPageState extends ConsumerState<CourseOfferingsPage> {
  String _query = '';
  String _accessFilter = 'ALL'; // ALL | LIVE | RECORDED

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(courseOfferingsProvider);
    final all = async.value ?? const [];
    final q = _query.trim().toLowerCase();
    final filtered = all.where((o) {
      final course = (o['course'] as Map?) ?? const {};
      final name =
          ((o['name'] as String?) ?? (course['name'] as String?) ?? '')
              .toLowerCase();
      final subject = ((course['subject'] as String?) ?? '').toLowerCase();
      final teacher =
          ((course['teacherName'] as String?) ?? '').toLowerCase();
      final matchesQ = q.isEmpty ||
          name.contains(q) ||
          subject.contains(q) ||
          teacher.contains(q);
      final hasRec = (o['hasRecorded'] as bool?) ?? false;
      final hasLive = (o['hasLive'] as bool?) ?? false;
      final matchesAccess = _accessFilter == 'ALL' ||
          (_accessFilter == 'LIVE' && hasLive) ||
          (_accessFilter == 'RECORDED' && hasRec);
      return matchesQ && matchesAccess;
    }).toList();

    return AppPageScaffold(
      title: 'Courses',
      subtitle: async.isLoading ? 'Loading…' : '${all.length} available',
      showBack: true,
      body: AppRefresh(
        onRefresh: () async => ref.invalidate(courseOfferingsProvider),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(0, 16, 0, 24),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _SearchField(
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _AccessChips(
                selected: _accessFilter,
                onTap: (v) => setState(() => _accessFilter = v),
              ),
            ),
            const SizedBox(height: 16),
            if (async.isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (async.hasError)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text('Could not load courses: ${async.error}',
                    style: AppTypography.bodyMuted,
                    textAlign: TextAlign.center),
              )
            else if (filtered.isEmpty)
              _Empty(hasQuery: q.isNotEmpty)
            else
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    for (final o in filtered) ...[
                      _OfferingCard(offering: o),
                      const SizedBox(height: 12),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.onChanged});
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          const Icon(Icons.search, size: 16, color: AppColors.muted),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search by course, subject or mentor',
                border: InputBorder.none,
                hintStyle: AppTypography.body
                    .copyWith(color: AppColors.muted, fontSize: 13.5),
              ),
              style: AppTypography.body.copyWith(fontSize: 13.5),
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class _AccessChips extends StatelessWidget {
  const _AccessChips({required this.selected, required this.onTap});
  final String selected;
  final ValueChanged<String> onTap;
  static const _items = [
    ('All', 'ALL'),
    ('Live batch', 'LIVE'),
    ('Recorded', 'RECORDED'),
  ];
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 32,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (label, value) = _items[i];
          final active = value == selected;
          return InkWell(
            onTap: () => onTap(value),
            borderRadius: BorderRadius.circular(999),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                color: active ? AppColors.ink : AppColors.surface,
                borderRadius: BorderRadius.circular(999),
                border:
                    Border.all(color: active ? AppColors.ink : AppColors.line),
              ),
              alignment: Alignment.center,
              child: Text(label,
                  style: AppTypography.caption.copyWith(
                    fontSize: 12.5,
                    color: active
                        ? AppColors.textInverse
                        : AppColors.ink2,
                    fontWeight: FontWeight.w600,
                  )),
            ),
          );
        },
      ),
    );
  }
}

class _OfferingCard extends StatelessWidget {
  const _OfferingCard({required this.offering});
  final Map<String, dynamic> offering;

  Color get _accent {
    final course = (offering['course'] as Map?) ?? const {};
    final hex = (course['color'] as String?) ?? '#4F46E5';
    final v = int.tryParse(hex.replaceAll('#', ''), radix: 16) ?? 0x4F46E5;
    return Color(0xFF000000 | v);
  }

  @override
  Widget build(BuildContext context) {
    final course = (offering['course'] as Map?) ?? const {};
    final id = offering['id'] as String?;
    final name = (offering['name'] as String?) ??
        (course['name'] as String?) ??
        'Course';
    final teacher = course['teacherName'] as String?;
    final subject = course['subject'] as String?;
    final hasLive = (offering['hasLive'] as bool?) ?? false;
    final hasRec = (offering['hasRecorded'] as bool?) ?? false;
    final liveDiscount = (offering['liveDiscountPrice'] as num?)?.toInt();
    final liveOrig = (offering['liveOriginalPrice'] as num?)?.toInt();
    final recDiscount = (offering['recordedDiscountPrice'] as num?)?.toInt();
    final recOrig = (offering['recordedOriginalPrice'] as num?)?.toInt();
    final price = liveDiscount ?? recDiscount;
    final original = liveOrig ?? recOrig;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: id == null ? null : () => context.push('/store/courses/$id'),
        borderRadius: BorderRadius.circular(18),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.line),
            boxShadow: AppShadows.sm,
          ),
          clipBehavior: Clip.hardEdge,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                height: 88,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [_accent, _accent.withOpacity(0.72)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      children: [
                        if (hasLive)
                          const _Pill(
                              label: 'LIVE BATCH',
                              color: AppColors.textInverse,
                              bg: Color(0x33FFFFFF)),
                        if (hasRec)
                          const _Pill(
                              label: 'RECORDED',
                              color: AppColors.textInverse,
                              bg: Color(0x33FFFFFF)),
                      ],
                    ),
                    const Spacer(),
                    if (subject != null)
                      _Pill(
                          label: subject,
                          color: AppColors.textInverse,
                          bg: const Color(0x2EFFFFFF)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.title.copyWith(
                          fontSize: 15,
                          letterSpacing: -0.2,
                        )),
                    if (teacher != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: _accent.withOpacity(0.12),
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(teacher[0].toUpperCase(),
                                style: AppTypography.caption.copyWith(
                                  color: _accent,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                )),
                          ),
                          const SizedBox(width: 8),
                          Text(teacher,
                              style: AppTypography.bodyMuted
                                  .copyWith(fontSize: 11.5)),
                        ],
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        if (price != null) ...[
                          Text('₹$price',
                              style: AppTypography.title.copyWith(
                                fontSize: 18,
                                color: AppColors.ink,
                              )),
                          if (original != null && original > price) ...[
                            const SizedBox(width: 8),
                            Text('₹$original',
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.muted,
                                  fontSize: 12,
                                  decoration: TextDecoration.lineThrough,
                                )),
                          ],
                        ] else
                          Text('Pricing on detail page',
                              style: AppTypography.bodyMuted
                                  .copyWith(fontSize: 11.5)),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: AppColors.ink,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('View',
                                  style: AppTypography.caption.copyWith(
                                    color: AppColors.textInverse,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12,
                                  )),
                              const SizedBox(width: 4),
                              const Icon(Icons.arrow_forward,
                                  color: AppColors.textInverse, size: 12),
                            ],
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
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(
      {required this.label, required this.color, required this.bg});
  final String label;
  final Color color;
  final Color bg;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label.toUpperCase(),
          style: AppTypography.uppercase.copyWith(
            color: color,
            fontSize: 10,
            letterSpacing: 0.6,
          )),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.hasQuery});
  final bool hasQuery;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
      child: Column(
        children: [
          const Icon(Icons.search_off,
              color: AppColors.mute2, size: 40),
          const SizedBox(height: 8),
          Text(hasQuery ? 'No matches' : 'No courses available',
              style: AppTypography.title, textAlign: TextAlign.center),
          const SizedBox(height: 4),
          Text(
              hasQuery
                  ? 'Try a different search or clear the filter.'
                  : 'Check back later — new offerings are added each term.',
              style: AppTypography.bodyMuted,
              textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
