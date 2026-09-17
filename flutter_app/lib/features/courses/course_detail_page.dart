import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:intl/intl.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/downloads/download_providers.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../shared/widgets/shimmer_loading.dart';
import '../../shared/widgets/youtube/youtube_utils.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import '../feedback/feedback_page.dart' show myFeedbackProvider;
import '../feedback/rate_course_sheet.dart';

final courseDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/courses/$id');
    if (res.data is Map) {
      return Map<String, dynamic>.from(res.data as Map);
    }
  } catch (e) {
    debugPrint('Error fetching course detail $id: $e');
  }
  return const {};
});

final courseTopicsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, id) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/courses/$id/topics');
    final list = res.data is List ? res.data as List : <dynamic>[];
    return [for (final j in list) Map<String, dynamic>.from(j as Map)];
  } catch (e) {
    return const [];
  }
});

final courseProgressProvider =
    FutureProvider.family<Map<String, String>, String>((ref, courseId) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res =
        await api.get<dynamic>('/api/lectures/progress?courseId=$courseId');
    final list = res.data is List ? res.data as List : const [];
    final m = <String, String>{};
    for (final j in list) {
      final row = j as Map<String, dynamic>;
      final id = row['contentId'] as String?;
      final st = row['status'] as String?;
      if (id != null && st != null) m[id] = st;
    }
    return m;
  } catch (_) {
    return const {};
  }
});

String _getUploadAge(String? createdAt) {
  if (createdAt == null || createdAt.isEmpty) return 'Today';
  final createdDate = DateTime.tryParse(createdAt)?.toLocal();
  if (createdDate == null) return 'Today';
  final now = DateTime.now();
  final d1 = DateTime(createdDate.year, createdDate.month, createdDate.day);
  final d2 = DateTime(now.year, now.month, now.day);
  final diffDays = d2.difference(d1).inDays;
  if (diffDays <= 0) {
    return 'Today';
  } else if (diffDays == 1) {
    return '1 day ago';
  } else {
    return '$diffDays days ago';
  }
}

class CourseDetailPage extends ConsumerStatefulWidget {
  const CourseDetailPage({super.key, required this.courseId});
  final String courseId;

  @override
  ConsumerState<CourseDetailPage> createState() => _CourseDetailPageState();
}

class _CourseDetailPageState extends ConsumerState<CourseDetailPage> {
  int _activeTabIndex = 0;
  final Set<String> _expandedTopicIds = {};
  bool _initializedExpansion = false;

  Color _accentOf(Map<String, dynamic> course) {
    final enrollmentType =
        (course['enrollmentType'] as String?)?.trim().toUpperCase();
    final isRecorded = enrollmentType == null ||
        enrollmentType.isEmpty ||
        (enrollmentType != 'LIVE' &&
            enrollmentType != 'FREE' &&
            enrollmentType != 'DEMO');
    if (isRecorded) return const Color(0xFF4B5563);
    final hex = (course['color'] as String?)?.trim();
    if (hex == null || hex.isEmpty) return const Color(0xFF10B981);
    final clean = hex.replaceAll('#', '');
    if (clean.length == 6) {
      final v = int.tryParse(clean, radix: 16);
      if (v != null) return Color(0xFF000000 | v);
    }
    return const Color(0xFF10B981);
  }

  void _toggleTopic(String topicId) {
    setState(() {
      if (_expandedTopicIds.contains(topicId)) {
        _expandedTopicIds.remove(topicId);
      } else {
        _expandedTopicIds.add(topicId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(courseDetailProvider(widget.courseId));
    final topicsAsync = ref.watch(courseTopicsProvider(widget.courseId));
    ref.watch(courseProgressProvider(widget.courseId));
    final feedbacks = ref.watch(myFeedbackProvider).valueOrNull ?? const [];
    final hasFeedback = feedbacks.any((f) {
      final cid = f['courseId'] ?? (f['course'] as Map?)?['id'];
      return cid == widget.courseId;
    });

    final tokens = context.tokens;
    return Scaffold(
      backgroundColor: tokens.bg,
      body: SafeArea(
        bottom: false,
        child: detailAsync.when(
          loading: () => const _CourseDetailSkeleton(),
          error: (e, _) => _ErrorView(message: e.toString()),
          data: (raw) {
            final course = (raw['course'] as Map<String, dynamic>?) ?? raw;
            final isExpired = (raw['isExpired'] == true) ||
                ((raw['course'] as Map?)?['isExpired'] == true) ||
                (course['isExpired'] == true) ||
                (() {
                  final expStr = (course['expiresAt'] as String?) ??
                      (raw['expiresAt'] as String?);
                  if (expStr == null) return false;
                  final exp = DateTime.tryParse(expStr);
                  return exp != null && exp.isBefore(DateTime.now());
                })();
            final accent = _accentOf(course);
            final count = (course['_count'] as Map<String, dynamic>?) ?? {};
            final topics = topicsAsync.valueOrNull ?? const [];
            final topicsCount = (count['topics'] as int?) ?? topics.length;
            final lecturesCount = (count['lectures'] as int?) ??
                topics.fold<int>(0, (sum, t) {
                  final c = (t['content'] as List?) ?? const [];
                  return sum + c.length;
                });

            // Default expand first topic once topics load
            if (!_initializedExpansion && topics.isNotEmpty) {
              final firstId = topics.first['id'] as String?;
              if (firstId != null) {
                _expandedTopicIds.add(firstId);
                _initializedExpansion = true;
              }
            }

            final downloadedGroups =
                ref.watch(downloadedNotesProvider).valueOrNull ?? const {};
            final allDownloads =
                downloadedGroups.values.expand((list) => list).toList();
            final courseName = (course['name'] as String?) ?? '';
            final targetId = widget.courseId.trim();
            final targetName = courseName.toLowerCase().trim();
            final courseDownloads = allDownloads.where((d) {
              final cId = (d['courseId'] as String?)?.trim();
              final cName = (d['courseName'] as String?)?.toLowerCase().trim();
              if (cId != null && targetId.isNotEmpty && cId == targetId) {
                return true;
              }
              if (cName != null &&
                  targetName.isNotEmpty &&
                  cName == targetName) {
                return true;
              }
              return false;
            }).toList();

            return AppRefresh(
              onRefresh: () async {
                ref.invalidate(courseDetailProvider(widget.courseId));
                ref.invalidate(courseTopicsProvider(widget.courseId));
                ref.invalidate(courseProgressProvider(widget.courseId));
                ref.invalidate(downloadedNotesProvider);
                ref.invalidate(myFeedbackProvider);
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.only(bottom: 32),
                children: [
                  // 1. Hero Header Card
                  _CourseHero(
                    course: course,
                    accent: accent,
                    isExpired: isExpired,
                  ),

                  // 2. Tabs: Curriculum, Downloaded Notes, Overview, Feedback
                  _CourseTabBar(
                    activeIndex: _activeTabIndex,
                    downloadsCount: courseDownloads.length,
                    accent: accent,
                    onTabSelected: (index) =>
                        setState(() => _activeTabIndex = index),
                  ),

                  // 3. Tab Content
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    child: _buildTabContent(
                      course: course,
                      topics: topics,
                      accent: accent,
                      topicsCount: topicsCount,
                      lecturesCount: lecturesCount,
                      hasFeedback: hasFeedback,
                      isExpired: isExpired,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildTabContent({
    required Map<String, dynamic> course,
    required List<Map<String, dynamic>> topics,
    required Color accent,
    required int topicsCount,
    required int lecturesCount,
    required bool hasFeedback,
    required bool isExpired,
  }) {
    final courseId = (course['id'] as String?) ?? widget.courseId;
    final courseName = (course['name'] as String?) ?? '';

    if (_activeTabIndex == 0) {
      // Curriculum Tab
      if (isExpired) {
        return _ExpiredCurriculumView(courseName: courseName);
      }
      if (topics.isEmpty) {
        return _EmptyCurriculum();
      }
      return Column(
        children: [
          for (var i = 0; i < topics.length; i++) ...[
            _TopicAccordion(
              index: i + 1,
              topic: topics[i],
              accent: accent,
              isOpen: _expandedTopicIds.contains(topics[i]['id']),
              onToggle: () => _toggleTopic(topics[i]['id'] as String),
              courseId: courseId,
              courseName: courseName,
            ),
            if (i < topics.length - 1) const SizedBox(height: 10),
          ],
        ],
      );
    } else if (_activeTabIndex == 1) {
      // Downloaded Notes Tab
      return _DownloadedNotesTabContent(
        courseId: courseId,
        courseName: courseName,
        accent: accent,
      );
    } else if (_activeTabIndex == 2) {
      // Overview Tab
      return _OverviewTabContent(
        course: course,
        topicsCount: topicsCount,
        lecturesCount: lecturesCount,
        isExpired: isExpired,
      );
    } else {
      // Feedback Tab
      return _FeedbackTabContent(
        course: course,
        hasFeedback: hasFeedback,
        onRefreshFeedback: () => ref.invalidate(myFeedbackProvider),
      );
    }
  }
}

class _CourseDetailSkeleton extends StatelessWidget {
  const _CourseDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: SkeletonBox(height: 172, borderRadius: 24),
        ),
        Container(
          height: 62,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: tokens.border, width: 1.2),
            ),
          ),
          child: const Row(
            children: [
              SkeletonBox(width: 94, height: 18, borderRadius: 7),
              SizedBox(width: 24),
              SkeletonBox(width: 132, height: 18, borderRadius: 7),
              SizedBox(width: 24),
              SkeletonBox(width: 74, height: 18, borderRadius: 7),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 18, 16, 0),
          child: Column(
            children: [
              _TopicSkeleton(expanded: true),
              SizedBox(height: 12),
              _TopicSkeleton(),
              SizedBox(height: 12),
              _TopicSkeleton(),
              SizedBox(height: 12),
              _TopicSkeleton(),
            ],
          ),
        ),
      ],
    );
  }
}

class _TopicSkeleton extends StatelessWidget {
  const _TopicSkeleton({this.expanded = false});

  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        children: [
          const Row(
            children: [
              SkeletonBox(width: 44, height: 44, borderRadius: 12),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonBox(width: 180, height: 16, borderRadius: 6),
                    SizedBox(height: 7),
                    SkeletonBox(width: 72, height: 11, borderRadius: 5),
                  ],
                ),
              ),
              SkeletonBox(width: 20, height: 20, borderRadius: 6),
            ],
          ),
          if (expanded) ...[
            const SizedBox(height: 18),
            const Row(
              children: [
                Expanded(
                  child: SkeletonBox(height: 122, borderRadius: 12),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: SkeletonBox(height: 122, borderRadius: 12),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HERO HEADER
// ─────────────────────────────────────────────────────────────────────────────
class _CourseHero extends StatelessWidget {
  const _CourseHero({
    required this.course,
    required this.accent,
    this.isExpired = false,
  });

  final Map<String, dynamic> course;
  final Color accent;
  final bool isExpired;

  String _badgeText() {
    final enrollmentType = (course['enrollmentType'] as String?)?.toUpperCase();
    final subject = (course['subject'] as String?)?.trim();
    String prefix;
    switch (enrollmentType) {
      case 'LIVE':
        prefix = 'PRO';
        break;
      case 'RECORDED':
        return 'PLUS';
      case 'DEMO':
        prefix = 'DEMO';
        break;
      case 'FREE':
        prefix = 'FREE';
        break;
      default:
        prefix = 'PRO';
    }
    if (subject != null && subject.isNotEmpty) {
      return '$prefix · ${subject.toUpperCase()}';
    }
    return prefix;
  }

  @override
  Widget build(BuildContext context) {
    final title = (course['name'] as String?) ?? 'Course';
    final subject = (course['subject'] as String?)?.trim();
    final badge = _badgeText();
    final enrollmentType =
        (course['enrollmentType'] as String?)?.trim().toUpperCase();
    final isRecorded = enrollmentType == null ||
        enrollmentType.isEmpty ||
        (enrollmentType != 'LIVE' &&
            enrollmentType != 'FREE' &&
            enrollmentType != 'DEMO');

    // Vibrant gradient background or muted slate for expired courses
    final gradientColors = isExpired
        ? const [Color(0xFF374151), Color(0xFF1F2937)]
        : [
            accent,
            isRecorded
                ? const Color(0xFF6B7280)
                : Color.lerp(accent, const Color(0xFF047857), 0.3) ?? accent,
          ];

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: isExpired
                ? Colors.black.withOpacity(0.20)
                : accent.withOpacity(0.24),
            offset: const Offset(0, 6),
            blurRadius: 16,
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          // Decorative glass circles
          Positioned(
            top: -20,
            right: -20,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.12),
              ),
            ),
          ),

          // Content
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Badge Row
                Row(
                  children: [
                    BouncyPressable(
                      onTap: () => context.canPop()
                          ? context.pop()
                          : context.go('/courses'),
                      scaleDown: 0.9,
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.16),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withOpacity(0.24),
                          ),
                        ),
                        child: const Icon(
                          Icons.chevron_left_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (isExpired) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDC2626),
                          borderRadius: BorderRadius.circular(50),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFDC2626).withOpacity(0.4),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.lock_rounded,
                                size: 10.5, color: Colors.white),
                            SizedBox(width: 4),
                            Text(
                              'EXPIRED',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 9.5,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.6,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    // Badge Pill
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.20),
                        borderRadius: BorderRadius.circular(50),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.28),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        badge,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Subject Label (Small Bold Uppercase)
                if (subject != null && subject.isNotEmpty) ...[
                  Text(
                    subject.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: Colors.white.withOpacity(0.85),
                      letterSpacing: 1.1,
                    ),
                  ),
                  const SizedBox(height: 4),
                ],

                // Big Course Title
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.3,
                    height: 1.2,
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. TAB STRIP
// ─────────────────────────────────────────────────────────────────────────────
class _CourseTabBar extends StatelessWidget {
  const _CourseTabBar({
    required this.activeIndex,
    this.downloadsCount,
    required this.accent,
    required this.onTabSelected,
  });

  final int activeIndex;
  final int? downloadsCount;
  final Color accent;
  final ValueChanged<int> onTabSelected;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    final tabs = [
      const _TabItem(title: 'Curriculum'),
      _TabItem(
        title: 'Downloaded Notes',
        count: downloadsCount != null && downloadsCount! > 0
            ? downloadsCount
            : null,
      ),
      const _TabItem(title: 'Overview'),
      const _TabItem(title: 'Feedback'),
    ];

    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: tokens.border, width: 1.2),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        physics: const BouncingScrollPhysics(),
        child: Row(
          children: [
            for (var i = 0; i < tabs.length; i++) ...[
              _TabButton(
                tab: tabs[i],
                isActive: activeIndex == i,
                accent: accent,
                onTap: () => onTabSelected(i),
              ),
              if (i < tabs.length - 1) const SizedBox(width: 18),
            ],
          ],
        ),
      ),
    );
  }
}

class _TabItem {
  const _TabItem({required this.title, this.count});
  final String title;
  final int? count;
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.tab,
    required this.isActive,
    required this.accent,
    required this.onTap,
  });

  final _TabItem tab;
  final bool isActive;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: isActive ? accent : Colors.transparent,
              width: 2.5,
            ),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              tab.title,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: isActive ? FontWeight.w900 : FontWeight.w600,
                color: isActive ? tokens.textPrimary : tokens.textMuted,
              ),
            ),
            if (tab.count != null && tab.count! > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                decoration: BoxDecoration(
                  color: isActive
                      ? const Color(0xFF10B981).withOpacity(0.12)
                      : tokens.surfaceSecondary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${tab.count}',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color:
                        isActive ? const Color(0xFF10B981) : tokens.textMuted,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOWNLOADED NOTES TAB (Course Specific)
// ─────────────────────────────────────────────────────────────────────────────
class _DownloadedNotesTabContent extends ConsumerWidget {
  const _DownloadedNotesTabContent({
    required this.courseId,
    required this.courseName,
    required this.accent,
  });

  final String courseId;
  final String courseName;
  final Color accent;

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(0)} KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
  }

  void _confirmDeleteSingle(
      BuildContext context, WidgetRef ref, String contentId, String title) {
    final tokens = context.tokens;
    final user = ref.read(authStateProvider).value;
    if (user == null) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: tokens.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Delete Download?',
          style: TextStyle(
            color: tokens.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 16,
          ),
        ),
        content: Text(
          'Are you sure you want to delete "$title" from downloads?',
          style: TextStyle(
            color: tokens.textSecondary,
            fontSize: 13.5,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Cancel',
              style: TextStyle(color: tokens.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final manager = ref.read(downloadManagerProvider);
              await manager.deleteDownload(user.id, contentId);
              ref.invalidate(downloadStatusProvider(contentId));
              ref.invalidate(downloadedNotesProvider);
              ref.invalidate(totalDownloadSizeProvider);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Download deleted.'),
                    duration: Duration(milliseconds: 1400),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            child: const Text(
              'Delete',
              style: TextStyle(
                color: Color(0xFFEF4444),
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final notesAsync = ref.watch(downloadedNotesProvider);

    return notesAsync.when(
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Failed to load downloads',
            style: TextStyle(color: tokens.textSecondary),
          ),
        ),
      ),
      data: (groups) {
        final allDownloads = groups.values.expand((list) => list).toList();
        final targetId = courseId.trim();
        final targetName = courseName.toLowerCase().trim();

        final courseDownloads = allDownloads.where((d) {
          final cId = (d['courseId'] as String?)?.trim();
          final cName = (d['courseName'] as String?)?.toLowerCase().trim();

          if (cId != null && targetId.isNotEmpty && cId == targetId) {
            return true;
          }
          if (cName != null && targetName.isNotEmpty && cName == targetName) {
            return true;
          }
          return false;
        }).toList();

        if (courseDownloads.isEmpty) {
          return Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.symmetric(vertical: 42, horizontal: 20),
            decoration: BoxDecoration(
              color: tokens.cardBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: tokens.border),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: accent.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.file_download_outlined,
                    size: 32,
                    color: accent,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'No Downloaded Notes',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Download any material or lecture PDF from this course and view it here even offline.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: tokens.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < courseDownloads.length; i++) ...[
              _CourseDownloadItemCard(
                item: courseDownloads[i],
                accent: accent,
                formatBytes: _formatBytes,
                onDelete: () => _confirmDeleteSingle(
                  context,
                  ref,
                  courseDownloads[i]['contentId'] as String,
                  courseDownloads[i]['title'] as String,
                ),
                onTap: () {
                  final item = courseDownloads[i];
                  final contentId = item['contentId'] as String;
                  final title = item['title'] as String;
                  final contentType =
                      (item['contentType'] as String?) ?? 'CONTENT';
                  final localPath = item['localPath'] as String;

                  final uri = Uri(
                    path: '/material',
                    queryParameters: {
                      'contentId': contentId,
                      'title': title,
                      'contentType': contentType,
                      'localPath': localPath,
                      'courseId': courseId,
                      'courseName': courseName,
                    },
                  );
                  context.push(uri.toString());
                },
              ),
              if (i < courseDownloads.length - 1) const SizedBox(height: 10),
            ],
          ],
        );
      },
    );
  }
}

class _CourseDownloadItemCard extends StatelessWidget {
  const _CourseDownloadItemCard({
    required this.item,
    required this.accent,
    required this.formatBytes,
    required this.onDelete,
    required this.onTap,
  });

  final Map<String, dynamic> item;
  final Color accent;
  final String Function(int) formatBytes;
  final VoidCallback onDelete;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = (item['title'] as String?) ?? 'Notes';
    final fileSize = (item['fileSize'] as int?) ?? 0;
    final downloadedAtStr = item['downloadedAt'] as String?;
    DateTime? downloadedAt;
    if (downloadedAtStr != null) {
      downloadedAt = DateTime.tryParse(downloadedAtStr);
    }

    return BouncyPressable(
      onTap: onTap,
      scaleDown: 0.99,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: tokens.border),
          boxShadow: AppShadows.sm,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: accent.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(
                Icons.picture_as_pdf_rounded,
                color: accent,
                size: 22,
              ),
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
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        formatBytes(fileSize),
                        style: TextStyle(
                          color: tokens.textSecondary,
                          fontSize: 11.5,
                        ),
                      ),
                      if (downloadedAt != null) ...[
                        Text(
                          ' · ',
                          style: TextStyle(
                            color: tokens.textMuted,
                            fontSize: 11,
                          ),
                        ),
                        Text(
                          DateFormat('d MMM yyyy').format(downloadedAt),
                          style: TextStyle(
                            color: tokens.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Delete download',
              icon: Icon(
                Icons.delete_outline_rounded,
                color: tokens.textMuted,
                size: 20,
              ),
              onPressed: onDelete,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CURRICULUM TAB: TOPIC ACCORDION & 2-COLUMN GRID
// ─────────────────────────────────────────────────────────────────────────────
class _TopicAccordion extends StatelessWidget {
  const _TopicAccordion({
    required this.index,
    required this.topic,
    required this.accent,
    required this.isOpen,
    required this.onToggle,
    required this.courseId,
    required this.courseName,
  });

  final int index;
  final Map<String, dynamic> topic;
  final Color accent;
  final bool isOpen;
  final VoidCallback onToggle;
  final String courseId;
  final String courseName;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = (topic['title'] as String?) ?? 'Topic';
    final contents = (topic['content'] as List?) ?? const [];
    final count = contents.length;

    return Container(
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tokens.border),
        boxShadow: AppShadows.sm,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Bar
          InkWell(
            onTap: onToggle,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              decoration: BoxDecoration(
                border: Border(
                  left: BorderSide(color: accent, width: 4),
                  bottom: isOpen
                      ? BorderSide(color: tokens.border, width: 1)
                      : BorderSide.none,
                ),
              ),
              child: Row(
                children: [
                  // Number Box (e.g. 01)
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: accent.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      index.toString().padLeft(2, '0'),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: accent,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Title & Lecture count
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: tokens.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$count lecture${count != 1 ? 's' : ''}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: tokens.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Expansion Chevron
                  Icon(
                    isOpen
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: tokens.textMuted,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),

          // Expanded 2-Column Grid
          if (isOpen) ...[
            if (contents.isEmpty)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Center(
                  child: Text(
                    'No lectures in this topic yet',
                    style: TextStyle(
                      fontSize: 12,
                      color: tokens.textMuted,
                    ),
                  ),
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.all(12),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final width = (constraints.maxWidth - 12) / 2;
                    return Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        for (final item in contents)
                          SizedBox(
                            width: width,
                            child: _LectureGridCard(
                              item: item as Map<String, dynamic>,
                              courseId: courseId,
                              courseName: courseName,
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. REDESIGNED LECTURE GRID CARD (16:9 Thumbnail + Info)
// ─────────────────────────────────────────────────────────────────────────────
class _LectureGridCard extends ConsumerWidget {
  const _LectureGridCard({
    required this.item,
    required this.courseId,
    required this.courseName,
  });
  final Map<String, dynamic> item;
  final String courseId;
  final String courseName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final title = (item['title'] as String?) ?? 'Lecture';
    final videoUrl = item['videoUrl'] as String?;
    final youtubeUrl = item['youtubeUrl'] as String?;
    final pptUrl = item['pptUrl'] as String?;
    final id = item['id'] as String?;
    final createdAt = item['createdAt'] as String?;
    String? youtubeSource;
    for (final candidate in [youtubeUrl, videoUrl]) {
      if (candidate != null && YouTubeUtils.extractVideoId(candidate) != null) {
        youtubeSource = candidate;
        break;
      }
    }

    final isVideo = (videoUrl != null && videoUrl.isNotEmpty) ||
        (youtubeUrl != null && youtubeUrl.isNotEmpty);
    final isDrive = youtubeSource == null;

    final isDownloaded = !isVideo && id != null
        ? ref.watch(downloadStatusProvider(id)).valueOrNull != null
        : false;

    final uploadAge = _getUploadAge(createdAt);

    void handleClick() {
      if (isVideo) {
        final uri = Uri(
          path: '/watch',
          queryParameters: isDrive
              ? {
                  'source': 'drive',
                  if (id != null) 'contentId': id,
                  'title': title,
                  'courseId': courseId,
                  'courseName': courseName,
                }
              : {
                  'source': 'youtube',
                  'url': youtubeSource!,
                  if (id != null) 'contentId': id,
                  'title': title,
                  'courseId': courseId,
                  'courseName': courseName,
                },
        );
        context.push(uri.toString());
      } else if (pptUrl != null && pptUrl.isNotEmpty) {
        if (id != null) {
          final uri = Uri(
            path: '/material',
            queryParameters: {
              'contentId': id,
              'title': title,
              'contentType': 'CONTENT',
              'courseId': courseId,
              'courseName': courseName,
            },
          );
          context.push(uri.toString());
        }
      }
    }

    return InkWell(
      onTap: handleClick,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        decoration: BoxDecoration(
          color: tokens.surfaceSecondary,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: tokens.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 16:9 Thumbnail Box
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: context.isDark
                          ? const Color(0xFF1B223C)
                          : const Color(0xFF94A3B8).withOpacity(0.32),
                      border: Border(
                        bottom: BorderSide(color: tokens.border, width: 1),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: isVideo
                        ? const Icon(
                            Icons.play_arrow_rounded,
                            size: 38,
                            color: Color(0xFF6366F1),
                          )
                        : const Icon(
                            Icons.description_outlined,
                            size: 30,
                            color: Color(0xFF6366F1),
                          ),
                  ),
                  if (isDownloaded)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check, size: 10, color: Colors.white),
                            SizedBox(width: 2),
                            Text(
                              'Offline',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Info Footer
            Padding(
              padding: const EdgeInsets.fromLTRB(9, 7, 9, 9),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    uploadAge,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w500,
                      color: tokens.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. OVERVIEW TAB CONTENT
// ─────────────────────────────────────────────────────────────────────────────
class _OverviewTabContent extends StatelessWidget {
  const _OverviewTabContent({
    required this.course,
    required this.topicsCount,
    required this.lecturesCount,
    this.isExpired = false,
  });

  final Map<String, dynamic> course;
  final int topicsCount;
  final int lecturesCount;
  final bool isExpired;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final description = (course['description'] as String?)?.trim() ?? '';
    final subject = (course['subject'] as String?)?.trim() ?? '—';
    final mentor = (course['teacherName'] as String?)?.trim() ?? 'Mentor';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isExpired) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark
                  ? const Color(0xFF450A0A).withOpacity(0.5)
                  : const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: isDark
                    ? const Color(0xFF7F1D1D)
                    : const Color(0xFFFCA5A5),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF7F1D1D).withOpacity(0.6)
                        : const Color(0xFFFEE2E2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.lock_outline_rounded,
                    color: Color(0xFFDC2626),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Course Access Expired',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: isDark
                              ? const Color(0xFFFCA5A5)
                              : const Color(0xFF991B1B),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Your enrollment period has ended. Lectures and curriculum materials can no longer be accessed.',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: isDark
                              ? const Color(0xFFF87171)
                              : const Color(0xFFB91C1C),
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],

        // Card 1: ABOUT THIS COURSE
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: tokens.cardBg,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: tokens.border),
            boxShadow: AppShadows.sm,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ABOUT THIS COURSE',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  color: tokens.textMuted,
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                description.isEmpty
                    ? 'No description provided yet. Check the curriculum tab for the full lecture list.'
                    : description,
                style: TextStyle(
                  fontSize: 13.5,
                  height: 1.45,
                  color: tokens.textSecondary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Card 2: 2x2 Stats Grid (SUBJECT, MENTOR, MODULES, LESSONS)
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: tokens.cardBg,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: tokens.border),
            boxShadow: AppShadows.sm,
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _OverviewStat(label: 'SUBJECT', value: subject),
                  ),
                  Expanded(
                    child: _OverviewStat(label: 'MENTOR', value: mentor),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child:
                        _OverviewStat(label: 'MODULES', value: '$topicsCount'),
                  ),
                  Expanded(
                    child: _OverviewStat(
                        label: 'LESSONS', value: '$lecturesCount'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OverviewStat extends StatelessWidget {
  const _OverviewStat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: tokens.textMuted,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w800,
            color: tokens.textPrimary,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. FEEDBACK TAB CONTENT
// ─────────────────────────────────────────────────────────────────────────────
class _FeedbackTabContent extends StatelessWidget {
  const _FeedbackTabContent({
    required this.course,
    required this.hasFeedback,
    required this.onRefreshFeedback,
  });

  final Map<String, dynamic> course;
  final bool hasFeedback;
  final VoidCallback onRefreshFeedback;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    if (hasFeedback) {
      // Feedback Submitted State (Matching Screenshot 3)
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: tokens.border),
          boxShadow: AppShadows.sm,
        ),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF10B981),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.check, color: Colors.white, size: 30),
            ),
            const SizedBox(height: 18),
            Text(
              'Feedback Submitted',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Thank you for sharing your experience! Your private review helps us improve the learning quality.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.45,
                color: tokens.textSecondary,
              ),
            ),
          ],
        ),
      );
    }

    // Feedback Not Submitted State
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: tokens.border),
        boxShadow: AppShadows.sm,
      ),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: tokens.primaryAccent.withOpacity(0.12),
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.star_outline_rounded,
              color: tokens.primaryAccent,
              size: 28,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            "How's your learning experience?",
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: tokens.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            'Your feedback helps us continuously improve the course content and mentorship.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.4,
              color: tokens.textSecondary,
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton(
              onPressed: () async {
                final result = await RateCourseSheet.show(
                  context,
                  courseId: (course['id'] as String?) ?? '',
                  courseName: (course['name'] as String?) ?? 'Course',
                );
                if (result == true) {
                  onRefreshFeedback();
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: tokens.primaryAccent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: const Text(
                'Write a Review',
                style: TextStyle(
                  fontSize: 14,
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. HELPER EMPTY & ERROR VIEWS
// ─────────────────────────────────────────────────────────────────────────────
class _EmptyCurriculum extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.menu_book_outlined, color: tokens.textMuted, size: 40),
          const SizedBox(height: 10),
          Text(
            'No content yet',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: tokens.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Topics and lectures will appear here once your instructor adds them.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12.5,
              color: tokens.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ExpiredCurriculumView extends StatelessWidget {
  const _ExpiredCurriculumView({required this.courseName});
  final String courseName;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? const Color(0xFF7F1D1D) : const Color(0xFFFECACA),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark
                  ? const Color(0xFF450A0A)
                  : const Color(0xFFFEE2E2),
            ),
            child: const Icon(
              Icons.lock_clock_rounded,
              color: Color(0xFFDC2626),
              size: 34,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Access Expired',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: tokens.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            courseName.isNotEmpty
                ? 'Your access to $courseName has expired. You can no longer view the course lectures or curriculum materials.'
                : 'Your access to this course has expired. You can no longer view the course lectures or curriculum materials.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: tokens.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/courses');
              }
            },
            icon: const Icon(Icons.arrow_back_rounded, size: 16),
            label: const Text(
              'Back to Courses',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: tokens.textPrimary,
              side: BorderSide(color: tokens.border),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off, color: tokens.textMuted, size: 40),
            const SizedBox(height: 8),
            Text(
              'Could not load course',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: tokens.textPrimary,
              ),
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
        ),
      ),
    );
  }
}
