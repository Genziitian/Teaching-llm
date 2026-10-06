'use client'
import { useState } from 'react'
import useSWR from 'swr'
const api = '/api/admin/automation'
async function fetcher(url: string) { const r = await fetch(url); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Request failed'); return data }
const control = { padding: '8px', border: '1px solid #94a3b8', borderRadius: 6, background: 'var(--bg-card, white)', color: 'inherit' }
export default function AutomationPage() {
  const [tab, setTab] = useState('settings'), [kind, setKind] = useState('recording'), [state, setState] = useState(''), [page, setPage] = useState(1)
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [courseId, setCourseId] = useState(''), [resolving, setResolving] = useState<string | null>(null)
  const { data: settings, error, mutate: refreshSettings } = useSWR(`${api}/settings`, fetcher)
  const { data: list, error: listError, mutate: refreshList } = useSWR(tab === 'imports' ? `${api}/imports?kind=${kind}&state=${state}&page=${page}` : tab === 'runs' ? `${api}/runs?page=${page}` : tab === 'pending' ? `${api}/pending` : null, fetcher)
  const { data: events, error: eventsError } = useSWR(resolving && courseId ? `${api}/events?courseId=${encodeURIComponent(courseId)}` : null, fetcher)
  const [runDetails, setRunDetails] = useState<any>(null)
  async function send(url: string, method: string, body: any) {
    setBusy(true); setMessage('')
    try { const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const result = await r.json(); if (!r.ok) throw new Error(result.error); setMessage(result.message || 'Settings saved.'); await Promise.all([refreshSettings(), refreshList()]); setResolving(null) }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed') } finally { setBusy(false) }
  }
  if (error) return <main style={{ padding: 24 }}><h1>Class material automation</h1><p role="alert">{error.message}</p></main>
  if (!settings) return <p style={{ padding: 24 }}>Loading automation settings…</p>
  return <main style={{ padding: 24, maxWidth: 1200, margin: 'auto' }}>
    <h1>Class material automation</h1><p>Daily import at 8 am IST. Each recording is matched to the timetable by Meet link and recording time.</p>
    {!settings.credentialsConfigured && <p role="alert">Google setup incomplete: {settings.missingSettings.join(', ')}. See the deployment guide.</p>}
    {settings.lastRun?.errorSummary && <p role="alert">Last run: {settings.lastRun.errorSummary}</p>}
    <nav style={{ display: 'flex', gap: 12, margin: '20px 0' }}>{['settings', 'imports', 'pending', 'runs'].map(t => <button style={control} key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setPage(1) }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</nav>
    {(listError || eventsError) && <p role="alert">{(listError || eventsError).message}</p>}
    {message && <p role="status">{message}</p>}
    {tab === 'settings' && <><p>Notes filenames: <code>YYYY-MM-DD_HHmm_Description.pdf</code>, using the scheduled start time in IST. Leave the topic selector on “Daily Recordings” to create or reuse that topic.</p>{settings.courses.map((course: any) => {
      const cfg = settings.configs.find((c: any) => c.courseId === course.id)
      return <form key={`${course.id}-${cfg?.updatedAt || ''}`} style={{ padding: 16, border: '1px solid #94a3b8', borderRadius: 8, marginBottom: 16 }} onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.currentTarget)
        void send(`${api}/courses/${course.id}`, 'PUT', { enabled: f.get('enabled') === 'on', notesFolderId: f.get('folder'), destinationTopicId: f.get('topic'), activationDate: `${f.get('activation')}T00:00:00+05:30` })
      }}><h2>{course.name}</h2><div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
        <label><input name="enabled" type="checkbox" defaultChecked={cfg?.enabled || false} /> Enabled</label>
        <label>Notes folder ID <input style={control} name="folder" required defaultValue={cfg?.notesFolderId || ''} /></label>
        <label>Topic <select style={control} name="topic" defaultValue={cfg?.destinationTopicId || ''}><option value="">Daily Recordings</option>{course.topics.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        <label>Start date <input style={control} name="activation" type="date" required defaultValue={cfg ? new Date(new Date(cfg.activationDate).getTime() + 330 * 60000).toISOString().slice(0, 10) : ''} /></label>
        <button style={control} disabled={busy}>Save</button></div></form>
    })}</>}
    {tab === 'imports' && <><div style={{ display: 'flex', gap: 12 }}><select aria-label="Import type" style={control} value={kind} onChange={e => { setKind(e.target.value); setPage(1) }}><option value="recording">Recordings</option><option value="note">Notes</option></select><select aria-label="Status" style={control} value={state} onChange={e => { setState(e.target.value); setPage(1) }}><option value="">All statuses</option>{['NEEDS_REVIEW', 'RETRY_PENDING', 'WAITING_FOR_FILE', 'WAITING_FOR_RECORDING', 'PUBLISHED', 'ATTACHED', 'IGNORED'].map(s => <option key={s}>{s}</option>)}</select></div>
      <p>Resolve uncertain items below. Retry queues work for the next run; use Trigger Run in Render for immediate processing.</p>
      {list?.items.map((item: any) => <article key={item.id} style={{ borderBottom: '1px solid #94a3b8', padding: '16px 0', overflowWrap: 'anywhere' }}><strong>{item.fileName || item.googleRecordingName}</strong><p>{item.state} {item.startTime && `· ${new Date(item.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`}</p>{item.errorMessage && <p>{item.errorMessage}</p>}<div style={{ display: 'flex', gap: 8 }}>
        {!item.contentId && <button style={control} disabled={busy} onClick={() => { setResolving(item.id); setCourseId(item.courseId || '') }}>Choose class</button>}
        <button style={control} disabled={busy} onClick={() => void send(`${api}/imports/${item.id}/retry`, 'POST', { kind })}>Retry</button>
        <button style={control} disabled={busy} onClick={() => { const reason = window.prompt('Reason for ignoring this import (existing published content stays visible):'); if (reason?.trim()) void send(`${api}/imports/${item.id}/ignore`, 'POST', { kind, reason }) }}>Ignore</button></div>
      </article>)}
      {resolving && <form style={{ padding: 20, border: '1px solid #94a3b8' }} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void send(`${api}/imports/${resolving}/resolve`, 'POST', { kind, eventId: f.get('event') }) }}><h2>Select the correct class</h2><select style={control} aria-label="Course" required value={courseId} onChange={e => setCourseId(e.target.value)}><option value="">Choose course</option>{settings.courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select style={control} name="event" required aria-label="Timetable occurrence"><option value="">Choose occurrence</option>{events?.map((e: any) => <option key={e.id} value={e.id}>{e.title} — {new Date(e.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</option>)}</select><button style={control} disabled={busy}>Resolve</button><button type="button" style={control} onClick={() => setResolving(null)}>Cancel</button></form>}
    </>}
    {tab === 'runs' && <>{list?.items.map((r: any) => <article key={r.id} style={{ padding: 12, borderBottom: '1px solid #94a3b8' }}><strong>{new Date(r.startedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST — {r.status}{r.dryRun ? ' (dry run)' : ''}</strong><p>{r.errorSummary}</p><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(r.counts)}</pre><button style={control} onClick={() => setRunDetails(r)}>Details</button></article>)}{runDetails && <><button style={control} onClick={() => setRunDetails(null)}>Close details</button><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(runDetails.phaseResults, null, 2)}</pre></>}</>}
    {tab === 'pending' && <><p>Warnings for classes older than seven days (latest 500 sessions).</p>{list?.map((s: any) => <p key={s.id}>{s.title} — {s.notesKey}: {s.warning}</p>)}</>}
    {['runs', 'imports'].includes(tab) && <div style={{ marginTop: 20, display: 'flex', gap: 10 }}><button style={control} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {list?.total || 0} items</span><button style={control} disabled={page * 50 >= (list?.total || 0)} onClick={() => setPage(page + 1)}>Next</button></div>}
  </main>
}
