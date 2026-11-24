'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';

/** Shape kept compatible with the storefront's Supabase `User` where it was read. */
export type LandingUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  avatar?: string | null;
  mobileNumber?: string | null;
  created_at?: string;
  user_metadata: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
    phone?: string;
    whatsapp_number?: string;
    [k: string]: any;
  };
  [k: string]: any;
};

type AuthContextType = {
  user: LandingUser | null;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toLandingUser(u: any): LandingUser {
  const fullName = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.email ? String(u.email).split('@')[0] : '');
  return {
    ...u,
    id: String(u.id),
    email: u.email || '',
    created_at: u.createdAt,
    user_metadata: {
      full_name: fullName,
      name: fullName,
      avatar_url: u.avatar || undefined,
      picture: u.avatar || undefined,
      phone: u.mobileNumber || undefined,
      whatsapp_number: u.mobileNumber || undefined,
    },
  };
}

function goToLogin() {
  if (typeof window === 'undefined') return;
  const here = window.location.pathname + window.location.search + window.location.hash;
  window.location.href = `/login?redirect=${encodeURIComponent(here)}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hadIdentifiedUser = useRef(false);
  const [user, setUser] = useState<LandingUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) throw new Error('unauthenticated');
        const data = await res.json();
        if (cancelled) return;
        if (data?.user) {
          const u = toLandingUser(data.user);
          setUser(u);
          setProfile({
            ...data.user,
            id: u.id,
            email: u.email,
            name: u.user_metadata.full_name,
            full_name: u.user_metadata.full_name,
            phone: u.user_metadata.phone,
            whatsapp_number: u.user_metadata.whatsapp_number,
          });
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      if (user) {
        hadIdentifiedUser.current = true;
        posthog.identify?.(user.id, { email: user.email, name: user.user_metadata.full_name });
      } else if (hadIdentifiedUser.current) {
        hadIdentifiedUser.current = false;
        posthog.reset?.();
      }
    } catch {}
  }, [user?.id, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLoginModal = () => {
    // The class site owns authentication: hard-navigate to its login page.
    goToLogin();
  };
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const signIn = async () => {
    goToLogin();
  };

  const signOut = async () => {
    try {
      posthog.reset?.();
      hadIdentifiedUser.current = false;
    } catch {}
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } catch {}
    window.location.reload();
  };

  const value: AuthContextType = {
    user,
    profile,
    isManager: user?.role === 'MANAGER',
    loading,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    isWelcomeModalOpen,
    closeWelcomeModal: () => setIsWelcomeModalOpen(false),
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
