'use client'

import { useEffect, useRef, useState } from 'react'

export interface HeroSlide {
  image: string
  alt: string
  href: string
}

interface Props {
  slides: HeroSlide[]
  intervalMs?: number
}

export default function HomeHeroSlider({ slides, intervalMs = 4500 }: Props) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchDeltaX = useRef(0)

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const t = setInterval(() => setIndex(i => (i + 1) % slides.length), intervalMs)
    return () => clearInterval(t)
  }, [paused, slides.length, intervalMs])

  if (slides.length === 0) return null

  const go = (i: number) => setIndex((i + slides.length) % slides.length)

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchDeltaX.current = 0
    setPaused(true)
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current
  }
  function onTouchEnd() {
    const dx = touchDeltaX.current
    if (Math.abs(dx) > 50) go(dx < 0 ? index + 1 : index - 1)
    touchStartX.current = null
    touchDeltaX.current = 0
    setTimeout(() => setPaused(false), 1500)
  }

  function handleSlideClick(href: string) {
    try {
      const w = window.open(href, '_blank', 'noopener,noreferrer')
      if (!w) window.location.href = href
    } catch {
      window.location.href = href
    }
  }

  return (
    <div
      className="home-hero-slider gz-panel gz-hero"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="gz-hero__viewport">
        <div
          className="gz-hero__track"
          style={{ width: `${slides.length * 100}%`, transform: `translateX(-${index * (100 / slides.length)}%)` }}
        >
          {slides.map((s, i) => (
            <button
              key={s.image}
              onClick={() => handleSlideClick(s.href)}
              aria-label={s.alt}
              className="gz-hero__slide"
              style={{ flex: `0 0 ${100 / slides.length}%` }}
            >
              <img src={s.image} alt={s.alt} loading={i === 0 ? 'eager' : 'lazy'} />
            </button>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="gz-hero__bar">
          <div className="gz-hero__dots">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{ width: i === index ? 20 : 5, background: i === index ? 'var(--gz-ink)' : 'var(--gz-line-hover)' }}
              />
            ))}
          </div>
          <div className="gz-hero__arrows">
            <button aria-label="Previous slide" onClick={() => go(index - 1)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button aria-label="Next slide" onClick={() => go(index + 1)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
