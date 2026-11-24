'use client';
import { useState } from 'react';
import { Link } from '@/landing/shims/router';
import { ArrowRight, Check, Download, Layers } from 'lucide-react';
import { COVERS, bookletCta, discountPercent, type Booklet } from '@/landing/lib/booklets';

const INK = '#0b1120';

function Coils({ side }: { side: boolean }) {
  const n = side ? 9 : 11;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-30 flex justify-between ${side ? 'flex-col -left-[11px] top-[7%] bottom-[7%]' : 'flex-row -top-[11px] left-[7%] right-[7%]'}`}
    >
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className={`block rounded-full border-[2.5px] ${side ? 'h-[9px] w-[24px]' : 'h-[24px] w-[9px]'}`}
          style={{ borderColor: INK, background: 'linear-gradient(135deg,#ffffff 0%,#cbd5e1 55%,#94a3b8 100%)' }}
        />
      ))}
    </div>
  );
}

function Holes({ side }: { side: boolean }) {
  const n = side ? 9 : 11;
  return (
    <div aria-hidden className={`pointer-events-none absolute flex justify-between ${side ? 'flex-col left-[7px] top-[7%] bottom-[7%]' : 'flex-row top-[7px] left-[7%] right-[7%]'}`}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="block h-[7px] w-[7px] rounded-full" style={{ background: INK, opacity: 0.85 }} />
      ))}
    </div>
  );
}

/** The 3D notebook itself — cover with the name, inside page with the contents. */
export function BookletVisual({ booklet, index = 0, peek = true }: { booklet: Booklet; index?: number; peek?: boolean }) {
  const [open, setOpen] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const c = COVERS[booklet.cover];
  const side = booklet.binding !== 'spiral-top';
  const spiral = booklet.binding !== 'spine';
  const isBundle = booklet.kind === 'bundle';
  const off = discountPercent(booklet);
  const sticker = booklet.price <= 0 ? 'FREE' : off > 0 ? `${off}% OFF` : '';
  const meta = [booklet.term, booklet.exam].filter(Boolean).join(' · ');
  const preview = booklet.contents.slice(0, 3);
  const more = booklet.contents.length - preview.length;

  return (
    <div
      className={`bk-scene relative select-none ${side ? 'bk-side' : 'bk-top'} ${open ? 'bk-open' : ''} ${peek && !peeked && !open ? 'bk-peek' : ''} ${side ? 'pl-3' : 'pt-3'}`}
      style={{ ['--bk-delay' as any]: `${300 + index * 180}ms` }}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
      onClick={() => setOpen((o) => !o)}
      role="button"
      tabIndex={0}
      aria-pressed={open}
      aria-label={`${booklet.title} — ${open ? 'close' : 'peek inside'}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
    >
      <div className="bk-body relative aspect-[4/5] w-full">
        {/* Extra sheets behind a bundle */}
        {isBundle && (
          <>
            <div className="absolute inset-0 rounded-[18px] border-[3px]" style={{ borderColor: INK, background: COVERS.sun.bg, transform: 'translate(14px, 12px) rotate(3.5deg)' }} />
            <div className="absolute inset-0 rounded-[18px] border-[3px]" style={{ borderColor: INK, background: COVERS.mint.bg, transform: 'translate(7px, 6px) rotate(1.6deg)' }} />
          </>
        )}

        {/* Inside page — what this booklet contains */}
        <div
          className="bk-dots absolute inset-0 overflow-hidden rounded-[18px] border-[3px]"
          style={{ borderColor: INK, backgroundColor: c.paper, boxShadow: `6px 6px 0 ${INK}` }}
        >
          {spiral && <Holes side={side} />}
          <div className={`absolute flex flex-col ${side ? 'inset-y-0 right-0 left-[33%] justify-center px-4' : 'inset-x-0 bottom-0 top-[36%] px-5 pb-5'}`}>
            <p className="bk-line mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
              {isBundle ? `${booklet.contents.length} booklets inside` : 'Inside this booklet'}
            </p>
            <ol className="space-y-1.5">
              {booklet.contents.slice(0, 6).map((item, i) => (
                <li key={i} className="bk-line flex items-start gap-2 text-[12.5px] font-bold leading-snug" style={{ color: INK, transitionDelay: `${120 + i * 70}ms` }}>
                  <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 text-[9px] font-black" style={{ borderColor: INK, background: c.bg, color: c.ink }}>
                    {isBundle ? <Check className="h-2.5 w-2.5" strokeWidth={4} /> : i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
              {booklet.contents.length > 6 && <li className="bk-line text-[11px] font-bold text-gray-500">+{booklet.contents.length - 6} more</li>}
              {booklet.contents.length === 0 && <li className="bk-line text-[12px] font-semibold text-gray-400">Contents coming soon</li>}
            </ol>
          </div>
        </div>

        {/* Front cover */}
        <div
          onAnimationEnd={() => setPeeked(true)}
          className="bk-cover absolute inset-0 z-20 overflow-hidden rounded-[18px] border-[3px]"
          style={{ borderColor: INK, background: c.bg, color: c.ink }}
        >
          {/* corner stripes */}
          <div aria-hidden className="absolute -bottom-10 -right-10 h-40 w-40 rotate-12 opacity-25" style={{ background: `repeating-linear-gradient(45deg, ${c.deep} 0 8px, transparent 8px 18px)` }} />
          {booklet.binding === 'spine' && (
            <div aria-hidden className="absolute inset-y-0 left-0 w-[11%] border-r-[3px]" style={{ borderColor: INK, background: c.deep }}>
              <div className="absolute inset-y-3 left-1/2 border-l-2 border-dashed border-white/70" />
            </div>
          )}
          {spiral && <Holes side={side} />}

          <div className={`relative flex h-full flex-col ${side ? 'pl-[13%] pr-4 py-4' : 'px-4 pt-7 pb-4'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-black uppercase tracking-[0.18em] opacity-80">
                {isBundle ? `Bundle · ${booklet.contents.length} booklets` : meta || booklet.level}
              </span>
            </div>

            {/* Name label — like a school notebook label */}
            <div className="mt-3 rounded-xl border-[3px] bg-white p-3" style={{ borderColor: INK, boxShadow: `3px 3px 0 ${INK}`, color: INK }}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">{isBundle ? 'Booklet bundle' : booklet.subject || 'Booklet'}</p>
                {booklet.badge && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: c.bg, color: c.ink }}>
                    {booklet.badge}
                  </span>
                )}
              </div>
              <h4 className="mt-0.5 text-[19px] font-black leading-[1.1] tracking-tight">{booklet.title}</h4>
              <div className="mt-2 space-y-[7px]" aria-hidden>
                <div className="h-[2px] w-full rounded bg-slate-200" />
                <div className="h-[2px] w-2/3 rounded bg-slate-200" />
              </div>
            </div>

            {/* Big exam mark in the middle */}
            {(booklet.exam || booklet.subject) && (
              <p aria-hidden className="pointer-events-none mt-4 truncate text-[44px] font-black uppercase leading-none tracking-tighter" style={{ color: 'transparent', WebkitTextStroke: `2px ${c.ink}`, opacity: 0.35 }}>
                {isBundle ? `×${booklet.contents.length}` : booklet.exam || booklet.subject}
              </p>
            )}

            {/* What it contains, on the front */}
            <div className="mt-auto pt-3">
              <p className="mb-1.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em] opacity-75">
                {isBundle ? <Layers className="h-3 w-3" /> : null} Contains
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preview.map((p, i) => (
                  <span key={i} className="max-w-full truncate rounded-md border-2 bg-white/85 px-1.5 py-0.5 text-[10.5px] font-bold" style={{ borderColor: INK, color: INK }}>
                    {p}
                  </span>
                ))}
                {more > 0 && (
                  <span className="rounded-md border-2 border-dashed px-1.5 py-0.5 text-[10.5px] font-black" style={{ borderColor: c.ink }}>+{more}</span>
                )}
              </div>
              <p className="mt-2.5 text-[9px] font-black uppercase tracking-[0.18em] opacity-60">Tap to peek inside</p>
            </div>
          </div>
        </div>

        {spiral && <Coils side={side} />}

        {/* Round price stamp */}
        {sticker && (
          <div
            className="bk-sticker absolute -right-3 -top-4 z-40 grid h-[62px] w-[62px] place-items-center rounded-full border-[3px] text-center text-[12px] font-black leading-none"
            style={{ borderColor: INK, background: booklet.price <= 0 ? '#bef264' : '#fde047', color: INK, boxShadow: `3px 3px 0 ${INK}`, transform: 'rotate(10deg)' }}
          >
            {sticker}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookletCard({ booklet, index = 0 }: { booklet: Booklet; index?: number }) {
  const cta = bookletCta(booklet);
  const free = booklet.price <= 0;
  const save = booklet.mrp > booklet.price ? booklet.mrp - booklet.price : 0;
  const btnClass =
    'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-[3px] px-5 py-3 text-sm font-black transition-all hover:-translate-x-0.5 hover:-translate-y-0.5';
  const btnStyle = { borderColor: INK, background: free ? '#10b981' : INK, color: '#fff', boxShadow: `4px 4px 0 ${free ? INK : '#f59e0b'}` };
  const Icon = free && booklet.action === 'pdf' ? Download : ArrowRight;
  const disabled = !cta.href;

  return (
    <article className="flex flex-col">
      <BookletVisual booklet={booklet} index={index} />
      <div className="mt-6 flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
          <span>{booklet.level}</span>
          {booklet.subject && !(booklet.kind === 'bundle') && <><span>·</span><span>{booklet.subject}</span></>}
          {booklet.pages > 0 && <><span>·</span><span>{booklet.pages} pages</span></>}
          <span>·</span><span>PDF</span>
        </div>
        {booklet.description && <p className="mt-1.5 text-sm font-medium leading-relaxed text-gray-600">{booklet.description}</p>}
        <div className="mt-auto flex items-end gap-2 pt-3">
          <span className="text-3xl font-black text-[#0b1120]">{free ? 'Free' : `₹${booklet.price}`}</span>
          {booklet.mrp > booklet.price && <span className="pb-1 text-sm font-bold text-gray-400 line-through">₹{booklet.mrp}</span>}
          {save > 0 && !free && <span className="mb-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-800">Save ₹{save}</span>}
        </div>
        {disabled ? (
          <span className={`${btnClass} cursor-not-allowed opacity-50`} style={btnStyle}>Coming soon</span>
        ) : cta.external ? (
          <a href={cta.href} target="_blank" rel="noopener noreferrer" className={btnClass} style={btnStyle}>
            {cta.label} <Icon className="h-4 w-4" />
          </a>
        ) : (
          <Link to={cta.href} className={btnClass} style={btnStyle}>
            {cta.label} <Icon className="h-4 w-4" />
          </Link>
        )}
      </div>
    </article>
  );
}
