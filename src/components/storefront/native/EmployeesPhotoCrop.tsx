'use client'

// Square photo crop dialog (drag to position, slider to zoom) -> 512x512 JPEG data URL.
import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'

type Props = {
  file: File
  onCancel: () => void
  onSave: (photoDataUrl: string) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const OUTPUT_SIZE = 512

export default function EmployeesPhotoCrop({ file, onCancel, onSave }: Props) {
  const [imageUrl, setImageUrl] = useState('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState(300)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setImageUrl(objectUrl)
    setImageSize({ width: 0, height: 0 })
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setError('')
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  useEffect(() => {
    const element = viewportRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setViewportSize(Math.max(1, entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const baseScale = imageSize.width && imageSize.height ? Math.max(viewportSize / imageSize.width, viewportSize / imageSize.height) : 1
  const displayScale = baseScale * zoom
  const displayWidth = imageSize.width * displayScale
  const displayHeight = imageSize.height * displayScale
  const imageLeft = (viewportSize - displayWidth) / 2 + offset.x
  const imageTop = (viewportSize - displayHeight) / 2 + offset.y

  useEffect(() => {
    if (!imageSize.width || !imageSize.height) return
    const maxX = Math.max(0, (displayWidth - viewportSize) / 2)
    const maxY = Math.max(0, (displayHeight - viewportSize) / 2)
    setOffset((current) => ({ x: clamp(current.x, -maxX, maxX), y: clamp(current.y, -maxY, maxY) }))
  }, [displayWidth, displayHeight, viewportSize, imageSize.width, imageSize.height])

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSize.width) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, offsetX: offset.x, offsetY: offset.y }
  }

  const moveImage = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const maxX = Math.max(0, (displayWidth - viewportSize) / 2)
    const maxY = Math.max(0, (displayHeight - viewportSize) / 2)
    setOffset({
      x: clamp(drag.offsetX + event.clientX - drag.pointerX, -maxX, maxX),
      y: clamp(drag.offsetY + event.clientY - drag.pointerY, -maxY, maxY),
    })
  }

  const endDrag = () => { dragRef.current = null }

  const cropAndSave = () => {
    const image = imageRef.current
    if (!image || !imageSize.width || !viewportSize) return
    const canvas = document.createElement('canvas')
    const ratio = OUTPUT_SIZE / viewportSize
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const context = canvas.getContext('2d')
    if (!context) {
      setError('Your browser could not prepare this photo. Try another image.')
      return
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    context.drawImage(image, imageLeft * ratio, imageTop * ratio, displayWidth * ratio, displayHeight * ratio)
    onSave(canvas.toDataURL('image/jpeg', 0.9))
  }

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-photo-crop-title"
        className="card"
        style={{ width: '100%', maxWidth: 420, padding: 20, background: 'var(--bg)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 id="employee-photo-crop-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Adjust photo</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Drag to position, then zoom to crop.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Close photo crop tool"><X size={18} /></button>
        </div>

        <div
          ref={viewportRef}
          onPointerDown={startDrag}
          onPointerMove={moveImage}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ position: 'relative', margin: '16px auto 0', width: 'min(78vw, 320px)', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 16, background: '#0f172a', touchAction: 'none', cursor: dragRef.current ? 'grabbing' : 'grab' }}
        >
          {imageUrl && (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Photo crop preview"
              draggable={false}
              onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => setError('This image could not be opened. Choose another photo.')}
              style={{ position: 'absolute', maxWidth: 'none', userSelect: 'none', pointerEvents: 'none', left: imageLeft, top: imageTop, width: displayWidth, height: displayHeight }}
            />
          )}
          <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.7)', borderRadius: 16, pointerEvents: 'none' }} />
          {!imageSize.width && !error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600 }}>Loading photo…</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, color: 'var(--text-muted)' }}>
          <Minus size={16} />
          <input aria-label="Zoom photo" type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--primary)' }} />
          <Plus size={16} />
        </div>
        {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={cropAndSave} disabled={!imageSize.width || Boolean(error)}>Use photo</button>
        </div>
      </section>
    </div>
  )
}
