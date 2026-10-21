import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../theme/app_theme_tokens.dart';

const _options = <String, String>{
  'PRICE': 'Price is too high',
  'ASK_FAMILY': 'I need to ask my family',
  'PAYMENT_PROBLEM': 'Payment did not work',
  'NOT_SURE_WHICH': 'Not sure which one to pick',
  'WANT_DISCOUNT': 'Waiting for a discount',
  'NEED_MORE_INFO': 'Need more information',
  'JUST_LOOKING': 'Just looking around',
  'BUY_LATER': 'Will buy later',
  'OTHER': 'Something else',
};

/// Asks "What's stopping you?" once after an unfinished checkout. The server
/// decides whether to ask (not within 24 hours of an earlier answer). Answers
/// are visible to managers only. Never throws.
Future<void> maybeAskWhatsStopping(BuildContext context, {bool justNow = false}) async {
  try {
    final api = ProviderScope.containerOf(context).read(apiClientProvider);
    final r = await api.get<dynamic>('/api/payment-attempts/feedback',
        query: justNow ? {'now': '1'} : null);
    final d = r.data;
    final att = d is Map ? d['attempt'] : null;
    if (att is! Map || !context.mounted) return;
    final id = att['id'].toString();
    final name = (att['itemName'] ?? 'this').toString();
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FeedbackSheet(itemName: name),
    );
    final dismissed = result == null;
    await api.post<dynamic>('/api/payment-attempts/feedback', body: {
      'id': id,
      'dismissed': dismissed,
      'reasons': dismissed ? <String>[] : result['reasons'],
      'note': dismissed ? '' : result['note'],
    });
  } catch (_) {}
}

class _FeedbackSheet extends StatefulWidget {
  const _FeedbackSheet({required this.itemName});
  final String itemName;

  @override
  State<_FeedbackSheet> createState() => _FeedbackSheetState();
}

class _FeedbackSheetState extends State<_FeedbackSheet> {
  final _picked = <String>{};
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  bool get _can => _picked.isNotEmpty || _note.text.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 560),
        decoration: BoxDecoration(
          color: tokens.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
        ),
        padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + MediaQuery.of(context).padding.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 5,
                  decoration: BoxDecoration(
                    color: tokens.textMuted.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text("What's stopping you?",
                  style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: tokens.textPrimary)),
              const SizedBox(height: 4),
              Text("You didn't finish buying ${widget.itemName}. Tell us why - pick any that fit.",
                  style: TextStyle(fontSize: 14, color: tokens.textSecondary, height: 1.35)),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final e in _options.entries)
                    ApplePressable(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() => _picked.contains(e.key) ? _picked.remove(e.key) : _picked.add(e.key));
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: _picked.contains(e.key) ? tokens.primaryAccent : Colors.transparent,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                              color: _picked.contains(e.key) ? tokens.primaryAccent : tokens.border, width: 1),
                        ),
                        child: Text(e.value,
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              color: _picked.contains(e.key) ? tokens.onPrimaryAccent : tokens.textPrimary,
                            )),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _note,
                maxLines: 3,
                maxLength: 600,
                onChanged: (_) => setState(() {}),
                style: TextStyle(fontSize: 14, color: tokens.textPrimary),
                decoration: InputDecoration(
                  hintText: "Anything else you'd like us to know? (optional)",
                  hintStyle: TextStyle(color: tokens.textMuted),
                  counterText: '',
                  filled: true,
                  fillColor: tokens.surfaceSecondary,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ApplePressable(
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                            color: tokens.surfaceSecondary, borderRadius: BorderRadius.circular(14)),
                        child: Text('Not now',
                            style: TextStyle(fontWeight: FontWeight.w700, color: tokens.textPrimary)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: ApplePressable(
                      onTap: _can
                          ? () => Navigator.of(context).pop({
                                'reasons': _picked.toList(),
                                'note': _note.text.trim(),
                              })
                          : null,
                      child: Opacity(
                        opacity: _can ? 1 : 0.5,
                        child: Container(
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                              color: tokens.primaryAccent, borderRadius: BorderRadius.circular(14)),
                          child: Text('Send',
                              style: TextStyle(fontWeight: FontWeight.w800, color: tokens.onPrimaryAccent)),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
