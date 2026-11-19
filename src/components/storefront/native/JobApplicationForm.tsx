'use client'

import { useEffect, useState } from 'react'
import type { CareersRole } from './CareersTypes'

/*
 * Dashboard version of the website application (src/landing/components/CareerApplicationModal.tsx).
 * Same questions, options, validation and payload (POST /api/site/job-applications), dashboard look.
 */

const COURSES = {
  foundation: [
    ['Maths 1', 'Mathematics for Data Science I'], ['Maths 2', 'Mathematics for Data Science II'],
    ['Stats 1', 'Statistics for Data Science I'], ['Stats 2', 'Statistics for Data Science II'],
    ['CT', 'Computational Thinking'], ['Python', 'Programming in Python'],
    ['English 1', 'English I'], ['English 2', 'English II'],
  ],
  diploma: [
    ['PDSA', 'PDSA (using Python)'], ['Java', 'Programming Concepts using Java'],
    ['DBMS', 'Database Management Systems'], ['MAD 1', 'Modern Application Development 1 (MAD 1)'],
    ['MAD 2', 'Modern Application Development 2 (MAD 2)'], ['MLF', 'Machine Learning Foundations (MLF)'],
    ['MLT', 'Machine Learning Techniques (MLT)'], ['MLP', 'Machine Learning Practice (MLP)'],
    ['DL & Gen AI', 'Deep Learning & Gen AI'], ['BDM', 'Business Data Management'],
    ['BA', 'Business Analytics'], ['System Cmds', 'System Commands'],
  ],
} as const
const MEMBER_RANGES = ['1-10', '11-50', '51-100', '100-500', '500+', '1000+']
const NAME_RE = /^[a-zA-Z\s.]+$/
const phoneOk = (p: string) => /^[6-9]\d{9}$/.test(p.replace(/\D/g, '').slice(-10))

type Opt = { value: string; label: string; desc?: string }

function Choice({ options, value, onChange, cols }: { options: Opt[]; value: string; onChange: (v: string) => void; cols?: number }) {
  return (
    <div className="ja-choice" style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          <b>{o.label}</b>{o.desc && <small>{o.desc}</small>}
        </button>
      ))}
    </div>
  )
}

function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="ja-field">
      <span className="ja-label">{label}{optional ? <em> (optional)</em> : <i aria-hidden="true">*</i>}</span>
      {hint && <span className="ja-hint">{hint}</span>}
      {children}
    </label>
  )
}

function Section({ n, title, sub, children }: { n: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="ja-sec">
      <div className="ja-sec-head"><span className="ja-num">{n}</span><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div></div>
      {children}
    </section>
  )
}

export default function JobApplicationForm({ role, onBack }: { role: CareersRole; onBack: () => void }) {
  const kind = role.id === 'tutor' ? 'tutor' : role.id === 'campus-leader' ? 'leader' : 'generic'
  const [me, setMe] = useState<{ email: string; name: string; phone: string } | null>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [filter, setFilter] = useState<'all' | 'foundation' | 'diploma'>('all')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [f, setF] = useState({
    name: '', phone: '', age: '', gender: '', studentType: '', degreeLevel: '',
    selectedCourses: [] as string[], experienceAndWhy: '', hasTablet: '', language: 'Both (English + Hindi)', cgpa: '', resumeLink: '',
    officialEmail: '', isBSStudent: 'Yes', isGroupOwner: 'Yes', groupLink: '', groupMembers: '100-500', inquiries: '',
  })
  const set = (k: keyof typeof f, v: any) => { setF(p => ({ ...p, [k]: v })); setErr('') }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      const u = d?.user || {}
      setMe({ email: String(u.email || '').toLowerCase(), name: u.name || '', phone: u.mobileNumber || '' })
      setF(p => ({ ...p, name: p.name || u.name || '', phone: p.phone || u.mobileNumber || '' }))
    }).catch(() => setMe({ email: '', name: '', phone: '' }))
  }, [])

  useEffect(() => { document.querySelector('.dashboard-scroll-region')?.scrollTo({ top: 0, behavior: 'smooth' }) }, [step, done])

  const basicsError = () => {
    if (!f.name.trim()) return 'Please enter your full name.'
    if (!NAME_RE.test(f.name.trim())) return 'Full name can only contain letters.'
    if (!phoneOk(f.phone)) return 'Phone number must be a valid 10-digit number starting with 6-9.'
    return ''
  }

  const next = () => {
    const age = parseInt(f.age.trim(), 10)
    const e = basicsError()
      || (isNaN(age) || age < 15 || age > 100 ? 'Age must be between 15 and 100.' : '')
      || (!f.gender ? 'Please select your gender.' : '')
      || (!f.studentType ? 'Please select your student status.' : '')
      || (!f.degreeLevel ? 'Please select your degree level.' : '')
    if (e) return setErr(e)
    setStep(2)
  }

  const submit = async () => {
    let e = ''
    if (kind === 'tutor') {
      e = (!f.selectedCourses.length ? 'Please select which courses you can teach.' : '')
        || (!f.experienceAndWhy.trim() ? 'Please describe your teaching experience and why GenZ IITian.' : '')
        || (!f.hasTablet ? 'Please select whether you have a tablet or a tablet with stylus to write.' : '')
        || (!f.cgpa.trim() ? 'Please provide your CGPA or grade in the target subject(s).' : '')
        || (!f.resumeLink.trim() ? 'Please provide a link to your Resume / CV.' : '')
    } else if (kind === 'leader') {
      e = basicsError() || (!f.groupLink.trim() ? 'Please add your group link.' : '')
    } else {
      e = basicsError()
        || (!f.experienceAndWhy.trim() ? 'Please describe your relevant experience and why you want this role.' : '')
        || (!f.resumeLink.trim() ? 'Please provide a link to your Resume / CV.' : '')
    }
    if (e) return setErr(e)

    const name = f.name.trim(), email = me?.email || ''
    const base = { full_name: name, name, email, phone: f.phone.trim() }
    const payload: Record<string, any> = kind === 'tutor' ? {
      ...base, role: 'tutor', role_title: 'Subject Tutor (Faculty)', age: f.age.trim(), gender: f.gender,
      student_type: f.studentType, degree_level: f.degreeLevel, courses: f.selectedCourses, subject: f.selectedCourses.join(', '),
      has_tablet: f.hasTablet, experience_and_why: f.experienceAndWhy.trim(), language: f.language, cgpa: f.cgpa.trim(),
      resume_link: f.resumeLink.trim(), resumeLink: f.resumeLink.trim(), is_iitm: 'Yes', isIITM: 'Yes', level: f.degreeLevel,
      metadata: { name, phone: f.phone, age: f.age, gender: f.gender, studentType: f.studentType, degreeLevel: f.degreeLevel, selectedCourses: f.selectedCourses, experienceAndWhy: f.experienceAndWhy, hasTablet: f.hasTablet, language: f.language, cgpa: f.cgpa, resumeLink: f.resumeLink, auth_email: email },
    } : kind === 'leader' ? {
      ...base, role: 'campus-leader', role_title: 'Campus Leaders', official_email: f.officialEmail.trim(),
      is_bs_student: f.isBSStudent, isIITM: f.isBSStudent, is_group_owner: f.isGroupOwner, group_link: f.groupLink.trim(),
      group_members: f.groupMembers, inquiries: f.inquiries.trim(), level: 'Campus Leader', subject: `Campus Leader (${f.groupMembers} members)`,
      metadata: { name, phone: f.phone, officialEmail: f.officialEmail, isBSStudent: f.isBSStudent, isGroupOwner: f.isGroupOwner, groupLink: f.groupLink, groupMembers: f.groupMembers, inquiries: f.inquiries, auth_email: email },
    } : {
      ...base, role: role.id, role_title: role.title, experience_and_why: f.experienceAndWhy.trim(),
      resume_link: f.resumeLink.trim(), resumeLink: f.resumeLink.trim(), inquiries: f.inquiries.trim(), level: role.title, subject: role.title,
      metadata: { name, phone: f.phone, experienceAndWhy: f.experienceAndWhy, resumeLink: f.resumeLink, inquiries: f.inquiries, role_title: role.title, auth_email: email },
    }

    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/site/job-applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error || 'Could not submit your application. Please try again.')
      // Same Google Sheet sync the website form does for every role.
      const sheet = process.env.NEXT_PUBLIC_STOREFRONT_CAREERS_SCRIPT_URL
      if (sheet && sheet !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        fetch(sheet, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {})
      }
      setDone(true)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const courses = filter === 'all' ? [...COURSES.foundation, ...COURSES.diploma] : COURSES[filter]
  const tags = [role.type, role.mode, role.pay, ...(role.tags || [])].filter(Boolean) as string[]

  const basics = (
    <>
      <div className="ja-grid2">
        <Field label="Full name"><input className="ja-input" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Aryan Sharma" autoComplete="name" /></Field>
        <Field label="Phone / WhatsApp"><input className="ja-input" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="98765 43210" inputMode="tel" autoComplete="tel" /></Field>
      </div>
      <Field label="Email address" hint="Linked to your GenZ IITian login, so it can't be changed here.">
        <input className="ja-input" value={me?.email || ''} readOnly aria-readonly="true" />
      </Field>
    </>
  )

  return (
    <div className="ja">
      <style>{CSS}</style>
      <button type="button" className="ja-back" onClick={step === 2 && !done ? () => setStep(1) : onBack}>← {step === 2 && !done ? 'Back to step 1' : 'All jobs'}</button>

      <header className="ja-hero">
        <div>
          <span className="ja-eyebrow">Apply as</span>
          <h1>{role.title}</h1>
          {role.summary && <p>{role.summary}</p>}
          <div className="ja-tags">{tags.map(t => <span key={t}>{t}</span>)}{role.comp && <span className="ja-comp">{role.comp}</span>}</div>
        </div>
        {kind === 'tutor' && !done && (
          <ol className="ja-steps" aria-label="Progress">
            <li className={step === 1 ? 'on' : 'ok'}><b>1</b>Personal profile</li>
            <li className={step === 2 ? 'on' : ''}><b>2</b>Teaching setup</li>
          </ol>
        )}
      </header>

      {done ? (
        <div className="ja-sec ja-done">
          <div className="ja-done-ico" aria-hidden="true">✓</div>
          <h3>Application submitted</h3>
          <p>Thanks for applying as {role.title}. We review every application and will reach out on WhatsApp and email if you&apos;re shortlisted.</p>
          <button type="button" className="gz-btn" onClick={onBack}>Back to jobs</button>
        </div>
      ) : (
        <form className="ja-form" onSubmit={e => { e.preventDefault(); if (kind === 'tutor' && step === 1) next(); else void submit() }} noValidate>
          {kind === 'tutor' && step === 1 && (
            <>
              <Section n="01" title="Basic details" sub="How we identify you and reach you.">
                {basics}
                <div className="ja-grid2"><Field label="Age"><input className="ja-input" value={f.age} onChange={e => set('age', e.target.value)} placeholder="e.g. 21" inputMode="numeric" /></Field></div>
              </Section>
              <Section n="02" title="About you" sub="Helps us plan sessions around your schedule.">
                <Field label="Gender"><Choice cols={4} value={f.gender} onChange={v => set('gender', v)} options={['Male', 'Female', 'Other', 'Prefer not to say'].map(v => ({ value: v, label: v }))} /></Field>
                <Field label="What best describes you right now?">
                  <Choice cols={3} value={f.studentType} onChange={v => set('studentType', v)} options={[
                    { value: 'Standalone', label: 'Standalone BS', desc: 'Pursuing only the IITM BS degree' },
                    { value: 'Dual Degree', label: 'Dual degree', desc: 'Regular college + IITM BS' },
                    { value: 'Working Professional', label: 'Working professional', desc: 'Full/part-time job + IITM BS' },
                  ]} />
                </Field>
              </Section>
              <Section n="03" title="Degree progress" sub="Which level of the IITM BS programme are you currently in?">
                <Field label="Your current level"><Choice cols={3} value={f.degreeLevel} onChange={v => set('degreeLevel', v)} options={['Foundation', 'Diploma', 'Degree'].map(v => ({ value: v, label: v }))} /></Field>
              </Section>
            </>
          )}

          {kind === 'tutor' && step === 2 && (
            <>
              <Section n="01" title="Courses you can teach" sub="Choose every course you're confident teaching.">
                <div className="ja-row">
                  <div className="gz-seg" role="tablist">
                    {(['all', 'foundation', 'diploma'] as const).map(k => (
                      <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
                        {k[0].toUpperCase() + k.slice(1)} <i>{k === 'all' ? COURSES.foundation.length + COURSES.diploma.length : COURSES[k].length}</i>
                      </button>
                    ))}
                  </div>
                  <span className="ja-count">{f.selectedCourses.length} selected</span>
                </div>
                <div className="ja-courses">
                  {courses.map(([short, name]) => {
                    const on = f.selectedCourses.includes(name)
                    return (
                      <button key={name} type="button" aria-pressed={on} className={on ? 'on' : ''}
                        onClick={() => set('selectedCourses', on ? f.selectedCourses.filter(c => c !== name) : [...f.selectedCourses, name])}>
                        <span className="ja-short">{short}</span><span className="ja-cname">{name}</span><span className="ja-tick" aria-hidden="true">{on ? '✓' : ''}</span>
                      </button>
                    )
                  })}
                </div>
              </Section>
              <Section n="02" title="Experience & motivation" sub="There are no wrong answers. Tell us in your own words.">
                <Field label="Any teaching experience? And why GenZ IITian?">
                  <textarea className="ja-input" rows={5} value={f.experienceAndWhy} onChange={e => set('experienceAndWhy', e.target.value)} placeholder="e.g. I've been helping juniors with Maths 1 doubts on our WhatsApp group for a year…" />
                </Field>
              </Section>
              <Section n="03" title="Setup & academics">
                <Field label="Do you have a tablet, or a pen tablet with stylus?" hint="We teach by writing on screen, so this matters.">
                  <Choice cols={2} value={f.hasTablet} onChange={v => set('hasTablet', v)} options={[
                    { value: 'Yes', label: 'Yes, I have one', desc: 'Tablet / pen tablet with stylus' },
                    { value: 'No', label: "No, I don't", desc: "I don't have one right now" },
                  ]} />
                </Field>
                <Field label="Teaching language">
                  <Choice cols={3} value={f.language} onChange={v => set('language', v)} options={[
                    { value: 'Both (English + Hindi)', label: 'Both', desc: 'English + Hindi' },
                    { value: 'English', label: 'English', desc: 'Only' },
                    { value: 'Hindi', label: 'Hindi', desc: 'Only' },
                  ]} />
                </Field>
                <div className="ja-grid2">
                  <Field label="CGPA / grade in the subject" hint="For the subject(s) you want to teach."><input className="ja-input" value={f.cgpa} onChange={e => set('cgpa', e.target.value)} placeholder="e.g. 8.5 or S grade" /></Field>
                  <Field label="Resume / CV link" hint="Set sharing to “Anyone with the link can view”."><input className="ja-input" value={f.resumeLink} onChange={e => set('resumeLink', e.target.value)} placeholder="https://drive.google.com/…" inputMode="url" /></Field>
                </div>
              </Section>
            </>
          )}

          {kind === 'leader' && (
            <>
              <Section n="01" title="Basic details" sub="How we identify you and reach you.">
                {basics}
                <Field label="Official IITM email address" hint="Your student email ending in @ds.study.iitm.ac.in" optional>
                  <input className="ja-input" value={f.officialEmail} onChange={e => set('officialEmail', e.target.value)} placeholder="e.g. 21f1000000@ds.study.iitm.ac.in" inputMode="email" />
                </Field>
              </Section>
              <Section n="02" title="Your community" sub="Tell us about the group you run.">
                <div className="ja-grid2">
                  <Field label="Are you a BS student?"><Choice cols={2} value={f.isBSStudent} onChange={v => set('isBSStudent', v)} options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} /></Field>
                  <Field label="Are you the owner of the student group?"><Choice cols={2} value={f.isGroupOwner} onChange={v => set('isGroupOwner', v)} options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} /></Field>
                </div>
                <Field label="Group link" hint="WhatsApp, Telegram, Discord or any other invite link."><input className="ja-input" value={f.groupLink} onChange={e => set('groupLink', e.target.value)} placeholder="https://chat.whatsapp.com/… or https://t.me/…" inputMode="url" /></Field>
                <Field label="Roughly how many members are in your group?"><Choice cols={6} value={f.groupMembers} onChange={v => set('groupMembers', v)} options={MEMBER_RANGES.map(v => ({ value: v, label: v }))} /></Field>
                <Field label="Questions / inquiries" optional><textarea className="ja-input" rows={3} value={f.inquiries} onChange={e => set('inquiries', e.target.value)} placeholder="Ask anything or tell us more about your community…" /></Field>
              </Section>
            </>
          )}

          {kind === 'generic' && (
            <>
              <Section n="01" title="Basic details" sub="How we identify you and reach you.">{basics}</Section>
              <Section n="02" title="About your fit">
                <Field label="Relevant experience & why this role"><textarea className="ja-input" rows={5} value={f.experienceAndWhy} onChange={e => set('experienceAndWhy', e.target.value)} placeholder="Tell us about your experience and why you want this role…" /></Field>
                <Field label="Resume / CV link" hint="Set sharing to “Anyone with the link can view”."><input className="ja-input" value={f.resumeLink} onChange={e => set('resumeLink', e.target.value)} placeholder="https://drive.google.com/…" inputMode="url" /></Field>
                <Field label="Questions / notes" optional><textarea className="ja-input" rows={3} value={f.inquiries} onChange={e => set('inquiries', e.target.value)} placeholder="Ask anything or share links to your work…" /></Field>
              </Section>
            </>
          )}

          {err && <div className="ja-err" role="alert">{err}</div>}
          <div className="ja-actions">
            {kind === 'tutor' && step === 2 ? <button type="button" className="gz-btn gz-btn--ghost" onClick={() => setStep(1)}>← Back</button> : <span />}
            <button type="submit" className="gz-btn" disabled={busy || !me}>
              {busy ? 'Submitting…' : kind === 'tutor' && step === 1 ? 'Continue to teaching setup →' : 'Submit application'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const CSS = `
.ja{width:100%;padding:4px 0 48px;display:flex;flex-direction:column;gap:16px}
.ja-back{align-self:flex-start;background:none;border:none;padding:0;cursor:pointer;font:inherit;font-size:13px;color:var(--gz-ink-3)}
.ja-back:hover{color:var(--gz-ink)}
.ja-hero{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:22px 24px;border:1px solid var(--gz-line);border-radius:var(--gz-r-card);background:var(--gz-panel)}
.ja-eyebrow{font-family:var(--gz-mono);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--gz-ink-3)}
.ja-hero h1{margin:4px 0 6px;font-size:26px;font-weight:600;letter-spacing:-.02em;color:var(--gz-ink)}
.ja-hero p{margin:0 0 12px;font-size:14px;color:var(--gz-ink-2);max-width:640px}
.ja-tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ja-tags span{font-size:11.5px;padding:3px 10px;border-radius:999px;border:1px solid var(--gz-line);background:var(--gz-card);color:var(--gz-ink-2)}
.ja-tags .ja-comp{border:none;background:none;padding:0 4px;color:var(--gz-ink-3);font-size:12.5px}
.ja-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;align-self:center}
.ja-steps li{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--gz-ink-3)}
.ja-steps li b{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;border:1px solid var(--gz-line);background:var(--gz-card)}
.ja-steps li.on{color:var(--gz-ink);font-weight:600}
.ja-steps li.on b{background:var(--gz-ink);color:var(--gz-ink-inv);border-color:var(--gz-ink)}
.ja-steps li.ok b{background:#10b981;border-color:#10b981;color:#fff}
.ja-form{display:flex;flex-direction:column;gap:16px}
.ja-sec{display:flex;flex-direction:column;gap:16px;padding:22px 24px;border:1px solid var(--gz-line);border-radius:var(--gz-r-card);background:var(--gz-panel)}
.ja-sec-head{display:flex;gap:12px;align-items:flex-start}
.ja-num{flex-shrink:0;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-family:var(--gz-mono);font-size:12px;font-weight:600;background:var(--gz-ink);color:var(--gz-ink-inv)}
.ja-sec-head h3{margin:0;font-size:16px;font-weight:600;color:var(--gz-ink)}
.ja-sec-head p{margin:2px 0 0;font-size:13px;color:var(--gz-ink-3)}
.ja-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.ja-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.ja-label{font-size:13.5px;font-weight:600;color:var(--gz-ink)}
.ja-label i{color:#ef4444;font-style:normal;margin-left:2px}
.ja-label em{font-style:normal;font-weight:400;color:var(--gz-ink-3)}
.ja-hint{font-size:12px;color:var(--gz-ink-3);margin-top:-2px}
.ja-input{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:11px 14px;border-radius:10px;border:1px solid var(--gz-line);background:var(--gz-card);color:var(--gz-ink);outline:none;resize:vertical}
.ja-input:focus{border-color:var(--gz-ink);box-shadow:0 0 0 3px color-mix(in srgb,var(--gz-ink) 10%,transparent)}
.ja-input[readonly]{opacity:.7;cursor:not-allowed}
.ja-choice{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.ja-choice button{font:inherit;text-align:left;padding:11px 14px;border-radius:10px;border:1px solid var(--gz-line);background:var(--gz-card);color:var(--gz-ink);cursor:pointer;display:flex;flex-direction:column;gap:2px;transition:border-color .15s}
.ja-choice button:hover{border-color:var(--gz-line-hover)}
.ja-choice button b{font-size:13.5px;font-weight:600}
.ja-choice button small{font-size:12px;color:var(--gz-ink-3)}
.ja-choice button.on{background:var(--gz-ink);border-color:var(--gz-ink);color:var(--gz-ink-inv)}
.ja-choice button.on small{color:inherit;opacity:.75}
.ja-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.ja-count{font-size:12.5px;font-weight:600;padding:4px 12px;border-radius:999px;background:rgba(16,185,129,.14);color:#10b981}
.ja-courses{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.ja-courses button{font:inherit;display:flex;align-items:center;gap:12px;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid var(--gz-line);background:var(--gz-card);color:var(--gz-ink);cursor:pointer}
.ja-courses button:hover{border-color:var(--gz-line-hover)}
.ja-courses button.on{border-color:#10b981;background:color-mix(in srgb,#10b981 10%,var(--gz-card))}
.ja-short{flex-shrink:0;min-width:58px;text-align:center;font-size:11px;font-weight:600;padding:4px 8px;border-radius:7px;border:1px solid var(--gz-line);background:var(--gz-panel)}
.ja-cname{flex:1;min-width:0;font-size:13.5px;font-weight:500}
.ja-tick{flex-shrink:0;width:20px;height:20px;border-radius:6px;border:1px solid var(--gz-line);display:grid;place-items:center;font-size:12px;color:#fff}
.ja-courses button.on .ja-tick{background:#10b981;border-color:#10b981}
.ja-err{padding:10px 14px;border-radius:10px;font-size:13px;font-weight:500;background:rgba(239,68,68,.12);color:#ef4444}
.ja-actions{display:flex;justify-content:space-between;gap:12px;align-items:center}
.ja-done{align-items:center;text-align:center;padding:48px 24px}
.ja-done-ico{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:26px;background:#10b981;color:#fff}
.ja-done h3{margin:0;font-size:20px;color:var(--gz-ink)}
.ja-done p{margin:0;max-width:440px;font-size:14px;color:var(--gz-ink-2)}
@media (max-width:767px){.ja-grid2,.ja-courses{grid-template-columns:1fr}.ja-choice{grid-template-columns:repeat(2,minmax(0,1fr))!important}.ja-hero,.ja-sec{padding:18px 16px}}
`
