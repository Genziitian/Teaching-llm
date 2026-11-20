import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teaching_llm/core/api/api_client.dart';
import 'package:teaching_llm/core/auth/auth_providers.dart';
import 'package:teaching_llm/core/models/user.dart';
import 'package:teaching_llm/core/router/app_link_location.dart';
import 'package:teaching_llm/core/router/app_router.dart';
import 'package:teaching_llm/features/auth/welcome_page.dart';
import 'package:teaching_llm/features/lecture/linked_lecture_page.dart';

class _Auth extends AuthState {
  @override
  Future<User?> build() async => null;

  void authenticate(User user) => state = AsyncData(user);
}

const _user = User(
  id: 'student',
  name: 'Student',
  email: 'student@example.com',
  role: 'STUDENT',
  isIdentityUpdated: true,
  isProfileComplete: true,
);

class _Api extends ApiClient {
  bool denied = false;
  bool locked = false;
  Map<String, dynamic>? lastQuery;

  @override
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? query}) async {
    Object data = [];
    if (path.startsWith('/api/content/')) {
      lastQuery = query;
      if (denied) {
        throw DioException(
          requestOptions: RequestOptions(path: path),
          response: Response(
              requestOptions: RequestOptions(path: path), statusCode: 403),
        );
      }
      data = {'id': 'lecture1', 'title': 'Lecture', 'isDemoLocked': locked};
    } else if (path == '/api/courses/course1') {
      data = {'id': 'course1', 'name': 'Course', '_count': <String, dynamic>{}};
    }
    return Response<T>(
        requestOptions: RequestOptions(path: path), data: data as T);
  }
}

void main() {
  test('existing route patterns remain case insensitive', () {
    final container = ProviderContainer(overrides: [
      authStateProvider.overrideWith(_Auth.new),
      welcomeSeenProvider.overrideWith((_) => true),
    ]);
    final router = container.read(routerProvider);
    addTearDown(router.dispose);
    addTearDown(container.dispose);
    expect(router.configuration.findMatch(Uri.parse('/COURSES/course1')).isError,
        isFalse);
  });

  test('home banner destinations resolve to native routes', () {
    final container = ProviderContainer(overrides: [
      authStateProvider.overrideWith(_Auth.new),
      welcomeSeenProvider.overrideWith((_) => true),
    ]);
    final router = container.read(routerProvider);
    addTearDown(router.dispose);
    addTearDown(container.dispose);
    for (final path in [
      '/academics',
      '/free-resources',
      '/store/notes',
      '/community',
    ]) {
      expect(router.configuration.findMatch(Uri.parse(path)).isError, isFalse,
          reason: path);
    }
  });

  test(
      'website root, store, course catalog and material links resolve natively',
      () {
    expect(appLinkLocation(Uri.parse('https://class.genziitian.in/')),
        '/dashboard');
    expect(appLinkLocation(Uri.parse('https://class.genziitian.in')),
        '/dashboard');
    expect(appLinkLocation(Uri.parse('/store/courses/course1')),
        '/store/courses/course1');
    expect(appLinkLocation(Uri.parse('/courses/explore')), '/courses');
    final material =
        Uri.parse(appLinkLocation(Uri.parse('/material/pdf1/view')));
    expect(material.path, '/material');
    expect(material.queryParameters,
        {'contentId': 'pdf1', 'contentType': 'CONTENT'});
    final free = Uri.parse(
        appLinkLocation(Uri.parse('/free-resources/materials/pdf2/view')));
    expect(
        free.queryParameters, {'contentId': 'pdf2', 'contentType': 'MATERIAL'});
  });

  test(
      'website login preserves a local destination but does not follow external next URLs',
      () {
    expect(
        appLinkLocation(
            Uri.parse('/login?next=%2Fcourses%2Fcourse1%3Ftab%3Dnotes')),
        '/courses/course1?tab=notes');
    expect(
        Uri.parse(appLinkLocation(Uri.parse('/login?next=https://evil.test/')))
            .path,
        '/login');
    expect(
        Uri.parse(appLinkLocation(Uri.parse('/login?next=//evil.test/'))).path,
        '/login');
    expect(
        Uri.parse(appLinkLocation(Uri.parse(
                'https://class.genziitian.in/watch?localPath=/private/file&id=x')))
            .queryParameters
            .containsKey('localPath'),
        isFalse);
  });

  testWidgets(
      'shared destination survives welcome, login and mandatory profile setup',
      (tester) async {
    tester.view.physicalSize = const Size(430, 932);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final container = ProviderContainer(overrides: [
      authStateProvider.overrideWith(_Auth.new),
      apiClientProvider.overrideWithValue(_Api()),
    ]);
    await container.read(authStateProvider.future);
    final router = container.read(routerProvider);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    router.go('/courses/course1?tab=notes');
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path, '/welcome');

    container.read(welcomeSeenProvider.notifier).state = true;
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path, '/login');

    (container.read(authStateProvider.notifier) as _Auth)
        .authenticate(_user.copyWith(isProfileComplete: false));
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path, '/profile-setup');
    (container.read(authStateProvider.notifier) as _Auth)
        .authenticate(_user.copyWith(isIdentityUpdated: false));
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path, '/identity-setup');
    (container.read(authStateProvider.notifier) as _Auth).authenticate(_user);
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.toString(),
        '/courses/course1?tab=notes');

    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose();
    container.dispose();
  });

  testWidgets('cold and warm platform lecture links mount only one destination',
      (tester) async {
    tester.binding.platformDispatcher.defaultRouteNameTestValue =
        'https://class.genziitian.in/courses/course1/lectures/lecture1/play?courseId=shared1';
    addTearDown(
        tester.binding.platformDispatcher.clearDefaultRouteNameTestValue);
    final api = _Api()..locked = true;
    final container = ProviderContainer(overrides: [
      authStateProvider.overrideWith(_Auth.new),
      apiClientProvider.overrideWithValue(api),
    ]);
    await container.read(authStateProvider.future);
    (container.read(authStateProvider.notifier) as _Auth).authenticate(_user);
    final router = container.read(routerProvider);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path,
        '/courses/course1/lectures/lecture1/play');
    expect(find.byType(LinkedLecturePage), findsOneWidget);
    expect(api.lastQuery, {'courseId': 'shared1'});
    expect(
        tester
            .widget<LinkedLecturePage>(find.byType(LinkedLecturePage))
            .preferDrive,
        isTrue);

    await tester.binding.handlePushRoute(
        'https://class.genziitian.in/courses/course1/lectures/lecture2');
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path,
        '/courses/course1/lectures/lecture2');
    expect(find.byType(LinkedLecturePage), findsOneWidget);
    expect(
        tester
            .widget<LinkedLecturePage>(find.byType(LinkedLecturePage))
            .contentId,
        'lecture2');
    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose();
    container.dispose();
  });

  testWidgets(
      'lecture link uses the enrollment API, shows denied access, and retries',
      (tester) async {
    final api = _Api()..denied = true;
    final container = ProviderContainer(
        overrides: [apiClientProvider.overrideWithValue(api)]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(
          home: LinkedLecturePage(contentId: 'lecture1', courseId: 'shared1')),
    ));
    await tester.pumpAndSettle();
    expect(
        find.text('You do not have access to this lecture.'), findsOneWidget);
    expect(api.lastQuery, {'courseId': 'shared1'});
    api
      ..denied = false
      ..locked = true;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(
        find.text('This lecture requires full course access.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    container.dispose();
  });
}
