import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/apple_pressable.dart' show kEaseOutStrong;
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/utils/cta_navigation.dart';

import '../../shared/widgets/app_topbar.dart' show unreadProvider;
import '../../shared/widgets/sub_page_header.dart';

/// GET /api/notifications → list of recent notifications + announcements for the user.
final notificationsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final List<Map<String, dynamic>> result = [];

  try {
    final res = await api.get<dynamic>('/api/notifications');
    final list = (res.data is List) ? res.data as List : const [];
    for (final j in list) {
      if (j is Map<String, dynamic>) result.add(j);
    }
  } catch (_) {}

  // If direct notifications are empty, load announcements so the screen is active
  if (result.isEmpty) {
    try {
      final res = await api.get<dynamic>('/api/announcements');
      final list = (res.data is List) ? res.data as List : const [];
      for (final j in list) {
        if (j is Map<String, dynamic>) {
          result.add({
            'id': j['id'],
            'title': j['title'] ?? 'Announcement',
            'content': j['content'] ?? '',
            'type': 'ANNOUNCEMENT',
            'createdAt': j['createdAt'],
          });
        }
      }
    } catch (_) {}
  }

  return result;
});

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  @override
  void initState() {
    super.initState();
    // Mark announcements as seen and clear the badge
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final api = ref.read(apiClientProvider);
        await api.post('/api/users/seen', body: {'type': 'announcements'});
        ref.invalidate(unreadProvider);
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(notificationsProvider);
    final tokens = context.tokens;

    return AppPageScaffold(
      title: 'Notifications',
      subtitle: 'Recent alerts & updates',
      showBack: true,
      onBack: () =>
          context.canPop() ? context.pop() : context.go('/more'),
      body: AppRefresh(
        onRefresh: () async {
          ref.invalidate(notificationsProvider);
          ref.invalidate(unreadProvider);
        },
        child: async.when(
          loading: () => Center(
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: tokens.primaryAccent,
            ),
          ),
          error: (e, _) => _Error(message: e.toString()),
          data: (list) {
            if (list.isEmpty) return const _Empty();
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _NotificationTile(n: list[i]),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationTile extends StatefulWidget {
  const _NotificationTile({required this.n});
  final Map<String, dynamic> n;

  @override
  State<_NotificationTile> createState() => _NotificationTileState();
}

class _NotificationTileState extends State<_NotificationTile> {
  bool _expanded = false;

  Map<String, dynamic> get n => widget.n;

  String _rel(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return '${months[dt.month - 1]} ${dt.day}';
  }

  IconData _icon(String? type) {
    switch (type) {
      case 'COURSE':
      case 'LECTURE':
        return Symbols.menu_book_rounded;
      case 'LIVE':
      case 'SESSION':
        return Symbols.live_tv_rounded;
      case 'ANNOUNCEMENT':
        return Symbols.campaign_rounded;
      case 'PAYMENT':
        return Symbols.payments_rounded;
      default:
        return Symbols.notifications_rounded;
    }
  }

  bool _overflows(String text, TextStyle style, double width, int maxLines) {
    if (text.isEmpty || width <= 0) return false;
    final tp = TextPainter(
      text: TextSpan(text: text, style: style),
      maxLines: maxLines,
      textDirection: TextDirection.ltr,
      textScaler: MediaQuery.textScalerOf(context),
    )..layout(maxWidth: width);
    final over = tp.didExceedMaxLines;
    tp.dispose();
    return over;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = (n['title'] as String?) ?? 'Notification';
    final message = (n['content'] ?? n['message'])?.toString() ?? '';
    final ctaText = n['ctaText']?.toString().trim();
    final ctaLink = n['ctaLink']?.toString().trim();
    final hasCta = ctaText != null &&
        ctaText.isNotEmpty &&
        ctaLink != null &&
        ctaLink.isNotEmpty;
    final isRead = (n['isRead'] as bool?) ?? false;
    final type = n['type'] as String?;
    final created = n['createdAt'] as String?;

    final titleStyle = TextStyle(
      fontSize: 15,
      letterSpacing: -0.2,
      fontWeight: isRead ? FontWeight.w600 : FontWeight.w700,
      color: isRead ? tokens.textSecondary : tokens.textPrimary,
    );
    final bodyStyle = TextStyle(
      fontSize: 14,
      height: 1.4,
      color: tokens.textSecondary,
    );
    final accent = tokens.primaryAccent;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isRead ? accent.withValues(alpha: 0.12) : accent,
              borderRadius: BorderRadius.circular(11),
            ),
            alignment: Alignment.center,
            child: Icon(
              _icon(type),
              color: isRead ? accent : Colors.white,
              size: 22,
              fill: 1,
              weight: 500,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LayoutBuilder(
                  builder: (context, c) {
                    final canExpand =
                        _overflows(title, titleStyle, c.maxWidth - 64, 1) ||
                            _overflows(message, bodyStyle, c.maxWidth, 3);
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: canExpand
                          ? () => setState(() => _expanded = !_expanded)
                          : null,
                      child: AnimatedSize(
                        duration: const Duration(milliseconds: 220),
                        curve: kEaseOutStrong,
                        alignment: Alignment.topCenter,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    title,
                                    maxLines: _expanded ? null : 1,
                                    overflow: _expanded
                                        ? TextOverflow.visible
                                        : TextOverflow.ellipsis,
                                    style: titleStyle,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(
                                    _rel(created),
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: tokens.textMuted,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (message.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                message,
                                maxLines: _expanded ? null : 3,
                                overflow: _expanded
                                    ? TextOverflow.visible
                                    : TextOverflow.ellipsis,
                                style: bodyStyle,
                              ),
                            ],
                            if (canExpand) ...[
                              const SizedBox(height: 6),
                              Text(
                                _expanded ? 'See less' : 'See more',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: accent,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
                if (hasCta) ...[
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: FilledButton.icon(
                      onPressed: () => openCtaLink(context, ctaLink),
                      style: FilledButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 9,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      iconAlignment: IconAlignment.end,
                      icon: const Icon(Symbols.arrow_forward_rounded,
                          size: 16, weight: 600),
                      label: Text(
                        ctaText,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ListView(
      padding: const EdgeInsets.all(40),
      children: [
        Icon(Symbols.notifications_rounded,
            color: tokens.textMuted, size: 40),
        const SizedBox(height: 8),
        Text(
          'No notifications yet',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: tokens.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          "You're all caught up.",
          style: TextStyle(
            fontSize: 13,
            color: tokens.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ListView(
      padding: const EdgeInsets.all(40),
      children: [
        Icon(Symbols.cloud_off_rounded, color: tokens.textMuted, size: 40),
        const SizedBox(height: 8),
        Text(
          'Could not load notifications',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: tokens.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          message,
          style: TextStyle(
            fontSize: 13,
            color: tokens.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
