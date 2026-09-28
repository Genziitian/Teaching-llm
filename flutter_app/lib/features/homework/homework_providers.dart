import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_providers.dart';

final homeworkListProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, courseId) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/homework?courseId=$courseId');
    final list = res.data is List ? res.data as List : <dynamic>[];
    return [for (final j in list) Map<String, dynamic>.from(j as Map)];
  } catch (e) {
    debugPrint('Error fetching homework for course $courseId: $e');
    return const [];
  }
});
