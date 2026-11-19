import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_callkit_incoming/entities/entities.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';

/// Native full-screen incoming-call UI for support calls (works with the app killed).
/// Driven by data-only FCM from sendFcmCallSignal in src/lib/fcm.ts.
/// Top-level so the FCM background isolate can call it.
Future<bool> handleCallSignal(RemoteMessage message) async {
  final data = message.data;
  final callId = data['callId']?.toString();
  if (callId == null || callId.isEmpty) return false;

  if (data['type'] == 'support_call_cancel') {
    await FlutterCallkitIncoming.endCall(callId);
    return true;
  }
  if (data['type'] != 'support_call') return false;

  final name = (data['callerName']?.toString().isNotEmpty ?? false)
      ? data['callerName'].toString()
      : 'Support';
  await FlutterCallkitIncoming.showCallkitIncoming(CallKitParams(
    id: callId,
    nameCaller: name,
    appName: 'Gen-Z IITian',
    handle: 'Voice call',
    type: 0, // audio
    duration: 60000, // matches RING_TIMEOUT_MS on the server
    extra: {'callId': callId, 'name': name},
    missedCallNotification: const NotificationParams(
      showNotification: true,
      subtitle: 'Missed call',
      isShowCallback: false,
    ),
    android: const AndroidParams(
      isCustomNotification: true,
      isShowLogo: false,
      backgroundColor: '#111111',
      actionColor: '#34C759',
      textColor: '#ffffff',
      incomingCallNotificationChannelName: 'Incoming calls',
      missedCallNotificationChannelName: 'Missed calls',
      isShowFullLockedScreen: true,
      textAccept: 'Answer',
      textDecline: 'Decline',
    ),
  ));
  return true;
}

/// App route that answers [callId] (SupportCallPage with an id accepts the call).
String answerCallRoute(String callId, String name) => Uri(
      path: '/support/call',
      queryParameters: {'id': callId, 'name': name},
    ).toString();
