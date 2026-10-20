import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/downloads/download_providers.dart';
import '../../core/payments/play_billing_service.dart';
import '../../core/payments/razorpay_service.dart';
import '../../theme/app_theme_tokens.dart';
import '../academics/free_resources_page.dart' show purchasedMaterialsProvider;
import 'purchase_success_dialog.dart';

enum NoteAccessState { none, active, expired }

NoteAccessState _parseState(String? s) {
  switch (s) {
    case 'ACTIVE':
      return NoteAccessState.active;
    case 'EXPIRED':
      return NoteAccessState.expired;
    default:
      return NoteAccessState.none;
  }
}

String formatNoteDate(DateTime d) => DateFormat('d MMM yyyy').format(d);

String formatNotePrice(double price) {
  if (price <= 0) return 'Free';
  final whole = price == price.roundToDouble();
  return '₹${whole ? price.toInt() : price.toStringAsFixed(2)}';
}

class StoreNoteFile {
  StoreNoteFile({required this.id, required this.title});
  final String id;
  final String title;
}

class StoreNote {
  StoreNote({
    required this.id,
    required this.title,
    required this.description,
    required this.price,
    required this.originalPrice,
    required this.category,
    required this.subject,
    required this.validityDays,
    required this.highlights,
    required this.rules,
    required this.state,
    required this.purchasedAt,
    required this.expiresAt,
    required this.hasAccess,
    required this.files,
  });

  final String id;
  final String title;
  final String? description;
  final double price;
  final double? originalPrice;
  final String category;
  final String? subject;
  final int validityDays;
  final List<String> highlights;

  /// Rules text is built on the server so the website shows the same lines.
  final List<String> rules;
  final NoteAccessState state;
  final DateTime? purchasedAt;
  final DateTime? expiresAt;
  final bool hasAccess;
  final List<StoreNoteFile> files;

  bool get isFree => price <= 0;
  bool get isExpired => state == NoteAccessState.expired;

  factory StoreNote.fromJson(Map<String, dynamic> j) {
    final access = j['myAccess'] as Map<String, dynamic>?;
    List<String> strings(dynamic v) =>
        v is List ? v.map((e) => e.toString()).toList() : const [];
    return StoreNote(
      id: j['id'] as String,
      title: (j['title'] as String?) ?? 'Notes',
      description: j['description'] as String?,
      price: (j['price'] as num?)?.toDouble() ?? 0,
      originalPrice: (j['originalPrice'] as num?)?.toDouble(),
      category: (j['category'] as String?) ?? 'General',
      subject: j['subject'] as String?,
      validityDays: (j['validityDays'] as num?)?.toInt() ?? 90,
      highlights: strings(j['highlights']),
      rules: strings(j['rules']),
      state: _parseState(access?['state'] as String?),
      purchasedAt: DateTime.tryParse('${access?['purchasedAt']}')?.toLocal(),
      expiresAt: DateTime.tryParse('${access?['expiresAt']}')?.toLocal(),
      hasAccess: j['hasAccess'] == true,
      files: (j['files'] is List
              ? (j['files'] as List).whereType<Map>()
              : const <Map>[])
          .map((f) => StoreNoteFile(
                id: f['id'].toString(),
                title: (f['title'] as String?)?.trim().isNotEmpty == true
                    ? f['title'] as String
                    : 'Document',
              ))
          .toList(),
    );
  }
}

/// One purchased note (active or expired) from /api/store/notes/my.
class MyStoreNote {
  MyStoreNote({
    required this.noteId,
    required this.title,
    required this.price,
    required this.state,
    required this.expiresAt,
    this.purchasedAt,
    this.category = '',
  });

  final DateTime? purchasedAt;
  final String category;
  final String noteId;
  final String title;
  final double price;
  final NoteAccessState state;
  final DateTime? expiresAt;

  factory MyStoreNote.fromJson(Map<String, dynamic> j) => MyStoreNote(
        noteId: j['noteId'] as String,
        title: (j['title'] as String?) ?? 'Notes',
        price: (j['price'] as num?)?.toDouble() ?? 0,
        state: _parseState(j['state'] as String?),
        expiresAt: DateTime.tryParse('${j['expiresAt']}')?.toLocal(),
        purchasedAt: DateTime.tryParse('${j['purchasedAt']}')?.toLocal(),
        category: (j['category'] as String?) ?? '',
      );
}

final storeNotesProvider =
    FutureProvider.autoDispose<List<StoreNote>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/store/notes');
  final data = res.data;
  final list = data is Map ? data['notes'] : null;
  if (list is! List) return const [];
  return list
      .whereType<Map>()
      .map((e) => StoreNote.fromJson(Map<String, dynamic>.from(e)))
      .toList();
});

final storeNoteProvider =
    FutureProvider.autoDispose.family<StoreNote, String>((ref, id) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/store/notes/$id');
  final data = res.data;
  final note = data is Map ? data['note'] : null;
  if (note is! Map) throw Exception('Note not found');
  return StoreNote.fromJson(Map<String, dynamic>.from(note));
});

/// Purchases (active + expired). Also removes expired downloads from the
/// device as soon as the server reports them.
final myStoreNotesProvider =
    FutureProvider.autoDispose<List<MyStoreNote>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/api/store/notes/my');
  final data = res.data;
  final list = data is Map ? data['notes'] : null;
  if (list is! List) return const [];
  final notes = list
      .whereType<Map>()
      .map((e) => MyStoreNote.fromJson(Map<String, dynamic>.from(e)))
      .toList();

  final user = ref.read(authStateProvider).value;
  final expired = notes
      .where((n) => n.state == NoteAccessState.expired)
      .map((n) => n.noteId)
      .toSet();
  if (user != null && expired.isNotEmpty) {
    await ref
        .read(downloadManagerProvider)
        .purgeExpiredStoreNotes(user.id, expiredIds: expired);
  }
  return notes;
});

final expiredStoreNotesProvider =
    Provider.autoDispose<List<MyStoreNote>>((ref) {
  final all = ref.watch(myStoreNotesProvider).value ?? const [];
  return all.where((n) => n.state == NoteAccessState.expired).toList();
});

/// Asks the buyer to accept the Terms and the Refund / Return Policy.
/// The Buy now button stays disabled until the box is ticked.
Future<bool> _confirmNoteTerms(BuildContext context) async {
  final tokens = context.tokens;
  final router = GoRouter.of(context);
  final ok = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: tokens.cardBg,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    builder: (sheet) {
      var checked = false;
      return StatefulBuilder(
        builder: (sheet, setState) {
          final linkStyle = TextStyle(
            color: tokens.primaryAccent,
            fontWeight: FontWeight.w700,
          );
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 36,
                      height: 5,
                      decoration: BoxDecoration(
                        color: tokens.textMuted.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Before you buy',
                    style: TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.4,
                      color: tokens.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => checked = !checked),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 26,
                          height: 26,
                          margin: const EdgeInsets.only(top: 1),
                          decoration: BoxDecoration(
                            color: checked
                                ? tokens.primaryAccent
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: checked
                                  ? tokens.primaryAccent
                                  : tokens.textMuted,
                              width: 2,
                            ),
                          ),
                          child: checked
                              ? const Icon(Icons.check_rounded,
                                  size: 18, color: Colors.white)
                              : null,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text.rich(
                            TextSpan(
                              style: TextStyle(
                                fontSize: 14.5,
                                height: 1.45,
                                color: tokens.textSecondary,
                              ),
                              children: [
                                const TextSpan(
                                    text: 'By continuing, you agree to our '),
                                TextSpan(
                                  text: 'Terms & Conditions',
                                  style: linkStyle,
                                  recognizer: TapGestureRecognizer()
                                    ..onTap = () => router
                                        .push('/terms-and-conditions'),
                                ),
                                const TextSpan(text: ' and our '),
                                TextSpan(
                                  text: 'Refund / Return Policy',
                                  style: linkStyle,
                                  recognizer: TapGestureRecognizer()
                                    ..onTap =
                                        () => router.push('/refund-policy'),
                                ),
                                const TextSpan(text: '.'),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  GestureDetector(
                    onTap: checked
                        ? () => Navigator.of(sheet).pop(true)
                        : null,
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 150),
                      opacity: checked ? 1 : 0.4,
                      child: Container(
                        height: 52,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: tokens.primaryAccent,
                          borderRadius: BorderRadius.circular(26),
                        ),
                        child: const Text(
                          'Buy now',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
  return ok == true;
}

/// Runs checkout for a note (first purchase or restore). Returns true when
/// access was granted. Shows its own feedback.
Future<bool> buyStoreNote(
  BuildContext context,
  WidgetRef ref, {
  required String noteId,
  required String title,
  double? price,
}) async {
  final agreed = await _confirmNoteTerms(context);
  if (!agreed || !context.mounted) return false;
  HapticFeedback.mediumImpact();
  final messenger = ScaffoldMessenger.of(context);

  final isAndroid = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  // The price decides the payment method. When the caller did not pass it,
  // load the note instead of assuming 0 (which would wrongly use Razorpay).
  var effectivePrice = price ?? 0.0;
  if (price == null) {
    try {
      effectivePrice = (await ref.read(storeNoteProvider(noteId).future)).price;
    } catch (_) {}
  }

  if (isAndroid && effectivePrice > 0) {
    final playService = PlayBillingService(api: ref.read(apiClientProvider));
    final result = await playService.purchaseNote(
      noteId: noteId,
      price: effectivePrice,
      title: title,
    );

    if (!result.isSuccess) {
      if (!result.isCancelled) {
        messenger.showSnackBar(
          SnackBar(content: Text(result.errorMessage ?? 'Payment failed')),
        );
      }
      return false;
    }
  } else {
    final service = RazorpayCheckoutService(api: ref.read(apiClientProvider));
    final result = await service.purchaseNote(context: context, noteId: noteId);

    if (!result.isSuccess) {
      final msg = (result.errorMessage ?? 'Payment failed').replaceFirst(
          RegExp(r'^(Exception: )'), '');
      if (!msg.toLowerCase().contains('cancel')) {
        messenger.showSnackBar(SnackBar(content: Text(msg)));
      }
      return false;
    }
  }

  ref.invalidate(storeNotesProvider);
  ref.invalidate(storeNoteProvider(noteId));
  ref.invalidate(myStoreNotesProvider);
  ref.invalidate(downloadedNotesProvider);
  ref.invalidate(purchasedMaterialsProvider);
  if (!context.mounted) return true;

  // Access end date for the modal (falls back to today + validity).
  DateTime? validUntil;
  try {
    final note = await ref
        .read(storeNoteProvider(noteId).future)
        .timeout(const Duration(seconds: 2));
    validUntil =
        note.expiresAt ?? DateTime.now().add(Duration(days: note.validityDays));
  } catch (_) {}
  if (!context.mounted) return true;

  // Skip "Open note" when the user is already on that note's page.
  var onNotePage = false;
  try {
    onNotePage = GoRouterState.of(context).uri.path.endsWith('/notes/$noteId');
  } catch (_) {}

  final open = await showPurchaseSuccessDialog(
    context,
    title: title,
    validUntil: validUntil,
    offerOpen: !onNotePage,
  );
  if (open && context.mounted) {
    context.push('/store/notes/$noteId');
  }
  return true;
}
