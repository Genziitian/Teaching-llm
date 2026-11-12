import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
export const supabase: SupabaseClient<any, 'public', any> =
  supabaseUrl && supabaseAnonKey ? createClient<any>(supabaseUrl, supabaseAnonKey) : createStub();
