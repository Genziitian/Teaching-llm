import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_providers.dart';
import '../../theme/app_theme_tokens.dart';
import 'support_providers.dart';

class NewTicketSheet extends ConsumerStatefulWidget {
  const NewTicketSheet({super.key});
  static Future<String?> show(BuildContext context) =>
      showModalBottomSheet<String>(
        context: context,
        useRootNavigator: true,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => const NewTicketSheet(),
      );
  @override
  ConsumerState<NewTicketSheet> createState() => _NewTicketSheetState();
}

class _NewTicketSheetState extends ConsumerState<NewTicketSheet> {
  final _description = TextEditingController();
  String _type = 'GENERAL';
  String? _courseId;
  String? _error;
  bool _submitting = false;
  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final activeCount = ref.read(supportTicketsProvider).asData?.value
            .where((t) => t['status'] != 'RESOLVED' && t['status'] != 'CLOSED')
            .length ??
        0;
    if (activeCount >= 3) {
      setState(() => _error =
          'You already have 3 active tickets. Please wait until your existing tickets are resolved or closed before submitting a new one.');
      return;
    }
    if (_description.text.trim().isEmpty ||
        (_type == 'SUBJECT' && _courseId == null)) {
      setState(() =>
          _error = 'Describe your issue and choose a course for subject help.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final response = await ref
          .read(apiClientProvider)
          .post<Map<String, dynamic>>('/api/support/tickets', body: {
        'description': _description.text.trim(),
        'type': _type,
        if (_type == 'SUBJECT') 'courseId': _courseId,
      });
      ref.invalidate(supportTicketsProvider);
      if (mounted) Navigator.of(context).pop(response.data!['id'] as String);
    } catch (error) {
      if (mounted) setState(() => _error = supportError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final activeCount = ref.watch(supportTicketsProvider).asData?.value
            .where((t) => t['status'] != 'RESOLVED' && t['status'] != 'CLOSED')
            .length ??
        0;
    final hasReachedActiveLimit = activeCount >= 3;
    return PopScope(
      canPop: !_submitting,
      child: Padding(
        padding:
            EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: SafeArea(
              top: false,
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(children: [
                      const Expanded(
                          child: Text('New Ticket',
                              style: TextStyle(
                                  fontSize: 22, fontWeight: FontWeight.w800))),
                      IconButton(
                          onPressed: _submitting
                              ? null
                              : () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.close),
                          tooltip: 'Close')
                    ]),
                    const Text('What do you need help with?'),
                    const SizedBox(height: 12),
                    Wrap(spacing: 8, children: [
                      ChoiceChip(
                          label: const Text('General help'),
                          selected: _type == 'GENERAL',
                          onSelected: _submitting
                              ? null
                              : (_) => setState(() => _type = 'GENERAL')),
                      ChoiceChip(
                          label: const Text('Course / subject'),
                          selected: _type == 'SUBJECT',
                          onSelected: _submitting
                              ? null
                              : (_) => setState(() => _type = 'SUBJECT')),
                    ]),
                    if (_type == 'SUBJECT')
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: ref.watch(supportCoursesProvider).when(
                              loading: () => const LinearProgressIndicator(),
                              error: (error, _) => TextButton(
                                  onPressed: () =>
                                      ref.invalidate(supportCoursesProvider),
                                  child: const Text(
                                      'Could not load courses. Retry')),
                              data: (courses) => courses.isEmpty
                                  ? const Text(
                                      'No accessible courses. Choose General help for access or payment issues.')
                                  : DropdownButtonFormField<String>(
                                      value: courses
                                              .any((c) => c['id'] == _courseId)
                                          ? _courseId
                                          : null,
                                      isExpanded: true,
                                      decoration: const InputDecoration(
                                          labelText: 'Choose course',
                                          border: OutlineInputBorder()),
                                      items: [
                                        for (final course in courses)
                                          DropdownMenuItem(
                                              value: course['id'] as String,
                                              child: Text('${course['name']}',
                                                  overflow:
                                                      TextOverflow.ellipsis))
                                      ],
                                      onChanged: _submitting
                                          ? null
                                          : (value) =>
                                              setState(() => _courseId = value),
                                    ),
                            ),
                      ),
                    const SizedBox(height: 12),
                    TextField(
                        controller: _description,
                        enabled: !_submitting,
                        minLines: 4,
                        maxLines: 8,
                        maxLength: 10000,
                        decoration: const InputDecoration(
                            labelText: 'Describe your issue',
                            hintText:
                                'What happened? Include the course or lesson and any error you saw.',
                            alignLabelWithHint: true,
                            border: OutlineInputBorder())),
                    const Text(
                        'After creating your ticket, you can read replies and add more details in the conversation.'),
                    if (hasReachedActiveLimit)
                      Container(
                        margin: const EdgeInsets.only(top: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline, color: Color(0xFFEF4444), size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'You already have 3 active tickets. You cannot create a new ticket until a manager resolves or closes an existing ticket.',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: tokens.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    if (_error != null)
                      Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(_error!,
                              style: TextStyle(color: tokens.danger))),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                        onPressed: (_submitting || hasReachedActiveLimit) ? null : _submit,
                        icon: _submitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.send_rounded),
                        label: Text(
                            _submitting ? 'Creating ticket…' : 'Create Ticket'),
                        style: FilledButton.styleFrom(
                            backgroundColor: hasReachedActiveLimit
                                ? tokens.border
                                : tokens.primaryAccent,
                            foregroundColor: Colors.white,
                            minimumSize: const Size.fromHeight(52))),
                  ])),
        ),
      ),
    );
  }
}
