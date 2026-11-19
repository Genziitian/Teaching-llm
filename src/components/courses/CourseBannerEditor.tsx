'use client'

import { useEffect, useRef, useState } from 'react'

/** Recommended banner size. The header shows it at ~2.13:1; cards crop slightly (object-fit: cover). */
export const BANNER_W = 1600
export const BANNER_H = 750
const MAX_MB = 20 // before compression; the saved file is shrunk to a few hundred KB
const SERVER_MAX = 5 * 1024 * 1024

/** Resize to BANNER_W wide and re-encode as WebP in the browser, so uploads and page loads stay fast. */
async function compress(f: File, width = BANNER_W): Promise<File> {
  try {
    const bmp = await createImageBitmap(f)
    const scale = Math.min(1, width / bmp.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.82))
    if (!blob || blob.size >= f.size) return f // keep the original if it is already smaller
    return new File([blob], f.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' })
  } catch {
    return f
  }
}

interface Props {
  courseId: string
  currentUrl?: string | null
  fallbackUrl: string
  onChange: (url: string | null) => void
}

export default function CourseBannerEditor({ courseId, currentUrl, fallbackUrl, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [thumb, setThumb] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy])

  const close = () => {
    setOpen(false); setFile(null); setPreview(null); setDims(null); setError('')
  }

  const pick = (f: File | null) => {
    setError('')
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { setError('Use a JPG, PNG or WebP image.'); return }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`Image is too large. Maximum ${MAX_MB} MB.`); return }
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
    setPreview(url); setFile(null)
    setThumb(null)
    void Promise.all([compress(f), compress(f, 640)]).then(([big, small]) => {
      if (big.size > SERVER_MAX) { setError('Image is still too large after compression. Try a smaller one.'); return }
      setFile(big); setThumb(small) // small copy is what the Courses list cards load
    })
  }

  const save = async () => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const fd = new FormData()
      fd.append('banner', file)
      if (thumb) fd.append('thumb', thumb)
      const res = await fetch(`/api/courses/${courseId}/banner`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onChange(data.bannerUrl)
      close()
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/courses/${courseId}/banner`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not reset')
      onChange(null)
      close()
    } catch (e: any) {
      setError(e.message || 'Could not reset')
    } finally {
      setBusy(false)
    }
  }

  const small = dims && (dims.w < 960 || dims.h < 450)
  const ratioOff = dims && Math.abs(dims.w / dims.h - BANNER_W / BANNER_H) > 0.25

  return (
    <>
      <button type="button" className="gz-bn-edit" onClick={() => setOpen(true)} aria-label="Change course photo" title="Change course photo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        <span>Change photo</span>
      </button>

      {open && (
        <div className="gz-modal-scrim gz-bn-scrim" onClick={() => !busy && close()}>
          <div className="gz-modal gz-bn-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="gz-bn-head">
              <div>
                <h3>Course photo</h3>
                <p>Shown on the course page and on the Courses list.</p>
              </div>
              <button type="button" className="gz-bn-x" onClick={close} disabled={busy} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="gz-bn-body">
              <div className="gz-bn-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview || currentUrl || fallbackUrl} alt="Course photo preview" />
                {!preview && !currentUrl && <span className="gz-bn-badge">Default</span>}
                {preview && <span className="gz-bn-badge">New</span>}
              </div>

              <div className="gz-bn-spec">
                <div><b>Size</b><span>{BANNER_W} × {BANNER_H} px (32:15)</span></div>
                <div><b>Minimum</b><span>960 × 450 px</span></div>
                <div><b>Format</b><span>JPG, PNG or WebP</span></div>
                <div><b>Max file</b><span>{MAX_MB} MB</span></div>
              </div>
              <p className="gz-bn-tip">Keep the important part in the centre; edges are trimmed slightly on small cards and phones.</p>

              {dims && <p className="gz-bn-dims">Selected: {dims.w} × {dims.h} px</p>}
              {small && <p className="gz-bn-warn">This image is smaller than the minimum and may look blurry.</p>}
              {ratioOff && !small && <p className="gz-bn-warn">The shape differs from 32:15, so parts of it will be cropped.</p>}
              {error && <p className="gz-bn-err">{error}</p>}

              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => pick(e.target.files?.[0] ?? null)} />
            </div>

            <div className="gz-bn-foot">
              {currentUrl && !preview ? (
                <button type="button" className="gz-btn gz-btn--ghost gz-bn-reset" onClick={reset} disabled={busy}>Reset to default</button>
              ) : <span />}
              <div className="gz-bn-foot__r">
                <button type="button" className="gz-btn gz-btn--ghost" onClick={() => input.current?.click()} disabled={busy}>
                  {preview ? 'Choose another' : 'Choose image'}
                </button>
                <button type="button" className="gz-btn" onClick={save} disabled={!file || busy}>{busy ? 'Saving...' : 'Save photo'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Form field version: inline preview + size guide + the editor. Saves immediately (own API call). */
export function CourseBannerField({ courseId, initialUrl, fallbackUrl }: { courseId: string; initialUrl?: string | null; fallbackUrl: string }) {
  const [url, setUrl] = useState<string | null>(initialUrl || null)
  return (
    <div className="gz-bn-field">
      <label className="gz-bn-field__label">Course photo</label>
      <div className="gz-bn-field__row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gz-bn-field__img" src={url || fallbackUrl} alt="Course photo" />
        <div className="gz-bn-field__side">
          <p>Recommended <b>{BANNER_W} × {BANNER_H} px</b> (32:15), JPG, PNG or WebP, up to {MAX_MB} MB. Saves as soon as you upload.</p>
          <CourseBannerEditor courseId={courseId} currentUrl={url} fallbackUrl={fallbackUrl} onChange={setUrl} />
        </div>
      </div>
    </div>
  )
}
