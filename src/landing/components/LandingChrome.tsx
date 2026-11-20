'use client';

import React, { useEffect } from 'react';
import { useLocation, useSearchParams } from '@/landing/shims/router';
import { saveReferralCookie } from '@/landing/lib/referral';
import Navbar from '@/landing/components/Navbar';
import Footer from '@/landing/components/Footer';
import MobileNav from '@/landing/components/mobile/MobileNav';
import ErrorBoundary from '@/landing/components/ErrorBoundary';
import LoginModal from '@/landing/components/LoginModal';
import WelcomeModal from '@/landing/components/WelcomeModal';
import SaleTicker from '@/landing/components/SaleTicker';
import CartReminderModal from '@/landing/components/CartReminderModal';

// Captures ?ref=CODE from the URL and saves it to localStorage with 24h expiry
function ReferralCapture() {
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) saveReferralCookie(refCode);
  }, [searchParams]);
  return null;
}

// Scrolls to top on every route change so new pages always start from the header
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function LandingChrome({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const path = location.pathname;
  const isCheckoutPage = path.startsWith('/checkout/');
  const isCoursesPage = path === '/explore/courses';
  const isManagerPage = path.startsWith('/manager');
  const isOneOnOnePage = path === '/one-to-one' || path === '/1-on-1';
  // Full-page job application: hide the mobile tab bar so the sticky submit bar has room
  const isCareerApplyPage = path.startsWith('/careers/apply');

  // Global SEO settings (optional; served by the /api/site routes)
  useEffect(() => {
    fetch('/api/site/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((config) => {
        if (!config) return;
        if (config.site_title) document.title = config.site_title;
        if (config.site_description) {
          let meta = document.querySelector('meta[name="description"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'description');
            document.head.appendChild(meta);
          }
          meta.setAttribute('content', config.site_description);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <LoginModal />
      <WelcomeModal />
      <ReferralCapture />
      <ErrorBoundary>
        <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100 flex flex-col">
          <ScrollToTop />
          <CartReminderModal />
          {!isManagerPage && <Navbar />}
          {(path === '/' || path.startsWith('/checkout')) && <SaleTicker />}
          {/* pb on mobile clears the fixed bottom tab bar; removed on checkout + manager */}
          <main className={`flex-grow ${isCheckoutPage || isManagerPage || isCareerApplyPage ? '' : 'pb-24 md:pb-0'}`}>
            {children}
          </main>
          {/* Footer is hidden on mobile: the bottom-nav Menu tab covers all links there */}
          {!isCheckoutPage && !isCoursesPage && !isManagerPage && !isOneOnOnePage && (
            <div className="hidden md:block">
              <Footer />
            </div>
          )}
          {!isCheckoutPage && !isManagerPage && !isCareerApplyPage && <MobileNav />}
        </div>
      </ErrorBoundary>
    </>
  );
}
