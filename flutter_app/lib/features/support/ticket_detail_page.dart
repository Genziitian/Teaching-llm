import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../config/api_config.dart';
import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../community/community_file_upload.dart';
import 'support_providers.dart';

class TicketDetailPage extends ConsumerStatefulWidget {
  const TicketDetailPage({super.key, required this.ticketId});
  final String ticketId;
  @override
  ConsumerState<TicketDetailPage> createState() => _TicketDetailPageState();
}

class _TicketDetailPageState extends ConsumerState<TicketDetailPage>
    with WidgetsBindingObserver {
  final _message = TextEditingController();
  final _scroll = ScrollController();
  Timer? _timer;
  bool _busy = false;
  String? _error;
  // Photo picked and uploaded, waiting to be sent with the next reply.
  Map<String, String>? _attachment;
  String get _path =>
      '/api/support/tickets/${Uri.encodeComponent(widget.ticketId)}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _poll());
  }

  void _poll() {
    if (mounted &&
        !_busy &&
        ModalRoute.of(context)?.isCurrent == true &&
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed &&
        !ref.read(supportTicketProvider(widget.ticketId)).isLoading) {
      ref.invalidate(supportTicketProvider(widget.ticketId));
      ref.invalidate(supportTicketsProvider);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _poll();
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _message.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _refresh() {
    ref.invalidate(supportTicketProvider(widget.ticketId));
    ref.invalidate(supportTicketsProvider);
  }

  Future<void> _pickPhoto() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Same rules as the web support page: JPG/PNG/WEBP photos up to 5 MB.
      final picked = await pickCommunityAttachment(ref.read(apiClientProvider),
          images: true, maxMb: 5);
      if (mounted && picked != null) setState(() => _attachment = picked);
    } catch (error) {
      if (mounted) setState(() => _error = communityUploadError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _send() async {
    final content = _message.text.trim();
    final imageUrl = _attachment?['url'];
    if ((content.isEmpty && imageUrl == null) || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).post('$_path/replies', body: {
        'content': content,
        if (imageUrl != null) 'imageUrl': imageUrl,
      });
      if (!mounted) return;
      _message.clear();
      setState(() => _attachment = null);
      _refresh();
      // Refresh failure must not make a successful send look unsent.
      try {
        await ref.read(supportTicketProvider(widget.ticketId).future);
      } catch (_) {}
      if (mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && _scroll.hasClients) {
            _scroll.animateTo(_scroll.position.maxScrollExtent,
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOut);
          }
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = supportError(error));
        _refresh();
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _update(Map<String, dynamic> body) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).put(_path, body: body);
      if (mounted) _refresh();
    } catch (error) {
      if (mounted) setState(() => _error = supportError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(String title, String description) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
            title: Text(title),
            content: Text(description),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cancel')),
              FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Delete')),
            ]),
      ) ??
      false;

  Future<void> _deleteTicket() async {
    if (!await _confirm('Delete ticket?',
            'This permanently removes the ticket and its conversation.') ||
        !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).delete(_path);
      if (!mounted) return;
      ref.invalidate(supportTicketsProvider);
      context.canPop() ? context.pop() : context.go('/support');
    } catch (error) {
      if (mounted) setState(() => _error = supportError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _manageReply(Map<String, dynamic> reply, String action) async {
    String? content;
    if (action == 'edit') {
      content = await showDialog<String>(
        context: context,
        builder: (_) => _EditReplyDialog(content: '${reply['content'] ?? ''}'),
      );
      if (content == null) return;
    } else if (!await _confirm('Delete your reply?',
        'This reply will be removed from the conversation.')) {
      return;
    }
    if (!mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      if (action == 'edit') {
        await api.put('$_path/replies',
            body: {'replyId': reply['id'], 'content': content});
      } else {
        await api.delete('$_path/replies', body: {'replyId': reply['id']});
      }
      if (mounted) _refresh();
    } catch (error) {
      if (mounted) setState(() => _error = supportError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final session = ref.watch(supportSessionProvider);
    final manager = session.role == 'MANAGER';
    final ticket = ref.watch(supportTicketProvider(widget.ticketId));
    return AppPageScaffold(
      title: 'Ticket conversation',
      onBack: () => context.canPop() ? context.pop() : context.go('/support'),
      right: IconButton(
          onPressed: _busy ? null : _refresh,
          icon: const Icon(Icons.refresh),
          tooltip: 'Refresh conversation'),
      body: ticket.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
            child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(supportError(error)),
                  TextButton(
                      onPressed: _refresh, child: const Text('Try again'))
                ]))),
        data: (data) {
          final replies =
              (data['replies'] as List? ?? []).cast<Map<String, dynamic>>();
          final closed = data['status'] == 'CLOSED';
          return Column(children: [
            if (_busy) const LinearProgressIndicator(minHeight: 2),
            Expanded(
                child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(supportTicketProvider(widget.ticketId));
                try {
                  await ref.read(supportTicketProvider(widget.ticketId).future);
                } catch (_) {}
              },
              child: ListView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: [
                  Text('${data['title']}',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: tokens.textPrimary)),
                  const SizedBox(height: 8),
                  Text(ticketStatusLabel(data['status']),
                      style: TextStyle(
                          color: tokens.primaryAccent,
                          fontWeight: FontWeight.w700)),
                  if (data['course'] != null)
                    Text('Course: ${data['course']['name']}'),
                  if (data['assignedTo'] != null)
                    Text('Assigned to: ${data['assignedTo']['name']}',
                        style: TextStyle(color: tokens.textSecondary)),
                  if (manager) ...[
                    const SizedBox(height: 12),
                    ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        title: const Text('Manage ticket'),
                        children: [
                          Wrap(spacing: 8, children: [
                            for (final status in [
                              'OPEN',
                              'IN_PROGRESS',
                              'RESOLVED',
                              'CLOSED'
                            ])
                              ChoiceChip(
                                  label: Text(ticketStatusLabel(status)),
                                  selected: data['status'] == status,
                                  onSelected: _busy
                                      ? null
                                      : (_) => _update({'status': status})),
                          ]),
                          const SizedBox(height: 12),
                          ref.watch(supportManagersProvider).when(
                                loading: () => const LinearProgressIndicator(),
                                error: (_, __) => TextButton(
                                    onPressed: () =>
                                        ref.invalidate(supportManagersProvider),
                                    child:
                                        const Text('Retry loading managers')),
                                data: (managers) =>
                                    DropdownButtonFormField<String>(
                                  key: ValueKey(
                                      '${data['assignedToId']}-${managers.length}'),
                                  value: managers.any((m) =>
                                          m['id'] == data['assignedToId'])
                                      ? data['assignedToId'] as String
                                      : '',
                                  isExpanded: true,
                                  decoration: const InputDecoration(
                                      labelText: 'Assign to',
                                      border: OutlineInputBorder()),
                                  items: [
                                    const DropdownMenuItem(
                                        value: '', child: Text('Unassigned')),
                                    for (final m in managers)
                                      DropdownMenuItem(
                                          value: m['id'] as String,
                                          child: Text('${m['name']}',
                                              overflow: TextOverflow.ellipsis))
                                  ],
                                  onChanged: _busy
                                      ? null
                                      : (value) =>
                                          _update({'assignedToId': value}),
                                ),
                              ),
                          TextButton.icon(
                              onPressed: _busy ? null : _deleteTicket,
                              icon: Icon(Icons.delete_outline,
                                  color: tokens.danger),
                              label: Text('Delete ticket',
                                  style: TextStyle(color: tokens.danger))),
                        ]),
                  ],
                  const SizedBox(height: 18),
                  _MessageCard(
                      name:
                          '${data['user']?['name'] ?? 'Student'} · Original request',
                      content: '${data['description'] ?? ''}',
                      createdAt: '${data['createdAt']}',
                      mine: data['studentId'] == session.id),
                  const SizedBox(height: 18),
                  Text('Conversation',
                      style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: tokens.textPrimary)),
                  const SizedBox(height: 12),
                  if (replies.isEmpty)
                    Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text(
                            manager
                                ? 'No replies yet. Send a message below.'
                                : 'Waiting for a manager to reply. You can add more details below.',
                            style: TextStyle(color: tokens.textSecondary))),
                  for (final reply in replies)
                    _ReplyBubble(
                      name:
                          '${reply['sender']?['name'] ?? 'User'}${reply['sender']?['role'] == 'MANAGER' ? ' · Manager' : ''}',
                      content: '${reply['content'] ?? ''}',
                      createdAt: '${reply['createdAt']}',
                      imageUrl: reply['imageUrl'] as String?,
                      mine: reply['senderId'] == session.id,
                      actions: manager && reply['senderId'] == session.id
                          ? PopupMenuButton<String>(
                              enabled: !_busy,
                              tooltip: 'Reply options',
                              padding: EdgeInsets.zero,
                              icon: Icon(Icons.more_vert,
                                  size: 18,
                                  color: _onColor(tokens.primaryAccent)),
                              onSelected: (action) =>
                                  _manageReply(reply, action),
                              itemBuilder: (_) => [
                                    const PopupMenuItem(
                                        value: 'edit',
                                        child: Text('Edit reply')),
                                    const PopupMenuItem(
                                        value: 'delete',
                                        child: Text('Delete reply'))
                                  ])
                          : null,
                    ),
                ],
              ),
            )),
            if (_error != null)
              Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Text(_error!, style: TextStyle(color: tokens.danger))),
            SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: closed
                      ? const Text(
                          'This ticket is closed. Create a new ticket from Support if you need more help.')
                      : Column(mainAxisSize: MainAxisSize.min, children: [
                          if (_attachment != null)
                            Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.fromLTRB(8, 8, 4, 8),
                              decoration: BoxDecoration(
                                  color: tokens.surfaceSecondary,
                                  border: Border.all(color: tokens.border),
                                  borderRadius: BorderRadius.circular(12)),
                              child: Row(children: [
                                ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.network(
                                        _resolveUrl(_attachment!['url'])
                                                ?.toString() ??
                                            '',
                                        width: 48,
                                        height: 48,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) => SizedBox(
                                            width: 48,
                                            height: 48,
                                            child: Icon(Icons.image_outlined,
                                                color: tokens.textMuted)))),
                                const SizedBox(width: 10),
                                Expanded(
                                    child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                      Text('Photo attached',
                                          style: TextStyle(
                                              fontWeight: FontWeight.w700,
                                              color: tokens.textPrimary)),
                                      Text(_attachment!['name'] ?? '',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              fontSize: 11.5,
                                              color: tokens.textSecondary)),
                                    ])),
                                IconButton(
                                    onPressed: _busy
                                        ? null
                                        : () =>
                                            setState(() => _attachment = null),
                                    icon: const Icon(Icons.close, size: 18),
                                    tooltip: 'Remove photo'),
                              ]),
                            ),
                          Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                              IconButton(
                                  onPressed: _busy ? null : _pickPhoto,
                                  icon: const Icon(Icons.image_outlined),
                                  color: tokens.primaryAccent,
                                  tooltip: 'Attach photo'),
                              const SizedBox(width: 4),
                              Expanded(
                                  child: TextField(
                                      controller: _message,
                                      enabled: !_busy,
                                      minLines: 1,
                                      maxLines: 5,
                                      maxLength: 10000,
                                      decoration: const InputDecoration(
                                          hintText: 'Add a message…',
                                          counterText: '',
                                          border: OutlineInputBorder()))),
                              const SizedBox(width: 8),
                              IconButton.filled(
                                  onPressed: _busy ? null : _send,
                                  icon: const Icon(Icons.send_rounded),
                                  tooltip: 'Send reply',
                                  style: IconButton.styleFrom(
                                      backgroundColor: tokens.primaryAccent,
                                      foregroundColor: Colors.white)),
                            ]),
                        ]),
                )),
          ]);
        },
      ),
    );
  }
}

/// Resolves a stored attachment path/URL against the API host.
Uri? _resolveUrl(String? url) {
  if (url == null || url.isEmpty) return null;
  final uri = Uri.tryParse(ApiConfig.baseUrl)?.resolve(url);
  return uri != null && ['http', 'https'].contains(uri.scheme) ? uri : null;
}

/// Readable text colour on top of [background].
Color _onColor(Color background) =>
    ThemeData.estimateBrightnessForColor(background) == Brightness.dark
        ? Colors.white
        : Colors.black;

/// Chat-style reply: the viewer's own messages sit on the right in the accent
/// colour, everyone else's on the left in a neutral bubble.
class _ReplyBubble extends StatelessWidget {
  const _ReplyBubble(
      {required this.name,
      required this.content,
      required this.createdAt,
      required this.mine,
      this.imageUrl,
      this.actions});
  final String name, content, createdAt;
  final bool mine;
  final String? imageUrl;
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final date = DateTime.tryParse(createdAt)?.toLocal();
    final image = _resolveUrl(imageUrl);
    final bubbleColor = mine ? tokens.primaryAccent : tokens.surfaceSecondary;
    final fg = mine ? _onColor(bubbleColor) : tokens.textPrimary;
    final subtle = mine ? fg.withOpacity(0.75) : tokens.textMuted;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.78, minWidth: 96),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(12, 9, 12, 8),
        decoration: BoxDecoration(
            color: bubbleColor,
            border: mine ? null : Border.all(color: tokens.border),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(mine ? 16 : 4),
              bottomRight: Radius.circular(mine ? 4 : 16),
            )),
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!mine || actions != null)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Flexible(
                      child: Text(mine ? 'You' : name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: mine ? fg : tokens.primaryAccent))),
                  if (actions != null)
                    SizedBox(width: 28, height: 24, child: actions!),
                ]),
              if (image != null) ...[
                const SizedBox(height: 6),
                InkWell(
                    onTap: () => showDialog<void>(
                        context: context,
                        builder: (context) => Dialog(
                                child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                  Align(
                                      alignment: Alignment.centerRight,
                                      child: IconButton(
                                          onPressed: () =>
                                              Navigator.pop(context),
                                          icon: const Icon(Icons.close))),
                                  Flexible(
                                      child: InteractiveViewer(
                                          child: Image.network(
                                              image.toString(),
                                              errorBuilder: (_, __, ___) =>
                                                  const Text(
                                                      'Unable to load attachment'))))
                                ]))),
                    child: ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.network(image.toString(),
                            height: 180,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Text(
                                'Unable to load attachment',
                                style: TextStyle(color: fg))))),
              ],
              if (content.isNotEmpty) ...[
                const SizedBox(height: 4),
                SelectableText(content,
                    style: TextStyle(color: fg, height: 1.45, fontSize: 14.5)),
              ],
              if (date != null) ...[
                const SizedBox(height: 4),
                Text(DateFormat('d MMM, h:mm a').format(date),
                    style: TextStyle(fontSize: 10.5, color: subtle)),
              ],
            ]),
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard(
      {required this.name,
      required this.content,
      required this.createdAt,
      required this.mine,
      this.imageUrl,
      this.actions});
  final String name, content, createdAt;
  final bool mine;
  final String? imageUrl;
  final Widget? actions;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final date = DateTime.tryParse(createdAt)?.toLocal();
    final image = imageUrl == null
        ? null
        : Uri.tryParse(ApiConfig.baseUrl)?.resolve(imageUrl!);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: mine ? tokens.primaryAccent.withOpacity(0.08) : tokens.cardBg,
          border: Border.all(color: tokens.border),
          borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
              child: Text(name,
                  style: TextStyle(
                      fontWeight: FontWeight.w700, color: tokens.textPrimary))),
          if (actions != null) actions!
        ]),
        if (content.isNotEmpty) ...[
          const SizedBox(height: 8),
          SelectableText(content,
              style: TextStyle(color: tokens.textPrimary, height: 1.5))
        ],
        if (image != null && ['http', 'https'].contains(image.scheme)) ...[
          const SizedBox(height: 10),
          InkWell(
              onTap: () => showDialog<void>(
                  context: context,
                  builder: (context) => Dialog(
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                        Align(
                            alignment: Alignment.centerRight,
                            child: IconButton(
                                onPressed: () => Navigator.pop(context),
                                icon: const Icon(Icons.close))),
                        Flexible(
                            child: InteractiveViewer(
                                child: Image.network(image.toString(),
                                    errorBuilder: (_, __, ___) => const Text(
                                        'Unable to load attachment'))))
                      ]))),
              child: Image.network(image.toString(),
                  height: 180,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) =>
                      const Text('Unable to load attachment'))),
        ],
        if (date != null) ...[
          const SizedBox(height: 8),
          Text(DateFormat('d MMM, h:mm a').format(date),
              style: TextStyle(fontSize: 11, color: tokens.textMuted))
        ],
      ]),
    );
  }
}

class _EditReplyDialog extends StatefulWidget {
  const _EditReplyDialog({required this.content});
  final String content;
  @override
  State<_EditReplyDialog> createState() => _EditReplyDialogState();
}

class _EditReplyDialogState extends State<_EditReplyDialog> {
  late final _controller = TextEditingController(text: widget.content);
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Edit your reply'),
        content: TextField(
            controller: _controller,
            minLines: 3,
            maxLines: 6,
            maxLength: 10000),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, _controller.text.trim()),
              child: const Text('Save')),
        ],
      );
}
