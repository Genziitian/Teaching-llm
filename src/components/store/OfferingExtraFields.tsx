'use client'

import { DEFAULT_BOX_CONFIG, type CourseTerm } from '@/components/storefront/native/CoursesDb'

export type OfferingExtra = {
  description: string
  highlights: string
  visible: boolean
  pinned: boolean
  marketingTag: string
  startDate: string
  endDate: string
  boxes: string[]
}

export const EMPTY_EXTRA: OfferingExtra = { description: '', highlights: '', visible: true, pinned: false, marketingTag: '', startDate: '', endDate: '', boxes: [] }

const MARKETING_TAGS = ['SALE', 'NEW', 'BESTSELLER', 'TRENDING', 'HOT', 'LIMITED']
const day = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : '')

/** Prefill from a Store offering (edit form). */
export function extraFromOffering(o: any): OfferingExtra {
  const w = o?.website || {}
  return {
    description: o?.course?.description || '',
    highlights: o?.highlights || '',
    visible: !o?.course?.isDisabled,
    pinned: !!w.isPinned,
    marketingTag: w.marketingTag || '',
    startDate: day(o?.course?.startDate),
    endDate: day(o?.course?.endDate),
    boxes: Array.isArray(w.boxes) ? w.boxes : [],
  }
}

/** Body fields for POST / PUT /api/course-offerings. `tags` are the course card tags (max 2 kept). */
export function extraToBody(e: OfferingExtra, tags: string[] = []) {
  return {
    description: e.description,
    highlights: e.highlights,
    isDisabled: !e.visible,
    startDate: e.startDate || null,
    endDate: e.endDate || null,
    website: { tags, marketingTag: e.marketingTag, isPinned: e.pinned, boxes: e.boxes },
  }
}

const input: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '2px solid var(--border)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--surface)' }
const label: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }

export default function OfferingExtraFields({ value, onChange, category }: { value: OfferingExtra; onChange: (patch: Partial<OfferingExtra>) => void; category: string }) {
  const term = (Object.keys(DEFAULT_BOX_CONFIG) as CourseTerm[]).find((t) => t.toLowerCase() === (category || '').toLowerCase())
  const boxOptions = term ? DEFAULT_BOX_CONFIG[term] : []
  return (
    <div style={{ display: 'grid', gap: 18, marginBottom: 24 }}>
      <div>
        <label style={label}>Subtitle / brief description</label>
        <textarea style={{ ...input, minHeight: 80, fontWeight: 500 }} value={value.description} onChange={(e) => onChange({ description: e.target.value })} />
      </div>
      <div>
        <label style={label}>What you get in the cohort</label>
        <textarea
          style={{ ...input, minHeight: 110, fontWeight: 500 }}
          placeholder={'One point per line\nLive doubt-solving every week\nNotes + PYQs'}
          value={value.highlights}
          onChange={(e) => onChange({ highlights: e.target.value })}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={label}>Visibility</label>
          <select style={input} value={value.visible ? 'on' : 'off'} onChange={(e) => onChange({ visible: e.target.value === 'on' })}>
            <option value="on">Enabled: visible to users</option>
            <option value="off">Disabled: hidden</option>
          </select>
        </div>
        <div>
          <label style={label}>Pinned?</label>
          <select style={input} value={value.pinned ? 'pin' : 'reg'} onChange={(e) => onChange({ pinned: e.target.value === 'pin' })}>
            <option value="reg">Regular</option>
            <option value="pin">Pinned to top</option>
          </select>
        </div>
      </div>
      <div>
        <label style={label}>Course marketing tag</label>
        <select style={input} value={value.marketingTag} onChange={(e) => onChange({ marketingTag: e.target.value })}>
          <option value="">None</option>
          {MARKETING_TAGS.map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={label}>Start date</label><input type="date" style={input} value={value.startDate} onChange={(e) => onChange({ startDate: e.target.value })} /></div>
        <div><label style={label}>End date</label><input type="date" style={input} value={value.endDate} onChange={(e) => onChange({ endDate: e.target.value })} /></div>
      </div>
      <div>
        <label style={label}>Choose boxes</label>
        {boxOptions.length === 0 ? (
          <div style={{ padding: 12, borderRadius: 12, border: '2px dashed var(--border)', fontSize: 13, color: 'var(--text-muted)' }}>Pick a category first to choose boxes.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {boxOptions.map((b) => {
              const on = value.boxes.includes(b)
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => onChange({ boxes: on ? value.boxes.filter((x) => x !== b) : [...value.boxes, b] })}
                  style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid var(--border)', boxShadow: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: on ? 'var(--primary)' : 'transparent', color: on ? 'var(--button-text, #000)' : 'var(--text-secondary)' }}
                >{b}</button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
