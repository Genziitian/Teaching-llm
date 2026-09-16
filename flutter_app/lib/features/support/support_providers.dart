import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_providers.dart';

bool canAccessSupport(String? role) => role == 'STUDENT' || role == 'MANAGER';

final supportSessionProvider = Provider((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  return (id: user?.id, role: user?.role);
});

final supportTicketsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final session = ref.watch(supportSessionProvider);
  if (!canAccessSupport(session.role)) {
    throw StateError('Support is not available for this account');
  }
  final res = await ref
      .watch(apiClientProvider)
      .get<List<dynamic>>('/api/support/tickets');
  return (res.data ?? []).cast<Map<String, dynamic>>();
});

final supportTicketProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, id) async {
  final session = ref.watch(supportSessionProvider);
  if (!canAccessSupport(session.role)) {
    throw StateError('Support is not available for this account');
  }
  try {
    final res = await ref.watch(apiClientProvider).get<Map<String, dynamic>>(
        '/api/support/tickets/${Uri.encodeComponent(id)}');
    if (res.data != null) return res.data!;
  } on DioException catch (e) {
    if (e.response?.statusCode == 405 || e.response?.statusCode == 404) {
      final tickets = await ref.watch(supportTicketsProvider.future);
      return tickets.firstWhere(
        (t) => t['id'] == id,
        orElse: () => throw e,
      );
    }
    rethrow;
  } catch (_) {
    final tickets = await ref.watch(supportTicketsProvider.future);
    return tickets.firstWhere((t) => t['id'] == id);
  }
  final tickets = await ref.watch(supportTicketsProvider.future);
  return tickets.firstWhere((t) => t['id'] == id);
});

final supportCoursesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  ref.watch(supportSessionProvider);
  final res = await ref.watch(apiClientProvider).get<dynamic>('/api/courses');
  final data = res.data;
  final list = data is List ? data : data['courses'] as List;
  return list.cast<Map<String, dynamic>>();
});

final supportManagersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final session = ref.watch(supportSessionProvider);
  if (session.role != 'MANAGER') return [];
  final res = await ref
      .watch(apiClientProvider)
      .get<Map<String, dynamic>>('/api/users/staff');
  return (res.data?['staff'] as List? ?? [])
      .cast<Map<String, dynamic>>()
      .where((user) => user['role'] == 'MANAGER')
      .toList();
});

String supportError(Object error) => error is DioException
    ? error.message ?? 'Unable to connect. Please try again.'
    : 'Unable to load support. Please try again.';

String ticketStatusLabel(dynamic status) => switch (status) {
      'OPEN' => 'Open',
      'IN_PROGRESS' => 'In progress',
      'RESOLVED' => 'Resolved',
      'CLOSED' => 'Closed',
      _ => 'Unknown',
    };

final featureRequestsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref
      .watch(apiClientProvider)
      .get<dynamic>('/api/support/feature-requests');
  final data = res.data;
  if (data is List) {
    return data.cast<Map<String, dynamic>>();
  }
  return [];
});

final userReportsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref
      .watch(apiClientProvider)
      .get<dynamic>('/api/support/user-reports');
  final data = res.data;
  if (data is List) {
    return data.cast<Map<String, dynamic>>();
  }
  return [];
});

