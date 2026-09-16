import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../shared/widgets/app_loading_wrapper.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import 'new_ticket_sheet.dart';
import 'faq_page.dart' show faqProvider;
import 'support_providers.dart';

class SupportPage extends ConsumerStatefulWidget {
  const SupportPage({super.key});
  @override
  ConsumerState<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends ConsumerState<SupportPage> {
  String _filter = 'All';
  String _search = '';

  Future<void> _newTicket() async {
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
    return AppPageScaffold(
      title: manager ? 'Support queue' : 'Support',
      subtitle: manager
          ? 'Read, reply and manage student tickets'
          : 'Get help and follow your conversations',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/more'),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(supportTicketsProvider);
          try {
            await ref.read(supportTicketsProvider.future);
          } catch (_) {}
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            if (role == 'STUDENT') ...[
              FilledButton.icon(
                onPressed: _newTicket,
                icon: const Icon(Icons.add_comment_rounded),
                label: const Text('New Ticket',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                style: FilledButton.styleFrom(
                    backgroundColor: tokens.primaryAccent,
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(54)),
              ),
              const SizedBox(height: 12),
            ],
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.push('/support/feature-requests'),
                    icon: const Icon(Icons.lightbulb_outline_rounded,
                        size: 18, color: Color(0xFF8B5CF6)),
                    label: const Text(
                      'Request a Feature',
                      style: TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.w700),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: BorderSide(color: tokens.border),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                if (manager) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/support/user-reports'),
                      icon: const Icon(Icons.flag_outlined,
                          size: 18, color: Color(0xFFEF4444)),
                      label: const Text(
                        'User Reports',
                        style: TextStyle(
                            fontSize: 13.5, fontWeight: FontWeight.w700),
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: BorderSide(color: tokens.border),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 18),
            Text(manager ? 'All tickets' : 'My tickets',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: tokens.textPrimary)),
            const SizedBox(height: 10),
            if (manager) ...[
              TextField(
                  onChanged: (value) =>
                      setState(() => _search = value.toLowerCase().trim()),
                  decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Search ticket or student',
                      border: OutlineInputBorder())),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                for (final filter in ['All', 'Active', 'Resolved', 'Closed'])
                  ChoiceChip(
                      label: Text(filter),
                      selected: _filter == filter,
                      onSelected: (_) => setState(() => _filter = filter)),
              ]),
              const SizedBox(height: 12),
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
                  return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Text(
                          all.isEmpty
                              ? (manager
                                  ? 'No tickets yet.'
                                  : 'No tickets raised yet.')
                              : 'No tickets match this filter.',
                          style: TextStyle(color: tokens.textSecondary)));
                }
                return Column(children: [
                  for (final ticket in visible)
                    _TicketTile(ticket: ticket, manager: manager)
                ]);
              },
            ),
            if (!manager) ...[
              const SizedBox(height: 14),
              Text(
                  'Resolved and closed tickets stay here for 15 days after their last update.',
                  style: TextStyle(fontSize: 12, color: tokens.textMuted)),
              const SizedBox(height: 24),
              Text(
                'Frequently Asked Questions',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Instant answers to common queries. Browse our knowledge base for solutions.',
                style: TextStyle(
                  fontSize: 13,
                  color: tokens.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 14),
              ref.watch(faqProvider).when(
                    loading: () => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (faqs) => Column(
                      children: [
                        for (final f in faqs)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _InlineFaqTile(faq: f),
                          ),
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

class _InlineFaqTile extends StatefulWidget {
  const _InlineFaqTile({required this.faq});
  final Map<String, dynamic> faq;
  @override
  State<_InlineFaqTile> createState() => _InlineFaqTileState();
}

class _InlineFaqTileState extends State<_InlineFaqTile> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final q = (widget.faq['question'] as String?) ?? '';
    final a = (widget.faq['answer'] as String?) ?? '';

    return Container(
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: InkWell(
        onTap: () => setState(() => _open = !_open),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      q,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: tokens.textPrimary,
                      ),
                    ),
                  ),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: Icon(Icons.expand_more, color: tokens.textMuted),
                  ),
                ],
              ),
              AnimatedCrossFade(
                firstChild: const SizedBox(width: double.infinity),
                secondChild: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    a,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: tokens.textSecondary,
                    ),
                  ),
                ),
                crossFadeState:
                    _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                duration: const Duration(milliseconds: 200),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TicketTile extends StatelessWidget {
  const _TicketTile({required this.ticket, required this.manager});
  final Map<String, dynamic> ticket;
  final bool manager;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final replies = ticket['replies'] as List? ?? [];
    final date = DateTime.tryParse('${ticket['updatedAt']}')?.toLocal();
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: tokens.cardBg,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context
            .push('/support/tickets/${Uri.encodeComponent('${ticket['id']}')}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                  child: Text('${ticket['title']}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: tokens.textPrimary))),
              const SizedBox(width: 12),
              const Icon(Icons.chevron_right)
            ]),
            const SizedBox(height: 10),
            Wrap(spacing: 10, runSpacing: 6, children: [
              Text(ticketStatusLabel(ticket['status']),
                  style: TextStyle(
                      color: tokens.primaryAccent,
                      fontWeight: FontWeight.w700)),
              if (date != null)
                Text(DateFormat('d MMM, h:mm a').format(date),
                    style: TextStyle(color: tokens.textMuted, fontSize: 12)),
            ]),
            if (manager)
              Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                      'Student: ${ticket['user']?['name'] ?? 'Unknown'}',
                      style: TextStyle(color: tokens.textSecondary))),
            const SizedBox(height: 8),
            Text(
                replies.isEmpty
                    ? 'Awaiting a reply · Tap to open'
                    : '${replies.length} ${replies.length == 1 ? 'reply' : 'replies'} · Tap to view conversation',
                style: TextStyle(color: tokens.textSecondary, fontSize: 12)),
          ]),
        ),
      ),
    );
  }
}
