import 'package:flutter/material.dart';

import '../../core/facts/loading_facts_data.dart';
import '../../theme/app_theme_tokens.dart';

class LoadingFactCard extends StatelessWidget {
  const LoadingFactCard({
    super.key,
    required this.fact,
    this.maxWidth = 460,
    this.margin = EdgeInsets.zero,
  });

  final LoadingFact? fact;
  final double maxWidth;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final currentFact = fact;
    if (currentFact == null) {
      return const SizedBox.shrink();
    }

    final tokens = context.tokens;
    final isDark = tokens.isDark;
    final isBlack = tokens.isBlack;
    final isRare = currentFact.rarity == LoadingFactRarity.rare;
    final isUltraRare = currentFact.rarity == LoadingFactRarity.ultraRare;
    final isCoupon = currentFact.isCoupon;

    // Background and border colors ensuring high contrast across Light, Dark & Black modes
    final Color bgColor = isBlack
        ? const Color(0xFF0D0D0D)
        : (isDark
            ? const Color(0xFF161A23)
            : Colors.white);

    final Color borderColor = isUltraRare
        ? const Color(0xFFF59E0B)
        : isRare
            ? (isBlack ? const Color(0xFF71717A) : const Color(0xFF6366F1))
            : (isBlack
                ? const Color(0xFF27272A)
                : (isDark ? const Color(0xFF2A3143) : const Color(0xFFE2E8F0)));

    final Color textColor = tokens.textPrimary;

    return LayoutBuilder(
      builder: (context, constraints) {
        final screenWidth = MediaQuery.of(context).size.width;
        final isCompact = screenWidth < 420;

        return Padding(
          padding: margin,
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: maxWidth,
                minWidth: 260,
              ),
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: isCompact ? 14 : 18,
                  vertical: isCompact ? 12 : 14,
                ),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: borderColor,
                    width: (isRare || isUltraRare) ? 1.5 : 1.0,
                  ),
                  boxShadow: [
                    if (isUltraRare)
                      BoxShadow(
                        color: const Color(0xFFF59E0B).withOpacity(isDark ? 0.25 : 0.2),
                        blurRadius: 18,
                        offset: const Offset(0, 4),
                      )
                    else if (isRare)
                      BoxShadow(
                        color: const Color(0xFF6366F1).withOpacity(isDark ? 0.22 : 0.16),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      )
                    else
                      BoxShadow(
                        color: Colors.black.withOpacity(isDark ? 0.25 : 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Badge: Display for Rare and Ultra Rare, never for Common
                    if (isUltraRare) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFEF4444), Color(0xFFF59E0B)],
                          ),
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFEF4444).withOpacity(0.35),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Text(
                          isCoupon ? 'ULTRA RARE 💎' : 'ULTRA RARE 🔥',
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ] else if (isRare) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                          ),
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF4F46E5).withOpacity(0.3),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Text(
                          'RARE ✨',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Fact Text
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: 'Fact : ',
                            style: TextStyle(
                              fontSize: isCompact ? 12.5 : 13.5,
                              fontWeight: FontWeight.w700,
                              color: isUltraRare
                                  ? const Color(0xFFEF4444)
                                  : isRare
                                      ? const Color(0xFF6366F1)
                                      : textColor,
                            ),
                          ),
                          TextSpan(
                            text: currentFact.text,
                            style: TextStyle(
                              fontSize: isCompact ? 12.5 : 13.5,
                              fontWeight: isUltraRare ? FontWeight.w600 : FontWeight.w500,
                              color: textColor,
                            ),
                          ),
                        ],
                      ),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
