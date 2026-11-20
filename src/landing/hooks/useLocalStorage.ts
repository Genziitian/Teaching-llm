import { useEffect, useState } from 'react';

/**
 * React state that mirrors a localStorage key. Reads happen once on mount;
 * writes happen on every change. Silently no-ops if storage is unavailable
 * (private browsing, quota exceeded) so the UI still works for that session.
 */
export function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch {
      // Corrupt or inaccessible storage — fall back to the initial value.
    }
    return initialValue instanceof Function ? initialValue() : initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — state still works in-memory for this session.
    }
  }, [key, state]);

  return [state, setState] as const;
}
