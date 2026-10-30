'use client'

import { useEffect, useState } from 'react'
import { SEASONAL_EVENT } from '@/lib/seasonal/seasons'

/** Re-renders whenever festive settings change (this tab or another tab). */
export function useSeasonalTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick(t => t + 1)
    window.addEventListener(SEASONAL_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(SEASONAL_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])
  return tick
}
