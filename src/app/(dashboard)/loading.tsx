'use client'

import React from 'react'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

export default function DashboardLoading() {
  const loadingFact = useLoadingFact(true)

  return (
    <div className="page-container fade-in" style={{ minHeight: '60vh', padding: '20px 16px' }}>
      {/* Top indeterminate route transition bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          zIndex: 99999,
          background: 'linear-gradient(90deg, var(--primary), #3b82f6, #ec4899, var(--primary))',
          backgroundSize: '200% 100%',
          animation: 'routeTransitionProgress 1.4s ease-in-out infinite',
          boxShadow: '0 1px 8px color-mix(in srgb, var(--primary) 40%, transparent)',
        }}
      />
      <style>{`
        @keyframes routeTransitionProgress {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>

      {/* Loading Fact Card - Displays instantly on 0ms tab navigation */}
      {loadingFact && (
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <LoadingFactCard fact={loadingFact} />
        </div>
      )}

      {/* Instant Skeleton UI: Top hero bar */}
      <div
        className="card skeleton"
        style={{
          height: '110px',
          borderRadius: '20px',
          marginBottom: '20px',
          width: '100%',
        }}
      />

      {/* Instant Skeleton UI: Grid of cards */}
      <div
        className="grid-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
        }}
      >
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="card skeleton"
            style={{
              height: '240px',
              borderRadius: '20px',
            }}
          />
        ))}
      </div>
    </div>
  )
}
