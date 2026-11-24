import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Download,
  Loader2,
  Mail,
  MessageCircle,
  PhoneOff,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

/* ---------------------------------------------------------------------------
 * Users tab for the manager panel.
 *  - Loads every profile once (paged past Supabase's 1000-row cap) and filters
 *    on the client, so typing is instant and the input never unmounts.
 *  - Token search across name / email / phone / referral code / roles.
 *  - Stat cards, role + phone + gender + joined filters, sorting.
 *  - Row quick actions: WhatsApp and email.
 * ------------------------------------------------------------------------- */

type RoleInfo = {
  account: string;
  employee?: { employee_id?: string; role?: string; department?: string; status?: string } | null;
  applications: { role: string; role_title: string; status: string }[];
  referral_code?: string | null;
};

export type EnrichedUser = Record<string, any> & { _roles: RoleInfo; _search: string };

const PAGE = 1000;
const SHOW_STEP = 100;

const fold = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');

export const waNumber = (phone?: string | null) => {
  const d = digits(phone);
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  return d.length >= 10 ? d : '';
};

async function fetchAll(table: string, select: string, order?: { col: string; asc: boolean }) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q: any = supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (order) q = q.order(order.col, { ascending: order.asc });
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const ROLE_STYLE: Record<string, string> = {
  MANAGER: 'bg-violet-50 text-violet-700 border-violet-200',
  EMPLOYEE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  APPLICANT: 'bg-amber-50 text-amber-700 border-amber-200',
  STUDENT: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function RoleBadges({ roles, max = 3 }: { roles?: RoleInfo; max?: number }) {
  if (!roles) return null;
  const badges: { key: string; label: string; cls: string }[] = [
    { key: 'acc', label: roles.account, cls: ROLE_STYLE[roles.account] || ROLE_STYLE.STUDENT },
  ];
  if (roles.employee) {
    badges.push({
      key: 'emp',
      label: `Employee${roles.employee.role ? ` · ${roles.employee.role}` : ''}`,
      cls: ROLE_STYLE.EMPLOYEE,
    });
  }
  roles.applications.forEach((a, i) =>
    badges.push({ key: `app${i}`, label: `Applicant · ${a.role_title}`, cls: ROLE_STYLE.APPLICANT })
  );
  return (
    <div className="flex flex-wrap gap-1">
      {badges.slice(0, max).map(b => (
        <span key={b.key} className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${b.cls}`}>
          {b.label}
        </span>
      ))}
      {badges.length > max && (
        <span className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-semibold text-slate-500">
          +{badges.length - max}
        </span>
      )}
    </div>
  );
}

type RoleFilter = 'all' | 'employee' | 'applicant' | 'referrer' | `acc:${string}`;
type PhoneFilter = 'all' | 'has' | 'none';
type JoinedFilter = 'all' | 'today' | '7d' | '30d';
type SortKey = 'newest' | 'oldest' | 'name';

export default function UsersManager({ onSelectUser }: { onSelectUser: (u: EnrichedUser) => void }) {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warn, setWarn] = useState('');

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [role, setRole] = useState<RoleFilter>('all');
  const [phone, setPhone] = useState<PhoneFilter>('all');
  const [gender, setGender] = useState('all');
  const [joined, setJoined] = useState<JoinedFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [limit, setLimit] = useState(SHOW_STEP);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setWarn('');
    try {
      const [profilesR, refsR, empsR, appsR] = await Promise.allSettled([
        fetchAll('profiles', '*', { col: 'created_at', asc: false }),
        fetchAll('referral_profiles', 'email, referral_code'),
        fetchAll('employees', 'email, employee_id, role, department, status'),
        fetchAll('job_applications', 'email, role, role_title, status'),
      ]);
      if (profilesR.status === 'rejected') throw profilesR.reason;

      const missing = [refsR, empsR, appsR].filter(r => r.status === 'rejected').length;
      if (missing) setWarn('Some role details (referral codes, employees or applications) could not be loaded.');

      const byEmail = <T,>(r: PromiseSettledResult<any[]>, pick: (row: any) => T) => {
        const m = new Map<string, T[]>();
        if (r.status === 'fulfilled') {
          for (const row of r.value) {
            const k = fold(row.email).trim();
            if (!k) continue;
            m.set(k, [...(m.get(k) || []), pick(row)]);
          }
        }
        return m;
      };
      const refs = byEmail(refsR, r => r.referral_code as string);
      const emps = byEmail(empsR, r => r);
      const apps = byEmail(appsR, r => ({ role: r.role, role_title: r.role_title, status: r.status }));

      const enriched: EnrichedUser[] = profilesR.value.map((p: any) => {
        const k = fold(p.email).trim();
        const emp = emps.get(k)?.[0] || null;
        const roles: RoleInfo = {
          account: String(p.role || 'STUDENT').toUpperCase(),
          employee: emp,
          applications: apps.get(k) || [],
          referral_code: refs.get(k)?.[0] || null,
        };
        const search = [
          p.name,
          p.email,
          digits(p.phone),
          p.phone,
          roles.referral_code,
          roles.account,
          emp ? `employee ${emp.role || ''} ${emp.department || ''} ${emp.employee_id || ''}` : '',
          ...roles.applications.map(a => `applicant ${a.role_title} ${a.role}`),
          p.gender,
        ]
          .map(fold)
          .join(' ');
        return { ...p, _roles: roles, _search: search };
      });
      setUsers(enriched);
    } catch (e: any) {
      setError(e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // "/" focuses search (when not already typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t?.tagName || '') && !t?.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ───── derived ───── */
  const now = Date.now();
  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const stats = useMemo(() => {
    const roleCounts = new Map<string, number>();
    let hasPhone = 0, week = 0, employees = 0, tutors = 0, leaders = 0, referrers = 0;
    for (const u of users) {
      roleCounts.set(u._roles.account, (roleCounts.get(u._roles.account) || 0) + 1);
      if (digits(u.phone).length >= 10) hasPhone++;
      if (u.created_at && now - new Date(u.created_at).getTime() <= 7 * 864e5) week++;
      if (u._roles.employee) employees++;
      if (u._roles.referral_code) referrers++;
      if (u._roles.applications.some(a => a.role === 'tutor')) tutors++;
      if (u._roles.applications.some(a => a.role === 'campus-leader')) leaders++;
    }
    return { total: users.length, hasPhone, noPhone: users.length - hasPhone, week, employees, tutors, leaders, referrers, roleCounts };
  }, [users, now]);

  const genders = useMemo(
    () => Array.from(new Set(users.map(u => String(u.gender || '').trim()).filter(Boolean))).sort(),
    [users]
  );

  const filtered = useMemo(() => {
    const tokens = fold(deferredQuery).split(/\s+/).filter(Boolean);
    let list = users.filter(u => {
      for (const t of tokens) if (!u._search.includes(t)) return false;
      if (role === 'employee' && !u._roles.employee) return false;
      if (role === 'applicant' && u._roles.applications.length === 0) return false;
      if (role === 'referrer' && !u._roles.referral_code) return false;
      if (role.startsWith('acc:') && u._roles.account !== role.slice(4)) return false;
      const has = digits(u.phone).length >= 10;
      if (phone === 'has' && !has) return false;
      if (phone === 'none' && has) return false;
      if (gender !== 'all' && String(u.gender || '').trim() !== gender) return false;
      if (joined !== 'all') {
        const ts = u.created_at ? new Date(u.created_at).getTime() : 0;
        if (joined === 'today' && ts < startOfToday) return false;
        if (joined === '7d' && now - ts > 7 * 864e5) return false;
        if (joined === '30d' && now - ts > 30 * 864e5) return false;
      }
      return true;
    });
    if (sort === 'oldest') list = [...list].sort((a, b) => +new Date(a.created_at || 0) - +new Date(b.created_at || 0));
    else if (sort === 'name') list = [...list].sort((a, b) => fold(a.name || '~').localeCompare(fold(b.name || '~')));
    return list; // 'newest' = fetch order
  }, [users, deferredQuery, role, phone, gender, joined, sort, startOfToday, now]);

  useEffect(() => setLimit(SHOW_STEP), [deferredQuery, role, phone, gender, joined, sort]);

  const activeFilters =
    (role !== 'all' ? 1 : 0) + (phone !== 'all' ? 1 : 0) + (gender !== 'all' ? 1 : 0) + (joined !== 'all' ? 1 : 0) + (query ? 1 : 0);

  const clearAll = () => {
    setQuery('');
    setRole('all');
    setPhone('all');
    setGender('all');
    setJoined('all');
    setSort('newest');
  };

  const exportCsv = () => {
    const head = ['Name', 'Email', 'Phone', 'Gender', 'Account role', 'Employee role', 'Applications', 'Referral code', 'Joined'];
    const rows = filtered.map(u => [
      u.name || '',
      u.email || '',
      u.phone || '',
      u.gender || '',
      u._roles.account,
      u._roles.employee?.role || '',
      u._roles.applications.map(a => `${a.role_title} (${a.status})`).join('; '),
      u._roles.referral_code || '',
      u.created_at ? new Date(u.created_at).toLocaleString() : '',
    ]);
    const csv = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  /* ───── UI ───── */
  const roleChips: { id: RoleFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: stats.total },
    ...Array.from(stats.roleCounts.entries()).map(([r, c]) => ({ id: `acc:${r}` as RoleFilter, label: r.charAt(0) + r.slice(1).toLowerCase(), count: c })),
    { id: 'employee', label: 'Employees', count: stats.employees },
    { id: 'applicant', label: 'Applicants', count: stats.tutors + stats.leaders },
    { id: 'referrer', label: 'Referrers', count: stats.referrers },
  ];

  const Card = ({
    label, value, sub, icon: Icon, tone, onClick, active,
  }: { label: string; value: number | string; sub?: string; icon: any; tone: string; onClick?: () => void; active?: boolean }) => (
    <button
      onClick={onClick}
      className={`text-left bg-white border rounded-xl p-3.5 transition-colors ${active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className={`w-4 h-4 ${tone}`} />
      </div>
      <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </button>
  );

  const selectCls =
    'bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-slate-400';

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card label="Total users" value={stats.total.toLocaleString('en-IN')} icon={UsersIcon} tone="text-blue-600"
          onClick={clearAll} active={activeFilters === 0} />
        <Card label="New · 7 days" value={stats.week} icon={UserPlus} tone="text-emerald-600"
          onClick={() => setJoined(joined === '7d' ? 'all' : '7d')} active={joined === '7d'} />
        <Card label="With phone" value={stats.hasPhone} sub={`${stats.total ? Math.round((stats.hasPhone / stats.total) * 100) : 0}% of users`} icon={UserCheck} tone="text-teal-600"
          onClick={() => setPhone(phone === 'has' ? 'all' : 'has')} active={phone === 'has'} />
        <Card label="No number" value={stats.noPhone} icon={PhoneOff} tone="text-rose-600"
          onClick={() => setPhone(phone === 'none' ? 'all' : 'none')} active={phone === 'none'} />
        <Card label="Employees" value={stats.employees} icon={ShieldCheck} tone="text-violet-600"
          onClick={() => setRole(role === 'employee' ? 'all' : 'employee')} active={role === 'employee'} />
        <Card label="Applicants" value={stats.tutors + stats.leaders} sub={`${stats.tutors} tutor · ${stats.leaders} leader`} icon={Briefcase} tone="text-amber-600"
          onClick={() => setRole(role === 'applicant' ? 'all' : 'applicant')} active={role === 'applicant'} />
      </div>

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex gap-3 items-center focus-within:border-slate-400">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={searchRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search name, email, phone, referral code or role…   ( press / )"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setQuery('')}
          className="w-full outline-none text-sm text-slate-800 placeholder:text-slate-400"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-700" aria-label="Clear search">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-1 whitespace-nowrap bg-white border border-slate-200 rounded-xl p-1 w-full">
          {roleChips.map(c => (
            <button
              key={c.id}
              onClick={() => setRole(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                role === c.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {c.label} <span className={role === c.id ? 'text-slate-300' : 'text-slate-400'}>{c.count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectCls} value={phone} onChange={e => setPhone(e.target.value as PhoneFilter)} aria-label="Phone">
            <option value="all">Phone: any</option>
            <option value="has">Has number</option>
            <option value="none">No number</option>
          </select>
          <select className={selectCls} value={gender} onChange={e => setGender(e.target.value)} aria-label="Gender">
            <option value="all">Gender: any</option>
            {genders.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className={selectCls} value={joined} onChange={e => setJoined(e.target.value as JoinedFilter)} aria-label="Joined">
            <option value="all">Joined: any time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <select className={selectCls} value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
          <button onClick={load} title="Reload" className={`${selectCls} inline-flex items-center gap-1.5`}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800">
            <Download className="w-3.5 h-3.5" /> Export {filtered.length !== stats.total ? 'filtered' : 'CSV'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-800">{Math.min(limit, filtered.length)}</strong> of{' '}
          <strong className="text-slate-800">{filtered.length.toLocaleString('en-IN')}</strong>
          {filtered.length !== stats.total && <> (from {stats.total.toLocaleString('en-IN')})</>}
        </span>
        {activeFilters > 0 && (
          <button onClick={clearAll} className="font-semibold text-blue-600 hover:underline">
            Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {warn && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{warn}</div>}
      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full touch-pan-x">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 sm:px-5 py-3">Name &amp; role</th>
                <th className="px-4 sm:px-5 py-3">Email</th>
                <th className="px-4 sm:px-5 py-3">Phone</th>
                <th className="px-4 sm:px-5 py-3">Joined</th>
                <th className="px-4 sm:px-5 py-3 text-right">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Loading users…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-500 text-sm">
                  No users match{query ? <> “<strong>{query}</strong>”</> : ' these filters'}.
                  {activeFilters > 0 && <button onClick={clearAll} className="ml-2 font-semibold text-blue-600 hover:underline">Clear filters</button>}
                </td></tr>
              ) : (
                filtered.slice(0, limit).map(u => {
                  const wa = waNumber(u.phone);
                  return (
                    <tr key={u.id || u.email} onClick={() => onSelectUser(u)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                      <td className="px-4 sm:px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{u.name || 'N/A'}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-transparent group-hover:text-blue-600 transition-colors shrink-0" />
                        </div>
                        <div className="mt-1"><RoleBadges roles={u._roles} /></div>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-slate-500 break-all">{u.email}</td>
                      <td className="px-4 sm:px-5 py-3 text-slate-500 font-mono text-xs">{u.phone || 'N/A'}</td>
                      <td className="px-4 sm:px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                      <td className="px-4 sm:px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          {wa ? (
                            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold">
                              <MessageCircle className="w-3.5 h-3.5" /> <span className="hidden xl:inline">WhatsApp</span>
                            </a>
                          ) : (
                            <span className="inline-flex px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-300" title="No phone number"><MessageCircle className="w-3.5 h-3.5" /></span>
                          )}
                          {u.email && (
                            <a href={`mailto:${u.email}`} title="Send email"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold">
                              <Mail className="w-3.5 h-3.5" /> <span className="hidden xl:inline">Mail</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <button onClick={() => setLimit(l => l + SHOW_STEP)} className="w-full py-3 text-xs font-semibold text-blue-600 hover:bg-slate-50 border-t border-slate-100">
            Show {Math.min(SHOW_STEP, filtered.length - limit)} more
          </button>
        )}
      </div>
    </div>
  );
}
