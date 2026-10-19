import 'dart:async';

import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teaching_llm/config/api_config.dart';
import 'package:teaching_llm/core/api/api_client.dart';
import 'package:teaching_llm/core/auth/auth_providers.dart';
import 'package:teaching_llm/core/router/app_router.dart';
import 'package:teaching_llm/core/router/modal_observer.dart';
import 'package:teaching_llm/features/prompts/admin_message_session.dart';
import 'package:teaching_llm/features/prompts/admin_messages_host.dart';
import 'package:teaching_llm/features/prompts/dynamic_prompt_dialog.dart';
import 'package:teaching_llm/features/updates/update_dialog.dart';
import 'package:teaching_llm/features/updates/update_rich_text.dart';
import 'package:teaching_llm/shared/utils/admin_content_url.dart';
import 'package:teaching_llm/shared/utils/cta_navigation.dart';

Map<String, dynamic> _update(String id, {int delay = 0}) => {
      'id': id,
      'title': 'Update $id',
      'content': '<b>News</b> &amp; information',
      'showDelay': delay,
    };

class _Api extends ApiClient {
  final updates = <Map<String, dynamic>>[];
  final prompts = <Map<String, dynamic>>[];
  final requests = <String>[];
  final bodies = <Object?>[];
  bool failSave = false;
  Completer<void>? saveGate;

  @override
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? query}) async {
    requests.add(path);
    final data = path == '/api/prompts/active'
        ? {'prompt': prompts.isEmpty ? null : prompts.first}
        : {'updates': updates};
    return Response<T>(
        requestOptions: RequestOptions(path: path), data: data as T);
  }

  @override
  Future<Response<T>> post<T>(String path, {Object? body}) async {
    requests.add(path);
    bodies.add(body);
    if (path == '/api/promo-splash/claim') {
      return Response<T>(
          requestOptions: RequestOptions(path: path),
          data: {'eligible': false} as T);
    }
    await saveGate?.future;
    if (failSave) throw StateError('Offline');
    if (path == '/api/prompts/respond') prompts.removeAt(0);
    return Response<T>(requestOptions: RequestOptions(path: path));
  }
}

Future<({ProviderContainer container, GoRouter router})> _mount(
    WidgetTester tester, _Api api, AdminMessageSession session,
    {bool enabled = true, AdminMessageSession Function()? sessionFactory}) async {
  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    observers: [rootModalObserver],
    initialLocation: '/dashboard',
    routes: [
      for (final path in [
        '/dashboard',
        '/courses',
        '/watch',
        '/free-resources/courses'
      ])
        GoRoute(
            path: path, builder: (_, __) => Scaffold(body: Text('Page $path'))),
    ],
  );
  final container = ProviderContainer(overrides: [
    apiClientProvider.overrideWithValue(api),
    routerProvider.overrideWithValue(router),
    adminMessageSessionProvider.overrideWith((_) => sessionFactory?.call() ?? session),
  ]);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    child: MaterialApp.router(
        routerConfig: router,
        builder: (_, child) =>
            AdminMessagesHost(enabled: enabled, child: child!)),
  ));
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    router.dispose();
    container.dispose();
  });
  await tester.pumpAndSettle();
  return (container: container, router: router);
}

void main() {
  test('relative images and native/web-only CTA links resolve correctly', () {
    expect(resolveAdminContentUrl('/uploads/banner.png').toString(),
        '${ApiConfig.baseUrl}/uploads/banner.png');
    expect(resolveAdminContentUrl('javascript:alert(1)'), isNull);
    expect(
        nativeCtaRoute('/free-resources/courses'), '/free-resources/courses');
    expect(nativeCtaRoute('${ApiConfig.baseUrl}/courses/math?tab=notes'),
        '/courses/math?tab=notes');
    expect(nativeCtaRoute('/menu'), '/more');
    expect(nativeCtaRoute('/store/notes'), isNull);
    expect(nativeCtaRoute('https://example.com/courses/math'), isNull);
  });

  testWidgets(
      'does not fetch messages before setup or while launch splash shows',
      (tester) async {
    final api = _Api()..updates.add(_update('one'));
    final session = AdminMessageSession('student');
    await _mount(tester, api, session, enabled: false);
    session.markReady();
    await tester.pumpAndSettle();
    expect(api.requests, isEmpty);
    expect(find.byType(UpdateDialog), findsNothing);
  });

  testWidgets(
      'respects server order, saves dismissal and avoids replay on navigation',
      (tester) async {
    final api = _Api()..updates.addAll([_update('first'), _update('second')]);
    final session = AdminMessageSession('student')..markReady();
    final harness = await _mount(tester, api, session);
    expect(find.text('Update first'), findsOneWidget);
    expect(find.text('Update second'), findsNothing);
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    expect(api.requests, contains('/api/updates/first/dismiss'));
    expect(find.text('Update second'), findsOneWidget);
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    session.lastMessageCheck = null;
    harness.router.go('/courses');
    await tester.pumpAndSettle();
    expect(find.byType(UpdateDialog), findsNothing);
    expect(session.dismissedUpdates, {'first', 'second'});
  });

  testWidgets('unsaved dismissal is retryable and is not marked viewed locally',
      (tester) async {
    final api = _Api()
      ..updates.add(_update('one'))
      ..failSave = true;
    final session = AdminMessageSession('student')..markReady();
    await _mount(tester, api, session);
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Could not save.'), findsOneWidget);
    expect(session.dismissedUpdates, isEmpty);
    api.failSave = false;
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    expect(session.dismissedUpdates, {'one'});
  });

  testWidgets('CTA opens its native route only after dismissal is saved',
      (tester) async {
    final api = _Api()
      ..updates.add({
        ..._update('one'),
        'ctaText': 'Browse free courses',
        'ctaLink': '/free-resources/courses'
      })
      ..saveGate = Completer<void>();
    final session = AdminMessageSession('student')..markReady();
    final harness = await _mount(tester, api, session);
    await tester.tap(find.text('Browse free courses'));
    await tester.pump();
    expect(
        harness.router.routeInformationProvider.value.uri.path, '/dashboard');
    api.saveGate!.complete();
    await tester.pumpAndSettle();
    expect(harness.router.routeInformationProvider.value.uri.path,
        '/free-resources/courses');
  });

  testWidgets(
      'prompts validate answers, resist Back, and finish before updates',
      (tester) async {
    final api = _Api()
      ..prompts.add({
        'id': 'survey',
        'title': 'Quick survey',
        'questions': [
          {'id': 'q1', 'type': 'YES_NO', 'text': 'Was this useful?'}
        ]
      })
      ..updates.add(_update('one'));
    final session = AdminMessageSession('student')..markReady();
    await _mount(tester, api, session);
    expect(find.byType(DynamicPromptDialog), findsOneWidget);
    expect(find.byType(UpdateDialog), findsNothing);
    await rootNavigatorKey.currentState!.maybePop();
    await tester.pumpAndSettle();
    expect(find.byType(DynamicPromptDialog), findsOneWidget);
    await tester.ensureVisible(find.text('Submit & Continue'));
    await tester.tap(find.text('Submit & Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Please answer all questions before continuing.'),
        findsOneWidget);
    await tester.ensureVisible(find.text('Yes'));
    await tester.tap(find.text('Yes'));
    await tester.ensureVisible(find.text('Submit & Continue'));
    await tester.tap(find.text('Submit & Continue'));
    await tester.pumpAndSettle();
    expect(
        api.bodies,
        contains(equals({
          'promptId': 'survey',
          'answers': {'q1': 'Yes'}
        })));
    expect(find.text('Update one'), findsOneWidget);
  });

  testWidgets('waits for other dialogs and skips lesson playback',
      (tester) async {
    final api = _Api()..updates.add(_update('one'));
    final session = AdminMessageSession('student');
    final harness = await _mount(tester, api, session);
    unawaited(showDialog<void>(
        context: rootNavigatorKey.currentContext!,
        builder: (_) => const AlertDialog(title: Text('Existing form'))));
    session.markReady();
    await tester.pumpAndSettle();
    expect(api.requests, isEmpty);
    harness.router.go('/watch');
    rootNavigatorKey.currentState!.pop();
    await tester.pumpAndSettle();
    expect(api.requests, isEmpty);
    harness.router.go('/dashboard');
    await tester.pumpAndSettle();
    expect(find.text('Update one'), findsOneWidget);
  });

  testWidgets('session invalidation cancels an open message', (tester) async {
    final api = _Api()..updates.add(_update('one'));
    var session = AdminMessageSession('student')..markReady();
    final harness = await _mount(tester, api, session,
        sessionFactory: () => session);
    expect(find.text('Update one'), findsOneWidget);
    // Overrides return a new, not-yet-ready session just like an account change.
    session = AdminMessageSession('other');
    harness.container.invalidate(adminMessageSessionProvider);
    await tester.pumpAndSettle();
    expect(find.byType(UpdateDialog), findsNothing);
    expect(api.requests.where((path) => path.endsWith('/dismiss')), isEmpty);
  });

  testWidgets('rich text decodes entities, keeps emphasis, and drops scripts',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: UpdateRichText(
      content:
          '<b>News</b> &amp; info<ul><li>First</li></ul><script>bad()</script>',
      onLink: (_) {},
    ))));
    final span = tester.widget<Text>(find.byType(Text)).textSpan!;
    expect(span.toPlainText(), contains('News & info'));
    expect(span.toPlainText(), contains('• First'));
    expect(span.toPlainText(), isNot(contains('bad()')));
  });
}
