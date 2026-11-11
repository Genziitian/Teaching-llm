'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { WifiOff, RefreshCw, DownloadCloud, Home } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

interface OfflinePageNoticeProps {
  sectionName?: string
  description?: string
}

export default function OfflinePageNotice({
  sectionName = 'This section',
  description = 'An active internet connection is required to access this feature.',
}: OfflinePageNoticeProps) {
  const { isChecking, retryOrRefresh } = useNetworkStatus()
  const [offlineToast, setOfflineToast] = useState<string | null>(null)

  const handleRetry = async () => {
    const success = await retryOrRefresh()
    if (!success) {
      setOfflineToast('Still offline. Please connect to Wi-Fi or mobile data.')
      setTimeout(() => setOfflineToast(null), 3500)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '65vh',
        padding: '24px 16px',
        width: '100%',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '40px 28px',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Pulsing Wifi Icon */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1.5px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            marginBottom: '24px',
            position: 'relative',
          }}
        >
          <WifiOff size={36} />
        </div>

        <h2
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '10px',
            letterSpacing: '-0.02em',
          }}
        >
          You&apos;re Offline
        </h2>

        <p
          style={{
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            marginBottom: '28px',
            padding: '0 8px',
          }}
        >
          {sectionName} requires an active internet connection. Please check your WiFi or mobile data and try again.
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
          }}
        >
          <button
            onClick={handleRetry}
            disabled={isChecking}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '14px 20px',
              borderRadius: '14px',
              background: 'var(--primary)',
              color: '#ffffff',
              fontSize: '14.5px',
              fontWeight: 700,
              border: 'none',
              cursor: isChecking ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px color-mix(in srgb, var(--primary) 35%, transparent)',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
            {isChecking ? 'Checking Connection…' : 'Retry Connection'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Home size={16} />
              Dashboard
            </Link>
            <button
              onClick={handleRetry}
              disabled={isChecking}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isChecking ? 'wait' : 'pointer',
                opacity: isChecking ? 0.7 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <RefreshCw size={14} style={{ animation: isChecking ? 'spin 1s linear infinite' : 'none' }} />
              {isChecking ? 'Checking…' : 'Try Reconnecting'}
            </button>

            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Home size={14} />
              Dashboard
            </Link>
          </div>
        </div>

        {offlineToast && (
          <div
            style={{
              marginTop: '16px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ef4444',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            ⚠️ {offlineToast}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
