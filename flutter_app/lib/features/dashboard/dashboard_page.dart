import 'dart:convert';

import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/tour/tour_target_registry.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/l10n/app_translations.dart';
import '../prompts/admin_message_session.dart';
import '../../shared/widgets/app_topbar.dart';
import '../../shared/widgets/section_head.dart';
import '../support/support_providers.dart' show canAccessSupport;
import '../../theme/app_theme_tokens.dart';
import 'dashboard_providers.dart';
import 'home_slider.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/apple_pressable.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  bool _checkedModals = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkModals();
    });
  }

  Future<void> _checkModals() async {
    if (_checkedModals) return;
    final messageSession = ref.read(adminMessageSessionProvider);
    var user = ref.read(authStateProvider).value;
    if (user == null || !mounted) return;

    _checkedModals = true;

    if (mounted && identical(messageSession, ref.read(adminMessageSessionProvider))) {
      messageSession.markReady();
    }
  }

  String _greet(String locale) {
    final h = DateTime.now().hour;
    if (h < 12) return AppTranslations.t('dashboard.greeting.morning', locale);
    if (h < 17) return AppTranslations.t('dashboard.greeting.afternoon', locale);
    if (h < 21) return AppTranslations.t('dashboard.greeting.evening', locale);
    return AppTranslations.t('dashboard.greeting.night', locale);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final currentLanguage = ref.watch(languageProvider).value ?? 'en';
    final user = ref.watch(authStateProvider).value;
    final firstName =
        (user?.firstName ?? user?.name.split(' ').first) ?? 'there';
    final dashAsync = ref.watch(dashboardProvider);
    final dash = dashAsync.value ?? const <String, dynamic>{};
    final sessions = (dash['liveSessions'] as List?) ?? const [];
    final liveSessions = sessions.where((item) {
      if (item is! Map) return false;
      final status = item['status']?.toString().toLowerCase();
      return status == 'live' || status == 'upcoming';
    }).toList()
      ..sort((a, b) {
        final aStatus = (a as Map)['status']?.toString().toLowerCase();
        final bStatus = (b as Map)['status']?.toString().toLowerCase();
        if (aStatus == bStatus) {
          final aTime = DateTime.tryParse(a['startTime']?.toString() ?? '');
          final bTime = DateTime.tryParse(b['startTime']?.toString() ?? '');
          if (aTime != null && bTime != null) return aTime.compareTo(bTime);
          return 0;
        }
        return aStatus == 'live' ? -1 : 1;
      });
    // When something is live right now, show only live sessions.
    if (liveSessions.any((e) =>
        (e as Map)['status']?.toString().toLowerCase() == 'live')) {
      liveSessions.removeWhere((e) =>
          (e as Map)['status']?.toString().toLowerCase() != 'live');
    }
    final announcements = (dash['announcements'] as List?) ?? const [];

    return SafeArea(
      bottom: false,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1080),
          child: AppRefresh(
            onRefresh: () async {
              ref.invalidate(dashboardProvider);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                _HomeGreeting(
                  firstName: firstName,
                  greeting: _greet(currentLanguage),
                ),

                // ── Account deletion status ─────────────────────────
                Builder(
                  builder: (context) {
                    final deletionState =
                        ref.watch(userDeletionRequestProvider).value;
                    if (deletionState != null &&
                        deletionState['hasRequested'] == true) {
                      final req =
                          deletionState['request'] as Map<String, dynamic>?;
                      final isApproved = req?['status'] == 'APPROVED';
                      final tone =
                          isApproved ? tokens.info : tokens.danger;

                      return Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                        child: ApplePressable(
                          onTap: () => context.push('/settings'),
                          pressedScale: 0.98,
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: tone.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  isApproved
                                      ? Symbols.hourglass_top_rounded
                                      : Symbols.warning_rounded,
                                  color: tone,
                                  size: 22, fill: 1, weight: 500,),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        isApproved
                                            ? AppTranslations.t(
                                                'dashboard.deletion.accepted',
                                                currentLanguage)
                                            : AppTranslations.t(
                                                'dashboard.deletion.requested',
                                                currentLanguage),
                                        style: TextStyle(
                                          fontSize: 14.5,
                                          fontWeight: FontWeight.w600,
                                          color: tokens.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        isApproved
                                            ? AppTranslations.t(
                                                'dashboard.deletion.scheduled',
                                                currentLanguage)
                                            : AppTranslations.t(
                                                'dashboard.deletion.review',
                                                currentLanguage),
                                        style: TextStyle(
                                          fontSize: 12.5,
                                          color: tokens.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Icon(
                                  Symbols.arrow_forward_ios_rounded,
                                  color: tone,
                                  size: 15, weight: 700,),
                              ],
                            ),
                          ),
                        ),
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),

                // ── Offline notice ──────────────────────────────────
                if (ref.watch(isOfflineModeProvider)) ...[
                  const SizedBox(height: 14),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 11),
                      decoration: BoxDecoration(
                        color: tokens.cardBg,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Icon(Symbols.wifi_off_rounded,
                              size: 16, color: tokens.warning, weight: 500,),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              AppTranslations.t(
                                  'dashboard.offline', currentLanguage),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: tokens.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),

                // ── Hero banner slider ──────────────────────────────
                const SizedBox(height: 4),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: TourTarget(
                    id: 'dashboard_hero',
                    child: HomeSlider(),
                  ),
                ),
                const SizedBox(height: 6),

                // ── Upcoming / live session ─────────────────────────
                if (liveSessions.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: SectionHead(
                      topPadding: 0,
                      title: AppTranslations.t(
                          (liveSessions.first is Map &&
                                  (liveSessions.first as Map)['status']
                                          ?.toString()
                                          .toLowerCase() ==
                                      'live')
                              ? 'dashboard.liveNow'
                              : 'dashboard.upcomingSession',
                          currentLanguage),
                      right: AppTranslations.t(
                          'dashboard.viewAll', currentLanguage),
                      onRightTap: () => context.go('/live'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _UpcomingSessionCard(sessions: liveSessions),
                  ),
                ],

                const SizedBox(height: 26),

                // ── Shortcuts (Free Resources, Support, Downloads…) ──
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: _QuickActionGridCard(),
                ),

                // ── Announcements ───────────────────────────────────
                const SizedBox(height: 30),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SectionHead(
                    topPadding: 0,
                    title: AppTranslations.t(
                        'dashboard.announcements', currentLanguage),
                    right: announcements.isEmpty
                        ? null
                        : AppTranslations.t(
                            'dashboard.viewAll', currentLanguage),
                    onRightTap: announcements.isEmpty
                        ? null
                        : () => context.go('/announcements'),
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _AnnouncementsCard(items: announcements),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Round, translucent toolbar button (Apple "glass" circle).
class _ToolbarButton extends StatelessWidget {
  const _ToolbarButton({required this.onTap, required this.child});
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ApplePressable(
      onTap: onTap,
      pressedScale: 0.95,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isDark ? const Color(0x24FFFFFF) : const Color(0x0F000000),
        ),
        alignment: Alignment.center,
        child: child,
      ),
    );
  }
}

/// Top of Home, in the style of the App Store "Today" header:
/// date caption + toolbar buttons + avatar, then a large greeting.
class _HomeGreeting extends ConsumerWidget {
  const _HomeGreeting({required this.firstName, required this.greeting});
  final String firstName;
  final String greeting;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final user = ref.watch(authStateProvider).value;
    final notif = ref.watch(unreadProvider).value ?? 0;
    final date = DateFormat('EEEE, d MMMM').format(DateTime.now()).toUpperCase();

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  date,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.3,
                    color: tokens.textMuted,
                  ),
                ),
              ),

              // Notification bell
              _BellButton(
                badge: notif,
                onTap: () {
                  HapticFeedback.lightImpact();
                  context.push('/notifications');
                },
              ),
              const SizedBox(width: 10),

              // Avatar (opens profile)
              ApplePressable(
                onTap: () {
                  HapticFeedback.lightImpact();
                  context.push('/profile');
                },
                pressedScale: 0.95,
                child: AppAvatar(
                  avatarUrl: user?.avatar,
                  name: user?.name ?? firstName,
                  gender: user?.gender,
                  size: 38,
                  border: Border.all(color: tokens.border, width: 0.5),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            greeting,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w500,
              color: tokens.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            firstName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 36,
              height: 1.1,
              letterSpacing: -1.0,
              fontWeight: FontWeight.w700,
              color: tokens.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _BellButton extends StatelessWidget {
  const _BellButton({required this.badge, required this.onTap});
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Stack(
      alignment: Alignment.center,
      clipBehavior: Clip.none,
      children: [
        _ToolbarButton(
          onTap: onTap,
          child: Icon(Symbols.notifications_rounded,
              size: 18, color: tokens.textSecondary, weight: 500,),
        ),
        if (badge > 0)
          Positioned(
            top: -3,
            right: -3,
            child: IgnorePointer(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                decoration: BoxDecoration(
                  color: tokens.danger,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: Theme.of(context).scaffoldBackgroundColor,
                    width: 1.5,
                  ),
                ),
                child: Text(
                  badge > 9 ? '9+' : '$badge',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Four shortcut tiles — Apple "app icon" squircles with SF-style glyphs:
/// Free Resources, Support (or Calendar for Admin), Downloads, Settings.
class QuickActionGridCard extends ConsumerWidget {
  const QuickActionGridCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final role = ref.watch(authStateProvider).value?.role;
    final showSupport = canAccessSupport(role);

    final actions = [
      (
        label: 'Free Resources',
        color: const Color(0xFFFF9500),
        icon: Symbols.bookmark_rounded,
        onTap: () => context.push('/free-resources'),
      ),
      if (showSupport)
        (
          label: 'Support',
          color: const Color(0xFF007AFF),
          icon: Symbols.headphones_rounded,
          onTap: () => context.push('/support'),
        )
      else
        (
          label: 'Calendar',
          color: const Color(0xFFFF3B30),
          icon: Symbols.calendar_month_rounded,
          onTap: () => context.push('/calendar'),
        ),
      (
        label: 'Downloads',
        color: const Color(0xFF34C759),
        icon: Symbols.download_rounded,
        onTap: () => context.push('/downloads'),
      ),
      (
        label: 'Settings',
        color: const Color(0xFF8E8E93),
        icon: Symbols.settings_rounded,
        onTap: () => context.push('/settings'),
      ),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 16),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(26),
      ),
      child: Row(
        children: [
          for (final item in actions)
            Expanded(
              child: ApplePressable(
                onTap: () {
                  HapticFeedback.lightImpact();
                  item.onTap();
                },
                pressedScale: 0.94,
                child: Column(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: item.color
                            .withValues(alpha: tokens.isDark ? 0.22 : 0.14),
                        borderRadius: BorderRadius.circular(17),
                      ),
                      alignment: Alignment.center,
                      child: Icon(item.icon,
                          color: item.color, size: 27, fill: 1, weight: 500),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                        color: tokens.textPrimary,
                      ),
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

typedef _QuickActionGridCard = QuickActionGridCard;

class _UpcomingSessionCard extends StatelessWidget {
  const _UpcomingSessionCard({required this.sessions});
  final List sessions;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    final session = sessions.first as Map<String, dynamic>;
    final status = session['status']?.toString().toLowerCase();
    final isLive = status == 'live';
    final isRecordedOnly = session['isRecordedOnly'] == true;
    final title = (session['title'] as String?) ?? 'Session';
    final instructor = session['instructor'];
    final mentor = instructor is Map
        ? (instructor['name']?.toString() ?? '')
        : (instructor?.toString() ?? '');
    final rawTime = session['time']?.toString() ?? '';
    final time = rawTime
        .replaceAll(':00 PM', ' PM')
        .replaceAll(':00 AM', ' AM')
        .replaceAll(':00 pm', ' PM')
        .replaceAll(':00 am', ' AM');
    final course = ((session['course'] as Map?)?['name'] as String?) ?? '';
    final date = session['date']?.toString() ?? '';
    final subtitle = isLive
        ? [mentor, course].where((value) => value.isNotEmpty).join(' · ')
        : date;
    final accent = isLive ? const Color(0xFFFF3B30) : const Color(0xFF5856D6);

    return ApplePressable(
      onTap: () {
        HapticFeedback.lightImpact();
        context.push('/live');
      },
      pressedScale: 0.98,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isLive
              ? Color.alphaBlend(
                  accent.withValues(alpha: tokens.isDark ? 0.14 : 0.07),
                  tokens.cardBg)
              : tokens.cardBg,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          children: [
            // Video tile
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: isLive
                    ? accent
                    : tokens.textMuted.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(15),
              ),
              alignment: Alignment.center,
              child: Icon(
                Symbols.videocam_rounded,
                color: isLive ? Colors.white : tokens.textSecondary,
                size: 26, fill: 1, weight: 500,),
            ),
            const SizedBox(width: 14),

            // LIVE NOW / time, title, subtitle
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      if (isLive) ...[
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: accent,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                      ],
                      Flexible(
                        child: Text(
                          isLive ? (time.isEmpty ? 'LIVE' : 'STARTED $time') : time,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: accent,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 16.5,
                      fontWeight: FontWeight.w700,
                      color: tokens.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w400,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),

            // Live sessions expose Join/Upgrade; upcoming ones lead to Live.
            if (isLive)
              Container(
                height: 34,
                padding: const EdgeInsets.symmetric(horizontal: 18),
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: BorderRadius.circular(17),
                ),
                alignment: Alignment.center,
                child: Text(
                  isRecordedOnly ? 'Upgrade' : 'Join',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              )
            else
              Icon(
                Symbols.arrow_forward_ios_rounded,
                color: tokens.textMuted.withValues(alpha: 0.7),
                size: 15, weight: 700,),
          ],
        ),
      ),
    );
  }
}

/// Announcements: the latest one as a featured card, the rest as a compact
/// grouped list underneath.
class _AnnouncementsCard extends ConsumerWidget {
  const _AnnouncementsCard({required this.items});
  final List items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentLanguage = ref.watch(languageProvider).value ?? 'en';
    final tokens = context.tokens;
    if (items.isEmpty) {
      return _EmptyStateCard(
        icon: Symbols.campaign_rounded,
        title: AppTranslations.t(
            'dashboard.announcements.empty.title', currentLanguage),
        sub: AppTranslations.t(
            'dashboard.announcements.empty.sub', currentLanguage),
      );
    }

    final shown = items
        .take(3)
        .map((e) => _ParsedAnnouncement.from(e as Map<String, dynamic>))
        .toList();

    return Container(
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(24),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Column(
          children: [
            for (var i = 0; i < shown.length; i++) ...[
              _CompactAnnouncementRow(a: shown[i], latest: i == 0),
              if (i != shown.length - 1)
                Padding(
                  padding: const EdgeInsets.only(left: 36),
                  child: Divider(
                    height: 0.5,
                    thickness: 0.5,
                    color: tokens.border,
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Parsed view of one announcement (title, message, optional CTA, time).
class _ParsedAnnouncement {
  _ParsedAnnouncement({
    required this.title,
    required this.message,
    required this.ctaText,
    required this.ctaLink,
    required this.when,
  });

  final String title;
  final String message;
  final String? ctaText;
  final String? ctaLink;
  final String when;

  bool get hasCta =>
      ctaText != null &&
      ctaText!.isNotEmpty &&
      ctaLink != null &&
      ctaLink!.isNotEmpty;

  static String _rel(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('d MMM').format(dt);
  }

  factory _ParsedAnnouncement.from(Map<String, dynamic> item) {
    final title = (item['title'] as String?) ?? 'Announcement';
    final rawMessage = (item['content'] as String?) ?? '';
    final metadataPattern = RegExp(
      r'<!-- fcm_meta:({.*?}) -->$',
      dotAll: true,
    );
    final metadataMatch = metadataPattern.firstMatch(rawMessage);
    Map<String, dynamic> metadata = const {};
    if (metadataMatch != null) {
      try {
        final decoded = jsonDecode(metadataMatch.group(1)!);
        if (decoded is Map) {
          metadata = Map<String, dynamic>.from(decoded);
        }
      } catch (_) {
        // Keep displaying the announcement even if legacy metadata is invalid.
      }
    }
    final message = rawMessage.replaceFirst(metadataPattern, '').trim();
    return _ParsedAnnouncement(
      title: title,
      message: message,
      ctaText: (metadata['ctaText'] ?? item['ctaText'])?.toString().trim(),
      ctaLink: (metadata['ctaLink'] ?? item['ctaLink'])?.toString().trim(),
      when: _rel(item['createdAt']?.toString()),
    );
  }
}

Future<void> _openAnnouncementCta(BuildContext context, String link) async {
  HapticFeedback.lightImpact();
  final uri = Uri.tryParse(link);
  if (uri == null) return;

  if (uri.scheme == 'http' || uri.scheme == 'https') {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
    return;
  }

  final route = link.startsWith('/') ? link : '/$link';
  if (context.mounted) context.push(route);
}

class _CompactAnnouncementRow extends StatelessWidget {
  const _CompactAnnouncementRow({required this.a, this.latest = false});
  final _ParsedAnnouncement a;
  final bool latest;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ApplePressable(
      onTap: () => context.go('/announcements'),
      pressedOpacity: 0.6,
      pressedScale: 1.0,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              width: 14,
              child: latest
                  ? Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: tokens.primaryAccent,
                        shape: BoxShape.circle,
                      ),
                    )
                  : null,
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    a.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.3,
                      color: tokens.textPrimary,
                    ),
                  ),
                  if (a.message.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      a.message,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14.5,
                        height: 1.3,
                        fontWeight: FontWeight.w400,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ],
                  if (a.hasCta) ...[
                    const SizedBox(height: 8),
                    ApplePressable(
                      onTap: () => _openAnnouncementCta(context, a.ctaLink!),
                      pressedScale: 0.96,
                      pressedOpacity: 0.8,
                      child: Container(
                        height: 30,
                        padding: const EdgeInsets.symmetric(horizontal: 13),
                        decoration: BoxDecoration(
                          color: tokens.primaryAccent.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              a.ctaText!,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: tokens.primaryAccent,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Icon(Symbols.arrow_forward_ios_rounded,
                                size: 11, color: tokens.primaryAccent, weight: 700,),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (a.when.isNotEmpty)
                  Text(
                    a.when,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: tokens.textMuted,
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 6),
            Icon(
              Symbols.arrow_forward_ios_rounded,
              size: 13,
              color: tokens.textMuted.withValues(alpha: 0.7), weight: 700,),
          ],
        ),
      ),
    );
  }
}

class _EmptyStateCard extends StatelessWidget {
  const _EmptyStateCard(
      {required this.icon, required this.title, required this.sub});
  final IconData icon;
  final String title;
  final String sub;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Icon(icon, color: tokens.textMuted, size: 34),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.w600,
              color: tokens.textPrimary,
            ),
          ),
          if (sub.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              sub,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w400,
                color: tokens.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
