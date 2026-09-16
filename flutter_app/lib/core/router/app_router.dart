import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/academics/academics_page.dart';
import '../../features/academics/calendar_page.dart';
import '../../features/academics/free_courses_page.dart';
import '../../features/academics/free_materials_browse_page.dart';
import '../../features/academics/free_resources_page.dart';
import '../../features/academics/purchased_materials_page.dart';
import '../../features/announcements/announcements_page.dart';
import '../../features/auth/login_page.dart';
import '../../features/auth/welcome_page.dart';
import '../../features/community/community_chat_page.dart';
import '../../features/community/community_page.dart';
import '../../features/community/general_discussion_page.dart';
import '../../features/courses/course_detail_page.dart';
import '../../features/downloads/downloaded_notes_page.dart';
import '../../features/courses/courses_page.dart';
import '../../features/dashboard/dashboard_page.dart';
import '../../features/feedback/feedback_page.dart';
import '../../features/info/in_app_doc_page.dart';
import '../../features/info/no_internet_page.dart';
import '../../features/lecture/material_page.dart' as lecture_material;
import '../../features/lecture/watch_page.dart';
import '../../features/live/live_sessions_page.dart';
import '../../features/more/more_page.dart';
import '../../features/notifications/notifications_page.dart';
import '../../features/profile/profile_page.dart';
import '../../features/settings/notification_settings_page.dart';
import '../../features/settings/settings_page.dart';
import '../../features/support/faq_page.dart';
import '../../features/support/feature_requests_page.dart';
import '../../features/support/support_page.dart';
import '../../features/support/support_providers.dart';
import '../../features/support/ticket_detail_page.dart';
import '../../features/support/user_reports_page.dart';
import '../../features/transactions/transactions_page.dart';
import '../../shared/widgets/app_scaffold.dart';
import '../auth/auth_providers.dart';
import 'modal_observer.dart';
import 'nav_history_observer.dart';

CustomTransitionPage<void> _buildSmoothPage({
  required LocalKey key,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: key,
    child: child,
    transitionDuration: const Duration(milliseconds: 280),
    reverseTransitionDuration: const Duration(milliseconds: 220),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curvedAnimation = CurvedAnimation(
        parent: animation,
        curve: Curves.fastOutSlowIn,
        reverseCurve: Curves.easeInCubic,
      );
      final curvedSecondary = CurvedAnimation(
        parent: secondaryAnimation,
        curve: Curves.fastOutSlowIn,
        reverseCurve: Curves.easeInCubic,
      );

      final slideIn = Tween<Offset>(
        begin: const Offset(0.20, 0),
        end: Offset.zero,
      ).animate(curvedAnimation);

      final slideOut = Tween<Offset>(
        begin: Offset.zero,
        end: const Offset(-0.08, 0),
      ).animate(curvedSecondary);

      final fadeIn =
          Tween<double>(begin: 0.0, end: 1.0).animate(curvedAnimation);
      final fadeOut =
          Tween<double>(begin: 1.0, end: 0.85).animate(curvedSecondary);

      return SlideTransition(
        position: slideIn,
        child: FadeTransition(
          opacity: fadeIn,
          child: SlideTransition(
            position: slideOut,
            child: FadeTransition(
              opacity: fadeOut,
              child: child,
            ),
          ),
        ),
      );
    },
  );
}

CustomTransitionPage<void> _buildSlideUpPage({
  required LocalKey key,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: key,
    child: child,
    transitionDuration: const Duration(milliseconds: 300),
    reverseTransitionDuration: const Duration(milliseconds: 240),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.fastOutSlowIn,
        reverseCurve: Curves.easeInCubic,
      );
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.20),
          end: Offset.zero,
        ).animate(curved),
        child: FadeTransition(
          opacity: curved,
          child: child,
        ),
      );
    },
  );
}

final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'rootNav');
final shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shellNav');

final savedLocationProvider = Provider<String?>((ref) => null);

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefreshListenable(ref);
  ref.onDispose(refresh.dispose);

  final savedLoc = ref.read(savedLocationProvider);
  final initialLoc =
      (savedLoc != null && savedLoc.isNotEmpty) ? savedLoc : '/dashboard';

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    observers: [rootModalObserver, AppNavHistoryObserver.instance],
    initialLocation: initialLoc,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authStateProvider);
      final welcomeSeen = ref.read(welcomeSeenProvider);
      final isSignedIn = auth.value != null;
      final loc = state.matchedLocation;

      const publicPaths = {
        '/login',
        '/welcome',
        '/terms-and-conditions',
        '/terms',
        '/privacy-policy',
        '/refund-policy',
        '/copyright-policy',
        '/copyright',
        '/about-us',
        '/contact-us',
        '/courses',
        '/offline',
      };
      final isPublic = publicPaths.contains(loc) || loc.startsWith('/company/');

      if (isSignedIn) {
        if ((loc == '/support' || loc.startsWith('/support/')) &&
            !canAccessSupport(auth.value?.role)) return '/dashboard';
        // Signed in but landed on a sign-in surface → push to saved location or dashboard.
        if (loc == '/login' || loc == '/welcome') {
          final saved = ref.read(savedLocationProvider);
          if (saved != null &&
              saved.isNotEmpty &&
              saved != '/dashboard' &&
              saved != '/login' &&
              saved != '/welcome') {
            return saved;
          }
          return '/dashboard';
        }
        return null;
      }

      // Unauthenticated users:
      if (isPublic) {
        if (loc == '/welcome' && welcomeSeen) {
          return '/login';
        }
        return null; // Permit public browsing
      }

      // Private routes require sign-in
      return welcomeSeen ? '/login' : '/welcome';
    },
    routes: [
      GoRoute(
        path: '/welcome',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const WelcomePage(),
        ),
      ),
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const LoginPage(),
        ),
      ),
      // Fullscreen video — no bottom nav, hence not inside the ShellRoute.
      GoRoute(
        path: '/watch',
        pageBuilder: (context, state) => _buildSlideUpPage(
          key: state.pageKey,
          child: WatchPage.fromQuery(state.uri.queryParameters) ??
              const MissingVideoPage(),
        ),
      ),
      // Fullscreen PDF / material viewer.
      GoRoute(
        path: '/material',
        pageBuilder: (context, state) => _buildSlideUpPage(
          key: state.pageKey,
          child: lecture_material.MaterialPage.fromQuery(
                  state.uri.queryParameters) ??
              const _MissingMaterialPage(),
        ),
      ),
      // Standalone pages launched from inside Profile / the academics hub.
      // They have their own Scaffold + AppBar so they live outside the
      // bottom-nav shell.
      GoRoute(
        path: '/profile',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const ProfilePage(),
        ),
      ),
      GoRoute(
        path: '/downloads',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const DownloadedNotesPage(),
        ),
      ),
      GoRoute(
        path: '/downloaded-notes',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const DownloadedNotesPage(),
        ),
      ),
      GoRoute(
        path: '/transactions',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const TransactionsPage(),
        ),
      ),
      GoRoute(
        path: '/faq',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const FaqPage(),
        ),
      ),
      GoRoute(
        path: '/notifications',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const NotificationsPage(),
        ),
      ),
      GoRoute(
        path: '/settings/notifications',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const NotificationSettingsPage(),
        ),
      ),
      GoRoute(
        path: '/settings',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const SettingsPage(),
        ),
      ),
      GoRoute(
        path: '/about-us',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const InAppDocPage(docType: DocType.aboutUs),
        ),
      ),
      GoRoute(
        path: '/privacy-policy',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const InAppDocPage(docType: DocType.privacyPolicy),
        ),
      ),
      GoRoute(
        path: '/refund-policy',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const InAppDocPage(docType: DocType.refundPolicy),
        ),
      ),
      GoRoute(
        path: '/terms-and-conditions',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const InAppDocPage(docType: DocType.termsAndConditions),
        ),
      ),
      GoRoute(
        path: '/terms',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const InAppDocPage(docType: DocType.termsAndConditions),
        ),
      ),
      GoRoute(
        path: '/copyright-policy',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const InAppDocPage(docType: DocType.copyrightPolicy),
        ),
      ),
      GoRoute(
        path: '/copyright',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const InAppDocPage(docType: DocType.copyrightPolicy),
        ),
      ),
      GoRoute(
        path: '/contact-us',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const InAppDocPage(docType: DocType.contactUs),
        ),
      ),
      GoRoute(
        path: '/company/:slug',
        pageBuilder: (context, state) {
          final slug = state.pathParameters['slug'] ?? '';
          DocType type;
          if (slug == 'privacy-policy') {
            type = DocType.privacyPolicy;
          } else if (slug == 'refund-policy' || slug == 'return-policy') {
            type = DocType.refundPolicy;
          } else if (slug == 'copyright-policy' || slug == 'copyright') {
            type = DocType.copyrightPolicy;
          } else if (slug == 'terms-and-conditions' || slug == 'terms') {
            type = DocType.termsAndConditions;
          } else if (slug == 'contact-us') {
            type = DocType.contactUs;
          } else {
            type = DocType.aboutUs;
          }
          return _buildSmoothPage(
            key: state.pageKey,
            child: InAppDocPage(docType: type),
          );
        },
      ),
      GoRoute(
        path: '/courses/:id',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: CourseDetailPage(
            courseId: state.pathParameters['id']!,
          ),
        ),
      ),
      GoRoute(
        path: '/offline',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const NoInternetPage(),
        ),
      ),
      // ── Full-Screen Sub-Pages (Render on root navigator without bottom nav) ──
      GoRoute(
        path: '/store',
        redirect: (context, state) => '/dashboard',
      ),
      GoRoute(
        path: '/store/courses',
        redirect: (context, state) => '/dashboard',
      ),
      GoRoute(
        path: '/store/courses/:id',
        redirect: (context, state) => '/dashboard',
      ),
      GoRoute(
        path: '/calendar',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const CalendarPage(),
        ),
      ),
      GoRoute(
        path: '/free-resources',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const FreeResourcesPage(),
        ),
        routes: [
          GoRoute(
            path: 'courses',
            pageBuilder: (context, state) => _buildSmoothPage(
              key: state.pageKey,
              child: const FreeCoursesPage(),
            ),
          ),
          GoRoute(
            path: 'materials',
            pageBuilder: (context, state) => _buildSmoothPage(
              key: state.pageKey,
              child: const FreeMaterialsBrowsePage(),
            ),
          ),
          GoRoute(
            path: 'purchased',
            pageBuilder: (context, state) => _buildSmoothPage(
              key: state.pageKey,
              child: const PurchasedMaterialsPage(),
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/announcements',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const AnnouncementsPage(),
        ),
      ),
      GoRoute(
        path: '/feedback',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const FeedbackPage(),
        ),
      ),
      GoRoute(
        path: '/live',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const LiveSessionsPage(),
        ),
      ),
      GoRoute(
        path: '/support',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const SupportPage(),
        ),
      ),
      GoRoute(
        path: '/support/tickets/:id',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: TicketDetailPage(ticketId: state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path: '/support/feature-requests',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const FeatureRequestsPage(),
        ),
      ),
      GoRoute(
        path: '/support/user-reports',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: const UserReportsPage(),
        ),
      ),
      GoRoute(
        path: '/community/general-discussion',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: GeneralDiscussionPage(
            initialAction: state.uri.queryParameters['action'],
          ),
        ),
      ),
      GoRoute(
        path: '/community/:courseId',
        pageBuilder: (context, state) => _buildSmoothPage(
          key: state.pageKey,
          child: CommunityChatPage(
            courseId: state.pathParameters['courseId']!,
          ),
        ),
      ),

      // ── Main Tab Shell (Bottom navigation ONLY on primary root tabs) ──
      ShellRoute(
        navigatorKey: shellNavigatorKey,
        builder: (context, state, child) => AppScaffold(
          currentLocation: state.matchedLocation,
          child: child,
        ),
        routes: [
          GoRoute(
            path: '/dashboard',
            pageBuilder: (context, state) => NoTransitionPage(
              key: state.pageKey,
              child: const DashboardPage(),
            ),
          ),
          GoRoute(
            path: '/courses',
            pageBuilder: (context, state) => NoTransitionPage(
              key: state.pageKey,
              child: const CoursesPage(),
            ),
          ),
          GoRoute(
            path: '/academics',
            pageBuilder: (context, state) => NoTransitionPage(
              key: state.pageKey,
              child: const AcademicsPage(),
            ),
          ),
          GoRoute(
            path: '/community',
            pageBuilder: (context, state) => NoTransitionPage(
              key: state.pageKey,
              child: const CommunityPage(),
            ),
          ),
          GoRoute(
            path: '/more',
            pageBuilder: (context, state) => NoTransitionPage(
              key: state.pageKey,
              child: const MorePage(),
            ),
          ),
        ],
      ),
    ],
  );
});

/// Fallback for `/material` when the route is hit without a usable contentId.
class _MissingMaterialPage extends StatelessWidget {
  const _MissingMaterialPage();
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Missing material reference.',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}

/// Refreshes redirects without rebuilding GoRouter. Recreating the router while
/// its global navigator keys are mounted causes Flutter's key-reservation
/// assertion during navigation.
class _RouterRefreshListenable extends ChangeNotifier {
  _RouterRefreshListenable(Ref ref) {
    _authSub = ref.listen(authStateProvider, (_, __) => notifyListeners());
    _welcomeSub = ref.listen(welcomeSeenProvider, (_, __) => notifyListeners());
  }
  late final ProviderSubscription _authSub;
  late final ProviderSubscription _welcomeSub;

  @override
  void dispose() {
    _authSub.close();
    _welcomeSub.close();
    super.dispose();
  }
}
