'use client';
import React, { useState, useEffect } from 'react';
import { Link } from '@/landing/shims/router';
import { ArrowRight, X } from 'lucide-react';

interface PromoProps {
  variant?: 'inline' | 'floating' | 'banner';
  className?: string;
}

export default function OneOnOnePromoBanner({ variant = 'inline', className = '' }: PromoProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('dismiss_1on1_promo');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sessionStorage.setItem('dismiss_1on1_promo', 'true');
    setDismissed(true);
  };

  if (dismissed && variant !== 'inline') return null;

  // 1. INLINE CARD VARIANT (For Courses page & Section breaks)
  if (variant === 'inline') {
    return (
      <div className={`w-full ${className}`}>
        <div className="relative overflow-hidden bg-gradient-to-r from-[#070d19] via-[#0b1b33] to-[#0e271f] border-[3px] border-[#0b1120] rounded-2xl px-3.5 py-3 sm:px-5 sm:py-4 shadow-[6px_6px_0px_#0b1120] flex items-center justify-between gap-3 sm:gap-6 text-white">
          <p className="min-w-0 text-left text-xs sm:text-base font-black text-white leading-snug">
            Need personalised attention?
          </p>

          <Link
            to="/one-to-one"
            className="shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl font-black text-[10px] sm:text-sm border-2 border-white/20 shadow-[2px_2px_0px_#ffffff] flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
          >
            <span>Explore 1:1 Teaching</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // 2. FLOATING PILL VARIANT (Sleek, uncluttered, minimal)
  if (variant === 'floating') {
    return (
      <aside
        aria-label="1:1 Personalised Batch"
        className={`fixed bottom-6 right-4 sm:right-6 z-40 ${className}`}
      >
        <div className="bg-white/95 backdrop-blur-md text-[#0b1120] border-2 border-[#0b1120] rounded-full pl-2.5 pr-2 py-1.5 shadow-[4px_4px_0px_#0b1120] hover:shadow-[5px_5px_0px_#0b1120] hover:-translate-y-0.5 transition-all flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-black tracking-wide shrink-0">
            1:1 Batch
          </span>

          <Link
            to="/one-to-one"
            className="flex items-center gap-1.5 text-xs font-black text-[#0b1120] hover:text-blue-600 transition-colors whitespace-nowrap"
          >
            <span>Need personal attention?</span>
            <span className="text-blue-600 font-black inline-flex items-center gap-0.5 ml-0.5">
              Explore &rarr;
            </span>
          </Link>

          <div className="w-px h-3.5 bg-gray-200 shrink-0" />

          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="w-5 h-5 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  // 3. TOP BANNER VARIANT
  return (
    <div className={`w-full bg-[#0b1120] text-white border-b border-gray-800 py-2.5 px-4 ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs font-bold">
        <div className="flex items-center gap-2 mx-auto sm:mx-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Need personalised attention?</span>
          <span className="text-gray-300 hidden md:inline">Learn at your own pace with a dedicated senior tutor.</span>
          <Link
            to="/one-to-one"
            className="text-emerald-400 hover:underline font-black flex items-center gap-1 ml-1"
          >
            Check our 1:1 Batch <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
