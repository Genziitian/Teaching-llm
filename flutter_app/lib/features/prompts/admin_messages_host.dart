import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/router/modal_observer.dart';
import '../../shared/utils/admin_content_url.dart';
import '../../shared/utils/cta_navigation.dart';
import '../updates/update_dialog.dart';
import 'admin_message_session.dart';
import 'dynamic_prompt_dialog.dart';

/// Serializes admin messages after setup. Refreshes on navigation/app resume;
/// no polling or interruption while watching lessons or chatting.
class AdminMessagesHost extends ConsumerStatefulWidget {
  const AdminMessagesHost(
      {super.key, required this.enabled, required this.child});
  final bool enabled;
  final Widget child;
  @override
  ConsumerState<AdminMessagesHost> createState() => _AdminMessagesHostState();
}

class _AdminMessagesHostState extends ConsumerState<AdminMessagesHost>
    with WidgetsBindingObserver {
  GoRouter? _router;
  AdminMessageSession? _runningSession;
  Route<dynamic>? _activeRoute;
  final _disposed = Completer<void>();
  bool _scheduled = false;
  bool _foreground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    rootModalObserver.changes.addListener(_schedule);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) _schedule();
  }

  void _schedule() {
    if (!mounted || _scheduled) return;
    _scheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scheduled = false;
      if (mounted) unawaited(_check());
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  String get _page => _router?.routeInformationProvider.value.uri.path ?? '';

  bool _current(AdminMessageSession session) =>
      mounted &&
      !session.cancelled.isCompleted &&
      identical(session, ref.read(adminMessageSessionProvider));

  bool _canShow(AdminMessageSession session) =>
      _current(session) &&
      widget.enabled &&
      _foreground &&
      session.ready &&
      session.userId != null &&
      rootNavigatorKey.currentState != null &&
      !rootModalObserver.hasPopup &&
      !const {'/watch', '/material', '/login', '/welcome', '/offline'}
          .contains(_page) &&
      !_page.startsWith('/community/');

  Future<T?> _show<T>(AdminMessageSession session, Widget child,
      {Duration? duration}) async {
    if (!_canShow(session)) return null;
    final navigator = rootNavigatorKey.currentState!;
    final route = DialogRoute<T>(
      context: navigator.context,
      barrierDismissible: false,
      builder: (_) => child,
    );
    _activeRoute = route;
    Timer? timer;
    final expired = Completer<T?>();
    if (duration != null) timer = Timer(duration, () => expired.complete(null));
    try {
      final result = await Future.any([
        navigator.push<T>(route),
        session.cancelled.future.then<T?>((_) => null),
        _disposed.future.then<T?>((_) => null),
        if (duration != null) expired.future,
      ]);
      if (route.isActive) route.navigator?.removeRoute(route);
      await Future.any<void>([
        route.completed.then((_) {}),
        session.cancelled.future,
        _disposed.future,
      ]);
      return result;
    } finally {
      timer?.cancel();
      if (route.isActive) route.navigator?.removeRoute(route);
      if (identical(_activeRoute, route)) _activeRoute = null;
    }
  }

  Future<void> _wait(AdminMessageSession session, Duration duration) async {
    final elapsed = Completer<void>();
    final timer = Timer(duration, elapsed.complete);
    try {
      await Future.any(
          [elapsed.future, session.cancelled.future, _disposed.future]);
    } finally {
      timer.cancel();
    }
  }

  Future<void> _check() async {
    final session = ref.read(adminMessageSessionProvider);
    if (identical(_runningSession, session) || !_canShow(session)) return;
    _runningSession = session;
    final api = ref.read(apiClientProvider);
    final page = _page;
    try {
      // Promo claims are page-specific; the API enforces version and frequency.
      final lastPromo = session.promoChecks[page];
      if (lastPromo == null ||
          DateTime.now().difference(lastPromo) >= const Duration(minutes: 1)) {
        session.promoChecks[page] = DateTime.now();
        try {
          final response = await api.post<Map<String, dynamic>>(
              '/api/promo-splash/claim',
              body: {'page': page});
          final promo = response.data;
          if (_canShow(session) &&
              _page == page &&
              promo?['eligible'] == true) {
            final url = resolveAdminContentUrl(promo?['image']?.toString());
            if (url != null) {
              var loaded = true;
              final image = NetworkImage(url.toString());
              await precacheImage(image, rootNavigatorKey.currentContext!,
                      onError: (_, __) => loaded = false)
                  .timeout(const Duration(seconds: 12));
              if (loaded && _canShow(session) && _page == page) {
                final milliseconds =
                    int.tryParse(promo?['durationMs']?.toString() ?? '') ??
                        2500;
                await _show<void>(
                    session,
                    PopScope(
                        canPop: false,
                        child: Dialog.fullscreen(
                            backgroundColor: Colors.white,
                            child: SafeArea(
                                child:
                                    Image(image: image, fit: BoxFit.contain)))),
                    duration: Duration(
                        milliseconds: milliseconds.clamp(1000, 10000)));
              }
            }
          }
        } catch (_) {
          // A failed promo must not block prompts or updates.
          session.promoChecks.remove(page);
        }
      }
      if (!_canShow(session) || _page != page) return;
      final lastCheck = session.lastMessageCheck;
      if (lastCheck != null &&
          DateTime.now().difference(lastCheck) < const Duration(minutes: 1)) {
        return;
      }
      session.lastMessageCheck = DateTime.now();

      // The backend returns the oldest unanswered prompt. Drain them in order.
      try {
        for (var count = 0; count < 20; count++) {
          final response =
              await api.get<Map<String, dynamic>>('/api/prompts/active');
          if (!_canShow(session) || _page != page) return;
          final prompt = response.data?['prompt'];
          if (prompt is! Map<String, dynamic>) break;
          final id = prompt['id']?.toString();
          if (id == null || session.answeredPrompts.contains(id)) break;
          final result = await _show<PromptResult>(
              session,
              Dialog(
                  backgroundColor: Colors.transparent,
                  child: DynamicPromptDialog(
                      prompt: prompt,
                      onSubmit: (answers) async {
                        if (!_current(session)) {
                          throw StateError('Session changed');
                        }
                        await api.post<dynamic>('/api/prompts/respond', body: {
                          'promptId': id,
                          'answers': answers,
                        });
                      })));
          if (result == null || !_current(session)) return;
          session.answeredPrompts.add(id);
          if (result.link?.isNotEmpty == true) {
            await _openLink(result.link!);
            session.lastMessageCheck = null;
            return;
          }
        }
      } catch (_) {
        session.lastMessageCheck = null;
      }
      if (!_canShow(session) || _page != page) return;

      try {
        final response =
            await api.get<Map<String, dynamic>>('/api/updates/pending');
        if (!_canShow(session) || _page != page) return;
        final updates = response.data?['updates'];
        if (updates is! List) return;
        // Preserve the priority order chosen by the server.
        for (final update in updates.whereType<Map<String, dynamic>>()) {
          final id = update['id']?.toString();
          if (id == null || session.dismissedUpdates.contains(id)) continue;
          final delay =
              int.tryParse(update['showDelay']?.toString() ?? '') ?? 0;
          if (delay > 0) {
            await _wait(session, Duration(seconds: delay.clamp(0, 3600)));
          }
          if (!_canShow(session) || _page != page) {
            session.lastMessageCheck = null;
            return;
          }
          final link = await _show<String>(
              session,
              UpdateDialog(
                  update: update,
                  onDismiss: () async {
                    if (!_current(session)) throw StateError('Session changed');
                    await api.post<dynamic>(
                        '/api/updates/${Uri.encodeComponent(id)}/dismiss');
                  }));
          if (link == null || !_current(session)) return;
          session.dismissedUpdates.add(id);
          if (link.isNotEmpty) {
            await _openLink(link);
            session.lastMessageCheck = null;
            return;
          }
        }
      } catch (_) {
        session.lastMessageCheck = null;
      }
    } finally {
      if (identical(_runningSession, session)) _runningSession = null;
      // Resume a new account or destination after an in-flight request finishes.
      if (mounted && (!_current(session) || page != _page)) _schedule();
    }
  }

  Future<void> _openLink(String link) async {
    final context = rootNavigatorKey.currentContext;
    if (context == null) return;
    try {
      await openCtaLink(context, link);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
            const SnackBar(content: Text('Could not open this link.')));
      }
    }
  }

  void _dismissActiveRoute() {
    final route = _activeRoute;
    if (route != null && route.isActive) {
      if (route.isCurrent) {
        rootNavigatorKey.currentState?.pop();
      } else {
        rootNavigatorKey.currentState?.removeRoute(route);
      }
    }
    _activeRoute = null;
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AdminMessageSession>(adminMessageSessionProvider, (prev, next) {
      final old = _runningSession ?? prev;
      if (old != null && !identical(old, next)) {
        if (!old.cancelled.isCompleted) {
          old.cancelled.complete();
        }
        _dismissActiveRoute();
        _runningSession = null;
      }
    });
    final currentSession = ref.watch(adminMessageSessionProvider);
    if (_runningSession != null && !identical(_runningSession, currentSession)) {
      if (!_runningSession!.cancelled.isCompleted) {
        _runningSession!.cancelled.complete();
      }
      _dismissActiveRoute();
      _runningSession = null;
    }
    final router = ref.watch(routerProvider);
    if (!identical(router, _router)) {
      _router?.routerDelegate.removeListener(_schedule);
      _router = router;
      router.routerDelegate.addListener(_schedule);
    }
    _schedule();
    return widget.child;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    rootModalObserver.changes.removeListener(_schedule);
    _router?.routerDelegate.removeListener(_schedule);
    _disposed.complete();
    final route = _activeRoute;
    if (route != null && route.isActive) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (route.isActive) route.navigator?.removeRoute(route);
      });
    }
    super.dispose();
  }
}
