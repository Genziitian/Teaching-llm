'use client';
import { useEffect, useState } from 'react';
import { Link } from '@/landing/shims/router';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Loader2 } from 'lucide-react';

type StickyEnrollBannerProps = {
  courseName: string;
  price: number;
  originalPrice?: number | null;
  watchRef: { readonly current: HTMLElement | null };
  /** Re-bind when the watched button mounts or is replaced. */
  watchKey?: string | number | boolean | null;
  href?: string;
  onClick?: () => void;
  label?: string;
  busy?: boolean;
  /** Keep the bar above the mobile tab bar. Desktop stays flush with the viewport. */
  aboveMobileNav?: boolean;
};

export default function StickyEnrollBanner({
  courseName,
  price,
  originalPrice,
  watchRef,
  watchKey,
  href,
  onClick,
  label = 'Enroll Now',
  busy = false,
  aboveMobileNav = false,
}: StickyEnrollBannerProps) {
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mobileNav = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mobileNav.matches);
    sync();
    mobileNav.addEventListener('change', sync);
    return () => mobileNav.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = watchRef.current;
    if (!el) {
      setVisible(false);
      return;
    }

    const inset = aboveMobileNav && isMobile ? 96 : 0;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.35, rootMargin: `0px 0px -${inset}px 0px` }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [watchRef, watchKey, aboveMobileNav, isMobile]);

  const showStrike = originalPrice != null && originalPrice > price;
  const actionClass =
    'shrink-0 inline-flex items-center justify-center gap-1 whitespace-nowrap px-3.5 sm:px-6 py-3 sm:py-3.5 bg-[#0b1120] text-white rounded-xl font-black text-xs sm:text-base border-2 border-[#0b1120] shadow-[3px_3px_0px_#10b981] hover:bg-white hover:text-[#0b1120] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-60';

  const action = href ? (
    <Link to={href} className={actionClass}>
      {label} <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={busy} className={actionClass}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{label} <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" /></>}
    </button>
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="fixed inset-x-0 z-[95]"
          style={{
            bottom: aboveMobileNav && isMobile
              ? 'calc(5.75rem + env(safe-area-inset-bottom, 0px))'
              : 0,
          }}
          role="region"
          aria-label={`${label} ${courseName}`}
        >
          <div className="bg-white/95 backdrop-blur-md border-t-[3px] border-[#0b1120] shadow-[0_-10px_30px_rgba(11,17,32,0.12)]">
            <div
              className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-5"
              style={aboveMobileNav ? undefined : { paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] sm:text-xs font-black uppercase tracking-wide text-gray-500">
                  {courseName}
                </p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-black leading-none text-[#0b1120]">₹{price}</span>
                  {showStrike && (
                    <span className="text-sm sm:text-base font-black text-gray-400 line-through">₹{originalPrice}</span>
                  )}
                </div>
              </div>
              {action}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
