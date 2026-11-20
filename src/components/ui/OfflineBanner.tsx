'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { WifiOff, RefreshCw, DownloadCloud } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

interface OfflineBannerProps {
  cachedAt?: string | null
  showDownloadsLink?: boolean
}

export default function OfflineBanner({ cachedAt, showDownloadsLink = true }: OfflineBannerProps) {
  const { isOnline, isChecking, retryOrRefresh } = useNetworkStatus()
  const [offlineToast, setOfflineToast] = useState<string | null>(null)

  if (isOnline) return null

  const handleRetry = async () => {
    const success = await retryOrRefresh()
    if (!success) {
      setOfflineToast('Still offline. Please check your internet connection.')
      setTimeout(() => setOfflineToast(null), 3500)
    }
  }

  const formattedDate = cachedAt
    ? new Date(cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    : null

  return (
    <div
      style={{
        width: '100%',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.12))',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '12px',
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        color: 'var(--text-primary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            flexShrink: 0,
          }}
        >
          <WifiOff size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              You&apos;re Offline
            </span>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                display: 'inline-block',
              }}
            />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {formattedDate ? `Showing snapshot cached on ${formattedDate}.` : 'Showing offline cached view.'}{' '}
            Live sessions, purchases, and community are offline.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={handleRetry}
          disabled={isChecking}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'var(--primary)',
            border: 'none',
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#ffffff',
            cursor: isChecking ? 'wait' : 'pointer',
            opacity: isChecking ? 0.7 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          <RefreshCw size={13} style={{ animation: isChecking ? 'spin 1s linear infinite' : 'none' }} />
          {isChecking ? 'Checking…' : 'Try Reconnecting'}
        </button>
      </div>

      {offlineToast && (
        <div
          style={{
            width: '100%',
            fontSize: '11.5px',
            fontWeight: 600,
            color: '#ef4444',
            marginTop: '2px',
          }}
        >
          ⚠️ {offlineToast}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
