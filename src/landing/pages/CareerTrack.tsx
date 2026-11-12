'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/landing/shims/router';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ExternalLink,
  Inbox,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  StickyNote,
} from 'lucide-react';
import { useAuth } from '@/landing/context/AuthContext';
import { supabase } from '@/landing/lib/supabase';

/* ---------------------------------------------------------------------------
 * Applicant tracker.
 *  - Read-only: status and the original submission can't be changed here.
 *  - Append-only: applicants can add notes, links and extra subjects. Once
 *    submitted an entry can't be edited or removed (enforced by the server —
 *    there is no edit/delete route for applicants).
 * ------------------------------------------------------------------------- */

const C = {
  paper: '#fbfbfd',
  card: '#ffffff',
  ink: '#0b1120',
  muted: '#5b6472',
  faint: '#8a919c',
  rule: '#e5e7eb',
  accent: '#2563eb',
  accentSoft: '#eff6ff',
};

type Status = 'PENDING' | 'REVIEWED' | 'SHORTLISTED' | 'HIRED' | 'REJECTED';
type AddType = 'note' | 'link' | 'subject';

type Addition = { id: string; type: AddType; value: string; label?: string | null; added_at: string };

type TrackedApp = {
  id: string;
  role: string;
  role_title: string;
  status: Status;
  subject?: string | null;
  language?: string | null;
  resume_link?: string | null;
  group_link?: string | null;
  created_at: string;
  updated_at?: string;
  additions: Addition[];
};

const STAGES = ['Submitted', 'Under review', 'Shortlisted', 'Decision'] as const;

const STATUS_COPY: Record<Status, { label: string; stage: number; tone: string; bg: string; message: string }> = {
  PENDING: {
    label: 'Received',
    stage: 0,
    tone: '#92400e',
    bg: '#fef6e7',
    message: 'Your application has been received and is waiting for review.',
  },
  REVIEWED: {
    label: 'Under review',
    stage: 1,
    tone: '#1e40af',
    bg: '#eef3fe',
    message: 'Our team has reviewed your application and is evaluating it.',
  },
  SHORTLISTED: {
    label: 'Shortlisted',
    stage: 2,
    tone: '#6b21a8',
    bg: '#f6effd',
    message: "You're shortlisted. The team will contact you directly with next steps.",
  },
  HIRED: {
    label: 'Selected',
    stage: 3,
    tone: '#166534',
    bg: '#eaf7ee',
    message: 'Congratulations — you have been selected. The team will be in touch with onboarding details.',
  },
  REJECTED: {
    label: 'Not selected',
    stage: 3,
    tone: '#9f1239',
    bg: '#fdf0f3',
    message: "Thank you for applying. We're not moving forward with this application right now.",
  },
};

const TYPE_META: Record<AddType, { label: string; icon: typeof StickyNote; hint: string; placeholder: string; max: number }> = {
  note: {
    label: 'Note',
    icon: StickyNote,
    hint: 'Anything the team should know — availability, experience, clarifications.',
    placeholder: 'Write your note…',
    max: 1000,
  },
  link: {
    label: 'Link',
    icon: Link2,
    hint: 'A résumé, portfolio, demo lecture, GitHub or community link.',
    placeholder: 'https://',
    max: 500,
  },
  subject: {
    label: 'Subject',
    icon: BookOpen,
    hint: 'Add another subject you are able to teach.',
    placeholder: 'e.g. Statistics 2',
    max: 120,
  },
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ───────────── Page ───────────── */

export default function CareerTrack() {
  const { user, loading: authLoading, openLoginModal } = useAuth();
  const [apps, setApps] = useState<TrackedApp[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/job-applications/mine', { headers: await authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load your applications.');
      setApps(json.applications || []);
    } catch (e: any) {
      setError(e.message || 'Could not load your applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else setApps(null);
  }, [user, load]);

  const replaceApp = (next: TrackedApp) =>
    setApps(prev => (prev ? prev.map(a => (a.id === next.id ? next : a)) : prev));

  return (
    <div className="careers-ui min-h-[70vh]" style={{ background: C.paper, color: C.ink }}>
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/careers"
          className="inline-flex items-center gap-2 text-[13px] font-medium underline-offset-4 hover:underline"
          style={{ color: C.muted }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to careers
        </Link>

        <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.accent }}>
              Application tracker
            </p>
            <h1 className="careers-serif mt-3 text-4xl font-medium leading-[1.1] sm:text-5xl">Your applications</h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed" style={{ color: C.muted }}>
              Follow progress in real time. You can add more information at any time, but submitted details and
              entries stay on record.
            </p>
          </div>
          {user && (
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-[13px] font-semibold transition-colors hover:bg-[#f3f1ea] disabled:opacity-60"
              style={{ border: `1px solid ${C.rule}` }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          )}
        </header>

        <div className="mt-10">
          {authLoading ? (
            <Skeleton />
          ) : !user ? (
            <Panel>
              <div className="px-6 py-14 text-center sm:py-16">
                <Lock className="mx-auto h-6 w-6" style={{ color: C.faint }} />
                <h2 className="careers-serif mt-4 text-2xl font-medium">Sign in to see your applications</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: C.muted }}>
                  Use the same account you applied with. Only you can see your application status.
                </p>
                <button
                  onClick={openLoginModal}
                  className="mt-7 inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                  style={{ background: C.accent }}
                >
                  Sign in <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </Panel>
          ) : loading && !apps ? (
            <Skeleton />
          ) : error ? (
            <Panel>
              <div className="flex items-start gap-3 px-6 py-6 text-sm" style={{ color: '#9f1239' }}>
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            </Panel>
          ) : apps && apps.length === 0 ? (
            <Panel>
              <div className="px-6 py-14 text-center sm:py-16">
                <Inbox className="mx-auto h-6 w-6" style={{ color: C.faint }} />
                <h2 className="careers-serif mt-4 text-2xl font-medium">No applications yet</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: C.muted }}>
                  We couldn't find an application for <strong>{user.email}</strong>. If you applied with a different
                  email, sign in with that account.
                </p>
                <Link
                  to="/careers#openings"
                  className="mt-7 inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                  style={{ background: C.accent }}
                >
                  View open roles <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Panel>
          ) : (
            <div className="space-y-8">
              {apps?.map(a => (
                <ApplicationCard key={a.id} app={a} onChange={replaceApp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white" style={{ border: `1px solid ${C.rule}` }}>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <Panel>
      <div className="animate-pulse space-y-4 p-8">
        <div className="h-5 w-1/3 rounded" style={{ background: C.rule }} />
        <div className="h-3 w-2/3 rounded" style={{ background: C.rule }} />
        <div className="h-3 w-1/2 rounded" style={{ background: C.rule }} />
      </div>
    </Panel>
  );
}

/* ───────────── Application card ───────────── */

function ApplicationCard({ app, onChange }: { app: TrackedApp; onChange: (a: TrackedApp) => void }) {
  const s = STATUS_COPY[app.status] ?? STATUS_COPY.PENDING;
  const extraSubjects = app.additions.filter(a => a.type === 'subject');

  return (
    <article className="overflow-hidden rounded-lg bg-white" style={{ border: `1px solid ${C.rule}` }}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-6 sm:px-8" style={{ borderBottom: `1px solid ${C.rule}` }}>
        <div>
          <h2 className="careers-serif text-2xl font-medium sm:text-[1.75rem]">{app.role_title}</h2>
          <p className="mt-1.5 text-[13px]" style={{ color: C.muted }}>
            Submitted {fmtDate(app.created_at)} · Ref {app.id.slice(-8).toUpperCase()}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
          style={{ background: s.bg, color: s.tone }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.tone }} />
          {s.label}
        </span>
      </div>

      {/* Progress */}
      <div className="px-6 py-7 sm:px-8">
        <Stepper status={app.status} />
        <p className="mt-6 text-[15px] leading-relaxed" style={{ color: C.ink }}>
          {s.message}
        </p>
        <p className="mt-1 text-xs" style={{ color: C.faint }}>
          Last updated {fmtDateTime(app.updated_at || app.created_at)}
        </p>
      </div>

      {/* Original submission (read only) */}
      <div className="px-6 py-6 sm:px-8" style={{ borderTop: `1px solid ${C.rule}`, background: '#fcfbf8' }}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.faint }}>
          <Lock className="h-3 w-3" /> Your submission · read only
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Field label="Role" value={app.role_title} />
          {app.subject && <Field label="Subject / community" value={app.subject} />}
          {app.language && <Field label="Teaching language" value={app.language} />}
          {app.resume_link && <Field label="Résumé" value={app.resume_link} link />}
          {app.group_link && <Field label="Community link" value={app.group_link} link />}
        </dl>
      </div>

      {/* Additions */}
      <div className="px-6 py-7 sm:px-8" style={{ borderTop: `1px solid ${C.rule}` }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">Additional information</h3>
          <span className="text-xs" style={{ color: C.faint }}>
            {app.additions.length} added
            {extraSubjects.length > 0 ? ` · ${extraSubjects.length} extra subject${extraSubjects.length > 1 ? 's' : ''}` : ''}
          </span>
        </div>

        {app.additions.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: C.muted }}>
            Nothing added yet. Add notes, links or extra subjects below to give the team more context.
          </p>
        ) : (
          <ul className="mt-5">
            {app.additions.map((a, i) => (
              <AdditionRow key={a.id} item={a} last={i === app.additions.length - 1} />
            ))}
          </ul>
        )}

        <AddForm app={app} onAdded={onChange} />
      </div>
    </article>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.faint }}>
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium">
        {link ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 underline underline-offset-4"
            style={{ color: C.accent }}
          >
            <span className="break-all">{value}</span> <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/* ───────────── Stepper ───────────── */

function Stepper({ status }: { status: Status }) {
  const cfg = STATUS_COPY[status] ?? STATUS_COPY.PENDING;
  const current = cfg.stage;
  const final = status === 'HIRED' || status === 'REJECTED';

  return (
    <ol className="grid grid-cols-4 gap-2">
      {STAGES.map((label, i) => {
        const done = i < current || (final && i === 3);
        const active = i === current && !final;
        const isDecision = i === 3;
        const decisionColor = status === 'REJECTED' ? '#be123c' : '#15803d';
        const dot = done ? (isDecision ? decisionColor : C.accent) : active ? C.accent : C.rule;
        return (
          <li key={label} className="min-w-0">
            <div className="flex items-center">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{
                  background: done ? dot : '#fff',
                  border: `2px solid ${dot}`,
                  color: done ? '#fff' : active ? C.accent : C.faint,
                }}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </span>
              {i < STAGES.length - 1 && (
                <span className="ml-2 h-0.5 flex-1 rounded" style={{ background: i < current ? C.accent : C.rule }} />
              )}
            </div>
            <div
              className="mt-2 truncate pr-1 text-[11px] font-semibold sm:text-xs"
              style={{ color: done || active ? C.ink : C.faint }}
            >
              {isDecision && final ? cfg.label : label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────── Additions list ───────────── */

function AdditionRow({ item, last }: { item: Addition; last: boolean }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.note;
  const Icon = meta.icon;
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: C.accentSoft, color: C.accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {!last && <span className="my-1 w-px flex-1" style={{ background: C.rule }} />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? '' : 'pb-6'}`}>
        <div className="flex flex-wrap items-center gap-x-3 text-xs" style={{ color: C.faint }}>
          <span className="font-semibold uppercase tracking-[0.1em]">{meta.label}</span>
          <span>{fmtDateTime(item.added_at)}</span>
        </div>
        {item.type === 'link' ? (
          <a
            href={item.value}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm font-medium underline underline-offset-4"
            style={{ color: C.accent }}
          >
            <span className="break-all">{item.label || item.value}</span> <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.value}</p>
        )}
        {item.type === 'link' && item.label && (
          <p className="mt-0.5 break-all text-xs" style={{ color: C.faint }}>{item.value}</p>
        )}
      </div>
    </li>
  );
}

/* ───────────── Append-only form ───────────── */

function AddForm({ app, onAdded }: { app: TrackedApp; onAdded: (a: TrackedApp) => void }) {
  const [type, setType] = useState<AddType>('note');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState(false);

  const meta = TYPE_META[type];
  const trimmed = value.trim();

  const switchType = (t: AddType) => {
    setType(t);
    setValue('');
    setLabel('');
    setConfirming(false);
    setError('');
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/job-applications/add-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ id: app.id, type, value: trimmed, label: type === 'link' ? label.trim() : undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save. Please try again.');
      onAdded({ ...app, ...json.application });
      setValue('');
      setLabel('');
      setConfirming(false);
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 3500);
    } catch (e: any) {
      setError(e.message || 'Could not save. Please try again.');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-md border bg-white px-3.5 py-3 text-base sm:text-sm outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(31,58,138,0.15)]';

  return (
    <div className="mt-8 rounded-lg p-5 sm:p-6" style={{ background: '#fcfbf8', border: `1px solid ${C.rule}` }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold">Add to this application</div>
        <div className="inline-flex rounded-md bg-white p-0.5" style={{ border: `1px solid ${C.rule}` }} role="tablist">
          {(Object.keys(TYPE_META) as AddType[]).map(t => {
            const Icon = TYPE_META[t].icon;
            const on = t === type;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={on}
                onClick={() => switchType(t)}
                className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-semibold transition-colors"
                style={{ background: on ? C.ink : 'transparent', color: on ? '#fff' : C.muted }}
              >
                <Icon className="h-3.5 w-3.5" /> {TYPE_META[t].label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[13px]" style={{ color: C.muted }}>{meta.hint}</p>

      <div className="mt-4 space-y-3">
        {type === 'note' ? (
          <textarea
            rows={4}
            value={value}
            maxLength={meta.max}
            onChange={e => { setValue(e.target.value); setConfirming(false); }}
            placeholder={meta.placeholder}
            className={inputCls}
            style={{ borderColor: C.rule }}
          />
        ) : (
          <>
            <input
              type={type === 'link' ? 'url' : 'text'}
              inputMode={type === 'link' ? 'url' : undefined}
              value={value}
              maxLength={meta.max}
              onChange={e => { setValue(e.target.value); setConfirming(false); }}
              placeholder={meta.placeholder}
              className={inputCls}
              style={{ borderColor: C.rule }}
            />
            {type === 'link' && (
              <input
                type="text"
                value={label}
                maxLength={80}
                onChange={e => setLabel(e.target.value)}
                placeholder="Label (optional) — e.g. Demo lecture"
                className={inputCls}
                style={{ borderColor: C.rule }}
              />
            )}
          </>
        )}
        <div className="text-right text-[11px]" style={{ color: C.faint }}>
          {value.length}/{meta.max}
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 text-[13px]" style={{ color: '#be123c' }}>
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      {confirming ? (
        <div className="mt-4 rounded-md p-4" style={{ background: '#fff8e6', border: '1px solid #f3dfa2' }}>
          <p className="text-[13px] leading-relaxed" style={{ color: '#7a4a05' }}>
            <strong>This can't be edited or removed once submitted.</strong> Please check it before you continue.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: C.accent }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm &amp; submit
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={saving}
              className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold"
              style={{ border: `1px solid ${C.rule}` }}
            >
              Keep editing
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs" style={{ color: C.faint }}>
            <Lock className="h-3 w-3" /> Entries are permanent once submitted.
          </p>
          <div className="flex items-center gap-3">
            {justAdded && (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium" style={{ color: '#15803d' }}>
                <Check className="h-3.5 w-3.5" /> Added
              </span>
            )}
            <button
              onClick={() => setConfirming(true)}
              disabled={!trimmed}
              className="rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: C.ink }}
            >
              Add {meta.label.toLowerCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
