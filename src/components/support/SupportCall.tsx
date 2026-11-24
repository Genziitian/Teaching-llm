'use client'

import { useEffect, useRef, useState } from 'react'
import { playTone } from '@/lib/call-tones'
import ManagerUserModal from '@/components/ManagerUserModal'
import { RING_SECONDS, isSupportOpen } from '@/lib/support-limits'

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
  const [cameraAsked, setCameraAsked] = useState(false) // student: a manager asked them to turn on camera
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
        if (s.type === 'camera') {
          setCameraAsked(true)
        } else if (s.type === 'offer') {
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
    if (track && mode === 'camera') setCameraAsked(false)
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
  const [cameraRequested, setCameraRequested] = useState(false) // manager: shows "Asked" briefly
  const requestCamera = async () => {
    if (!callId.current) return
    setCameraRequested(true)
    setTimeout(() => setCameraRequested(false), 4000)
    api(`/api/support/calls/${callId.current}`, { method: 'PATCH', body: JSON.stringify({ action: 'request-camera' }) }).catch(() => {})
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
    state, message, title, startedAt, ringingSince, studentId, missed, muted, cameraAsked, cameraRequested, requestCamera, video, peers, localVideo, canShareScreen,
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
  return <div style={docked ? dockStyle : backdropStyle}><style>{CALL_CSS}</style>{children}</div>
}

const overlayStyle: React.CSSProperties = {
  position: 'relative', maxHeight: '100%', overflowY: 'auto', textAlign: 'center',
  width: 'min(380px, calc(100vw - 32px))', background: 'var(--gz-panel, var(--surface-1, #fff))',
  border: '1px solid var(--gz-line, rgba(0,0,0,.1))', borderRadius: 24, padding: '26px 20px 22px',
  boxShadow: '0 24px 64px rgba(0,0,0,.35)', color: 'var(--text-primary)',
}

// Call UI look: slide-up card, pulsing avatar while ringing, round icon buttons. Motion is off for reduced-motion users.
const CALL_CSS = `
@keyframes ccIn{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
@keyframes ccRing{0%{transform:scale(1);opacity:.5}100%{transform:scale(1.85);opacity:0}}
@keyframes ccWiggle{0%,60%,100%{transform:rotate(0)}10%,30%{transform:rotate(-14deg)}20%,40%{transform:rotate(14deg)}50%{transform:rotate(-8deg)}}
@keyframes ccBlink{0%,100%{opacity:1}50%{opacity:.35}}
.cc-card{animation:ccIn .28s cubic-bezier(.2,.8,.2,1) both}
.cc-eyebrow{font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--gz-ink-3,#6b6b68);margin-bottom:16px}
.cc-avatar{position:relative;width:88px;height:88px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;font-size:34px;font-weight:600;background:color-mix(in srgb,var(--gz-ink,#171717) 9%,var(--gz-panel,#fff));color:var(--gz-ink,#171717)}
.cc-avatar.pulse::before,.cc-avatar.pulse::after{content:'';position:absolute;inset:0;border-radius:50%;border:2px solid var(--gz-ink-3,#6b6b68);animation:ccRing 2.2s ease-out infinite}
.cc-avatar.pulse::after{animation-delay:1.1s}
.cc-name{font-size:21px;font-weight:600;line-height:1.25;overflow-wrap:anywhere}
.cc-status{margin-top:4px;font-size:13.5px;line-height:1.45;color:var(--gz-ink-3,#6b6b68);font-variant-numeric:tabular-nums;display:flex;align-items:center;justify-content:center;gap:7px}
.cc-dot{width:8px;height:8px;border-radius:50%;background:#10b981;animation:ccBlink 2s ease-in-out infinite}
.cc-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 12px;margin-top:22px}
.cc-stack{display:flex;flex-direction:column;gap:8px;width:100%}
.cc-ctl{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11.5px;color:var(--gz-ink-3,#6b6b68);min-width:56px}
.cc-round{width:54px;height:54px;border-radius:50%;border:1px solid var(--gz-line,#e7e7e3);background:var(--gz-panel,#fff);color:var(--gz-ink,#171717);display:grid;place-items:center;cursor:pointer;transition:transform .12s,background .15s,box-shadow .15s}
.cc-round:hover{background:color-mix(in srgb,var(--gz-ink,#171717) 8%,var(--gz-panel,#fff))}
.cc-round:active{transform:scale(.9)}
.cc-round:focus-visible{outline:2px solid var(--gz-ink,#171717);outline-offset:3px}
.cc-round.on{background:var(--gz-ink,#171717);color:var(--gz-panel,#fff);border-color:transparent}
.cc-round.danger,.cc-round.success{border-color:transparent;color:#fff;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.cc-round.danger{background:#ef4444}
.cc-round.danger:hover{background:#dc2626}
.cc-round.success{background:#10b981}
.cc-round.success:hover{background:#059669}
.cc-round.success svg{animation:ccWiggle 1.8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.cc-card,.cc-dot,.cc-avatar::before,.cc-avatar::after,.cc-round.success svg{animation:none!important}}
`

const ICONS: Record<string, React.ReactNode> = {
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  hangup: <path transform="rotate(135 12 12)" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  mic: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></>,
  micOff: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M2 2l20 20" /></>,
  video: <><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></>,
  videoOff: <><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /><path d="M2 2l20 20" /></>,
  screen: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
}

function Ico({ n }: { n: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[n]}</svg>
}

/** Round icon button with its label underneath (like a phone's call screen). */
function RoundBtn({ icon, label, onClick, tone, on, pressed }: { icon: string; label: string; onClick: () => void; tone?: 'danger' | 'success'; on?: boolean; pressed?: boolean }) {
  return (
    <div className="cc-ctl">
      <button type="button" className={`cc-round${tone ? ` ${tone}` : ''}${on ? ' on' : ''}`} onClick={onClick} aria-label={label} aria-pressed={pressed}><Ico n={icon} /></button>
      <span aria-hidden="true">{label}</span>
    </div>
  )
}

function CallAvatar({ name, pulse }: { name: string; pulse?: boolean }) {
  return <div className={`cc-avatar${pulse ? ' pulse' : ''}`} aria-hidden="true">{(name.trim()[0] || '?').toUpperCase()}</div>
}

/** The ringing-in card for managers (student calling support) and students (support calling). */
function IncomingCall({ name, role, more, showInfo, onDecline, onAnswer, onInfo }: { name: string; role: 'STUDENT' | 'MANAGER'; more: number; showInfo: boolean; onDecline: () => void; onAnswer: () => void; onInfo: () => void }) {
  return (
    <div className="cc-card" style={overlayStyle} role="alertdialog" aria-modal="true" aria-label="Incoming call">
      <div className="cc-eyebrow">Incoming call</div>
      <CallAvatar name={name} pulse />
      <div className="cc-name">{name}</div>
      <div className="cc-status">{more > 0 ? `+${more} more waiting` : role === 'MANAGER' ? 'Calling support' : 'Calling you'}</div>
      <div className="cc-actions">
        <RoundBtn icon="hangup" label="Decline" tone="danger" onClick={onDecline} />
        {role === 'MANAGER' && showInfo && <RoundBtn icon="user" label="Info" onClick={onInfo} />}
        <RoundBtn icon="phone" label="Answer" tone="success" onClick={onAnswer} />
      </div>
    </div>
  )
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
  const heading = call.missed === 'missed' ? 'No answer' : call.missed === 'closed' ? 'Support is closed' : call.video === 'screen' ? 'Sharing your screen' : 'Support call'
  const name = call.missed === 'missed' ? 'Nobody picked up' : call.missed === 'closed' ? 'Back at 10 AM' : call.title
  return (
    <CallLayer docked={docked}>
    <div className="cc-card" style={{ ...overlayStyle, width: showGrid ? 'min(760px, calc(100vw - 32px))' : overlayStyle.width }} role="dialog" aria-modal="true" aria-label="Support call" aria-live="polite">
      {call.peers.map(p => <MediaEl key={p.id} stream={p.stream} kind="audio" />)}
      {call.cameraAsked && call.video !== 'camera' && call.state !== 'ended' && (
        <div role="alertdialog" aria-label="Camera requested" style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(6px)', borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.12)', color: '#fff' }}><Ico n="video" /></div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Support needs you to turn on your camera</div>
          <button className="gz-btn" style={{ background: '#10b981', color: '#fff', borderColor: '#10b981' }} onClick={call.toggleCamera}>Turn on camera</button>
        </div>
      )}
      <div className="cc-eyebrow">{heading}</div>
      {!showGrid && <CallAvatar name={name} pulse={call.state === 'ringing' || call.state === 'connecting'} />}
      <div className="cc-name">{name}</div>
      <div className="cc-status">{call.state === 'active' && <span className="cc-dot" aria-hidden="true" />}{label}</div>
      {showGrid && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 14, maxHeight: '55vh', overflowY: 'auto' }}>
          {call.peers.map(p => <Tile key={p.id} name={p.name} stream={p.stream} on={p.video !== 'off'} />)}
          <Tile name="You" stream={call.localVideo} on={call.video !== 'off'} mirrored={call.video === 'camera'} />
        </div>
      )}
      <div className="cc-actions">
        {!live ? (
          <div className="cc-stack">
            {call.missed ? (
              <>
                {/* GenZie owns both flows: the call-back picker and the message that becomes a ticket */}
                <button className="gz-btn" onClick={() => { call.reset(); window.dispatchEvent(new Event('genie:callback')) }}>Book a call back</button>
                <button className="gz-btn gz-btn--ghost" onClick={() => { call.reset(); window.dispatchEvent(new Event('genie:message')) }}>Raise a ticket</button>
              </>
            ) : (
              /* Hung up by mistake (either side): manager redials that student, student redials support in hours */
              (onViewStudent ? !!call.studentId : isSupportOpen()) && (
                <button className="gz-btn" onClick={() => { const id = onViewStudent ? call.studentId! : undefined; const name = onViewStudent ? call.title : undefined; call.reset(); startSupportCall(id, name) }}>Call again</button>
              )
            )}
            <button className="gz-btn gz-btn--ghost" onClick={call.reset}>Close</button>
          </div>
        ) : (
          <>
            {onViewStudent && call.studentId && <RoundBtn icon="user" label="Info" onClick={() => onViewStudent(call.studentId!)} />}
            {onViewStudent && <RoundBtn icon="eye" label={call.cameraRequested ? 'Asked' : 'Ask camera'} on={call.cameraRequested} pressed={call.cameraRequested} onClick={call.requestCamera} />}
            <RoundBtn icon={call.muted ? 'micOff' : 'mic'} label={call.muted ? 'Unmute' : 'Mute'} on={call.muted} pressed={call.muted} onClick={call.toggleMute} />
            <RoundBtn icon={call.video === 'camera' ? 'video' : 'videoOff'} label="Camera" on={call.video === 'camera'} pressed={call.video === 'camera'} onClick={call.toggleCamera} />
            {call.canShareScreen && <RoundBtn icon="screen" label={call.video === 'screen' ? 'Stop share' : 'Share'} on={call.video === 'screen'} pressed={call.video === 'screen'} onClick={call.toggleScreen} />}
            <RoundBtn icon="hangup" label="End" tone="danger" onClick={() => call.end()} />
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
  const [profile, setProfile] = useState(false) // open the student's full details
  const act = async (action: string) => { await api(`/api/support/calls/${r.id}`, { method: 'PATCH', body: JSON.stringify({ action }) }).catch(() => {}); onChange() }
  const label = r.type === 'SCHEDULED'
    ? `${r.status === 'REQUESTED' ? 'Wants a call' : 'Booked call'} · ${new Date(r.scheduledFor!).toLocaleString()}`
    : `Missed call · ${new Date(r.createdAt).toLocaleString()}`
  return (
    <div className="gz-sp-row" onClick={() => setProfile(true)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setProfile(true)} style={{ cursor: 'pointer', flexWrap: 'wrap' }}>
      {profile && <ManagerUserModal userId={r.caller.id} onClose={() => setProfile(false)} />}
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.caller.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{label}</div>
        {/* Long GenZie topic trimmed to one line; the full note is on the details page */}
        {r.note && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note}</div>}
      </div>
      {r.type === 'SCHEDULED' && r.status === 'REQUESTED' ? (
        <>
          <button className="gz-btn gz-ed-sm" onClick={e => { e.stopPropagation(); act('approve') }}>Approve</button>
          <button className="gz-btn gz-btn--ghost gz-ed-sm" onClick={e => { e.stopPropagation(); act('decline') }}>Decline</button>
        </>
      ) : (
        <button className="gz-btn gz-btn--ghost gz-ed-sm" onClick={e => { e.stopPropagation(); setProfile(true) }}>Details</button>
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
          <IncomingCall
            name={fromName} role={role} more={fresh.length - 1} showInfo={!profileId}
            onDecline={() => decline(incoming.id)}
            onInfo={() => setProfileId(incoming.caller.id)}
            onAnswer={() => { setRinging(r => r.filter(x => x.id !== incoming.id)); call.accept(incoming.id, fromName) }}
          />
        </CallLayer>
      )}
      <CallOverlay call={call} docked={!!profileId} onViewStudent={role === 'MANAGER' ? setProfileId : undefined} />
      {profileId && <ManagerUserModal userId={profileId} onClose={() => setProfileId(null)} />}
    </>
  )
}
