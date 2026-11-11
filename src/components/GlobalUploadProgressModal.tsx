'use client'

import { useState, useEffect, useRef } from 'react'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

export default function GlobalUploadProgressModal() {
  const [progress, setProgress] = useState<number | null>(null)
  const [fileName, setFileName] = useState('')
  const currentTokenRef = useRef<string | null>(null)
  const fact = useLoadingFact(progress !== null)

  useEffect(() => {
    const handleStart = (e: any) => {
      const { fileName, token } = e.detail || {}
      setProgress(0)
      setFileName(fileName || 'file')
      currentTokenRef.current = token || null
    }

    const handleProgress = (e: any) => {
      const { pct } = e.detail || {}
      if (pct !== undefined) {
        setProgress(pct)
      }
    }

    const handleComplete = () => {
      setProgress(null)
      setFileName('')
      currentTokenRef.current = null
    }

    window.addEventListener('app-upload-start', handleStart)
    window.addEventListener('app-upload-progress', handleProgress)
    window.addEventListener('app-upload-complete', handleComplete)
    window.addEventListener('app-upload-error', handleComplete)

    return () => {
      window.removeEventListener('app-upload-start', handleStart)
      window.removeEventListener('app-upload-progress', handleProgress)
      window.removeEventListener('app-upload-complete', handleComplete)
      window.removeEventListener('app-upload-error', handleComplete)
    }
  }, [])

  if (progress === null) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 99999, padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '24px',
        border: '1px solid var(--border)', width: '100%', maxWidth: '400px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)', padding: '28px',
        display: 'flex', flexDirection: 'column', gap: '20px',
        alignItems: 'center', textAlign: 'center', color: 'var(--text-primary)',
        fontFamily: 'inherit'
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%', background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
          marginBottom: '4px'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }}>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
        
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '0 0 6px 0' }}>Uploading Attachment</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all', margin: 0 }}>{fileName}</p>
        </div>

        <div style={{ width: '100%', background: 'var(--surface-2)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, background: 'var(--primary)', height: '100%', borderRadius: '4px', transition: 'width 0.15s ease-out' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px', fontWeight: '750', color: 'var(--text-secondary)' }}>
          <span>{progress}% Complete</span>
          <span>20 MB max limit</span>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: '600', background: 'rgba(245,158,11,0.06)', padding: '10px 14px', borderRadius: '10px', lineHeight: '1.4' }}>
          ⚠️ Please stay on this page. Navigating away or closing it will cancel the upload process.
        </div>

        {fact && (
          <div style={{ width: '100%' }}>
            <LoadingFactCard fact={fact} />
          </div>
        )}

        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('app-upload-cancel', { detail: { token: currentTokenRef.current } }))
          }}
          style={{
            width: '100%', padding: '12px 0', borderRadius: '12px', border: 'none',
            background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: '800',
            fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--danger-light)'}
        >
          Cancel Upload
        </button>
      </div>
    </div>
  )
}
