import 'package:material_ui/material_ui.dart';

import '../../theme/app_theme_tokens.dart';

/// Shimmer loading sweep matching Capacitor / Web UI's skeleton effect
/// (`@keyframes skeleton-loading 1.5s infinite`).
class ShimmerLoading extends StatefulWidget {
  const ShimmerLoading({
    super.key,
    required this.child,
    this.baseColor,
    this.highlightColor,
  });

  final Widget child;
  final Color? baseColor;
  final Color? highlightColor;

  @override
  State<ShimmerLoading> createState() => _ShimmerLoadingState();
}

class _ShimmerLoadingState extends State<ShimmerLoading>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isBlack = tokens.isBlack;
    final base = widget.baseColor ??
        (isBlack
            ? const Color(0xFF141414)
            : (isDark ? const Color(0xFF1E2442) : const Color(0xFFE8EAF0)));
    final highlight = widget.highlightColor ??
        (isBlack
            ? const Color(0xFF27272A)
            : (isDark ? const Color(0xFF2C345C) : const Color(0xFFF6F7FB)));

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: const Alignment(-1.0, -0.3),
              end: const Alignment(1.0, 0.3),
              colors: [base, highlight, base],
              stops: const [0.1, 0.5, 0.9],
              transform: _SlidingGradientTransform(slidePercent: _controller.value),
            ).createShader(bounds);
          },
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

class _SlidingGradientTransform extends GradientTransform {
  const _SlidingGradientTransform({required this.slidePercent});
  final double slidePercent;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(bounds.width * (slidePercent * 2 - 1), 0.0, 0.0);
  }
}

/// A convenient skeleton placeholder box with rounded corners and smooth shimmer.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height,
    this.borderRadius = 12,
  });

  final double? width;
  final double? height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isBlack = tokens.isBlack;
    final bg = isBlack
        ? const Color(0xFF141414)
        : (isDark ? const Color(0xFF1E2442) : const Color(0xFFE8EAF0));

    return ShimmerLoading(
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}


/// Page-level loading state: "Please wait, loading…" over skeleton cards.
/// Use this instead of a bare spinner whenever a whole screen is loading.
class PageLoading extends StatelessWidget {
  const PageLoading({super.key, this.rows = 3, this.message = 'Please wait, loading…'});
  final int rows;
  final String message;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                message,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: tokens.textSecondary,
                ),
              ),
            ),
          ),
          for (var i = 0; i < rows; i++) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: tokens.cardBg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: tokens.border, width: 0.5),
              ),
              child: const Row(
                children: [
                  SkeletonBox(width: 52, height: 52, borderRadius: 14),
                  SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBox(height: 14, borderRadius: 7),
                        SizedBox(height: 10),
                        SkeletonBox(width: 150, height: 11, borderRadius: 6),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (i < rows - 1) const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}
