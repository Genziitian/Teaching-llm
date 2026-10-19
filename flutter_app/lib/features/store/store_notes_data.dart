import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/downloads/download_providers.dart';
import '../../core/payments/razorpay_service.dart';

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

/// Runs checkout for a note (first purchase or restore). Returns true when
/// access was granted. Shows its own feedback.
Future<bool> buyStoreNote(
  BuildContext context,
  WidgetRef ref, {
  required String noteId,
  required String title,
}) async {
  HapticFeedback.mediumImpact();
  final messenger = ScaffoldMessenger.of(context);
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

  ref.invalidate(storeNotesProvider);
  ref.invalidate(storeNoteProvider(noteId));
  ref.invalidate(myStoreNotesProvider);
  ref.invalidate(downloadedNotesProvider);
  HapticFeedback.heavyImpact();
  messenger.showSnackBar(
    SnackBar(content: Text('"$title" is unlocked. You can download it now.')),
  );
  return true;
}
