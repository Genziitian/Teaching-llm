import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/app_theme_tokens.dart';
import 'app_tour_controller.dart';
import 'flutter_tour_steps.dart';
import 'tour_target_registry.dart';

class AppTourOverlayWrapper extends ConsumerWidget {
  const AppTourOverlayWrapper({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tourState = ref.watch(appTourControllerProvider);
    final notifier = ref.read(appTourControllerProvider.notifier);

    return Stack(
      children: [
        child,
        if (tourState.isActive)
          _AppTourOverlayView(
            tourState: tourState,
            notifier: notifier,
          ),
      ],
    );
  }
}

class _AppTourOverlayView extends StatefulWidget {
  const _AppTourOverlayView({
    required this.tourState,
    required this.notifier,
  });

  final AppTourState tourState;
  final AppTourNotifier notifier;

  @override
  State<_AppTourOverlayView> createState() => _AppTourOverlayViewState();
}

class _AppTourOverlayViewState extends State<_AppTourOverlayView> {
  Rect? _targetBounds;

  @override
  void initState() {
    super.initState();
    _updateTargetBounds();
  }

  @override
  void didUpdateWidget(covariant _AppTourOverlayView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tourState.currentIndex != widget.tourState.currentIndex) {
      _updateTargetBounds();
    }
  }

  void _updateTargetBounds() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final step = widget.tourState.currentStep;
      if (step != null) {
        final bounds =
            TourTargetRegistry.instance.getTargetBounds(step.targetId);
        setState(() {
          _targetBounds = bounds;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final step = widget.tourState.currentStep;
    if (step == null) return const SizedBox.shrink();

    final tokens = context.tokens;
    final size = MediaQuery.of(context).size;
    final padding = MediaQuery.of(context).padding;
    final isLast =
        widget.tourState.currentIndex == flutterTourSteps.length - 1;

    final targetRect = _targetBounds ??
        Rect.fromLTWH(
            size.width / 2 - 40, size.height / 2 - 40, 80, 80);

    // Calculate tooltip vertical position
    final isTargetNearBottom = targetRect.bottom > size.height - 200;
    final tooltipTop = isTargetNearBottom
        ? (targetRect.top - 195).clamp(padding.top + 16, size.height - 220)
        : (targetRect.bottom + 16).clamp(padding.top + 16, size.height - 220);

    return Material(
      type: MaterialType.transparency,
      child: Stack(
        children: [
          // Spotlight Dimming Backdrop
          Positioned.fill(
            child: CustomPaint(
              painter: _SpotlightPainter(targetBounds: targetRect),
            ),
          ),

          // Glowing Target Highlight Outline
          Positioned(
            left: targetRect.left - 4,
            top: targetRect.top - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: tokens.primaryAccent, width: 2.5),
                boxShadow: [
                  BoxShadow(
                    color: tokens.primaryAccent.withOpacity(0.4),
                    blurRadius: 16,
                    spreadRadius: 2,
                  ),
                ],
              ),
            ),
          ),

          // Tooltip Card
          AnimatedPositioned(
            duration: const Duration(milliseconds: 260),
            curve: Curves.fastOutSlowIn,
            top: tooltipTop,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: tokens.cardBg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: tokens.border),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x33000000),
                    offset: Offset(0, 12),
                    blurRadius: 30,
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        step.title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: tokens.textPrimary,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: tokens.primaryAccent.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '${widget.tourState.currentIndex + 1} of ${flutterTourSteps.length}',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: tokens.primaryAccent,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    step.content,
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.45,
                      color: tokens.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton(
                        onPressed: widget.notifier.requestSkip,
                        child: Text(
                          'Skip Tour',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: tokens.textMuted,
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          if (widget.tourState.currentIndex > 0)
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: OutlinedButton(
                                onPressed: widget.notifier.previousStep,
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: tokens.textPrimary,
                                  side: BorderSide(color: tokens.border),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                child: const Text('Back'),
                              ),
                            ),
                          ElevatedButton(
                            onPressed: isLast
                                ? widget.notifier.finishTour
                                : widget.notifier.nextStep,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: tokens.primaryAccent,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            child: Text(
                              isLast ? 'Finish' : 'Next',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Skip Confirmation Dialog
          if (widget.tourState.showSkipModal)
            Container(
              color: Colors.black.withOpacity(0.65),
              alignment: Alignment.center,
              padding: const EdgeInsets.all(24),
              child: Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: tokens.cardBg,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x40000000),
                      blurRadius: 24,
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.help_outline_rounded,
                      size: 44,
                      color: tokens.primaryAccent,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Skip App Tour?',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: tokens.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'You can replay the tour anytime from More → Settings.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13.5,
                        height: 1.4,
                        color: tokens.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: widget.notifier.cancelSkip,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: tokens.textPrimary,
                              side: BorderSide(color: tokens.border),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text('Continue Tour'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: widget.notifier.confirmSkip,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: tokens.primaryAccent,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Skip Tour',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SpotlightPainter extends CustomPainter {
  _SpotlightPainter({required this.targetBounds});

  final Rect targetBounds;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xB8000000);

    final backgroundPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));

    final cutoutRect = Rect.fromLTRB(
      targetBounds.left - 6,
      targetBounds.top - 6,
      targetBounds.right + 6,
      targetBounds.bottom + 6,
    );

    final cutoutPath = Path()
      ..addRRect(RRect.fromRectAndRadius(cutoutRect, const Radius.circular(14)));

    final spotlightPath = Path.combine(
      PathOperation.difference,
      backgroundPath,
      cutoutPath,
    );

    canvas.drawPath(spotlightPath, paint);
  }

  @override
  bool shouldRepaint(covariant _SpotlightPainter oldDelegate) {
    return oldDelegate.targetBounds != targetBounds;
  }
}
