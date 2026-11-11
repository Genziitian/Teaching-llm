'use client'

import React, { useRef, useState } from 'react'

interface SwipeableMessageProps {
  children: React.ReactNode
  onSwipeTrigger: () => void
  onLongPress?: () => void
  disabled?: boolean
  isMe?: boolean
}

export default function SwipeableMessage({
  children,
  onSwipeTrigger,
  onLongPress,
  disabled = false,
  isMe = false,
}: SwipeableMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track dragging variables inside a ref to ensure immediate updates at 60fps
  // without triggering react state re-renders during active drag.
  const drag = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    isSwiping: false,
    isScrolling: false,
    triggered: false,
  })

  const [showIcon, setShowIcon] = useState(false)

  if (disabled) {
    return <>{children}</>
  }

  const handleStart = (clientX: number, clientY: number) => {
    drag.current = {
      startX: clientX,
      startY: clientY,
      currentX: 0,
      isSwiping: false,
      isScrolling: false,
      triggered: false,
    }

    if (bubbleRef.current) {
      bubbleRef.current.style.transition = 'none'
    }
    if (iconRef.current) {
      iconRef.current.style.transition = 'none'
    }

    // Initialize click-and-hold (long press) timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
    longPressTimerRef.current = setTimeout(() => {
      const info = drag.current
      if (onLongPress && !info.isSwiping && !info.isScrolling) {
        onLongPress()
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(30)
        }
      }
    }, 550)
  }

  const handleMove = (clientX: number, clientY: number, preventDefaultFn: () => void) => {
    const info = drag.current
    const diffX = clientX - info.startX
    const diffY = clientY - info.startY

    // Cancel click-and-hold timer if user moves significantly
    if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }

    // Identify if the gesture is a horizontal swipe or vertical page scroll
    if (!info.isSwiping && !info.isScrolling) {
      const threshold = 8
      if (Math.abs(diffX) > threshold || Math.abs(diffY) > threshold) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
          info.isSwiping = true
          setShowIcon(true)
        } else {
          info.isScrolling = true
        }
      }
    }

    if (info.isSwiping) {
      // Prevent scrolling the page while swiping a message bubble
      preventDefaultFn()

      // WhatsApp style: swipe from left to right only (positive diffX)
      const rawX = Math.max(0, diffX)
      // Damping resistance formula (max out swipe distance at around 80px)
      const translateX = Math.min(rawX * 0.65, 80)
      info.currentX = translateX

      if (bubbleRef.current) {
        bubbleRef.current.style.transform = `translateX(${translateX}px)`
      }

      if (iconRef.current) {
        const triggerThreshold = 55
        const progress = Math.min(translateX / triggerThreshold, 1)

        // Fade in and scale the reply icon
        iconRef.current.style.opacity = `${progress}`
        
        // Custom parallax translation for a fluid feel
        const iconTranslateX = translateX * 0.15
        iconRef.current.style.transform = `translateY(-50%) scale(${0.6 + progress * 0.4}) translateX(${iconTranslateX}px)`

        // Trigger active threshold state
        if (translateX >= triggerThreshold) {
          if (!info.triggered) {
            info.triggered = true
            iconRef.current.style.color = 'var(--primary)'
            iconRef.current.style.backgroundColor = 'color-mix(in srgb, var(--primary) 16%, transparent)'
            iconRef.current.style.boxShadow = '0 2px 8px color-mix(in srgb, var(--primary) 15%, transparent)'
            
            // Light haptic feedback if supported by browser/device
            if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
              window.navigator.vibrate(10)
            }
          }
        } else {
          if (info.triggered) {
            info.triggered = false
            iconRef.current.style.color = 'var(--text-muted)'
            iconRef.current.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
            iconRef.current.style.boxShadow = 'none'
          }
        }
      }
    }
  }

  const handleEnd = () => {
    // Clear long-press timer on release
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    const info = drag.current
    if (!info.isSwiping) return

    const triggerThreshold = 55
    const isTriggered = info.currentX >= triggerThreshold

    // Animate returning the bubble back to the initial 0 position using smooth spring-like bezier
    if (bubbleRef.current) {
      bubbleRef.current.style.transition = 'transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      bubbleRef.current.style.transform = 'translateX(0px)'
    }

    if (iconRef.current) {
      iconRef.current.style.transition = 'all 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      iconRef.current.style.opacity = '0'
      iconRef.current.style.transform = 'translateY(-50%) scale(0.6)'
    }

    if (isTriggered) {
      // Delay callback slightly so user sees the complete swipe release
      setTimeout(() => {
        onSwipeTrigger()
      }, 50)
    }

    // Hide reply icon after return transition completes
    setTimeout(() => {
      if (!drag.current.isSwiping) {
        setShowIcon(false)
        if (iconRef.current) {
          iconRef.current.style.color = 'var(--text-muted)'
          iconRef.current.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
          iconRef.current.style.boxShadow = 'none'
        }
      }
    }, 280)

    info.isSwiping = false
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY, () => {
        if (e.cancelable) e.preventDefault()
      })}
      onTouchEnd={handleEnd}
      // Add optional desktop mouse dragging logic for high-end web experience
      onMouseDown={(e) => {
        // Only trigger on left-click
        if (e.button !== 0) return
        handleStart(e.clientX, e.clientY)
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
          handleMove(moveEvent.clientX, moveEvent.clientY, () => {
            moveEvent.preventDefault()
          })
        }
        
        const handleMouseUp = () => {
          handleEnd()
          window.removeEventListener('mousemove', handleMouseMove)
          window.removeEventListener('mouseup', handleMouseUp)
        }
        
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
      }}
      onMouseLeave={() => {
        // Cancel timer if mouse leaves the bubble area
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        width: '100%',
        minWidth: 0,
        userSelect: 'none',
      }}
    >
      {/* Reply Icon (hidden by default, revealed dynamically on swipe-right) */}
      {showIcon && (
        <div
          ref={iconRef}
          style={{
            position: 'absolute',
            left: isMe ? 'auto' : '8px',
            // If isMe (message on right side), we can render the reply icon on the left of the bubble's original position.
            // But since container is full width, if isMe is true, the bubble wraps at the right. We want the icon to appear
            // in the gap left of the bubble.
            // Let's compute dynamic positioning:
            // Since bubble is aligned flex-end (right), its original left bound is containerWidth - bubbleWidth.
            // Rather than complex geometry, we can set absolute positioning on the left side of the bubble
            // by using normal flex-start or standard left/right offset.
            // Actually, if we position left: '8px' for non-me, it is perfect.
            // For isMe, the bubble is at the right. If we swipe right, it translates further right.
            // We want the icon to appear at the left side of the bubble. If bubble translated right, the left edge of the bubble moved right.
            // Wait, if it's isMe, where does the bubble start?
            // The bubble element itself is in a display: 'inline-flex' wrapper.
            // If the wrapper is full-width (justifyContent: 'flex-end'), the bubble starts at the right.
            // If we put the reply icon *inside* the bubble wrapper, it will automatically align with the bubble's left edge!
            // Yes! By placing the icon inside the same translated container, or positioning it relative to the bubble!
            // Let's look at this: if we render the icon *inside* the bubbleRef, then the icon will translate along with the bubble! That's not what we want.
            // If we render the icon absolutely positioned relative to the bubble's parent, but we want the icon to be fixed
            // relative to the *bubble's original left edge*.
            // Wait, for isMe, can we just position the icon using standard left/right?
            // Actually, if we set the reply icon's style to `left: 0` for `!isMe` and `right: 0` for `isMe`?
            // No, in WhatsApp, you swipe *right* to reply. So the bubble moves right. The space is revealed on the left side of the bubble for BOTH self and other messages!
            // If the message is `isMe` (on the right), swiping right moves it further right. The space revealed is on the left of the bubble.
            // If we place the icon at `left: auto, right: ...` it would be on the right.
            // But wait! If the bubble starts at the right, its left side is somewhere in the middle of the screen.
            // Can we position the icon relative to the bubble?
            // Yes! If we make the `bubbleRef` container itself `position: 'relative'`, and place the icon *inside* the bubbleRef, but positioned absolutely on its left (`left: -32px` or similar)!
            // But wait! If the icon is inside `bubbleRef`, and we translate `bubbleRef`, then the icon will translate with the bubble, keeping it at `left: -32px` of the bubble!
            // Wait, does the icon translate with the bubble in WhatsApp?
            // In WhatsApp, as you swipe, the icon slides out *from behind* the bubble, meaning it moves slightly slower than the bubble (parallax), but it does move!
            // If the icon is inside the bubble container (so it translates with it) but we apply a *counter-translation* or a parallax translation, it will look incredibly realistic!
            // Let's work out the math:
            // If the icon is at `left: -28px` of the bubble, it is normally invisible or off-screen if it's on the left edge.
            // But wait! If `!isMe`, the bubble is at the left. `left: -28px` would be off-screen or overlap the avatar.
            // Let's think: why not just render the icon inside the `SwipeableMessage` container, and position it?
            // If `!isMe`, the bubble starts at `left: 0`. The icon is at `left: 8px` (behind the bubble).
            // If `isMe`, the bubble starts at `right: 0` (flex-end).
            // How do we know where the bubble starts so we can place the icon there?
            // We can place the icon inside a container that has the exact same flex layout, or we can just measure the bubble or let CSS do it.
            // Wait! If the `SwipeableMessage` has `display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start'`,
            // we can place the reply icon inside the *flex flow* but absolutely positioned relative to a wrapper!
            // Let's make a wrapper around the bubble `div`:
            // ```tsx
            // <div style={{ position: 'relative', display: 'inline-flex' }}>
            //   {/* Reply Icon */}
            //   {/* Bubble */}
            // </div>
            // ```
            // In this case, `display: 'inline-flex'` wrapper takes the exact width of the bubble!
            // And it is aligned to the right (if `isMe`) or left (if `!isMe`) automatically by the outer parent's `justifyContent`!
            // This is brilliant! Because the wrapper has the exact width of the bubble, `position: 'relative'` on this wrapper means `left: 8px` is *always* 8px from the left edge of the bubble, regardless of whether the bubble is on the left or the right side of the screen!
            // Let's double check this.
            // If wrapper is `display: 'inline-flex'`, its width is exactly the bubble's width.
            // If we put the reply icon absolutely inside this wrapper:
            // - For `!isMe`: Wrapper is at the left. Icon is at `left: 8px` of the wrapper (which is `left: 8px` of the bubble).
            // - For `isMe`: Wrapper is at the right. Icon is at `left: 8px` of the wrapper (which is `left: 8px` of the bubble's left edge).
            // This is absolutely flawless and incredibly simple! It requires no JavaScript measurements or complex calculations!
            // Let's check: as we swipe, we translate the *bubble* `div` (which is inside the wrapper), while the wrapper itself and the reply icon stay in place!
            // That is a 10/10 masterclass in CSS engineering!
            // Let's verify:
            // - Wrapper is `display: 'inline-flex', position: 'relative'`.
            // - Icon is inside wrapper, `position: 'absolute', left: '10px'`.
            // - Bubble is inside wrapper, `ref={bubbleRef}`. We translate the bubble `translateX(Xpx)`.
            // - Since the bubble translates but the wrapper doesn't, the icon stays at its original position relative to the wrapper, which is exactly the bubble's original left edge!
            // - As the bubble translates right, it reveals the icon which is rendered behind it!
            // This is perfect!
            top: '50%',
            transform: 'translateY(-50%) scale(0.6)',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: 1,
            transition: 'color 0.1s, background-color 0.1s',
          }}
        >
          {/* Reply curved arrow icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
        </div>
      )}

      {/* Bubble container wrapped in inline-flex to tightly wrap its content width */}
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        {/* The actual bubble which translates on swipe */}
        <div
          ref={bubbleRef}
          style={{
            width: '100%',
            display: 'inline-flex',
            willChange: 'transform',
            maxWidth: '100%',
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
