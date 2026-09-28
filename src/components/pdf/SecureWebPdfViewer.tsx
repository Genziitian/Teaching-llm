'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  BookOpen, 
  FileText,
  RotateCcw
} from 'lucide-react'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

// Point to local worker copied into /public
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface Props {
  fileUrl?: string          // proxy URL: /api/drive-doc/<contentId>
  fallbackUrl?: string      // original external link / Google Drive link
  fileBlob?: Blob           // direct offline Blob from IndexedDB
  watermarkEmail: string    // logged-in user's email
  title?: string            // optional title for the top bar
  onBack?: () => void
  initialFullscreen?: boolean
}

export default function SecureWebPdfViewer({
  fileUrl,
  fallbackUrl,
  fileBlob,
  watermarkEmail,
  title,
  onBack,
  initialFullscreen = false,
}: Props) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const loadingFact = useLoadingFact(numPages === 0 && !error)
  
  // View mode: 2-page spread vs 1-page view
  const [isTwoPage, setIsTwoPage] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024
    }
    return true
  })

  // Fullscreen / Distraction-free mode
  const [isFullscreen, setIsFullscreen] = useState<boolean>(initialFullscreen)

  // Zoom scale (default 0.85 for neat fit)
  const [zoom, setZoom] = useState<number>(0.85)

  // Manage Blob URL lifecycle if a raw Blob is passed (e.g. from IndexedDB)
  const resolvedFile = useMemo(() => {
    if (fileBlob) {
      return URL.createObjectURL(fileBlob)
    }
    return fileUrl || ''
  }, [fileBlob, fileUrl])

  useEffect(() => {
    return () => {
      if (fileBlob && resolvedFile && resolvedFile.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedFile)
      }
    }
  }, [fileBlob, resolvedFile])

  // Progress animation with randomized organic speed profiles.
  // Keep the simulated value below completion so it never appears stuck at 99%.
  const [loadProgress, setLoadProgress] = useState<number>(0)
  const [simulatedProgress, setSimulatedProgress] = useState<number>(0)

  useEffect(() => {
    setSimulatedProgress(0)
    let current = 0
    let timeoutId: NodeJS.Timeout

    // Randomize speed profile per load: 0: Fast burst, 1: Dynamic with organic pauses, 2: Steady
    const profile = Math.floor(Math.random() * 3)

    const tick = () => {
      if (current >= 92) return

      let step = 0
      let nextDelay = 100

      if (profile === 0) {
        step = current < 20
          ? Math.floor(Math.random() * 9) + 12
          : current < 60
          ? Math.floor(Math.random() * 10) + 7
          : current < 84
          ? Math.floor(Math.random() * 8) + 4
          : current < 90
          ? 2
          : 1
        nextDelay = current < 20
          ? Math.floor(Math.random() * 35) + 20
          : current < 60
          ? Math.floor(Math.random() * 70) + 45
          : Math.floor(Math.random() * 120) + 70
      } else if (profile === 1) {
        const isPause = Math.random() < 0.16 && current > 28 && current < 82
        if (isPause) {
          step = 0
          nextDelay = Math.floor(Math.random() * 250) + 140
        } else {
          step = current < 20
            ? Math.floor(Math.random() * 10) + 10
            : current < 45
            ? Math.floor(Math.random() * 9) + 5
            : current < 78
            ? Math.floor(Math.random() * 6) + 3
            : current < 90
            ? 2
            : 1
          nextDelay = current < 20 ? Math.floor(Math.random() * 35) + 25 : Math.floor(Math.random() * 100) + 70
        }
      } else {
        step = current < 20
          ? Math.floor(Math.random() * 8) + 9
          : current < 50
          ? Math.floor(Math.random() * 6) + 4
          : current < 84
          ? Math.floor(Math.random() * 4) + 2
          : 1
        nextDelay = current < 20 ? Math.floor(Math.random() * 40) + 35 : Math.floor(Math.random() * 150) + 110
      }

      current = Math.min(92, current + step)
      setSimulatedProgress(current / 100)

      if (current < 92) {
        timeoutId = setTimeout(tick, nextDelay)
      }
    }

    timeoutId = setTimeout(tick, Math.floor(Math.random() * 50) + 30)
    return () => clearTimeout(timeoutId)
  }, [resolvedFile])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(1000)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setContainerWidth(e.contentRect.width)
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [isFullscreen])

  // Keybindings: Esc to exit fullscreen, Arrow keys for page nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) {
        e.preventDefault()
      }
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
      if (e.key === 'ArrowRight') {
        const step = isTwoPage ? 2 : 1
        setPageNumber(p => Math.min(numPages, p + step))
      }
      if (e.key === 'ArrowLeft') {
        const step = isTwoPage ? 2 : 1
        setPageNumber(p => Math.max(1, p - step))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen, isTwoPage, numPages])

  // Handle body overflow when in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isFullscreen])

  const documentOptions = useMemo(
    () => ({
      cMapUrl: '/_next/static/chunks/pages/cmaps/',
      cMapPacked: true,
    }),
    []
  )

  // Calculate page widths for 1-page vs 2-page view
  const pageWidth = useMemo(() => {
    if (isTwoPage) {
      // 2 pages side-by-side with padding and gap
      const available = (containerWidth - 64) / 2
      return Math.max(280, Math.min(available, 600) * zoom)
    } else {
      // 1 page centered
      const available = containerWidth - 48
      return Math.max(320, Math.min(available, 820) * zoom)
    }
  }, [containerWidth, isTwoPage, zoom])

  // Page step logic
  const handlePrev = () => {
    const step = isTwoPage ? 2 : 1
    setPageNumber(p => Math.max(1, p - step))
  }

  const handleNext = () => {
    const step = isTwoPage ? 2 : 1
    setPageNumber(p => Math.min(numPages, p + step))
  }

  // Ensure left page is odd in two-page mode
  const firstPage = pageNumber
  const secondPage = isTwoPage && firstPage + 1 <= numPages ? firstPage + 1 : null

  return (
    <div
      ref={containerRef}
      onContextMenu={e => e.preventDefault()}
      style={
        isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              width: '100vw',
              height: '100vh',
              background: '#0a0d14',
              color: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }
          : {
              position: 'relative',
              width: '100%',
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }
      }
    >
      {/* Top Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: isFullscreen ? '#0f172a' : 'var(--surface-2)',
          borderBottom: isFullscreen ? '1px solid #1e293b' : '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: '10px',
          zIndex: 10,
        }}
      >
        {/* Left: Back / Exit & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {isFullscreen ? (
            <button
              onClick={() => setIsFullscreen(false)}
              style={iconBtnStyle(isFullscreen)}
              title="Exit Fullscreen (Esc)"
            >
              <Minimize2 size={16} />
              <span style={{ fontSize: '12px', fontWeight: 700 }}>Exit Fullscreen</span>
            </button>
          ) : (
            onBack && (
              <button onClick={onBack} style={iconBtnStyle(isFullscreen)}>
                <ChevronLeft size={16} />
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Back</span>
              </button>
            )
          )}

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: isFullscreen ? '#f1f5f9' : 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '240px',
              }}
            >
              {title || 'Document Reader'}
            </span>
            {numPages > 0 && (
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                {isTwoPage && secondPage
                  ? `Pages ${firstPage}-${secondPage} of ${numPages}`
                  : `Page ${firstPage} of ${numPages}`}
              </span>
            )}
          </div>
        </div>

        {/* Center: View Mode & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isFullscreen ? 'rgba(30, 41, 59, 0.96)' : 'var(--surface)', padding: '4px 8px', borderRadius: '10px', border: isFullscreen ? '1px solid rgba(148, 163, 184, 0.22)' : '1px solid var(--border)' }}>
          {/* 1-Page / 2-Page Toggle */}
          <button
            onClick={() => setIsTwoPage(false)}
            style={{
              ...toggleBtnStyle,
              background: !isTwoPage ? 'var(--primary, #6366f1)' : 'transparent',
              color: !isTwoPage ? '#ffffff' : isFullscreen ? '#cbd5e1' : 'var(--text-muted)',
            }}
            title="Single Page View"
          >
            <FileText size={14} />
            <span style={{ fontSize: '11px', fontWeight: 700 }}>1 Page</span>
          </button>
          <button
            onClick={() => setIsTwoPage(true)}
            style={{
              ...toggleBtnStyle,
              background: isTwoPage ? 'var(--primary, #6366f1)' : 'transparent',
              color: isTwoPage ? '#ffffff' : isFullscreen ? '#cbd5e1' : 'var(--text-muted)',
            }}
            title="Two Page Spread (Side-by-Side)"
          >
            <BookOpen size={14} />
            <span style={{ fontSize: '11px', fontWeight: 700 }}>2 Pages</span>
          </button>

          <div style={{ width: '1px', height: '18px', background: isFullscreen ? 'rgba(148, 163, 184, 0.25)' : 'var(--border)', margin: '0 4px' }} />

          {/* Zoom Out */}
          <button
            onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
            style={actionBtnStyle(isFullscreen)}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>

          <span style={{ fontSize: '11px', fontWeight: 700, minWidth: '38px', textAlign: 'center', color: isFullscreen ? '#f8fafc' : 'var(--text-primary)' }}>
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom In */}
          <button
            onClick={() => setZoom(z => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
            style={actionBtnStyle(isFullscreen)}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>

          {/* Reset Zoom */}
          <button
            onClick={() => setZoom(0.85)}
            style={actionBtnStyle(isFullscreen)}
            title="Fit to Screen"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Right: Pagination & Fullscreen Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={handlePrev}
              disabled={pageNumber <= 1}
              style={pagerArrowBtn(pageNumber <= 1, isFullscreen)}
              title="Previous (Left Arrow)"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={handleNext}
              disabled={isTwoPage ? pageNumber + 1 >= numPages : pageNumber >= numPages}
              style={pagerArrowBtn(isTwoPage ? pageNumber + 1 >= numPages : pageNumber >= numPages, isFullscreen)}
              title="Next (Right Arrow)"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(f => !f)}
            style={{
              ...iconBtnStyle(isFullscreen),
              background: isFullscreen ? 'rgba(99, 102, 241, 0.28)' : 'var(--surface)',
              borderColor: isFullscreen ? '#6366f1' : 'var(--border)',
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span style={{ fontSize: '12px', fontWeight: 700 }}>
              {isFullscreen ? 'Exit' : 'Full Screen'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Render Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          padding: isFullscreen ? '24px 16px' : '20px 12px',
          background: isFullscreen ? '#0a0d14' : 'var(--bg)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: isFullscreen ? 'calc(100vh - 65px)' : '600px',
        }}
      >
        {error ? (
          <div style={{ padding: '80px 20px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
              Opening document…
            </div>
            <div style={{ fontSize: '13px' }}>Redirecting to material link</div>
          </div>
        ) : (
          <Document
            file={resolvedFile}
            options={documentOptions}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n)
              setLoadProgress(1)
              setSimulatedProgress(1)
            }}
            onLoadError={e => {
              setError(e?.message || 'Failed to load PDF')
              const target = fallbackUrl || resolvedFile
              if (target && typeof window !== 'undefined') {
                window.location.replace(target)
              }
            }}
            onLoadProgress={({ loaded, total }) => {
              if (total && total > 0) {
                setLoadProgress(Math.min(1, loaded / total))
              }
            }}
            loading={<LoadingState progress={simulatedProgress} fact={loadingFact} />}
            error={null}
          >
            <div
              style={{
                display: 'flex',
                gap: isTwoPage ? '16px' : '0px',
                justifyContent: 'center',
                alignItems: 'flex-start',
                flexWrap: isTwoPage && containerWidth < 680 ? 'wrap' : 'nowrap',
              }}
            >
              {/* First Page */}
              <div
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  background: '#ffffff',
                  boxShadow: isFullscreen
                    ? '0 10px 30px rgba(0,0,0,0.6)'
                    : '0 4px 20px rgba(0,0,0,0.15)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <Page
                  pageNumber={firstPage}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={
                    <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Rendering page {firstPage}…
                    </div>
                  }
                />
                {numPages > 0 && <Watermark email={watermarkEmail} />}
              </div>

              {/* Second Page (if 2-page view active) */}
              {isTwoPage && secondPage && (
                <div
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    background: '#ffffff',
                    boxShadow: isFullscreen
                      ? '0 10px 30px rgba(0,0,0,0.6)'
                      : '0 4px 20px rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <Page
                    pageNumber={secondPage}
                    width={pageWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={
                      <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Rendering page {secondPage}…
                      </div>
                    }
                  />
                  {numPages > 0 && <Watermark email={watermarkEmail} />}
                </div>
              )}
            </div>
          </Document>
        )}
      </div>

      {/* Floating Bottom Quick Nav for Mobile/Tablet */}
      {numPages > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '10px 16px',
            background: isFullscreen ? '#0f172a' : 'var(--surface-2)',
            borderTop: isFullscreen ? '1px solid #1e293b' : '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handlePrev}
            disabled={pageNumber <= 1}
            style={{
              background: 'none',
              border: 'none',
              color: pageNumber <= 1 ? 'var(--text-muted)' : 'var(--primary, #6366f1)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: pageNumber <= 1 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: pageNumber <= 1 ? 0.4 : 1,
            }}
          >
            ‹ Previous
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span>Page</span>
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={e => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 1 && val <= numPages) {
                  setPageNumber(val)
                }
              }}
              style={{
                width: '44px',
                textAlign: 'center',
                padding: '3px 4px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: isFullscreen ? '#1e293b' : 'var(--bg)',
                color: isFullscreen ? '#f8fafc' : 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 700,
                outline: 'none',
              }}
            />
            <span>of {numPages}</span>
          </div>

          <button
            onClick={handleNext}
            disabled={isTwoPage ? pageNumber + 1 >= numPages : pageNumber >= numPages}
            style={{
              background: 'none',
              border: 'none',
              color: (isTwoPage ? pageNumber + 1 >= numPages : pageNumber >= numPages) ? 'var(--text-muted)' : 'var(--primary, #6366f1)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: (isTwoPage ? pageNumber + 1 >= numPages : pageNumber >= numPages) ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: (isTwoPage ? pageNumber + 1 >= numPages : pageNumber >= numPages) ? 0.4 : 1,
            }}
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  )
}

function iconBtnStyle(isFullscreen = false): React.CSSProperties {
  return {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: isFullscreen ? 'rgba(248, 250, 252, 0.96)' : 'var(--surface)',
  border: isFullscreen ? '1px solid rgba(248, 250, 252, 0.22)' : '1px solid var(--border)',
  borderRadius: '8px',
  padding: '6px 12px',
  color: isFullscreen ? '#0f172a' : 'var(--text-primary)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  }
}

const toggleBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  border: 'none',
  borderRadius: '6px',
  padding: '4px 8px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
}

function actionBtnStyle(isFullscreen = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    background: isFullscreen ? 'rgba(248, 250, 252, 0.08)' : 'transparent',
    border: 'none',
    color: isFullscreen ? '#f8fafc' : 'var(--text-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
  }
}

function pagerArrowBtn(disabled: boolean, isFullscreen = false): React.CSSProperties {
  return {
    background: isFullscreen ? 'rgba(248, 250, 252, 0.94)' : 'var(--surface)',
    color: disabled ? (isFullscreen ? '#64748b' : 'var(--text-muted)') : (isFullscreen ? '#0f172a' : 'var(--text-primary)'),
    border: isFullscreen ? '1px solid rgba(248, 250, 252, 0.24)' : '1px solid var(--border)',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }
}

function LoadingState({ progress, fact }: { progress: number; fact: ReturnType<typeof useLoadingFact> }) {
  const pct = Math.round(progress * 100)
  const isFinalizing = pct >= 90
  const size = 64
  const stroke = 4
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, progress)))
  return (
    <div
      style={{
        padding: '60px 20px',
        color: 'var(--text-primary)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)' }}
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#6366f1"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 200ms ease-out' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 800,
            color: 'var(--text-primary)',
          }}
        >
          {pct}%
        </div>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600 }}>
        {isFinalizing ? 'Opening PDF…' : 'Loading PDF…'}
      </div>
      <LoadingFactCard fact={fact} style={{ marginTop: '8px', maxWidth: '420px' }} />
    </div>
  )
}

function Watermark({ email }: { email: string }) {
  const tiles: { left: string; top: string }[] = []
  const rows = 4
  const cols = 2
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        left: `${(c / cols) * 100 + (r % 2 === 0 ? 4 : 16)}%`,
        top: `${(r / rows) * 100 + 8}%`,
      })
    }
  }
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {tiles.map((t, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: t.left,
            top: t.top,
            transform: 'rotate(-25deg)',
            transformOrigin: 'left top',
            color: 'rgba(0, 0, 0, 0.035)',
            fontSize: '11.5px',
            fontWeight: 600,
            letterSpacing: '1px',
            whiteSpace: 'nowrap',
          }}
        >
          GenZ IITIAN • {email}
        </div>
      ))}
    </div>
  )
}
