'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import QuizLabSurprise from '@/components/home/QuizLabSurprise'
import { activeBanner, isFestivalMainDay, type FestivalBanner } from '@/lib/seasonal/seasons'
import { useSeasonalTick } from './useSeasonalTick'

// Festival art is only downloaded on festival days.
const FestivalGreeting = dynamic(() => import('./FestivalGreeting'), { ssr: false })

/**
 * The dashboard's big announcement slot. Which one shows on which day is set
 * in BANNER_SCHEDULE (src/lib/seasonal/seasons.ts):
 *   Quiz Lab → Diwali (8–9 Nov) → Quiz Lab → Chhath + exam wishes (15–16 Nov) → nothing → Christmas (25 Dec)
 */
export default function HomeFestiveSlot() {
  const [banner, setBanner] = useState<FestivalBanner>('none')
  const tick = useSeasonalTick()

  useEffect(() => {
    setBanner(activeBanner())
  }, [tick])

  if (banner === 'quizlab') return <QuizLabSurprise />
  if (banner === 'diwali' || banner === 'chhath' || banner === 'christmas') return <FestivalGreeting key={`${banner}-${tick}`} festival={banner} autoOpen={isFestivalMainDay(banner)} />
  return null
}
