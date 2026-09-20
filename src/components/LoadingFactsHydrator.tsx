'use client'

import { useEffect } from 'react'
import { setRuntimeLoadingFacts } from '@/lib/facts/loading-fact-manager'
import { LoadingFact } from '@/lib/facts/loading-facts-data'

const CACHE_KEY = 'genz_loading_facts_pool'

export async function refreshRuntimeLoadingFacts() {
  const res = await fetch('/api/facts')
  if (!res.ok) return
  const data = await res.json()
  const facts = Array.isArray(data?.facts) ? data.facts : []
  if (facts.length === 0) return
  setRuntimeLoadingFacts(facts)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(facts))
  } catch {
    // quota exceeded
  }
}

export default function LoadingFactsHydrator() {
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as LoadingFact[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRuntimeLoadingFacts(parsed)
        }
      }
    } catch {
      // ignore corrupt cache
    }

    refreshRuntimeLoadingFacts().catch(() => {
      // keep static fallback
    })
  }, [])

  return null
}
