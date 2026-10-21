import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/drive/secure_drive_player.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/secure_window.dart';
import '../../shared/widgets/youtube/secure_youtube_player.dart';
import '../../shared/widgets/youtube/youtube_utils.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_typography.dart';
import '../../theme/app_theme_tokens.dart';

/// Shown by the router when /watch is opened without a usable source.
class MissingVideoPage extends StatelessWidget {
  const MissingVideoPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: Text(
          'Missing or invalid video URL.',
          style: TextStyle(color: Colors.white),
        ),
      ),
    );
  }
}

/// What kind of video the WatchPage should render.
enum VideoSource { youtube, drive }

/// Renders a lecture in a black full-bleed scaffold with native anti-piracy protection.
class WatchPage extends ConsumerStatefulWidget {
  const WatchPage({
    super.key,
    required this.source,
    this.youtubeVideoId,
    this.driveContentId,
    this.contentId,
    this.title,
    this.courseId,
    this.courseName,
    this.localPath,
    this.isLive = false,
  }) : assert(
          (source == VideoSource.youtube && youtubeVideoId != null) ||
              (source == VideoSource.drive && driveContentId != null),
          'Need the right id for the chosen source',
        );

  final VideoSource source;
  final String? youtubeVideoId;
  final String? driveContentId;
  final String? contentId;
  final String? title;
  final String? courseId;
  final String? courseName;
  final String? localPath;
  final bool isLive;

  /// Router glue — accepts both the new `?source=` shape and legacy query params.
  static WatchPage? fromQuery(Map<String, String> query) {
    final src = query['source']?.toLowerCase();
    final title = query['title'];
    final live = query['live'] == 'true' || query['live'] == '1';
    final courseId = query['courseId'];
    final courseName = query['courseName'];
    final localPath = query['localPath'];
    final contentId = query['contentId'] ?? query['lectureId'];

    if (src == 'drive') {
      final driveId = contentId ?? query['id'];
      if (driveId == null || driveId.isEmpty) return null;
      return WatchPage(
        source: VideoSource.drive,
        driveContentId: driveId,
        contentId: driveId,
        title: title,
        courseId: courseId,
        courseName: courseName,
        localPath: localPath,
      );
    }

    // YouTube path — accept ?id=, ?url=, or sniff a Drive URL passed via ?url=
    final url = query['url'];
    if (url != null && _isDriveUrl(url)) {
      final contentId = query['contentId'] ?? query['id'];
      if (contentId == null || contentId.isEmpty) return null;
      return WatchPage(
        source: VideoSource.drive,
        driveContentId: contentId,
        contentId: contentId,
        title: title,
        courseId: courseId,
        courseName: courseName,
        localPath: localPath,
      );
    }

    final id = query['id'];
    final resolved =
        id ?? (url != null ? YouTubeUtils.extractVideoId(url) : null);
    if (resolved == null || resolved.isEmpty) return null;
    final hintedLive = live || (url != null && YouTubeUtils.isLikelyLive(url));
    return WatchPage(
      source: VideoSource.youtube,
      youtubeVideoId: resolved,
      contentId: contentId,
      title: title,
      courseId: courseId,
      courseName: courseName,
      isLive: hintedLive,
    );
  }

  static bool _isDriveUrl(String url) {
    final s = url.toLowerCase();
    return s.contains('drive.google.com') || s.contains('docs.google.com');
  }

  @override
  ConsumerState<WatchPage> createState() => _WatchPageState();
}

class _WatchPageState extends ConsumerState<WatchPage> {
  final GlobalKey _playerKey = GlobalKey();
  final TextEditingController _commentController = TextEditingController();
  bool _isScreenLocked = false;
  bool _isCompleted = false;
  bool _isDetailsLoading = true;
  bool _isPostingComment = false;
  Map<String, dynamic>? _lecture;
  List<Map<String, dynamic>> _comments = const [];
  String? _detailsError;

  @override
  void initState() {
    super.initState();
    SecureWindow.enable();
    SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.portraitUp,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    _loadLectureDetails();
  }

  @override
  void dispose() {
    _commentController.dispose();
    SecureWindow.disable();
    SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.portraitUp,
    ]);
    SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.edgeToEdge,
      overlays: SystemUiOverlay.values,
    );
    super.dispose();
  }

  String? get _lectureContentId => widget.contentId ?? widget.driveContentId;

  Future<void> _loadLectureDetails() async {
    final contentId = _lectureContentId;
    if (contentId == null || contentId.isEmpty) {
      if (mounted) setState(() => _isDetailsLoading = false);
      return;
    }

    try {
      final client = ref.read(apiClientProvider);
      final detailPath = widget.courseId != null && widget.courseId!.isNotEmpty
          ? '/api/content/$contentId?courseId=${Uri.encodeQueryComponent(widget.courseId!)}'
          : '/api/content/$contentId';
      final responses = await Future.wait([
        client.get<dynamic>(detailPath),
        client.get<dynamic>('/api/content/$contentId/comments'),
      ]);
      final detailData = responses[0].data;
      final commentsData = responses[1].data;
      if (!mounted) return;
      setState(() {
        _lecture =
            detailData is Map ? Map<String, dynamic>.from(detailData) : null;
        _comments = commentsData is List
            ? commentsData
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList()
            : const [];
        _detailsError = null;
        _isDetailsLoading = false;
      });
      try {
        await client.post('/api/lectures/progress', body: {
          'contentId': contentId,
          'status': 'IN_PROGRESS',
        });
      } catch (_) {
        // Lecture details and discussion remain usable if progress sync fails.
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _detailsError = error.toString();
        _isDetailsLoading = false;
      });
    }
  }

  Future<void> _postComment({String? parentId, String? replyText}) async {
    final contentId = _lectureContentId;
    final text = (replyText ?? _commentController.text).trim();
    if (contentId == null || text.isEmpty || _isPostingComment) return;

    setState(() => _isPostingComment = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.post('/api/content/$contentId/comments', body: {
        'content': text,
        'parentId': parentId,
      });
      if (parentId == null) _commentController.clear();
      await _loadLectureDetails();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not post comment: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _isPostingComment = false);
    }
  }

  Future<void> _showReplyComposer(Map<String, dynamic> comment) async {
    final controller = TextEditingController();
    final text = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Reply', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                hintText: 'Write your reply...',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => Navigator.pop(context, controller.text),
              child: const Text('Post Reply'),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (text != null && text.trim().isNotEmpty) {
      await _postComment(parentId: comment['id'] as String?, replyText: text);
    }
  }

  Future<void> _markCompleted() async {
    final contentId = _lectureContentId;
    if (contentId == null || _isCompleted) return;

    try {
      final client = ref.read(apiClientProvider);
      await client.post('/api/lectures/progress', body: {
        'contentId': contentId,
        'status': 'COMPLETED',
      });
      if (mounted) {
        setState(() => _isCompleted = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Lecture marked as completed!'),
            duration: Duration(seconds: 2),
            backgroundColor: Color(0xFF34C759),
          ),
        );
      }
    } catch (_) {
      // Progress queue handles offline/background sync
    }
  }

  Widget _buildPlayer() {
    switch (widget.source) {
      case VideoSource.youtube:
        return SecureYouTubePlayer(
          key: _playerKey,
          videoId: widget.youtubeVideoId!,
          isLive: widget.isLive,
          title: null,
          autoplay: true,
        );
      case VideoSource.drive:
        return SecureDrivePlayer(
          key: _playerKey,
          contentId: widget.driveContentId!,
          title: widget.title,
          localPathOverride: widget.localPath,
          aspectRatio: 16 / 9,
          autoplay: true,
        );
    }
  }

  Widget _playerLayer() {
    return Stack(
      fit: StackFit.expand,
      children: [
        _buildPlayer(),
        if (_isScreenLocked)
          Positioned.fill(child: Container(color: Colors.transparent)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;
    final user = ref.watch(authStateProvider).value;

    if (isLandscape) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            Center(
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: _playerLayer(),
              ),
            ),
            if (_isScreenLocked)
              Positioned(
                top: 16,
                right: 16,
                child: FloatingActionButton.small(
                  backgroundColor: Colors.black54,
                  foregroundColor: Colors.white,
                  onPressed: () => setState(() => _isScreenLocked = false),
                  child: const Icon(Icons.lock_open, size: 20),
                ),
              ),
          ],
        ),
      );
    }

    final tokens = context.tokens;
    final lecture = _lecture;
    final topic = lecture?['topic'] as Map?;
    final course = topic?['course'] as Map?;
    final title = (lecture?['title'] as String?) ?? widget.title ?? 'Lecture';
    final description = (lecture?['description'] as String?)?.trim();
    final topicTitle = (topic?['title'] as String?)?.trim();
    final courseName =
        (course?['name'] as String?)?.trim() ?? widget.courseName;
    final hasMaterial =
        (lecture?['pptUrl'] as String?)?.trim().isNotEmpty == true;
    final contentId = _lectureContentId;

    return Scaffold(
      backgroundColor: tokens.bg,
      body: SafeArea(
        child: Column(
          children: [
            ColoredBox(
              color: Colors.black,
              child: _TopBar(
                title: title,
                isLocked: _isScreenLocked,
                onToggleLock: () =>
                    setState(() => _isScreenLocked = !_isScreenLocked),
                onMarkCompleted: contentId != null ? _markCompleted : null,
                isCompleted: _isCompleted,
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadLectureDetails,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 32),
                  children: [
                    ColoredBox(
                      color: Colors.black,
                      child: AspectRatio(
                        aspectRatio: 16 / 9,
                        child: _playerLayer(),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (courseName?.isNotEmpty == true)
                            Text(
                              courseName!.toUpperCase(),
                              style: TextStyle(
                                color: tokens.primaryAccent,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.8,
                              ),
                            ),
                          if (courseName?.isNotEmpty == true)
                            const SizedBox(height: 7),
                          Text(
                            title,
                            style: TextStyle(
                              color: tokens.textPrimary,
                              fontSize: 26,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.7,
                              height: 1.15,
                            ),
                          ),
                          if (topicTitle?.isNotEmpty == true) ...[
                            const SizedBox(height: 7),
                            Text(
                              topicTitle!,
                              style: TextStyle(
                                color: tokens.textSecondary,
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                          if (description?.isNotEmpty == true) ...[
                            const SizedBox(height: 14),
                            Text(
                              description!,
                              style: TextStyle(
                                color: tokens.textSecondary,
                                fontSize: 15,
                                height: 1.5,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (_isDetailsLoading)
                      const Padding(
                        padding: EdgeInsets.all(28),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (_detailsError != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                        child: Text(
                          'Some lecture details could not be loaded. Pull down to retry.',
                          style: TextStyle(color: tokens.textMuted),
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: _StudyMaterialsCard(
                        hasMaterial: hasMaterial,
                        onOpen: contentId == null
                            ? null
                            : () {
                                final uri = Uri(
                                  path: '/material',
                                  queryParameters: {
                                    'contentId': contentId,
                                    'title': title,
                                    'contentType': 'CONTENT',
                                    if (widget.courseId != null)
                                      'courseId': widget.courseId!,
                                    if (courseName != null)
                                      'courseName': courseName,
                                  },
                                );
                                context.push(uri.toString());
                              },
                      ),
                    ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: _DiscussionCard(
                        comments: _comments,
                        controller: _commentController,
                        isPosting: _isPostingComment,
                        userName: user?.name,
                        userAvatar: user?.avatar,
                        onPost: _postComment,
                        onReply: _showReplyComposer,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.title,
    required this.isLocked,
    required this.onToggleLock,
    this.onMarkCompleted,
    this.isCompleted = false,
  });

  final String? title;
  final bool isLocked;
  final VoidCallback onToggleLock;
  final VoidCallback? onMarkCompleted;
  final bool isCompleted;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 6, 12, 8),
      child: Row(
        children: [
          IconButton(
            color: AppColors.textInverse,
            icon: const Icon(Icons.chevron_left),
            onPressed: () {
              SystemChrome.setPreferredOrientations(
                  [DeviceOrientation.portraitUp]);
              SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/courses');
              }
            },
          ),
          Expanded(
            child: Text(
              title ?? 'Lecture',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.title.copyWith(
                color: AppColors.textInverse,
                fontSize: 15,
              ),
            ),
          ),
          if (onMarkCompleted != null)
            IconButton(
              tooltip: isCompleted ? 'Completed' : 'Mark Completed',
              icon: Icon(
                isCompleted ? Icons.check_circle : Icons.check_circle_outline,
                color: isCompleted ? const Color(0xFF34C759) : Colors.white70,
                size: 22,
              ),
              onPressed: onMarkCompleted,
            ),
          IconButton(
            tooltip:
                isLocked ? 'Unlock Screen Controls' : 'Lock Screen Controls',
            icon: Icon(
              isLocked ? Icons.lock : Icons.lock_open,
              color: isLocked ? const Color(0xFFFF9500) : Colors.white70,
              size: 22,
            ),
            onPressed: onToggleLock,
          ),
        ],
      ),
    );
  }
}

class _StudyMaterialsCard extends StatelessWidget {
  const _StudyMaterialsCard({required this.hasMaterial, this.onOpen});

  final bool hasMaterial;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: AppShadows.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Study Materials',
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 14),
          if (hasMaterial)
            ApplePressable(
              onTap: onOpen,
              pressedScale: 0.98,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: tokens.surfaceSecondary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF5856D6), Color(0xFF7D7AFF)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Symbols.description_rounded,
                          fill: 1, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Download Notes',
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    Icon(Symbols.arrow_forward_ios_rounded,
                        weight: 700, size: 14, color: tokens.textMuted),
                  ],
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No material available for this lecture.',
                textAlign: TextAlign.center,
                style: TextStyle(color: tokens.textMuted, fontSize: 14),
              ),
            ),
        ],
      ),
    );
  }
}

class _DiscussionCard extends StatelessWidget {
  const _DiscussionCard({
    required this.comments,
    required this.controller,
    required this.isPosting,
    required this.onPost,
    required this.onReply,
    this.userName,
    this.userAvatar,
  });

  final List<Map<String, dynamic>> comments;
  final TextEditingController controller;
  final bool isPosting;
  final String? userName;
  final String? userAvatar;
  final Future<void> Function({String? parentId, String? replyText}) onPost;
  final Future<void> Function(Map<String, dynamic>) onReply;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: AppShadows.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Symbols.forum_rounded,
                  fill: 1, color: tokens.primaryAccent, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Discussion & Q&A',
                  style: TextStyle(
                    color: tokens.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.4,
                  ),
                ),
              ),
              Text(
                '${comments.length} Comment${comments.length == 1 ? '' : 's'}',
                style: TextStyle(
                  color: tokens.textMuted,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CommentAvatar(name: userName, avatar: userAvatar, size: 34),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: controller,
                      minLines: 2,
                      maxLines: 5,
                      style: TextStyle(
                          color: tokens.textPrimary, fontSize: 16, height: 1.35),
                      decoration: InputDecoration(
                        hintText: 'Ask a question or share your thoughts...',
                        hintStyle:
                            TextStyle(color: tokens.textMuted, fontSize: 16),
                        filled: true,
                        fillColor: tokens.surfaceSecondary,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                              color: tokens.primaryAccent, width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          shape: const StadiumBorder(),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 18, vertical: 10),
                        ),
                        onPressed: isPosting ? null : () => onPost(),
                        icon: isPosting
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Symbols.arrow_upward_rounded, weight: 700, size: 18),
                        label: const Text('Post'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (comments.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                'No comments yet. Be the first to start the discussion!',
                textAlign: TextAlign.center,
                style: TextStyle(color: tokens.textMuted, fontSize: 14),
              ),
            )
          else
            for (final comment in comments)
              _CommentTile(comment: comment, onReply: onReply),
        ],
      ),
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({
    required this.comment,
    required this.onReply,
    this.depth = 0,
  });

  final Map<String, dynamic> comment;
  final Future<void> Function(Map<String, dynamic>) onReply;
  final int depth;

  String _dateLabel(Object? value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (date == null) return '';
    final now = DateTime.now();
    final days = now.difference(date).inDays;
    if (days <= 0) return 'Today';
    if (days == 1) return '1 day ago';
    if (days < 30) return '$days days ago';
    return '${date.day}/${date.month}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final user = comment['user'] as Map?;
    final name = (user?['name'] as String?)?.trim() ?? 'Student';
    final avatar = user?['avatar'] as String?;
    final role = (user?['role'] as String?)?.toUpperCase();
    final replies = (comment['replies'] as List?)
            ?.whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList() ??
        const <Map<String, dynamic>>[];

    return Container(
      margin: EdgeInsets.only(top: 14, left: depth > 0 ? 28 : 0),
      padding: depth > 0 ? const EdgeInsets.only(left: 10) : EdgeInsets.zero,
      decoration: depth > 0
          ? BoxDecoration(
              border: Border(left: BorderSide(color: tokens.border, width: 2)),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CommentAvatar(name: name, avatar: avatar, size: 36),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 7,
                      runSpacing: 3,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          name,
                          style: TextStyle(
                            color: tokens.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            letterSpacing: -0.2,
                          ),
                        ),
                        if (role == 'ADMIN' || role == 'MANAGER')
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: tokens.primaryAccent,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              role == 'MANAGER' ? 'Manager' : 'Admin',
                              style: TextStyle(
                                color: tokens.onPrimaryAccent,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        Text(
                          _dateLabel(comment['createdAt']),
                          style:
                              TextStyle(color: tokens.textMuted, fontSize: 12.5),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      (comment['content'] as String?) ?? '',
                      style: TextStyle(
                        color: tokens.textSecondary,
                        fontSize: 14,
                        height: 1.4,
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () => onReply(comment),
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, 32),
                      ),
                      icon: const Icon(Symbols.reply_rounded, weight: 600, size: 18),
                      label: const Text('Reply'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          for (final reply in replies)
            _CommentTile(comment: reply, onReply: onReply, depth: depth + 1),
        ],
      ),
    );
  }
}

class _CommentAvatar extends StatelessWidget {
  const _CommentAvatar({this.name, this.avatar, required this.size});

  final String? name;
  final String? avatar;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final initial =
        name?.trim().isNotEmpty == true ? name!.trim()[0].toUpperCase() : '?';
    return ClipOval(
      child: Container(
        width: size,
        height: size,
        color: tokens.primaryAccent.withValues(alpha: 0.14),
        alignment: Alignment.center,
        child: avatar?.trim().isNotEmpty == true
            ? Image.network(
                avatar!,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Text(initial),
              )
            : Text(
                initial,
                style: TextStyle(
                  color: tokens.primaryAccent,
                  fontWeight: FontWeight.w800,
                ),
              ),
      ),
    );
  }
}
