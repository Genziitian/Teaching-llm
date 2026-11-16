'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { TourStep } from './tourSteps'

interface TourOverlayProps {
  active: boolean
  step: TourStep | null
  stepIndex: number
  totalSteps: number
  isManualReplay: boolean
  onNext: () => void
  onBack: () => void
  onSkipRequest: () => void
  onFinish: () => void
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

export default function TourOverlay({
  active,
  step,
  stepIndex,
  totalSteps,
  isManualReplay,
  onNext,
  onBack,
  onSkipRequest,
  onFinish,
}: TourOverlayProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; placement: string }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  })

  // Measures target element rect and calculates intelligent tooltip placement
  const updateBounds = useCallback(() => {
    if (!active || !step) {
      setTargetRect(null)
      return
    }

    const el = document.querySelector(step.targetSelector)
    if (!el) {
      setTargetRect(null)
      return
    }

    const rect = el.getBoundingClientRect()
    const padding = 6
    const measured: TargetRect = {
      top: Math.max(0, rect.top - padding),
      left: Math.max(0, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    }
    setTargetRect(measured)

    // Calculate Tooltip position based on target and viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const tooltipWidth = Math.min(340, viewportWidth - 32)
    const tooltipHeight = 180 // Estimated height

    let placement = step.placementPreference || 'bottom'
    let top = 0
    let left = 0

    if (placement === 'bottom') {
      top = measured.top + measured.height + 12
      left = measured.left + measured.width / 2 - tooltipWidth / 2

      // If overflows bottom, flip to top
      if (top + tooltipHeight > viewportHeight - 16) {
        placement = 'top'
        top = measured.top - tooltipHeight - 12
      }
    } else if (placement === 'top') {
      top = measured.top - tooltipHeight - 12
      left = measured.left + measured.width / 2 - tooltipWidth / 2

      // If overflows top, flip to bottom
      if (top < 16) {
        placement = 'bottom'
        top = measured.top + measured.height + 12
      }
    } else if (placement === 'right') {
      left = measured.left + measured.width + 12
      top = measured.top + measured.height / 2 - tooltipHeight / 2

      // If overflows right, flip to left or bottom
      if (left + tooltipWidth > viewportWidth - 16) {
        left = measured.left - tooltipWidth - 12
        placement = 'left'
      }
    } else if (placement === 'left') {
      left = measured.left - tooltipWidth - 12
      top = measured.top + measured.height / 2 - tooltipHeight / 2

      // If overflows left, flip to right
      if (left < 16) {
        left = measured.left + measured.width + 12
        placement = 'right'
      }
    }

    // Horizontal bounds containment
    left = Math.max(16, Math.min(left, viewportWidth - tooltipWidth - 16))
    // Vertical bounds containment
    top = Math.max(16, Math.min(top, viewportHeight - tooltipHeight - 16))

    setTooltipPos({ top, left, placement })
  }, [active, step])

  useEffect(() => {
    updateBounds()
    window.addEventListener('resize', updateBounds)
    window.addEventListener('scroll', updateBounds, true)
    const interval = setInterval(updateBounds, 300)
    return () => {
      window.removeEventListener('resize', updateBounds)
      window.removeEventListener('scroll', updateBounds, true)
      clearInterval(interval)
    }
  }, [updateBounds])

  // Keyboard navigation handlers (Escape to skip, Left/Right arrows)
  useEffect(() => {
    if (!active) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onSkipRequest()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        if (stepIndex === totalSteps - 1) onFinish()
        else onNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (stepIndex > 0) onBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, stepIndex, totalSteps, onNext, onBack, onSkipRequest, onFinish])

  if (!active || !step) return null

  const isLastStep = stepIndex === totalSteps - 1

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        pointerEvents: 'auto',
      }}
      aria-label="App Tour Spotlight"
      role="dialog"
    >
      {/* Spotlight Backdrop SVG cut-out */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          transition: 'all 0.25s ease',
        }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.68)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Target Glowing Pulsing Border */}
      {targetRect && (
        <div
          style={{
            position: 'absolute',
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
            borderRadius: '12px',
            border: '2px solid var(--primary, #4F46E5)',
            boxShadow: '0 0 16px rgba(128, 128, 128, 0.5), inset 0 0 8px rgba(128, 128, 128, 0.25)',
            pointerEvents: 'none',
            transition: 'all 0.25s ease-out',
            animation: 'tourPulse 2s infinite ease-in-out',
          }}
        />
      )}

      {/* Tooltip Card */}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
          width: 'calc(100vw - 32px)',
          maxWidth: '340px',
          background: 'var(--surface, #ffffff)',
          color: 'var(--text-primary, #1e293b)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.35), 0 0 0 1px var(--border, rgba(226,232,240,0.8))',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto',
        }}
      >
        {/* Header with Title & Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
            {step.title}
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: '14px',
              background: 'var(--surface-2, #f1f5f9)',
              color: 'var(--primary, #4f46e5)',
            }}
          >
            {stepIndex + 1} of {totalSteps}
          </div>
        </div>

        {/* Content Body */}
        <p
          style={{
            fontSize: '13px',
            lineHeight: '1.5',
            color: 'var(--text-secondary, #475569)',
            marginBottom: '18px',
          }}
        >
          {step.content}
        </p>

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={onSkipRequest}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '6px 8px',
            }}
          >
            Skip Tour
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: 'var(--surface-2, #f1f5f9)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '10px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #334155)',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={isLastStep ? onFinish : onNext}
              style={{
                background: 'var(--primary, #4f46e5)',
                border: 'none',
                borderRadius: '10px',
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(128, 128, 128, 0.3)',
              }}
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tourPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.01); }
        }
      `}} />
    </div>
  )
}
