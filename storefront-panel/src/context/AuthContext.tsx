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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const json = res.ok ? await res.json() : null;
        if (!cancelled) setUser(json?.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isManager = user?.role === 'MANAGER';
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
