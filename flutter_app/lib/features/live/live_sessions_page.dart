import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/models/course_event.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/apple_pressable.dart';
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
    final isManager = user?.isManager == true;

    return AppPageScaffold(
      title: 'Live Sessions',
      subtitle: 'Join classes & rewatch recordings',
      showBack: true,
      right: isManager
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
                  icon: Symbols.sync_rounded,
                  onTap: _syncLiveSessions,
                ))
          : null,
      body: AppRefresh(
        onRefresh: () async => ref.invalidate(liveSessionsProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(0, 12, 0, 32),
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
                    Icon(Symbols.cloud_off_rounded, color: tokens.textMuted, size: 40),
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
      padding: const EdgeInsets.symmetric(horizontal: 16),
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
              Column(
                children: [
                  for (final event in recorded)
                    Padding(
                      padding: const EdgeInsets.only(top: 14),
                      child: _PastRow(event: event),
                    ),
                ],
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
    final reduce = MediaQuery.of(context).disableAnimations;
    final track =
        tokens.isDark ? const Color(0xFF1C1C1E) : const Color(0xFFE3E3E8);
    final thumb = tokens.isDark ? const Color(0xFF636366) : Colors.white;

    return Container(
      height: 40,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: track,
        borderRadius: BorderRadius.circular(12),
      ),
      child: LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth / entries.length;
        return Stack(
          children: [
            AnimatedPositioned(
              duration:
                  reduce ? Duration.zero : const Duration(milliseconds: 260),
              curve: kEaseOutStrong,
              left: w * selected,
              width: w,
              top: 0,
              bottom: 0,
              child: Container(
                decoration: BoxDecoration(
                  color: thumb,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: tokens.isDark
                      ? null
                      : const [
                          BoxShadow(
                            color: Color(0x1F000000),
                            blurRadius: 4,
                            offset: Offset(0, 1.5),
                          ),
                        ],
                ),
              ),
            ),
            Row(
              children: List.generate(entries.length, (i) {
                final active = i == selected;
                return Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTapDown: (_) {
                      if (!active) onTap(i);
                    },
                    child: Center(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            entries[i].$1,
                            style: TextStyle(
                              fontSize: 14,
                              color: active
                                  ? tokens.textPrimary
                                  : tokens.textSecondary,
                              fontWeight:
                                  active ? FontWeight.w600 : FontWeight.w500,
                            ),
                          ),
                          if (entries[i].$2 > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              constraints: const BoxConstraints(minWidth: 18),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: active
                                    ? tokens.primaryAccent
                                    : tokens.textMuted.withValues(alpha: 0.25),
                                borderRadius: BorderRadius.circular(9),
                              ),
                              child: Text(
                                '${entries[i].$2}',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: active
                                      ? Colors.white
                                      : tokens.textSecondary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
          ],
        );
      }),
    );
  }
}

class _LiveCard extends StatefulWidget {
  const _LiveCard({required this.event});
  final CourseEvent event;

  @override
  State<_LiveCard> createState() => _LiveCardState();
}

class _LiveCardState extends State<_LiveCard>
    with SingleTickerProviderStateMixin {
  // Drives the pulsing LIVE dot, the breathing glow and the drifting circle.
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );
  late final Animation<double> _breath =
      CurvedAnimation(parent: _pulse, curve: Curves.easeInOut);
  // Keeps the "Started 5 min ago" label current while the page stays open.
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Respect the system "remove animations" setting.
    if (MediaQuery.of(context).disableAnimations) {
      _pulse.stop();
    } else if (!_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _clock?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  String _startedLabel() {
    final minutes =
        DateTime.now().difference(widget.event.startTime.toLocal()).inMinutes;
    if (minutes < 0) return 'Starting now';
    if (minutes < 1) return 'Started just now';
    if (minutes < 60) return 'Started $minutes min ago';
    final hours = minutes ~/ 60;
    final rest = minutes % 60;
    return rest == 0
        ? 'Started ${hours}h ago'
        : 'Started ${hours}h ${rest}m ago';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final event = widget.event;
    final mentor = event.instructorName ?? 'Teacher not assigned';
    final subject = event.courseName ?? 'Live Class';

    final content = _buildContent(context, event, mentor, subject);

    // Slide/fade in once, then keep a soft red glow breathing around the card.
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - t)),
          child: child,
        ),
      ),
      child: AnimatedBuilder(
        animation: _breath,
        child: content,
        builder: (context, child) => Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [tokens.danger, const Color(0xFFDC2626)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(26),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFDC2626)
                    .withOpacity(0.18 + 0.27 * _breath.value),
                blurRadius: 12 + 16 * _breath.value,
                spreadRadius: 1.5 * _breath.value,
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, CourseEvent event, String mentor,
      String subject) {
    return Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          Positioned(
            right: -40,
            top: -40,
            child: ScaleTransition(
              scale: Tween<double>(begin: 1.0, end: 1.14).animate(_breath),
              child: Container(
                width: 160,
                height: 160,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0x1AFFFFFF),
                ),
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
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Dot with a ring that pulses outward.
                        SizedBox(
                          width: 12,
                          height: 12,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              AnimatedBuilder(
                                animation: _breath,
                                builder: (context, _) => Container(
                                  width: 6 + 6 * _breath.value,
                                  height: 6 + 6 * _breath.value,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.white.withOpacity(
                                        0.45 * (1 - _breath.value)),
                                  ),
                                ),
                              ),
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 4),
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
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(
                      event.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 22,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // How long ago the class started, e.g. "Started 5 min ago".
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0x38FFFFFF),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Symbols.schedule_rounded,
                            size: 12, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(
                          _startedLabel(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
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
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: ApplePressable(
                      onTap: () => _joinSession(context, event),
                      child: Container(
                        height: 50,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'Join now',
                          style: TextStyle(
                            color: Color(0xFFDC2626),
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: const Color(0x33FFFFFF),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Symbols.chat_bubble_rounded,
                        fill: 1, color: Colors.white, size: 22),
                  ),
                ],
              ),
            ],
          ),
        ],
    );
  }
}

/// Session row in the same shape as the Home "Upcoming Session" card:
/// rounded video tile, small coloured time label, title, subtitle.
class _SessionTile extends StatelessWidget {
  const _SessionTile({
    required this.label,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.icon,
    this.trailing,
    this.onTap,
    this.muted = false,
  });
  final String label;
  final String title;
  final String subtitle;
  final Color accent;
  final IconData icon;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final card = Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: muted
            ? tokens.cardBg
            : Color.alphaBlend(
                accent.withValues(alpha: tokens.isDark ? 0.12 : 0.06),
                tokens.cardBg),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: muted
                  ? tokens.textMuted.withValues(alpha: 0.14)
                  : accent.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(15),
            ),
            alignment: Alignment.center,
            child: Icon(icon,
                size: 26,
                fill: 1,
                weight: 500,
                color: muted ? tokens.textSecondary : accent),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: muted ? tokens.textSecondary : accent)),
                const SizedBox(height: 3),
                Text(title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 16.5,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3,
                        color: tokens.textPrimary)),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 13, color: tokens.textSecondary)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          trailing ??
              Icon(Symbols.arrow_forward_ios_rounded,
                  weight: 700, color: tokens.textMuted, size: 13),
        ],
      ),
    );
    return onTap == null
        ? card
        : ApplePressable(onTap: onTap, pressedScale: 0.98, child: card);
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
    final accents = [
      tokens.primaryAccent,
      tokens.success,
      tokens.warning,
      tokens.danger,
      tokens.info
    ];
    final accent = accents[slotIndex % accents.length];
    return _SessionTile(
      label:
          '${DateFormat('h:mm a').format(dt)} · ${isToday ? 'TODAY' : DateFormat('d MMM').format(dt).toUpperCase()}',
      title: event.title,
      subtitle: [subject, mentor].where((v) => v.isNotEmpty).join(' · '),
      accent: accent,
      icon: Symbols.videocam_rounded,
      onTap: () => _joinSession(context, event),
    );
  }
}

/// A finished session, in the same shape as the Upcoming rows.
class _PastRow extends StatelessWidget {
  const _PastRow({required this.event});
  final CourseEvent event;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final dt = event.startTime.toLocal();
    final mentor = event.instructorName ?? 'Teacher not assigned';
    final subject = event.courseName ?? 'Class';
    return _SessionTile(
      label:
          'ENDED · ${DateFormat('d MMM').format(dt).toUpperCase()} · ${DateFormat('h:mm a').format(dt)}',
      title: event.title,
      subtitle: [subject, mentor].where((v) => v.isNotEmpty).join(' · '),
      accent: tokens.textSecondary,
      icon: Symbols.videocam_rounded,
      muted: true,
      trailing: const SizedBox.shrink(),
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
      padding: const EdgeInsets.symmetric(vertical: 72),
      child: Column(
        children: [
          Icon(Symbols.videocam_off_rounded,
              color: tokens.textMuted, size: 44),
          const SizedBox(height: 12),
          Text(
            title,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
              color: tokens.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            sub,
            style: TextStyle(
              fontSize: 15,
              color: tokens.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
