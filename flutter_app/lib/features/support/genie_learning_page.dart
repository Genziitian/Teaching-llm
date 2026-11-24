import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_loading_wrapper.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';

/// Manager review queue for Q&A GenZie picked up from community chats.
/// Only approved answers are used for GenZie's community auto-replies.
final genieLearnedProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, status) async {
  final res = await ref
      .watch(apiClientProvider)
      .get<Map<String, dynamic>>('/api/genie/learned', query: {'status': status});
  return res.data ?? const {};
});

class GenieLearningPage extends ConsumerStatefulWidget {
  const GenieLearningPage({super.key});

  @override
  ConsumerState<GenieLearningPage> createState() => _GenieLearningPageState();
}

class _GenieLearningPageState extends ConsumerState<GenieLearningPage> {
  String _status = 'PENDING';

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final role = ref.watch(authStateProvider).value?.role;
    if (role != 'MANAGER') {
      return AppPageScaffold(
        title: 'GenZie learning',
        showBack: true,
        onBack: () => context.pop(),
        body: Center(
          child: Text('Manager access required.',
              style: TextStyle(color: tokens.textSecondary)),
        ),
      );
    }

    final async = ref.watch(genieLearnedProvider(_status));
    final pending = async.value?['pending'] as int? ?? 0;

    return AppPageScaffold(
      title: 'GenZie learning',
      subtitle: 'Approve answers before GenZie uses them in community chats',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/support'),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(genieLearnedProvider(_status)),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
          children: [
            Wrap(
              spacing: 8,
              children: [
                for (final s in const ['PENDING', 'APPROVED', 'REJECTED'])
                  ChoiceChip(
                    label: Text(s[0] + s.substring(1).toLowerCase() +
                        (s == 'PENDING' && pending > 0 ? ' ($pending)' : '')),
                    selected: _status == s,
                    onSelected: (_) => setState(() => _status = s),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            async.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 36),
                child: AppLoadingWrapper(isLoading: true),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 36),
                child: Column(children: [
                  Text('Could not load the queue.',
                      style: TextStyle(color: tokens.textSecondary)),
                  TextButton(
                    onPressed: () =>
                        ref.invalidate(genieLearnedProvider(_status)),
                    child: const Text('Try again'),
                  ),
                ]),
              ),
              data: (data) {
                final items =
                    ((data['items'] as List?) ?? const []).cast<Map<String, dynamic>>();
                if (items.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 36),
                    child: Center(
                      child: Text('Nothing here.',
                          style: TextStyle(color: tokens.textSecondary)),
                    ),
                  );
                }
                return Column(
                  children: [
                    for (final item in items)
                      _LearnedCard(
                        key: ValueKey(item['id']),
                        item: item,
                        onDone: () =>
                            ref.invalidate(genieLearnedProvider(_status)),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _LearnedCard extends ConsumerStatefulWidget {
  const _LearnedCard({super.key, required this.item, required this.onDone});

  final Map<String, dynamic> item;
  final VoidCallback onDone;

  @override
  ConsumerState<_LearnedCard> createState() => _LearnedCardState();
}

class _LearnedCardState extends ConsumerState<_LearnedCard> {
  bool _editing = false;
  bool _busy = false;
  late final _question =
      TextEditingController(text: widget.item['question'] as String? ?? '');
  late final _answer =
      TextEditingController(text: widget.item['answer'] as String? ?? '');

  @override
  void dispose() {
    _question.dispose();
    _answer.dispose();
    super.dispose();
  }

  Future<void> _review(String action) async {
    setState(() => _busy = true);
    try {
      await ref.read(apiClientProvider).patch(
        '/api/genie/learned/${widget.item['id']}',
        body: {
          'action': action,
          if (action == 'approve' && _editing) ...{
            'question': _question.text,
            'answer': _answer.text,
          },
        },
      );
      widget.onDone();
    } on DioException catch (e) {
      final msg = (e.response?.data is Map
              ? (e.response!.data as Map)['error']
              : null) as String? ??
          'Could not save. Please try again.';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final item = widget.item;
    final status = item['status'] as String? ?? 'PENDING';
    final meta = [
      item['courseName'],
      if (item['askedBy'] != null) 'asked by ${item['askedBy']}',
      if (item['answeredBy'] != null) 'answered by ${item['answeredBy']}',
      item['source'] == 'UNANSWERED' ? 'GenZie had no answer' : 'GenZie also replied',
    ].whereType<String>().join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(meta, style: TextStyle(fontSize: 12, color: tokens.textMuted)),
          const SizedBox(height: 8),
          if (_editing) ...[
            TextField(
              controller: _question,
              minLines: 1,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Question'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _answer,
              minLines: 2,
              maxLines: 8,
              decoration: const InputDecoration(labelText: 'Answer'),
            ),
          ] else ...[
            Text('Q: ${item['question']}',
                style: TextStyle(
                    fontWeight: FontWeight.w600, color: tokens.textPrimary)),
            const SizedBox(height: 6),
            Text('A: ${item['answer']}',
                style: TextStyle(color: tokens.textSecondary)),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              if (status != 'APPROVED' || _editing)
                FilledButton(
                  onPressed: _busy ? null : () => _review('approve'),
                  child: Text(_editing ? 'Save & approve' : 'Approve'),
                ),
              TextButton(
                onPressed: _busy ? null : () => setState(() => _editing = !_editing),
                child: Text(_editing ? 'Cancel edit' : 'Edit'),
              ),
              if (status != 'REJECTED')
                TextButton(
                  onPressed: _busy ? null : () => _review('reject'),
                  style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFFF3B30)),
                  child: const Text('Reject'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
