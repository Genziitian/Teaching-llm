'use client'

import { useState, useCallback } from 'react'
import Cropper, { Point, Area } from 'react-easy-crop'

interface ImageCropperProps {
  image: string
  aspect?: number
  onCropComplete: (croppedImage: Blob) => void
  onCancel: () => void
}

export default function ImageCropper({ image, aspect = 16 / 9, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropChange = (crop: Point) => setCrop(crop)
  const onZoomChange = (zoom: number) => setZoom(zoom)

  const handleCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.setAttribute('crossOrigin', 'anonymous')
      image.src = url
    })

  const getCroppedImg = async () => {
    if (!croppedAreaPixels) return

    try {
      const img = await createImage(image)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) return

      canvas.width = croppedAreaPixels.width
      canvas.height = croppedAreaPixels.height

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      )

      canvas.toBlob((blob) => {
        if (blob) onCropComplete(blob)
      }, 'image/jpeg')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: '600px', height: '400px',
        background: '#333', borderRadius: '12px', overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
      }}>
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={onCropChange}
          onCropComplete={handleCropComplete}
          onZoomChange={onZoomChange}
        />
      </div>

      <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface)', padding: '8px 16px', borderRadius: '50px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 700 }}>Zoom</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ cursor: 'pointer' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 24px', borderRadius: '50px',
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={getCroppedImg}
            style={{
              padding: '10px 24px', borderRadius: '50px', border: 'none',
              background: 'var(--primary)', color: '#fff',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 40%, transparent)'
            }}
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  )
}
