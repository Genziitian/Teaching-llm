import 'package:material_ui/material_ui.dart';

/// Global messages wait until forms/dialogs opened by a page are closed.
final rootModalObserver = ModalObserver();

class ModalObserver extends NavigatorObserver {
  final changes = ValueNotifier<int>(0);
  final _popups = <Route<dynamic>>{};
  bool get hasPopup => _popups.any((route) => route.isActive);

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _popups.removeWhere((popup) => !popup.isActive);
    if (route is PopupRoute) _popups.add(route);
    changes.value++;
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _popups.remove(route);
    changes.value++;
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _popups.remove(route);
    changes.value++;
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    _popups.remove(oldRoute);
    if (newRoute is PopupRoute) _popups.add(newRoute);
    changes.value++;
  }
}
