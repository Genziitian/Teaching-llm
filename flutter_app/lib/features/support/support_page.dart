import 'dart:async';
import 'package:material_ui/material_ui.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../shared/widgets/app_loading_wrapper.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../shared/widgets/apple_input.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_theme_tokens.dart';
import 'new_ticket_sheet.dart';
import 'faq_page.dart' show faqProvider;
import 'support_providers.dart';
import '../../shared/widgets/shimmer_loading.dart';

class SupportPage extends ConsumerStatefulWidget {
  const SupportPage({super.key});
  @override
  ConsumerState<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends ConsumerState<SupportPage> with WidgetsBindingObserver {
  String _filter = 'All';
  String _search = '';
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted && ModalRoute.of(context)?.isCurrent == true) {
        ref.invalidate(supportTicketsProvider);
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      ref.invalidate(supportTicketsProvider);
    }
  }

  Future<void> _newTicket() async {
    final activeCount = ref.read(supportTicketsProvider).asData?.value
            .where((t) => t['status'] != 'RESOLVED' && t['status'] != 'CLOSED')
            .length ??
        0;
    if (activeCount >= 3) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'You already have 3 active tickets. Please wait until an existing ticket is resolved or closed.'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }
    final id = await NewTicketSheet.show(context);
    if (id != null && mounted) {
      context.push('/support/tickets/${Uri.encodeComponent(id)}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final role = ref.watch(supportSessionProvider).role;
    final manager = role == 'MANAGER';
    final tickets = ref.watch(supportTicketsProvider);
    final activeCount = tickets.asData?.value
            .where((t) => t['status'] != 'RESOLVED' && t['status'] != 'CLOSED')
            .length ??
        0;
    final hasReachedActiveLimit = role == 'STUDENT' && activeCount >= 3;

    final links = <Widget>[
      if (manager)
        _NavRow(
          icon: Symbols.flag_rounded,
          color: const Color(0xFFFF3B30),
          label: 'User Reports',
          isLast: true,
          onTap: () => context.push('/support/user-reports'),
        ),
    ];

    return AppPageScaffold(
      title: manager ? 'Support queue' : 'Support',
      subtitle: manager
          ? 'Read, reply and manage student tickets'
          : 'Get help and follow your conversations',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/more'),
      bottomNavigationBar: role == 'STUDENT'
          ? Container(
              padding: EdgeInsets.fromLTRB(
                  16, 12, 16, 12 + MediaQuery.of(context).padding.bottom),
              decoration: BoxDecoration(
                color: tokens.cardBg,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(26)),
                border: Border.all(color: tokens.border, width: 0.5),
                boxShadow: const [
                  BoxShadow(
                      color: Color(0x1A000000),
                      blurRadius: 24,
                      offset: Offset(0, -6)),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: ApplePressable(
                      onTap: _newTicket,
                      pressedScale: 0.98,
                      child: Container(
                        height: 54,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: hasReachedActiveLimit
                              ? tokens.surfaceSecondary
                              : tokens.primaryAccent,
                          borderRadius: BorderRadius.circular(27),
                          boxShadow: hasReachedActiveLimit
                              ? null
                              : [
                                  BoxShadow(
                                    color: tokens.primaryAccent
                                        .withValues(alpha: 0.35),
                                    blurRadius: 16,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                        ),
                        child: Text(
                          hasReachedActiveLimit
                              ? 'Limit Reached (3/3 Active)'
                              : 'New Ticket',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3,
                            color: hasReachedActiveLimit
                                ? tokens.textMuted
                                : Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Semantics(
                    button: true,
                    label: 'Chat on WhatsApp',
                    child: ApplePressable(
                      onTap: () => launchUrl(
                        Uri.parse('https://wa.me/917254926179'),
                        mode: LaunchMode.externalApplication,
                      ),
                      pressedScale: 0.92,
                      child: Container(
                        width: 54,
                        height: 54,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF25D366),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF25D366)
                                  .withValues(alpha: 0.38),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(13),
                          child: Image.asset('assets/icons/whatsapp.png',
                              fit: BoxFit.contain),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(supportTicketsProvider);
          try {
            await ref.read(supportTicketsProvider.future);
          } catch (_) {}
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            if (hasReachedActiveLimit)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF3B30).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Icon(Symbols.info_rounded,
                        fill: 1, color: Color(0xFFFF3B30), size: 22),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'You have 3 active tickets. You cannot create a new ticket until a manager resolves or closes an existing ticket.',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w500,
                          color: tokens.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (links.isNotEmpty) _Group(children: links),
            const SizedBox(height: 28),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(manager ? 'All tickets' : 'My tickets',
                  style: TextStyle(
                      fontSize: 22,
                      letterSpacing: -0.5,
                      fontWeight: FontWeight.w700,
                      color: tokens.textPrimary)),
            ),
            const SizedBox(height: 12),
            if (manager) ...[
              TextField(
                  onChanged: (value) =>
                      setState(() => _search = value.toLowerCase().trim()),
                  decoration: appleInputDecoration(context,
                      hint: 'Search ticket or student',
                      prefixIcon: const Icon(Symbols.search_rounded))),
              const SizedBox(height: 10),
              Wrap(spacing: 8, children: [
                for (final filter in ['All', 'Active', 'Resolved', 'Closed'])
                  ChoiceChip(
                      label: Text(filter),
                      selected: _filter == filter,
                      showCheckmark: false,
                      side: BorderSide.none,
                      shape: const StadiumBorder(),
                      backgroundColor: tokens.cardBg,
                      selectedColor: tokens.primaryAccent,
                      labelStyle: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: _filter == filter
                              ? Colors.white
                              : tokens.textPrimary),
                      onSelected: (_) => setState(() => _filter = filter)),
              ]),
              const SizedBox(height: 14),
            ],
            tickets.when(
              loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: AppLoadingWrapper(isLoading: true)),
              error: (error, _) => Column(children: [
                Text(supportError(error)),
                TextButton(
                    onPressed: () => ref.invalidate(supportTicketsProvider),
                    child: const Text('Try again'))
              ]),
              data: (all) {
                final visible = manager
                    ? all.where((ticket) {
                        final status = ticket['status'];
                        final matches = _filter == 'All' ||
                            (_filter == 'Active' &&
                                (status == 'OPEN' ||
                                    status == 'IN_PROGRESS')) ||
                            status == _filter.toUpperCase();
                        return matches &&
                            '${ticket['title']} ${ticket['user']?['name'] ?? ''}'
                                .toLowerCase()
                                .contains(_search);
                      }).toList()
                    : all;
                if (visible.isEmpty) {
                  return Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        vertical: 28, horizontal: 20),
                    decoration: BoxDecoration(
                      color: tokens.cardBg,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Column(
                      children: [
                        Icon(Symbols.inbox_rounded,
                            size: 34, color: tokens.textMuted),
                        const SizedBox(height: 8),
                        Text(
                            all.isEmpty
                                ? (manager
                                    ? 'No tickets yet.'
                                    : 'No tickets raised yet.')
                                : 'No tickets match this filter.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 15, color: tokens.textSecondary)),
                      ],
                    ),
                  );
                }
                return _Group(
                  children: [
                    for (var i = 0; i < visible.length; i++)
                      _TicketRow(
                        ticket: visible[i],
                        manager: manager,
                        isLast: i == visible.length - 1,
                      ),
                  ],
                );
              },
            ),
            if (!manager) ...[
              const SizedBox(height: 30),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  'Frequently Asked Questions',
                  style: TextStyle(
                    fontSize: 22,
                    letterSpacing: -0.5,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              ref.watch(faqProvider).when(
                    loading: () => const PageLoading(),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (faqs) => _Group(
                      children: [
                        for (var i = 0; i < faqs.length; i++)
                          _FaqRow(faq: faqs[i], isLast: i == faqs.length - 1),
                      ],
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Rounded inset-grouped container (Settings style).
class _Group extends StatelessWidget {
  const _Group({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.tokens.cardBg,
        borderRadius: BorderRadius.circular(22),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: children),
    );
  }
}

/// Row that highlights instantly on touch-down.
class _PressRow extends StatefulWidget {
  const _PressRow({required this.onTap, required this.child});
  final VoidCallback onTap;
  final Widget child;

  @override
  State<_PressRow> createState() => _PressRowState();
}

class _PressRowState extends State<_PressRow> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: Duration(milliseconds: _down ? 60 : 180),
        curve: kEaseOutStrong,
        color: _down ? context.tokens.surfaceSecondary : Colors.transparent,
        child: widget.child,
      ),
    );
  }
}

/// Plain navigation row inside a grouped card.
class _NavRow extends StatelessWidget {
  const _NavRow({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
    this.isLast = false,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return _PressRow(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(left: 16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(0, 13, 16, 13),
          decoration: BoxDecoration(
            border: isLast
                ? null
                : Border(bottom: BorderSide(color: tokens.border, width: 0.5)),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, fill: 1, size: 20, color: Colors.white),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w500,
                    letterSpacing: -0.3,
                    color: tokens.textPrimary,
                  ),
                ),
              ),
              Icon(Symbols.arrow_forward_ios_rounded,
                  size: 13, weight: 700, color: tokens.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _FaqRow extends StatefulWidget {
  const _FaqRow({required this.faq, required this.isLast});
  final Map<String, dynamic> faq;
  final bool isLast;
  @override
  State<_FaqRow> createState() => _FaqRowState();
}

class _FaqRowState extends State<_FaqRow> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final q = (widget.faq['question'] as String?) ?? '';
    final a = (widget.faq['answer'] as String?) ?? '';

    return _PressRow(
      onTap: () => setState(() => _open = !_open),
      child: Padding(
        padding: const EdgeInsets.only(left: 16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(0, 15, 16, 15),
          decoration: BoxDecoration(
            border: widget.isLast
                ? null
                : Border(
                    bottom: BorderSide(color: tokens.border, width: 0.5)),
          ),
          child: AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: kEaseOutStrong,
            alignment: Alignment.topCenter,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        q,
                        style: TextStyle(
                          fontSize: 16.5,
                          fontWeight: FontWeight.w500,
                          letterSpacing: -0.2,
                          color: tokens.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    AnimatedRotation(
                      turns: _open ? 0.5 : 0,
                      duration: const Duration(milliseconds: 220),
                      curve: kEaseOutStrong,
                      child: Icon(Symbols.keyboard_arrow_down_rounded,
                          weight: 600, color: tokens.textMuted),
                    ),
                  ],
                ),
                if (_open)
                  Padding(
                    padding: const EdgeInsets.only(top: 8, right: 12),
                    child: Text(
                      a,
                      style: TextStyle(
                        fontSize: 15,
                        height: 1.4,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TicketRow extends StatelessWidget {
  const _TicketRow({
    required this.ticket,
    required this.manager,
    required this.isLast,
  });
  final Map<String, dynamic> ticket;
  final bool manager;
  final bool isLast;

  ({Color color, IconData icon}) _look(String? status) {
    switch (status) {
      case 'IN_PROGRESS':
        return (color: const Color(0xFFFF9500), icon: Symbols.pending_rounded);
      case 'RESOLVED':
        return (
          color: const Color(0xFF34C759),
          icon: Symbols.check_circle_rounded
        );
      case 'CLOSED':
        return (color: const Color(0xFF8E8E93), icon: Symbols.lock_rounded);
      default:
        return (
          color: const Color(0xFF5856D6),
          icon: Symbols.chat_bubble_rounded
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final replies = ticket['replies'] as List? ?? [];
    final date = DateTime.tryParse('${ticket['updatedAt']}')?.toLocal();
    final look = _look(ticket['status'] as String?);

    return _PressRow(
      onTap: () => context
          .push('/support/tickets/${Uri.encodeComponent('${ticket['id']}')}'),
      child: Padding(
        padding: const EdgeInsets.only(left: 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 23),
              child: Container(
                width: 9,
                height: 9,
                decoration:
                    BoxDecoration(color: look.color, shape: BoxShape.circle),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.fromLTRB(0, 14, 14, 14),
                decoration: BoxDecoration(
                  border: isLast
                      ? null
                      : Border(
                          bottom:
                              BorderSide(color: tokens.border, width: 0.5)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${ticket['title']}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -0.3,
                              color: tokens.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Wrap(
                            spacing: 8,
                            children: [
                              Text(
                                ticketStatusLabel(ticket['status']),
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: look.color,
                                ),
                              ),
                              if (date != null)
                                Text(
                                  DateFormat('d MMM, h:mm a').format(date),
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: tokens.textMuted,
                                  ),
                                ),
                            ],
                          ),
                          if (manager)
                            Padding(
                              padding: const EdgeInsets.only(top: 3),
                              child: Text(
                                'Student: ${ticket['user']?['name'] ?? 'Unknown'}',
                                style: TextStyle(
                                    fontSize: 14,
                                    color: tokens.textSecondary),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (replies.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(top: 1, right: 8),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: look.color.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text('${replies.length}',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: look.color)),
                      ),
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Icon(Symbols.arrow_forward_ios_rounded,
                          size: 13, weight: 700, color: tokens.textMuted),
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
