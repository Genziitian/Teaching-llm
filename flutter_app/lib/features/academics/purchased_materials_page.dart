import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import 'free_resources_page.dart' show purchasedMaterialsProvider;

/// Simple list view of purchased note packs.
class PurchasedMaterialsPage extends ConsumerWidget {
  const PurchasedMaterialsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(purchasedMaterialsProvider);
    final tokens = context.tokens;

    return Scaffold(
      backgroundColor: tokens.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const SubPageHeader(
              title: 'Purchased Materials',
              subtitle: 'Available for 90 days from purchase',
            ),
            const SizedBox(height: 12),
            Expanded(
              child: AppRefresh(
                onRefresh: () async =>
                    ref.invalidate(purchasedMaterialsProvider),
                child: async.when(
                  loading: () => Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: tokens.primaryAccent,
                    ),
                  ),
                  error: (e, _) => Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        "Couldn't load purchases\n$e",
                        textAlign: TextAlign.center,
                        style: TextStyle(color: tokens.textSecondary),
                      ),
                    ),
                  ),
                  data: (list) {
                    if (list.isEmpty) {
                      return _Empty();
                    }
                    return ListView.separated(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                      itemCount: list.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: 10),
                      itemBuilder: (_, i) {
                        final raw = list[i];
                        final m = raw is Map
                            ? Map<String, dynamic>.from(raw)
                            : <String, dynamic>{};
                        return _PurchaseRow(item: m);
                      },
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shopping_bag_outlined,
                color: tokens.textMuted, size: 36),
            const SizedBox(height: 10),
            Text(
              'Nothing purchased yet',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Purchased note packs appear here. Browse the Store to add one.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: tokens.textSecondary,
              ),
            ),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: () => context.push('/store'),
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 28),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: tokens.primaryAccent,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: const Text(
                  'Visit store',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PurchaseRow extends StatelessWidget {
  const _PurchaseRow({required this.item});
  final Map<String, dynamic> item;

  Future<void> _open(BuildContext context) async {
    final id = item['id'] as String?;
    final title = (item['title'] as String?) ?? 'Purchased Material';
    final url = item['fileUrl'] as String?;

    if (id != null && id.isNotEmpty) {
      final uri = Uri(
        path: '/material',
        queryParameters: {
          'contentId': id,
          'title': title,
          'contentType': 'MATERIAL',
          'courseName': 'Purchased Materials',
        },
      );
      context.push(uri.toString());
      return;
    }

    if (url == null || url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No file attached to this purchase.')),
      );
      return;
    }
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Couldn't open this file.")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = (item['title'] as String?) ?? 'Untitled';
    final purchasedAt = item['purchasedAt'] as String?;
    final description = (item['description'] as String?)?.trim();

    return Material(
      color: tokens.cardBg,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: () => _open(context),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: tokens.border),
            boxShadow: AppShadows.sm,
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: tokens.warning.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.description_outlined,
                    color: tokens.warning, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: tokens.textPrimary,
                      ),
                    ),
                    if (description != null && description.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11,
                          color: tokens.textSecondary,
                        ),
                      ),
                    ],
                    if (purchasedAt != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        _formatDate(purchasedAt),
                        style: TextStyle(
                          color: tokens.textMuted,
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: tokens.textMuted),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return 'Purchased ${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  }
}
