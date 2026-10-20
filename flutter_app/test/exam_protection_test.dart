import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teaching_llm/core/api/api_client.dart';
import 'package:teaching_llm/core/auth/auth_providers.dart';
import 'package:teaching_llm/features/exam_protection/exam_protection_page.dart';

class _ProtectionApi extends ApiClient {
  bool fail = false;
  @override
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? query}) async {
    if (fail) {
      throw const FormatException('Protection is temporarily unavailable.');
    }
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: {
        'manager': false,
        'email': 'student@example.test',
        'isOpen': false,
        'retentionDays': 60,
        'reasons': [
          'Marks below the passing requirement',
          'Did not attempt the exam',
          'Other reason',
        ],
        'courses': [
          {
            'id': 'math',
            'name': 'Mathematics Quiz 1',
            'fee': 61,
            'protected': false,
          },
        ],
        'purchases': [
          {
            'id': 'paid-course',
            'courseName': 'Statistics Quiz 1',
            'fee': 50,
            'paidAt': '2026-10-20T00:00:00Z',
            'claim': null,
          },
        ],
        'claims': [],
      } as T,
    );
  }
}

Future<void> _mount(WidgetTester tester, _ProtectionApi api) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const MaterialApp(home: ExamProtectionPage()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'native protection shows fee-derived benefits and blocks purchases while closed',
    (tester) async {
      await _mount(tester, _ProtectionApi());
      expect(find.text('Exam Protection'), findsOneWidget);
      expect(find.text('Mathematics Quiz 1'), findsOneWidget);
      expect(
        find.textContaining('₹61 fee · ₹51 refund or ₹92 discount'),
        findsOneWidget,
      );
      final closed = tester.widget<OutlinedButton>(
        find.widgetWithText(OutlinedButton, 'Closed'),
      );
      expect(closed.onPressed, isNull);
      expect(
        find.widgetWithText(OutlinedButton, 'View Details'),
        findsOneWidget,
      );
      await tester.drag(find.byType(ListView).first, const Offset(0, -300));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'View Details'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Fee: ₹61 · Refund: ₹51 · Discount: ₹92'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'native claim form includes reason, attempt status, marks and optional message',
    (tester) async {
      await _mount(tester, _ProtectionApi());
      await tester.scrollUntilVisible(
        find.text('Start a protection claim'),
        500,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Start a protection claim'), findsOneWidget);
      expect(find.text('Why didn’t you pass?'), findsOneWidget);
      expect(find.text('Did you attempt the exam?'), findsOneWidget);
      expect(find.text('Marks obtained in this course'), findsOneWidget);
      expect(find.text('Anything else? (optional)'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('native API failures remain visible and can be retried', (
    tester,
  ) async {
    final api = _ProtectionApi()..fail = true;
    await _mount(tester, api);
    expect(find.text('Protection is temporarily unavailable.'), findsOneWidget);
    api.fail = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('Outcome A · Failed Quiz 1'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
