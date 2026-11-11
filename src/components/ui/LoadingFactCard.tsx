'use client';

import React from 'react';
import { LoadingFact } from '@/lib/facts/loading-facts-data';

export interface LoadingFactCardProps {
  fact: LoadingFact | null;
  className?: string;
  style?: React.CSSProperties;
}

export default function LoadingFactCard({ fact, className = '', style = {} }: LoadingFactCardProps) {
  if (!fact) return null;

  const isRare = fact.rarity === 'RARE';
  const isUltraRare = fact.rarity === 'ULTRA_RARE';
  const isCoupon = fact.isCoupon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`genz-loading-fact-card ${className}`}
      style={{
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        padding: '14px 18px',
        borderRadius: '16px',
        textAlign: 'center',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'all 0.25s ease-out',
        animation: 'loadingFactFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        // Base styling with CSS variable fallbacks for perfect light/dark contrast
        backgroundColor: isUltraRare
          ? 'var(--surface, #ffffff)'
          : isRare
          ? 'var(--surface, #ffffff)'
          : 'var(--surface, #ffffff)',
        border: isUltraRare
          ? '1.5px solid #F59E0B'
          : isRare
          ? '1.5px solid #6366F1'
          : '1px solid var(--border, rgba(15, 23, 42, 0.08))',
        boxShadow: isUltraRare
          ? '0 10px 25px -5px rgba(245, 158, 11, 0.25), 0 8px 10px -6px rgba(220, 38, 38, 0.2)'
          : isRare
          ? '0 10px 25px -5px rgba(99, 102, 241, 0.2), 0 4px 6px -4px rgba(99, 102, 241, 0.1)'
          : 'var(--social-card-shadow, 0 4px 20px rgba(0, 0, 0, 0.05))',
        ...style,
      }}
    >
      {/* Subtle glowing ambient background effect for Rare & Ultra Rare */}
      {isUltraRare && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #F59E0B, #EF4444, #EC4899, #F59E0B)',
            backgroundSize: '200% 100%',
            animation: 'ultraRareShimmer 2.5s linear infinite',
          }}
        />
      )}
      {isRare && !isUltraRare && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2.5px',
            background: 'linear-gradient(90deg, var(--primary), #8B5CF6, #EC4899, var(--primary))',
            backgroundSize: '200% 100%',
            animation: 'rareShimmer 3s linear infinite',
          }}
        />
      )}

      {/* Rarity Indicator: Never show for Common, show for Rare & Ultra Rare */}
      {isUltraRare && (
        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: 'linear-gradient(135deg, #EF4444, #F59E0B)',
              color: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)',
            }}
          >
            {isCoupon ? 'ULTRA RARE 💎' : 'ULTRA RARE 🔥'}
          </span>
        </div>
      )}

      {isRare && (
        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: 'linear-gradient(135deg, var(--primary), #7C3AED)',
              color: '#FFFFFF',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent)',
            }}
          >
            RARE ✨
          </span>
        </div>
      )}

      {/* Fact Text - High contrast guaranteed in light/dark themes */}
      <p
        style={{
          margin: 0,
          fontSize: '13.5px',
          lineHeight: '1.55',
          fontWeight: isUltraRare ? 600 : 500,
          color: 'var(--text-primary, #0F172A)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-line',
        }}
      >
        <span style={{ fontWeight: 700, color: isUltraRare ? '#EF4444' : isRare ? 'var(--primary)' : 'var(--text-primary, #0F172A)' }}>
          Fact :{' '}
        </span>
        {fact.text}
      </p>

      {/* Keyframe animations for animations */}
      <style>{`
        @keyframes loadingFactFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes ultraRareShimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes rareShimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @media (max-width: 480px) {
          .genz-loading-fact-card {
            max-width: 90% !important;
            padding: 12px 14px !important;
          }
          .genz-loading-fact-card p {
            font-size: 12.5px !important;
            line-height: 1.5 !important;
          }
        }
      `}</style>
    </div>
  );
}

export { LoadingFactCard };
