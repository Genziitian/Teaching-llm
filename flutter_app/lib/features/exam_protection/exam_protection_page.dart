import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../theme/app_theme_tokens.dart';
import 'protection_checkout.dart';

final protectionProvider = FutureProvider.autoDispose<Map<String, dynamic>>((
  ref,
) async {
  final timer = Timer.periodic(
    const Duration(minutes: 1),
    (_) => ref.invalidateSelf(),
  );
  ref.onDispose(timer.cancel);
  final response = await ref
      .watch(apiClientProvider)
      .get<Map<String, dynamic>>('/api/exam-protection');
  return response.data!;
});
int _refund(num fee) => (fee.toInt() - 10).clamp(0, 1000000);
int _discount(num fee) => (fee * 1.5).round();
String _error(Object e) => e is DioException
    ? (e.message ?? 'Please try again.')
    : e is FormatException
    ? e.message
    : e.toString();
String _date(dynamic value) {
  final d = DateTime.tryParse('$value');
  return d == null ? '—' : '${d.day}/${d.month}/${d.year}';
}

const _rules =
    'Failed Quiz 1: refund your protection fee minus ₹10, OR get 1.5× the fee as a same-course discount, rounded to a whole rupee. A manager reviews your official result proof. Refunds and coupon creation are manual.';

class ExamProtectionPage extends ConsumerStatefulWidget {
  const ExamProtectionPage({super.key});
  @override
  ConsumerState<ExamProtectionPage> createState() => _PageState();
}

class _PageState extends ConsumerState<ExamProtectionPage> {
  int section = 0;
  bool busy = false;
  final formKey = GlobalKey<FormState>();
  String? purchaseId, reason, attempted;
  String benefit = 'refund';
  final marks = TextEditingController(), message = TextEditingController();
  bool released = false;
  Uint8List? image;
  String? imageName, imageMime;
  @override
  void dispose() {
    marks.dispose();
    message.dispose();
    super.dispose();
  }

  Future<void> run(Future<void> Function() action) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await action();
      ref.invalidate(protectionProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_error(e))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<({Uint8List bytes, String name, String mime})?> pickImage() async {
    const channel = MethodChannel('com.teaching.lms/community_files');
    final picked = await channel.invokeMapMethod<String, dynamic>('pick', {
      'images': true,
    });
    if (picked == null) return null;
    final file = File('${picked['path']}');
    try {
      if (await file.length() > 5 * 1024 * 1024) {
        throw const FormatException('Choose an image up to 5 MB.');
      }
      final name = '${picked['name']}',
          extension = name.split('.').last.toLowerCase();
      final mime = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'webp': 'image/webp',
      }[extension];
      if (mime == null) {
        throw const FormatException('Choose a PNG, JPEG or WebP image.');
      }
      return (bytes: await file.readAsBytes(), name: name, mime: mime);
    } finally {
      try {
        await file.delete();
      } catch (_) {}
    }
  }

  Future<void> submit() async {
    if (!(formKey.currentState?.validate() ?? false)) return;
    if (image == null || !released) {
      throw const FormatException(
        'Upload proof and confirm official results are released.',
      );
    }
    final payload = {
      'purchaseId': purchaseId,
      'benefit': benefit,
      'reason': reason,
      'attempted': attempted == 'yes',
      'marks': attempted == 'yes' ? marks.text : null,
      'message': message.text,
      'resultsReleased': released,
    };
    await ref
        .read(apiClientProvider)
        .post(
          '/api/exam-protection/claims',
          body: FormData.fromMap({
            'data': jsonEncode(payload),
            'proof': MultipartFile.fromBytes(
              image!,
              filename: imageName,
              contentType: DioMediaType.parse(imageMime!),
            ),
          }),
        );
    if (mounted) {
      setState(() {
        purchaseId = null;
        reason = null;
        attempted = null;
        image = null;
        released = false;
        marks.clear();
        message.clear();
      });
    }
  }

  Widget card(String title, List<Widget> children) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Material(
      color: context.tokens.cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: context.tokens.textSecondary.withOpacity(0.14)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.2,
                color: context.tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    ),
  );
  Widget _stat(String label, String value, String example) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.tokens.textSecondary.withOpacity(0.14)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: 12, color: context.tokens.textSecondary)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: context.tokens.textPrimary)),
        Text(example, style: TextStyle(fontSize: 12, color: context.tokens.textSecondary)),
      ]),
    ),
  );
  Widget text(String value) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Text(
      value,
      style: TextStyle(
        fontSize: 14,
        height: 1.5,
        color: context.tokens.textSecondary,
      ),
    ),
  );
  Widget button(String label, VoidCallback? onPressed) => Padding(
    padding: const EdgeInsets.only(right: 8, bottom: 8),
    child: OutlinedButton(
      onPressed: busy ? null : onPressed,
      child: Text(label),
    ),
  );
  Future<void> details(Map c, {bool buy = false}) async {
    bool agreed = false;
    final accepted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheet) => StatefulBuilder(
        builder: (context, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(
            24,
            12,
            24,
            24 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${c['name']}',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 16),
                text(_rules),
                text(
                  'Fee: ₹${c['fee']} · Refund: ₹${_refund(c['fee'] as num)} · Discount: ₹${_discount(c['fee'] as num)}',
                ),
                text(
                  'Proof media is deleted 60 days after claim submission; other details remain. Students see records for 60 days and managers for 360 days.',
                ),
                if (buy) ...[
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: agreed,
                    onChanged: (value) =>
                        setSheet(() => agreed = value ?? false),
                    title: const Text(
                      'I have read the rules, conditions and benefits.',
                    ),
                  ),
                  FilledButton(
                    onPressed: agreed
                        ? () => Navigator.pop(context, true)
                        : null,
                    child: Text('Pay ₹${c['fee']} & add protection'),
                  ),
                ],
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (accepted == true && mounted) {
      await run(
        () => purchaseProtection(
          context,
          ref.read(apiClientProvider),
          '${c['id']}',
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = ref.watch(protectionProvider);
    return Scaffold(
      backgroundColor: context.tokens.bg,
      appBar: AppBar(title: const Text('Exam Protection')),
      body: result.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error(error)),
                TextButton(
                  onPressed: () => ref.invalidate(protectionProvider),
                  child: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
        data: (data) {
          final manager = data['manager'] == true,
              courses = (data['courses'] as List).cast<Map>(),
              purchases = (data['purchases'] as List).cast<Map>(),
              claims = (data['claims'] as List).cast<Map>();
          final coupons = ((data['coupons'] as List?) ?? const []).cast<Map>();
          final available = purchases.where((p) => p['claim'] == null).toList();
          final selected = available
              .where((p) => p['id'] == purchaseId)
              .firstOrNull;
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(protectionProvider);
              await ref.read(protectionProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
                  child: Text(
                    'Protect your Quiz 1 attempt. If you do not pass, request a refund or a same-course discount.',
                    style: TextStyle(fontSize: 15, height: 1.45, color: context.tokens.textSecondary),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: SegmentedButton<int>(
                    showSelectedIcon: false,
                    segments: [
                      const ButtonSegment(value: 0, label: Text('Protect')),
                      ButtonSegment(value: 1, label: Text('Claims · ${claims.length}')),
                      const ButtonSegment(value: 2, label: Text('Coupons')),
                    ],
                    selected: {section},
                    onSelectionChanged: (v) => setState(() => section = v.first),
                  ),
                ),
                if (section == 0)
                card('Quiz 1 protection benefits', [
                  text('One benefit is chosen at claim time, calculated from the fee you paid.'),
                  Row(children: [
                    _stat('Refund', 'Fee − ₹10', '₹50 → ₹40'),
                    const SizedBox(width: 10),
                    _stat('Discount', '1.5 × fee', '₹50 → ₹75'),
                  ]),
                ]),
                if (section == 0)
                if (manager)
                  card('Purchase availability', [
                    text(data['isOpen'] == true ? 'Open' : 'Closed'),
                    button(
                      data['isOpen'] == true
                          ? 'Close purchases'
                          : 'Open purchases',
                      () => run(() async {
                        await ref
                            .read(apiClientProvider)
                            .put(
                              '/api/exam-protection/settings',
                              body: {'isOpen': data['isOpen'] != true},
                            );
                      }),
                    ),
                    text(
                      'Set individual protection fees in Manage Course on the website.',
                    ),
                  ]),
                if (section == 0)
                card('Explore protection', [
                  text(
                    data['isOpen'] == true
                        ? 'Purchases open'
                        : 'Purchases closed · View Details remains available.',
                  ),
                  if (courses.isEmpty)
                    text(
                      'No enrolled Quiz 1 courses currently offer protection.',
                    ),
                  for (final c in courses) ...[
                    Text(
                      '${c['name']}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 17,
                      ),
                    ),
                    text(
                      '₹${c['fee']} fee · ₹${_refund(c['fee'] as num)} refund or ₹${_discount(c['fee'] as num)} discount · ${c['protected'] == true ? 'Protected' : 'Not Protected'}',
                    ),
                    Wrap(
                      children: [
                        button('View Details', () => details(c)),
                        if (c['protected'] != true && !manager)
                          button(
                            data['isOpen'] == true
                                ? 'Add Protection'
                                : 'Closed',
                            data['isOpen'] == true
                                ? () => details(c, buy: true)
                                : null,
                          ),
                      ],
                    ),
                    const Divider(),
                  ],
                ]),
                if (section == 0)
                card(manager ? 'Protection purchases' : 'My protection', [
                  text(
                    'Visible for ${data['retentionDays']} days from purchase.',
                  ),
                  if (purchases.isEmpty)
                    text('No purchases within this visibility period.'),
                  for (final p in purchases)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.shield_outlined),
                      title: Text('${p['courseName']}'),
                      subtitle: Text(
                        '₹${p['fee']} paid · ${_date(p['paidAt'])}${manager ? ' · ${p['user']['email']}' : ''}',
                      ),
                    ),
                ]),
                if (section == 0)
                if (!manager)
                  card('Start a protection claim', [
                    if (available.isEmpty)
                      text(
                        'No unclaimed protected purchases within the 60-day visibility period.',
                      )
                    else
                      Form(
                        key: formKey,
                        child: Column(
                          children: [
                            DropdownButtonFormField<String>(
                              initialValue: purchaseId,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Protected course',
                              ),
                              items: available
                                  .map(
                                    (p) => DropdownMenuItem(
                                      value: '${p['id']}',
                                      child: Text('${p['courseName']}'),
                                    ),
                                  )
                                  .toList(),
                              onChanged: busy
                                  ? null
                                  : (value) =>
                                        setState(() => purchaseId = value),
                              validator: (v) => v == null
                                  ? 'Choose a protected course'
                                  : null,
                            ),
                            DropdownButtonFormField<String>(
                              initialValue: benefit,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Benefit',
                              ),
                              items: [
                                DropdownMenuItem(
                                  value: 'refund',
                                  child: Text(
                                    'Refund${selected == null ? '' : ' · ₹${_refund(selected['fee'] as num)}'}',
                                  ),
                                ),
                                DropdownMenuItem(
                                  value: 'coupon',
                                  child: Text(
                                    'Same-course discount${selected == null ? '' : ' · ₹${_discount(selected['fee'] as num)}'}',
                                  ),
                                ),
                              ],
                              onChanged: (v) =>
                                  setState(() => benefit = v ?? 'refund'),
                            ),
                            DropdownButtonFormField<String>(
                              initialValue: reason,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Why didn’t you pass?',
                              ),
                              items: (data['reasons'] as List)
                                  .map(
                                    (r) => DropdownMenuItem(
                                      value: '$r',
                                      child: Text(
                                        '$r',
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) => setState(() => reason = v),
                              validator: (v) =>
                                  v == null ? 'Choose a reason' : null,
                            ),
                            DropdownButtonFormField<String>(
                              initialValue: attempted,
                              decoration: const InputDecoration(
                                labelText: 'Did you attempt the exam?',
                              ),
                              items: const [
                                DropdownMenuItem(
                                  value: 'yes',
                                  child: Text('Yes'),
                                ),
                                DropdownMenuItem(
                                  value: 'no',
                                  child: Text('No'),
                                ),
                              ],
                              onChanged: (v) => setState(() {
                                attempted = v;
                                if (v == 'no') marks.clear();
                              }),
                              validator: (v) =>
                                  v == null ? 'Choose Yes or No' : null,
                            ),
                            TextFormField(
                              controller: marks,
                              enabled: attempted == 'yes',
                              decoration: const InputDecoration(
                                labelText: 'Marks obtained in this course',
                              ),
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              validator: (v) =>
                                  attempted == 'yes' &&
                                      (double.tryParse(v ?? '') == null ||
                                          double.parse(v!) < 0)
                                  ? 'Enter valid marks'
                                  : null,
                            ),
                            TextFormField(
                              controller: message,
                              maxLength: 2000,
                              maxLines: 3,
                              decoration: const InputDecoration(
                                labelText: 'Anything else? (optional)',
                              ),
                            ),
                            const SizedBox(height: 12),
                            text(
                              'Official results-dashboard screenshot · PNG, JPEG or WebP, up to 5 MB. Preview or replace before submitting. Uploaded media is deleted after 60 days; other claim details remain.',
                            ),
                            if (image != null)
                              Image.memory(
                                image!,
                                height: 180,
                                fit: BoxFit.contain,
                                errorBuilder: (_, _, _) => const Text(
                                  'Invalid image. Select a different file.',
                                ),
                              ),
                            button(
                              image == null
                                  ? 'Choose result screenshot'
                                  : 'Replace screenshot',
                              () => run(() async {
                                final picked = await pickImage();
                                if (picked != null && mounted) {
                                  setState(() {
                                    image = picked.bytes;
                                    imageName = picked.name;
                                    imageMime = picked.mime;
                                  });
                                }
                              }),
                            ),
                            CheckboxListTile(
                              contentPadding: EdgeInsets.zero,
                              value: released,
                              onChanged: (v) =>
                                  setState(() => released = v ?? false),
                              title: const Text(
                                'My official results have been released.',
                              ),
                            ),
                            FilledButton(
                              onPressed: busy ? null : () => run(submit),
                              child: Text(busy ? 'Working…' : 'Submit claim'),
                            ),
                          ],
                        ),
                      ),
                  ]),
                if (section == 1)
                card(manager ? 'Manager claims' : 'My claims', [
                  text(
                    'Visible for ${data['retentionDays']} days after submission. Proof media is deleted after 60 days.',
                  ),
                  if (claims.isEmpty)
                    text('No claims within this visibility period.'),
                  for (final c in claims) claimTile(c, manager),
                ]),
                if (section == 2 && !manager)
                  card('My Coupons', [
                    text(
                      'Scratch to reveal your coupon. Once scratched, use it within 7 days.',
                    ),
                    text(
                      '1. Submit a protection claim and choose the discount benefit.\n2. The manager reviews the proof and assigns a coupon.\n3. Reveal the coupon below.\n4. Go to genziitian.in/courses or class.genziitian.in/courses/explore and choose the same course. A Python coupon is for Python only.\n5. Sign in with the same email used here: ${data['email']}.\n6. Apply the code at checkout and complete the purchase within 7 days.',
                    ),
                    button(
                      'Open course website',
                      () => launchUrl(
                        Uri.parse(
                          'https://class.genziitian.in/courses/explore',
                        ),
                        mode: LaunchMode.externalApplication,
                      ),
                    ),
                    if (coupons.isEmpty)
                      text('Your coupon appears here once assigned.'),
                    for (final c in coupons.where(
                      (c) => c['coupon'] != null,
                    )) ...[
                      Text(
                        '${c['purchase']['courseName']} · ₹${_discount(c['purchase']['fee'] as num)} discount',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      if (c['couponRevealedAt'] == null) ...[
                        text('Revealing starts the 7-day usage period.'),
                        button(
                          'Reveal coupon · start 7 days',
                          () => run(() async {
                            await ref
                                .read(apiClientProvider)
                                .post(
                                  '/api/exam-protection/claims/${c['id']}/reveal',
                                );
                          }),
                        ),
                      ] else ...[
                        SelectableText('${c['coupon']['code']}'),
                        text(
                          'Expires ${_date(c['coupon']['expiresAt'])} · ${c['coupon']['currentUses']}/${c['coupon']['maxUses'] ?? 1} uses',
                        ),
                        button(
                          'Copy code',
                          () => Clipboard.setData(
                            ClipboardData(text: '${c['coupon']['code']}'),
                          ),
                        ),
                      ],
                      const Divider(),
                    ],
                  ]),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget claimTile(Map c, bool manager) {
    final p = c['purchase'] as Map;
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      title: Text('${p['courseName']} · ${c['status']}'),
      subtitle: Text('${c['id']} · ${_date(c['createdAt'])}'),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              text(
                '${c['benefit'] == 'refund' ? 'Refund' : 'Discount'}: ₹${c['benefit'] == 'refund' ? _refund(p['fee'] as num) : _discount(p['fee'] as num)}\nReason: ${c['reason']}\nAttempted: ${c['attempted'] == true ? 'Yes' : 'No'}\nMarks: ${c['marks'] ?? 'Not attempted'}\nStudent message: ${c['message']}',
              ),
              if (manager) text('${p['user']['name']} · ${p['user']['email']}'),
              if (c['proof'] != null)
                button(
                  'View official proof',
                  () => run(() async {
                    final result = await ref
                        .read(apiClientProvider)
                        .get<Map<String, dynamic>>(
                          '/api/exam-protection/claims/${c['id']}/proof',
                          query: {'format': 'base64'},
                        );
                    if (!mounted) return;
                    await showDialog<void>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Official result proof'),
                        content: Image.memory(
                          base64Decode('${result.data!['base64']}'),
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Close'),
                          ),
                        ],
                      ),
                    );
                  }),
                )
              else
                text(
                  'Uploaded proof media was deleted after 60 days. Other claim details remain.',
                ),
              for (final e in c['events'] as List)
                text(
                  '${e['internal'] == true ? 'Internal note · managers only' : 'Update'} · ${_date(e['createdAt'])}\n${e['message']}',
                ),
              if (manager) ...[
                Wrap(
                  children: [
                    for (final item in [
                      ('review', 'Under Review'),
                      ('approve', 'Approve'),
                      ('information', 'Request Information'),
                      ('reject', 'Reject'),
                      ('note', 'Internal Note'),
                      ('processing', 'Processing'),
                      ('refund', 'Mark Refund Completed'),
                      ('coupon', 'Mark Coupon Issued'),
                      ('complete', 'Mark Benefit Completed'),
                    ])
                      button(item.$2, () => managerAction(c, item.$1)),
                  ],
                ),
              ],
              if (!manager && c['status'] == 'More Information Required')
                button('Provide more information', () => reply(c)),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> reply(Map c) async {
    final reply = TextEditingController();
    ({Uint8List bytes, String name, String mime})? replacement;
    try {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, setDialog) => AlertDialog(
            title: const Text('More information'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: reply,
                    maxLength: 2000,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Reply to manager',
                    ),
                  ),
                  if (replacement != null)
                    Image.memory(replacement!.bytes, height: 120),
                  TextButton(
                    onPressed: () async {
                      try {
                        final selected = await pickImage();
                        if (context.mounted) {
                          setDialog(() => replacement = selected);
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context)
                              .showSnackBar(SnackBar(content: Text(_error(e))));
                        }
                      }
                    },
                    child: const Text('Replace proof (optional)'),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Submit'),
              ),
            ],
          ),
        ),
      );
      if (confirmed == true) {
        await run(() async {
          await ref
              .read(apiClientProvider)
              .post(
                '/api/exam-protection/claims/${c['id']}/reply',
                body: FormData.fromMap({
                  'message': reply.text,
                  if (replacement != null)
                    'proof': MultipartFile.fromBytes(
                      replacement!.bytes,
                      filename: replacement!.name,
                      contentType: DioMediaType.parse(replacement!.mime),
                    ),
                }),
              );
        });
      }
    } finally {
      reply.dispose();
    }
  }

  Future<void> managerAction(Map c, String action) async {
    final note = TextEditingController(),
        reference = TextEditingController(),
        code = TextEditingController();
    String? bundleId;
    List<Map> eligibleBundles = [];
    bool delivered = false;
    try {
      if (action == 'coupon') {
        try {
          final response = await ref
              .read(apiClientProvider)
              .get<List<dynamic>>(
                '/api/exam-protection/claims/${c['id']}/bundles',
              );
          eligibleBundles = (response.data ?? []).cast<Map>();
        } catch (error) {
          if (mounted) {
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text(_error(error))));
          }
          return;
        }
        if (!mounted) return;
      }
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, setDialog) => AlertDialog(
            title: Text(
              {
                    'refund': 'Record manual refund',
                    'coupon': 'Assign manually generated coupon',
                  }[action] ??
                  'Manager update',
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (['information', 'reject', 'note'].contains(action))
                    TextField(
                      controller: note,
                      maxLines: 3,
                      maxLength: 2000,
                      decoration: const InputDecoration(
                        labelText: 'Reason / message',
                      ),
                    ),
                  if (action == 'refund') ...[
                    Text(
                      'Issue ₹${_refund(c['purchase']['fee'] as num)} manually before recording it.',
                    ),
                    TextField(
                      controller: reference,
                      decoration: const InputDecoration(
                        labelText: 'Reference (optional)',
                      ),
                    ),
                  ],
                  if (action == 'coupon') ...[
                    const Text(
                      'Create an unused, inactive, hidden fixed-value coupon in the website coupon manager first. Select a bundle containing only this subject.',
                    ),
                    TextField(
                      controller: code,
                      decoration: const InputDecoration(
                        labelText: 'Coupon code',
                      ),
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: bundleId,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Eligible course bundle',
                      ),
                      items: eligibleBundles
                          .map(
                            (item) => DropdownMenuItem(
                              value: '${item['id']}',
                              child: Text(
                                '${item['name']}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setDialog(() => bundleId = value),
                    ),
                    if (eligibleBundles.isEmpty)
                      const Text(
                        'No same-subject bundle is configured. Create one in the website store before assigning the coupon.',
                      ),
                  ],
                  if (['refund', 'coupon'].contains(action))
                    CheckboxListTile(
                      value: delivered,
                      onChanged: (v) => setDialog(() => delivered = v ?? false),
                      title: const Text(
                        'I confirm actual refund delivery or coupon assignment.',
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Confirm'),
              ),
            ],
          ),
        ),
      );
      if (confirmed == true) {
        await run(() async {
          await ref
              .read(apiClientProvider)
              .post(
                '/api/exam-protection/claims/${c['id']}/action',
                body: {
                  'action': action,
                  'message': note.text,
                  'reference': reference.text,
                  'code': code.text,
                  'bundleId': bundleId,
                  'delivered': delivered,
                  'refundAmount': _refund(c['purchase']['fee'] as num),
                },
              );
        });
      }
    } finally {
      note.dispose();
      reference.dispose();
      code.dispose();
    }
  }
}
