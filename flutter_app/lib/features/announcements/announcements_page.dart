import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/utils/cta_navigation.dart';

const _kCachedAnnouncementsKey = 'cached_announcements_payload';

/// GET /api/announcements → list of announcements.
final announcementsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/announcements');
    final list = res.data is List ? res.data as List : const [];
    if (list.isNotEmpty) {
      SharedPreferences.getInstance().then((prefs) {
        prefs.setString(_kCachedAnnouncementsKey, jsonEncode(list));
      }).catchError((_) {});
    }
    return [for (final j in list) j as Map<String, dynamic>];
  } catch (err) {
    if (err is DioException) {
      final statusCode = err.response?.statusCode;
      final errMsg = (err.message ?? '').toLowerCase();
      if (statusCode == 401 ||
          statusCode == 403 ||
          errMsg.contains('not authenticated') ||
          errMsg.contains('unauthorized')) {
        Future.microtask(() => ref.read(authStateProvider.notifier).signOut());
        return const [];
      }
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedStr = prefs.getString(_kCachedAnnouncementsKey);
      if (cachedStr != null && cachedStr.isNotEmpty) {
        final list = jsonDecode(cachedStr) as List;
        return [for (final j in list) j as Map<String, dynamic>];
      }
    } catch (_) {}
    return const [];
  }
});

class AnnouncementsPage extends ConsumerWidget {
  const AnnouncementsPage({super.key});

  String _rel(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(announcementsProvider);
    final tokens = context.tokens;
    return AppPageScaffold(
      title: 'Announcements',
      subtitle: 'Latest news & updates',
      showBack: true,
      body: AppRefresh(
        onRefresh: () async => ref.invalidate(announcementsProvider),
        child: async.when(
          loading: () => Center(
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: tokens.primaryAccent,
            ),
          ),
          error: (e, _) => ListView(
            padding: const EdgeInsets.all(40),
            children: [
              Icon(Icons.cloud_off, color: tokens.textMuted, size: 40),
              const SizedBox(height: 8),
              Text(
                'Could not load announcements',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: tokens.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              Text(
                e.toString(),
                style: TextStyle(
                  fontSize: 13,
                  color: tokens.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
          data: (list) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(0, 16, 0, 24),
            children: [
              if (list.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(40),
                  child: Column(
                    children: [
                      Icon(Icons.campaign_outlined,
                          color: tokens.textMuted, size: 40),
                      const SizedBox(height: 8),
                      Text(
                        'Nothing announced yet',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: tokens.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'The team will post updates here.',
                        style: TextStyle(
                          fontSize: 13,
                          color: tokens.textSecondary,
                        ),
                      ),
                    ],
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    children: [
                      for (final a in list) ...[
                        _AnnouncementCard(
                          a: a,
                          rel: _rel(a['createdAt'] as String?),
                        ),
                        const SizedBox(height: 12),
                      ],
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

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({required this.a, required this.rel});
  final Map<String, dynamic> a;
  final String rel;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = (a['title'] as String?) ?? 'Announcement';
    final rawMessage = (a['content'] ?? a['message'])?.toString() ?? '';
    final metadataPattern = RegExp(
      r'<!-- fcm_meta:({.*?}) -->$',
      dotAll: true,
    );
    final metadataMatch = metadataPattern.firstMatch(rawMessage);
    Map<String, dynamic> metadata = const {};
    if (metadataMatch != null) {
      try {
        final decoded = jsonDecode(metadataMatch.group(1)!);
        if (decoded is Map) metadata = Map<String, dynamic>.from(decoded);
      } catch (_) {
        // A malformed legacy metadata block must not hide the announcement.
      }
    }
    final message = rawMessage.replaceFirst(metadataPattern, '').trim();
    final ctaText = (metadata['ctaText'] ?? a['ctaText'])?.toString().trim();
    final ctaLink = (metadata['ctaLink'] ?? a['ctaLink'])?.toString().trim();
    final hasCta = ctaText != null &&
        ctaText.isNotEmpty &&
        ctaLink != null &&
        ctaLink.isNotEmpty;
    final course = a['course'] as Map<String, dynamic>?;
    final author = (a['createdBy'] as Map?)?['name'] as String?;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
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
                  color: tokens.primaryAccent.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child:
                    Icon(Icons.campaign, color: tokens.primaryAccent, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
              ),
              Text(
                rel,
                style: TextStyle(
                  fontSize: 10.5,
                  color: tokens.textSecondary,
                ),
              ),
            ],
          ),
          if (message.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              message,
              style: TextStyle(
                fontSize: 12.5,
                height: 1.45,
                color: tokens.textSecondary,
              ),
            ),
          ],
          if (course != null || author != null) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                if (course != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: tokens.primaryAccent.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      (course['name'] as String?)?.toUpperCase() ?? '',
                      style: TextStyle(
                        color: tokens.primaryAccent,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                if (author != null)
                  Text(
                    '— $author',
                    style: TextStyle(
                      fontSize: 11,
                      color: tokens.textSecondary,
                    ),
                  ),
              ],
            ),
          ],
          if (hasCta) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                onPressed: () => openCtaLink(context, ctaLink),
                style: FilledButton.styleFrom(
                  backgroundColor: tokens.primaryAccent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                iconAlignment: IconAlignment.end,
                icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                label: Text(
                  ctaText,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
