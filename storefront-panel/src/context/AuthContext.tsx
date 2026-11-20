// SHIM: auth comes from the class app session (GET /api/auth/me).
import React, { createContext, useContext, useEffect, useState } from 'react';

type AuthContextType = {
  user: any | null;
  profile: any | null;
  isManager: boolean;
  loading: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isWelcomeModalOpen: boolean;
  closeWelcomeModal: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const noop = () => {};
const asyncNoop = async () => {};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, accessRes] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'same-origin' }),
          fetch('/api/storefront/access', { credentials: 'same-origin' }),
        ]);
        const json = res.ok ? await res.json() : null;
        const access = accessRes.ok ? await accessRes.json() : null;
        if (!cancelled) {
          setUser(json?.user ?? null);
          setAllowed(Boolean(access?.allowed));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setAllowed(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isManager = allowed;
  const value: AuthContextType = {
    user,
    profile: user,
    isManager,
    loading,
    isLoginModalOpen: false,
    openLoginModal: noop,
    closeLoginModal: noop,
    isWelcomeModalOpen: false,
    closeWelcomeModal: noop,
    signIn: asyncNoop,
    signOut: asyncNoop,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
