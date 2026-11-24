'use client';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@/landing/shims/router';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { useAuth } from '@/landing/context/AuthContext';
import { findAbandonedCart, markShownThisSession, snoozeCart, wasShownThisSession, type AbandonedCart } from '@/landing/lib/abandonedCart';

const OFFER_CODE = 'GENZ5';
const BLOCKED_PREFIXES = ['/checkout', '/payment', '/manager', '/careers/apply', '/verify', '/cart'];
const SHOW_DELAY_MS = 3500;
const RETRY_MS = 3000;
const MAX_RETRIES = 10;

/** True when any other full-screen overlay is on screen, so we never stack two modals. */
const anotherModalIsOpen = () =>
  Array.from(document.querySelectorAll<HTMLElement>('div.fixed.inset-0, [aria-modal="true"]')).some((el) => {
    if (el.closest('[data-cart-reminder]')) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    return (Number.parseInt(style.zIndex, 10) || 0) >= 40;
  });

/**
 * "Your cart is still waiting" reminder for users who started payment but never finished.
 * Shown at most once per session, only when the latest unpaid order is under 2 days old and unpaid.
 */
export default function CartReminderModal() {
  const { user, isLoginModalOpen, isWelcomeModalOpen } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [cart, setCart] = useState<AbandonedCart | null>(null);
  const [open, setOpen] = useState(false);

  const blockedRoute = BLOCKED_PREFIXES.some((p) => location.pathname.startsWith(p));
  const authModalOpen = isLoginModalOpen || isWelcomeModalOpen;
  const email = user?.email;

  // Look up the abandoned cart once per signed-in user
  useEffect(() => {
    if (!email || wasShownThisSession()) return;
    let alive = true;
    findAbandonedCart(email).then((c) => { if (alive) setCart(c); }).catch(() => { /* stay silent */ });
    return () => { alive = false; };
  }, [email]);

  // Show it a moment after load, once nothing else is on screen
  useEffect(() => {
    if (!cart || open || blockedRoute || authModalOpen || wasShownThisSession()) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      if (anotherModalIsOpen() && tries < MAX_RETRIES) {
        tries += 1;
        timer = setTimeout(attempt, RETRY_MS);
        return;
      }
      if (tries >= MAX_RETRIES) return;
      markShownThisSession();
      setOpen(true);
    };
    timer = setTimeout(attempt, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cart, open, blockedRoute, authModalOpen]);

  // Another modal or a checkout route takes over: step aside
  useEffect(() => {
    if (open && (blockedRoute || authModalOpen)) setOpen(false);
  }, [open, blockedRoute, authModalOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') remindLater(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const remindLater = () => {
    if (cart) snoozeCart(cart.orderId);
    setOpen(false);
  };
  const enrollNow = () => {
    setOpen(false);
    navigate(cart?.checkoutId ? `/checkout/${cart.checkoutId}?offer=${OFFER_CODE}` : '/explore/courses');
  };

  return (
    <AnimatePresence>
      {open && cart && (
        <div data-cart-reminder className="fixed inset-0 z-[150] flex items-center justify-center p-5 text-[#1d1d1f]" role="dialog" aria-modal="true" aria-label="Your cart is still waiting">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={remindLater}
            className="absolute inset-0 bg-[#0b1120]/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
            className="relative w-full max-w-sm rounded-[1.75rem] bg-white p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[#0b1120]">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Your cart is still waiting</h2>
            <p className="mt-1.5 text-sm font-medium text-[#0b1120] line-clamp-2">{cart.courseName}</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Complete your enrollment today and get 5% off with code
            </p>
            <div className="mx-auto mt-2 inline-flex items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-1 text-sm font-semibold tracking-widest text-[#0b1120]">
              {OFFER_CODE}
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={enrollNow} className="w-full rounded-xl bg-[#0b1120] py-3 text-sm font-semibold text-white transition-colors hover:bg-black active:scale-[0.98] cursor-pointer">
                Enroll now
              </button>
              <button onClick={remindLater} className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 cursor-pointer">
                Remind me later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
