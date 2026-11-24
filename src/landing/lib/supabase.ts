import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { queryRows } from '@/lib/site/rows-query';

const supabaseUrl = process.env.NEXT_PUBLIC_STOREFRONT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_STOREFRONT_SUPABASE_ANON_KEY;

/**
 * Chainable, awaitable stub used when the storefront Supabase env vars are missing.
 * Every query resolves to an empty result instead of crashing the page.
 */
function createStub(): any {
  const result = { data: null as any, error: null as any, count: 0 };
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === 'then') return (res: any) => Promise.resolve(result).then(res);
      if (prop === 'getSession') return async () => ({ data: { session: null }, error: null });
      if (prop === 'getUser') return async () => ({ data: { user: null }, error: null });
      if (prop === 'onAuthStateChange') return () => ({ data: { subscription: { unsubscribe() {} } } });
      return (..._a: any[]) => new Proxy(function () {}, handler);
    },
    apply() { return new Proxy(function () {}, handler); },
  };
  const stub = new Proxy(function () {}, handler);
  return stub;
}

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn('[landing] Storefront Supabase env vars missing; using empty stub client.');
  }
}

// Untyped schema (the storefront never generated DB types), so table rows are `any`.
const base: SupabaseClient<any, 'public', any> =
  supabaseUrl && supabaseAnonKey ? createClient<any>(supabaseUrl, supabaseAnonKey) : createStub();

// Courses come from the same API as the app/Store (/api/site/courses), not from the website database.
// Pages keep calling supabase.from('courses')...; only this one table is redirected.
let coursesLoad: { at: number; p: Promise<any[]> } | null = null;
function loadCourses(): Promise<any[]> {
  if (!coursesLoad || Date.now() - coursesLoad.at > 60_000) {
    coursesLoad = {
      at: Date.now(),
      p: fetch('/api/site/courses', { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load courses'))))
        .then((d) => (Array.isArray(d?.courses) ? d.courses : []))
        .catch((e) => { coursesLoad = null; throw e; }),
    };
  }
  return coursesLoad.p;
}

function coursesQuery(): any {
  const calls: [string, any[]][] = [];
  const chain: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: any, reject: any) =>
          loadCourses()
            .then((rows) => {
              const q: any = queryRows(rows);
              for (const [m, a] of calls) q[m](...a);
              return q;
            })
            .catch((e) => ({ data: null, error: { message: e?.message || 'Could not load courses' }, count: null, status: 500 }))
            .then(resolve, reject);
      }
      return (...a: any[]) => { calls.push([prop, a]); return chain; };
    },
  });
  return chain;
}

// Every other table also goes through our own API (reads: /api/site/read, writes: manager-only /api/storefront/db),
// so the browser no longer talks to the old website database.
const b64url = (str: string) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const WRITES = ['insert', 'update', 'upsert', 'delete'];

function remoteQuery(table: string): any {
  const calls: { m: string; a: any[] }[] = [];
  const chain: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: any, reject: any) => {
          const isRead = calls[0]?.m === 'select' && !calls.some((c) => WRITES.includes(c.m));
          const req = isRead
            ? fetch(`/api/site/read?q=${b64url(JSON.stringify({ table, calls }))}`, { credentials: 'same-origin' })
            : fetch('/api/storefront/db', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ table, calls }),
              });
          return req
            .then((r) => r.json().catch(() => ({})))
            .then((d) => ({ data: d?.data ?? null, error: d?.error ? (typeof d.error === 'string' ? { message: d.error } : d.error) : null, count: d?.count ?? null, status: d?.status ?? 200 }))
            .catch((e) => ({ data: null, error: { message: e?.message || 'Network error' }, count: null, status: 0 }))
            .then(resolve, reject);
        };
      }
      return (...a: any[]) => { calls.push({ m: prop, a }); return chain; };
    },
  });
  return chain;
}

export const supabase: SupabaseClient<any, 'public', any> = new Proxy(base as any, {
  get(target, prop) {
    if (prop === 'from') return (table: string) => (table === 'courses' ? coursesQuery() : remoteQuery(table));
    const v = Reflect.get(target, prop, target);
    return typeof v === 'function' ? v.bind(target) : v;
  },
});
