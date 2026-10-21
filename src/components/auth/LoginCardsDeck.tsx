'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SLIDES = [
  { src: '/login-cards/courses.webp', label: 'Courses' },
  { src: '/login-cards/notes.webp', label: 'Notes' },
  { src: '/login-cards/live.webp', label: 'Live' },
  { src: '/login-cards/community.webp', label: 'Community' },
  { src: '/login-cards/free.webp', label: 'Free resources' },
]

/** Cards that glide on their own, can be swiped, tilt toward the mouse and jump from the chips (same cards as the app). */
export default function LoginCardsDeck() {
  const [cur, setCur] = useState(0)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const deckRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const startX = useRef<number | null>(null)
  const reduce = useRef(false)
  const N = SLIDES.length

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }, [])
  const play = useCallback(() => {
    stop()
    if (reduce.current) return
    timer.current = setInterval(() => setCur(c => (c + 1) % N), 3800)
  }, [N, stop])

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    play()
    return stop
  }, [play, stop])

  const go = (n: number) => setCur(((n % N) + N) % N)
  const half = Math.floor(N / 2)

  return (
    <>
      <div className="lg-deckwrap">
        <div
          ref={deckRef}
          className="lg-deck"
          onPointerDown={e => { startX.current = e.clientX; stop() }}
          onPointerUp={e => {
            if (startX.current !== null) {
              const dx = e.clientX - startX.current
              if (Math.abs(dx) > 30) go(cur + (dx < 0 ? 1 : -1))
              startX.current = null
              play()
            }
          }}
          onPointerCancel={() => { startX.current = null; play() }}
          onPointerMove={e => {
            const r = deckRef.current?.getBoundingClientRect()
            if (!r) return
            setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 })
          }}
          onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        >
          {SLIDES.map((s, i) => {
            const d = ((i - cur + N + half) % N) - half
            const a = Math.abs(d)
            return (
              <figure
                key={s.src}
                className="lg-slide"
                aria-hidden={a !== 0}
                style={{
                  zIndex: 10 - a,
                  opacity: a > 1 ? 0 : 1 - 0.5 * a,
                  filter: a ? 'saturate(.7) brightness(.8)' : 'none',
                  transform: `translateX(${d * 40}%) translateY(${a * 3}%) rotateY(${-d * 16 + (a ? 0 : tilt.x * 6)}deg) rotateX(${a ? 0 : -tilt.y * 4}deg) rotate(${d * 3}deg) scale(${1 - 0.16 * a})`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.label} draggable={false} />
              </figure>
            )
          })}
        </div>
      </div>
      <div className="lg-chips" role="tablist" aria-label="What you get">
        {SLIDES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            role="tab"
            aria-selected={i === cur}
            className={`lg-chip${i === cur ? ' on' : ''}`}
            onClick={() => { go(i); play() }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </>
  )
}
