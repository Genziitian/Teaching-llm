'use client'

import { useEffect, useRef, useState } from 'react'
import { playTone } from '@/lib/call-tones'
import ManagerUserModal from '@/components/ManagerUserModal'
import { RING_SECONDS } from '@/lib/support-limits'

// shortcut: STUN only, no TURN server — calls between two strict/symmetric NATs (some mobile carriers) won't connect; add a TURN server (e.g. coturn / Twilio NTS) to ICE_SERVERS if that shows up.
const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

type CallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'ended'

export interface CallRow {
  id: string
  type: 'CALL' | 'CALL_OUT' | 'SCHEDULED'
  status: string
  note?: string | null
  scheduledFor?: string | null
  answeredAt?: string | null
  endedAt?: string | null
  createdAt: string
  offer?: string | null
  answer?: string | null
  caller: { id: string; name: string }
  manager?: { id: string; name: string } | null
  participants?: { userId: string; joinedAt: string; leftAt?: string | null; user: { id: string; name: string; role: string } }[]
}

// Non-trickle ICE: wait until all candidates are in the SDP so one offer/answer swap per pair is enough.
async function gatheredSdp(pc: RTCPeerConnection) {
  if (pc.iceGatheringState !== 'complete') {
    await new Promise<void>(resolve => {
      const t = setTimeout(resolve, 4000)
      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve() }
      })
    })
  }
  return pc.localDescription!.sdp
}

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json' } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status })
  return data
}

let myIdPromise: Promise<string> | null = null
const myId = () => (myIdPromise ??= fetch('/api/auth/me').then(r => r.json()).then(d => d.user.id as string))

interface Peer { pc: RTCPeerConnection; name: string; stream: MediaStream; at: number }
type VideoMode = 'off' | 'camera' | 'screen'

/**
 * Group voice/video call (mesh: one RTCPeerConnection per other participant).
 * Signalling = polling GET /api/support/calls/[id] (status, participants, offers/answers for me).
 * Every connection carries one audio + one video transceiver from the start, so camera / screen
 * share / video off are just replaceTrack() on the video sender, with no renegotiation.
 */
function useSupportCall() {
  const [state, setState] = useState<CallState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [title, setTitle] = useState('Support')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [ringingSince, setRingingSince] = useState<number | null>(null)
  // Student's call couldn't happen: offer a call back or a ticket. 'missed' = nobody answered, 'closed' = outside hours.
  const [missed, setMissed] = useState<null | 'missed' | 'closed'>(null)
  const [studentId, setStudentId] = useState<string | null>(null) // callerId is always the student
  const [muted, setMuted] = useState(false)
  const [video, setVideo] = useState<VideoMode>('off')
  const [peers, setPeers] = useState<{ id: string; name: string; stream: MediaStream; video: VideoMode }[]>([])
  const [localVideo, setLocalVideo] = useState<MediaStream | null>(null)
  const peersRef = useRef(new Map<string, Peer>())
  const modes = useRef(new Map<string, VideoMode>()) // what each other participant says they're sending
  const audio = useRef<MediaStream | null>(null)
  const videoTrack = useRef<MediaStreamTrack | null>(null)
  const callId = useRef<string | null>(null)
  const me = useRef('')
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)
  const ticking = useRef(false)
  const callingStudent = useRef(false) // manager → student, for the no-answer message
  const fromGenie = useRef(false) // student call placed from GenZie's hand-off
  const connectedOnce = useRef(false)

  // Ringback while we wait for someone to pick up.
  useEffect(() => (state === 'ringing' ? playTone('ringback') : undefined), [state])

  const syncPeers = () => setPeers(Array.from(peersRef.current).map(([id, p]) => ({ id, name: p.name, stream: p.stream, video: modes.current.get(id) || 'off' })))
  const closePeer = (id: string) => {
    peersRef.current.get(id)?.pc.close()
    peersRef.current.delete(id)
    syncPeers()
  }

  /** How a call finished; calls started from GenZie hand this back to it for the follow-up. */
  const cleanup = (msg: string | null, outcome: CallOutcome = connectedOnce.current ? 'answered' : 'failed') => {
    if (poll.current) clearInterval(poll.current)
    poll.current = null
    peersRef.current.forEach(p => p.pc.close())
    peersRef.current.clear()
    audio.current?.getTracks().forEach(t => t.stop())
    audio.current = null
    videoTrack.current?.stop()
    videoTrack.current = null
    callId.current = null
    setPeers([])
    setLocalVideo(null)
    setVideo('off')
    setMuted(false)
    setStartedAt(null)
    if (fromGenie.current) {
      // GenZie takes over: it reopens with "did it help?" or "call again / call back / ticket".
      fromGenie.current = false
      window.dispatchEvent(new CustomEvent('support-call:outcome', { detail: { outcome } }))
      setMissed(null)
      setMessage(null)
      setState('idle')
      return
    }
    setMessage(msg)
    setState('ended')
  }

  const end = (msg: string | null = 'Call ended') => {
    const id = callId.current
    if (id) fetch(`/api/support/calls/${id}`, { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end' }) }).catch(() => {})
    cleanup(msg, connectedOnce.current ? 'answered' : 'cancelled')
  }

  const newPeer = (id: string, name: string) => {
    closePeer(id)
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const stream = new MediaStream()
    pc.ontrack = e => {
      stream.addTrack(e.track)
      syncPeers()
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { connectedOnce.current = true; setState('active'); setStartedAt(s => s ?? Date.now()) }
      if (pc.connectionState === 'failed') closePeer(id)
    }
    peersRef.current.set(id, { pc, name, stream, at: Date.now() })
    syncPeers()
    return pc
  }

  // Our mic + current video (camera, screen or nothing) on every transceiver of this connection.
  const attachMedia = async (pc: RTCPeerConnection) => {
    for (const t of pc.getTransceivers()) {
      t.direction = 'sendrecv'
      await t.sender.replaceTrack(t.receiver.track.kind === 'audio' ? audio.current!.getAudioTracks()[0] : videoTrack.current)
    }
  }

  const signal = async (toId: string, type: 'offer' | 'answer', pc: RTCPeerConnection) =>
    api(`/api/support/calls/${callId.current}/signal`, { method: 'POST', body: JSON.stringify({ toId, type, sdp: await gatheredSdp(pc) }) })

  const offerTo = async (id: string, name: string) => {
    const pc = newPeer(id, name)
    pc.addTransceiver('audio', { direction: 'sendrecv' })
    pc.addTransceiver('video', { direction: 'sendrecv' })
    await attachMedia(pc)
    await pc.setLocalDescription(await pc.createOffer())
    await signal(id, 'offer', pc)
  }

  const tick = async () => {
    if (ticking.current || !callId.current) return
    ticking.current = true
    try {
      const call = await api(`/api/support/calls/${callId.current}`)
      if (call.status === 'MISSED') {
        // The missed call sits in every manager's Missed calls list with a Call back button.
        if (!callingStudent.current) setMissed('missed')
        return cleanup(callingStudent.current
          ? 'No answer. The student can call back, or try again later.'
          : 'Nobody could pick up right now. Book a call back at a time that suits you, or raise a ticket.', 'missed')
      }
      if (call.status === 'DECLINED') return cleanup(`${call.caller?.name || 'The student'} declined the call.`)
      if (call.status === 'ENDED') return cleanup('Call ended')
      setStudentId(call.caller?.id ?? null)
      const parts: { userId: string; joinedAt: string; video: VideoMode; user: { name: string; role: string } }[] = call.participants
      const names = new Map(parts.map(p => [p.userId, p.user.name]))
      const changed = parts.some(p => modes.current.get(p.userId) !== p.video)
      modes.current = new Map(parts.map(p => [p.userId, p.video]))
      if (changed) syncPeers()
      setTitle(parts.filter(p => p.userId !== me.current).map(p => p.user.name).join(', ') || title)
      if (call.status === 'ACTIVE') setState(s => (s === 'ringing' ? 'connecting' : s))

      for (const s of call.signals as { fromId: string; type: string; sdp: string }[]) {
        if (s.type === 'offer') {
          const pc = newPeer(s.fromId, names.get(s.fromId) || 'Participant')
          await pc.setRemoteDescription({ type: 'offer', sdp: s.sdp })
          await attachMedia(pc)
          await pc.setLocalDescription(await pc.createAnswer())
          await signal(s.fromId, 'answer', pc)
        } else {
          const p = peersRef.current.get(s.fromId)
          if (p && !p.pc.remoteDescription) await p.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp })
        }
      }

      const mine = parts.find(p => p.userId === me.current)
      for (const [id, p] of Array.from(peersRef.current)) {
        // Gone from the call, or never connected (lost signal): drop it; the later joiner re-offers.
        if (!names.has(id) || (p.pc.connectionState !== 'connected' && Date.now() - p.at > 20000)) closePeer(id)
      }
      for (const p of parts) {
        if (!mine || p.userId === me.current || peersRef.current.has(p.userId)) continue
        const iJoinedLater = p.joinedAt < mine.joinedAt || (p.joinedAt === mine.joinedAt && p.userId < me.current)
        if (iJoinedLater) await offerTo(p.userId, p.user.name)
      }
    } catch { /* transient network error: keep polling */ } finally {
      ticking.current = false
    }
  }

  const begin = async (name: string, enter: () => Promise<string>) => {
    callingStudent.current = false // start() sets it again when a manager rings a student
    fromGenie.current = false
    connectedOnce.current = false
    setMissed(null)
    setMessage(null)
    setTitle(name)
    setState('connecting')
    try {
      me.current = await myId()
      audio.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      callId.current = await enter()
      poll.current = setInterval(tick, 1500)
      tick()
    } catch (e: any) {
      const closed = !callingStudent.current && e?.status === 400 && /10 AM/.test(e?.message || '')
      if (closed) { setMissed('closed'); return cleanup('Live calls are open 10 AM – 10 PM. Book a call back for a time that suits you, or raise a ticket.', 'closed') }
      cleanup(e?.status === 409 ? 'This call is no longer ringing'
        : e?.name === 'NotAllowedError' ? 'Microphone permission is needed for calls.'
        : e?.message || 'Could not connect the call')
    }
  }

  /** No userId: a student rings support. With userId: a manager rings that student. */
  const start = (userId?: string, name?: string, genie = false) => begin(name || 'Support', async () => {
    callingStudent.current = !!userId
    fromGenie.current = genie
    const call = await api('/api/support/calls', { method: 'POST', body: JSON.stringify({ userId }) })
    setRingingSince(Date.now())
    setState('ringing')
    return call.id
  })
  const accept = (id: string, name: string) => begin(name, async () => {
    await api(`/api/support/calls/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'accept' }) })
    return id
  })
  /** Manager joins a call that's already live. */
  const join = (id: string, name: string) => begin(name, async () => {
    await api(`/api/support/calls/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'join' }) })
    return id
  })

  const setVideoTrack = async (track: MediaStreamTrack | null, mode: VideoMode) => {
    const old = videoTrack.current
    videoTrack.current = track
    for (const p of Array.from(peersRef.current.values())) {
      for (const t of p.pc.getTransceivers()) if (t.receiver.track.kind === 'video') await t.sender.replaceTrack(track)
    }
    old?.stop()
    setLocalVideo(track ? new MediaStream([track]) : null)
    setVideo(track ? mode : 'off')
    if (callId.current) api(`/api/support/calls/${callId.current}`, { method: 'PATCH', body: JSON.stringify({ action: 'media', video: track ? mode : 'off' }) }).catch(() => {})
  }
  const toggleCamera = async () => {
    if (video === 'camera') return setVideoTrack(null, 'off')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      await setVideoTrack(s.getVideoTracks()[0], 'camera')
    } catch { setMessage('Camera permission is needed for video.') }
  }
  const canShareScreen = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
  const toggleScreen = async () => {
    if (video === 'screen') return setVideoTrack(null, 'off')
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const t = s.getVideoTracks()[0]
      t.onended = () => { if (videoTrack.current === t) setVideoTrack(null, 'off') } // browser's "Stop sharing"
      await setVideoTrack(t, 'screen')
    } catch { /* user cancelled the picker */ }
  }
  const toggleMute = () => {
    audio.current?.getAudioTracks().forEach(t => { t.enabled = muted })
    setMuted(m => !m)
  }

  // Hang up if the tab closes or the component unmounts mid-call.
  const endRef = useRef(end)
  endRef.current = end
  useEffect(() => {
    const onUnload = () => { if (callId.current) endRef.current(null) }
    window.addEventListener('beforeunload', onUnload)
    return () => { window.removeEventListener('beforeunload', onUnload); onUnload() }
  }, [])

  return {
    state, message, title, startedAt, ringingSince, studentId, missed, muted, video, peers, localVideo, canShareScreen,
    start, accept, join, end, toggleMute, toggleCamera, toggleScreen,
    reset: () => { setState('idle'); setMessage(null); setMissed(null) },
  }
}

function useTimer(startedAt: number | null) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  if (!startedAt) return ''
  const s = Math.floor((Date.now() - startedAt) / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Calls sit centred on a dimmed backdrop so they can't be missed.
const backdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.35)',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', // calls get the screen's full attention
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
}

// While a manager reads Student info the card docks bottom-right (no blur) so the details stay readable.
const dockStyle: React.CSSProperties = {
  position: 'fixed', right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 10002, maxHeight: 'calc(100vh - 32px)', display: 'flex',
}
function CallLayer({ docked, children }: { docked: boolean; children: React.ReactNode }) {
  return <div style={docked ? dockStyle : backdropStyle}>{children}</div>
}

const overlayStyle: React.CSSProperties = {
  maxHeight: '100%', overflowY: 'auto',
  width: 'min(320px, calc(100vw - 32px))', background: 'var(--gz-panel, var(--surface-1, #fff))',
  border: '1px solid var(--gz-line, rgba(0,0,0,.1))', borderRadius: 16, padding: 18,
  boxShadow: '0 12px 40px rgba(0,0,0,.22)', color: 'var(--text-primary)',
}

function MediaEl({ stream, kind, mirrored }: { stream: MediaStream; kind: 'audio' | 'video'; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream
      ref.current.play().catch(() => {})
    }
  }, [stream])
  if (kind === 'audio') return <audio ref={ref} autoPlay />
  return <video ref={ref} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', transform: mirrored ? 'scaleX(-1)' : undefined }} />
}

function Tile({ name, stream, on, mirrored }: { name: string; stream: MediaStream | null; on: boolean; mirrored?: boolean }) {
  const live = on && !!stream?.getVideoTracks().length
  return (
    <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#111', borderRadius: 12, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
      {live ? <MediaEl stream={stream!} kind="video" mirrored={mirrored} /> : (
        <div aria-hidden style={{ width: 56, height: 56, borderRadius: '50%', background: '#333', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 600 }}>
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 12, color: '#fff', background: 'rgba(0,0,0,.55)', padding: '2px 8px', borderRadius: 6 }}>{name}</span>
    </div>
  )
}

function CallOverlay({ call, onViewStudent, docked = false }: { call: ReturnType<typeof useSupportCall>; onViewStudent?: (id: string) => void; docked?: boolean }) {
  const timer = useTimer(call.startedAt)
  useTimer(call.state === 'ringing' ? call.ringingSince : null) // re-render every second for the countdown
  if (call.state === 'idle') return null
  const left = call.ringingSince ? Math.max(0, RING_SECONDS - Math.floor((Date.now() - call.ringingSince) / 1000)) : RING_SECONDS
  const label = { connecting: 'Connecting…', ringing: `Ringing… ${left}s`, active: timer || 'Connected', ended: call.message || 'Call ended', idle: '' }[call.state]
  const live = call.state !== 'ended'
  const showGrid = live && (call.video !== 'off' || call.peers.some(p => p.video !== 'off'))
  const ctl = (label: string, onClick: () => void, active = false) => (
    <button className={active ? 'gz-btn' : 'gz-btn gz-btn--ghost'} style={{ flex: '1 1 auto' }} onClick={onClick} aria-pressed={active}>{label}</button>
  )
  return (
    <CallLayer docked={docked}>
    <div style={{ ...overlayStyle, width: showGrid ? 'min(760px, calc(100vw - 32px))' : overlayStyle.width }} role="dialog" aria-modal="true" aria-label="Support call" aria-live="polite">
      {call.peers.map(p => <MediaEl key={p.id} stream={p.stream} kind="audio" />)}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
        {call.missed === 'missed' ? 'No answer' : call.missed === 'closed' ? 'Support is closed' : call.video === 'screen' ? 'Sharing your screen' : 'Support call'}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4, overflowWrap: 'anywhere' }}>
        {call.missed === 'missed' ? 'Nobody picked up' : call.missed === 'closed' ? 'Back at 10 AM' : call.title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      {showGrid && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 12, maxHeight: '60vh', overflowY: 'auto' }}>
          {call.peers.map(p => <Tile key={p.id} name={p.name} stream={p.stream} on={p.video !== 'off'} />)}
          <Tile name="You" stream={call.localVideo} on={call.video !== 'off'} mirrored={call.video === 'camera'} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {!live ? (
          <>
            {call.missed ? (
              <>
                {/* GenZie owns both flows: the call-back picker and the message that becomes a ticket */}
                <button className="gz-btn" style={{ flex: 1 }} onClick={() => { call.reset(); window.dispatchEvent(new Event('genie:callback')) }}>Book a call back</button>
                <button className="gz-btn gz-btn--ghost" style={{ flex: 1 }} onClick={() => { call.reset(); window.dispatchEvent(new Event('genie:message')) }}>Raise a ticket</button>
                <button className="gz-btn gz-btn--ghost" style={{ flex: '1 1 100%' }} onClick={call.reset}>Close</button>
              </>
            ) : (
              <button className="gz-btn" style={{ flex: 1 }} onClick={call.reset}>Close</button>
            )}
          </>
        ) : (
          <>
            {onViewStudent && call.studentId && ctl('Student info', () => onViewStudent(call.studentId!))}
            {ctl(call.muted ? 'Unmute' : 'Mute', call.toggleMute, call.muted)}
            {ctl(call.video === 'camera' ? 'Camera off' : 'Camera', call.toggleCamera, call.video === 'camera')}
            {call.canShareScreen && ctl(call.video === 'screen' ? 'Stop sharing' : 'Share screen', call.toggleScreen, call.video === 'screen')}
            <button className="gz-btn" style={{ flex: '1 1 auto', background: '#ef4444', color: '#fff', borderColor: '#ef4444' }} onClick={() => call.end()}>
              End
            </button>
          </>
        )}
      </div>
    </div>
    </CallLayer>
  )
}

/** Start a call from anywhere on the page; the mounted SupportCallListener places it. */
export function startSupportCall(userId?: string, name?: string, fromGenie = false) {
  window.dispatchEvent(new CustomEvent('support-call:start', { detail: { userId, name, fromGenie } }))
}

/** How a call ended, as reported to GenZie (window event 'support-call:outcome'). */
export type CallOutcome = 'answered' | 'missed' | 'cancelled' | 'failed' | 'closed'

/** Manager joins a live call (the mounted SupportCallListener connects). */
export function joinSupportCall(callId: string, name: string) {
  window.dispatchEvent(new CustomEvent('support-call:join', { detail: { callId, name } }))
}

/** The student's booked call back (if any), shown inside the Support page's "Talk to Support" box. */
export function SupportCallBox() {
  const [rows, setRows] = useState<CallRow[]>([])
  const load = () => api('/api/support/calls').then(setRows).catch(() => {})
  useEffect(() => { load() }, [])

  const scheduled = rows.find(r => r.type === 'SCHEDULED' && (r.status === 'REQUESTED' || r.status === 'ACCEPTED'))
  const cancel = async (id: string) => { await api(`/api/support/calls/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'cancel' }) }).catch(() => {}); load() }

  if (!scheduled) return null
  return (
    <div className="gz-sp-sec" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
        <strong>{scheduled.status === 'ACCEPTED' ? 'Call booked' : 'Call back requested, waiting for confirmation'}</strong> · {new Date(scheduled.scheduledFor!).toLocaleString()}
        <div style={{ color: 'var(--text-muted)', fontSize: 12, overflowWrap: 'anywhere' }}>{scheduled.note}</div>
      </div>
      <button className="gz-btn gz-btn--ghost gz-ed-sm" onClick={() => cancel(scheduled.id)}>Cancel</button>
    </div>
  )
}

/** Manager-side box on the Support page: missed calls + scheduled requests, and a link to the call center. */
export function SupportCallRequests() {
  const [rows, setRows] = useState<CallRow[]>([])
  const load = () => api('/api/support/calls').then(setRows).catch(() => {})
  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])
  const todo = rows.filter(r => (r.type === 'CALL' && r.status === 'MISSED') || r.type === 'SCHEDULED')
  const live = rows.filter(r => r.status === 'ACTIVE')

  return (
    <div className="ticket-box-pad gz-sp-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
        <div>
          <div className="gz-sp-eyebrow">Calls</div>
          <div className="gz-sp-sub gz-sp-sub--tight">{todo.length === 0 ? 'No missed or scheduled calls.' : `${todo.length} need attention`}</div>
        </div>
        <a className="gz-btn gz-btn--ghost" href="/support/calls">Call center →</a>
      </div>
      {live.length > 0 && (
        <div className="gz-sp-sec" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {live.map(r => <LiveCallRow key={r.id} row={r} />)}
        </div>
      )}
      {todo.length > 0 && (
        <div className="gz-sp-sec" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todo.map(r => <CallActionRow key={r.id} row={r} onChange={load} />)}
        </div>
      )}
    </div>
  )
}

/** A call in progress that another manager can join. */
export function LiveCallRow({ row: r }: { row: CallRow }) {
  const names = (r.participants || []).filter(p => !p.leftAt).map(p => p.user.name).join(', ')
  return (
    <div className="gz-sp-row" style={{ cursor: 'default', flexWrap: 'wrap' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Live: {r.caller.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>In call: {names || '…'}</div>
      </div>
      <button className="gz-btn gz-ed-sm" onClick={() => joinSupportCall(r.id, r.caller.name)}>Join</button>
    </div>
  )
}

/** One missed / scheduled call with the manager's actions. */
export function CallActionRow({ row: r, onChange }: { row: CallRow; onChange: () => void }) {
  const act = async (action: string) => { await api(`/api/support/calls/${r.id}`, { method: 'PATCH', body: JSON.stringify({ action }) }).catch(() => {}); onChange() }
  const label = r.type === 'SCHEDULED'
    ? `${r.status === 'REQUESTED' ? 'Wants a call' : 'Booked call'} · ${new Date(r.scheduledFor!).toLocaleString()}`
    : `Missed call · ${new Date(r.createdAt).toLocaleString()}`
  return (
    <div className="gz-sp-row" style={{ cursor: 'default', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.caller.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{label}</div>
        {r.note && <div style={{ fontSize: 12.5, marginTop: 4, overflowWrap: 'anywhere' }}>{r.note}</div>}
      </div>
      {r.type === 'SCHEDULED' && r.status === 'REQUESTED' ? (
        <>
          <button className="gz-btn gz-ed-sm" onClick={() => act('approve')}>Approve</button>
          <button className="gz-btn gz-btn--ghost gz-ed-sm" onClick={() => act('decline')}>Decline</button>
        </>
      ) : (
        <>
          <button className="gz-btn gz-ed-sm" onClick={() => { startSupportCall(r.caller.id, r.caller.name); setTimeout(onChange, 1500) }}>
            {r.type === 'SCHEDULED' ? 'Call now' : 'Call back'}
          </button>
          <button className="gz-btn gz-btn--ghost gz-ed-sm" onClick={() => act('done')}>{r.type === 'SCHEDULED' ? 'Done' : 'Dismiss'}</button>
        </>
      )}
    </div>
  )
}

/** Call log rows: direction, outcome, who picked up, duration. */
export function CallHistoryList({ rows, onOpen }: { rows: CallRow[]; onOpen?: (r: CallRow) => void }) {
  if (rows.length === 0) return <div className="gz-sp-sub">No calls yet.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => {
        const dir = r.type === 'CALL' ? 'Student called support' : r.type === 'CALL_OUT' ? `${r.manager?.name || 'Support'} called student` : 'Scheduled request'
        const secs = r.answeredAt && r.endedAt ? Math.round((+new Date(r.endedAt) - +new Date(r.answeredAt)) / 1000) : null
        const joined = (r.participants || []).map(p => p.user.name)
        const pickedUp = !r.answeredAt ? null : r.type === 'CALL' ? r.manager?.name : r.caller.name
        const outcome = r.type === 'SCHEDULED' ? r.status.toLowerCase()
          : r.answeredAt ? `picked up by ${pickedUp || 'unknown'}${secs != null ? ` · ${Math.floor(secs / 60)}m ${secs % 60}s` : ''}${joined.length > 2 ? ` · in call: ${joined.join(', ')}` : ''}`
          : r.status === 'MISSED' ? 'not picked up' : r.status === 'DECLINED' ? 'declined' : r.status === 'RINGING' ? 'ringing' : r.status === 'ACTIVE' ? 'in progress' : 'not answered'
        return (
          <div key={r.id} className="gz-sp-row" style={{ cursor: onOpen ? 'pointer' : 'default' }}
            {...(onOpen ? { role: 'button', tabIndex: 0, title: `Open ${r.caller.name}`, onClick: () => onOpen(r), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') onOpen(r) } } : {})}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.caller.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{dir} · {new Date(r.createdAt).toLocaleString()}</div>
              {r.note && <div style={{ fontSize: 12, marginTop: 2, overflowWrap: 'anywhere' }}>{r.note}</div>}
            </div>
            <span style={{ fontSize: 12, color: r.answeredAt ? '#10b981' : 'var(--text-muted)', textAlign: 'right' }}>{outcome}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Places outgoing calls (via startSupportCall) and pops up incoming ones.
 * Mounted once in the dashboard layout for managers and students, so calls ring on every page.
 * Checks when /api/user/stream pushes a 'call' event; managers also poll every 4s, students every 20s
 * as a fallback (the SSE stream lives in one server process).
 */
export function SupportCallListener({ role }: { role: 'STUDENT' | 'MANAGER' }) {
  const call = useSupportCall()
  const [ringing, setRinging] = useState<CallRow[]>([])
  const [profileId, setProfileId] = useState<string | null>(null) // manager: full student details
  const declined = useRef(new Set<string>()) // calls I turned down; they may still ring for other managers
  const busy = call.state !== 'idle' && call.state !== 'ended'
  const incomingType = role === 'MANAGER' ? 'CALL' : 'CALL_OUT'

  const startRef = useRef(call.start)
  startRef.current = call.start
  const joinRef = useRef(call.join)
  joinRef.current = call.join
  useEffect(() => {
    const onStart = (e: Event) => {
      const { userId, name, fromGenie } = (e as CustomEvent).detail || {}
      startRef.current(userId, name, fromGenie)
    }
    const onJoin = (e: Event) => {
      const { callId, name } = (e as CustomEvent).detail || {}
      joinRef.current(callId, name)
    }
    window.addEventListener('support-call:start', onStart)
    window.addEventListener('support-call:join', onJoin)
    return () => {
      window.removeEventListener('support-call:start', onStart)
      window.removeEventListener('support-call:join', onJoin)
    }
  }, [])

  useEffect(() => {
    if (busy) return
    const check = () =>
      api('/api/support/calls').then((rows: CallRow[]) => setRinging(rows.filter(r => r.type === incomingType && r.status === 'RINGING' && !declined.current.has(r.id)))).catch(() => {})
    // Timed polls skip hidden tabs; a pushed 'call' event checks even in a background tab so it can ring there too.
    const poll = () => { if (document.visibilityState === 'visible') check() }
    check()
    const t = setInterval(poll, role === 'MANAGER' ? 4000 : 20000)
    window.addEventListener('support-call:check', check)
    return () => { clearInterval(t); window.removeEventListener('support-call:check', check) }
  }, [busy, incomingType, role])

  // Calls stop ringing after RING_SECONDS even before the next poll sees them as missed.
  useTimer(ringing.length ? +new Date(ringing[0].createdAt) : null)
  const fresh = ringing.filter(r => Date.now() - +new Date(r.createdAt) < RING_SECONDS * 1000)
  const incoming = !busy && call.state !== 'ended' ? fresh[0] : undefined
  const isRinging = !!incoming
  useEffect(() => (isRinging ? playTone('ringtone') : undefined), [isRinging])
  const fromName = incoming ? (role === 'MANAGER' ? incoming.caller.name : 'Support team') : ''
  const decline = async (id: string) => {
    declined.current.add(id)
    setRinging(r => r.filter(x => x.id !== id))
    await api(`/api/support/calls/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'end' }) }).catch(() => {})
  }

  return (
    <>
      {incoming && (
        <CallLayer docked={!!profileId}>
        <div style={overlayStyle} role="alertdialog" aria-modal="true" aria-label="Incoming call">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Incoming call</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>{fromName}</div>
          {fresh.length > 1 && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>+{fresh.length - 1} more waiting</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {role === 'MANAGER' && !profileId && <button className="gz-btn gz-btn--ghost" style={{ flex: '1 1 100%' }} onClick={() => setProfileId(incoming.caller.id)}>Student info</button>}
            <button className="gz-btn gz-btn--ghost" style={{ flex: 1 }} onClick={() => decline(incoming.id)}>Decline</button>
            <button className="gz-btn" style={{ flex: 1, background: '#10b981', color: '#fff', borderColor: '#10b981' }} onClick={() => { setRinging(r => r.filter(x => x.id !== incoming.id)); call.accept(incoming.id, fromName) }}>
              Answer
            </button>
          </div>
        </div>
        </CallLayer>
      )}
      <CallOverlay call={call} docked={!!profileId} onViewStudent={role === 'MANAGER' ? setProfileId : undefined} />
      {profileId && <ManagerUserModal userId={profileId} onClose={() => setProfileId(null)} />}
    </>
  )
}
