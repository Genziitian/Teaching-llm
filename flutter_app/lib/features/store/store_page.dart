import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';

// Public courses catalog — hosted on the Next.js site.
const _courseStoreUrl = 'https://genziitian.in/courses';

Future<void> _openCourseStore(BuildContext context) async {
  final ok = await launchUrl(
    Uri.parse(_courseStoreUrl),
    mode: LaunchMode.externalApplication,
  );
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Couldn't open the courses page.")),
    );
  }
}

/// Store page — header, support row, 2×2 product grid.
class StorePage extends ConsumerWidget {
  const StorePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final products = [
      _Product(
        id: 'courses',
        title: 'Courses',
        count: '3 available',
        icon: Icons.menu_book_outlined,
        gradient: [const Color(0xFF6366F1), tokens.primaryAccent],
      ),
      _Product(
        id: 'notes',
        title: 'Premium Notes',
        count: '1 note',
        icon: Icons.description_outlined,
        gradient: [const Color(0xFF34D399), tokens.success],
      ),
      const _Product(
        id: 'mentor',
        title: 'Book a Mentor Call',
        count: '2 mentors',
        icon: Icons.headset_mic_outlined,
        gradient: [Color(0xFFFB923C), Color(0xFFF97316)],
      ),
    ];

    return AppPageScaffold(
      title: 'Official Store',
      subtitle: 'GenZ IITian courses & resources',
      showBack: true,
      onBack: () {
        HapticFeedback.lightImpact();
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/academics');
        }
      },
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          Row(
            children: [
              Flexible(
                child: Text(
                  'You can also buy courses from',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    color: tokens.textSecondary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () => _openCourseStore(context),
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: tokens.primaryAccent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Visit Here',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(width: 4),
                      Icon(Icons.arrow_forward,
                          color: Colors.white, size: 11),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _SupportCard(
            onTap: () => context.go('/faq'),
          ),
          const SizedBox(height: 20),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: products.length,
            gridDelegate:
                const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 14,
              crossAxisSpacing: 14,
              childAspectRatio: 0.92,
            ),
            itemBuilder: (_, i) =>
                _ProductCard(product: products[i]),
          ),
        ],
      ),
    );
  }
}

class _Product {
  const _Product({
    required this.id,
    required this.title,
    required this.count,
    required this.icon,
    required this.gradient,
  });
  final String id;
  final String title;
  final String count;
  final IconData icon;
  final List<Color> gradient;
}

class _SupportCard extends StatelessWidget {
  const _SupportCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: tokens.cardBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: tokens.border),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: tokens.surfaceSecondary,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: tokens.border),
                ),
                child: Icon(Icons.help_outline,
                    color: tokens.primaryAccent, size: 16),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Facing any issue? Get Support',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
              ),
              Icon(Icons.chevron_right,
                  color: tokens.textMuted, size: 14),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});
  final _Product product;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () {
        if (product.id == 'courses') {
          _openCourseStore(context);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${product.title} — coming soon')),
          );
        }
      },
      child: Container(
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: tokens.border),
          boxShadow: AppShadows.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: product.gradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: AppShadows.pillGlow(product.gradient.first),
              ),
              child: Icon(product.icon,
                  color: Colors.white, size: 26),
            ),
            const SizedBox(height: 14),
            Text(
              product.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: tokens.textPrimary,
                letterSpacing: -0.4,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              product.count,
              style: TextStyle(
                fontSize: 11.5,
                color: tokens.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Spacer(),
            Row(
              children: [
                Text(
                  'Explore',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: tokens.primaryAccent,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 4),
                Icon(Icons.chevron_right,
                    color: tokens.primaryAccent, size: 14),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// _BundleBanner removed — the hard-coded "Degree Programme Bundle · save
// ₹4,200" featured banner is gone. Reintroduce when there's a real bundle
// offering tied to a SKU, not a fake countdown.
