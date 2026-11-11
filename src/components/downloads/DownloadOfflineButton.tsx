'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { DownloadCloud, CheckCircle2, Trash2, Loader2, BookOpen } from 'lucide-react'
import {
  getDownloadedNote,
  saveDownloadedNote,
  deleteDownloadedNote,
  requestStoragePersistence,
  OfflineNoteRecord,
} from '@/lib/offline-db'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

interface DownloadOfflineButtonProps {
  contentId: string
  contentType: 'LECTURE_NOTE' | 'STUDY_MATERIAL'
  downloadUrl: string
  title: string
  courseId?: string | null
  courseName?: string | null
  userId?: string | null
  compact?: boolean
  onOpenOffline?: (record: OfflineNoteRecord) => void
  onStatusChange?: (isDownloaded: boolean) => void
}

export default function DownloadOfflineButton({
  contentId,
  contentType,
  downloadUrl,
  title,
  courseId,
  courseName,
  userId,
  compact = false,
  onOpenOffline,
  onStatusChange,
}: DownloadOfflineButtonProps) {
  const { isOnline } = useNetworkStatus()
  const [downloadedRecord, setDownloadedRecord] = useState<OfflineNoteRecord | null>(null)
  const [isDownloading, setIsDownloading] = useState<boolean>(false)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Check if note is already saved in IndexedDB
  const checkStatus = useCallback(async () => {
    if (!userId || !contentId) return
    try {
      const existing = await getDownloadedNote(userId, contentId)
      setDownloadedRecord(existing)
      if (onStatusChange) onStatusChange(!!existing)
    } catch (e) {
      console.error('Error checking offline note status:', e)
    }
  }, [userId, contentId, onStatusChange])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId) {
      setErrorMsg('Please log in to download.')
      return
    }
    if (!isOnline) {
      setErrorMsg('Connect to the internet to download.')
      return
    }

    setIsDownloading(true)
    setDownloadProgress(0)
    setErrorMsg(null)

    try {
      // Request persistent storage in background
      requestStoragePersistence().catch(() => {})

      const response = await fetch(downloadUrl)
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`)
      }

      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

      let blob: Blob

      if (response.body && totalBytes > 0) {
        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let receivedBytes = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            receivedBytes += value.length
            setDownloadProgress(Math.min(99, Math.round((receivedBytes / totalBytes) * 100)))
          }
        }

        blob = new Blob(chunks as any[], { type: 'application/pdf' })
      } else {
        // Fallback if stream / content-length is not available
        blob = await response.blob()
      }

      const record: OfflineNoteRecord = {
        id: `${userId}_${contentId}`,
        userId,
        contentId,
        contentType,
        courseId: courseId || null,
        courseName: courseName || null,
        title: title || 'Untitled Note',
        fileBlob: blob,
        fileSize: blob.size,
        downloadedAt: new Date().toISOString(),
        version: '1.0',
      }

      await saveDownloadedNote(record)
      setDownloadedRecord(record)
      setDownloadProgress(100)
      if (onStatusChange) onStatusChange(true)
    } catch (err: any) {
      console.error('Offline download failed:', err)
      setErrorMsg(err.message || 'Failed to download for offline use.')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!userId || !contentId) return
    try {
      await deleteDownloadedNote(userId, contentId)
      setDownloadedRecord(null)
      if (onStatusChange) onStatusChange(false)
    } catch (err) {
      console.error('Failed to delete offline note:', err)
    }
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (downloadedRecord && onOpenOffline) {
      onOpenOffline(downloadedRecord)
    }
  }

  if (isDownloading) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: compact ? '6px 12px' : '8px 16px',
          borderRadius: '12px',
          background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
          color: 'var(--primary)',
          fontSize: compact ? '12px' : '13px',
          fontWeight: 600,
        }}
      >
        <Loader2 size={15} className="animate-spin" />
        <span>Downloading {downloadProgress > 0 ? `${downloadProgress}%` : '…'}</span>
      </div>
    )
  }

  if (downloadedRecord) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={handleOpen}
          title="Open downloaded offline copy"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: compact ? '6px 12px' : '8px 16px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontSize: compact ? '12px' : '13px',
            fontWeight: 700,
            cursor: onOpenOffline ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
          }}
        >
          <CheckCircle2 size={15} />
          <span>Downloaded ✓</span>
        </button>

        <button
          onClick={handleDelete}
          title="Remove offline copy"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: compact ? '30px' : '34px',
            height: compact ? '30px' : '34px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      <button
        onClick={handleDownload}
        disabled={!isOnline}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: compact ? '6px 12px' : '8px 16px',
          borderRadius: '12px',
          background: isOnline ? 'var(--surface-2)' : 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border)',
          color: isOnline ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: compact ? '12px' : '13px',
          fontWeight: 600,
          cursor: isOnline ? 'pointer' : 'not-allowed',
          opacity: isOnline ? 1 : 0.6,
          transition: 'all 0.2s ease',
        }}
        title={!isOnline ? 'Connect to internet to download' : 'Save for offline viewing'}
      >
        <DownloadCloud size={15} style={{ color: isOnline ? 'var(--primary)' : 'inherit' }} />
        <span>Download for Offline</span>
      </button>

      {errorMsg && (
        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>
          {errorMsg}
        </span>
      )}
    </div>
  )
}
