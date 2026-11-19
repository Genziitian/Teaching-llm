import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';
import 'package:video_player/video_player.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';
import '../../theme/app_theme_tokens.dart';
import 'support_providers.dart';

// shortcut: STUN only, no TURN — calls between two strict NATs (some mobile carriers) won't connect; add a TURN server here and on the web if that shows up.
const _iceServers = {
  'iceServers': [
    {
      'urls': ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
    }
  ]
};

/// GET /api/support/calls — managers: ringing + missed student calls; students: calls to/from them.
final supportCallsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res =
      await ref.watch(apiClientProvider).get<dynamic>('/api/support/calls');
  final data = res.data;
  return data is List ? data.cast<Map<String, dynamic>>() : [];
});

String _callRoute({String? id, String? userId, String? name, bool join = false}) => Uri(
      path: '/support/call',
      queryParameters: {
        if (id != null) 'id': id,
        if (join) 'join': '1',
        if (userId != null) 'userId': userId,
        if (name != null) 'name': name,
      },
    ).toString();

/// Start a voice call. No [userId] = student rings support; with it = manager rings that student.
void startSupportCall(BuildContext context, {String? userId, String? name}) =>
    context.push(_callRoute(userId: userId, name: name));

String _fmtDate(dynamic iso) {
  final d = DateTime.tryParse('${iso ?? ''}')?.toLocal();
  return d == null ? '' : DateFormat('d MMM, h:mm a').format(d);
}

Future<void> _patchCall(WidgetRef ref, String id, String action) async {
  try {
    await ref
        .read(apiClientProvider)
        .patch<dynamic>('/api/support/calls/$id', body: {'action': action});
  } catch (_) {}
  ref.invalidate(supportCallsProvider);
}

/// Support team hours in IST (same as SUPPORT_OPEN_HOUR / SUPPORT_CLOSE_HOUR on the web).
/// Live calls only ring inside them; outside, GenZie offers a call back or a ticket.
bool isSupportOpen([DateTime? now]) {
  final ist = (now ?? DateTime.now()).toUtc().add(const Duration(minutes: 330));
  final h = ist.hour + ist.minute / 60;
  return h >= 10 && h < 22;
}

/// Student books a call back (GenZie hand-off). [reason] pre-fills what they walked through.
Future<void> showScheduleCallSheet(BuildContext context, WidgetRef ref, {String? reason0}) {
  final reason = TextEditingController(text: reason0 ?? '');
  DateTime? when;
  String? error;
  bool saving = false;
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => StatefulBuilder(
      builder: (sheetContext, setSheet) {
        final tokens = sheetContext.tokens;
        Future<void> pickTime() async {
          final now = DateTime.now();
          final date = await showDatePicker(
            context: sheetContext,
            firstDate: now,
            lastDate: now.add(const Duration(days: 30)),
            initialDate: when ?? now,
          );
          if (date == null || !sheetContext.mounted) return;
          final time = await showTimePicker(
            context: sheetContext,
            initialTime: TimeOfDay.fromDateTime(when ?? now.add(const Duration(hours: 1))),
          );
          if (time == null) return;
          setSheet(() => when =
              DateTime(date.year, date.month, date.day, time.hour, time.minute));
        }

        Future<void> submit() async {
          final h = when!.hour + when!.minute / 60;
          if (h < 10 || h >= 22) {
            setSheet(() => error = 'Please pick a time between 10 AM and 10 PM.');
            return;
          }
          setSheet(() {
            saving = true;
            error = null;
          });
          try {
            await ref.read(apiClientProvider).post<dynamic>('/api/support/calls', body: {
              'type': 'SCHEDULED',
              'scheduledFor': when!.toUtc().toIso8601String(),
              'reason': reason.text,
            });
            ref.invalidate(supportCallsProvider);
            if (sheetContext.mounted) Navigator.of(sheetContext).pop();
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('Call back requested. Once the team confirms, we will call you in the app.')));
            }
          } catch (e) {
            setSheet(() {
              saving = false;
              error = supportError(e);
            });
          }
        }

        return Padding(
          padding: EdgeInsets.fromLTRB(
              20, 0, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Request a call back',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: tokens.textPrimary)),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: pickTime,
                icon: const Icon(Symbols.event_rounded),
                label: Text(when == null
                    ? 'Pick date and time'
                    : DateFormat('EEE d MMM, h:mm a').format(when!)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reason,
                maxLength: 500,
                maxLines: 3,
                minLines: 1,
                onChanged: (_) => setSheet(() {}),
                decoration: const InputDecoration(labelText: 'Reason for the call'),
              ),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(error!,
                      style: const TextStyle(color: Color(0xFFFF3B30))),
                ),
              FilledButton(
                onPressed: saving || when == null || reason.text.trim().length < 3
                    ? null
                    : submit,
                child: Text(saving ? 'Sending…' : 'Request this time'),
              ),
            ],
          ),
        );
      },
    ),
  );
}

/// Support page section: incoming calls (both roles); managers also get missed calls and
/// scheduled requests; students see their own scheduled request.
class SupportCallsSection extends ConsumerWidget {
  const SupportCallsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final manager = ref.watch(supportSessionProvider).role == 'MANAGER';
    final calls = ref.watch(supportCallsProvider).asData?.value ?? const [];
    final incoming = calls.where((c) =>
        c['type'] == (manager ? 'CALL' : 'CALL_OUT') && c['status'] == 'RINGING');
    final todo = calls.where((c) =>
        (manager && c['type'] == 'CALL' && c['status'] == 'MISSED') ||
        (c['type'] == 'SCHEDULED' &&
            (c['status'] == 'REQUESTED' || c['status'] == 'ACCEPTED')));
    final live = manager
        ? calls.where((c) => c['status'] == 'ACTIVE')
        : const <Map<String, dynamic>>[];
    if (incoming.isEmpty && todo.isEmpty && live.isEmpty) {
      return const SizedBox.shrink();
    }

    String nameOf(Map<String, dynamic> c) =>
        manager ? '${(c['caller'] as Map?)?['name'] ?? 'Student'}' : 'Support team';

    Widget row(Map<String, dynamic> c, String sub, List<Widget> actions) =>
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: tokens.cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: tokens.border, width: 0.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(nameOf(c),
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: tokens.textPrimary)),
              Text(sub, style: TextStyle(fontSize: 13, color: tokens.textMuted)),
              if ((c['note'] ?? '').toString().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('${c['note']}',
                      style: TextStyle(color: tokens.textPrimary)),
                ),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 8, children: actions),
            ],
          ),
        );

    Widget callButton(Map<String, dynamic> c, String label) => FilledButton.icon(
          onPressed: () => startSupportCall(context,
              userId: '${(c['caller'] as Map?)?['id']}', name: nameOf(c)),
          icon: const Icon(Symbols.call_rounded, fill: 1),
          label: Text(label),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 20),
        for (final c in incoming)
          row(c, 'Incoming call', [
            FilledButton.icon(
              style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF34C759)),
              onPressed: () =>
                  context.push(_callRoute(id: '${c['id']}', name: nameOf(c))),
              icon: const Icon(Symbols.call_rounded, fill: 1),
              label: const Text('Answer'),
            ),
            OutlinedButton(
                onPressed: () => _patchCall(ref, '${c['id']}', 'end'),
                child: const Text('Decline')),
            if (manager)
              TextButton.icon(
                onPressed: () => context.push(
                    '/support/call-center/${Uri.encodeComponent('${(c['caller'] as Map?)?['id']}')}'),
                icon: const Icon(Symbols.person_rounded),
                label: const Text('Student info'),
              ),
          ]),
        for (final c in live)
          row(
              c,
              'Live now · in call: ${((c['participants'] as List?) ?? []).where((p) => (p as Map)['leftAt'] == null).map((p) => (p as Map)['user']?['name']).join(', ')}',
              [
                FilledButton.icon(
                  onPressed: () => context.push(_callRoute(
                      id: '${c['id']}', name: nameOf(c), join: true)),
                  icon: const Icon(Symbols.group_add_rounded, fill: 1),
                  label: const Text('Join'),
                ),
              ]),
        for (final c in todo)
          if (c['type'] == 'CALL')
            row(c, 'Missed call · ${_fmtDate(c['createdAt'])}', [
              callButton(c, 'Call back'),
              OutlinedButton(
                  onPressed: () => _patchCall(ref, '${c['id']}', 'done'),
                  child: const Text('Dismiss')),
            ])
          else if (!manager)
            row(
                c,
                '${c['status'] == 'ACCEPTED' ? 'Call confirmed' : 'Waiting for confirmation'} · ${_fmtDate(c['scheduledFor'])}',
                [
                  OutlinedButton(
                      onPressed: () => _patchCall(ref, '${c['id']}', 'cancel'),
                      child: const Text('Cancel')),
                ])
          else if (c['status'] == 'REQUESTED')
            row(c, 'Wants a call · ${_fmtDate(c['scheduledFor'])}', [
              FilledButton(
                  onPressed: () => _patchCall(ref, '${c['id']}', 'approve'),
                  child: const Text('Approve')),
              OutlinedButton(
                  onPressed: () => _patchCall(ref, '${c['id']}', 'decline'),
                  child: const Text('Decline')),
            ])
          else
            row(c, 'Confirmed call · ${_fmtDate(c['scheduledFor'])}', [
              callButton(c, 'Call now'),
              OutlinedButton(
                  onPressed: () => _patchCall(ref, '${c['id']}', 'done'),
                  child: const Text('Done')),
            ]),
      ],
    );
  }
}

/// Call log row data: direction, outcome (who picked up), duration.
({String title, String sub, bool answered}) describeCall(Map<String, dynamic> c) {
  final caller = '${(c['caller'] as Map?)?['name'] ?? 'Student'}';
  final manager = (c['manager'] as Map?)?['name'];
  final answeredAt = DateTime.tryParse('${c['answeredAt'] ?? ''}');
  final endedAt = DateTime.tryParse('${c['endedAt'] ?? ''}');
  final dir = switch (c['type']) {
    'CALL' => 'Student called support',
    'CALL_OUT' => '${manager ?? 'Support'} called student',
    _ => 'Scheduled request',
  };
  String outcome;
  if (c['type'] == 'SCHEDULED') {
    outcome = '${c['status']}'.toLowerCase();
  } else if (answeredAt != null) {
    final pickedUp = c['type'] == 'CALL' ? (manager ?? 'unknown') : caller;
    final joined = ((c['participants'] as List?) ?? [])
        .map((p) => (p as Map)['user']?['name'])
        .whereType<String>()
        .toList();
    final secs = endedAt?.difference(answeredAt).inSeconds;
    outcome = 'Picked up by $pickedUp${secs == null ? '' : ' · ${secs ~/ 60}m ${secs % 60}s'}'
        '${joined.length > 2 ? '\nIn call: ${joined.join(', ')}' : ''}';
  } else {
    outcome = switch (c['status']) {
      'MISSED' => 'Missed',
      'RINGING' => 'Ringing',
      'ACTIVE' => 'In progress',
      _ => 'Not answered',
    };
  }
  return (
    title: caller,
    sub: '$dir · ${_fmtDate(c['createdAt'])}\n$outcome',
    answered: answeredAt != null,
  );
}

/// Android 10+ screen capture needs a mediaProjection foreground service (ScreenShareService.kt).
const _screenShare = MethodChannel('com.teaching.lms/screen_share');

class _Peer {
  _Peer(this.pc, this.name, this.renderer);
  final RTCPeerConnection pc;
  final String name;
  final RTCVideoRenderer renderer;
  final DateTime at = DateTime.now();
  MediaStream? stream;
}

/// Group voice/video call (mesh: one connection per other participant, same protocol as the web).
/// With [callId]: answer it, or join it when [join] (manager joining a live call).
/// Without: start one, to support (student) or to [userId] (manager).
/// Each connection carries an audio + a video transceiver from the start, so camera,
/// screen share and video-off are just replaceTrack on the video sender.
class SupportCallPage extends ConsumerStatefulWidget {
  const SupportCallPage(
      {super.key, this.callId, this.userId, this.peerName, this.join = false});
  final String? callId;
  final String? userId;
  final String? peerName;
  final bool join;

  @override
  ConsumerState<SupportCallPage> createState() => _SupportCallPageState();
}

class _SupportCallPageState extends ConsumerState<SupportCallPage> {
  final _peers = <String, _Peer>{};
  final _modes = <String, String>{}; // what each other participant is sending: off | camera | screen
  final _localRenderer = RTCVideoRenderer();
  MediaStream? _audio;
  MediaStream? _videoStream;
  String _video = 'off';
  String? _id;
  String _me = '';
  late String _title = widget.peerName ?? 'Support';
  Timer? _poll;
  Timer? _clock;
  bool _ticking = false;
  DateTime? _ringingSince;
  String? _studentId; // callerId is always the student; managers can open their profile mid-call
  // Ringback while waiting (generated 400+450 Hz tone; video_player plays audio assets too).
  VideoPlayerController? _ringback;
  DateTime? _startedAt;
  String _status = 'Connecting…';
  bool _ended = false;
  bool _muted = false;
  bool _speaker = false;

  bool get _answering => widget.callId != null && !widget.join;
  ApiClient get _api => ref.read(apiClientProvider);

  @override
  void initState() {
    super.initState();
    _begin();
  }

  @override
  void dispose() {
    if (!_ended) _hangUp(notify: true);
    _localRenderer.dispose();
    super.dispose();
  }

  Future<void> _begin() async {
    try {
      await _localRenderer.initialize();
      _me = ref.read(supportSessionProvider).id ?? '';
      if (_answering) {
        // Answered from the in-app button while the phone still rang natively: stop the ringing.
        final native = await FlutterCallkitIncoming.activeCalls();
        if (!native.any((c) => c.id == widget.callId && c.isAccepted)) {
          await FlutterCallkitIncoming.endCall(widget.callId!);
        }
      }
      _audio = await navigator.mediaDevices
          .getUserMedia({'audio': true, 'video': false});
      if (widget.callId == null) {
        final res = await _api.post<Map<String, dynamic>>('/api/support/calls',
            body: {if (widget.userId != null) 'userId': widget.userId});
        _id = '${res.data!['id']}';
        _ringingSince = DateTime.now();
        _startRingback();
        _clock ??= Timer.periodic(const Duration(seconds: 1),
            (_) => mounted ? setState(() {}) : null);
        if (mounted) setState(() => _status = 'Ringing…');
      } else {
        await _api.patch<dynamic>('/api/support/calls/${widget.callId}',
            body: {'action': widget.join ? 'join' : 'accept'});
        _id = widget.callId;
      }
      _poll = Timer.periodic(const Duration(milliseconds: 1500), (_) => _tick());
      _tick();
    } on DioException catch (e) {
      _finish(e.response?.statusCode == 409
          ? 'This call is no longer ringing'
          : supportError(e));
    } catch (e) {
      _finish(e.toString().contains('Permission') ||
              e.toString().contains('NotAllowed')
          ? 'Microphone permission is needed for calls.'
          : 'Could not connect the call');
    }
  }

  Future<void> _startRingback() async {
    try {
      final c = VideoPlayerController.asset('assets/sounds/ringback.wav');
      _ringback = c;
      await c.initialize();
      await c.setLooping(true);
      if (_ringback == c) await c.play();
    } catch (_) {/* sound is a nicety */}
  }

  void _stopRingback() {
    _ringingSince = null;
    _ringback?.dispose();
    _ringback = null;
  }

  Future<_Peer> _newPeer(String id, String name) async {
    await _closePeer(id);
    final pc = await createPeerConnection(_iceServers);
    final renderer = RTCVideoRenderer();
    await renderer.initialize();
    final peer = _Peer(pc, name, renderer);
    pc.onTrack = (e) async {
      if (e.streams.isNotEmpty) {
        peer.stream = e.streams.first;
      } else {
        peer.stream ??= await createLocalMediaStream('remote_$id');
        await peer.stream!.addTrack(e.track, addToNative: false);
      }
      renderer.srcObject = peer.stream;
      if (mounted) setState(() {});
    };
    pc.onConnectionState = (s) {
      if (!mounted) return;
      if (s == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
        _stopRingback();
        if (_startedAt == null) {
          _startedAt = DateTime.now();
          _clock?.cancel();
          _clock = Timer.periodic(const Duration(seconds: 1),
              (_) => mounted ? setState(() {}) : null);
          if (_answering) FlutterCallkitIncoming.setCallConnected(widget.callId!);
        }
        setState(() => _status = 'Connected');
      } else if (s == RTCPeerConnectionState.RTCPeerConnectionStateFailed) {
        _closePeer(id);
      }
    };
    _peers[id] = peer;
    return peer;
  }

  Future<void> _closePeer(String id) async {
    final p = _peers.remove(id);
    if (p == null) return;
    await p.pc.close();
    await p.renderer.dispose();
    if (mounted) setState(() {});
  }

  // Our mic + current video (camera, screen or nothing) on every transceiver of this connection.
  Future<void> _attach(RTCPeerConnection pc) async {
    final audioTrack = _audio!.getAudioTracks().first;
    final videoTrack = _videoStream?.getVideoTracks().firstOrNull;
    for (final t in await pc.getTransceivers()) {
      await t.setDirection(TransceiverDirection.SendRecv);
      await t.sender
          .replaceTrack(t.receiver.track?.kind == 'audio' ? audioTrack : videoTrack);
    }
  }

  Future<String> _gatheredSdp(RTCPeerConnection pc) async {
    if (pc.iceGatheringState !=
        RTCIceGatheringState.RTCIceGatheringStateComplete) {
      final done = Completer<void>();
      pc.onIceGatheringState = (s) {
        if (s == RTCIceGatheringState.RTCIceGatheringStateComplete &&
            !done.isCompleted) {
          done.complete();
        }
      };
      await done.future.timeout(const Duration(seconds: 4), onTimeout: () {});
    }
    return (await pc.getLocalDescription())!.sdp!;
  }

  Future<void> _signal(String toId, String type, RTCPeerConnection pc) async {
    final sdp = await _gatheredSdp(pc);
    await _api.post<dynamic>('/api/support/calls/$_id/signal',
        body: {'toId': toId, 'type': type, 'sdp': sdp});
  }

  Future<void> _offerTo(String id, String name) async {
    final pc = (await _newPeer(id, name)).pc;
    for (final kind in [
      RTCRtpMediaType.RTCRtpMediaTypeAudio,
      RTCRtpMediaType.RTCRtpMediaTypeVideo
    ]) {
      await pc.addTransceiver(
          kind: kind,
          init: RTCRtpTransceiverInit(direction: TransceiverDirection.SendRecv));
    }
    await _attach(pc);
    await pc.setLocalDescription(await pc.createOffer());
    await _signal(id, 'offer', pc);
  }

  Future<void> _tick() async {
    if (_ticking || _id == null || _ended) return;
    _ticking = true;
    try {
      final call =
          (await _api.get<Map<String, dynamic>>('/api/support/calls/$_id')).data!;
      if (call['status'] == 'MISSED') {
        return _finish(widget.callId == null
            ? (widget.userId != null
                ? 'No answer. The student can call back, or try again later.'
                : 'No one could pick up right now. Ask GenZie to book a call back and we will call you.')
            : 'Call ended');
      }
      if (call['status'] == 'ENDED') return _finish('Call ended');
      _studentId = (call['caller'] as Map?)?['id']?.toString();
      final parts = (call['participants'] as List).cast<Map<String, dynamic>>();
      final names = {
        for (final p in parts) '${p['userId']}': '${(p['user'] as Map)['name']}'
      };
      _modes
        ..clear()
        ..addAll({for (final p in parts) '${p['userId']}': '${p['video'] ?? 'off'}'});
      final others = [for (final e in names.entries) if (e.key != _me) e.value];
      if (others.isNotEmpty) _title = others.join(', ');
      if (call['status'] == 'ACTIVE' && _status == 'Ringing…') {
        _stopRingback();
        _status = 'Connecting…';
      }

      for (final s in (call['signals'] as List).cast<Map<String, dynamic>>()) {
        final from = '${s['fromId']}';
        if (s['type'] == 'offer') {
          final pc = (await _newPeer(from, names[from] ?? 'Participant')).pc;
          await pc.setRemoteDescription(
              RTCSessionDescription('${s['sdp']}', 'offer'));
          await _attach(pc);
          await pc.setLocalDescription(await pc.createAnswer());
          await _signal(from, 'answer', pc);
        } else {
          final p = _peers[from];
          if (p != null && await p.pc.getRemoteDescription() == null) {
            await p.pc.setRemoteDescription(
                RTCSessionDescription('${s['sdp']}', 'answer'));
          }
        }
      }

      // Gone from the call, or never connected (lost signal): drop it; the later joiner re-offers.
      for (final e in [..._peers.entries]) {
        final stale = e.value.pc.connectionState !=
                RTCPeerConnectionState.RTCPeerConnectionStateConnected &&
            DateTime.now().difference(e.value.at).inSeconds > 20;
        if (!names.containsKey(e.key) || stale) await _closePeer(e.key);
      }
      final mine = parts.where((p) => p['userId'] == _me).firstOrNull;
      for (final p in parts) {
        final id = '${p['userId']}';
        if (mine == null || id == _me || _peers.containsKey(id)) continue;
        final cmp = '${p['joinedAt']}'.compareTo('${mine['joinedAt']}');
        if (cmp < 0 || (cmp == 0 && id.compareTo(_me) < 0)) {
          await _offerTo(id, names[id]!);
        }
      }
      if (mounted) setState(() {});
    } catch (_) {
      // Transient network error: keep polling.
    } finally {
      _ticking = false;
    }
  }

  Future<void> _setVideo(MediaStream? stream, String mode) async {
    final old = _videoStream;
    _videoStream = stream;
    final track = stream?.getVideoTracks().firstOrNull;
    for (final p in _peers.values) {
      for (final t in await p.pc.getTransceivers()) {
        if (t.receiver.track?.kind == 'video') await t.sender.replaceTrack(track);
      }
    }
    _localRenderer.srcObject = stream;
    final wasScreen = _video == 'screen';
    if (mounted) setState(() => _video = stream == null ? 'off' : mode);
    for (final t in old?.getTracks() ?? <MediaStreamTrack>[]) {
      await t.stop();
    }
    await old?.dispose();
    if (wasScreen && mode != 'screen') await _screenShare.invokeMethod('stop');
    if (_id != null) {
      _api.patch<dynamic>('/api/support/calls/$_id',
          body: {'action': 'media', 'video': _video}).then((_) {}, onError: (_) {});
    }
    if (_video != 'off' && !_speaker) _toggleSpeaker();
  }

  Future<void> _toggleCamera() async {
    if (_video == 'camera') return _setVideo(null, 'off');
    try {
      await _setVideo(
          await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': {'facingMode': 'user', 'width': 640, 'height': 480},
          }),
          'camera');
    } catch (_) {
      _snack('Camera permission is needed for video.');
    }
  }

  Future<void> _toggleScreen() async {
    if (_video == 'screen') return _setVideo(null, 'off');
    try {
      if (!await Helper.requestCapturePermission()) return;
      await _screenShare.invokeMethod('start');
      await _setVideo(
          await navigator.mediaDevices
              .getDisplayMedia({'audio': false, 'video': true}),
          'screen');
    } catch (_) {
      await _screenShare.invokeMethod('stop');
      _snack('Could not start screen sharing.');
    }
  }

  void _toggleSpeaker() {
    setState(() => _speaker = !_speaker);
    Helper.setSpeakerphoneOn(_speaker);
  }

  void _snack(String text) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    }
  }

  void _hangUp({required bool notify}) {
    _stopRingback();
    if (_answering) FlutterCallkitIncoming.endCall(widget.callId!);
    _poll?.cancel();
    _clock?.cancel();
    final id = _id;
    if (notify && id != null) {
      _api.patch<dynamic>('/api/support/calls/$id',
          body: {'action': 'end'}).then((_) {}, onError: (_) {});
    }
    _id = null;
    for (final p in _peers.values) {
      p.pc.close();
      p.renderer.dispose();
    }
    _peers.clear();
    for (final s in [_audio, _videoStream]) {
      for (final t in s?.getTracks() ?? <MediaStreamTrack>[]) {
        t.stop();
      }
      s?.dispose();
    }
    if (_video == 'screen') _screenShare.invokeMethod('stop');
    _audio = null;
    _videoStream = null;
  }

  void _finish(String message) {
    if (_ended) return;
    _hangUp(notify: false);
    _ended = true;
    if (mounted) {
      setState(() {
        _status = message;
        _video = 'off';
      });
    }
  }

  void _end() {
    _hangUp(notify: true);
    _ended = true;
    if (mounted) context.canPop() ? context.pop() : context.go('/support');
  }

  String get _label {
    final s = _startedAt;
    final r = _ringingSince;
    if (!_ended && s == null && r != null && _status == 'Ringing…') {
      final left = 60 - DateTime.now().difference(r).inSeconds; // RING_SECONDS on the server
      return 'Ringing… ${left.clamp(0, 60)}s';
    }
    if (_ended || s == null) return _status;
    final secs = DateTime.now().difference(s).inSeconds;
    return '${(secs ~/ 60).toString().padLeft(2, '0')}:${(secs % 60).toString().padLeft(2, '0')}';
  }

  Widget _tile(String name, RTCVideoRenderer renderer, bool on,
      {bool mirror = false}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Container(
        color: const Color(0xFF1C1C1E),
        child: Stack(fit: StackFit.expand, children: [
          if (on)
            RTCVideoView(renderer,
                mirror: mirror,
                objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain)
          else
            Center(
              child: CircleAvatar(
                radius: 30,
                backgroundColor: const Color(0xFF3A3A3C),
                child: Text(name.isEmpty ? '?' : name[0].toUpperCase(),
                    style: const TextStyle(fontSize: 24, color: Colors.white)),
              ),
            ),
          Positioned(
            left: 8,
            bottom: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                  color: Colors.black54, borderRadius: BorderRadius.circular(6)),
              child: Text(name,
                  style: const TextStyle(color: Colors.white, fontSize: 12)),
            ),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final live = !_ended;
    final anyVideo = _video != 'off' || _modes.entries.any((e) => e.key != _me && e.value != 'off');
    final tiles = [
      for (final e in _peers.entries)
        _tile(e.value.name, e.value.renderer, (_modes[e.key] ?? 'off') != 'off'),
      _tile('You', _localRenderer, _video != 'off', mirror: _video == 'camera'),
    ];

    Widget control(IconData icon, String label, VoidCallback onTap,
            {bool active = false, Color? bg}) =>
        Semantics(
          button: true,
          label: label,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Material(
              color: bg ?? (active ? Colors.white : const Color(0xFF3A3A3C)),
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onTap,
                child: SizedBox(
                    width: 56,
                    height: 56,
                    child: Icon(icon,
                        fill: 1,
                        size: 26,
                        color: active && bg == null ? Colors.black : Colors.white)),
              ),
            ),
            const SizedBox(height: 6),
            ExcludeSemantics(
                child: Text(label,
                    style: const TextStyle(fontSize: 11, color: Colors.white70))),
          ]),
        );

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 16),
          child: Column(
            children: [
              Text(_title,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white)),
              const SizedBox(height: 4),
              Semantics(
                liveRegion: true,
                child: Text(_video == 'screen' ? 'Sharing your screen · $_label' : _label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 15, color: Colors.white70)),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: live && anyVideo
                    ? GridView.count(
                        crossAxisCount: tiles.length <= 2 ? 1 : 2,
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                        childAspectRatio: tiles.length <= 2 ? 4 / 3 : 3 / 4,
                        children: tiles,
                      )
                    : const Center(
                        child: CircleAvatar(
                          radius: 52,
                          backgroundColor: Color(0xFF2C2C2E),
                          child: Icon(Symbols.support_agent_rounded,
                              size: 52, color: Colors.white),
                        ),
                      ),
              ),
              const SizedBox(height: 16),
              if (!live)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () =>
                        context.canPop() ? context.pop() : context.go('/support'),
                    child: const Text('Close'),
                  ),
                )
              else
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 14,
                  runSpacing: 12,
                  children: [
                    if (ref.read(supportSessionProvider).role == 'MANAGER' && _studentId != null)
                      control(Symbols.person_rounded, 'Student info',
                          () => context.push('/support/call-center/${Uri.encodeComponent(_studentId!)}')),
                    control(_muted ? Symbols.mic_off_rounded : Symbols.mic_rounded,
                        _muted ? 'Unmute' : 'Mute', () {
                      setState(() => _muted = !_muted);
                      for (final t in _audio?.getAudioTracks() ?? <MediaStreamTrack>[]) {
                        t.enabled = !_muted;
                      }
                    }, active: _muted),
                    control(
                        _video == 'camera' ? Symbols.videocam_rounded : Symbols.videocam_off_rounded,
                        'Camera',
                        _toggleCamera,
                        active: _video == 'camera'),
                    if (_video == 'camera')
                      control(Symbols.flip_camera_android_rounded, 'Flip', () {
                        final t = _videoStream?.getVideoTracks().firstOrNull;
                        if (t != null) Helper.switchCamera(t);
                      }),
                    control(Symbols.screen_share_rounded,
                        _video == 'screen' ? 'Stop share' : 'Share screen', _toggleScreen,
                        active: _video == 'screen'),
                    control(Symbols.volume_up_rounded, 'Speaker', _toggleSpeaker,
                        active: _speaker),
                    control(Symbols.call_end_rounded, 'End', _end,
                        bg: const Color(0xFFFF3B30)),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
