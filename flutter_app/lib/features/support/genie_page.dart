import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/shimmer_loading.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import 'new_ticket_sheet.dart';

const _whatsapp = 'https://wa.me/917254926179';

/// GET /api/genie/tree → { tree } : the question/answer tree the support team edits (same as the web GenZie box).
final genieTreeProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final res = await ref.watch(apiClientProvider).get<dynamic>('/api/genie/tree');
  final data = res.data;
  if (data is Map && data['tree'] is Map) return Map<String, dynamic>.from(data['tree'] as Map);
  throw Exception('Genie is not available right now');
});

/// GenZie: guided answers, then a hand-off to the team (support ticket or WhatsApp).
/// Lives in the Support tab only.
class GeniePage extends ConsumerStatefulWidget {
  const GeniePage({super.key});
  @override
  ConsumerState<GeniePage> createState() => _GeniePageState();
}

enum _Stage { browsing, solvedAsk, solved, needHuman }

class _GeniePageState extends ConsumerState<GeniePage> {
  String _lang = 'en';
  // Conversation so far: bot lines and the student's picks, oldest first.
  final List<({bool bot, String text})> _log = [];
  Map<String, dynamic>? _root;
  Map<String, dynamic>? _node;
  _Stage _stage = _Stage.browsing;
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  String _t(dynamic l) {
    if (l is Map) return (l[_lang] ?? l['en'] ?? '').toString();
    return (l ?? '').toString();
  }

  String _ui(String en, String hi) => _lang == 'en' ? en : hi;

  void _start(Map<String, dynamic> root) {
    final name = (ref.read(authStateProvider).value?.name ?? '').split(' ').first;
    _root = root;
    _node = root;
    _stage = _Stage.browsing;
    _log
      ..clear()
      ..add((
        bot: true,
        text: _ui("Hi${name.isEmpty ? '' : ' $name'}! I'm GenZie. Pick an option below for your doubts or exam help.",
            "Hi${name.isEmpty ? '' : ' $name'}! Main GenZie hoon. Apne doubts ya exam ki help ke liye neeche se ek option chuno."),
      ));
    if (root['q'] != null) _log.add((bot: true, text: _t(root['q'])));
  }

  void _toBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent + 200,
            duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
      }
    });
  }

  /// Tickets are only created from here: open the form pre-filled with what the student picked.
  Future<void> _raiseTicket() async {
    final topic = _log.where((m) => !m.bot).map((m) => m.text).join(' → ');
    final id = await NewTicketSheet.show(context, initialText: topic.isEmpty ? null : topic);
    if (id != null && mounted) {
      context.pushReplacement('/support/tickets/${Uri.encodeComponent(id)}');
    }
  }

  void _pick(Map<String, dynamic> opt) {
    HapticFeedback.selectionClick();
    final next = Map<String, dynamic>.from(opt['next'] as Map);
    setState(() {
      _log.add((bot: false, text: _t(opt['label'])));
      _node = next;
      if (next['q'] != null) _log.add((bot: true, text: _t(next['q'])));
      if (next['answer'] != null) {
        _log.add((bot: true, text: _t(next['answer'])));
        _stage = next['needsAgent'] == true ? _Stage.needHuman : _Stage.solvedAsk;
        if (_stage == _Stage.needHuman) _log.add((bot: true, text: _needHumanText()));
      }
    });
    _toBottom();
  }

  String _needHumanText() => _ui(
      "Sorry about that. Let's get you to our team (available 10 AM – 10 PM, every day). How would you like to talk to them?",
      'Sorry! Chalo aapko hamari team se connect karte hain (team 10 AM – 10 PM, roz available hai). Kaise baat karna chahoge?');

  void _answer(bool solved) {
    HapticFeedback.selectionClick();
    setState(() {
      _log.add((bot: false, text: solved ? _ui('Yes, solved', 'Haan, ho gaya') : _ui('No, I still need help', 'Nahi, abhi bhi help chahiye')));
      if (solved) {
        _stage = _Stage.solved;
        _log.add((bot: true, text: _ui('Great, glad that helped! Anything else?', 'Badhiya, khushi hui ki help hui! Kuch aur?')));
      } else {
        _stage = _Stage.needHuman;
        _log.add((bot: true, text: _needHumanText()));
      }
    });
    _toBottom();
  }

  Future<void> _open(String url) async {
    final base = 'https://class.genziitian.in';
    final full = url.startsWith('http') ? url : '$base$url';
    await launchUrl(Uri.parse(full), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final async = ref.watch(genieTreeProvider);
    async.whenData((tree) {
      if (_root == null) WidgetsBinding.instance.addPostFrameCallback((_) => setState(() => _start(tree)));
    });

    Widget bubble(bool bot, String text) => Align(
          alignment: bot ? Alignment.centerLeft : Alignment.centerRight,
          child: Container(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: bot ? tokens.cardBg : tokens.primaryAccent,
              borderRadius: BorderRadius.circular(16),
              border: bot ? Border.all(color: tokens.border) : null,
            ),
            child: SelectableText(text,
                style: TextStyle(fontSize: 14, height: 1.4, color: bot ? tokens.textPrimary : Colors.white)),
          ),
        );

    Widget chip(String label, VoidCallback onTap, {IconData? icon}) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: OutlinedButton.icon(
            onPressed: onTap,
            icon: Icon(icon ?? Icons.chevron_right, size: 18),
            label: Align(alignment: Alignment.centerLeft, child: Text(label)),
            style: OutlinedButton.styleFrom(
              alignment: Alignment.centerLeft,
              minimumSize: const Size.fromHeight(44),
            ),
          ),
        );

    final node = _node;
    final options = (node?['options'] is List) ? (node!['options'] as List) : const [];
    final link = (_stage == _Stage.solvedAsk || _stage == _Stage.needHuman) && node?['link'] is Map ? node!['link'] as Map : null;

    return AppPageScaffold(
      title: 'GenZie',
      subtitle: 'Quick answers, then our team',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/support'),
      right: TextButton(
        onPressed: () => setState(() {
          _lang = _lang == 'en' ? 'hi' : 'en';
          if (_root != null) _start(_root!);
        }),
        child: Text(_lang == 'en' ? 'Hinglish' : 'English'),
      ),
      body: async.when(
        loading: () => const PageLoading(),
        error: (e, _) => ListView(
          padding: const EdgeInsets.all(40),
          children: [
            Icon(Icons.cloud_off, color: tokens.textMuted, size: 40),
            const SizedBox(height: 8),
            Text('GenZie is not available right now',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: tokens.textPrimary)),
            const SizedBox(height: 12),
            // GenZie down: the ticket form is the only way left, so open it directly.
            FilledButton(onPressed: _raiseTicket, child: const Text('Raise a support ticket')),
          ],
        ),
        data: (_) => ListView(
          controller: _scroll,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            for (final m in _log) bubble(m.bot, m.text),
            if (_stage == _Stage.browsing)
              for (final o in options) chip(_t((o as Map)['label']), () => _pick(Map<String, dynamic>.from(o))),
            if (link != null)
              chip(_t(link['label']), () => _open((link['href'] ?? '').toString()), icon: Icons.open_in_new),
            if (_stage == _Stage.solvedAsk) ...[
              bubble(true, _ui('Did this solve it?', 'Kya isse problem solve hui?')),
              chip(_ui('Yes, solved', 'Haan, ho gaya'), () => _answer(true), icon: Icons.check_circle_outline),
              chip(_ui('No, I still need help', 'Nahi, abhi bhi help chahiye'), () => _answer(false), icon: Icons.help_outline),
            ],
            if (_stage == _Stage.needHuman) ...[
              chip(_ui('Raise a support ticket', 'Support ticket banao'), _raiseTicket, icon: Icons.confirmation_number_outlined),
              chip(_ui('Chat with an agent on WhatsApp', 'WhatsApp par agent se chat karo'), () => _open(_whatsapp), icon: Icons.chat_outlined),
            ],
            if (_stage != _Stage.browsing)
              chip(_ui('Start over', 'Dobara shuru karo'), () => setState(() => _start(_root!)), icon: Icons.refresh),
          ],
        ),
      ),
    );
  }
}
