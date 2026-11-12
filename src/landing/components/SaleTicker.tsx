'use client';
import { useState } from 'react';
import { Check, Copy, Tag } from 'lucide-react';

const CODE = 'GENZ5';

/** Slim promo bar shown on the home and checkout pages: 5% off with code GENZ5 (tap to copy). */
export default function SaleTicker() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CODE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="w-full text-white"
      style={{ background: 'linear-gradient(90deg,#312e81,#4f46e5 50%,#7c3aed)' }}
      role="status"
      aria-label={`Get 5 percent off any course with code ${CODE} at checkout`}
    >
      <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-center gap-x-1.5 whitespace-nowrap px-2 py-2 text-center text-[11px] font-semibold min-[380px]:gap-x-2 min-[380px]:text-xs sm:gap-x-3 sm:px-4 sm:text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span className="sm:hidden">Save 5% · use code</span><span className="hidden sm:inline">Save 5% on any course — apply code</span>
        </span>
        <button
          type="button"
          onClick={copy}
          title="Copy code"
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-amber-300/80 bg-white/10 px-2 py-0.5 font-black tracking-wider sm:px-2.5 sm:tracking-widest text-amber-200 transition-colors hover:bg-white/20 cursor-pointer"
        >
          {CODE}
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5 opacity-80" />}
        </button>
        <span className="text-indigo-100"><span className="hidden min-[420px]:inline">at checkout</span>{copied ? <span className="min-[420px]:before:content-['_·_']">copied!</span> : null}</span>
      </div>
    </div>
  );
}
