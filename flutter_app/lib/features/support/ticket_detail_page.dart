import 'dart:async';
import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../config/api_config.dart';
import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/apple_alert.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../shared/widgets/apple_input.dart';
import '../../theme/app_theme_tokens.dart';
import '../community/community_file_upload.dart';
import 'support_providers.dart';
import '../../shared/widgets/shimmer_loading.dart';

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
      await showAppleAlert<bool>(
        context,
        title: title,
        message: description,
        actions: const [
          AppleAlertAction(label: 'Cancel', value: false, isDefault: true),
          AppleAlertAction(label: 'Delete', value: true, isDestructive: true),
        ],
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
      title: 'Ticket',
      onBack: () => context.canPop() ? context.pop() : context.go('/support'),
      right: IconButton(
          onPressed: _busy ? null : _refresh,
          icon: const Icon(Symbols.refresh_rounded, weight: 600),
          tooltip: 'Refresh conversation'),
      body: ticket.when(
        loading: () => const PageLoading(),
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
                          fontSize: 28,
                          height: 1.1,
                          letterSpacing: -0.7,
                          fontWeight: FontWeight.w700,
                          color: tokens.textPrimary)),
                  const SizedBox(height: 12),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    _StatusPill(status: '${data['status']}'),
                    if (data['course'] != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: tokens.cardBg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Symbols.menu_book_rounded,
                              fill: 1, size: 15, color: tokens.textSecondary),
                          const SizedBox(width: 5),
                          Text('${data['course']['name']}',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: tokens.textSecondary)),
                        ]),
                      ),
                  ]),
                  if (manager) ...[
                    const SizedBox(height: 12),
                    ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        shape: const Border(),
                        collapsedShape: const Border(),
                        title: const Text('Manage ticket'),
                        subtitle: data['assignedTo'] != null
                            ? Text('${data['assignedTo']['name']}')
                            : null,
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
                                  showCheckmark: false,
                                  side: BorderSide.none,
                                  shape: const StadiumBorder(),
                                  backgroundColor: tokens.surfaceSecondary,
                                  selectedColor: tokens.primaryAccent,
                                  labelStyle: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: data['status'] == status
                                          ? Colors.white
                                          : tokens.textPrimary),
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
                                  decoration: appleInputDecoration(context,
                                      label: 'Assign to'),
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
                              icon: Icon(Symbols.delete_rounded,
                                  color: tokens.danger),
                              label: Text('Delete ticket',
                                  style: TextStyle(color: tokens.danger))),
                        ]),
                  ],
                  const SizedBox(height: 22),
                  _ReplyBubble(
                      name: '${data['user']?['name'] ?? 'Student'}',
                      content: '${data['description'] ?? ''}',
                      createdAt: '${data['createdAt']}',
                      mine: data['studentId'] == session.id),
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
                              icon: Icon(Symbols.more_horiz_rounded,
                                  size: 20,
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
            Container(
              decoration: BoxDecoration(
                color: tokens.cardBg,
                border:
                    Border(top: BorderSide(color: tokens.border, width: 0.5)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: closed
                      ? Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Center(
                            child: Text(
                              'This ticket is closed. Create a new ticket from Support if you need more help.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  fontSize: 14,
                                  height: 1.35,
                                  color: tokens.textSecondary),
                            ),
                          ),
                        )
                      : Column(mainAxisSize: MainAxisSize.min, children: [
                          if (_attachment != null)
                            Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.fromLTRB(8, 8, 6, 8),
                              decoration: BoxDecoration(
                                  color: tokens.surfaceSecondary,
                                  borderRadius: BorderRadius.circular(16)),
                              child: Row(children: [
                                ClipRRect(
                                    borderRadius: BorderRadius.circular(10),
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
                                            child: Icon(Symbols.image_rounded,
                                                color: tokens.textMuted)))),
                                const SizedBox(width: 10),
                                Expanded(
                                    child: Text(_attachment!['name'] ?? '',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                            fontSize: 14,
                                            color: tokens.textPrimary))),
                                IconButton(
                                    onPressed: _busy
                                        ? null
                                        : () =>
                                            setState(() => _attachment = null),
                                    icon: Icon(Symbols.cancel_rounded,
                                        fill: 1,
                                        size: 22,
                                        color: tokens.textMuted),
                                    tooltip: 'Remove photo'),
                              ]),
                            ),
                          Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 4),
                                  child: ApplePressable(
                                    onTap: _busy ? null : _pickPhoto,
                                    pressedScale: 0.9,
                                    child: Container(
                                      width: 36,
                                      height: 36,
                                      decoration: BoxDecoration(
                                          color: tokens.surfaceSecondary,
                                          shape: BoxShape.circle),
                                      child: Icon(Symbols.add_rounded,
                                          weight: 600,
                                          size: 22,
                                          color: tokens.primaryAccent),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                    child: TextField(
                                        controller: _message,
                                        enabled: !_busy,
                                        minLines: 1,
                                        maxLines: 5,
                                        maxLength: 10000,
                                        decoration: appleInputDecoration(
                                            context,
                                            hint: 'Add a message…',
                                            counterText: '',
                                            fill: tokens.surfaceSecondary,
                                            radius: 22))),
                                const SizedBox(width: 8),
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 4),
                                  child: ValueListenableBuilder<TextEditingValue>(
                                    valueListenable: _message,
                                    builder: (context, v, _) {
                                      final can = (v.text.trim().isNotEmpty ||
                                              _attachment != null) &&
                                          !_busy;
                                      return ApplePressable(
                                        onTap: can ? _send : null,
                                        pressedScale: 0.9,
                                        child: AnimatedContainer(
                                          duration: const Duration(
                                              milliseconds: 160),
                                          curve: kEaseOutStrong,
                                          width: 36,
                                          height: 36,
                                          decoration: BoxDecoration(
                                              color: can
                                                  ? tokens.primaryAccent
                                                  : tokens.surfaceSecondary,
                                              shape: BoxShape.circle),
                                          child: Icon(
                                              Symbols.arrow_upward_rounded,
                                              weight: 700,
                                              size: 21,
                                              color: can
                                                  ? Colors.white
                                                  : tokens.textMuted),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                              ]),
                        ]),
                ),
              ),
            ),
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
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 9),
        decoration: BoxDecoration(
            color: bubbleColor,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(20),
              topRight: const Radius.circular(20),
              bottomLeft: Radius.circular(mine ? 20 : 6),
              bottomRight: Radius.circular(mine ? 6 : 20),
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
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
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
                    style: TextStyle(color: fg, height: 1.4, fontSize: 16)),
              ],
              if (date != null) ...[
                const SizedBox(height: 4),
                Text(DateFormat('d MMM, h:mm a').format(date),
                    style: TextStyle(fontSize: 11.5, color: subtle)),
              ],
            ]),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'IN_PROGRESS' => const Color(0xFF007AFF),
      'RESOLVED' => const Color(0xFF34C759),
      'CLOSED' => const Color(0xFF8E8E93),
      _ => const Color(0xFFFF9500),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(ticketStatusLabel(status),
            style: TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600, color: color)),
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
