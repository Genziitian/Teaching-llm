'use client'

import { useState } from 'react'
import { describeCommunityAttachment } from '@/lib/community-attachment'

export default function CommunityAttachment({ url, native = false, onImageClick }: {
  url: string; native?: boolean; onImageClick: (url: string) => void
}) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const attachment = describeCommunityAttachment(url)
  if (!attachment) return <span>Attachment link is unavailable.</span>

  async function openNative() {
    if (!attachment || opening) return
    setOpening(true)
    setError(null)
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { FileOpener } = await import('@capacitor-community/file-opener')
      const filename = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const file = await Filesystem.downloadFile({
        url: new URL(url, window.location.origin).href,
        path: `community-${Date.now()}-${filename}${filename.toLowerCase().endsWith(`.${attachment.extension}`) ? '' : `.${attachment.extension || 'bin'}`}`,
        directory: Directory.Cache,
      })
      await FileOpener.open({ filePath: file.path, contentType: attachment.mimeType })
    } catch {
      try {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url: new URL(url, window.location.origin).href })
      } catch { setError('Could not open this attachment. Please try again.') }
    } finally { setOpening(false) }
  }

  if (attachment.isImage && !imageFailed) return <img
    src={url} alt="Shared image" onClick={() => onImageClick(url)}
    onError={() => setImageFailed(true)}
    style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '12px', cursor: 'pointer', display: 'block', objectFit: 'contain' }}
  />

  return <div style={{ margin: '6px 0', maxWidth: '100%' }}>
    <a href={url} target="_blank" rel="noopener noreferrer"
      onClick={event => {
        event.stopPropagation()
        if (native) { event.preventDefault(); void openNative() }
      }}
      aria-label={`Open ${attachment.name}`} aria-busy={opening}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)', textDecoration: 'none' }}>
      <span aria-hidden="true" style={{ fontWeight: 600, fontSize: '11px', color: 'var(--primary)' }}>{attachment.extension.toUpperCase() || 'FILE'}</span>
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontWeight: 600, fontSize: '13px' }}>{attachment.name}</span>
      <span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{opening ? 'Opening…' : 'Open ↗'}</span>
    </a>
    {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: '12px' }}>{error}</p>}
  </div>
}
