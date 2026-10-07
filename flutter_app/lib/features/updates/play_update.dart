import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:in_app_update/in_app_update.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/router/app_router.dart';
import '../../core/router/modal_observer.dart';
import '../../theme/app_theme_tokens.dart';

/// App updates through Google Play.
///
/// * [checkPlayUpdateOnLaunch] runs once per app launch and shows an
///   "Update available" popup when Play has a newer version for this user.
/// * [checkPlayUpdateManually] powers "Check for Updates" in the More tab.
///
/// Play only reports an update once it is really available to this device, so
/// users are never prompted for a release that is still rolling out.

const _packageId = 'com.teaching.lms';

bool get _supported =>
    !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

bool _launchCheckStarted = false;

/// Opens the app's Play Store page (Play app first, browser as a fallback).
Future<void> openPlayStorePage() async {
  try {
    final opened = await launchUrl(
      Uri.parse('market://details?id=$_packageId'),
      mode: LaunchMode.externalApplication,
    );
    if (opened) return;
  } catch (_) {}
  try {
    await launchUrl(
      Uri.parse('https://play.google.com/store/apps/details?id=$_packageId'),
      mode: LaunchMode.externalApplication,
    );
  } catch (e) {
    debugPrint('Could not open Play Store: $e');
  }
}

/// Asks Play whether an update exists. Returns null when the check itself
/// could not run (no network, app not installed from Play, etc.).
Future<AppUpdateInfo?> _queryPlay() async {
  if (!_supported) return null;
  try {
    return await InAppUpdate.checkForUpdate();
  } catch (e) {
    debugPrint('Play update check failed: $e');
    return null;
  }
}

bool _hasUpdate(AppUpdateInfo info) =>
    info.updateAvailability == UpdateAvailability.updateAvailable ||
    info.updateAvailability ==
        UpdateAvailability.developerTriggeredUpdateInProgress;

/// Downloads and installs through Play's own update screen; falls back to the
/// Play Store page when that flow is not allowed or fails.
Future<void> _startUpdate(AppUpdateInfo info) async {
  if (info.immediateUpdateAllowed) {
    try {
      final result = await InAppUpdate.performImmediateUpdate();
      // The user backing out of Play's screen is fine — they chose "later".
      if (result != AppUpdateResult.inAppUpdateFailed) return;
    } catch (e) {
      debugPrint('In-app update failed: $e');
    }
  }
  await openPlayStorePage();
}

/// Call once the app's first screen is visible. Safe to call repeatedly: the
/// check runs once per launch.
Future<void> checkPlayUpdateOnLaunch() async {
  if (_launchCheckStarted || !_supported) return;
  _launchCheckStarted = true;

  // Let the first screen settle before asking Play.
  await Future<void>.delayed(const Duration(seconds: 2));
  final info = await _queryPlay();
  if (info == null || !_hasUpdate(info)) return;

  // Wait for a moment when nothing else is on screen (another dialog, a
  // lesson, the login flow) so the popup never interrupts.
  for (var attempt = 0; attempt < 12; attempt++) {
    final context = rootNavigatorKey.currentContext;
    if (context != null && context.mounted && !rootModalObserver.hasPopup) {
      await _showUpdateDialog(context, info);
      return;
    }
    await Future<void>.delayed(const Duration(seconds: 5));
  }
}

/// "Check for Updates" in the More tab.
Future<void> checkPlayUpdateManually(BuildContext context) async {
  final info = await _queryPlay();
  if (!context.mounted) return;

  if (info != null && _hasUpdate(info)) {
    await _showUpdateDialog(context, info);
    return;
  }

  final tokens = context.tokens;
  final upToDate = info != null;
  await showDialog<void>(
    context: context,
    useRootNavigator: true,
    builder: (ctx) => AlertDialog(
      backgroundColor: tokens.cardBg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          Icon(
            upToDate
                ? Icons.check_circle_outline_rounded
                : Icons.info_outline_rounded,
            color: upToDate ? tokens.success : tokens.primaryAccent,
            size: 24,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              upToDate ? 'You\'re up to date' : 'Check on Google Play',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: tokens.textPrimary,
              ),
            ),
          ),
        ],
      ),
      content: Text(
        upToDate
            ? 'You have the latest version of Gen-Z IITian.'
            : 'We couldn\'t check for updates right now. You can open '
                'Google Play to see if a new version is available.',
        style: TextStyle(
          fontSize: 13.5,
          height: 1.45,
          color: tokens.textSecondary,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.of(ctx, rootNavigator: true).pop();
            unawaited(openPlayStorePage());
          },
          child: Text(
            'Open Google Play',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: tokens.textSecondary,
            ),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.of(ctx, rootNavigator: true).pop(),
          child: Text(
            'OK',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: tokens.primaryAccent,
            ),
          ),
        ),
      ],
    ),
  );
}

Future<void> _showUpdateDialog(BuildContext context, AppUpdateInfo info) async {
  final tokens = context.tokens;
  final update = await showDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (ctx) => AlertDialog(
      backgroundColor: tokens.cardBg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          Icon(Icons.system_update_rounded,
              color: tokens.primaryAccent, size: 24),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Update available',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: tokens.textPrimary,
              ),
            ),
          ),
        ],
      ),
      content: Text(
        'A new version of Gen-Z IITian is ready. Update now to get the '
        'latest features and fixes.',
        style: TextStyle(
          fontSize: 13.5,
          height: 1.45,
          color: tokens.textSecondary,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx, rootNavigator: true).pop(false),
          child: Text(
            'Later',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: tokens.textSecondary,
            ),
          ),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(ctx, rootNavigator: true).pop(true),
          style: ElevatedButton.styleFrom(
            backgroundColor: tokens.primaryAccent,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          child: const Text(
            'Update',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ],
    ),
  );
  if (update == true) await _startUpdate(info);
}
