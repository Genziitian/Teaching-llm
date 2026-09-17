import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teaching_llm/core/api/api_client.dart';
import 'package:teaching_llm/core/auth/auth_providers.dart';
import 'package:teaching_llm/core/models/user.dart';
import 'package:teaching_llm/core/router/app_router.dart';
import 'package:teaching_llm/features/academics/free_courses_page.dart';
import 'package:teaching_llm/features/academics/free_resources_page.dart';

class _SignedIn extends AuthState {
  @override
  Future<User?> build() async => const User(
        id: 'student',
        name: 'Student',
        email: 'student@example.com',
        role: 'STUDENT',
      );
}

class _FreeCoursesApi extends ApiClient {
  List<dynamic> courses = [
    {
      'id': 'free-maths',
      'name': 'Free Mathematics',
      'isEnrolled': false,
      '_count': {'topics': 3, 'lectures': 5, 'materials': 2},
    },
  ];
  bool failListing = false;
  bool failEnrollment = false;
  Completer<void>? listingGate;
  Completer<void>? enrollmentGate;
  final posts = <Object?>[];

  @override
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? query}) async {
    if (path == '/api/free-resources/courses') {
      await listingGate?.future;
      if (failListing) throw Exception('Offline');
    }
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: (path == '/api/free-resources/courses' ? courses : []) as T,
    );
  }

  @override
  Future<Response<T>> post<T>(String path, {Object? body}) async {
    expect(path, '/api/free-resources/enroll');
    posts.add(body);
    await enrollmentGate?.future;
    if (failEnrollment) {
      throw DioException(
        requestOptions: RequestOptions(path: path),
        response: Response(
          requestOptions: RequestOptions(path: path),
          statusCode: 403,
          data: {'error': 'This course is currently disabled'},
        ),
      );
    }
    courses = [
      for (final course in courses)
        <String, dynamic>{...course as Map<String, dynamic>, 'isEnrolled': true},
    ];
    return Response<T>(requestOptions: RequestOptions(path: path));
  }
}

Future<void> _showPage(WidgetTester tester, _FreeCoursesApi api) async {
  final router = GoRouter(
    initialLocation: '/free-resources/courses',
    routes: [
      GoRoute(
        path: '/free-resources/courses',
        builder: (_, __) => const FreeCoursesPage(),
      ),
      GoRoute(
        path: '/courses/:id',
        builder: (_, state) => Scaffold(
          body: Text('Opened ${state.pathParameters['id']}'),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(ProviderScope(
    overrides: [apiClientProvider.overrideWithValue(api)],
    child: MaterialApp.router(routerConfig: router),
  ));
  await tester.pump();
}

void main() {
  testWidgets(
      'Free Courses card uses the real route and Back returns to resources',
      (tester) async {
    final container = ProviderContainer(overrides: [
      apiClientProvider.overrideWithValue(_FreeCoursesApi()),
      authStateProvider.overrideWith(_SignedIn.new),
    ]);
    addTearDown(container.dispose);
    await container.read(authStateProvider.future);
    final router = container.read(routerProvider);
    addTearDown(router.dispose);
    router.go('/free-resources');
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Free Courses'));
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path,
        '/free-resources/courses');
    expect(find.text('Free Mathematics'), findsOneWidget);
    expect(find.text('Enroll for Free'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.chevron_left));
    await tester.pumpAndSettle();
    expect(find.byType(FreeResourcesPage), findsOneWidget);
    expect(router.routeInformationProvider.value.uri.path, '/free-resources');
  });

  testWidgets('loading resolves to an explicit empty state', (tester) async {
    final api = _FreeCoursesApi()
      ..courses = []
      ..listingGate = Completer<void>();
    await _showPage(tester, api);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    api.listingGate!.complete();
    await tester.pumpAndSettle();
    expect(
        find.text('No free courses available at the moment.'), findsOneWidget);
  });

  testWidgets('failed listing can be retried', (tester) async {
    final api = _FreeCoursesApi()..failListing = true;
    await _showPage(tester, api);
    await tester.pumpAndSettle();
    expect(find.text('Could not load free courses.'), findsOneWidget);
    api.failListing = false;
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Free Mathematics'), findsOneWidget);
  });

  testWidgets('enrollment waits for the server then enables opening the course',
      (tester) async {
    final api = _FreeCoursesApi()..enrollmentGate = Completer<void>();
    await _showPage(tester, api);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enroll for Free'));
    await tester.pump();
    expect(api.posts, [
      {'courseId': 'free-maths'}
    ]);
    expect(find.text('Open Course'), findsNothing);
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull);
    api.enrollmentGate!.complete();
    await tester.pumpAndSettle();
    expect(find.text('FREE · ENROLLED'), findsOneWidget);
    await tester.tap(find.text('Open Course'));
    await tester.pumpAndSettle();
    expect(find.text('Opened free-maths'), findsOneWidget);
  });

  testWidgets('rejected enrollment shows the server error and stays unenrolled',
      (tester) async {
    final api = _FreeCoursesApi()..failEnrollment = true;
    await _showPage(tester, api);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enroll for Free'));
    await tester.pumpAndSettle();
    expect(find.text('This course is currently disabled'), findsOneWidget);
    expect(find.text('Enroll for Free'), findsOneWidget);
    expect(find.text('Open Course'), findsNothing);
  });

  testWidgets(
      'Back button on FreeResourcesPage navigates to /dashboard when stack is empty',
      (tester) async {
    final container = ProviderContainer(overrides: [
      apiClientProvider.overrideWithValue(_FreeCoursesApi()),
      authStateProvider.overrideWith(_SignedIn.new),
    ]);
    addTearDown(container.dispose);
    await container.read(authStateProvider.future);
    final router = container.read(routerProvider);
    addTearDown(router.dispose);
    router.go('/free-resources');
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pumpAndSettle();
    expect(find.byType(FreeResourcesPage), findsOneWidget);
    await tester.tap(find.byIcon(Icons.chevron_left));
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path, '/dashboard');
  });
}
