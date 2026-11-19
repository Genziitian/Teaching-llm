'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, useNavigate, useParams } from '@/landing/shims/router';
import CareerApplicationModal from '@/landing/components/CareerApplicationModal';
import { DEFAULT_CAREERS_ROLES, type CareersRole } from '@/components/storefront/native/CareersTypes';

/**
 * Full-page career application.
 *   /careers/apply/tutor          → dedicated tutor form
 *   /careers/apply/campus-leader  → dedicated campus leader form
 *   /careers/apply/:role          → generic form for any other open role (managed at /manage/careers)
 * Open roles come from /api/site/careers-roles; if that request fails, only the built-in roles are accepted.
 * All form logic (validation, auth, submission) lives in CareerApplicationModal.
 */

const isBuiltInRole = (id: string) => id === 'tutor' || id === 'campus-leader';

function toOpenRoles(value: unknown): CareersRole[] | null {
  if (!Array.isArray(value)) return null;
  return (value as Partial<CareersRole>[])
    .filter(r => r && typeof r === 'object' && r.id && r.title && r.open !== false)
    .map(r => ({
      id: String(r.id),
      title: String(r.title),
      summary: String(r.summary || ''),
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      comp: String(r.comp || ''),
      open: true,
    }));
}

export default function CareerApply() {
  const { role = '' } = useParams<{ role?: string }>();
  const navigate = useNavigate();
  // null while loading the open roles
  const [roles, setRoles] = useState<CareersRole[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/site/careers-roles', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        if (cancelled) return;
        setRoles(toOpenRoles(data?.roles) ?? DEFAULT_CAREERS_ROLES.filter(r => r.open));
      })
      .catch(() => {
        if (!cancelled) setRoles(DEFAULT_CAREERS_ROLES.filter(r => r.open));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const builtIn = isBuiltInRole(role);

  // Built-in roles render straight away; other roles wait for the open-roles list.
  if (roles === null) {
    if (!builtIn) {
      return (
        <div className="min-h-[calc(100dvh-5rem)] bg-[#f5f6fa] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-label="Loading application" />
        </div>
      );
    }
  } else if (!roles.some(r => r.id === role)) {
    // Unknown or closed role
    return <Navigate to="/careers" replace />;
  }

  const roleInfo = roles?.find(r => r.id === role) ?? null;

  return (
    <CareerApplicationModal
      key={role}
      isOpen
      role={role}
      roleInfo={roleInfo}
      // Opened from the dashboard Jobs page (?from=jobs) → go back there, not to the public careers page.
      onClose={() => navigate(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('from') === 'jobs' ? '/jobs' : '/careers')}
    />
  );
}
