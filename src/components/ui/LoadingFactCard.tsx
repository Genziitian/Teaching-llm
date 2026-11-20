'use client';

import React from 'react';
import { LoadingFact } from '@/lib/facts/loading-facts-data';

export interface LoadingFactCardProps {
  fact: LoadingFact | null;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Loading fact tile in the redesign's "sunk" style: mono label, hairline border, no shadows.
 * Rare / Ultra rare facts keep a visible badge (coupon facts depend on it).
 */
export default function LoadingFactCard({ fact, className = '', style = {} }: LoadingFactCardProps) {
  if (!fact) return null;

  const isRare = fact.rarity === 'RARE';
  const isUltraRare = fact.rarity === 'ULTRA_RARE';
  const isCoupon = fact.isCoupon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`genz-loading-fact-card${isUltraRare ? ' is-ultra' : isRare ? ' is-rare' : ''} ${className}`}
      style={style}
    >
      <div className="genz-loading-fact-card__head">
        <span className="genz-loading-fact-card__label">Fact</span>
        {isUltraRare && <span className="genz-loading-fact-card__badge genz-loading-fact-card__badge--ultra">{isCoupon ? 'Ultra rare 💎' : 'Ultra rare 🔥'}</span>}
        {isRare && <span className="genz-loading-fact-card__badge">Rare ✨</span>}
      </div>
      <p className="genz-loading-fact-card__text">{fact.text}</p>

      <style>{`
        .genz-loading-fact-card {
          width: 100%; max-width: 480px; margin: 0 auto; box-sizing: border-box; text-align: left;
          padding: 12px 14px 13px; border-radius: 12px;
          background: var(--gz-panel, var(--surface, #fff)); border: 1px solid var(--gz-line, var(--border, #e7e7e3));
          color: var(--gz-ink, var(--text-primary, #171717));
          font-family: 'Geist', system-ui, -apple-system, sans-serif;
          animation: loadingFactFadeIn .3s cubic-bezier(.16, 1, .3, 1);
        }
        .genz-loading-fact-card.is-rare { border-color: var(--gz-ink, var(--text-primary, #171717)); }
        .genz-loading-fact-card.is-ultra { border-color: #d64533; }
        .genz-loading-fact-card__head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .genz-loading-fact-card__label {
          font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10.5px; letter-spacing: .06em;
          text-transform: uppercase; color: var(--gz-ink-4, var(--text-muted, #8a8a86));
        }
        .genz-loading-fact-card__badge {
          font-size: 11px; font-weight: 500; padding: 1px 7px; border-radius: 6px;
          background: var(--gz-chip, #f1f1ee); color: var(--gz-ink-2, var(--text-primary, #55554f));
        }
        .genz-loading-fact-card__badge--ultra { background: #fbeeeb; color: #b23b2b; }
        .genz-loading-fact-card__text { margin: 0; font-size: 13.5px; line-height: 1.55; word-break: break-word; white-space: pre-line; }
        @keyframes loadingFactFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 480px) { .genz-loading-fact-card { max-width: 100%; } .genz-loading-fact-card__text { font-size: 12.5px; } }
      `}</style>
    </div>
  );
}

export { LoadingFactCard };
