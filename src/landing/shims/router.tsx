'use client';

/**
 * react-router-dom compatibility layer on top of the Next.js App Router.
 * Landing code imports from '@/landing/shims/router' instead of 'react-router-dom'.
 */
import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import NextLink from 'next/link';
import { useParams as useNextParams, usePathname, useRouter } from 'next/navigation';

// Pages that belong to the class (LMS) site: always hard-navigate so CSS does not leak.
const CLASS_PREFIXES = [
  '/dashboard', '/login', '/signup', '/support', '/free-resources', '/homework', '/download',
  '/admin', '/manage', '/materials', '/live', '/maintenance', '/terminated', '/api',
];

function isExternal(to: string) {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(to);
}
function isClassPath(to: string) {
  return CLASS_PREFIXES.some((p) => to === p || to.startsWith(p + '/') || to.startsWith(p + '?') || to.startsWith(p + '#'));
}

type To = string | { pathname?: string; search?: string; hash?: string };
function toHref(to: To | undefined): string {
  if (!to) return '/';
  if (typeof to === 'string') return to;
  return `${to.pathname || ''}${to.search || ''}${to.hash || ''}` || '/';
}

// ---- location store (SSR safe, no Suspense requirement) ----
let patched = false;
const LOC_EVENT = 'landing:locationchange';
function patchHistory() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  (['pushState', 'replaceState'] as const).forEach((m) => {
    const orig = window.history[m];
    window.history[m] = function (this: History, ...args: any[]) {
      const r = (orig as any).apply(this, args);
      try { window.dispatchEvent(new Event(LOC_EVENT)); } catch {}
      return r;
    } as any;
  });
}
function subscribeLoc(cb: () => void) {
  patchHistory();
  window.addEventListener('popstate', cb);
  window.addEventListener('hashchange', cb);
  window.addEventListener(LOC_EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener('hashchange', cb);
    window.removeEventListener(LOC_EVENT, cb);
  };
}
const getSearch = () => (typeof window === 'undefined' ? '' : window.location.search);
const getHash = () => (typeof window === 'undefined' ? '' : window.location.hash);

export function useLocation() {
  const pathname = usePathname() || '/';
  const search = useSyncExternalStore(subscribeLoc, getSearch, () => '');
  const hash = useSyncExternalStore(subscribeLoc, getHash, () => '');
  return useMemo(() => ({ pathname, search, hash, state: null as any, key: pathname + search + hash }), [pathname, search, hash]);
}

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: To | number, opts?: { replace?: boolean; state?: any }) => {
      if (typeof to === 'number') {
        if (to < 0) router.back();
        else if (to > 0) router.forward();
        return;
      }
      const href = toHref(to);
      if (isExternal(href) || isClassPath(href)) {
        if (opts?.replace) window.location.replace(href);
        else window.location.assign(href);
        return;
      }
      if (opts?.replace) router.replace(href);
      else router.push(href);
    },
    [router],
  );
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const raw = (useNextParams() || {}) as Record<string, string | string[]>;
  return useMemo(() => {
    const out: Record<string, string> = {};
    Object.keys(raw).forEach((k) => {
      const v = raw[k];
      const s = Array.isArray(v) ? v.map(decodeURIComponent).join('/') : safeDecode(v);
      out[k] = s;
    });
    // react-router splat
    const catchAll = Object.keys(raw).find((k) => Array.isArray(raw[k]));
    if (catchAll && out['*'] === undefined) out['*'] = out[catchAll];
    return out as T;
  }, [JSON.stringify(raw)]); // eslint-disable-line react-hooks/exhaustive-deps
}
function safeDecode(v: string) {
  try { return decodeURIComponent(v); } catch { return v; }
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string> | string | ((prev: URLSearchParams) => URLSearchParams), opts?: { replace?: boolean }) => void] {
  const search = useSyncExternalStore(subscribeLoc, getSearch, () => '');
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const setParams = useCallback(
    (next: any, opts?: { replace?: boolean }) => {
      const prev = new URLSearchParams(window.location.search);
      const value = typeof next === 'function' ? next(prev) : next;
      const sp = value instanceof URLSearchParams ? value : new URLSearchParams(value);
      const qs = sp.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      if (opts?.replace) window.history.replaceState(window.history.state, '', url);
      else window.history.pushState(window.history.state, '', url);
    },
    [],
  );
  return [params, setParams];
}

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to?: To;
  href?: string;
  replace?: boolean;
  state?: any;
  reloadDocument?: boolean;
  preventScrollReset?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, href, replace, state, reloadDocument, preventScrollReset, scroll, prefetch, children, ...rest },
  ref,
) {
  const target = href ?? toHref(to);
  if (isExternal(target) || isClassPath(target) || reloadDocument || target.startsWith('#')) {
    return (
      <a ref={ref} href={target} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <NextLink ref={ref} href={target} replace={replace} scroll={preventScrollReset ? false : scroll} prefetch={prefetch ?? false} {...rest}>
      {children}
    </NextLink>
  );
});

type NavLinkProps = Omit<LinkProps, 'className' | 'style' | 'children'> & {
  className?: string | ((p: { isActive: boolean; isPending: boolean }) => string | undefined);
  style?: React.CSSProperties | ((p: { isActive: boolean; isPending: boolean }) => React.CSSProperties | undefined);
  children?: React.ReactNode | ((p: { isActive: boolean; isPending: boolean }) => React.ReactNode);
  end?: boolean;
};

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { className, style, children, end, to, href, ...rest },
  ref,
) {
  const pathname = usePathname() || '/';
  const target = href ?? toHref(to);
  const base = target.split(/[?#]/)[0] || '/';
  const isActive = end || base === '/' ? pathname === base : pathname === base || pathname.startsWith(base.replace(/\/$/, '') + '/');
  const state = { isActive, isPending: false };
  return (
    <Link
      ref={ref}
      to={target}
      className={typeof className === 'function' ? className(state) : className}
      style={typeof style === 'function' ? style(state) : style}
      aria-current={isActive ? 'page' : undefined}
      {...rest}
    >
      {typeof children === 'function' ? (children as any)(state) : children}
    </Link>
  );
});

export function Navigate({ to, replace }: { to: To; replace?: boolean; state?: any }) {
  const navigate = useNavigate();
  const href = toHref(to);
  useEffect(() => {
    navigate(href, { replace: replace ?? false });
  }, [href, replace]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
