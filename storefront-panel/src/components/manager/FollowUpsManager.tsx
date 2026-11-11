import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  PhoneCall,
  MessageCircle,
  RefreshCw,
  Download,
  Search,
  Loader2,
  ChevronDown,
  Info,
  X,
  Flame,
  Clock,
  CalendarClock,
  CheckCircle2,
  UserX,
  IndianRupee,
  Trash2,
  AlertCircle,
  Copy,
  Check,
  Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  buildLeads,
  computeStats,
  sortLeads,
  phoneDigits,
  COOL_OFF_MS,
  DAY,
  FETCH_WINDOW_DAYS,
  HOUR,
  INTERESTED_FOLLOWUP_MS,
  LEAD_LIFETIME_DAYS,
  MAX_NO_ANSWER,
  MINUTE,
  OUTCOME_LABELS,
  type CallLog,
  type CallOutcome,
  type Lead,
  type OrderRow,
  type ProfileRow,
} from '../../lib/cartRecovery';

type View = 'DUE' | 'SCHEDULED' | 'RECOVERED' | 'DROPPED';
type CatalogRow = { id: string; name: string; bundleCourses?: any[]; courseIds?: string[] };

const PAGE = 1000;
const CHUNK = 100;
const ORDER_COLS = 'order_id, user_email, course_ids, total_amount, status, created_at';

/** Page through a Supabase query (it caps responses at 1000 rows). */
async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

async function inChunks<T>(values: string[], run: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += CHUNK) {
    const { data, error } = await run(values.slice(i, i + CHUNK));
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function fmtSpan(ms: number) {
  const abs = Math.abs(ms);
  if (abs < HOUR) return `${Math.max(1, Math.round(abs / MINUTE))}m`;
  if (abs < DAY) return `${Math.round(abs / HOUR)}h`;
  return `${Math.round(abs / DAY)}d`;
}
const ago = (t: number, now: number) => `${fmtSpan(now - t)} ago`;
const fmtDateTime = (t: number) =>
  new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const waLink = (lead: Lead, courseNames: string) => {
  const d = phoneDigits(lead.phone);
  const first = (lead.name || '').split(' ')[0] || 'there';
  const msg = `Hi ${first}, this is GenZ IITian. We saw you were enrolling in ${courseNames || 'our course'} but the payment didn't go through. Can we help you complete it?`;
  return `https://wa.me/91${d}?text=${encodeURIComponent(msg)}`;
};

const HEAT_STYLE: Record<Lead['heat'], string> = {
  HOT: 'bg-rose-50 text-rose-700 border-rose-200',
  WARM: 'bg-amber-50 text-amber-700 border-amber-200',
  COOL: 'bg-slate-50 text-slate-500 border-slate-200',
};

const OUTCOME_STYLE: Record<CallOutcome, string> = {
  NO_ANSWER: 'bg-slate-100 text-slate-600',
  CALLBACK: 'bg-blue-50 text-blue-700',
  INTERESTED: 'bg-emerald-50 text-emerald-700',
  NOT_INTERESTED: 'bg-red-50 text-red-700',
  WRONG_NUMBER: 'bg-red-50 text-red-700',
  ALREADY_BOUGHT: 'bg-violet-50 text-violet-700',
  NOTE: 'bg-slate-50 text-slate-500',
};

export default function FollowUpsManager() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<View>('DUE');
  const [search, setSearch] = useState('');
  const [showNoPhone, setShowNoPhone] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<Lead | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Keep "due now / in 3h" labels moving without refetching.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), MINUTE);
    return () => window.clearInterval(t);
  }, []);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const since = new Date(Date.now() - FETCH_WINDOW_DAYS * DAY).toISOString();

      const created = await fetchAll<OrderRow>((from, to) =>
        supabase
          .from('website_orders')
          .select(ORDER_COLS)
          .eq('status', 'CREATED')
          .not('order_id', 'like', 'AUTO_%')
          .gte('created_at', since)
          .order('created_at', { ascending: true })
          .range(from, to)
      );

      const emails = Array.from(new Set(created.map((o) => o.user_email).filter(Boolean)));

      const [paid, profileRows, catalogRes, coursesRes] = await Promise.all([
        // All-time purchases for these people: needed to know what they already own and whether they paid later.
        inChunks<OrderRow>(emails, (chunk) =>
          supabase.from('website_orders').select(ORDER_COLS).eq('status', 'PAID').in('user_email', chunk)
        ),
        inChunks<ProfileRow>(emails, (chunk) => supabase.from('profiles').select('email, name, phone').in('email', chunk)),
        supabase.from('course_catalog').select('id, name'),
        supabase.from('courses').select('id, name, bundleCourses, courseIds'),
      ]);

      let callRows: CallLog[] = [];
      try {
        callRows = await fetchAll<CallLog>((from, to) =>
          supabase.from('cart_followup_calls').select('*').gte('created_at', since).order('created_at').range(from, to)
        );
        setTableMissing(false);
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (err?.code === '42P01' || err?.code === 'PGRST205' || msg.includes('cart_followup_calls')) setTableMissing(true);
        else throw err;
      }

      setOrders([...created, ...paid]);
      setProfiles(profileRows);
      setCalls(callRows);
      setCatalog([...(catalogRes.data || []), ...(coursesRes.data || [])] as CatalogRow[]);
      setNow(Date.now());
    } catch (err: any) {
      console.error('Follow-ups load failed:', err);
      setError(err?.message || 'Could not load follow-ups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const courseName = useCallback(
    (cid: string) => {
      for (const c of catalog) {
        if (Array.isArray(c.bundleCourses)) {
          const bc = c.bundleCourses.find((b: any) => b?.courseId === cid || b?.courseId2 === cid || b?.courseId3 === cid || b?.id === cid);
          if (bc?.courseName) return bc.courseName as string;
        }
      }
      const direct = catalog.find((c) => c.id === cid);
      if (direct?.name) return direct.name;
      const parent = catalog.find((c) => Array.isArray(c.courseIds) && c.courseIds.includes(cid));
      if (parent?.name) return parent.name;
      return cid.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    },
    [catalog]
  );
  const courseList = useCallback(
    (ids: string[]) => Array.from(new Set(ids.map(courseName))),
    [courseName]
  );

  const leads = useMemo(() => buildLeads({ orders, calls, profiles, now }), [orders, calls, profiles, now]);
  const stats = useMemo(() => computeStats(leads), [leads]);

  const counts = useMemo(
    () => ({
      DUE: leads.filter((l) => l.stage === 'DUE' && l.hasPhone).length,
      SCHEDULED: leads.filter((l) => l.stage === 'SCHEDULED' || l.stage === 'COOLING').length,
      RECOVERED: leads.filter((l) => l.stage === 'RECOVERED').length,
      DROPPED: leads.filter((l) => l.stage === 'DROPPED').length,
    }),
    [leads]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = leads.filter((l) => {
      if (view === 'DUE') return l.stage === 'DUE' && (showNoPhone ? !l.hasPhone : l.hasPhone);
      if (view === 'SCHEDULED') return l.stage === 'SCHEDULED' || l.stage === 'COOLING';
      return l.stage === view;
    });
    if (q) {
      list = list.filter(
        (l) =>
          l.email.includes(q) ||
          (l.name || '').toLowerCase().includes(q) ||
          phoneDigits(l.phone).includes(q.replace(/\D/g, '') || '§') ||
          l.attempts.some((a) => a.orderId.toLowerCase().includes(q))
      );
    }
    return sortLeads(list, view === 'SCHEDULED' ? 'SCHEDULED' : view);
  }, [leads, view, search, showNoPhone]);

  const saveCall = async (lead: Lead, outcome: CallOutcome, note: string, callbackAt: string | null) => {
    const row = {
      lead_key: lead.key,
      user_email: lead.email,
      outcome,
      note: note.trim() || null,
      callback_at: callbackAt,
      called_by: user?.email || null,
    };
    const { data, error: err } = await supabase.from('cart_followup_calls').insert(row).select('*').single();
    if (err) throw err;
    setCalls((prev) => [...prev, data as CallLog]);
    setNow(Date.now());
  };

  const deleteCall = async (id: string) => {
    const { error: err } = await supabase.from('cart_followup_calls').delete().eq('id', id);
    if (err) {
      setError(err.message);
      return;
    }
    setCalls((prev) => prev.filter((c) => c.id !== id));
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  };

  const exportCsv = () => {
    const headers = ['Priority', 'Name', 'Phone', 'Email', 'Courses', 'Cart value', 'Checkout attempts', 'Last tried', 'Next call', 'Last outcome', 'Last note', 'Drops on', 'Why'];
    const rows = visible.map((l) => [
      l.heat,
      l.name || '',
      l.phone || '',
      l.email,
      courseList(l.courseIds).join(' | '),
      l.cartValue,
      l.attempts.length,
      new Date(l.lastAttemptAt).toLocaleString('en-IN'),
      l.dueAt ? new Date(l.dueAt).toLocaleString('en-IN') : '',
      l.lastCall ? OUTCOME_LABELS[l.lastCall.outcome] : '',
      l.lastCall?.note || '',
      new Date(l.expiresAt).toLocaleDateString('en-IN'),
      l.reasons.join('; '),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `call_list_${view.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (loading) {
    return <div className="flex justify-center p-20 text-slate-400 text-sm font-medium">Building call list…</div>;
  }

  const tabs: { id: View; label: string; count: number }[] = [
    { id: 'DUE', label: 'To call now', count: counts.DUE },
    { id: 'SCHEDULED', label: 'Scheduled', count: counts.SCHEDULED },
    { id: 'RECOVERED', label: 'Recovered', count: counts.RECOVERED },
    { id: 'DROPPED', label: 'Dropped', count: counts.DROPPED },
  ];

  return (
    <div className="space-y-4">
      {tableMissing && (
        <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3.5 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <b>One-time setup needed:</b> run <code className="px-1 bg-white/70 rounded">cart-followups-schema.sql</code> in the Supabase SQL editor so call outcomes can be saved. The list below still works.
          </div>
        </div>
      )}
      {error && (
        <div className="flex gap-3 items-center bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard tone="rose" label="Call now" icon={<PhoneCall className="w-4 h-4 text-rose-600" />} value={stats.dueNow.toLocaleString('en-IN')}
          sub={stats.dueNoPhone ? `+${stats.dueNoPhone} without phone (email only)` : 'Ready for customer service'} />
        <StatCard tone="amber" label="Open leads" icon={<IndianRupee className="w-4 h-4 text-amber-600" />} value={stats.open.toLocaleString('en-IN')}
          sub={`${fmtMoney(stats.openValue)} still on the table`} />
        <StatCard tone="emerald" label="Recovered · 30 days" icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} value={fmtMoney(stats.recoveredValue)}
          sub={`${stats.recovered} paid later · ${stats.recoveredAfterCall} after our call`} />
        <StatCard tone="blue" label="Call conversion" icon={<Flame className="w-4 h-4 text-blue-600" />} value={`${stats.callConversion}%`}
          sub={`${stats.recoveredAfterCall} of ${stats.calledLeads} called leads bought`} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-grow bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex gap-3 items-center">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or order ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full outline-none text-sm text-slate-800 placeholder:text-slate-400"
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-1 flex gap-1 overflow-x-auto whitespace-nowrap no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setView(t.id); setShowNoPhone(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                view === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t.label}
              <span className={`px-1.5 rounded-md text-[10px] tabular-nums ${view === t.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50" title="Reload from database">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Sync
          </button>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 whitespace-nowrap">
            <Download className="w-4 h-4" /> Export list
          </button>
        </div>
      </div>

      {/* Sub-filter + rules */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {view === 'DUE' && stats.dueNoPhone > 0 && (
          <button
            onClick={() => setShowNoPhone((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border font-medium ${showNoPhone ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {showNoPhone ? '← Back to callable leads' : `${stats.dueNoPhone} leads have no phone — email them`}
          </button>
        )}
        <button onClick={() => setShowRules((v) => !v)} className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium">
          <Info className="w-3.5 h-3.5" /> How this list works
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRules ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showRules && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-white border border-slate-200 rounded-xl p-4 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px] text-slate-600">
              <Rule title="Who gets added">Anyone who started checkout but didn't pay. Retries close together count as one person. Checkouts for courses they already own are ignored.</Rule>
              <Rule title="When they show up">{Math.round(COOL_OFF_MS / MINUTE)} minutes after their last checkout, in case they're still paying.</Rule>
              <Rule title="Who's first">Hot leads first: tried recently, tried several times, bigger cart, asked for a callback or said they'd buy.</Rule>
              <Rule title="If they pay later">They move to <b>Recovered</b> automatically. If we called them before they paid, it counts as recovered after our call.</Rule>
              <Rule title="No answer">Retry after 4 hours, then 1 day, then 2 days. Dropped after {MAX_NO_ANSWER} unanswered calls in a row.</Rule>
              <Rule title="Said they'd buy">Check back after {Math.round(INTERESTED_FOLLOWUP_MS / DAY)} days if they still haven't paid.</Rule>
              <Rule title="When they're dropped">{LEAD_LIFETIME_DAYS} days after their last checkout attempt, or when they say they're not interested, the number is wrong or they already bought.</Rule>
              <Rule title="If they try again">Within {LEAD_LIFETIME_DAYS} days, the same lead reopens with its call history. After that, they come back as a new lead with a clean slate.</Rule>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100">
        {visible.length === 0 && (
          <div className="px-5 py-16 text-center text-slate-400 text-sm">
            {view === 'DUE' ? 'Nobody to call right now 🎉' : 'Nothing here yet'}
          </div>
        )}
        {visible.map((lead) => {
          const names = courseList(lead.courseIds);
          const isOpen = expanded === lead.key;
          return (
            <div key={lead.key} className="hover:bg-slate-50/60 transition-colors">
              <div className="px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center gap-3">
                {/* Who */}
                <button onClick={() => setExpanded(isOpen ? null : lead.key)} className="text-left min-w-0 lg:w-64 shrink-0 group">
                  <div className="flex items-center gap-2">
                    {(view === 'DUE' || view === 'SCHEDULED') && (
                      <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold tracking-wide ${HEAT_STYLE[lead.heat]}`}>{lead.heat}</span>
                    )}
                    <span className="font-medium text-slate-900 truncate group-hover:text-blue-600">{lead.name || lead.email}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                    <div className="truncate">{lead.email}</div>
                    <div className="font-mono">{lead.phone || 'No phone'}</div>
                  </div>
                </button>

                {/* What */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1">
                    {names.map((nm) => (
                      <span key={nm} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-medium">{nm}</span>
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {lead.reasons.map((r) => (
                      <span key={r} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">{r}</span>
                    ))}
                    {lead.lastCall && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${OUTCOME_STYLE[lead.lastCall.outcome]}`}>
                        Last: {OUTCOME_LABELS[lead.lastCall.outcome]} · {ago(new Date(lead.lastCall.created_at).getTime(), now)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Money + timing */}
                <div className="flex lg:flex-col lg:items-end gap-3 lg:gap-0.5 lg:w-40 shrink-0 text-xs">
                  <span className="font-semibold text-emerald-600 text-sm">
                    {fmtMoney(view === 'RECOVERED' ? lead.recoveredOrder?.amount || 0 : lead.cartValue)}
                  </span>
                  <TimingLabel lead={lead} now={now} />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 lg:w-auto shrink-0">
                  {lead.hasPhone && view !== 'RECOVERED' && (
                    <>
                      <a href={`tel:+91${phoneDigits(lead.phone)}`} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Call">
                        <PhoneCall className="w-4 h-4" />
                      </a>
                      <a href={waLink(lead, names.join(', '))} target="_blank" rel="noreferrer" className="p-2 rounded-lg border border-slate-200 text-emerald-600 hover:bg-emerald-50" title="WhatsApp">
                        <MessageCircle className="w-4 h-4" />
                      </a>
                      <button onClick={() => copy(phoneDigits(lead.phone), lead.key)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100" title="Copy number">
                        {copied === lead.key ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </>
                  )}
                  {!lead.hasPhone && view !== 'RECOVERED' && (
                    <a href={`mailto:${lead.email}`} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Email">
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                  {view !== 'RECOVERED' && (
                    <button
                      onClick={() => setLogFor(lead)}
                      disabled={tableMissing}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Log call
                    </button>
                  )}
                </div>
              </div>

              {/* Details */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-4 sm:px-5 pb-4 grid md:grid-cols-2 gap-4 text-xs">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="font-semibold text-slate-700 mb-2">Checkout attempts ({lead.attempts.length})</div>
                        <ul className="space-y-1.5">
                          {lead.attempts.slice().reverse().map((a) => (
                            <li key={a.orderId} className="flex flex-wrap gap-x-2 text-slate-600">
                              <span className="tabular-nums">{fmtDateTime(a.at)}</span>
                              <span className="font-semibold text-slate-800">{fmtMoney(a.amount)}</span>
                              <span className="text-slate-500">{courseList(a.courseIds).join(', ')}</span>
                              <span className="font-mono text-[10px] text-slate-400">{a.orderId}</span>
                            </li>
                          ))}
                        </ul>
                        {lead.recoveredOrder && (
                          <div className="mt-2 pt-2 border-t border-slate-200 text-emerald-700">
                            Paid {fmtMoney(lead.recoveredOrder.amount)} on {fmtDateTime(lead.recoveredOrder.at)} for {courseList(lead.recoveredOrder.courseIds).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="font-semibold text-slate-700 mb-2">Call history</div>
                        {lead.calls.length === 0 && <div className="text-slate-400">Not called yet</div>}
                        <ul className="space-y-2">
                          {lead.calls.slice().reverse().map((c) => (
                            <li key={c.id} className="flex gap-2 items-start group/call">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${OUTCOME_STYLE[c.outcome]}`}>{OUTCOME_LABELS[c.outcome]}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-slate-500">
                                  {fmtDateTime(new Date(c.created_at).getTime())}
                                  {c.called_by ? ` · ${c.called_by.split('@')[0]}` : ''}
                                  {c.callback_at ? ` · call back ${fmtDateTime(new Date(c.callback_at).getTime())}` : ''}
                                </div>
                                {c.note && <div className="text-slate-700 whitespace-pre-wrap">{c.note}</div>}
                              </div>
                              <button onClick={() => deleteCall(c.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/call:opacity-100" title="Remove this entry">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <LogCallModal
        lead={logFor}
        courseNames={logFor ? courseList(logFor.courseIds).join(', ') : ''}
        onClose={() => setLogFor(null)}
        onSave={async (outcome, note, cb) => {
          if (!logFor) return;
          await saveCall(logFor, outcome, note, cb);
          setLogFor(null);
        }}
      />
    </div>
  );
}

function StatCard({ tone, label, icon, value, sub }: { tone: 'rose' | 'amber' | 'emerald' | 'blue'; label: string; icon: ReactNode; value: string; sub: string }) {
  const tones = {
    rose: 'border-rose-200 border-l-rose-500 text-rose-700',
    amber: 'border-amber-200 border-l-amber-500 text-amber-700',
    emerald: 'border-emerald-200 border-l-emerald-500 text-emerald-700',
    blue: 'border-blue-200 border-l-blue-500 text-blue-700',
  }[tone];
  return (
    <div className={`bg-white border-2 border-l-4 rounded-2xl p-4 shadow-sm ${tones}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p>
    </div>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <span className="font-semibold text-slate-800">{title}: </span>
      {children}
    </div>
  );
}

function TimingLabel({ lead, now }: { lead: Lead; now: number }) {
  if (lead.stage === 'RECOVERED' && lead.recoveredOrder) {
    return (
      <span className={`font-medium ${lead.recoveredAfterCall ? 'text-emerald-700' : 'text-slate-500'}`}>
        {lead.recoveredAfterCall ? 'After our call' : 'On their own'} · {ago(lead.recoveredOrder.at, now)}
      </span>
    );
  }
  if (lead.stage === 'DROPPED') {
    return <span className="text-slate-500 inline-flex items-center gap-1"><UserX className="w-3 h-3" />{lead.dropReason}</span>;
  }
  const daysLeft = Math.max(0, Math.ceil((lead.expiresAt - now) / DAY));
  const expiry = <span className="text-slate-400">drops in {daysLeft}d</span>;
  if (lead.stage === 'DUE') {
    const late = lead.dueAt ? now - lead.dueAt : 0;
    return (
      <>
        <span className="font-medium text-rose-600 inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {late > 2 * HOUR ? `Waiting ${fmtSpan(late)}` : 'Due now'}
        </span>
        {expiry}
      </>
    );
  }
  return (
    <>
      <span className="font-medium text-blue-600 inline-flex items-center gap-1">
        <CalendarClock className="w-3 h-3" />
        {lead.stage === 'COOLING' ? `Ready in ${fmtSpan((lead.dueAt || now) - now)}` : `Next call ${fmtDateTime(lead.dueAt || now)}`}
      </span>
      {expiry}
    </>
  );
}

const OUTCOME_OPTIONS: { id: CallOutcome; hint: string }[] = [
  { id: 'NO_ANSWER', hint: 'Retry automatically' },
  { id: 'CALLBACK', hint: 'Pick a time' },
  { id: 'INTERESTED', hint: 'Check again in 2 days' },
  { id: 'NOT_INTERESTED', hint: 'Drops the lead' },
  { id: 'WRONG_NUMBER', hint: 'Drops the lead' },
  { id: 'ALREADY_BOUGHT', hint: 'Drops the lead' },
  { id: 'NOTE', hint: 'Just add a note' },
];

const toLocalInput = (d: Date) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

function LogCallModal({
  lead,
  courseNames,
  onClose,
  onSave,
}: {
  lead: Lead | null;
  courseNames: string;
  onClose: () => void;
  onSave: (outcome: CallOutcome, note: string, callbackAt: string | null) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState('');
  const [callback, setCallback] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOutcome(null);
    setNote('');
    setCallback('');
    setErr(null);
  }, [lead?.key]);

  const presets = () => {
    const base = new Date();
    const in2h = new Date(base.getTime() + 2 * HOUR);
    const tonight = new Date(base); tonight.setHours(19, 0, 0, 0);
    const tomorrow = new Date(base); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(11, 0, 0, 0);
    const list = [{ label: 'In 2 hours', d: in2h }];
    if (tonight.getTime() > base.getTime() + 30 * MINUTE) list.push({ label: 'Today 7 PM', d: tonight });
    list.push({ label: 'Tomorrow 11 AM', d: tomorrow });
    return list;
  };

  const submit = async () => {
    if (!outcome) return;
    if (outcome === 'NOTE' && !note.trim()) {
      setErr('Write the note first');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const cb = outcome === 'CALLBACK' && callback ? new Date(callback).toISOString() : null;
      await onSave(outcome, note, cb);
    } catch (e: any) {
      setErr(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {lead && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => !saving && onClose()} />
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{lead.name || lead.email}</div>
                <div className="text-xs text-slate-500 font-mono">{lead.phone || 'No phone'}</div>
                <div className="text-xs text-slate-500 mt-0.5">{courseNames} · {fmtMoney(lead.cartValue)}</div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>

            <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">What happened?</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {OUTCOME_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOutcome(o.id)}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                    outcome === o.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="text-sm font-medium">{OUTCOME_LABELS[o.id]}</div>
                  <div className={`text-[11px] ${outcome === o.id ? 'text-white/70' : 'text-slate-400'}`}>{o.hint}</div>
                </button>
              ))}
            </div>

            {outcome === 'CALLBACK' && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Call back at</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {presets().map((p) => (
                    <button key={p.label} onClick={() => setCallback(toLocalInput(p.d))} className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  value={callback}
                  onChange={(e) => setCallback(e.target.value)}
                  className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                {!callback && <div className="mt-1 text-[11px] text-slate-400">Leave empty for tomorrow, same time.</div>}
              </div>
            )}

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Note {outcome === 'NOTE' ? '' : '(optional)'}</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. Payment failed on UPI, will try with card tonight. Wants Stats 1 only."
                className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 resize-none"
              />
            </div>

            {err && <div className="mt-2 text-xs text-red-600">{err}</div>}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} disabled={saving} className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button
                onClick={submit}
                disabled={!outcome || saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
