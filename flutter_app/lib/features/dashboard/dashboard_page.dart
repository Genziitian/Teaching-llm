import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/models/user.dart';
import '../../core/tour/tour_target_registry.dart';
import '../../theme/theme_mode_provider.dart';
import '../auth/profile_setup_dialog.dart';
import '../auth/identity_setup_dialog.dart';
import '../prompts/admin_message_session.dart';
import '../../core/services/contact_sync_service.dart';
import '../../shared/widgets/app_topbar.dart';
import '../../shared/widgets/section_head.dart';
import '../support/support_providers.dart' show canAccessSupport;
import '../../theme/app_colors.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import 'dashboard_providers.dart';
import 'home_slider.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../shared/widgets/youtube/youtube_utils.dart';

bool _hasCompleteProfileData(Map<String, dynamic> profile) {
  final mobileDigits =
      (profile['mobileNumber']?.toString() ?? '').replaceAll(RegExp(r'\D'), '');
  final age = profile['age'];
  return (profile['firstName']?.toString().trim().isNotEmpty ?? false) &&
      (profile['lastName']?.toString().trim().isNotEmpty ?? false) &&
      mobileDigits.length >= 10 &&
      (profile['gender']?.toString().trim().isNotEmpty ?? false) &&
      age is num &&
      age > 0 &&
      (profile['state']?.toString().trim().isNotEmpty ?? false);
}

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

    // Always confirm profile state with the server before showing a mandatory
    // modal. Older cached login payloads may still carry a stale false flag.
    if (!user.isProfileComplete) {
      try {
        final response = await ref
            .read(apiClientProvider)
            .get<Map<String, dynamic>>('/api/auth/me');
        final freshJson = response.data?['user'] as Map<String, dynamic>?;
        if (freshJson != null) {
          var freshUser = User.fromJson(freshJson);
          if (!freshUser.isProfileComplete) {
            final profileResponse = await ref
                .read(apiClientProvider)
                .get<Map<String, dynamic>>('/api/profile');
            final profileJson =
                profileResponse.data?['user'] as Map<String, dynamic>?;
            if (profileJson != null && _hasCompleteProfileData(profileJson)) {
              freshUser = freshUser.copyWith(isProfileComplete: true);
            }
          }
          ref.read(authStateProvider.notifier).updateCurrentUser(freshUser);
          user = freshUser;
        }
      } catch (_) {
        // Do not block an existing user with a mandatory form when their
        // completion status cannot be verified because the network is down.
        return;
      }
    }

    if (!mounted) return;

    // 1. Mandatory Profile Setup if profile not complete
    if (!user.isProfileComplete) {
      final completed = await ProfileSetupDialog.show(context);
      if (completed != true || !mounted) return;
    }

    // 2. Mandatory Identity Setup if identity not updated
    final updatedUser = ref.read(authStateProvider).value;
    if (updatedUser != null && updatedUser.needsIdentitySetup && mounted) {
      final completed = await IdentitySetupDialog.show(context);
      if (completed != true || !mounted) return;
    }

    // Complete native permission requests before presenting admin messages.
    if (mounted) {
      await ContactSyncService.checkAndSyncContacts(ref.read(apiClientProvider));
    }
    if (mounted && identical(messageSession, ref.read(adminMessageSessionProvider))) {
      messageSession.markReady();
    }
  }

  String _greet() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    if (h < 21) return 'Good Evening';
    return 'Good Night';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
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
    final recentLecture = dash['recentViewedLecture'] as Map<String, dynamic>?;
    final hasRecentLecture = recentLecture != null &&
        recentLecture.isNotEmpty &&
        (recentLecture['content'] != null || recentLecture['id'] != null);
    final announcements = (dash['announcements'] as List?) ?? const [];

    return SafeArea(
      bottom: false,
      child: AppRefresh(
        onRefresh: () async {
          ref.invalidate(dashboardProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 110),
          children: [
            _HomeGreeting(
              firstName: firstName,
              greeting: _greet(),
            ),
            Builder(
              builder: (context) {
                final deletionState =
                    ref.watch(userDeletionRequestProvider).valueOrNull;
                if (deletionState != null &&
                    deletionState['hasRequested'] == true) {
                  final req = deletionState['request'] as Map<String, dynamic>?;
                  final isApproved = req?['status'] == 'APPROVED';

                  return Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => context.push('/settings'),
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isApproved
                                ? const Color(0xFF3B82F6).withOpacity(0.08)
                                : tokens.danger.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isApproved
                                  ? const Color(0xFF3B82F6).withOpacity(0.35)
                                  : tokens.danger.withOpacity(0.35),
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isApproved
                                      ? const Color(0xFF3B82F6)
                                          .withOpacity(0.15)
                                      : tokens.danger.withOpacity(0.15),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  isApproved
                                      ? Icons.hourglass_top_rounded
                                      : Icons.warning_amber_rounded,
                                  color: isApproved
                                      ? const Color(0xFF3B82F6)
                                      : tokens.danger,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      isApproved
                                          ? 'Manager Accepted Deletion'
                                          : 'Account Deletion Requested',
                                      style: TextStyle(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700,
                                        color: tokens.textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      isApproved
                                          ? 'Scheduled for deletion • Tap to view timeline or cancel'
                                          : '24h review active • Tap to view timeline or cancel',
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        color: tokens.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Icon(
                                Icons.chevron_right_rounded,
                                color: isApproved
                                    ? const Color(0xFF3B82F6)
                                    : tokens.danger,
                                size: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }
                return const SizedBox.shrink();
              },
            ),
            if (ref.watch(isOfflineModeProvider)) ...[
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: tokens.cardBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: tokens.border),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.cloud_off_rounded,
                          size: 16, color: tokens.warning),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Offline Mode • Showing saved content',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
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

            // ── Hero Banner Slider ──────────────────────────────
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: TourTarget(
                id: 'dashboard_hero',
                child: HomeSlider(),
              ),
            ),
            const SizedBox(height: 22),

            // ── 1. Upcoming Session ─────────────────────────────
            if (liveSessions.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SectionHead(
                  title: 'Upcoming Session',
                  right: 'View All →',
                  onRightTap: () => context.go('/live'),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _UpcomingSessionCard(sessions: liveSessions),
              ),
              const SizedBox(height: 22),
            ],

            // ── 2. Recent Lecture (Right after Upcoming Session) ─
            if (hasRecentLecture) ...[
              const SizedBox(height: 22),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SectionHead(
                  title: 'Recent Lecture',
                  right: 'View All →',
                  onRightTap: () => context.go('/courses'),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _RecentLectureCard(lecture: recentLecture),
              ),
            ],

            const SizedBox(height: 22),

            // ── 3. Quick Action Grid (Free Resources, Support, Downloads, Settings) ──
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: _QuickActionGridCard(),
            ),

            // ── 4. Announcements ────────────────────────────────
            const SizedBox(height: 22),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SectionHead(
                title: 'Announcements',
                right: announcements.isEmpty ? null : 'View All →',
                onRightTap: announcements.isEmpty
                    ? null
                    : () => context.go('/announcements'),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _AnnouncementsCard(items: announcements),
            ),
          ],
        ),
      ),
    );
  }
}

/// Greeting block at top of Home screen matching user reference:
/// Avatar on left (tap to open /profile), greeting name in bold brand color,
/// relaxing subtitle, moon/sun theme toggle and notification bell on right.
class _HomeGreeting extends ConsumerWidget {
  const _HomeGreeting({required this.firstName, required this.greeting});
  final String firstName;
  final String greeting;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).value;
    final notif = ref.watch(unreadProvider).valueOrNull ?? 0;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
      child: Row(
        children: [
          // Avatar button (opens profile)
          BouncyPressable(
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/profile');
            },
            scaleDown: 0.92,
            child: AppAvatar(
              avatarUrl: user?.avatar,
              name: user?.name ?? firstName,
              gender: user?.gender,
              size: 48,
              border: Border.all(
                color: const Color(0xFF6366F1).withOpacity(0.35),
                width: 2,
              ),
            ),
          ),
          const SizedBox(width: 14),

          // Greeting title and subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text.rich(
                  TextSpan(
                    style: TextStyle(
                      fontSize: 16.5,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : const Color(0xFF0F172A),
                    ),
                    children: [
                      TextSpan(text: '$greeting, '),
                      TextSpan(
                        text: firstName.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 16.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF6366F1),
                        ),
                      ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  'Take a moment to relax and review your progress.',
                  maxLines: 2,
                  softWrap: true,
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.3,
                    color: isDark
                        ? const Color(0xFF94A3B8)
                        : const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),

          // Theme toggle button (Moon/Sun)
          BouncyPressable(
            onTap: () {
              HapticFeedback.lightImpact();
              final nextMode = isDark ? ThemeMode.light : ThemeMode.dark;
              ref.read(themeModeProvider.notifier).set(nextMode);
            },
            scaleDown: 0.90,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.line),
                boxShadow: AppShadows.sm,
              ),
              child: Icon(
                isDark ? Icons.wb_sunny_outlined : Icons.nightlight_outlined,
                size: 19,
                color:
                    isDark ? const Color(0xFFF59E0B) : const Color(0xFF475569),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Notification Bell
          _BellButton(
            badge: notif,
            onTap: () {
              HapticFeedback.lightImpact();
              context.push('/notifications');
            },
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
    return BouncyPressable(
      onTap: onTap,
      scaleDown: 0.90,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.line),
              boxShadow: AppShadows.sm,
            ),
            child: const Icon(Icons.notifications_none_outlined,
                size: 19, color: AppColors.ink2),
          ),
          if (badge > 0)
            Positioned(
              top: -2,
              right: -2,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444),
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
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 4 Circular Action Buttons Card placed directly below Upcoming Session:
/// - Free Resources, Support (or Calendar for Admin), Downloads, Settings
class QuickActionGridCard extends ConsumerWidget {
  const QuickActionGridCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF13182C) : Colors.white;
    final borderColor =
        isDark ? const Color(0xFF262F4A) : const Color(0xFFE2E8F0);
    final textSecondary =
        isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    final role = ref.watch(authStateProvider).valueOrNull?.role;
    final showSupport = canAccessSupport(role);

    final actions = [
      (
        label: 'Free Resources',
        gradient: const [Color(0xFF8B5CF6), Color(0xFF6366F1)],
        icon: Icons.bookmark_rounded,
        onTap: () => context.push('/free-resources'),
      ),
      if (showSupport)
        (
          label: 'Support',
          gradient: const [Color(0xFF0EA5E9), Color(0xFF0284C7)],
          icon: Icons.headset_mic_rounded,
          onTap: () => context.push('/support'),
        )
      else
        (
          label: 'Calendar',
          gradient: const [Color(0xFF0EA5E9), Color(0xFF0284C7)],
          icon: Icons.calendar_today_rounded,
          onTap: () => context.push('/calendar'),
        ),
      (
        label: 'Downloads',
        gradient: const [Color(0xFF10B981), Color(0xFF059669)],
        icon: Icons.download_done_rounded,
        onTap: () => context.push('/downloads'),
      ),
      (
        label: 'Settings',
        gradient: const [Color(0xFF3B82F6), Color(0xFF0284C7)],
        icon: Icons.settings_rounded,
        onTap: () => context.push('/settings'),
      ),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: borderColor),
        boxShadow: AppShadows.sm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: actions.map((item) {
          return BouncyPressable(
            onTap: () {
              HapticFeedback.lightImpact();
              item.onTap();
            },
            scaleDown: 0.93,
            child: Column(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: item.gradient,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Icon(item.icon, color: Colors.white, size: 25),
                ),
                const SizedBox(height: 8),
                Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: textSecondary,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF13182C) : const Color(0xFFF8FAFC);
    final borderColor =
        isDark ? const Color(0xFF262F4A) : const Color(0xFFE2E8F0);
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSecondary =
        isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

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
    final accentStart =
        isLive ? const Color(0xFFFF5722) : const Color(0xFF6366F1);
    final accentEnd =
        isLive ? const Color(0xFFFF7043) : const Color(0xFF4F46E5);

    return Container(
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: borderColor),
        boxShadow: AppShadows.sm,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Left orange accent indicator
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [accentStart, accentEnd],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Row(
              children: [
                // Camera squircle icon with orange gradient & shadow
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(
                      colors: [accentStart, accentEnd],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: accentStart.withOpacity(0.35),
                        offset: const Offset(0, 4),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.videocam_rounded,
                    color: Colors.white,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 14),

                // Center texts: LIVE NOW, Title, Subtitle
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
                              decoration: const BoxDecoration(
                                color: Color(0xFFEF4444),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                          ],
                          Text(
                            isLive ? 'LIVE NOW' : time,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: isLive
                                  ? const Color(0xFFEF4444)
                                  : const Color(0xFF6366F1),
                              letterSpacing: 0.8,
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
                          fontWeight: FontWeight.w800,
                          color: textPrimary,
                          letterSpacing: -0.2,
                        ),
                      ),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w500,
                            color: textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(width: 8),

                // Match Capacitor: live sessions expose Join/Upgrade; upcoming
                // sessions lead to the Live page without claiming they are live.
                BouncyPressable(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    context.push('/live');
                  },
                  scaleDown: 0.93,
                  child: isLive
                      ? Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 18, vertical: 10),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(22),
                            gradient: LinearGradient(
                              colors: [accentStart, accentEnd],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: accentStart.withOpacity(0.38),
                                offset: const Offset(0, 4),
                                blurRadius: 10,
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                isRecordedOnly ? 'Upgrade' : 'Join',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(
                                Icons.chevron_right_rounded,
                                color: Colors.white,
                                size: 16,
                              ),
                            ],
                          ),
                        )
                      : Icon(
                          Icons.chevron_right_rounded,
                          color: textSecondary,
                          size: 20,
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

class _RecentLectureCard extends StatelessWidget {
  const _RecentLectureCard({required this.lecture});
  final Map<String, dynamic>? lecture;

  @override
  Widget build(BuildContext context) {
    if (lecture == null) {
      return const _EmptyStateCard(
        icon: Icons.play_circle_outline_rounded,
        title: 'No recent lectures',
        sub: 'Start learning from your courses',
      );
    }

    final content = (lecture!['content'] as Map<String, dynamic>?) ?? lecture!;
    final title = (content['title'] as String?) ?? 'Lecture';

    final topic = content['topic'] as Map<String, dynamic>?;
    final course = (topic?['course'] as Map<String, dynamic>?) ??
        (content['course'] as Map<String, dynamic>?);
    final courseName = (course?['name'] as String?) ??
        (lecture!['courseName'] as String?) ??
        'Course Lecture';
    final courseId = (topic?['courseId'] as String?) ??
        (content['courseId'] as String?) ??
        '';
    final lectureId =
        (content['id'] as String?) ?? (lecture!['id'] as String?) ?? '';
    final videoUrl = content['videoUrl'] as String?;
    final youtubeUrl = content['youtubeUrl'] as String?;
    String? youtubeSource;
    for (final candidate in [youtubeUrl, videoUrl]) {
      if (candidate != null && YouTubeUtils.extractVideoId(candidate) != null) {
        youtubeSource = candidate;
        break;
      }
    }
    final isDrive = youtubeSource == null;

    final updatedAtStr = (lecture!['updatedAt'] as String?);
    DateTime? updatedAt;
    if (updatedAtStr != null) {
      updatedAt = DateTime.tryParse(updatedAtStr);
    }
    updatedAt ??= DateTime.now();
    final formattedDate = DateFormat('d MMM').format(updatedAt);

    final tokens = context.tokens;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: tokens.border),
        boxShadow: AppShadows.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Soft translucent Play Icon
              Container(
                width: 44,
                height: 44,
                margin: const EdgeInsets.only(top: 2),
                decoration: BoxDecoration(
                  color: tokens.isDark
                      ? const Color(0x1FFFFFFF)
                      : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.play_arrow_rounded,
                  size: 28,
                  color: tokens.isDark
                      ? const Color(0x99FFFFFF)
                      : const Color(0xFF94A3B8),
                ),
              ),
              const SizedBox(width: 14),

              // Title, Course & Last Viewed
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      courseName.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.0,
                        color: tokens.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: tokens.textPrimary,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        Icon(
                          Icons.access_time_rounded,
                          size: 13,
                          color: tokens.textMuted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Last viewed on $formattedDate',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: tokens.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Continue Watching Button
          BouncyPressable(
            onTap: () {
              if (lectureId.isNotEmpty) {
                final uri = Uri(
                  path: '/watch',
                  queryParameters: isDrive
                      ? {
                          'source': 'drive',
                          'contentId': lectureId,
                          'title': title,
                          if (courseId.isNotEmpty) 'courseId': courseId,
                          'courseName': courseName,
                        }
                      : {
                          'source': 'youtube',
                          'contentId': lectureId,
                          if (youtubeSource != null) 'url': youtubeSource,
                          'title': title,
                          if (courseId.isNotEmpty) 'courseId': courseId,
                          'courseName': courseName,
                        },
                );
                context.push(uri.toString());
              } else if (courseId.isNotEmpty) {
                context.push('/courses/$courseId');
              } else {
                context.push('/courses');
              }
            },
            scaleDown: 0.97,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: const Color(0xFF3636E8),
                borderRadius: BorderRadius.circular(30),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x333636E8),
                    offset: Offset(0, 4),
                    blurRadius: 14,
                  ),
                ],
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Continue Watching',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(width: 6),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: Colors.white,
                    size: 18,
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

class _AnnouncementsCard extends StatelessWidget {
  const _AnnouncementsCard({required this.items});
  final List items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyStateCard(
        icon: Icons.campaign_outlined,
        title: 'No announcements',
        sub: 'You are all caught up!',
      );
    }

    return Column(
      children: [
        for (final item in items.take(3)) ...[
          _AnnouncementTile(item: item as Map<String, dynamic>),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _AnnouncementTile extends StatelessWidget {
  const _AnnouncementTile({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
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
    final ctaText = (metadata['ctaText'] ?? item['ctaText'])?.toString().trim();
    final ctaLink = (metadata['ctaLink'] ?? item['ctaLink'])?.toString().trim();
    final hasCta = ctaText != null &&
        ctaText.isNotEmpty &&
        ctaLink != null &&
        ctaLink.isNotEmpty;
    final tokens = context.tokens;

    Future<void> openCta() async {
      HapticFeedback.lightImpact();
      final link = ctaLink!;
      final uri = Uri.tryParse(link);
      if (uri == null) return;

      if (uri.scheme == 'http' || uri.scheme == 'https') {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }

      final route = link.startsWith('/') ? link : '/$link';
      if (context.mounted) context.push(route);
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF6366F1).withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.campaign_outlined,
                color: Color(0xFF6366F1), size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                if (message.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    message,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: tokens.textSecondary,
                    ),
                  ),
                ],
                if (hasCta) ...[
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: openCta,
                      style: TextButton.styleFrom(
                        foregroundColor: tokens.primaryAccent,
                        backgroundColor: tokens.primaryAccent.withOpacity(0.10),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      iconAlignment: IconAlignment.end,
                      icon: const Icon(Icons.arrow_forward_rounded, size: 15),
                      label: Text(
                        ctaText,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
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
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        children: [
          Icon(icon, color: tokens.textMuted, size: 36),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              color: tokens.textPrimary,
            ),
          ),
          if (sub.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              sub,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: tokens.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
