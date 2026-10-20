import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
const _faqs = [
  ('What does Exam Protection cover?', 'If you do not pass the exam for a protected course, you choose a refund or a bigger discount on the same course.'),
  ('How much do I get back?', 'Refund: your fee minus ₹10. Discount: 1.5× your fee. For example, a ₹50 fee gives a ₹40 refund or a ₹75 discount.'),
  ('When can I add protection?', 'Before your exam, while protection is open for your course. Tap Add Protection on the course.'),
  ('How do I make a claim?', 'When official results are declared, claims open and you get a notification. Within 7 days, tap Start a claim, pick your benefit, answer a few quick questions and upload your result screenshot.'),
  ('What proof do I need?', 'A screenshot of your official results dashboard. PNG, JPEG or WebP, up to 5 MB.'),
  ('How will I know my claim status?', 'You get a notification at every update, and you can follow it anytime in My claims.'),
  ('How do I receive my refund?', 'Once your claim is approved, the refund is sent back to you and marked complete in My claims.'),
  ('How do I use my discount coupon?', 'Open My coupons and tap Reveal. Use the code within 7 days on the same course, signed in with the same email.'),
  ('Can I use the coupon on another course?', 'It works only for the same course you protected. The exam can be different, for example a later quiz or term of that course.'),
  ('What if I pass?', 'Congratulations! No claim is needed. Your protection simply covered you for that exam.'),
];
const _lifecycle = [
  ('Submitted', 'We have received your claim.', Color(0xFF2563EB)),
  ('Under Review', 'We are checking your result and eligibility.', Color(0xFF2563EB)),
  ('More Information Required', 'Please send the extra details or proof we asked for.', Color(0xFFD97706)),
  ('Approved', 'Your benefit is approved and on its way.', Color(0xFF16A34A)),
  ('Rejected', 'Not eligible. You will see the reason.', Color(0xFFDC2626)),
  ('Processing', 'We are arranging your refund or coupon.', Color(0xFFD97706)),
  ('Completed', 'Refund issued or coupon added to My coupons.', Color(0xFF16A34A)),
];
String _error(Object e) => e is DioException
    ? (e.response?.data is Map && (e.response!.data as Map)['error'] is String
          ? (e.response!.data as Map)['error'] as String
          : e.response == null
          ? 'Could not reach the server. Check your internet connection and try again.'
          : 'Something went wrong. Please try again.')
    : e is FormatException
    ? e.message
    : e.toString();
String _date(dynamic value) {
  final d = DateTime.tryParse('$value');
  return d == null ? '—' : '${d.day}/${d.month}/${d.year}';
}


class ExamProtectionPage extends ConsumerStatefulWidget {
  const ExamProtectionPage({super.key});
  @override
  ConsumerState<ExamProtectionPage> createState() => _PageState();
}

class _PageState extends ConsumerState<ExamProtectionPage> {
  int section = 0, claimStep = 0;
  bool introOpen = false, benefitsOpen = false;
  bool showAllFaq = false;
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

  static const _accents = {
    'Exam protection benefits': (Color(0xFF16A34A), Icons.savings_outlined),
    'Purchase availability': (Color(0xFFD97706), Icons.toggle_on_outlined),
    'Get protection': (Color(0xFF5856D6), Icons.shield_outlined),
    'Available to protect': (Color(0xFF5856D6), Icons.add_moderator_outlined),
    'Frequently asked questions': (Color(0xFF0891B2), Icons.help_outline_rounded),
    'My protection': (Color(0xFF5856D6), Icons.verified_user_outlined),
    'Protection purchases': (Color(0xFF5856D6), Icons.receipt_long_outlined),
    'Start a claim': (Color(0xFFD97706), Icons.edit_note_rounded),
    'My claims': (Color(0xFF2563EB), Icons.assignment_outlined),
    'Manager claims': (Color(0xFF2563EB), Icons.assignment_outlined),
    'My Coupons': (Color(0xFF16A34A), Icons.local_offer_outlined),
  };
  Widget card(String title, List<Widget> children, {String? info, bool? open, VoidCallback? onToggle}) {
    final (tint, icon) = _accents[title] ?? (const Color(0xFF5856D6), Icons.shield_outlined);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Material(
        color: context.tokens.cardBg,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: tint.withValues(alpha: 0.22)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          InkWell(onTap: onToggle, child: Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [tint.withValues(alpha: 0.14), tint.withValues(alpha: 0.03)]),
            ),
            child: Row(children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(9)),
                child: Icon(icon, size: 18, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(title, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, letterSpacing: -0.2, color: context.tokens.textPrimary))),
              if (onToggle != null)
                AnimatedRotation(turns: open == true ? 0.5 : 0, duration: const Duration(milliseconds: 200), child: Icon(Icons.expand_more_rounded, color: tint)),
              if (info != null)
                IconButton(
                  tooltip: 'Info',
                  visualDensity: VisualDensity.compact,
                  icon: Icon(Icons.info_outline_rounded, size: 20, color: tint),
                  onPressed: () => showDialog<void>(
                    context: context,
                    builder: (d) => AlertDialog(
                      title: Text(title),
                      content: Text(info),
                      actions: [TextButton(onPressed: () => Navigator.pop(d), child: const Text('OK'))],
                    ),
                  ),
                ),
            ]),
          )),
          if (open != false) Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
          ),
        ]),
      ),
    );
  }
  bool _stepReady(Map? selected) => switch (claimStep) {
    0 => selected != null,
    1 => reason != null && (attempted == 'no' || (attempted == 'yes' && (double.tryParse(marks.text) ?? -1) >= 0)),
    2 => image != null && released,
    _ => true,
  };
  Widget _progress(int step) {
    const labels = ['Course', 'Exam', 'Proof', 'Review'];
    return Row(children: [
      for (var i = 0; i < 4; i++) ...[
        if (i > 0) const SizedBox(width: 6),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AnimatedContainer(duration: const Duration(milliseconds: 220), height: 4, decoration: BoxDecoration(borderRadius: BorderRadius.circular(4), color: i <= step ? const Color(0xFF5856D6) : context.tokens.textSecondary.withValues(alpha: 0.18))),
          const SizedBox(height: 6),
          Text(labels[i], style: TextStyle(fontSize: 11, fontWeight: i == step ? FontWeight.w600 : FontWeight.w400, color: i == step ? context.tokens.textPrimary : context.tokens.textSecondary)),
        ])),
      ],
    ]);
  }
  Widget _choice(String label, String value, Color tint, bool on, VoidCallback onTap) => Expanded(
    child: Material(
      color: tint.withValues(alpha: on ? 0.14 : 0.06),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: on ? tint : context.tokens.textSecondary.withValues(alpha: 0.18), width: on ? 1.5 : 1)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: busy ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tint)), const Spacer(), if (on) Icon(Icons.check_circle_rounded, size: 18, color: tint)]),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: context.tokens.textPrimary)),
          ]),
        ),
      ),
    ),
  );
  Widget _reviewRow(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 90, child: Text(label, style: TextStyle(fontSize: 13, color: context.tokens.textSecondary))),
      Expanded(child: Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: context.tokens.textPrimary))),
    ]),
  );
  Widget _navButton(IconData icon, String label, int target, Color tint) => Expanded(
    child: Material(
      color: tint.withValues(alpha: 0.10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: tint.withValues(alpha: 0.28))),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => setState(() => section = target),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 20, color: Colors.white),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: Text(label, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: context.tokens.textPrimary))),
              Icon(Icons.chevron_right_rounded, size: 18, color: tint),
            ]),
          ]),
        ),
      ),
    ),
  );
  Widget _dealChip(IconData icon, String label, Color tint) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(color: tint.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999), border: Border.all(color: tint.withValues(alpha: 0.3))),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 15, color: tint),
      const SizedBox(width: 5),
      Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tint)),
    ]),
  );
  Widget _claimPreview(List<String> reasons) {
    Widget label(String t) => Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 6),
      child: Text(t, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: context.tokens.textPrimary)),
    );
    Widget field(String hint, IconData icon) => Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: context.tokens.textSecondary.withValues(alpha: 0.2))),
      child: Row(children: [
        Expanded(child: Text(hint, style: TextStyle(fontSize: 14, color: context.tokens.textSecondary))),
        Icon(icon, size: 18, color: context.tokens.textSecondary),
      ]),
    );
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(0xFFD97706).withValues(alpha: 0.10), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFD97706).withValues(alpha: 0.3))),
        child: Row(children: [
          const Icon(Icons.lock_outline_rounded, color: Color(0xFFD97706)),
          const SizedBox(width: 10),
          Expanded(child: Text('Claims open after official results are declared. You will get a notification, then you have 7 days to claim. Late claims are void.', style: TextStyle(fontSize: 13, height: 1.4, color: context.tokens.textPrimary))),
        ]),
      ),
      const SizedBox(height: 10),
      SizedBox(width: double.infinity, child: FilledButton.icon(
        onPressed: () => setState(() => section = 3),
        icon: const Icon(Icons.add_moderator_outlined, size: 18),
        label: const Text('Protect now'),
      )),
      IgnorePointer(child: Opacity(opacity: 0.6, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        label('Protected course'),
        field('Your protected course', Icons.expand_more_rounded),
        label('Choose your benefit'),
        Row(children: [
          _choice('Refund', 'Fee − ₹10', const Color(0xFF16A34A), false, () {}),
          const SizedBox(width: 10),
          _choice('Discount', '1.5 × fee', const Color(0xFF5856D6), false, () {}),
        ]),
        label('Why didn’t you pass?'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final r in reasons)
            Chip(label: Text(r, style: const TextStyle(fontSize: 12)), visualDensity: VisualDensity.compact),
        ]),
        label('Did you attempt the exam?'),
        Row(children: [
          Expanded(child: field('Yes', Icons.radio_button_unchecked)),
          const SizedBox(width: 10),
          Expanded(child: field('No', Icons.radio_button_unchecked)),
        ]),
        label('Marks obtained in this course'),
        field('Enter your marks', Icons.edit_outlined),
        label('Anything else? (optional)'),
        field('Add any details you want to share', Icons.notes_rounded),
        label('Official results screenshot'),
        field('Upload PNG, JPEG or WebP · up to 5 MB', Icons.upload_rounded),
        label('Confirm'),
        field('My official exam results have been released', Icons.check_box_outline_blank_rounded),
      ]))),
    ]);
  }
  Widget _pathStep(int n, String text, Color tint) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('$n.', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: tint)),
      const SizedBox(width: 8),
      Expanded(child: Text(text, style: TextStyle(fontSize: 13, height: 1.35, color: context.tokens.textSecondary))),
    ]),
  );
  Widget _pathCard(String title, String math, List<Widget> steps, String note, Color tint) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(14),
      color: tint.withValues(alpha: 0.07),
      border: Border.all(color: tint.withValues(alpha: 0.28)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(999)),
        child: Text('${title.toUpperCase()} PATH', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: Colors.white)),
      ),
      const SizedBox(height: 10),
      Text(math, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: context.tokens.textPrimary)),
      const SizedBox(height: 10),
      ...steps,
      const SizedBox(height: 6),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: tint.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(10)),
        child: Text(note, style: TextStyle(fontSize: 12, color: context.tokens.textPrimary)),
      ),
    ]),
  );
  Widget _youGet(bool refund, num fee) {
    final tint = refund ? const Color(0xFF16A34A) : const Color(0xFF5856D6);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: tint.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(10), border: Border.all(color: tint.withValues(alpha: 0.3))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(refund ? Icons.currency_rupee_rounded : Icons.local_offer_rounded, size: 16, color: tint),
        const SizedBox(width: 6),
        Flexible(child: Text.rich(TextSpan(children: [
          TextSpan(text: refund ? 'You get ₹${_refund(fee)} refund' : 'You get a ₹${_discount(fee)} coupon', style: TextStyle(fontWeight: FontWeight.w700, color: tint)),
          TextSpan(text: refund ? '  (₹$fee paid − ₹10 fee)' : '  (1.5 × ₹$fee, same course)', style: TextStyle(fontSize: 12, color: context.tokens.textSecondary)),
        ]))),
      ]),
    );
  }
  void _knowMore() => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => Scaffold(
    backgroundColor: context.tokens.bg,
    appBar: AppBar(title: const Text('How Exam Protection works')),
    floatingActionButton: FloatingActionButton.extended(
        heroTag: 'protection-help',
        onPressed: () => context.push('/support'),
        backgroundColor: const Color(0xFF5856D6),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.call_rounded, size: 20),
        label: const Text('Need help?'),
      ),

    body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 40), children: [
      text('Add protection to your course before the exam. It stays valid until your exam ends. When official results are declared, claims open and you get a notification. You then have 7 days to claim.'),
      Builder(builder: (_) { const tint = Color(0xFF16A34A); return _pathCard('Refund', 'Full refund', [
        _pathStep(1, 'Choose Refund when you claim.', tint),
        _pathStep(2, 'Your claim is reviewed and approved.', tint),
        _pathStep(3, 'We send your fee back, minus a minimal ₹10 fee.', tint),
        _pathStep(4, 'You get a notification when it is done.', tint),
      ], 'Example: ₹50 fee → ₹40 back.', tint); }),
      const SizedBox(height: 12),
      Builder(builder: (_) { const tint = Color(0xFF5856D6); return _pathCard('Coupon', '1.5 × fee', [
        _pathStep(1, 'Choose Discount when you claim.', tint),
        _pathStep(2, 'Your claim is reviewed and approved.', tint),
        _pathStep(3, 'A coupon is added to My claims & coupons.', tint),
        _pathStep(4, 'Reveal it and use it within 7 days on the same course.', tint),
      ], 'Example: ₹50 fee → ₹75 off the same course.', tint); }),
      const SizedBox(height: 12),
      text('Late claims after the 7-day window are void. Use the same email you used here when redeeming a coupon.'),
    ]),
  )));
  Widget _skeleton() {
    final c = context.tokens.textSecondary.withValues(alpha: 0.10);
    Widget box(double h, {double? w, double r = 16}) => Container(height: h, width: w, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(r)));
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        box(96),
        const SizedBox(height: 16),
        Row(children: [Expanded(child: box(110, r: 14)), const SizedBox(width: 10), Expanded(child: box(110, r: 14))]),
        const SizedBox(height: 10),
        box(110, r: 14),
        const SizedBox(height: 16),
        box(72),
        const SizedBox(height: 16),
        box(72),
        const SizedBox(height: 24),
        const Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))),
      ],
    );
  }
  Widget _helpButton() => Center(
    child: TextButton.icon(
      onPressed: () => context.push('/support'),
      icon: const Icon(Icons.call_rounded, size: 18),
      label: const Text('Need help? Contact support'),
    ),
  );
  Widget _miniTag(String label, Color tint) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: tint.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
    child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tint)),
  );
  Widget _stat(String label, String value, String example, Color tint) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: tint.withValues(alpha: 0.08),
        border: Border.all(color: tint.withValues(alpha: 0.25)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tint)),
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
  Future<void> details(Map c, {bool buy = false, bool canBuy = false}) async {
    final accepted = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (sheet) => StatefulBuilder(
        builder: (context, setSheet) => Scaffold(
          backgroundColor: context.tokens.bg,
          appBar: AppBar(title: Text(buy ? 'Add Protection' : 'Protection details')),
          body: SafeArea(child: Padding(
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
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [const Color(0xFF5856D6).withValues(alpha: 0.18), const Color(0xFF16A34A).withValues(alpha: 0.10)]),
                    border: Border.all(color: const Color(0xFF5856D6).withValues(alpha: 0.22)),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${c['name']}', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: context.tokens.textPrimary)),
                    const SizedBox(height: 12),
                    Text.rich(TextSpan(children: [
                      TextSpan(text: '₹${c['fee']}', style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -0.8, color: context.tokens.textPrimary)),
                      TextSpan(text: '  one-time fee', style: TextStyle(fontSize: 14, color: context.tokens.textSecondary)),
                    ])),
                    const SizedBox(height: 4),
                    Text('Valid until your exam ends.', style: TextStyle(fontSize: 13, color: context.tokens.textSecondary)),
                  ]),
                ),
                const SizedBox(height: 20),
                Text('How it works', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: context.tokens.textPrimary)),
                const SizedBox(height: 10),
                for (final (i, t) in const [
                  'When official results are declared, claims open for 7 days. We will tell you by app notification and email.',
                  'If you did not pass, submit a claim with your result screenshot.',
                  'If your claim is verified and everything checks out, pick one of the two options below.',
                ].indexed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 24, height: 24, alignment: Alignment.center,
                        decoration: const BoxDecoration(color: Color(0xFF5856D6), shape: BoxShape.circle),
                        child: Text('${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Text(t, style: TextStyle(fontSize: 14, height: 1.4, color: context.tokens.textSecondary))),
                    ]),
                  ),
                const SizedBox(height: 8),
                Text('Your two options', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: context.tokens.textPrimary)),
                const SizedBox(height: 10),
                IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  _stat('Full refund', '₹${_refund(c['fee'] as num)}', 'back to you, minus a nominal fee', const Color(0xFF16A34A)),
                  const SizedBox(width: 10),
                  _stat('Discount on next purchase', '₹${_discount(c['fee'] as num)}', '1.5 × your fee, same course', const Color(0xFF5856D6)),
                ])),
                const SizedBox(height: 14),
                Text('Claims made after the 7-day window are void.', style: TextStyle(fontSize: 12, color: context.tokens.textSecondary)),
                if (buy) ...[
                  const SizedBox(height: 18),
                  Text.rich(
                    TextSpan(style: TextStyle(fontSize: 13, color: context.tokens.textSecondary), children: [
                      const TextSpan(text: 'By continuing, you agree to our '),
                      WidgetSpan(alignment: PlaceholderAlignment.baseline, baseline: TextBaseline.alphabetic, child: GestureDetector(
                        onTap: () => context.push('/terms'),
                        child: const Text('Terms and Conditions', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF5856D6), decoration: TextDecoration.underline)),
                      )),
                      const TextSpan(text: '.'),
                    ]),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton(
                      style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                      onPressed: () => Navigator.pop(context, true),
                      child: Text('Pay ₹${c['fee']} & protect', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
                if (!buy && canBuy) ...[
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton(
                      style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                      onPressed: () {
                        Navigator.pop(context, false);
                        Future.microtask(() => details(c, buy: true));
                      },
                      child: const Text('Get protection now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                _helpButton(),
              ],
            ),
          ),
        ))),
      ),
    ));
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
    const titles = {1: 'My claims & coupons', 3: 'My protection', 4: 'Start a claim'};
    return PopScope(
      canPop: section == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => section = 0);
      },
      child: Scaffold(
      backgroundColor: context.tokens.bg,
      appBar: AppBar(
        title: Text(titles[section] ?? 'Exam Protection'),
        leading: section == 0 ? null : IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => section = 0)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'protection-help',
        onPressed: () => context.push('/support'),
        backgroundColor: const Color(0xFF5856D6),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.call_rounded, size: 20),
        label: const Text('Need help?'),
      ),
      body: result.when(
        loading: _skeleton,
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
          final available = purchases.where((p) => p['claim'] == null && p['claimWindow'] == 'open').toList();
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
                if (section == 0) ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [const Color(0xFF5856D6).withValues(alpha: 0.16), const Color(0xFF16A34A).withValues(alpha: 0.10)],
                      ),
                      border: Border.all(color: const Color(0xFF5856D6).withValues(alpha: 0.22)),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      InkWell(
                        onTap: () => setState(() => introOpen = !introOpen),
                        child: Row(children: [
                          Container(
                            width: 28, height: 28,
                            margin: const EdgeInsets.only(right: 10),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: const Color(0xFF5856D6), borderRadius: BorderRadius.circular(8)),
                            child: const Text('Q', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
                          ),
                          Expanded(child: Text('What is the Exam Protection add-on?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: context.tokens.textPrimary))),
                          AnimatedRotation(turns: introOpen ? 0.5 : 0, duration: const Duration(milliseconds: 200), child: const Icon(Icons.expand_more_rounded, color: Color(0xFF5856D6))),
                        ]),
                      ),
                      if (introOpen) ...[
                      const SizedBox(height: 6),
                      Text('Your safety net for exam day. Add it to your course for a small fee. If you do not pass, get your money back or a bigger discount on the same course.', style: TextStyle(fontSize: 14, height: 1.45, color: context.tokens.textSecondary)),
                      const SizedBox(height: 12),
                      Text('Study with confidence. Protected either way.', style: TextStyle(fontSize: 14, height: 1.45, fontWeight: FontWeight.w600, color: context.tokens.textPrimary)),
                      const SizedBox(height: 14),
                      Wrap(spacing: 8, runSpacing: 8, children: [
                        _dealChip(Icons.currency_rupee_rounded, 'Small one-time fee', const Color(0xFF5856D6)),
                        _dealChip(Icons.bolt_rounded, 'Claim in 4 steps', const Color(0xFFD97706)),
                      ]),
                      ],
                    ]),
                  ),
                  if (!manager)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Column(children: [
                        Row(children: [
                          _navButton(Icons.shield_outlined, 'My protection', 3, const Color(0xFF5856D6)),
                          const SizedBox(width: 10),
                          _navButton(Icons.edit_note_rounded, 'Start a claim', 4, const Color(0xFFD97706)),
                        ]),
                        const SizedBox(height: 10),
                        Row(children: [
                          _navButton(Icons.assignment_outlined, 'My claims & coupons · ${claims.length}', 1, const Color(0xFF2563EB)),
                        ]),
                      ]),
                    ),
                ],
                if (section == 0)
                card('Exam protection benefits', [
                  text('If you do not pass, choose one when you claim.'),
                  IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    _stat('Refund', 'Full refund', 'minus a minimal ₹10 fee', const Color(0xFF16A34A)),
                    const SizedBox(width: 10),
                    _stat('Discount on next purchase', '1.5 × fee', 'Ex: ₹50 fee → ₹75 off', const Color(0xFF5856D6)),
                  ])),
                  const SizedBox(height: 12),
                  SizedBox(width: double.infinity, child: OutlinedButton.icon(
                    onPressed: _knowMore,
                    icon: const Icon(Icons.menu_book_outlined, size: 18),
                    label: const Text('Know more'),
                  )),
                ], open: benefitsOpen, onToggle: () => setState(() => benefitsOpen = !benefitsOpen)),
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
                if (section == 3 || (manager && section == 0))
                card(manager ? 'Protection purchases' : 'My protection', [
                  if (purchases.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: context.tokens.textSecondary.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12)),
                      child: Row(children: [
                        Icon(Icons.shield_outlined, color: const Color(0xFF5856D6).withValues(alpha: 0.7)),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(manager ? 'No protection purchases yet.' : 'No courses protected yet', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: context.tokens.textPrimary)),
                          if (!manager) Text('Choose a course below to protect it.', style: TextStyle(fontSize: 13, color: context.tokens.textSecondary)),
                        ])),
                      ]),
                    ),
                  for (final p in purchases)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        width: 36, height: 36,
                        decoration: BoxDecoration(color: const Color(0xFF16A34A).withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
                        child: const Icon(Icons.verified_user_rounded, size: 20, color: Color(0xFF16A34A)),
                      ),
                      title: Text('${p['courseName']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        '₹${p['fee']} paid · valid until your exam ends\nIf you do not pass: ₹${_refund(p['fee'] as num)} refund or ₹${_discount(p['fee'] as num)} coupon${manager ? '\n${p['user']['email']}' : ''}',
                      ),
                      trailing: Text(p['claim'] != null ? 'Claimed' : p['claimWindow'] == 'open' ? 'Claim by ${_date(p['claimsCloseAt'])}' : p['claimWindow'] == 'closed' ? 'Window closed' : 'Protected', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: p['claim'] != null ? const Color(0xFF2563EB) : p['claimWindow'] == 'open' ? const Color(0xFFD97706) : p['claimWindow'] == 'closed' ? context.tokens.textSecondary : const Color(0xFF16A34A))),
                    ),
                ], info: 'Protected courses stay listed here for ${data['retentionDays']} days from purchase. Your purchase record is kept after that.'),
                if (section == 3 || (manager && section == 0))
                card(manager ? 'Get protection' : 'Available to protect', [
                  if (courses.where((c) => manager || c['protected'] != true).isEmpty)
                    text(manager ? 'No course has a protection fee yet.' : 'You have protected all your eligible courses.'),
                  for (final c in courses.where((c) => manager || c['protected'] != true))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Material(
                        color: const Color(0xFF5856D6).withValues(alpha: 0.05),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: const Color(0xFF5856D6).withValues(alpha: 0.18))),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: () => details(c, canBuy: c['protected'] != true && !manager && data['isOpen'] == true),
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
                            child: Row(children: [
                              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('${c['name']}', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: context.tokens.textPrimary)),
                              ])),
                              const SizedBox(width: 10),
                              if (!manager)
                                FilledButton(
                                  style: FilledButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                                  onPressed: data['isOpen'] == true && !busy ? () => details(c, buy: true) : null,
                                  child: Text(data['isOpen'] == true ? 'Protect' : 'Closed'),
                                )
                              else
                                Icon(Icons.chevron_right_rounded, color: context.tokens.textSecondary),
                            ]),
                          ),
                        ),
                      ),
                    ),
                  if (!manager)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text('Tap a course to see how it works.', style: TextStyle(fontSize: 12, color: context.tokens.textSecondary)),
                    ),
                ]),
                if (section == 0)
                  card('Frequently asked questions', [
                    for (final f in (showAllFaq ? _faqs : _faqs.take(2)))
                      Theme(
                        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          childrenPadding: const EdgeInsets.only(bottom: 12),
                          expandedCrossAxisAlignment: CrossAxisAlignment.start,
                          iconColor: const Color(0xFF0891B2),
                          title: Text(f.$1, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: context.tokens.textPrimary)),
                          children: [Text(f.$2, style: TextStyle(fontSize: 14, height: 1.45, color: context.tokens.textSecondary))],
                        ),
                      ),
                    const SizedBox(height: 4),
                    Center(
                      child: TextButton.icon(
                        onPressed: () => setState(() => showAllFaq = !showAllFaq),
                        icon: Icon(showAllFaq ? Icons.expand_less_rounded : Icons.expand_more_rounded),
                        label: Text(showAllFaq ? 'Show less' : 'Show all ${_faqs.length} questions'),
                      ),
                    ),
                  ]),
                if (section == 4 && !manager)
                  card('Start a claim', [
                    if (available.isEmpty)
                      _claimPreview((data['reasons'] as List).map((r) => '$r').toList())
                    else
                      Form(
                        key: formKey,
                        child: Column(
                          children: [
                            _progress(claimStep),
                            const SizedBox(height: 16),
                            if (claimStep == 0) ...[
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
                            const SizedBox(height: 14),
                            Row(children: [
                              _choice('Refund', selected == null ? 'Fee − ₹10' : '₹${_refund(selected['fee'] as num)}', const Color(0xFF16A34A), benefit == 'refund', () => setState(() => benefit = 'refund')),
                              const SizedBox(width: 10),
                              _choice('Discount', selected == null ? '1.5 × fee' : '₹${_discount(selected['fee'] as num)}', const Color(0xFF5856D6), benefit == 'coupon', () => setState(() => benefit = 'coupon')),
                            ]),
                              if (selected != null) ...[const SizedBox(height: 10), _youGet(benefit == 'refund', selected['fee'] as num)],
                            ],
                            if (claimStep == 1) ...[
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
                              onChanged: (_) => setState(() {}),
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
                            ],
                            if (claimStep == 2) ...[
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
                                'My official exam results have been released.',
                              ),
                            ),
                            ],
                            if (claimStep == 3 && selected != null) ...[
                              _reviewRow('Course', '${selected['courseName']}'),
                              _reviewRow('Benefit', benefit == 'refund' ? 'Refund · ₹${_refund(selected['fee'] as num)}' : 'Discount · ₹${_discount(selected['fee'] as num)}'),
                              _reviewRow('Reason', reason ?? ''),
                              _reviewRow('Attempted', attempted == 'yes' ? 'Yes · ${marks.text} marks' : 'No'),
                              _reviewRow('Proof', imageName ?? 'Screenshot attached'),
                              text('A manager reviews your claim manually. You will be notified at each status change.'),
                            ],
                            const SizedBox(height: 8),
                            Row(children: [
                              if (claimStep > 0) OutlinedButton(onPressed: busy ? null : () => setState(() => claimStep--), child: const Text('Back')),
                              const Spacer(),
                              FilledButton(
                                onPressed: busy || !_stepReady(selected) ? null : () {
                                  if (claimStep < 3) { setState(() => claimStep++); } else { run(() async { await submit(); if (mounted) setState(() => claimStep = 0); }); }
                                },
                                child: Text(busy ? 'Working…' : claimStep < 3 ? 'Continue' : 'Submit claim'),
                              ),
                            ]),
                          ],
                        ),
                      ),
                  ]),
                if (section == 1)
                card(manager ? 'Manager claims' : 'My claims', [
                  if (claims.isEmpty)
                    text('No claims yet.'),
                  for (final c in claims) claimTile(c, manager),
                  if (!manager) ...[
                    const SizedBox(height: 8),
                    Material(
                      color: const Color(0xFF16A34A).withValues(alpha: 0.08),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: const Color(0xFF16A34A).withValues(alpha: 0.28))),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: _knowMore,
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(children: [
                            Container(
                              width: 36, height: 36,
                              decoration: BoxDecoration(color: const Color(0xFF16A34A), borderRadius: BorderRadius.circular(10)),
                              child: const Icon(Icons.route_rounded, size: 20, color: Colors.white),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('What happens after approval?', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: context.tokens.textPrimary)),
                              Text('See the refund and coupon paths', style: TextStyle(fontSize: 12, color: context.tokens.textSecondary)),
                            ])),
                            const Icon(Icons.chevron_right_rounded, color: Color(0xFF16A34A)),
                          ]),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (!manager) ...[
                    const SizedBox(height: 8),
                    Text('How a claim moves', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: context.tokens.textPrimary)),
                    const SizedBox(height: 10),
                    for (var i = 0; i < _lifecycle.length; i++)
                      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Column(children: [
                          Container(
                            width: 26, height: 26,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: _lifecycle[i].$3, shape: BoxShape.circle),
                            child: Text('${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                          ),
                          if (i < _lifecycle.length - 1)
                            Container(width: 2, height: 30, color: _lifecycle[i].$3.withValues(alpha: 0.25)),
                        ]),
                        const SizedBox(width: 12),
                        Expanded(child: Padding(
                          padding: const EdgeInsets.only(top: 3, bottom: 12),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(_lifecycle[i].$1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _lifecycle[i].$3)),
                            Text(_lifecycle[i].$2, style: TextStyle(fontSize: 13, height: 1.35, color: context.tokens.textSecondary)),
                          ]),
                        )),
                      ]),
                  ],
                ], info: 'Claims stay listed for ${data['retentionDays']} days after submission. Result screenshots are deleted 60 days after you submit; other claim details are kept.'),
                if (section == 1 && !manager && coupons.isNotEmpty)
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
                      Divider(color: context.tokens.textSecondary.withValues(alpha: 0.12), height: 28),
                    ],
                  ]),
              ],
            ),
          );
        },
      ),
    ));
  }

  Widget claimTile(Map c, bool manager) {
    final p = c['purchase'] as Map;
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      title: Text('${p['courseName']}', style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _youGet(c['benefit'] == 'refund', p['fee'] as num),
          const SizedBox(height: 6),
          Text('${c['status']} · ${_date(c['createdAt'])}', style: TextStyle(fontSize: 12, color: context.tokens.textSecondary)),
        ]),
      ),
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
