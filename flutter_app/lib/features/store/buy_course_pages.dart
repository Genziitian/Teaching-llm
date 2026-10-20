import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/payments/play_billing_service.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../courses/courses_page.dart' show coursesProvider;
import 'course_offerings_page.dart' show courseOfferingsProvider;
import 'purchase_success_dialog.dart';

/// /api/bundle-offerings: same data the website store shows.
final bundleOfferingsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/bundle-offerings');
  final data = res.data;
  final list = data is List ? data : const [];
  return [
    for (final j in list)
      if (j is Map) Map<String, dynamic>.from(j),
  ];
});

double? _num(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

String _money(double v) =>
    '₹${v == v.roundToDouble() ? v.toInt() : v.toStringAsFixed(2)}';

String _levelOf(Map<String, dynamic> m) {
  final c = (m['category'] as String?)?.trim();
  return (c == null || c.isEmpty) ? 'General' : c;
}

List<String> _lines(dynamic v) => ((v as String?) ?? '')
    .split('\n')
    .map((s) => s.trim())
    .where((s) => s.isNotEmpty)
    .toList();

Map<String, dynamic> _priceJson(Map<String, dynamic> b) {
  try {
    final raw = b['coursePrices'];
    if (raw is String && raw.isNotEmpty) {
      final d = jsonDecode(raw);
      if (d is Map) return Map<String, dynamic>.from(d);
    }
  } catch (_) {}
  return const {};
}

double? _bundleTypePrice(Map<String, dynamic> b, String type) {
  switch (type) {
    case 'RECORDED':
      return _num(b['recordedDiscountPrice']) ?? _num(b['recordedOriginalPrice']);
    case 'CHAMPION':
      return _num(b['championDiscountPrice']) ??
          _num(b['championOriginalPrice']) ??
          _num(b['liveDiscountPrice']) ??
          _num(b['liveOriginalPrice']);
    default:
      return _num(b['liveDiscountPrice']) ?? _num(b['liveOriginalPrice']);
  }
}

/// Which access types this bundle can be bought as.
List<String> _availableTypes(Map<String, dynamic> b) {
  final force = b['forceClassType'] as String?;
  if (force != null && force.isNotEmpty) return [force];
  final prices = _priceJson(b);
  bool tierHas(String k1, String k2) {
    for (final e in prices.entries) {
      final v = e.value;
      if (v is Map && ((_num(v[k1]) ?? 0) > 0 || (_num(v[k2]) ?? 0) > 0)) {
        return true;
      }
    }
    return false;
  }

  bool mapHas(String k) {
    final m = prices['individualMapping'];
    if (m is! Map) return false;
    for (final v in m.values) {
      if (v is Map && (_num(v[k]) ?? 0) > 0) return true;
    }
    return false;
  }

  final out = <String>[];
  if (_bundleTypePrice(b, 'RECORDED') != null ||
      tierHas('recordedDiscount', 'recordedOriginal') ||
      mapHas('recorded')) {
    out.add('RECORDED');
  }
  if (_num(b['liveDiscountPrice']) != null ||
      _num(b['liveOriginalPrice']) != null ||
      tierHas('liveDiscount', 'liveOriginal') ||
      mapHas('live')) {
    out.add('LIVE');
  }
  if (_num(b['championDiscountPrice']) != null ||
      _num(b['championOriginalPrice']) != null ||
      tierHas('championDiscount', 'championOriginal') ||
      mapHas('champion')) {
    out.add('CHAMPION');
  }
  return out.isEmpty ? ['LIVE'] : out;
}

String _typeLabel(String t) =>
    t == 'RECORDED' ? 'Recorded' : (t == 'CHAMPION' ? 'Live Pro+' : 'Live Pro');

/// Estimated total (the server calculates the final amount at checkout).
double? _estimate(Map<String, dynamic> b, String type, List<String> ids) {
  if (ids.isEmpty) return null;
  final prices = _priceJson(b);
  final fixed = b['allowIndividualPurchase'] == false;
  double? total;
  if (fixed) {
    total = _bundleTypePrice(b, type);
  } else {
    final map = prices['individualMapping'];
    if (map is Map && ids.every((id) => map[id] is Map)) {
      final key = type == 'RECORDED' ? 'recorded' : (type == 'CHAMPION' ? 'champion' : 'live');
      double sum = 0;
      for (final id in ids) {
        final c = map[id] as Map;
        sum += _num(c[key]) ?? (type == 'CHAMPION' ? _num(c['live']) ?? 0 : 0);
      }
      total = sum > 0 ? sum : null;
    }
    if (total == null) {
      final tier = prices['${ids.length}'];
      if (tier is Map) {
        final p = type == 'RECORDED'
            ? (_num(tier['recordedDiscount']) ?? _num(tier['recordedOriginal']))
            : type == 'CHAMPION'
                ? (_num(tier['championDiscount']) ??
                    _num(tier['championOriginal']) ??
                    _num(tier['liveDiscount']) ??
                    _num(tier['liveOriginal']))
                : (_num(tier['liveDiscount']) ?? _num(tier['liveOriginal']));
        total = p;
      }
    }
    total ??= () {
      final p = _bundleTypePrice(b, type);
      return p;
    }();
  }
  if (total == null) return null;
  if (b['enableBundleDiscount'] == true) {
    final all = (b['courses'] as List?)?.length ?? 0;
    final requireAll = b['requireAllCourses'] != false;
    final appl = (b['bundleDiscountApplicability'] as String?) ?? 'BOTH';
    final group = type == 'RECORDED' ? 'RECORDED' : 'LIVE';
    final val = _num(b['bundleDiscountValue']) ?? 0;
    if ((!requireAll || ids.length == all) &&
        (appl == 'BOTH' || appl == group) &&
        val > 0) {
      final cut = (b['bundleDiscountType'] == 'FIXED') ? val : total * val / 100;
      total = (total - cut).clamp(0, double.infinity).toDouble();
    }
  }
  return total;
}

/// Price of one course inside a purchase: the manager's per-course price when
/// set, otherwise an even share of the total (last course takes the remainder).
double? _coursePrice(Map<String, dynamic> b, String type, List<String> ids,
    String id, double? total) {
  final map = _priceJson(b)['individualMapping'];
  if (b['allowIndividualPurchase'] != false && map is Map && map[id] is Map) {
    final key = type == 'RECORDED'
        ? 'recorded'
        : (type == 'CHAMPION' ? 'champion' : 'live');
    final c = map[id] as Map;
    final v = _num(c[key]) ?? (type == 'CHAMPION' ? _num(c['live']) : null);
    if (v != null && v > 0) return v;
  }
  if (total == null || ids.isEmpty) return null;
  final share = (total / ids.length).floorToDouble();
  return ids.last == id ? total - share * (ids.length - 1) : share;
}

// ───────────────────────────── Levels ─────────────────────────────

void _showEnrolledInfo(BuildContext context) {
  final tokens = context.tokens;
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => Container(
      padding: EdgeInsets.fromLTRB(
          24, 12, 24, 24 + MediaQuery.of(sheetContext).padding.bottom),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 5,
              decoration: BoxDecoration(
                color: tokens.border,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          const SizedBox(height: 22),
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: tokens.primaryAccent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(Symbols.school_rounded,
                size: 28, color: tokens.primaryAccent),
          ),
          const SizedBox(height: 16),
          Text('Where are my enrolled courses?',
              style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                  height: 1.15,
                  color: tokens.textPrimary)),
          const SizedBox(height: 10),
          Text(
              'Every course you buy shows up in the Courses tab. Open it any time to watch lectures, join live classes and see your materials.',
              style: TextStyle(
                  fontSize: 15.5,
                  height: 1.45,
                  color: tokens.textSecondary)),
          const SizedBox(height: 22),
          ApplePressable(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.of(sheetContext).pop();
              context.go('/courses');
            },
            child: Container(
              height: 54,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: tokens.primaryAccent,
                borderRadius: BorderRadius.circular(27),
              ),
              child: Text('Go to Courses tab',
                  style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: tokens.bg)),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: TextButton(
              onPressed: () => Navigator.of(sheetContext).pop(),
              child: Text('Not now',
                  style: TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w600,
                      color: tokens.textSecondary)),
            ),
          ),
        ],
      ),
    ),
  );
}


class BuyCourseLevelsPage extends ConsumerWidget {
  const BuyCourseLevelsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final bundlesA = ref.watch(bundleOfferingsProvider);
    final offsA = ref.watch(courseOfferingsProvider);
    final bundles = bundlesA.value ?? const <Map<String, dynamic>>[];
    final offs = offsA.value ?? const <Map<String, dynamic>>[];
    final loading = (bundlesA.isLoading || offsA.isLoading) &&
        bundles.isEmpty &&
        offs.isEmpty;

    final order = <String>[];
    final bCount = <String, int>{};
    final cCount = <String, int>{};
    for (final b in bundles) {
      final l = _levelOf(b);
      if (!order.contains(l)) order.add(l);
      bCount[l] = (bCount[l] ?? 0) + 1;
    }
    for (final o in offs) {
      final l = _levelOf(o);
      if (!order.contains(l)) order.add(l);
      cCount[l] = (cCount[l] ?? 0) + 1;
    }

    return AppPageScaffold(
      title: 'Buy Course',
      subtitle: 'Choose your term',
      right: ApplePressable(
        onTap: () {
          HapticFeedback.selectionClick();
          _showEnrolledInfo(context);
        },
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: tokens.surfaceSecondary,
            shape: BoxShape.circle,
          ),
          child: Icon(Symbols.info_rounded,
              size: 22, color: tokens.textPrimary),
        ),
      ),
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/store'),
      body: LayoutBuilder(builder: (context, box) {
        // About 3 and a fifth cards fit on one screen.
        final cardH =
            ((box.maxHeight - 18 - 36) / 3.2).clamp(96.0, 200.0).toDouble();
        return AppRefresh(
        onRefresh: () async {
          ref.invalidate(bundleOfferingsProvider);
          ref.invalidate(courseOfferingsProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
          children: [
            if (loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (order.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 80),
                child: Text(
                  bundlesA.hasError && offsA.hasError
                      ? 'Could not load courses. Pull down to retry.'
                      : 'No courses are available right now.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: tokens.textSecondary, fontSize: 15),
                ),
              )
            else
              for (var i = 0; i < order.length; i++) ...[
                _LevelCard(
                  index: i,
                  height: cardH,
                  level: order[i],
                  bundles: bCount[order[i]] ?? 0,
                  courses: cCount[order[i]] ?? 0,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    context.push('/store/course-level/${Uri.encodeComponent(order[i])}');
                  },
                ),
                const SizedBox(height: 12),
              ],
          ],
        ),
      );
      }),
    );
  }
}

const _kTermGradients = <List<Color>>[
  [Color(0xFF0A84FF), Color(0xFF5E5CE6)], // blue to indigo
  [Color(0xFF30D158), Color(0xFF0A7D4B)], // green
  [Color(0xFFFF9F0A), Color(0xFFFF453A)], // orange to red
  [Color(0xFFBF5AF2), Color(0xFF5E5CE6)], // purple
  [Color(0xFF64D2FF), Color(0xFF0A84FF)], // sky
];

const _kTermIcons = <IconData>[
  Symbols.rocket_launch_rounded,
  Symbols.school_rounded,
  Symbols.emoji_events_rounded,
  Symbols.lightbulb_rounded,
  Symbols.workspace_premium_rounded,
];

class _LevelCard extends StatelessWidget {
  const _LevelCard({
    required this.index,
    required this.height,
    required this.level,
    required this.bundles,
    required this.courses,
    required this.onTap,
  });
  final int index;
  final double height;
  final String level;
  final int bundles;
  final int courses;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      if (bundles > 0) '$bundles ${bundles == 1 ? 'Bundle' : 'Bundles'}',
      if (courses > 0) '$courses ${courses == 1 ? 'Course' : 'Courses'}',
    ];
    final g = _kTermGradients[index % _kTermGradients.length];
    return ApplePressable(
      onTap: onTap,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(30),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: g,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Positioned(
              right: -18,
              bottom: -28,
              child: Icon(_kTermIcons[index % _kTermIcons.length],
                  size: height * 0.95,
                  color: Colors.white.withValues(alpha: 0.16)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 22, 20, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.22),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(parts.join(' · '),
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white)),
                  ),
                  const Spacer(),
                  Text(level,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1,
                          height: 1.05,
                          color: Colors.white)),
                  const SizedBox(height: 14),
                  Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(23),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('View courses',
                            style: TextStyle(
                                fontSize: 15.5,
                                fontWeight: FontWeight.w700,
                                color: g.last)),
                        const SizedBox(width: 6),
                        Icon(Symbols.arrow_forward_rounded,
                            size: 18, color: g.last),
                      ],
                    ),
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

// ───────────────────────────── One level ─────────────────────────────

class BuyCourseLevelPage extends ConsumerWidget {
  const BuyCourseLevelPage({super.key, required this.level});
  final String level;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final bundlesA = ref.watch(bundleOfferingsProvider);
    final offsA = ref.watch(courseOfferingsProvider);
    final bundles = [
      for (final b in bundlesA.value ?? const <Map<String, dynamic>>[])
        if (_levelOf(b) == level) b,
    ];
    final offs = [
      for (final o in offsA.value ?? const <Map<String, dynamic>>[])
        if (_levelOf(o) == level) o,
    ];
    final loading = (bundlesA.isLoading || offsA.isLoading) &&
        bundles.isEmpty &&
        offs.isEmpty;

    return AppPageScaffold(
      title: '$level Level',
      subtitle: 'Bundles and courses',
      showBack: true,
      onBack: () =>
          context.canPop() ? context.pop() : context.go('/store/courses'),
      body: LayoutBuilder(builder: (context, box) {
        return AppRefresh(
        onRefresh: () async {
          ref.invalidate(bundleOfferingsProvider);
          ref.invalidate(courseOfferingsProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 40),
          children: [
            if (loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (bundles.isEmpty && offs.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 80),
                child: Text('Nothing here yet.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: tokens.textSecondary)),
              ),
            if (bundles.isNotEmpty) ...[
              for (var i = 0; i < bundles.length; i++) ...[
                _BundleCard(
                  accent: _kTermGradients[i % _kTermGradients.length].first,
                  bundle: bundles[i],
                  onTap: () {
                    HapticFeedback.lightImpact();
                    context.push('/store/bundles/${bundles[i]['id']}');
                  },
                ),
                const SizedBox(height: 14),
              ],
            ],
            if (offs.isNotEmpty) ...[
              for (var i = 0; i < offs.length; i++) ...[
                _OfferingCard(
                  accent: _kTermGradients[(i + bundles.length) %
                          _kTermGradients.length]
                      .first,
                  offering: offs[i],
                  onTap: () {
                    HapticFeedback.lightImpact();
                    context.push('/store/courses/${offs[i]['id']}');
                  },
                ),
                const SizedBox(height: 12),
              ],
            ],
          ],
        ),
      );
      }),
    );
  }
}

Color _tint(BuildContext context, Color accent, double a) =>
    Color.alphaBlend(accent.withValues(alpha: a), context.tokens.cardBg);

/// Small icon + text line used for the facts on every course card.
class _Fact extends StatelessWidget {
  const _Fact(this.icon, this.text, this.accent);
  final IconData icon;
  final String text;
  final Color accent;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, size: 18, color: accent),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: tokens.textPrimary)),
          ),
        ],
      ),
    );
  }
}

class _BundleCard extends StatelessWidget {
  const _BundleCard({
    required this.bundle,
    required this.accent,
    required this.onTap,
  });
  final Map<String, dynamic> bundle;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final courses = [
      for (final c in (bundle['courses'] as List? ?? const []))
        if (c is Map && c['course'] is Map)
          ((c['course'] as Map)['name'] ?? (c['course'] as Map)['subject'] ?? '')
              .toString(),
    ].where((s) => s.isNotEmpty).toList();
    final price = _num(bundle['startingPrice']) ??
        _bundleTypePrice(bundle, 'LIVE') ??
        _bundleTypePrice(bundle, 'RECORDED');
    final banner = (bundle['bannerText'] as String?)?.trim() ?? '';
    final fromText =
        ((bundle['startingFromText'] as String?)?.trim().isNotEmpty ?? false)
            ? (bundle['startingFromText'] as String).trim()
            : 'Starting from';

    Widget action(String label, bool primary) => Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: primary
                ? accent
                : Colors.white.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: 15.5,
                  fontWeight: FontWeight.w700,
                  color: primary ? Colors.white : Colors.black87)),
        );

    return ApplePressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 22, 16, 16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              _tint(context, accent, 0.20),
              _tint(context, accent, 0.07),
            ],
          ),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(
              color: accent.withValues(alpha: 0.28), width: 0.8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text((bundle['name'] ?? '').toString(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.9,
                    height: 1.08,
                    color: tokens.textPrimary)),
            if (courses.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final c in courses)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 11, vertical: 6),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(c,
                          style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: tokens.textPrimary)),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                children: [
                  if (banner.isNotEmpty)
                    _Fact(Symbols.event_rounded, banner, accent),
                  _Fact(Symbols.translate_rounded, 'Hinglish', accent),
                  _Fact(Symbols.all_inclusive_rounded,
                      'Access till end of term', accent),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: price == null
                      ? const SizedBox()
                      : Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(fromText,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontSize: 12.5,
                                    color: tokens.textSecondary)),
                            Text(_money(price),
                                style: TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -1,
                                    height: 1.1,
                                    color: tokens.textPrimary)),
                          ],
                        ),
                ),
                action('Details', false),
                const SizedBox(width: 8),
                action('Buy now', true),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _OfferingCard extends StatelessWidget {
  const _OfferingCard({
    required this.offering,
    required this.accent,
    required this.onTap,
  });
  final Map<String, dynamic> offering;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final course = (offering['course'] as Map?) ?? const {};
    final name = (course['name'] ?? offering['name'] ?? '').toString();
    final subject = (course['subject'] ?? '').toString();
    final hasRec = offering['hasRecorded'] == true;
    final hasLive = offering['hasLive'] == true;
    final rec = _num(offering['recordedDiscountPrice']);
    final live = _num(offering['liveDiscountPrice']);
    final from = [if (hasRec && rec != null) rec, if (hasLive && live != null) live];
    from.sort();
    return ApplePressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 18, 16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              _tint(context, accent, 0.20),
              _tint(context, accent, 0.07),
            ],
          ),
          borderRadius: BorderRadius.circular(26),
          border: Border.all(
              color: accent.withValues(alpha: 0.28), width: 0.8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.6,
                              color: tokens.textPrimary)),
                      if (subject.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(subject,
                            style: TextStyle(
                                fontSize: 13.5, color: tokens.textSecondary)),
                      ],
                    ],
                  ),
                ),
                if (from.isNotEmpty)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('from',
                          style: TextStyle(
                              fontSize: 12, color: tokens.textSecondary)),
                      Text(_money(from.first),
                          style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.8,
                              height: 1.05,
                              color: tokens.textPrimary)),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  _Fact(
                      Symbols.play_circle_rounded,
                      [if (hasRec) 'Recorded', if (hasLive) 'Live Pro'].join('  ·  '),
                      accent),
                  _Fact(Symbols.translate_rounded, 'Hinglish', accent),
                  _Fact(Symbols.all_inclusive_rounded,
                      'Access till end of term', accent),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: tokens.surfaceSecondary,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text,
          style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: tokens.textSecondary)),
    );
  }
}

// ───────────────────────────── Bundle details + buy ─────────────────────────────

const _kCommonPoints = [
  'Full access to recorded lectures',
  'Course materials and notes included',
  'Learn on the website and the app with one login',
  'Access till the end of the term',
  'Support from the GenZ IITian team',
];

// 'yes' / 'no' render as icons, anything else renders as text.
const _kCompareRows = [
  ['Recorded lectures', 'yes', 'yes'],
  ['Course materials', 'yes', 'yes'],
  ['Class recordings', 'yes', 'yes'],
  ['Live classes', 'no', 'yes'],
  ['Direct Q&A with teacher', 'no', 'yes'],
  ['Priority support', 'Standard', '24/7 priority'],
  ['Access', 'Till end of term', 'Till end of term'],
];

Widget _cmpCell(String v, AppThemeTokens tokens, bool strong) {
  if (v == 'yes') {
    return Icon(Symbols.check_circle_rounded,
        size: 24, color: tokens.success);
  }
  if (v == 'no') {
    return Icon(Symbols.cancel_rounded, size: 24, color: tokens.danger);
  }
  return Text(v,
      textAlign: TextAlign.center,
      style: TextStyle(
          fontSize: 12.5,
          height: 1.25,
          fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
          color: strong ? tokens.textPrimary : tokens.textSecondary));
}

const _kChampionEligibility = [
  'Attend at least 80% of live classes.',
  'Score the minimum required marks in the weekly tests.',
  'Regularly share your GA marks and progress with the team, and be eligible to give the Qualifier exam offline.',
];
const _kChampionProvides = [
  'Complete academic support',
  'Live classes and study resources',
  'Weekly practice and evaluation',
  'Premium guidance and mentorship',
  '1-to-1 mentorship for your strategy and action plan',
];

const _kPalette = <Color>[
  Color(0xFF0A84FF), // blue
  Color(0xFF30D158), // green
  Color(0xFFFF9F0A), // orange
  Color(0xFFBF5AF2), // purple
  Color(0xFFFF375F), // pink
  Color(0xFF64D2FF), // sky
];

Color _typeColor(String t) => t == 'RECORDED'
    ? const Color(0xFFFF9F0A)
    : (t == 'LIVE' ? const Color(0xFF0A84FF) : const Color(0xFFBF5AF2));

IconData _typeIcon(String t) => t == 'RECORDED'
    ? Symbols.play_circle_rounded
    : (t == 'LIVE' ? Symbols.videocam_rounded : Symbols.workspace_premium_rounded);

class BundleDetailPage extends ConsumerStatefulWidget {
  const BundleDetailPage({super.key, required this.bundleId});
  final String bundleId;
  @override
  ConsumerState<BundleDetailPage> createState() => _BundleDetailPageState();
}

class _BundleDetailPageState extends ConsumerState<BundleDetailPage> {
  int _step = 0; // 0 courses, 1 batch, 2 review and pay
  String? _type;
  final Set<String> _selected = <String>{};
  bool _agree = false;
  bool _buying = false;
  bool _hasBatchChoice = true;

  void _next() {
    HapticFeedback.lightImpact();
    setState(() {
      if (_step == 0) {
        if (_hasBatchChoice) _type = null;
        _step = _hasBatchChoice ? 1 : 2;
      } else if (_step < 2) {
        _step += 1;
      }
    });
  }

  void _back() {
    if (_step == 0) {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/store/courses');
      }
      return;
    }
    setState(() {
      _step = (_step == 2 && !_hasBatchChoice) ? 0 : _step - 1;
    });
  }

  Future<void> _buy(Map<String, dynamic> b, List<String> ids) async {
    if (_buying || ids.isEmpty || _type == null || !_agree) return;
    HapticFeedback.mediumImpact();
    setState(() => _buying = true);
    try {
      final all = (b['courses'] as List? ?? const [])
          .map((c) => ((c as Map)['course'] as Map)['id'].toString())
          .toList();
      final svc = PlayBillingService(api: ref.read(apiClientProvider));
      final result = await svc.purchaseCourse(
        isBundle: true,
        id: widget.bundleId,
        accessType: _type!,
        selectedCourseIds: ids,
        buyAll: ids.length == all.length,
      );
      if (!mounted) return;
      if (result.isSuccess) {
        ref.invalidate(coursesProvider);
        ref.invalidate(courseOfferingsProvider);
        await showPurchaseSuccessDialog(
          context,
          title: (b['name'] ?? 'Your courses').toString(),
          offerOpen: false,
        );
        if (mounted) context.go('/courses');
      } else if (!result.isCancelled) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(result.errorMessage ?? 'Payment was not completed.')));
      }
    } finally {
      if (mounted) setState(() => _buying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final async = ref.watch(bundleOfferingsProvider);
    final myCourses = ref.watch(coursesProvider).value ?? const [];
    final enrolled = <String>{
      for (final c in myCourses)
        if (c.enrollmentType != null) c.id,
    };

    Map<String, dynamic>? found;
    for (final x in async.value ?? const <Map<String, dynamic>>[]) {
      if (x['id'] == widget.bundleId) found = x;
    }
    if (found == null) {
      return AppPageScaffold(
        title: 'Bundle',
        showBack: true,
        body: Center(
          child: async.isLoading
              ? const CircularProgressIndicator()
              : Text('This bundle is not available.',
                  style: TextStyle(color: tokens.textSecondary)),
        ),
      );
    }
    final bundle = found;
    final fixed = bundle['allowIndividualPurchase'] == false;
    final courseRows = [
      for (final c in (bundle['courses'] as List? ?? const []))
        if (c is Map && c['course'] is Map)
          Map<String, dynamic>.from(c['course'] as Map),
    ];
    final types = _availableTypes(bundle);
    _hasBatchChoice = types.length > 1;
    if (!_hasBatchChoice) _type = types.first;

    final grad = _kTermGradients[
        bundle['id'].toString().hashCode.abs() % _kTermGradients.length];
    final allIds = [
      for (final c in courseRows)
        if (fixed || !enrolled.contains(c['id'])) c['id'].toString(),
    ];
    final ids = fixed
        ? [for (final c in courseRows) c['id'].toString()]
        : [for (final c in courseRows) if (_selected.contains(c['id'])) c['id'].toString()];
    final priceIds = ids.isNotEmpty ? ids : allIds;
    final total = _type == null ? null : _estimate(bundle, _type!, ids);
    final allEnrolled = !fixed &&
        courseRows.isNotEmpty &&
        courseRows.every((c) => enrolled.contains(c['id']));
    final points = _lines(bundle['highlights']);
    final desc = (bundle['description'] as String?)?.trim() ?? '';
    final bannerText = (bundle['bannerText'] as String?)?.trim() ?? '';
    final hasRec = types.contains('RECORDED');
    final hasLive = types.contains('LIVE') || types.contains('CHAMPION');
    final fromPrice = _num(bundle['startingPrice']) ??
        _estimate(bundle, types.first, priceIds);
    final fromText =
        (bundle['startingFromText'] as String?)?.trim().isNotEmpty == true
            ? (bundle['startingFromText'] as String).trim()
            : 'Starting from';

    Widget card(String title, Widget child,
            {IconData icon = Symbols.auto_awesome_rounded,
            Color color = const Color(0xFF0A84FF)}) =>
        Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: tokens.cardBg,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: tokens.border, width: 0.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon, size: 20, color: color),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(title,
                        style: TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                            color: tokens.textPrimary)),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              child,
            ],
          ),
        );

    Widget checks(List<String> items, Color color) => Column(
          children: [
            for (final t in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.16),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Symbols.check_rounded, size: 15, color: color),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(t,
                          style: TextStyle(
                              fontSize: 15,
                              height: 1.4,
                              color: tokens.textPrimary)),
                    ),
                  ],
                ),
              ),
          ],
        );

    Widget stepper() => Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
          child: Row(
            children: [
              for (var i = 0; i < 3; i++) ...[
                Expanded(
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    height: 5,
                    decoration: BoxDecoration(
                      color: i <= _step ? grad.first : tokens.border,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                if (i < 2) const SizedBox(width: 6),
              ],
            ],
          ),
        );

    // ───────── Step 0: banner + choose courses ─────────
    Widget hero() => Container(
          margin: const EdgeInsets.only(bottom: 14),
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(32),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [grad.first, grad.last],
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                right: -40,
                top: -40,
                child: Container(
                  width: 170,
                  height: 170,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.12),
                  ),
                ),
              ),
              Positioned(
                left: -50,
                bottom: -60,
                child: Container(
                  width: 170,
                  height: 170,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                ),
              ),
              Positioned(
                right: 14,
                bottom: 10,
                child: Icon(Symbols.school_rounded,
                    size: 120, color: Colors.white.withValues(alpha: 0.16)),
              ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final t in [
                          '${courseRows.length} courses',
                          'Hinglish',
                          'Access till end of term',
                        ])
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.22),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(t,
                                style: const TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text((bundle['name'] ?? '').toString(),
                        style: const TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1.3,
                            height: 1.05,
                            color: Colors.white)),
                    if (bannerText.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          const Icon(Symbols.event_rounded,
                              size: 18, color: Colors.white),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(bannerText,
                                style: const TextStyle(
                                    fontSize: 15.5,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white)),
                          ),
                        ],
                      ),
                    ],
                    if (desc.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(desc,
                          style: TextStyle(
                              fontSize: 15,
                              height: 1.45,
                              color: Colors.white.withValues(alpha: 0.92))),
                    ],
                    if (fromPrice != null) ...[
                      const SizedBox(height: 18),
                      Text(fromText,
                          style: TextStyle(
                              fontSize: 13,
                              color: Colors.white.withValues(alpha: 0.85))),
                      Text(_money(fromPrice),
                          style: const TextStyle(
                              fontSize: 40,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -1.4,
                              height: 1.05,
                              color: Colors.white)),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );

    Widget courseTile(Map<String, dynamic> c, int i) {
      final id = c['id'].toString();
      final color = _kPalette[i % _kPalette.length];
      final isEnrolled = !fixed && enrolled.contains(id);
      final on = !fixed && _selected.contains(id) && !isEnrolled;
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: ApplePressable(
          onTap: (fixed || isEnrolled)
              ? null
              : () {
                  HapticFeedback.selectionClick();
                  setState(() {
                    if (!_selected.add(id)) _selected.remove(id);
                  });
                },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: on ? color.withValues(alpha: 0.12) : tokens.surfaceSecondary,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                  color: on ? color : Colors.transparent, width: 1.6),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: isEnrolled ? 0.08 : 0.18),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(Symbols.menu_book_rounded,
                      size: 22, color: isEnrolled ? tokens.textMuted : color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text((c['name'] ?? c['subject'] ?? '').toString(),
                      style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w600,
                          color: isEnrolled
                              ? tokens.textMuted
                              : tokens.textPrimary)),
                ),
                const SizedBox(width: 8),
                if (isEnrolled)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: tokens.success.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('Enrolled',
                        style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: tokens.success)),
                  )
                else if (!fixed)
                  Icon(
                      on
                          ? Symbols.check_circle_rounded
                          : Symbols.radio_button_unchecked_rounded,
                      size: 26,
                      color: on ? color : tokens.textMuted),
              ],
            ),
          ),
        ),
      );
    }

    final pickable = [
      for (final c in courseRows)
        if (!enrolled.contains(c['id'])) c['id'].toString(),
    ];

    final step0 = <Widget>[
      hero(),
      if (points.isNotEmpty)
        card('What you get', checks(points, const Color(0xFF30D158)),
            icon: Symbols.auto_awesome_rounded,
            color: const Color(0xFF30D158)),
      if (fixed)
        card(
          'Included courses',
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF9F0A).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Symbols.lock_rounded,
                        size: 20, color: Color(0xFFFF9F0A)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                          'Fixed bundle. All ${courseRows.length} courses come together and cannot be bought separately.',
                          style: TextStyle(
                              fontSize: 14,
                              height: 1.4,
                              fontWeight: FontWeight.w600,
                              color: tokens.textPrimary)),
                    ),
                  ],
                ),
              ),
              for (var i = 0; i < courseRows.length; i++)
                courseTile(courseRows[i], i),
            ],
          ),
          icon: Symbols.menu_book_rounded,
          color: const Color(0xFF0A84FF),
        )
      else
        card(
          'Choose your courses',
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                        _selected.isEmpty
                            ? 'Tap the courses you want to buy.'
                            : '${_selected.length} of ${courseRows.length} selected',
                        style: TextStyle(
                            fontSize: 14, color: tokens.textSecondary)),
                  ),
                  ApplePressable(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() {
                        if (_selected.length == pickable.length) {
                          _selected.clear();
                        } else {
                          _selected
                            ..clear()
                            ..addAll(pickable);
                        }
                      });
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 4),
                      child: Text(
                          (_selected.length == pickable.length &&
                                  pickable.isNotEmpty)
                              ? 'Clear'
                              : 'Select all',
                          style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0A84FF))),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (var i = 0; i < courseRows.length; i++)
                courseTile(courseRows[i], i),
            ],
          ),
          icon: Symbols.checklist_rounded,
          color: const Color(0xFF0A84FF),
        ),
    ];

    // ───────── Step 1: Recorded or Live ─────────
    final step1 = <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 14),
        child: Text('Choose your batch',
            style: TextStyle(
                fontSize: 30,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.9,
                color: tokens.textPrimary)),
      ),
      for (final t in types)
        Builder(builder: (_) {
          final on = _type == t;
          final c = _typeColor(t);
          final tp = _estimate(bundle, t, priceIds);
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: ApplePressable(
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _type = t);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 84,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  gradient: on
                      ? LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [c, c.withValues(alpha: 0.72)],
                        )
                      : null,
                  color: on ? null : tokens.cardBg,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(
                      color: on ? c : tokens.border, width: on ? 1.4 : 0.8),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: on
                            ? Colors.white.withValues(alpha: 0.25)
                            : tokens.surfaceSecondary,
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: Icon(_typeIcon(t),
                          size: 26, color: on ? Colors.white : tokens.textSecondary),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(_typeLabel(t),
                          style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.7,
                              color:
                                  on ? Colors.white : tokens.textPrimary)),
                    ),
                    if (tp != null)
                      Text(_money(tp),
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.6,
                              color: on ? Colors.white : tokens.textPrimary)),
                  ],
                ),
              ),
            ),
          );
        }),
      if (hasRec || hasLive)
        card(
          hasRec && hasLive
              ? 'Live Pro vs Recorded'
              : (hasLive ? 'Live Pro' : 'Recorded batch'),
          Column(
            children: [
              Row(
                children: [
                  const Expanded(flex: 5, child: SizedBox()),
                  if (hasRec)
                    Expanded(
                        flex: 4,
                        child: Text('Recorded',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFFF9F0A)))),
                  if (hasLive)
                    Expanded(
                        flex: 4,
                        child: Text('Live Pro',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0A84FF)))),
                ],
              ),
              for (final r in _kCompareRows) ...[
                Divider(height: 20, thickness: 0.5, color: tokens.border),
                Row(
                  children: [
                    Expanded(
                        flex: 5,
                        child: Text(r[0],
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: tokens.textPrimary))),
                    if (hasRec)
                      Expanded(flex: 4, child: _cmpCell(r[1], tokens, false)),
                    if (hasLive)
                      Expanded(
                          flex: 4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0A84FF)
                                  .withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            alignment: Alignment.center,
                            child: _cmpCell(r[2], tokens, true),
                          )),
                  ],
                ),
              ],
            ],
          ),
          icon: Symbols.compare_arrows_rounded,
          color: const Color(0xFFBF5AF2),
        ),
    ];

    // ───────── Step 2: review, terms, pay ─────────
    final chosenIds = [
      for (final c in courseRows)
        if (ids.contains(c['id'].toString())) c['id'].toString(),
    ];
    final chosenCourses = [
      for (final c in courseRows)
        if (ids.contains(c['id'].toString()))
          (c['name'] ?? c['subject'] ?? '').toString(),
    ];
    final tc = _type == null ? grad.first : _typeColor(_type!);
    final step2 = <Widget>[
      card(
        'Your order',
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text((bundle['name'] ?? '').toString(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                          color: tokens.textPrimary)),
                ),
                if (_type != null) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: tc.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(_typeIcon(_type!), size: 15, color: tc),
                        const SizedBox(width: 5),
                        Text(_typeLabel(_type!),
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: tc)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 14),
            for (var i = 0; i < chosenCourses.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: _kPalette[i % _kPalette.length],
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(chosenCourses[i],
                          style: TextStyle(
                              fontSize: 15.5,
                              fontWeight: FontWeight.w600,
                              color: tokens.textPrimary)),
                    ),
                    Builder(builder: (_) {
                      final pr = (_type == null || fixed)
                          ? null
                          : _coursePrice(bundle, _type!, chosenIds, chosenIds[i], total);
                      return Text(pr == null ? '' : _money(pr),
                          style: TextStyle(
                              fontSize: 15.5,
                              fontWeight: FontWeight.w700,
                              color: tokens.textPrimary));
                    }),
                  ],
                ),
              ),
            Divider(height: 26, thickness: 0.5, color: tokens.border),
            Row(
              children: [
                Expanded(
                  child: Text(
                      'Total amount',
                      style: TextStyle(
                          fontSize: 15, color: tokens.textSecondary)),
                ),
                Text(total == null ? 'At checkout' : _money(total),
                    style: TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1,
                        color: tokens.textPrimary)),
              ],
            ),
          ],
        ),
        icon: Symbols.receipt_long_rounded,
        color: const Color(0xFFFF375F),
      ),
      card('Included with every purchase',
          checks(_kCommonPoints, const Color(0xFFFF9F0A)),
          icon: Symbols.verified_rounded, color: const Color(0xFFFF9F0A)),
    ];

    step2.addAll(<Widget>[
      if (_type == 'CHAMPION')
        card(
          'Champion Terms & Conditions',
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                  'Everything in Live Pro, plus a full refund or free reattempt support when all conditions below are fulfilled.',
                  style: TextStyle(
                      fontSize: 14, height: 1.4, color: tokens.textSecondary)),
              const SizedBox(height: 14),
              Text('Eligibility criteria',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary)),
              const SizedBox(height: 10),
              checks(_kChampionEligibility, const Color(0xFFFF375F)),
              const SizedBox(height: 4),
              Text('What we provide',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary)),
              const SizedBox(height: 10),
              checks(_kChampionProvides, const Color(0xFF30D158)),
            ],
          ),
          icon: Symbols.emoji_events_rounded,
          color: const Color(0xFFFF375F)),
      ApplePressable(
        onTap: () {
          HapticFeedback.selectionClick();
          setState(() => _agree = !_agree);
        },
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _agree
                ? tokens.success.withValues(alpha: 0.10)
                : tokens.cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
                color: _agree ? tokens.success : tokens.border,
                width: _agree ? 1.4 : 0.5),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                  _agree
                      ? Symbols.check_box_rounded
                      : Symbols.check_box_outline_blank_rounded,
                  size: 26,
                  color: _agree ? tokens.success : tokens.textMuted),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                    'I agree to the Terms & Conditions and Refund Policy, and to the total shown above.',
                    style: TextStyle(
                        fontSize: 14.5,
                        height: 1.4,
                        color: tokens.textPrimary)),
              ),
            ],
          ),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
        child: Row(
          children: [
            ApplePressable(
              onTap: () => context.push('/terms-and-conditions'),
              child: const Text('Terms & Conditions',
                  style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0A84FF))),
            ),
            const SizedBox(width: 16),
            ApplePressable(
              onTap: () => context.push('/refund-policy'),
              child: const Text('Refund Policy',
                  style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0A84FF))),
            ),
          ],
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(8, 14, 8, 0),
        child: Text(
            'Payment is handled securely by Google Play. The final price is shown in the Play checkout.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12.5, color: tokens.textMuted)),
      ),
    ]);

    // ───────── Bottom bar ─────────
    final String barTop;
    final String barBottom;
    final String btnLabel;
    final bool btnEnabled;
    final VoidCallback? btnTap;
    if (_step == 0) {
      barTop = fixed
          ? 'Fixed bundle'
          : (_selected.isEmpty ? 'Nothing selected' : 'Selected');
      barBottom = fixed
          ? 'All ${courseRows.length} courses'
          : '${_selected.length} ${_selected.length == 1 ? 'course' : 'courses'}';
      btnLabel = allEnrolled
          ? 'Already enrolled'
          : (!fixed && _selected.isEmpty ? 'Select a course' : 'Continue');
      btnEnabled = !allEnrolled && (fixed || _selected.isNotEmpty);
      btnTap = btnEnabled ? _next : null;
    } else if (_step == 1) {
      barTop = _type == null ? 'Pick a batch' : _typeLabel(_type!);
      barBottom = total == null ? '' : _money(total);
      btnLabel = 'Continue';
      btnEnabled = _type != null;
      btnTap = btnEnabled ? _next : null;
    } else {
      barTop = 'Total';
      barBottom = total == null ? 'At checkout' : _money(total);
      btnLabel = _agree ? 'Pay now' : 'Accept terms to pay';
      btnEnabled = _agree && ids.isNotEmpty && !_buying;
      btnTap = btnEnabled ? () => _buy(bundle, ids) : null;
    }

    final stepTitles = ['Choose courses', 'Choose batch', 'Review and pay'];
    final steps = [step0, step1, step2];

    return PopScope(
      canPop: _step == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _back();
      },
      child: AppPageScaffold(
        title: (bundle['name'] ?? 'Bundle').toString(),
        subtitle: 'Step ${_step + 1} of 3  ·  ${stepTitles[_step]}',
        showBack: true,
        onBack: _back,
        bottomNavigationBar: Container(
          padding: EdgeInsets.fromLTRB(
              20, 12, 20, 12 + MediaQuery.of(context).padding.bottom),
          decoration: BoxDecoration(
            color: tokens.bg,
            border: Border(top: BorderSide(color: tokens.border, width: 0.5)),
          ),
          child: Row(
            children: [
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (barTop.isNotEmpty)
                    Text(barTop,
                        style: TextStyle(
                            fontSize: 12.5, color: tokens.textSecondary)),
                  if (barBottom.isNotEmpty)
                    Text(barBottom,
                        style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.6,
                            color: tokens.textPrimary)),
                ],
              ),
              const SizedBox(width: 18),
              Expanded(
                child: ApplePressable(
                  onTap: btnTap,
                  child: Container(
                    height: 54,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: btnEnabled
                          ? LinearGradient(colors: [
                              _step == 2 ? const Color(0xFF30D158) : grad.first,
                              _step == 2 ? const Color(0xFF0A7D4B) : grad.last,
                            ])
                          : null,
                      color: btnEnabled ? null : tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(27),
                    ),
                    child: _buying
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                                strokeWidth: 2.4, color: Colors.white))
                        : Text(btnLabel,
                            style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: btnEnabled
                                    ? Colors.white
                                    : tokens.textMuted)),
                  ),
                ),
              ),
            ],
          ),
        ),
        body: AnimatedSwitcher(
          duration: const Duration(milliseconds: 240),
          switchInCurve: Curves.easeOutCubic,
          child: ListView(
            key: ValueKey<int>(_step),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 30),
            children: [stepper(), ...steps[_step]],
          ),
        ),
      ),
    );
  }
}
