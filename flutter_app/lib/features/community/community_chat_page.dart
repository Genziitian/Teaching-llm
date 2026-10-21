import 'dart:async';
import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/auth/auth_providers.dart';
import 'community_attachment.dart';
import 'community_page.dart' show communityCourseLook;
import 'community_file_upload.dart';
import '../../core/models/course.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/social_card_dialog.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme_tokens.dart';
import '../courses/course_detail_page.dart' show courseDetailProvider;
import '../courses/courses_page.dart' show coursesProvider;
import '../../shared/widgets/shimmer_loading.dart';

/// GET /api/community/[courseId]/messages → list of messages oldest→newest.
final communityMessagesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, courseId) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/community/$courseId/messages');
    final list = res.data is List ? res.data as List : const [];
    return [for (final j in list) j as Map<String, dynamic>];
  } catch (e) {
    debugPrint('Error fetching community messages for $courseId: $e');
    return const [];
  }
});

/// GET /api/community/[courseId]/messages/pinned → the message a manager
/// pinned for this community, or null when nothing is pinned.
final communityPinnedMessageProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, courseId) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res =
        await api.get<dynamic>('/api/community/$courseId/messages/pinned');
    final data = res.data;
    if (data is Map && data['pinnedMessage'] is Map) {
      return Map<String, dynamic>.from(data['pinnedMessage'] as Map);
    }
    return null;
  } catch (e) {
    debugPrint('Error fetching pinned message for $courseId: $e');
    return null;
  }
});

class CommunityChatPage extends ConsumerStatefulWidget {
  const CommunityChatPage({super.key, required this.courseId});
  final String courseId;

  @override
  ConsumerState<CommunityChatPage> createState() =>
      _CommunityChatPageState();
}

class _CommunityChatPageState extends ConsumerState<CommunityChatPage> {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  final _focusNode = FocusNode();
  Timer? _pollTimer;
  int _pollTick = 0;
  bool _sending = false;
  bool _uploadingAttachment = false;
  bool _isMuted = false;
  Map<String, dynamic>? _stagedAttachment;
  Map<String, dynamic>? _replyingTo;

  @override
  void initState() {
    super.initState();
    _loadMutePreference();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (mounted) {
        ref.invalidate(communityMessagesProvider(widget.courseId));
        // The pinned message changes rarely — re-check it every ~20s.
        _pollTick++;
        if (_pollTick % 5 == 0) {
          ref.invalidate(communityPinnedMessageProvider(widget.courseId));
        }
      }
    });
  }

  Future<void> _loadMutePreference() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final localMute = prefs.getBool('community_muted_${widget.courseId}');
      if (localMute != null && mounted) {
        setState(() => _isMuted = localMute);
      }
      final api = ref.read(apiClientProvider);
      final res = await api.get<Map<String, dynamic>>('/api/community/${widget.courseId}/mute');
      if (res.data != null && res.data!['muted'] is bool && mounted) {
        final serverMuted = res.data!['muted'] as bool;
        setState(() => _isMuted = serverMuted);
        prefs.setBool('community_muted_${widget.courseId}', serverMuted);
      }
    } catch (_) {}
  }

  Future<void> _toggleMute() async {
    final next = !_isMuted;
    setState(() => _isMuted = next);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('community_muted_${widget.courseId}', next);
      final api = ref.read(apiClientProvider);
      await api.post('/api/community/${widget.courseId}/mute', body: {'muted': next});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next
                ? 'Notifications muted for this course'
                : 'Notifications unmuted for this course'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Notification setting updated')),
        );
      }
    }
  }

  Future<void> _markAsRead() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('community_last_read_${widget.courseId}', DateTime.now().millisecondsSinceEpoch);
      final api = ref.read(apiClientProvider);
      await api.post('/api/community/${widget.courseId}/read', body: {});
      ref.invalidate(communityMessagesProvider(widget.courseId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Marked all messages as read'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Marked all messages as read')),
        );
      }
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _composer.dispose();
    _scroll.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _composer.text.trim();
    if ((text.isEmpty && _stagedAttachment == null) || _sending || _uploadingAttachment) return;
    setState(() => _sending = true);
    try {
      final api = ref.read(apiClientProvider);
      final body = <String, dynamic>{
        'content': text.isEmpty ? (_stagedAttachment?['name'] ?? 'Attachment') : text,
      };
      if (_stagedAttachment != null && _stagedAttachment!['url'] != null) {
        body['imageUrl'] = _stagedAttachment!['url'];
      }
      if (_replyingTo != null && _replyingTo!['id'] != null) {
        body['replyToId'] = _replyingTo!['id'];
      }

      await api.post(
        '/api/community/${widget.courseId}/messages',
        body: body,
      );
      if (!mounted) return;
      _composer.clear();
      setState(() {
        _stagedAttachment = null;
        _replyingTo = null;
      });
      ref.invalidate(communityMessagesProvider(widget.courseId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Send failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _deleteMessage(String messageId) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.delete(
        '/api/community/${widget.courseId}/messages',
        body: {'messageId': messageId},
      );
      ref.invalidate(communityMessagesProvider(widget.courseId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Message deleted'),
            duration: Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _pickAttachment(bool images) async {
    if (_sending || _uploadingAttachment) return;
    setState(() => _uploadingAttachment = true);
    try {
      final attachment = await pickCommunityAttachment(
          ref.read(apiClientProvider),
          images: images);
      if (mounted && attachment != null) {
        setState(() => _stagedAttachment = attachment);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(communityUploadError(error))));
      }
    } finally {
      if (mounted) setState(() => _uploadingAttachment = false);
    }
  }

  void _showAttachmentOptions() {
    if (_sending || _uploadingAttachment) return;
    final tokens = context.tokens;
    showModalBottomSheet<void>(
        context: context,
        useRootNavigator: true,
        showDragHandle: true,
        builder: (ctx) => SafeArea(
                child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text('Share a file · Up to 20 MB',
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.4,
                        color: tokens.textPrimary)),
                const SizedBox(height: 16),
                Container(
                  decoration: BoxDecoration(
                    color: tokens.surfaceSecondary,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(children: [
                    for (final images in [true, false]) ...[
                      if (!images)
                        Divider(
                            height: 0.5,
                            thickness: 0.5,
                            indent: 70,
                            color: tokens.border),
                      InkWell(
                        onTap: () {
                          Navigator.of(ctx).pop();
                          _showGuidelines(
                            title: images ? 'Upload Image' : 'Upload Document',
                            message:
                                'Choose a relevant file up to 20 MB. Your file will be shared in this conversation.',
                            confirmLabel: 'Select File',
                            onConfirm: () => _pickAttachment(images),
                          );
                        },
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          child: Row(children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: images
                                    ? const Color(0xFF007AFF)
                                    : const Color(0xFFFF9500),
                                borderRadius: BorderRadius.circular(11),
                              ),
                              child: Icon(
                                images
                                    ? Symbols.photo_library_rounded
                                    : Symbols.description_rounded,
                                color: Colors.white,
                                size: 22,
                                fill: 1,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    images
                                        ? 'Choose Image'
                                        : 'Choose Document',
                                    style: TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.w500,
                                        letterSpacing: -0.3,
                                        color: tokens.textPrimary),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    images
                                        ? 'JPG, PNG or WEBP'
                                        : 'PDF, Word, PowerPoint, Excel or ZIP',
                                    style: TextStyle(
                                        fontSize: 13.5,
                                        color: tokens.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                            Icon(Symbols.arrow_forward_ios_rounded,
                                size: 14,
                                weight: 700,
                                color: tokens.textMuted),
                          ]),
                        ),
                      ),
                    ],
                  ]),
                ),
              ]),
            )));
  }

  void _showGuidelines({
    required String title,
    required String message,
    required String confirmLabel,
    required VoidCallback onConfirm,
  }) {
    final tokens = context.tokens;

    showDialog<void>(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => AlertDialog(
        backgroundColor: tokens.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          title,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: tokens.textPrimary,
          ),
        ),
        content: Text(
          message,
          style: TextStyle(
            fontSize: 13.5,
            height: 1.45,
            color: tokens.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Cancel',
              style: TextStyle(
                color: tokens.textMuted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              onConfirm();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: tokens.primaryAccent,
              foregroundColor: tokens.onPrimaryAccent,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              elevation: 0,
            ),
            child: Text(
              confirmLabel,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final courseAsync = ref.watch(courseDetailProvider(widget.courseId));
    final allCourses = ref.watch(coursesProvider).value ?? const <Course>[];
    final messagesAsync =
        ref.watch(communityMessagesProvider(widget.courseId));
    final me = ref.watch(authStateProvider).value;
    final myId = me?.id;
    final tokens = context.tokens;
    final isDark = context.isDark;

    // Banner under the header: a manager's pinned message when there is one,
    // otherwise the welcome note — but only while the group has no messages.
    final pinnedMessage = ref
        .watch(communityPinnedMessageProvider(widget.courseId))
        .value;
    final loadedMsgs = messagesAsync.value;
    final groupIsEmpty = loadedMsgs != null && loadedMsgs.isEmpty;

    return Scaffold(
      backgroundColor: isDark ? tokens.bg : const Color(0xFFF8F6F1),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(
              courseAsync: courseAsync,
              allCourses: allCourses,
              courseId: widget.courseId,
              isMuted: _isMuted,
              onMarkAsRead: _markAsRead,
              onToggleMute: _toggleMute,
            ),
            if (pinnedMessage != null)
              _PinnedBanner(message: pinnedMessage)
            else if (groupIsEmpty)
              const _PinnedBanner(),
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(child: _ChatBackground(isDark: isDark)),
                  messagesAsync.when(
                    loading: () => const PageLoading(),
                    error: (e, _) => Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.chat_bubble_outline_rounded,
                                color: tokens.textMuted, size: 40),
                            const SizedBox(height: 10),
                            Text(
                              'Welcome to the community',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: tokens.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Send a message below to start the conversation!',
                              style: TextStyle(
                                fontSize: 12.5,
                                color: tokens.textSecondary,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                    data: (msgs) {
                      if (msgs.isEmpty) {
                        return Padding(
                          padding: const EdgeInsets.all(40),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.chat_bubble_outline,
                                  color: tokens.textMuted, size: 40),
                              const SizedBox(height: 10),
                              Text(
                                'No messages yet',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: tokens.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                "Be the first to say hi!",
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: tokens.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        );
                      }

                      final myRole = (ref.watch(authStateProvider).value?.role ?? 'STUDENT').toUpperCase();
                      final isModerator = myRole == 'MANAGER' || myRole == 'ADMIN';
                      final visibleMsgs = msgs.where((m) {
                        final isDel = m['isDeleted'] == true || m['isSystemDeleted'] == true;
                        if (isDel && !isModerator) return false;
                        return true;
                      }).toList();

                      return AppRefresh(
                        onRefresh: () async => ref.invalidate(
                            communityMessagesProvider(widget.courseId)),
                        child: ListView.builder(
                          controller: _scroll,
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                          itemCount: visibleMsgs.length + 1,
                          itemBuilder: (_, i) {
                            if (i == 0) return const _DayMark(label: 'TODAY');
                            final m = visibleMsgs[i - 1];
                            final prev = i >= 2 ? visibleMsgs[i - 2] : null;
                            final sender =
                                (m['sender'] as Map<String, dynamic>?) ?? const {};
                            final senderId = sender['id'] as String?;
                            final isMine = senderId != null && senderId == myId;
                            final continuation = prev != null &&
                                ((prev['sender'] as Map?)?['id'] ?? '') ==
                                    senderId;
                            final isDel = m['isDeleted'] == true || m['isSystemDeleted'] == true;
                            final canDelete = !isDel && (isMine || isModerator);

                            return _Bubble(
                              message: m,
                              isMine: isMine,
                              continuation: continuation,
                              canDelete: canDelete,
                              onReply: (replyMsg) {
                                setState(() => _replyingTo = replyMsg);
                                _focusNode.requestFocus();
                              },
                              onDelete: (msgId) => _deleteMessage(msgId),
                            );
                          },
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),

            if (_uploadingAttachment) const Padding(
              padding: EdgeInsets.all(12),
              child: Column(children: [LinearProgressIndicator(), SizedBox(height: 6), Text('Selecting / uploading attachment…')]),
            ),
            if (_stagedAttachment != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: tokens.cardBg,
                  border: Border(top: BorderSide(color: tokens.border)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: tokens.primaryAccent.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        _stagedAttachment!['type'] == 'image'
                            ? Icons.image
                            : Icons.description,
                        color: tokens.primaryAccent,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _stagedAttachment!['name'] ?? 'Attached File',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: tokens.textPrimary,
                            ),
                          ),
                          Text(
                            'Ready to send',
                            style: TextStyle(
                              fontSize: 10.5,
                              color: tokens.success,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      color: tokens.textMuted,
                      onPressed: () => setState(() => _stagedAttachment = null),
                    ),
                  ],
                ),
              ),

            _Composer(
              controller: _composer,
              focusNode: _focusNode,
              onSend: _send,
              onAttachmentTap: _showAttachmentOptions,
              sending: _sending || _uploadingAttachment,
              replyingTo: _replyingTo,
              onCancelReply: () => setState(() => _replyingTo = null),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.courseAsync,
    required this.allCourses,
    required this.courseId,
    required this.isMuted,
    required this.onMarkAsRead,
    required this.onToggleMute,
  });

  final AsyncValue<Map<String, dynamic>> courseAsync;
  final List<Course> allCourses;
  final String courseId;
  final bool isMuted;
  final VoidCallback onMarkAsRead;
  final VoidCallback onToggleMute;

  Color _accent(String? hex) {
    final v = int.tryParse(
            (hex ?? '#4F46E5').replaceAll('#', ''),
            radix: 16) ??
        0x4F46E5;
    return Color(0xFF000000 | v);
  }

  String _code(String name) {
    final t = name.trim();
    if (t.isEmpty) return 'CO';
    final parts = t.split(RegExp(r'\s+'));
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return t.length >= 2 ? t.substring(0, 2).toUpperCase() : t.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final raw = courseAsync.value ?? const {};
    final courseMap = (raw['course'] as Map<String, dynamic>?) ?? raw;
    final isGeneral = courseId == 'general-discussion';

    // Fallback search in allCourses
    Course? courseObj;
    if (!isGeneral && allCourses.isNotEmpty) {
      try {
        courseObj = allCourses.firstWhere((c) => c.id == courseId);
      } catch (_) {
        courseObj = null;
      }
    }

    final name = isGeneral
        ? 'General Discussion'
        : ((courseMap['name'] as String?) ?? courseObj?.name ?? 'Course Community');

    final subject = isGeneral
        ? 'PUBLIC'
        : ((courseMap['subject'] as String?) ?? courseObj?.subject ?? 'TERM 1');

    final accent = isGeneral
        ? const Color(0xFF5856D6)
        : _accent((courseMap['color'] as String?) ?? courseObj?.color);

    final tokens = context.tokens;

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        border: Border(bottom: BorderSide(color: tokens.border, width: 0.5)),
      ),
      child: Row(
        children: [
          // Back Button
          InkWell(
            onTap: () {
              if (Navigator.of(context, rootNavigator: true).canPop()) {
                Navigator.of(context, rootNavigator: true).pop();
              } else if (context.canPop()) {
                context.pop();
              } else {
                context.go('/community');
              }
            },
            borderRadius: BorderRadius.circular(18),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: tokens.surfaceSecondary,
                borderRadius: BorderRadius.circular(18),
              ),
              alignment: Alignment.center,
              child: Icon(Symbols.arrow_back_ios_new_rounded,
                  weight: 600, color: tokens.textPrimary, size: 17),
            ),
          ),
          const SizedBox(width: 10),

          // Course avatar: same icon the course has in the Community list.
          Builder(builder: (context) {
            final lower = name.toLowerCase();
            final isGift = lower.contains('qualifier') ||
                lower.contains('oneshot') ||
                lower.contains('attempt');
            final look = isGeneral
                ? (
                    icon: Symbols.forum_rounded,
                    colors: const [Color(0xFF7D7AFF), Color(0xFF5856D6)]
                  )
                : communityCourseLook(name, subject, isGift);
            return Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(13),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: look.colors,
                ),
              ),
              alignment: Alignment.center,
              child:
                  Icon(look.icon, fill: 1, color: Colors.white, size: 23),
            );
          }),
          const SizedBox(width: 12),

          // Course Title & Term
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                    letterSpacing: -0.4,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subject.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: tokens.primaryAccent,
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
          ),

          // Native Three-Dot Popup Menu
          Theme(
            data: Theme.of(context).copyWith(
              cardColor: tokens.cardBg,
              dividerTheme: DividerThemeData(
                  color: tokens.border, thickness: 0.5, space: 1),
              popupMenuTheme: PopupMenuThemeData(
                color: tokens.cardBg,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                  side: BorderSide(color: tokens.border, width: 0.5),
                ),
                elevation: 6,
                shadowColor: Colors.black26,
              ),
            ),
            child: PopupMenuButton<String>(
              icon: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: tokens.surfaceSecondary,
                  borderRadius: BorderRadius.circular(17),
                ),
                alignment: Alignment.center,
                child: Icon(Symbols.more_horiz_rounded,
                    weight: 600, color: tokens.textPrimary, size: 22),
              ),
              offset: const Offset(0, 44),
              onSelected: (val) {
                if (val == 'read') {
                  onMarkAsRead();
                } else if (val == 'course') {
                  if (isGeneral) {
                    context.push('/courses');
                  } else {
                    context.push('/courses/$courseId');
                  }
                } else if (val == 'mute') {
                  onToggleMute();
                }
              },
              itemBuilder: (ctx) => [
                PopupMenuItem<String>(
                  value: 'read',
                  height: 50,
                  child: Row(
                    children: [
                      Icon(Symbols.check_rounded, size: 21, weight: 600, color: tokens.textPrimary),
                      const SizedBox(width: 10),
                      Text(
                        'Mark as read',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: tokens.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                const PopupMenuDivider(height: 1),
                PopupMenuItem<String>(
                  value: 'course',
                  height: 50,
                  child: Row(
                    children: [
                      Icon(Symbols.open_in_new_rounded, size: 21, color: tokens.textPrimary),
                      const SizedBox(width: 10),
                      Text(
                        'Open course page',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: tokens.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                const PopupMenuDivider(height: 1),
                PopupMenuItem<String>(
                  value: 'mute',
                  height: 50,
                  child: Row(
                    children: [
                      Icon(
                        isMuted
                            ? Symbols.notifications_active_rounded
                            : Symbols.notifications_off_rounded,
                        size: 21,
                        color: isMuted ? tokens.primaryAccent : tokens.textPrimary,
                      ),
                      const SizedBox(width: 10),
                      Text(
                        isMuted ? 'Unmute notifications' : 'Mute notifications',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: isMuted ? tokens.primaryAccent : tokens.textPrimary,
                        ),
                      ),
                    ],
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

class _PinnedBanner extends StatelessWidget {
  /// With [message] the banner shows that pinned message; without it, it shows
  /// the default welcome note.
  const _PinnedBanner({this.message});
  final Map<String, dynamic>? message;

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final textColor =
        isDark ? const Color(0xFFFDE68A) : const Color(0xFF92400E);

    final msg = message;
    String label = 'Pinned by mentor: ';
    String body = 'Welcome to the community — say hi! 👋';
    if (msg != null) {
      final sender = msg['sender'];
      final senderName =
          sender is Map ? (sender['name'] as String?) ?? '' : '';
      final cleaned =
          _cleanMessageContent((msg['content'] as String?) ?? '');
      final hasAttachment =
          ((msg['imageUrl'] as String?) ?? '').isNotEmpty;
      label = senderName.isNotEmpty ? 'Pinned · $senderName: ' : 'Pinned: ';
      body = cleaned.isNotEmpty
          ? cleaned
          : (hasAttachment ? '📎 Attachment' : 'Pinned message');
    }

    final banner = Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0x2EFF9500) : const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? const Color(0x59F5B440) : const Color(0xFFFCD8A6),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.push_pin,
            color: isDark ? const Color(0xFFFBBF24) : AppColors.amber,
            size: 14,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: label,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  TextSpan(
                    text: body,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (msg != null)
            Icon(
              Icons.chevron_right,
              color: textColor,
              size: 14,
            ),
        ],
      ),
    );

    if (msg == null) return banner;

    // Tap to read the whole pinned message (the banner shows two lines).
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text(
              'Pinned message',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            content: SingleChildScrollView(
              child: Text(
                '$label$body',
                style: const TextStyle(fontSize: 14, height: 1.45),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Close'),
              ),
            ],
          ),
        );
      },
      child: banner,
    );
  }
}

class _DayMark extends StatelessWidget {
  const _DayMark({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Expanded(child: Container(height: 0.5, color: tokens.border)),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
              color: tokens.textMuted,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(child: Container(height: 0.5, color: tokens.border)),
        ],
      ),
    );
  }
}

/// True for 1–3 emoji with nothing else — shown big, iMessage style.
bool _isEmojiOnly(String text) {
  final t = text.trim();
  if (t.isEmpty || t.length > 24) return false;
  var emoji = 0;
  for (final r in t.runes) {
    final isJoiner = r == 0x200D || r == 0xFE0F || (r >= 0x1F3FB && r <= 0x1F3FF);
    final isEmoji = (r >= 0x1F300 && r <= 0x1FAFF) ||
        (r >= 0x2600 && r <= 0x27BF) ||
        (r >= 0x2B00 && r <= 0x2BFF) ||
        r == 0x2764 ||
        (r >= 0x1F1E6 && r <= 0x1F1FF);
    if (isJoiner) continue;
    if (!isEmoji) return false;
    emoji++;
  }
  return emoji >= 1 && emoji <= 3;
}

class _LectureCommentLink {
  const _LectureCommentLink({
    required this.courseId,
    required this.lectureId,
    required this.commentId,
    required this.lectureTitle,
  });

  final String courseId;
  final String lectureId;
  final String commentId;
  final String lectureTitle;
}

final _kLectureCommentRegex = RegExp(
  r'\[LECTURE_COMMENT_LINK:courseId=([^;]+);lectureId=([^;]+);commentId=([^;\]]+)(?:;lectureTitle=([^\]]+))?\]',
);

_LectureCommentLink? _parseLectureLink(String content) {
  if (content.isEmpty) return null;
  final match = _kLectureCommentRegex.firstMatch(content);
  if (match == null) return null;
  final titleRaw = match.group(4);
  String title = 'Lecture';
  if (titleRaw != null && titleRaw.isNotEmpty) {
    try {
      title = Uri.decodeComponent(titleRaw);
    } catch (_) {
      title = titleRaw;
    }
  }
  return _LectureCommentLink(
    courseId: match.group(1) ?? '',
    lectureId: match.group(2) ?? '',
    commentId: match.group(3) ?? '',
    lectureTitle: title,
  );
}

String _cleanMessageContent(String content) {
  if (content.isEmpty) return '';
  return content.replaceAll(_kLectureCommentRegex, '').trim();
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.message,
    required this.isMine,
    required this.continuation,
    required this.canDelete,
    required this.onReply,
    required this.onDelete,
  });

  final Map<String, dynamic> message;
  final bool isMine;
  final bool continuation;
  final bool canDelete;
  final ValueChanged<Map<String, dynamic>> onReply;
  final ValueChanged<String> onDelete;

  String _formatTime(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  static const _palette = [
    [Color(0xFFEC4899), Color(0xFFFCE7F3)],
    [Color(0xFF0EA5E9), Color(0xFFE0F2FE)],
    [Color(0xFF34C759), Color(0xFFD1FAE5)],
    [Color(0xFF5856D6), Color(0xFFEEF2FF)],
    [Color(0xFFFF9500), Color(0xFFFEF4E2)],
    [Color(0xFF6E6CF0), Color(0xFFEDE9FE)],
  ];

  void _showActionSheet(
    BuildContext context, {
    required String rawContent,
    required String cleanedText,
    required _LectureCommentLink? lectureLink,
  }) {
    final tokens = context.tokens;

    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          border: Border.all(color: tokens.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: tokens.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 14),

            // Reply option
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: tokens.primaryAccent.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.reply_rounded,
                    color: tokens.primaryAccent, size: 20),
              ),
              title: Text('Reply',
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: tokens.textPrimary,
                      fontSize: 14.5)),
              onTap: () {
                Navigator.of(ctx).pop();
                HapticFeedback.lightImpact();
                onReply(message);
              },
            ),

            // Copy text option
            if (cleanedText.isNotEmpty)
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: tokens.surfaceSecondary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.copy_rounded,
                      color: tokens.textPrimary, size: 20),
                ),
                title: Text('Copy text',
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: tokens.textPrimary,
                        fontSize: 14.5)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  HapticFeedback.lightImpact();
                  Clipboard.setData(ClipboardData(text: cleanedText));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Message copied to clipboard'),
                      duration: Duration(seconds: 2),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
              ),

            // View in lecture
            if (lectureLink != null)
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF5856D6).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.play_circle_filled_rounded,
                      color: Color(0xFF5856D6), size: 20),
                ),
                title: Text('Open Lecture (${lectureLink.lectureTitle})',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: tokens.textPrimary,
                        fontSize: 14.5)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  HapticFeedback.lightImpact();
                  context.push('/courses/${lectureLink.courseId}');
                },
              ),

            // Delete message option
            if (canDelete)
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF3B30).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.delete_outline_rounded,
                      color: Color(0xFFFF3B30), size: 20),
                ),
                title: const Text('Delete message',
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFFF3B30),
                        fontSize: 14.5)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  HapticFeedback.mediumImpact();
                  final msgId = message['id']?.toString();
                  if (msgId != null && msgId.isNotEmpty) {
                    onDelete(msgId);
                  }
                },
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final sender = (message['sender'] as Map<String, dynamic>?) ?? const {};
    final name = (sender['name'] as String?) ?? 'User';
    final role = ((sender['role'] as String?) ?? 'STUDENT').toUpperCase();
    final isMentor = role == 'MENTOR' || role == 'ADMIN' || role == 'MANAGER';
    final rawContent = (message['content'] as String?) ?? '';
    final imageUrl = message['imageUrl'] as String?;
    final time = _formatTime(message['createdAt'] as String?);

    final replyTo = message['replyTo'] as Map<String, dynamic>?;
    final replySenderName =
        (replyTo?['sender']?['name'] as String?) ?? 'User';
    final replyContent = (replyTo?['content'] as String?) ?? '';

    final lectureLink = _parseLectureLink(rawContent);
    final cleanedText = _cleanMessageContent(rawContent);
    final isDeleted =
        message['isDeleted'] == true || message['isSystemDeleted'] == true;

    final senderId =
        (sender['id'] as String?) ?? (message['senderId'] as String?);
    final avatarUrl = sender['avatar'] as String?;
    final gender = sender['gender'] as String?;

    final idx = (name.hashCode.abs()) % _palette.length;
    final tone = isMentor ? tokens.primaryAccent : _palette[idx][0];
    final roleLabel = role == 'MANAGER'
        ? 'MANAGER'
        : role == 'ADMIN'
            ? 'ADMIN'
            : 'MENTOR';

    final isEmojiOnly = !isDeleted &&
        lectureLink == null &&
        (imageUrl == null || imageUrl.isEmpty) &&
        replyTo == null &&
        _isEmojiOnly(cleanedText);

    final createdAt = DateTime.tryParse(
        (message['createdAt'] as String?) ?? '');
    final isFresh = createdAt != null &&
        DateTime.now().difference(createdAt).inSeconds.abs() < 10 &&
        !MediaQuery.of(context).disableAnimations;

    Widget animated(Widget child) {
      if (!isFresh) return child;
      return TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 380),
        curve: Curves.easeOutBack,
        builder: (context, t, child) => Opacity(
          opacity: t.clamp(0.0, 1.0),
          child: Transform.scale(
            scale: 0.85 + 0.15 * t,
            alignment: isMine ? Alignment.bottomRight : Alignment.bottomLeft,
            child: child,
          ),
        ),
        child: child,
      );
    }

    return Dismissible(
      key: ValueKey('msg_${message['id']}_${message['createdAt']}'),
      direction: isDeleted ? DismissDirection.none : DismissDirection.startToEnd,
      confirmDismiss: (_) async {
        HapticFeedback.lightImpact();
        onReply(message);
        return false;
      },
      background: Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.only(left: 16),
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: tokens.primaryAccent.withOpacity(0.15),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.reply_rounded, color: tokens.primaryAccent, size: 20),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.only(
          top: continuation ? 3 : 10,
          bottom: 2,
        ),
        child: Row(
          mainAxisAlignment:
              isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!isMine)
              Opacity(
                opacity: continuation ? 0 : 1,
                child: InkWell(
                  onTap: senderId != null && senderId.isNotEmpty
                      ? () => showSocialCard(context, userId: senderId)
                      : null,
                  borderRadius: BorderRadius.circular(50),
                  child: AppAvatar(
                    avatarUrl: avatarUrl,
                    name: name,
                    gender: gender,
                    size: 28,
                  ),
                ),
              ),
            if (!isMine) const SizedBox(width: 8),
            Flexible(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * 0.76,
                ),
                child: animated(Column(
                  crossAxisAlignment: isMine
                      ? CrossAxisAlignment.end
                      : CrossAxisAlignment.start,
                  children: [
                    if (!isMine && !continuation)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4, left: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            InkWell(
                              onTap: senderId != null && senderId.isNotEmpty
                                  ? () => showSocialCard(context, userId: senderId)
                                  : null,
                              child: Text(
                                name,
                                style: TextStyle(
                                  color: tone,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            if (isMentor) ...[
                              const SizedBox(width: 5),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: tone,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  roleLabel,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 8,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    GestureDetector(
                      onLongPress: isDeleted
                          ? null
                          : () {
                              HapticFeedback.mediumImpact();
                              _showActionSheet(
                                context,
                                rawContent: rawContent,
                                cleanedText: cleanedText,
                                lectureLink: lectureLink,
                              );
                            },
                      child: Container(
                        padding: isEmojiOnly
                            ? const EdgeInsets.symmetric(horizontal: 4)
                            : const EdgeInsets.symmetric(
                                horizontal: 15, vertical: 10),
                        decoration: BoxDecoration(
                          gradient: (isMine && !isDeleted && !isEmojiOnly)
                              ? LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color.lerp(tokens.primaryAccent,
                                        Colors.white, 0.18)!,
                                    tokens.primaryAccent,
                                  ],
                                )
                              : null,
                          color: isEmojiOnly
                              ? Colors.transparent
                              : isDeleted
                                  ? (isMine
                                      ? const Color(0xFFFF3B30)
                                          .withOpacity(0.85)
                                      : const Color(0xFFFF3B30)
                                          .withOpacity(0.08))
                                  : (isMine ? null : tokens.cardBg),
                          border: (isMine || !isDeleted)
                              ? null
                              : Border.all(
                                  color: const Color(0xFFFF3B30)
                                      .withValues(alpha: 0.3)),
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(20),
                            topRight: const Radius.circular(20),
                            bottomLeft: Radius.circular(isMine ? 20 : 6),
                            bottomRight: Radius.circular(isMine ? 6 : 20),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (isDeleted) ...[
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.block_rounded,
                                      size: 14,
                                      color: isMine
                                          ? Colors.white.withOpacity(0.9)
                                          : const Color(0xFFFF3B30)),
                                  const SizedBox(width: 5),
                                  Text(
                                    'This message was deleted',
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontStyle: FontStyle.italic,
                                      fontWeight: FontWeight.w600,
                                      color: isMine
                                          ? Colors.white.withOpacity(0.9)
                                          : const Color(0xFFFF3B30),
                                    ),
                                  ),
                                ],
                              ),
                              if (cleanedText.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  cleanedText,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontStyle: FontStyle.italic,
                                    color: isMine
                                        ? Colors.white.withOpacity(0.7)
                                        : tokens.textMuted,
                                    decoration: TextDecoration.lineThrough,
                                  ),
                                ),
                              ],
                            ] else ...[
                              // Reply banner inside bubble
                              if (replyTo != null) ...[
                                Container(
                                  margin: const EdgeInsets.only(bottom: 7),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: isMine
                                        ? Colors.white.withOpacity(0.18)
                                        : tokens.surfaceSecondary,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border(
                                      left: BorderSide(
                                        color: isMine
                                            ? Colors.white
                                            : tokens.primaryAccent,
                                        width: 3,
                                      ),
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        replySenderName,
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
                                          color: isMine
                                              ? Colors.white
                                              : tokens.primaryAccent,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        _cleanMessageContent(replyContent),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 11.5,
                                          color: isMine
                                              ? Colors.white.withOpacity(0.85)
                                              : tokens.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],

                              if (imageUrl != null && imageUrl.isNotEmpty) ...[
                                CommunityAttachment(url: imageUrl),
                                const SizedBox(height: 6),
                              ],

                              // Lecture comment link banner
                              if (lectureLink != null) ...[
                                Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: isMine
                                        ? Colors.white.withOpacity(0.15)
                                        : const Color(0xFF5856D6).withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Icon(
                                            Symbols.menu_book_rounded,
                                            fill: 1,
                                            size: 16,
                                            color: isMine
                                                ? Colors.white
                                                : const Color(0xFF5856D6),
                                          ),
                                          const SizedBox(width: 5),
                                          Expanded(
                                            child: Text(
                                              'Commented on: ${lectureLink.lectureTitle}',
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w600,
                                                color: isMine
                                                    ? Colors.white
                                                    : const Color(0xFF5856D6),
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      InkWell(
                                        onTap: () {
                                          HapticFeedback.lightImpact();
                                          context.push('/courses/${lectureLink.courseId}');
                                        },
                                        borderRadius: BorderRadius.circular(10),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 12, vertical: 7),
                                          decoration: BoxDecoration(
                                            color: isMine
                                                ? Colors.white
                                                : const Color(0xFF5856D6),
                                            borderRadius:
                                                BorderRadius.circular(10),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Icon(
                                                Symbols.play_circle_rounded,
                                                fill: 1,
                                                size: 16,
                                                color: isMine
                                                    ? tokens.primaryAccent
                                                    : Colors.white,
                                              ),
                                              const SizedBox(width: 4),
                                              Text(
                                                'View Lecture',
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w600,
                                                  color: isMine
                                                      ? tokens.primaryAccent
                                                      : Colors.white,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],

                              // Clean message body
                              if (cleanedText.isNotEmpty)
                                Text(
                                  cleanedText,
                                  style: TextStyle(
                                    fontSize: isEmojiOnly ? 48 : 17,
                                    letterSpacing: isEmojiOnly ? 0 : -0.2,
                                    color: isMine ? Colors.white : tokens.textPrimary,
                                    height: isEmojiOnly ? 1.2 : 1.35,
                                  ),
                                )
                              else if (imageUrl == null && lectureLink == null)
                                Text(
                                  replyTo != null ? '(No text)' : '(Empty message)',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontStyle: FontStyle.italic,
                                    color: isMine
                                        ? Colors.white.withOpacity(0.7)
                                        : tokens.textMuted,
                                  ),
                                ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 3, left: 4, right: 4),
                      child: Text(
                        time + (isMine ? ' · sent' : ''),
                        style: TextStyle(
                          fontSize: 12,
                          color: tokens.textMuted,
                        ),
                      ),
                    ),
                  ],
                )),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSER (With Reply Preview, Compact Pill & Single Attachment Action)
// ─────────────────────────────────────────────────────────────────────────────
class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.focusNode,
    required this.onSend,
    required this.onAttachmentTap,
    required this.sending,
    this.replyingTo,
    this.onCancelReply,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onSend;
  final VoidCallback onAttachmentTap;
  final bool sending;
  final Map<String, dynamic>? replyingTo;
  final VoidCallback? onCancelReply;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = context.isDark;

    return Container(
      decoration: BoxDecoration(
        color: tokens.cardBg,
        border: Border(top: BorderSide(color: tokens.border, width: 0.5)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Reply preview bar
            if (replyingTo != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: tokens.primaryAccent.withValues(alpha: isDark ? 0.16 : 0.08),
                  border: Border(
                    left: BorderSide(color: tokens.primaryAccent, width: 3),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Replying to ${(replyingTo!['sender']?['name'] as String?) ?? 'User'}',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: tokens.primaryAccent,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            _cleanMessageContent((replyingTo!['content'] as String?) ?? ''),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11.5,
                              color: tokens.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (onCancelReply != null)
                      InkWell(
                        onTap: onCancelReply,
                        borderRadius: BorderRadius.circular(20),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Icon(Icons.close_rounded,
                              size: 18, color: tokens.textMuted),
                        ),
                      ),
                  ],
                ),
              ),
            ],

            // Main input row (compact & sleek)
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // Attachment Button
                  InkWell(
                    onTap: onAttachmentTap,
                    borderRadius: BorderRadius.circular(50),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: tokens.surfaceSecondary,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        Symbols.add_rounded,
                        weight: 600,
                        color: tokens.textSecondary,
                        size: 24,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Compact Message Input Pill
                  Expanded(
                    child: Container(
                      constraints: const BoxConstraints(
                        minHeight: 40,
                        maxHeight: 120,
                      ),
                      decoration: BoxDecoration(
                        color: tokens.surfaceSecondary,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: TextField(
                        controller: controller,
                        focusNode: focusNode,
                        minLines: 1,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: 'Write a message...',
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          hintStyle: TextStyle(
                            fontSize: 16,
                            color: tokens.textMuted,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                        style: TextStyle(
                          fontSize: 16,
                          color: tokens.textPrimary,
                          fontWeight: FontWeight.w400,
                        ),
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => onSend(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Send Button
                  InkWell(
                    onTap: sending ? null : onSend,
                    borderRadius: BorderRadius.circular(50),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: tokens.primaryAccent,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: sending
                          ? SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: tokens.onPrimaryAccent,
                              ),
                            )
                          : Icon(
                              Symbols.arrow_upward_rounded,
                              color: tokens.onPrimaryAccent,
                              weight: 700,
                              size: 21,
                            ),
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
// CHAT DOODLE BACKDROP
// ─────────────────────────────────────────────────────────────────────────────
class _ChatBackground extends StatelessWidget {
  const _ChatBackground({this.isDark = false});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final accent = context.tokens.primaryAccent;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isDark
              ? [
                  Color.lerp(context.tokens.bg, accent, 0.10)!,
                  context.tokens.bg,
                ]
              : const [Color(0xFFEEEDFB), Color(0xFFF8F6F1)],
        ),
      ),
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _DoodlePainter(isDark: isDark, tint: accent),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _DoodlePainter extends CustomPainter {
  _DoodlePainter({this.isDark = false, required this.tint});
  final bool isDark;
  final Color tint;

  static const _doodles = <IconData>[
    Symbols.menu_book_rounded,
    Symbols.calculate_rounded,
    Symbols.lightbulb_rounded,
    Symbols.science_rounded,
    Symbols.function_rounded,
    Symbols.edit_rounded,
    Symbols.star_rounded,
    Symbols.chat_bubble_rounded,
    Symbols.school_rounded,
    Symbols.code_rounded,
  ];

  static List<_DoodleSpec>? _cached;

  static List<_DoodleSpec> _layout() {
    if (_cached != null) return _cached!;
    final rng = _Mulberry32(31415);
    final out = <_DoodleSpec>[];
    const rows = 14;
    const cols = 3;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        final jitterX = (rng.next() - 0.5) * 0.4;
        final jitterY = (rng.next() - 0.5) * 0.4;
        final iconIdx =
            (rng.next() * _doodles.length).floor().clamp(0, _doodles.length - 1);
        final rotDeg = (rng.next() - 0.5) * 30;
        final size = 28 + rng.next() * 12;
        out.add(_DoodleSpec(
          col: c + jitterX,
          row: r + jitterY,
          icon: _doodles[iconIdx],
          rotation: rotDeg * 3.14159 / 180,
          fontSize: size,
        ));
      }
    }
    _cached = out;
    return out;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final cellW = size.width / 3;
    const cellH = 128.0;
    final specs = _layout();
    for (final s in specs) {
      final dx = s.col * cellW + cellW / 2;
      final dy = s.row * cellH + cellH / 2;
      if (dy > size.height + 40) break;
      _paintIcon(canvas, s, Offset(dx, dy));
    }
  }

  void _paintIcon(Canvas canvas, _DoodleSpec s, Offset center) {
    final tp = TextPainter(
      text: TextSpan(
        text: String.fromCharCode(s.icon.codePoint),
        style: TextStyle(
          fontFamily: s.icon.fontFamily,
          package: s.icon.fontPackage,
          fontSize: s.fontSize,
          color: tint.withValues(alpha: isDark ? 0.10 : 0.075),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(s.rotation);
    canvas.translate(-tp.width / 2, -tp.height / 2);
    tp.paint(canvas, Offset.zero);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _DoodlePainter oldDelegate) =>
      oldDelegate.isDark != isDark || oldDelegate.tint != tint;
}

class _DoodleSpec {
  const _DoodleSpec({
    required this.col,
    required this.row,
    required this.icon,
    required this.rotation,
    required this.fontSize,
  });
  final double col;
  final double row;
  final IconData icon;
  final double rotation;
  final double fontSize;
}

class _Mulberry32 {
  _Mulberry32(this._seed);
  int _seed;
  double next() {
    _seed = (_seed + 0x6D2B79F5) & 0xFFFFFFFF;
    var t = _seed;
    t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF;
    t ^= t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF);
    t = t & 0xFFFFFFFF;
    return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 0x100000000;
  }
}



