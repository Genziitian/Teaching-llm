// SHIM: the storefront panel never talks to Supabase from the browser.
// Every query chain is recorded and POSTed once to the class server at /api/storefront/db.
type Call = { m: string; a: any[] };
type DbError = { message: string; code?: string; details?: string; hint?: string };
type DbResult = { data: any; error: DbError | null; count: number | null; status: number };

const ENDPOINT = '/api/storefront/db';

const WRITE_METHODS = ['insert', 'update', 'upsert', 'delete'];

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Reads go out as GET (not counted as writes by the server's POST rate limit); writes use POST.
function send(table: string, calls: Call[]): Promise<Response> {
  const isRead = calls[0]?.m === 'select' && !calls.some((c) => WRITE_METHODS.includes(c.m));
  if (isRead) {
    const q = b64url(JSON.stringify({ table, calls }));
    if (q.length <= 6000) {
      return fetch(`${ENDPOINT}?q=${q}`, { method: 'GET', credentials: 'same-origin' });
    }
  }
  return fetch(ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ table, calls }),
  });
}

async function execute(table: string, calls: Call[]): Promise<DbResult> {
  try {
    const res = await send(table, calls);
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.status === 401 || res.status === 403 || res.status === 503 || !res.ok) {
      const message = (body && (typeof body.error === 'string' ? body.error : body.error?.message)) || `Request failed (${res.status})`;
      return { data: null, error: { message, code: body?.code }, count: null, status: res.status };
    }
    return {
      data: body?.data ?? null,
      error: body?.error ?? null,
      count: body?.count ?? null,
      status: body?.status ?? res.status,
    };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || 'Network error' }, count: null, status: 0 };
  }
}

function makeBuilder(table: string, calls: Call[] = []): any {
  const target: any = {
    then(onFulfilled?: any, onRejected?: any) {
      return execute(table, calls).then(onFulfilled, onRejected);
    },
    catch(onRejected?: any) {
      return execute(table, calls).catch(onRejected);
    },
    finally(cb?: any) {
      return execute(table, calls).finally(cb);
    },
  };
  // Any other method (select, insert, update, upsert, delete, eq, neq, in, is, not, gt, gte, lt, lte,
  // like, ilike, or, order, range, limit, single, maybeSingle, filter, contains, ...) is recorded.
  return new Proxy(target, {
    get(t, prop: string | symbol) {
      if (typeof prop === 'symbol') return (t as any)[prop];
      if (prop in t) return t[prop];
      return (...a: any[]) => makeBuilder(table, [...calls, { m: prop, a }]);
    },
  });
}

export const supabase: any = {
  from: (table: string) => makeBuilder(table),
  rpc: async (fn: string) => ({
    data: null,
    error: { message: `rpc(${fn}) is not available in the storefront panel` },
    count: null,
    status: 501,
  }),
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: { message: 'Storage is not available in the storefront panel' } }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      remove: async () => ({ data: null, error: { message: 'Storage is not available in the storefront panel' } }),
    }),
  },
  auth: {
    getSession: async () => {
      let email = '';
      try {
        const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const j = await r.json();
        email = j?.user?.email || '';
      } catch {
        /* ignore */
      }
      return { data: { session: { access_token: 'class-session', user: { email } } }, error: null };
    },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
};
