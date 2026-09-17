import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/models/course_event.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/section_head.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';

/// Same normalisation as `src/lib/meet-link.ts` on the backend. Teachers
/// sometimes paste Meet URLs with a `class.genziitian.in/` prefix that
/// makes the browser interpret the href as relative; this strips that off
/// and ensures we hand `launchUrl` a real absolute URL.
String? _normalizeMeetLink(String? raw) {
  if (raw == null) return null;
  var s = raw.trim();
  if (s.isEmpty) return null;
  final prefix = RegExp(
    r'^(?:https?:\/\/)?(?:www\.)?(?:class\.)?genziitian\.in\/+',
    caseSensitive: false,
  );
  while (prefix.hasMatch(s)) {
    s = s.replaceFirst(prefix, '');
  }
  s = s.trim();
  if (s.isEmpty) return null;
  if (!RegExp(r'^https?:\/\/', caseSensitive: false).hasMatch(s)) {
    if (!s.contains('.')) return null;
    s = 'https://$s';
  }
  return Uri.tryParse(s) == null ? null : s;
}

Future<void> _joinSession(BuildContext context, CourseEvent event) async {
  final link = _normalizeMeetLink(event.meetLink);
  if (link == null) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content:
                Text('No meeting link yet — check back closer to start time.')),
      );
    }
    return;
  }
  final ok =
      await launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Couldn't open the meeting link.")),
    );
  }
}

const _kCachedLiveSessionsKey = 'cached_live_sessions_payload';

final liveSessionsProvider = FutureProvider<List<CourseEvent>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/live-sessions');
    final list = res.data is List ? res.data as List : <dynamic>[];
    if (list.isNotEmpty) {
      SharedPreferences.getInstance().then((prefs) {
        prefs.setString(_kCachedLiveSessionsKey, jsonEncode(list));
      }).catchError((_) {});
    }
    return [
      for (final j in list) CourseEvent.fromJson(j as Map<String, dynamic>)
    ];
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
      final cachedStr = prefs.getString(_kCachedLiveSessionsKey);
      if (cachedStr != null && cachedStr.isNotEmpty) {
        final list = jsonDecode(cachedStr) as List;
        return [
          for (final j in list) CourseEvent.fromJson(j as Map<String, dynamic>)
        ];
      }
    } catch (_) {}
    return const [];
  }
});

/// Redesigned Live Sessions sub-page.
class LiveSessionsPage extends ConsumerStatefulWidget {
  const LiveSessionsPage({super.key});
  @override
  ConsumerState<LiveSessionsPage> createState() => _LiveSessionsPageState();
}

class _LiveSessionsPageState extends ConsumerState<LiveSessionsPage> {
  int _tab = 0;
  bool _syncing = false;

  Future<void> _syncLiveSessions() async {
    if (_syncing) return;
    setState(() => _syncing = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post<dynamic>('/api/live-sessions/sync');
      if (mounted) {
        ref.invalidate(liveSessionsProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Live sessions synced successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sync failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessions = ref.watch(liveSessionsProvider);
    final tokens = context.tokens;
    final user = ref.watch(authStateProvider).value;
    final isManagerOrAdmin = user?.isManager == true || user?.isAdmin == true;

    return AppPageScaffold(
      title: 'Live Sessions',
      subtitle: 'Join classes & rewatch recordings',
      showBack: true,
      right: isManagerOrAdmin
          ? (_syncing
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: tokens.primaryAccent,
                  ),
                )
              : CircleIconBtn(
                  icon: Icons.sync,
                  onTap: _syncLiveSessions,
                ))
          : null,
      body: AppRefresh(
        onRefresh: () async => ref.invalidate(liveSessionsProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(0, 16, 0, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            sessions.when(
              loading: () => Padding(
                padding: const EdgeInsets.symmetric(vertical: 60),
                child: Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: tokens.primaryAccent,
                  ),
                ),
              ),
              error: (e, _) => Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                child: Column(
                  children: [
                    Icon(Icons.cloud_off, color: tokens.textMuted, size: 40),
                    const SizedBox(height: 8),
                    Text(
                      'Could not load sessions',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: tokens.textPrimary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 4),
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
              ),
              data: (all) => _Body(
                all: all,
                tab: _tab,
                onTab: (v) => setState(() => _tab = v),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.all, required this.tab, required this.onTab});
  final List<CourseEvent> all;
  final int tab;
  final ValueChanged<int> onTab;

  @override
  Widget build(BuildContext context) {
    final live = all.where((e) => e.isLive).toList();
    final upcoming = all.where((e) => e.isUpcoming).toList()
      ..sort((a, b) => a.startTime.compareTo(b.startTime));
    final recorded = all.where((e) => !e.isLive && !e.isUpcoming).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Tabs(
            entries: [
              ('Live', live.length),
              ('Upcoming', upcoming.length),
              ('Past', recorded.length),
            ],
            selected: tab,
            onTap: onTab,
          ),
          if (tab == 0) ...[
            if (live.isNotEmpty) ...[
              SectionHead(
                title: 'Live now',
                subtitle:
                    '${live.length} ${live.length == 1 ? 'session is' : 'sessions are'} happening',
              ),
              const SizedBox(height: 14),
              for (final event in live) ...[
                _LiveCard(event: event),
                const SizedBox(height: 14),
              ],
            ] else
              const _Empty(
                title: 'No live sessions',
                sub: 'When a class starts, it will appear here.',
              ),
          ],
          if (tab == 1) ...[
            if (upcoming.isEmpty)
              const _Empty(
                  title: 'Nothing coming up',
                  sub: 'Upcoming classes will appear here.')
            else
              Column(
                children: [
                  for (var i = 0; i < upcoming.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(top: 14),
                      child: _UpcomingRow(event: upcoming[i], slotIndex: i),
                    ),
                ],
              ),
          ],
          if (tab == 2) ...[
            if (recorded.isEmpty)
              const _Empty(
                  title: 'No past sessions',
                  sub: 'Past classes that have ended will appear here.')
            else
              SizedBox(
                height: 200,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(top: 14),
                  itemCount: recorded.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (_, i) => _RecordingCard(event: recorded[i]),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({
    required this.entries,
    required this.selected,
    required this.onTap,
  });
  final List<(String, int)> entries;
  final int selected;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.border),
      ),
      child: Row(
        children: List.generate(entries.length, (i) {
          final active = i == selected;
          return Expanded(
            child: InkWell(
              onTap: () => onTap(i),
              borderRadius: BorderRadius.circular(9),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: active ? tokens.primaryAccent : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      entries[i].$1,
                      style: TextStyle(
                        fontSize: 12.5,
                        color: active ? Colors.white : tokens.textSecondary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: active
                            ? const Color(0x38FFFFFF)
                            : tokens.surfaceSecondary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${entries[i].$2}',
                        style: TextStyle(
                          fontSize: 10,
                          color: active ? Colors.white : tokens.textMuted,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _LiveCard extends StatelessWidget {
  const _LiveCard({required this.event});
  final CourseEvent event;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final mentor = event.instructorName ?? 'Teacher not assigned';
    final subject = event.courseName ?? 'Live Class';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [tokens.danger, const Color(0xFFDC2626)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppShadows.lg,
      ),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          Positioned(
            right: -40,
            top: -40,
            child: Container(
              width: 160,
              height: 160,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x1AFFFFFF),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0x38FFFFFF),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 5),
                        const Text(
                          'LIVE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                event.title,
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const AppAvatar(
                    size: 28,
                    border: Border.fromBorderSide(
                      BorderSide(color: Colors.white, width: 1.5),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '$mentor · $subject',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        onTap: () => _joinSession(context, event),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          alignment: Alignment.center,
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Join class',
                                style: TextStyle(
                                  color: Color(0xFFDC2626),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              SizedBox(width: 6),
                              Icon(Icons.arrow_forward,
                                  color: Color(0xFFDC2626), size: 14),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0x33FFFFFF),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.chat_outlined,
                        color: Colors.white, size: 18),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _UpcomingRow extends StatelessWidget {
  const _UpcomingRow({required this.event, required this.slotIndex});
  final CourseEvent event;
  final int slotIndex;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final dt = event.startTime.toLocal();
    final now = DateTime.now();
    final isToday =
        dt.year == now.year && dt.month == now.month && dt.day == now.day;
    final mentor = event.instructorName ?? 'Teacher not assigned';
    final subject = event.courseName ?? 'Class';
    // Same rotating slot accents as Capacitor's UpcomingSessionRow.
    final accents = [
      tokens.primaryAccent,
      tokens.success,
      tokens.warning,
      tokens.danger,
      tokens.info
    ];
    final accent = accents[slotIndex % accents.length];

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppShadows.sm,
      ),
      child: Material(
        color: tokens.cardBg,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: tokens.border),
        ),
        child: InkWell(
          onTap: () => _joinSession(context, event),
          child: Container(
            constraints: const BoxConstraints(minHeight: 112),
            decoration: BoxDecoration(
              border: Border(left: BorderSide(color: accent, width: 4)),
            ),
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Every time occupies exactly the same column, including 5:30.
                Container(
                  width: 68,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                  decoration: BoxDecoration(
                    color: accent.withOpacity(0.10),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          DateFormat('h:mm').format(dt),
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: accent,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        DateFormat('a').format(dt),
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: accent,
                            letterSpacing: 0.6),
                      ),
                      const SizedBox(height: 6),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          isToday
                              ? 'TODAY'
                              : DateFormat('d MMM').format(dt).toUpperCase(),
                          style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w600,
                              color: tokens.textSecondary),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        event.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 15,
                            height: 1.3,
                            fontWeight: FontWeight.w800,
                            color: tokens.textPrimary),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        subject,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 11.5,
                            height: 1.35,
                            fontWeight: FontWeight.w500,
                            color: tokens.textSecondary),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        mentor,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 12,
                            height: 1.35,
                            fontWeight: FontWeight.w700,
                            color: tokens.textPrimary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Icon(Icons.chevron_right_rounded,
                      color: tokens.textMuted, size: 18),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RecordingCard extends StatelessWidget {
  const _RecordingCard({required this.event});
  final CourseEvent event;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final mentor = event.instructorName ?? 'Teacher not assigned';
    final subject = event.courseName ?? 'Class';

    return Container(
      width: 220,
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            child: Container(
              height: 110,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    tokens.primaryAccent,
                    tokens.primaryAccent.withOpacity(0.78),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              alignment: Alignment.center,
              child: Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xF2FFFFFF),
                ),
                child: Icon(
                  Icons.play_arrow,
                  color: tokens.primaryAccent,
                  size: 18,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subject.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: tokens.primaryAccent,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  event.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  mentor,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: tokens.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.title, required this.sub});
  final String title;
  final String sub;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 50),
      child: Column(
        children: [
          Icon(Icons.videocam_off_outlined, color: tokens.textMuted, size: 40),
          const SizedBox(height: 8),
          Text(
            title,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: tokens.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            sub,
            style: TextStyle(
              fontSize: 13,
              color: tokens.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
