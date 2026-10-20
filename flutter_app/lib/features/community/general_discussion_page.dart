import 'dart:convert';
import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../shared/widgets/apple_pressable.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../shared/widgets/social_card_dialog.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import 'community_attachment.dart';
import 'community_file_upload.dart';
import 'community_chat_page.dart' show communityMessagesProvider;
import '../../shared/widgets/shimmer_loading.dart';

class GeneralDiscussionPage extends ConsumerStatefulWidget {
  const GeneralDiscussionPage({super.key, this.initialAction});
  final String? initialAction;

  @override
  ConsumerState<GeneralDiscussionPage> createState() =>
      _GeneralDiscussionPageState();
}

class _GeneralDiscussionPageState extends ConsumerState<GeneralDiscussionPage> {
  final _postController = TextEditingController();
  final _focusNode = FocusNode();
  String _feedFilter = 'recent'; // 'recent', 'popular', 'unanswered'
  String? _expandedPostId;
  final Map<String, TextEditingController> _replyControllers = {};
  bool _isPosting = false;
  bool _uploadingAttachment = false;
  String? _replyingPostId;
  String? _stagedImageUrl;
  Map<String, String>? _stagedDocument;

  @override
  void initState() {
    super.initState();
    _postController.addListener(() => setState(() {}));
    if (widget.initialAction == 'create') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _focusNode.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _postController.dispose();
    _focusNode.dispose();
    for (final c in _replyControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _getReplyController(String postId) {
    return _replyControllers.putIfAbsent(
        postId, () => TextEditingController());
  }

  Future<void> _pickAttachment(bool images) async {
    if (_isPosting || _uploadingAttachment) return;
    setState(() => _uploadingAttachment = true);
    try {
      final attachment = await pickCommunityAttachment(
          ref.read(apiClientProvider),
          images: images);
      if (mounted && attachment != null) {
        setState(() {
          _stagedImageUrl = images ? attachment['url'] : null;
          _stagedDocument = images ? null : attachment;
        });
      }
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(communityUploadError(error))));
    } finally {
      if (mounted) setState(() => _uploadingAttachment = false);
    }
  }

  Future<void> _submitPost() async {
    if (_isPosting || _uploadingAttachment) return;
    final text = _postController.text.trim();
    if (text.isEmpty && _stagedImageUrl == null && _stagedDocument == null) {
      return;
    }

    setState(() => _isPosting = true);
    HapticFeedback.lightImpact();

    try {
      final api = ref.read(apiClientProvider);
      await api.post<dynamic>(
        '/api/community/general-discussion/messages',
        body: {
          'content': text,
          if (_stagedImageUrl != null) 'imageUrl': _stagedImageUrl,
          if (_stagedDocument != null) ...{
            'imageUrl': _stagedDocument!['url'],
          },
        },
      );

      if (!mounted) return;
      _postController.clear();
      setState(() {
        _stagedImageUrl = null;
        _stagedDocument = null;
      });
      ref.invalidate(communityMessagesProvider('general-discussion'));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to post: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isPosting = false);
    }
  }

  Future<void> _submitReply(String postId) async {
    final controller = _getReplyController(postId);
    final text = controller.text.trim();
    if (text.isEmpty) return;

    setState(() => _replyingPostId = postId);
    HapticFeedback.lightImpact();

    try {
      final api = ref.read(apiClientProvider);
      await api.post<dynamic>(
        '/api/community/general-discussion/messages',
        body: {
          'content': text,
          'replyToId': postId,
        },
      );

      controller.clear();
      ref.invalidate(communityMessagesProvider('general-discussion'));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to reply: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _replyingPostId = null);
    }
  }

  Future<void> _toggleLike(String messageId) async {
    HapticFeedback.selectionClick();
    try {
      final api = ref.read(apiClientProvider);
      await api.post<dynamic>(
        '/api/community/general-discussion/messages/$messageId/pin',
        body: {'action': 'like'},
      );
      ref.invalidate(communityMessagesProvider('general-discussion'));
    } catch (_) {}
  }

  Future<void> _togglePin(String messageId, bool isCurrentlyPinned) async {
    HapticFeedback.mediumImpact();
    try {
      final api = ref.read(apiClientProvider);
      await api.post<dynamic>(
        '/api/community/general-discussion/messages/$messageId/pin',
        body: {'action': isCurrentlyPinned ? 'unpin' : 'pin'},
      );
      ref.invalidate(communityMessagesProvider('general-discussion'));
    } catch (_) {}
  }

  Future<void> _toggleHighlight(String messageId, bool isHighlighted) async {
    HapticFeedback.mediumImpact();
    try {
      final api = ref.read(apiClientProvider);
      await api.post<dynamic>(
        '/api/community/general-discussion/messages/$messageId/pin',
        body: {'action': isHighlighted ? 'unhighlight' : 'highlight'},
      );
      ref.invalidate(communityMessagesProvider('general-discussion'));
    } catch (_) {}
  }

  Future<void> _deletePost(String messageId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete post?'),
        content: const Text('Are you sure you want to delete this post?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final api = ref.read(apiClientProvider);
      await api.delete<dynamic>(
        '/api/community/general-discussion/messages/$messageId',
      );
      ref.invalidate(communityMessagesProvider('general-discussion'));
    } catch (_) {}
  }

  void _showGuidelinesSheet() {
    final tokens = context.tokens;
    showModalBottomSheet(
      context: context,
      backgroundColor: tokens.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
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
                  child: Icon(Icons.menu_book_rounded,
                      color: tokens.primaryAccent, size: 20),
                ),
                const SizedBox(width: 12),
                Text(
                  'Community Guidelines',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: tokens.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _guidelineItem('🤝 Be Respectful',
                'Treat all students and mentors with kindness and respect.'),
            _guidelineItem('❓ Ask Clear Questions',
                'Include subject, topic name, or code snippets for faster answers.'),
            _guidelineItem('🚫 No Spam or Ads',
                'Keep discussion strictly related to IIT Madras BS Degree courses.'),
            _guidelineItem('🔒 Academic Integrity',
                'Do not share exam/quiz answers or engage in plagiarism.'),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: tokens.primaryAccent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 0,
                ),
                child: const Text('Got It',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _guidelineItem(String title, String desc) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: tokens.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            desc,
            style: TextStyle(
              fontSize: 12.5,
              color: tokens.textSecondary,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  void _showEmojiSheet() {
    final tokens = context.tokens;
    final emojis = [
      '😂', '😭', '😅', '🙂', '😎', '🤔', '❤️', '🔥', '👏', '👍',
      '🙏', '🎉', '🥳', '📚', '📝', '🎓', '💯', '✅', '❌', '⏰',
      '💡', '😤', '🫡', '💪', '🤝', '😴', '🤯', '👀', '😬', '🫠',
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: tokens.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Select Emoji',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: emojis.map((emoji) {
                return InkWell(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    _postController.text = '${_postController.text}$emoji';
                    _postController.selection = TextSelection.fromPosition(
                      TextPosition(offset: _postController.text.length),
                    );
                    Navigator.pop(ctx);
                  },
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    child: Text(emoji, style: const TextStyle(fontSize: 24)),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = context.isDark;
    final user = ref.watch(authStateProvider).value;
    final myId = user?.id;
    final myRole = (user?.role ?? 'STUDENT').toUpperCase();
    final isManager = myRole == 'MANAGER' || myRole == 'ADMIN' || myRole == 'SUPER_ADMIN';

    final messagesAsync =
        ref.watch(communityMessagesProvider('general-discussion'));

    return Scaffold(
      backgroundColor: tokens.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // ── Top Navigation Bar ─────────────────────────────────
            Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              decoration: BoxDecoration(
                color: tokens.cardBg,
                border: Border(
                  bottom: BorderSide(color: tokens.border, width: 0.5),
                ),
              ),
              child: Row(
                children: [
                  // Back button
                  InkWell(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go('/community');
                      }
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: tokens.surfaceSecondary,
                        borderRadius: BorderRadius.circular(19),
                      ),
                      child: Icon(
                        Symbols.arrow_back_ios_new_rounded,
                        weight: 600,
                        size: 18,
                        color: tokens.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Chat Icon Bubble
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: const Color(0xFF5856D6),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: const Icon(
                      Symbols.chat_bubble_rounded,
                      size: 21,
                      fill: 1,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Title
                  Expanded(
                    child: Text(
                      'General Discussion',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: tokens.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),

                  // Guidelines Button
                  InkWell(
                    onTap: _showGuidelinesSheet,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(50),
                        color: const Color(0xFF5856D6).withValues(alpha: 0.12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Symbols.description_rounded,
                              size: 16, fill: 1, color: Color(0xFF5856D6)),
                          const SizedBox(width: 5),
                          const Text(
                            'Guidelines',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF5856D6),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Main Content Wall ──────────────────────────────────
            Expanded(
              child: AppRefresh(
                onRefresh: () async {
                  ref.invalidate(
                      communityMessagesProvider('general-discussion'));
                },
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                  children: [
                    // ── 1. Composer Card ───────────────────────────
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: tokens.cardBg,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              InkWell(
                                onTap: user?.id != null
                                    ? () => showSocialCard(context, userId: user!.id)
                                    : null,
                                borderRadius: BorderRadius.circular(50),
                                child: AppAvatar(
                                  avatarUrl: user?.avatar,
                                  gender: user?.gender,
                                  size: 38,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Stack(
                                  children: [
                                    TextField(
                                      controller: _postController,
                                      focusNode: _focusNode,
                                      minLines: 2,
                                      maxLines: 5,
                                      maxLength: 500,
                                      buildCounter: (
                                        context, {
                                        required currentLength,
                                        required isFocused,
                                        maxLength,
                                      }) =>
                                          null,
                                      decoration: InputDecoration(
                                        hintText:
                                            "What's happening in your class? Ask a question or share updates...",
                                        hintStyle: TextStyle(
                                          fontSize: 15.5,
                                          color: tokens.textMuted,
                                          fontWeight: FontWeight.w400,
                                        ),
                                        border: InputBorder.none,
                                        isDense: true,
                                        contentPadding: EdgeInsets.zero,
                                      ),
                                      style: TextStyle(
                                        fontSize: 15.5,
                                        color: tokens.textPrimary,
                                        fontWeight: FontWeight.w400,
                                        height: 1.4,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),

                          // Char Count Right-Aligned
                          Align(
                            alignment: Alignment.centerRight,
                            child: Text(
                              '${_postController.text.length}/500',
                              style: TextStyle(
                                fontSize: 11,
                                color: tokens.textMuted,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),

                          if (_uploadingAttachment) const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Column(children: [LinearProgressIndicator(), SizedBox(height: 6), Text('Selecting / uploading attachment…')]),
                          ),
                          // Attachment Preview (if staged)
                          if (_stagedImageUrl != null || _stagedDocument != null) ...[
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: tokens.surfaceSecondary,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: tokens.border),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    _stagedImageUrl != null
                                        ? Icons.image_rounded
                                        : Icons.insert_drive_file_rounded,
                                    size: 18,
                                    color: tokens.primaryAccent,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _stagedDocument?['name'] ?? 'Attached Image',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w600,
                                        color: tokens.textPrimary,
                                      ),
                                    ),
                                  ),
                                  InkWell(
                                    onTap: () => setState(() {
                                      _stagedImageUrl = null;
                                      _stagedDocument = null;
                                    }),
                                    child: Icon(Icons.close,
                                        size: 16, color: tokens.textMuted),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 12),
                          Divider(color: tokens.border, height: 1),
                          const SizedBox(height: 10),

                          // Composer Footer Buttons
                          Row(
                            children: [
                              // Tools shrink to fit on narrow screens
                              Expanded(
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  alignment: Alignment.centerLeft,
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                              // Image Picker
                              _ComposerToolBtn(
                                icon: Symbols.image_rounded,
                                label: 'Image',
                                onTap: () => _pickAttachment(true),
                              ),
                              const SizedBox(width: 8),

                              // Document Picker
                              _ComposerToolBtn(
                                icon: Symbols.attach_file_rounded,
                                label: 'Document',
                                onTap: () => _pickAttachment(false),
                              ),
                              const SizedBox(width: 8),

                              // Emoji Picker
                              _ComposerToolBtn(
                                icon: Symbols.sentiment_satisfied_rounded,
                                label: 'Emoji',
                                onTap: _showEmojiSheet,
                              ),

                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),

                              // Post Button (Purple Pill)
                              BouncyPressable(
                                onTap: (_isPosting || _uploadingAttachment) ? null : _submitPost,
                                scaleDown: 0.96,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 22, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF5856D6),
                                    borderRadius: BorderRadius.circular(50),
                                  ),
                                  child: _isPosting
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Text(
                                          'Post',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ── 2. Filter Pills Row ────────────────────────
                    Row(
                      children: [
                        _FilterPill(
                          label: 'Recent',
                          isSelected: _feedFilter == 'recent',
                          onTap: () => setState(() => _feedFilter = 'recent'),
                        ),
                        const SizedBox(width: 8),
                        _FilterPill(
                          label: 'Popular',
                          isSelected: _feedFilter == 'popular',
                          onTap: () => setState(() => _feedFilter = 'popular'),
                        ),
                        const SizedBox(width: 8),
                        _FilterPill(
                          label: 'Unanswered',
                          isSelected: _feedFilter == 'unanswered',
                          onTap: () =>
                              setState(() => _feedFilter = 'unanswered'),
                        ),
                      ],
                    ),

                    const SizedBox(height: 14),

                    // ── 3. Posts Stream ────────────────────────────
                    messagesAsync.when(
                      loading: () => const PageLoading(),
                      error: (err, _) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        child: Center(
                          child: Text(
                            'Error loading posts: $err',
                            style: TextStyle(color: tokens.danger),
                          ),
                        ),
                      ),
                      data: (allMessages) {
                        final visibleMessages = allMessages.where((m) {
                          final isDel = m['isDeleted'] == true ||
                              m['isSystemDeleted'] == true;
                          return !isDel || isManager;
                        }).toList();

                        // Main posts only (replyToId is null or empty)
                        final mainPosts = visibleMessages.where((m) {
                          final replyToId = m['replyToId'] as String?;
                          return replyToId == null || replyToId.isEmpty;
                        }).toList();

                        // Apply filter
                        if (_feedFilter == 'recent') {
                          mainPosts.sort((a, b) {
                            final da = DateTime.tryParse(a['createdAt'] ?? '') ??
                                DateTime.now();
                            final db = DateTime.tryParse(b['createdAt'] ?? '') ??
                                DateTime.now();
                            return db.compareTo(da);
                          });
                        } else if (_feedFilter == 'popular') {
                          mainPosts.sort((a, b) {
                            int likesA = 0;
                            int likesB = 0;
                            try {
                              likesA = (jsonDecode(a['likes'] ?? '[]') as List)
                                  .length;
                            } catch (_) {}
                            try {
                              likesB = (jsonDecode(b['likes'] ?? '[]') as List)
                                  .length;
                            } catch (_) {}
                            return likesB.compareTo(likesA);
                          });
                        } else if (_feedFilter == 'unanswered') {
                          mainPosts.retainWhere((p) {
                            final pid = p['id'] as String?;
                            final count = visibleMessages
                                .where((m) => m['replyToId'] == pid)
                                .length;
                            return count == 0;
                          });
                        }

                        // Pinned posts to top
                        mainPosts.sort((a, b) {
                          final pinA = a['isPinned'] == true ? 1 : 0;
                          final pinB = b['isPinned'] == true ? 1 : 0;
                          return pinB.compareTo(pinA);
                        });

                        if (mainPosts.isEmpty) {
                          return Container(
                            padding: const EdgeInsets.symmetric(vertical: 48),
                            alignment: Alignment.center,
                            child: Column(
                              children: [
                                Icon(Icons.forum_outlined,
                                    size: 40, color: tokens.textMuted),
                                const SizedBox(height: 10),
                                Text(
                                  'No posts match this filter',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: tokens.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }

                        return Column(
                          children: mainPosts.map((post) {
                            final postId = post['id'] as String;
                            final sender =
                                (post['sender'] as Map<String, dynamic>?) ?? {};
                            final senderName =
                                (sender['name'] as String?) ?? 'Student';
                            final senderRole =
                                (sender['role'] as String?) ?? 'STUDENT';
                            final senderAvatar = sender['avatar'] as String?;
                            final senderGender = sender['gender'] as String?;

                            final content = (post['content'] as String?) ?? '';
                            final imageUrl = post['imageUrl'] as String?;
                            final fileUrl = post['fileUrl'] as String?;
                            final fileName = post['fileName'] as String?;
                            final createdAt = post['createdAt'] as String?;
                            final isPinned = post['isPinned'] == true;

                            // Parse likes
                            List<dynamic> likesList = [];
                            try {
                              likesList = jsonDecode(post['likes'] ?? '[]');
                            } catch (_) {}
                            final hasLiked =
                                myId != null && likesList.contains(myId);

                            // Parse reactions (highlight)
                            bool isHighlighted = false;
                            try {
                              final rx = jsonDecode(post['reactions'] ?? '{}')
                                  as Map<String, dynamic>;
                              if (rx['__highlight'] != null) {
                                isHighlighted = true;
                              }
                            } catch (_) {}

                            // Comments for this post
                            final comments = visibleMessages.where((m) =>
                                m['replyToId'] == postId).toList();
                            final isExpanded = _expandedPostId == postId;

                            final senderId = (sender['id'] as String?) ?? '';
                            final canManage = isManager;
                            final isAuthor = myId != null && sender['id'] == myId;

                            return _PostCard(
                              postId: postId,
                              senderId: senderId,
                              senderName: senderName,
                              senderRole: senderRole,
                              senderAvatar: senderAvatar,
                              senderGender: senderGender,
                              content: content,
                              imageUrl: imageUrl,
                              fileUrl: fileUrl,
                              fileName: fileName,
                              createdAt: createdAt,
                              isPinned: isPinned,
                              isHighlighted: isHighlighted,
                              likesCount: likesList.length,
                              hasLiked: hasLiked,
                              commentsCount: comments.length,
                              comments: comments,
                              isExpanded: isExpanded,
                              canManage: canManage,
                              isAuthor: isAuthor,
                              replyController: _getReplyController(postId),
                              isReplying: _replyingPostId == postId,
                              onToggleLike: () => _toggleLike(postId),
                              onToggleExpand: () {
                                setState(() {
                                  _expandedPostId =
                                      isExpanded ? null : postId;
                                });
                              },
                              onSubmitReply: () => _submitReply(postId),
                              onTogglePin: () =>
                                  _togglePin(postId, isPinned),
                              onToggleHighlight: () =>
                                  _toggleHighlight(postId, isHighlighted),
                              onDelete: () => _deletePost(postId),
                            );
                          }).toList(),
                        );
                      },
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

class _ComposerToolBtn extends StatelessWidget {
  const _ComposerToolBtn({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ApplePressable(
      onTap: onTap,
      pressedScale: 0.95,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: tokens.surfaceSecondary,
          borderRadius: BorderRadius.circular(50),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: tokens.textSecondary, weight: 500),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: tokens.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ApplePressable(
      onTap: onTap,
      pressedScale: 0.95,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: kEaseOutStrong,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF5856D6) : tokens.cardBg,
          borderRadius: BorderRadius.circular(50),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : tokens.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _PostCard extends StatelessWidget {
  const _PostCard({
    required this.postId,
    required this.senderId,
    required this.senderName,
    required this.senderRole,
    required this.senderAvatar,
    required this.senderGender,
    required this.content,
    required this.imageUrl,
    required this.fileUrl,
    required this.fileName,
    required this.createdAt,
    required this.isPinned,
    required this.isHighlighted,
    required this.likesCount,
    required this.hasLiked,
    required this.commentsCount,
    required this.comments,
    required this.isExpanded,
    required this.canManage,
    required this.isAuthor,
    required this.replyController,
    required this.isReplying,
    required this.onToggleLike,
    required this.onToggleExpand,
    required this.onSubmitReply,
    required this.onTogglePin,
    required this.onToggleHighlight,
    required this.onDelete,
  });

  final String postId;
  final String senderId;
  final String senderName;
  final String senderRole;
  final String? senderAvatar;
  final String? senderGender;
  final String content;
  final String? imageUrl;
  final String? fileUrl;
  final String? fileName;
  final String? createdAt;
  final bool isPinned;
  final bool isHighlighted;
  final int likesCount;
  final bool hasLiked;
  final int commentsCount;
  final List<Map<String, dynamic>> comments;
  final bool isExpanded;
  final bool canManage;
  final bool isAuthor;
  final TextEditingController replyController;
  final bool isReplying;
  final VoidCallback onToggleLike;
  final VoidCallback onToggleExpand;
  final VoidCallback onSubmitReply;
  final VoidCallback onTogglePin;
  final VoidCallback onToggleHighlight;
  final VoidCallback onDelete;

  String _formatDate(String? raw) {
    if (raw == null) return '';
    final dt = DateTime.tryParse(raw)?.toLocal();
    if (dt == null) return '';
    final day = dt.day.toString().padLeft(2, '0');
    final month = dt.month.toString().padLeft(2, '0');
    final year = dt.year;
    final hour = dt.hour.toString().padLeft(2, '0');
    final min = dt.minute.toString().padLeft(2, '0');
    return '$day/$month/$year at $hour:$min';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final formattedDate = _formatDate(createdAt);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isHighlighted
            ? const Color(0xFFFF9500).withOpacity(0.08)
            : tokens.cardBg,
        borderRadius: BorderRadius.circular(22),
        border: isHighlighted
            ? Border.all(
                color: const Color(0xFFFF9500).withValues(alpha: 0.5),
                width: 1.5,
              )
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Post Header ───────────────────────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              InkWell(
                onTap: senderId.isNotEmpty
                    ? () => showSocialCard(context, userId: senderId)
                    : null,
                borderRadius: BorderRadius.circular(50),
                child: AppAvatar(
                  avatarUrl: senderAvatar,
                  gender: senderGender,
                  size: 36,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        InkWell(
                          onTap: senderId.isNotEmpty
                              ? () => showSocialCard(context, userId: senderId)
                              : null,
                          child: Text(
                            senderName,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.2,
                              color: Color(0xFF5856D6),
                            ),
                          ),
                        ),
                        if (senderRole.toUpperCase() == 'MANAGER' ||
                            senderRole.toUpperCase() == 'ADMIN' ||
                            senderRole.toUpperCase() == 'SUPER_ADMIN')
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF5856D6).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color:
                                    const Color(0xFF5856D6).withOpacity(0.3),
                              ),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Symbols.shield_rounded,
                                    size: 11, fill: 1, color: Color(0xFF5856D6)),
                                SizedBox(width: 3),
                                Text(
                                  'Manager',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF5856D6),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (isPinned)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFF9500).withOpacity(0.14),
                              borderRadius: BorderRadius.circular(50),
                              border: Border.all(
                                color:
                                    const Color(0xFFFF9500).withOpacity(0.4),
                              ),
                            ),
                            child: const Text(
                              'Pinned',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFD97706),
                              ),
                            ),
                          ),
                        if (isHighlighted)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEA580C).withOpacity(0.14),
                              borderRadius: BorderRadius.circular(50),
                              border: Border.all(
                                color:
                                    const Color(0xFFEA580C).withOpacity(0.4),
                              ),
                            ),
                            child: const Text(
                              'Highlighted',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFEA580C),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      formattedDate,
                      style: TextStyle(
                        fontSize: 12.5,
                        color: tokens.textMuted,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),

              // Options Menu
              if (canManage || isAuthor)
                PopupMenuButton<String>(
                  icon: Icon(Symbols.more_horiz_rounded,
                      size: 22, weight: 600, color: tokens.textMuted),
                  onSelected: (val) {
                    if (val == 'pin') onTogglePin();
                    if (val == 'highlight') onToggleHighlight();
                    if (val == 'delete') onDelete();
                  },
                  itemBuilder: (ctx) => [
                    if (canManage) ...[
                      PopupMenuItem(
                        value: 'pin',
                        child: Text(isPinned ? 'Unpin post' : 'Pin post'),
                      ),
                      PopupMenuItem(
                        value: 'highlight',
                        child: Text(isHighlighted
                            ? 'Remove highlight'
                            : 'Highlight post'),
                      ),
                    ],
                    if (canManage || isAuthor)
                      const PopupMenuItem(
                        value: 'delete',
                        child: Text('Delete post',
                            style: TextStyle(color: Colors.red)),
                      ),
                  ],
                ),
            ],
          ),

          const SizedBox(height: 12),

          // ── Post Body ─────────────────────────────────────────
          Text(
            content,
            style: TextStyle(
              fontSize: 15.5,
              color: tokens.textPrimary,
              height: 1.45,
              fontWeight: FontWeight.w400,
            ),
          ),

          if (imageUrl != null && imageUrl!.isNotEmpty) ...[
            const SizedBox(height: 10),
            CommunityAttachment(url: imageUrl!),
          ],
          if (fileUrl != null && fileUrl!.isNotEmpty && fileUrl != imageUrl) ...[
            const SizedBox(height: 10),
            CommunityAttachment(url: fileUrl!, name: fileName),
          ],

          // Reactions Summary Pill
          if (likesCount > 0) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: tokens.surfaceSecondary,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('❤️', style: TextStyle(fontSize: 11)),
                    const SizedBox(width: 4),
                    Text(
                      '$likesCount',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],

          const SizedBox(height: 10),
          Divider(color: tokens.border, thickness: 0.5, height: 1),
          const SizedBox(height: 6),

          // ── Post Actions Row ──────────────────────────────────
          Row(
            children: [
              // Like Button
              InkWell(
                onTap: onToggleLike,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 6),
                  child: Row(
                    children: [
                      Icon(
                        Symbols.favorite_rounded,
                        fill: hasLiked ? 1 : 0,
                        size: 19,
                        color: hasLiked
                            ? const Color(0xFFFF3B30)
                            : tokens.textSecondary,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'Like',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: hasLiked
                              ? const Color(0xFFFF3B30)
                              : tokens.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 14),

              // Comments Button
              InkWell(
                onTap: onToggleExpand,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 6),
                  child: Row(
                    children: [
                      Icon(Symbols.chat_bubble_rounded,
                          size: 18, color: tokens.textSecondary),
                      const SizedBox(width: 5),
                      Text(
                        'Comments ($commentsCount)',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: tokens.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // ── Expanded Comments List ────────────────────────────
          if (isExpanded) ...[
            const SizedBox(height: 12),
            Divider(color: tokens.borderLight, height: 1),
            const SizedBox(height: 10),

            if (comments.isNotEmpty) ...[
              Column(
                children: comments.map((comment) {
                  final cSender =
                      (comment['sender'] as Map<String, dynamic>?) ?? {};
                  final cName = (cSender['name'] as String?) ?? 'Student';
                  final cRole = (cSender['role'] as String?) ?? 'STUDENT';
                  final cAvatar = cSender['avatar'] as String?;
                  final cGender = cSender['gender'] as String?;
                  final cContent = (comment['content'] as String?) ?? '';
                  final cDate = _formatDate(comment['createdAt'] as String?);

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        InkWell(
                          onTap: cSender['id'] != null
                              ? () => showSocialCard(context, userId: cSender['id'] as String)
                              : null,
                          borderRadius: BorderRadius.circular(50),
                          child: AppAvatar(
                            avatarUrl: cAvatar,
                            gender: cGender,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  InkWell(
                                    onTap: cSender['id'] != null
                                        ? () => showSocialCard(context, userId: cSender['id'] as String)
                                        : null,
                                    child: Text(
                                      cName,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: tokens.textPrimary,
                                      ),
                                    ),
                                  ),
                                  if (cRole == 'MANAGER' || cRole == 'ADMIN') ...[
                                    const SizedBox(width: 4),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 4, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF5856D6)
                                            .withOpacity(0.12),
                                        borderRadius:
                                            BorderRadius.circular(3),
                                      ),
                                      child: const Text(
                                        'Manager',
                                        style: TextStyle(
                                          fontSize: 8.5,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFF5856D6),
                                        ),
                                      ),
                                    ),
                                  ],
                                  const Spacer(),
                                  Text(
                                    cDate,
                                    style: TextStyle(
                                      fontSize: 9.5,
                                      color: tokens.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Text(
                                cContent,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: tokens.textPrimary,
                                  height: 1.35,
                                ),
                              ),
                              if (comment['imageUrl'] is String) CommunityAttachment(url: comment['imageUrl'] as String),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 6),
            ],

            // Quick Reply Composer
            Row(
              children: [
                Expanded(
                  child: Container(
                    height: 38,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: tokens.border),
                    ),
                    alignment: Alignment.center,
                    child: TextField(
                      controller: replyController,
                      decoration: InputDecoration(
                        hintText: 'Write a comment...',
                        hintStyle: TextStyle(
                          fontSize: 12.5,
                          color: tokens.textMuted,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                      style: TextStyle(
                        fontSize: 12.5,
                        color: tokens.textPrimary,
                      ),
                      onSubmitted: (_) => onSubmitReply(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: isReplying ? null : onSubmitReply,
                  borderRadius: BorderRadius.circular(50),
                  child: Container(
                    width: 34,
                    height: 34,
                    decoration: const BoxDecoration(
                      color: Color(0xFF5856D6),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: isReplying
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(
                            Symbols.arrow_upward_rounded,
                            color: Colors.white,
                            weight: 700,
                            size: 18,
                          ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
