'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import PageShell from '../PageShell'
import { supabase } from './storefrontDb'

/** Storefront `settings` keys managed on this page. */
const HOMEPAGE_VIDEO_KEY = 'homepage_video_url'
const HOWTO_VIDEO_KEY = 'course_howto_video_url'

/** Extracts the 11-character YouTube id from normal, short, embed or raw-id links. */
export function storeSettingsYouTubeId(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('.') && !trimmed.includes('?')) return trimmed
  const match = trimmed.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/)
  return match && match[2].length === 11 ? match[2] : null
}

type Msg = { ok: boolean; text: string } | null

function VideoSettingCard({
  title,
  description,
  hint,
  value,
  onChange,
  onSave,
  saving,
  saveLabel,
  message,
  previewTitle,
}: {
  title: string
  description: string
  hint?: string
  value: string
  onChange: (v: string) => void
  onSave: () => void
  saving: boolean
  saveLabel: string
  message: Msg
  previewTitle: string
}) {
  const id = storeSettingsYouTubeId(value)
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{description}</p>
      </div>

      {message && <div className={`badge ${message.ok ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'normal' }}>{message.text}</div>}

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">YouTube Video URL</label>
        <input className="form-input" type="text" placeholder="e.g. https://www.youtube.com/watch?v=…" value={value} onChange={(e) => onChange(e.target.value)} />
        {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
      </div>

      {id ? (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Player Preview</label>
          <div style={{ maxWidth: 448, aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', background: '#000', border: '1px solid var(--border)' }}>
            <iframe
              src={`https://www.youtube.com/embed/${id}`}
              title={previewTitle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          </div>
        </div>
      ) : value.trim() ? (
        <div className="badge badge-warning" style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'normal' }}>Invalid YouTube URL. Preview not available.</div>
      ) : null}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> {saveLabel}</>}
        </button>
      </div>
    </div>
  )
}

/** Store settings: homepage video popup and the course-page "How to use" video. */
export default function StoreSettingsManager() {
  const [videoUrl, setVideoUrl] = useState('')
  const [howToUrl, setHowToUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingHowTo, setSavingHowTo] = useState(false)
  const [videoMsg, setVideoMsg] = useState<Msg>(null)
  const [howToMsg, setHowToMsg] = useState<Msg>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.from('settings').select('key, value').in('key', [HOMEPAGE_VIDEO_KEY, HOWTO_VIDEO_KEY])
      if (!alive) return
      if (error) {
        setLoadError('Failed to load system settings' + (error.message ? `: ${error.message}` : ''))
      } else {
        const rows = (data as { key: string; value: unknown }[]) || []
        const get = (k: string) => {
          const v = rows.find((r) => r.key === k)?.value
          return typeof v === 'string' ? v : ''
        }
        setVideoUrl(get(HOMEPAGE_VIDEO_KEY))
        setHowToUrl(get(HOWTO_VIDEO_KEY))
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  const saveKey = async (key: string, value: string) => {
    const { error } = await supabase.from('settings').upsert({ key, value: value.trim() })
    return error ? error.message || 'Failed to save settings' : null
  }

  const saveVideo = async () => {
    setSaving(true)
    setVideoMsg(null)
    const err = await saveKey(HOMEPAGE_VIDEO_KEY, videoUrl)
    setSaving(false)
    if (!err) setVideoUrl(videoUrl.trim())
    setVideoMsg(err ? { ok: false, text: err } : { ok: true, text: 'Video settings saved successfully!' })
  }

  const saveHowTo = async () => {
    setSavingHowTo(true)
    setHowToMsg(null)
    const err = await saveKey(HOWTO_VIDEO_KEY, howToUrl)
    setSavingHowTo(false)
    if (!err) setHowToUrl(howToUrl.trim())
    setHowToMsg(err ? { ok: false, text: err || 'Failed to save the how-to video' } : { ok: true, text: 'How-to video saved. It now shows beside the FAQs on every course page.' })
  }

  return (
    <PageShell title="Store settings" description="Homepage and course intro videos on genziitian.in.">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 className="animate-spin" size={24} /></div>
      ) : loadError ? (
        <div className="badge badge-danger" style={{ padding: '8px 12px', fontSize: 13, whiteSpace: 'normal' }}>{loadError}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
          <VideoSettingCard
            title="Homepage Video Modal"
            description="Configure the YouTube video popup shown to homepage visitors."
            hint="Supports normal, short, or embed links. Clear the URL to disable the popup."
            value={videoUrl}
            onChange={(v) => { setVideoUrl(v); setVideoMsg(null) }}
            onSave={() => void saveVideo()}
            saving={saving}
            saveLabel="Save Video Link"
            message={videoMsg}
            previewTitle="YouTube video player preview"
          />
          <VideoSettingCard
            title="Course Page “How to use” Video"
            description="Shown beside the FAQs at the bottom of every course page. Clear the URL to hide the video and show the FAQs full width."
            value={howToUrl}
            onChange={(v) => { setHowToUrl(v); setHowToMsg(null) }}
            onSave={() => void saveHowTo()}
            saving={savingHowTo}
            saveLabel="Save How-to Video"
            message={howToMsg}
            previewTitle="How-to video preview"
          />
        </div>
      )}
    </PageShell>
  )
}
