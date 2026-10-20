import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../shared/widgets/shimmer_loading.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_typography.dart';

const _kDefaultSlides = <Map<String, dynamic>>[
  {
    'asset': 'assets/slides/batch-sept-2026-v2.webp',
    'alt': 'September 2026 batch is live',
    'href': '/academics',
  },
  {
    'asset': 'assets/slides/courses-now-in-app-v1.webp',
    'alt': 'Courses now in the app',
    'href': '/store',
  },
  {
    'asset': 'assets/slides/choose-your-course-v1.webp',
    'alt': 'Choose your course',
    'href': '/store',
  },
  {
    'asset': 'assets/slides/live-and-recorded-v1.webp',
    'alt': 'Live and recorded learning',
    'href': '/store',
  },
  {
    'asset': 'assets/slides/personal-teacher-v1.webp',
    'alt': 'Your pace. Your personal teacher.',
    'href': 'https://genziitian.in/one-to-one',
  },
  {
    'asset': 'assets/slides/study-resources-v1.webp',
    'alt': 'Your syllabus. Meet your study kit.',
    'href': '/free-resources',
  },
  {
    'asset': 'assets/slides/learning-community-v1.webp',
    'alt': 'Big syllabus. Better together.',
    'href': '/community',
  },
  {
    'asset': 'assets/slides/free-resources-v2.webp',
    'alt': 'Free notes and solved PYQs',
    'href': '/free-resources',
  },
  {
    'asset': 'assets/slides/premium-notes-v2.webp',
    'alt': 'Premium notes for IITM BS',
    'href': '/store/notes',
  },
  {
    'asset': 'assets/slides/community-support-v2.webp',
    'alt': 'Community and doubt support',
    'href': '/community',
  },
];

/// GET /api/admin/home-slides → [{id, image, alt, href, order}].
/// Falls back to built-in banner slides if server has no active custom slides.
final homeSlidesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/admin/home-slides');
    final list = res.data is List ? res.data as List : const [];
    if (list.isNotEmpty) {
      // Admin slides first, then the built-in launch banners so they always show.
      return [
        for (final j in list) j as Map<String, dynamic>,
        ..._kDefaultSlides.where((d) => (d['asset'] as String).contains('-v1.')),
      ];
    }
  } catch (_) {}

  return _kDefaultSlides;
});

/// PageView slider with auto-advance every 4.5s and dot indicator below.
/// Tapping a slide follows its `href` — internal paths (starting with `/`)
/// go through go_router, http(s) URLs open in the system browser.
class HomeSlider extends ConsumerStatefulWidget {
  const HomeSlider({super.key});
  @override
  ConsumerState<HomeSlider> createState() => _HomeSliderState();
}

class _HomeSliderState extends ConsumerState<HomeSlider> {
  final _controller = PageController(viewportFraction: 1.0);
  Timer? _timer;
  int _page = 0;
  int _timerCount = -1;

  void _restartTimer(int slideCount, {bool force = false}) {
    if (!force && _timerCount == slideCount && (_timer?.isActive ?? false)) return;
    _timerCount = slideCount;
    _timer?.cancel();
    if (slideCount <= 1) return;
    _timer = Timer.periodic(const Duration(milliseconds: 4500), (_) {
      if (!mounted || !_controller.hasClients) return;
      final next = (_page + 1) % slideCount;
      _controller.animateToPage(
        next,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _open(BuildContext context, String? href) async {
    if (href == null || href.isEmpty) return;
    if (href.startsWith('/')) {
      if (context.mounted) context.push(href);
      return;
    }
    final uri = Uri.tryParse(href);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(homeSlidesProvider);
    return async.when(
      loading: () => const SkeletonBox(height: 180, borderRadius: 22),
      error: (_, __) => const SizedBox.shrink(),
      data: (slides) {
        if (slides.isEmpty) return const SizedBox.shrink();
        _restartTimer(slides.length);
        return Column(
          children: [
            AspectRatio(
              aspectRatio: 2400 / 1140,
              child: Listener(
                // Pause auto-advance while the user is swiping, then resume.
                onPointerDown: (_) => _timer?.cancel(),
                onPointerUp: (_) => _restartTimer(slides.length, force: true),
                onPointerCancel: (_) => _restartTimer(slides.length, force: true),
                child: PageView.builder(
                controller: _controller,
                physics: const PageScrollPhysics(parent: BouncingScrollPhysics()),
                itemCount: slides.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) {
                  final s = slides[i];
                  var image = s['image'] as String?;
                  if (image != null && image.startsWith('/')) {
                    image = 'https://class.genziitian.in$image';
                  }
                  final asset = s['asset'] as String?;
                  final alt = (s['alt'] as String?) ?? '';
                  final href = s['href'] as String?;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: BouncyPressable(
                      onTap: () => _open(context, href),
                      scaleDown: 0.98,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          decoration: const BoxDecoration(
                            color: AppColors.brand,
                          ),
                          child: asset != null
                              ? Image.asset(
                                  asset,
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                  height: double.infinity,
                                  errorBuilder: (_, __, ___) =>
                                      _Placeholder(label: alt),
                                )
                              : (image == null
                                  ? _Placeholder(label: alt)
                                  : CachedNetworkImage(
                                      imageUrl: image,
                                      fit: BoxFit.cover,
                                      width: double.infinity,
                                      height: double.infinity,
                                      placeholder: (_, __) =>
                                          const SkeletonBox(borderRadius: 22),
                                      errorWidget: (_, __, ___) =>
                                          _Placeholder(label: alt),
                                    )),
                        ),
                      ),
                    ),
                  );
                },
              ),
              ),
            ),
            if (slides.length > 1) ...[
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(slides.length, (i) {
                  final active = i == _page;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: active ? AppColors.ink2 : AppColors.line2,
                      borderRadius: BorderRadius.circular(3.5),
                    ),
                  );
                }),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.brand, Color(0xFF5E5CE6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
      ),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(16),
      child: Text(
        label.isEmpty ? 'Gen-Z IITian' : label,
        textAlign: TextAlign.center,
        style: AppTypography.h2.copyWith(
          color: AppColors.textInverse,
          fontSize: 18,
        ),
      ),
    );
  }
}
