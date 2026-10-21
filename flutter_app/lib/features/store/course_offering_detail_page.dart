import 'dart:async';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/payments/play_billing_service.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_typography.dart';
import '../courses/courses_page.dart' show coursesProvider;
import 'course_offerings_page.dart' show courseOfferingsProvider;
import '../../shared/widgets/shimmer_loading.dart';
import '../payments/payment_result_page.dart';
import '../../core/payments/payment_attempt_logger.dart';

/// Fetches a single offering by id by filtering the cached list. There's no
/// dedicated /api/course-offerings/[id] GET endpoint in the backend, but
/// the list is small and already cached client-side from the catalog page.
final courseOfferingProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, id) async {
  final all = await ref.watch(courseOfferingsProvider.future);
  for (final o in all) {
    if (o['id'] == id) return o;
  }
  return null;
});

class CourseOfferingDetailPage extends ConsumerStatefulWidget {
  const CourseOfferingDetailPage({super.key, required this.offeringId});
  final String offeringId;
  @override
  ConsumerState<CourseOfferingDetailPage> createState() =>
      _CourseOfferingDetailPageState();
}

class _CourseOfferingDetailPageState
    extends ConsumerState<CourseOfferingDetailPage> {
  String _selectedAccess = 'LIVE'; // default, corrected once we have data
  bool _buying = false;
  final TextEditingController _couponController = TextEditingController();

  @override
  void dispose() {
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _buy() async {
    if (_buying) return;
    setState(() => _buying = true);
    var retry = false;
    try {
      final o = ref.read(courseOfferingProvider(widget.offeringId)).value;
      final name = ((o?['name'] ?? (o?['course'] is Map ? (o!['course'] as Map)['name'] : null)) ?? 'Your course')
          .toString();
      final num? price = o?['startingPrice'] is num ? o!['startingPrice'] as num : null;
      final log = PaymentAttemptLogger(ref.read(apiClientProvider));
      final attempt = log.start(
        kind: 'COURSE',
        itemName: name,
        itemRef: widget.offeringId,
        amount: price?.toDouble(),
        gateway: 'PLAY',
      );
      PlayPaymentResult result;
      try {
        result = await PlayBillingService(api: ref.read(apiClientProvider))
            .purchaseCourse(
          isBundle: false,
          id: widget.offeringId,
          accessType: _selectedAccess,
        );
      } catch (e) {
        result = PlayPaymentResult.failed('Checkout error: $e');
      }
      final attemptId = await attempt;
      if (result.isSuccess) {
        unawaited(log.finish(attemptId,
            status: 'SUCCESS', orderRef: result.orderId));
      } else {
        unawaited(log.finish(attemptId,
            status: result.isCancelled ? 'CANCELLED' : 'FAILED',
            reason: result.isCancelled
                ? 'Closed checkout without paying'
                : (result.errorMessage ?? 'Payment failed')));
      }
      if (!mounted) return;
      if (result.isSuccess) {
        // Invalidate everything that could reflect the new enrollment so the
        // course immediately shows up under My Courses + Profile.
        ref.invalidate(courseOfferingsProvider);
        ref.invalidate(coursesProvider);
        await showPaymentResult(
          context,
          outcome: PaymentOutcome.success,
          title: name,
          amount: price?.toDouble(),
          orderId: result.orderId,
          method: 'Google Play',
          grants: [
            _selectedAccess == 'LIVE'
                ? 'Live classes and recordings'
                : 'All recorded lectures',
            'Course materials and notes',
            'Learn in the app and on the website',
          ],
          primaryLabel: 'Go to my courses',
        );
        if (mounted) context.go('/courses');
      } else {
        final act = await showPaymentResult(
          context,
          outcome: result.isCancelled
              ? PaymentOutcome.cancelled
              : PaymentOutcome.failed,
          title: name,
          amount: price?.toDouble(),
          method: 'Google Play',
          reason: result.errorMessage,
        );
        if (act == PaymentResultAction.primary) retry = true;
      }
    } finally {
      if (mounted) setState(() => _buying = false);
    }
    if (retry && mounted) unawaited(_buy());
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(courseOfferingProvider(widget.offeringId));
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: async.when(
          loading: () => const PageLoading(),
          error: (e, _) => Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Text('Failed to load course: $e',
                  style: AppTypography.bodyMuted,
                  textAlign: TextAlign.center),
            ),
          ),
          data: (o) {
            if (o == null) return _NotFound();
            final hasLive = (o['hasLive'] as bool?) ?? false;
            final hasRec = (o['hasRecorded'] as bool?) ?? false;
            // Auto-correct the default once we know what this offering supports.
            if (_selectedAccess == 'LIVE' && !hasLive && hasRec) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _selectedAccess = 'RECORDED');
              });
            }
            return _Body(
              offering: o,
              selectedAccess: _selectedAccess,
              onAccess: (v) => setState(() => _selectedAccess = v),
              onBuy: _buy,
              buying: _buying,
              couponController: _couponController,
            );
          },
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.offering,
    required this.selectedAccess,
    required this.onAccess,
    required this.onBuy,
    required this.buying,
    required this.couponController,
  });
  final Map<String, dynamic> offering;
  final String selectedAccess;
  final ValueChanged<String> onAccess;
  final VoidCallback onBuy;
  final bool buying;
  final TextEditingController couponController;

  Color _accent(Map course) {
    final hex = (course['color'] as String?) ?? '#4F46E5';
    final v = int.tryParse(hex.replaceAll('#', ''), radix: 16) ?? 0x4F46E5;
    return Color(0xFF000000 | v);
  }

  int? _priceFor(String access) {
    switch (access) {
      case 'LIVE':
        return (offering['liveDiscountPrice'] as num?)?.toInt();
      case 'RECORDED':
        return (offering['recordedDiscountPrice'] as num?)?.toInt();
      case 'CHAMPION':
        return (offering['championDiscountPrice'] as num?)?.toInt() ??
            (offering['championOriginalPrice'] as num?)?.toInt();
    }
    return null;
  }

  int? _origPriceFor(String access) {
    switch (access) {
      case 'LIVE':
        return (offering['liveOriginalPrice'] as num?)?.toInt();
      case 'RECORDED':
        return (offering['recordedOriginalPrice'] as num?)?.toInt();
      case 'CHAMPION':
        return (offering['championOriginalPrice'] as num?)?.toInt();
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final course = (offering['course'] as Map?) ?? const {};
    final accent = _accent(course);
    final name = (offering['name'] as String?) ??
        (course['name'] as String?) ??
        'Course';
    final teacher = course['teacherName'] as String?;
    final subject = course['subject'] as String?;
    final hasLive = (offering['hasLive'] as bool?) ?? false;
    final hasRec = (offering['hasRecorded'] as bool?) ?? false;
    final hasChampion =
        ((offering['championOriginalPrice'] as num?) ?? 0) > 0 ||
            ((offering['championDiscountPrice'] as num?) ?? 0) > 0;
    final price = _priceFor(selectedAccess);
    final orig = _origPriceFor(selectedAccess);

    return AppPageScaffold(
      title: name.isNotEmpty ? name : 'Course Details',
      subtitle: subject,
      showBack: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(0, 16, 0, 110),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: LinearGradient(
                  colors: [accent, accent.withOpacity(0.78)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: AppShadows.lg,
              ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  children: [
                    if (hasLive)
                      const _BadgePill(
                          text: 'LIVE BATCH', bg: Color(0x33FFFFFF)),
                    if (hasRec)
                      const _BadgePill(
                          text: 'RECORDED', bg: Color(0x33FFFFFF)),
                  ],
                ),
                const SizedBox(height: 12),
                Text(name,
                    style: AppTypography.heroHeading
                        .copyWith(fontSize: 22, letterSpacing: -0.3)),
                if (teacher != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        width: 30,
                        height: 30,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xEBFFFFFF),
                        ),
                        alignment: Alignment.center,
                        child: Text(teacher[0].toUpperCase(),
                            style: AppTypography.title.copyWith(
                              color: AppColors.brandDk,
                              fontSize: 13,
                            )),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('YOUR MENTOR',
                                style: AppTypography.uppercase.copyWith(
                                  color: const Color(0xCCFFFFFF),
                                  fontSize: 10,
                                  letterSpacing: 0.4,
                                )),
                            Text(teacher,
                                style: AppTypography.title.copyWith(
                                  color: AppColors.textInverse,
                                  fontSize: 13.5,
                                )),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('CHOOSE ACCESS',
                  style: AppTypography.uppercase
                      .copyWith(letterSpacing: 1.2)),
              const SizedBox(height: 12),
              if (hasLive)
                _AccessRow(
                  label: 'Live Batch',
                  sub: 'Live classes + recordings + community',
                  price: (offering['liveDiscountPrice'] as num?)?.toInt(),
                  original:
                      (offering['liveOriginalPrice'] as num?)?.toInt(),
                  selected: selectedAccess == 'LIVE',
                  onTap: () => onAccess('LIVE'),
                  accent: accent,
                ),
              if (hasRec)
                _AccessRow(
                  label: 'Recorded',
                  sub: 'Full lecture library, learn at your pace',
                  price:
                      (offering['recordedDiscountPrice'] as num?)?.toInt(),
                  original:
                      (offering['recordedOriginalPrice'] as num?)?.toInt(),
                  selected: selectedAccess == 'RECORDED',
                  onTap: () => onAccess('RECORDED'),
                  accent: accent,
                ),
              if (hasChampion)
                _AccessRow(
                  label: 'Champion',
                  sub: (offering['championSubtitle'] as String?) ??
                      '1-on-1 mentor sessions + everything in Live',
                  price:
                      (offering['championDiscountPrice'] as num?)?.toInt() ??
                          (offering['championOriginalPrice'] as num?)
                              ?.toInt(),
                  original:
                      (offering['championOriginalPrice'] as num?)?.toInt(),
                  selected: selectedAccess == 'CHAMPION',
                  onTap: () => onAccess('CHAMPION'),
                  accent: accent,
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _InfoCard(),
        ),
        const SizedBox(height: 18),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _BuyBar(
            price: price,
            original: orig,
            buying: buying,
            disabled: price == null,
            onBuy: onBuy,
            accent: accent,
          ),
        ),
      ],
    ),
  );
}
}

class _AccessRow extends StatelessWidget {
  const _AccessRow({
    required this.label,
    required this.sub,
    required this.price,
    required this.original,
    required this.selected,
    required this.onTap,
    required this.accent,
  });
  final String label;
  final String sub;
  final int? price;
  final int? original;
  final bool selected;
  final VoidCallback onTap;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: selected
                  ? accent.withOpacity(0.06)
                  : AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selected ? accent : AppColors.line,
                width: selected ? 1.5 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                        color: selected ? accent : AppColors.line2,
                        width: 2),
                    color: selected ? accent : Colors.transparent,
                  ),
                  child: selected
                      ? const Icon(Icons.check,
                          color: AppColors.textInverse, size: 14)
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: AppTypography.title
                              .copyWith(fontSize: 14, color: AppColors.ink)),
                      const SizedBox(height: 2),
                      Text(sub,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyMuted
                              .copyWith(fontSize: 11.5)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (price != null)
                      Text('₹$price',
                          style: AppTypography.title.copyWith(
                            fontSize: 15,
                            color: AppColors.ink,
                          ))
                    else
                      Text('—',
                          style: AppTypography.bodyMuted
                              .copyWith(fontSize: 13)),
                    if (original != null && price != null && original! > price!)
                      Text('₹$original',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.muted,
                            fontSize: 11,
                            decoration: TextDecoration.lineThrough,
                          )),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BadgePill extends StatelessWidget {
  const _BadgePill({required this.text, required this.bg});
  final String text;
  final Color bg;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(text,
          style: AppTypography.uppercase.copyWith(
            color: AppColors.textInverse,
            fontSize: 10,
            letterSpacing: 0.6,
          )),
    );
  }
}

class _InfoCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.brandSoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.shield_outlined,
                    color: AppColors.brand, size: 16),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text('Secure payment with Google Play',
                    style: AppTypography.title.copyWith(fontSize: 13)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
              'UPI, cards, net-banking, and EMI supported. '
              'After payment, the course unlocks immediately under My Courses.',
              style: AppTypography.bodyMuted.copyWith(fontSize: 12, height: 1.4)),
        ],
      ),
    );
  }
}

class _BuyBar extends StatelessWidget {
  const _BuyBar({
    required this.price,
    required this.original,
    required this.buying,
    required this.disabled,
    required this.onBuy,
    required this.accent,
  });
  final int? price;
  final int? original;
  final bool buying;
  final bool disabled;
  final VoidCallback onBuy;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
        boxShadow: AppShadows.md,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('TOTAL',
                    style: AppTypography.uppercase
                        .copyWith(letterSpacing: 1)),
                const SizedBox(height: 2),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(price != null ? '₹$price' : '—',
                        style: AppTypography.h2.copyWith(fontSize: 22)),
                    if (original != null &&
                        price != null &&
                        original! > price!) ...[
                      const SizedBox(width: 8),
                      Text('₹$original',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.muted,
                            fontSize: 13,
                            decoration: TextDecoration.lineThrough,
                          )),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            height: 50,
            child: ElevatedButton(
              onPressed: (disabled || buying) ? null : onBuy,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.ink,
                foregroundColor: AppColors.textInverse,
                disabledBackgroundColor: AppColors.mute2,
                padding:
                    const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: buying
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.textInverse,
                      ),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Buy now',
                            style: AppTypography.title.copyWith(
                              color: AppColors.textInverse,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                            )),
                        const SizedBox(width: 6),
                        const Icon(Icons.lock_outline, size: 14),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotFound extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.search_off,
                size: 40, color: AppColors.mute2),
            const SizedBox(height: 8),
            Text('Course offering not found',
                style: AppTypography.title),
            const SizedBox(height: 4),
            Text('It may have been removed or sold out.',
                style: AppTypography.bodyMuted),
          ],
        ),
      ),
    );
  }
}
