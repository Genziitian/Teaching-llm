'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import Link from 'next/link'

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.teaching.lms'
const SHARE_URL = 'https://class.genziitian.in/download'

const FEATURES = [
  { icon: '📅', title: 'Lecture Schedules', desc: 'Stay updated with your complete class timetable and never miss a session' },
  { icon: '🎥', title: 'Live Sessions', desc: 'Join live classes directly from the app with one tap' },
  { icon: '📢', title: 'Announcements', desc: 'Get instant course announcements and important notifications' },
  { icon: '🛒', title: 'Explore Courses', desc: 'Browse and purchase courses built for the IITM BS Degree community' },
  { icon: '👥', title: 'Community', desc: 'Connect with fellow learners and be part of the discussion' },
  { icon: '🔔', title: 'Smart Alerts', desc: 'Never miss an important event or opportunity with real-time updates' },
]

const SCREENSHOTS = [
  { src: '/app-screenshots/home.png', label: 'Home' },
  { src: '/app-screenshots/courses.png', label: 'Courses' },
  { src: '/app-screenshots/academics.png', label: 'Academics' },
  { src: '/app-screenshots/calendar.png', label: 'Calendar' },
  { src: '/app-screenshots/feedback.png', label: 'Feedback' },
]

export default function DownloadPage() {
  const [activeScreen, setActiveScreen] = useState(0)
  const [copied, setCopied] = useState(false)
  const [device, setDevice] = useState<'android' | 'ios' | 'desktop' | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [showIosModal, setShowIosModal] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [downloadAppUrl, setDownloadAppUrl] = useState('https://class.genziitian.in/download/app')
  const [iosUrl, setIosUrl] = useState('https://class.genziitian.in/download?device=ios')

  useEffect(() => {
    posthog.capture('download_page_viewed')
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveScreen(prev => (prev + 1) % SCREENSHOTS.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin
      setDownloadAppUrl(`${origin}/download/app`)
      setIosUrl(`${origin}/download?device=ios`)

      // Check if running as installed PWA / standalone
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      setIsStandalone(!!isStandaloneMode)

      const params = new URLSearchParams(window.location.search)
      const urlDevice = params.get('device')
      if (urlDevice === 'desktop') {
        setShowQrModal(true)
      }
      // If redirected from /download/app as iOS, auto-show install guide
      if (urlDevice === 'ios') {
        // We'll auto-show the iOS modal after device detection
      }

      const detectDevice = () => {
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
        if (/android/i.test(ua)) {
          return 'android';
        }
        if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
          return 'ios';
        }
        if (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(ua)) {
          return 'ios';
        }
        return 'desktop';
      };
      const detected = detectDevice();
      setDevice(detected);

      // Auto-show iOS install guide if redirected from QR scan on iPhone
      if (urlDevice === 'ios' && (detected === 'ios')) {
        setShowIosModal(true)
      }
    }
  }, [])

  function handleDownload() {
    if (device === 'ios') {
      if (!isStandalone) {
        setShowIosModal(true)
      }
      return
    }
    if (device === 'desktop' || !device) {
      setShowQrModal(true)
      return
    }

    posthog.capture('play_store_clicked', { source: 'download_page' })
    window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer')
  }

  function handleCopyDownloadLink() {
    navigator.clipboard.writeText(PLAY_STORE_URL)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: 'GENz IITian App',
        text: 'Download the GenZ IITian App – everything for the IITM BS Degree community in one place!',
        url: SHARE_URL,
      })
    } else {
      navigator.clipboard.writeText(SHARE_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
    posthog.capture('download_page_shared')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --dl-bg: #ececea; --dl-card: #fbfbfa; --dl-panel: #ffffff; --dl-soft: #f2f2f0;
          --dl-line: rgba(20,20,18,0.10); --dl-line2: rgba(20,20,18,0.18);
          --dl-ink: #141412; --dl-ink2: #55554f; --dl-ink3: #8a8a84; --dl-on-ink: #fbfbfa;
          --dl-ok: #1f8f5f; --dl-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
          --dl-phone: #141412;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --dl-bg: #0e0e0d; --dl-card: #171716; --dl-panel: #1d1d1b; --dl-soft: #222220;
            --dl-line: rgba(255,255,255,0.08); --dl-line2: rgba(255,255,255,0.16);
            --dl-ink: #f2f2ef; --dl-ink2: #a3a39c; --dl-ink3: #74746e; --dl-on-ink: #141412;
            --dl-ok: #4ade80; --dl-phone: #2a2a28;
          }
        }
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', system-ui, sans-serif; background: var(--dl-bg); color: var(--dl-ink); overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        img { max-width: 100%; }

        /* ─── NAVBAR ─── */
        .navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: 64px; padding: 0 clamp(16px, 4vw, 40px);
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: var(--dl-bg); border-bottom: 1px solid var(--dl-line);
        }
        .nav-logo { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 800; color: var(--dl-ink); letter-spacing: -0.2px; white-space: nowrap; }
        .nav-logo-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dl-ink); }
        .nav-actions { display: flex; align-items: center; gap: 8px; }
        .nav-login-link {
          color: var(--dl-ink2); text-decoration: none; font-size: 13px; font-weight: 600;
          padding: 9px 14px; border-radius: 10px; border: 1px solid transparent; transition: background .15s;
        }
        .nav-login-link:hover { color: var(--dl-ink); background: var(--dl-soft); }
        .nav-cta {
          background: var(--dl-ink); color: var(--dl-on-ink); border: 1px solid var(--dl-ink); border-radius: 10px;
          padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit;
          transition: opacity .15s; white-space: nowrap;
        }
        .nav-cta:hover { opacity: .88; }

        /* ─── HERO ─── */
        .hero {
          min-height: 100vh; padding: 112px clamp(16px, 4vw, 40px) 72px;
          display: flex; align-items: center; justify-content: center;
          gap: clamp(32px, 6vw, 80px); flex-wrap: wrap; background: var(--dl-bg);
        }
        .hero-left { flex: 1 1 420px; min-width: 0; max-width: 580px; }

        .badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--dl-card); border: 1px solid var(--dl-line); border-radius: 100px;
          padding: 7px 14px; font-family: var(--dl-mono); font-size: 11px; font-weight: 600; color: var(--dl-ink2);
          letter-spacing: .04em; text-transform: uppercase; margin-bottom: 24px; max-width: 100%;
        }
        .badge-live { width: 7px; height: 7px; border-radius: 50%; background: var(--dl-ok); flex-shrink: 0; }

        .hero-eyebrow { font-family: var(--dl-mono); font-size: 12px; font-weight: 600; color: var(--dl-ink3); letter-spacing: .14em; text-transform: uppercase; margin-bottom: 14px; }
        .hero-title { font-size: clamp(34px, 5.5vw, 60px); font-weight: 800; line-height: 1.06; letter-spacing: -0.035em; margin-bottom: 4px; }
        .hero-title-sub { font-size: clamp(30px, 4.6vw, 52px); font-weight: 800; line-height: 1.06; letter-spacing: -0.035em; margin-bottom: 24px; color: var(--dl-ink3); }
        .accent { color: var(--dl-ink3); }
        .hero-desc { font-size: 16px; line-height: 1.7; color: var(--dl-ink2); margin-bottom: 32px; max-width: 520px; }
        .hero-desc strong { color: var(--dl-ink); font-weight: 600; }

        .btn-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px; }

        .dl-btn {
          display: inline-flex; align-items: center; gap: 12px;
          background: var(--dl-ink); color: var(--dl-on-ink); border: 1px solid var(--dl-ink); border-radius: 14px;
          padding: 13px 24px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit;
          transition: opacity .15s, transform .15s; text-decoration: none;
        }
        .dl-btn:hover { opacity: .9; }
        .dl-btn:active { transform: scale(.98); }
        .dl-btn:disabled { opacity: .5; cursor: not-allowed; }
        .dl-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--dl-soft); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }

        .share-btn {
          display: inline-flex; align-items: center; gap: 9px; background: var(--dl-card); border: 1px solid var(--dl-line2);
          color: var(--dl-ink); border-radius: 14px; padding: 14px 22px; font-size: 14px; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: background .15s;
        }
        .share-btn:hover { background: var(--dl-soft); }

        .play-btn {
          display: inline-flex; align-items: center; gap: 12px; background: var(--dl-card); color: var(--dl-ink);
          border: 1px solid var(--dl-line2); border-radius: 14px; padding: 10px 20px 10px 12px; cursor: pointer; text-decoration: none;
          font-family: inherit; transition: background .15s, transform .15s;
        }
        .play-btn:hover { background: var(--dl-soft); }
        .play-btn:active { transform: scale(.98); }

        /* ─── PHONE MOCKUP ─── */
        .hero-right { flex: 0 0 auto; position: relative; display: flex; flex-direction: column; align-items: center; max-width: 100%; }
        .phone-frame {
          width: 270px; height: 555px; border-radius: 44px; background: var(--dl-phone);
          border: 6px solid var(--dl-phone); outline: 1px solid var(--dl-line2);
          overflow: hidden; position: relative;
        }
        .phone-notch { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 100px; height: 24px; background: var(--dl-phone); border-radius: 0 0 16px 16px; z-index: 10; }
        .phone-screen { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; background: #fff; }
        .dots { display: flex; gap: 6px; margin-top: 18px; }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dl-line2); cursor: pointer; border: none; transition: all .2s; }
        .dot.on { background: var(--dl-ink); width: 22px; border-radius: 4px; }
        .screen-label {
          position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
          background: var(--dl-ink); color: var(--dl-on-ink); border-radius: 100px; padding: 5px 14px;
          font-family: var(--dl-mono); font-size: 11px; font-weight: 600; white-space: nowrap; z-index: 5;
        }

        /* ─── STATS ─── */
        .stats {
          background: var(--dl-card); border-top: 1px solid var(--dl-line); border-bottom: 1px solid var(--dl-line);
          padding: 28px clamp(16px, 4vw, 40px);
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; max-width: 1080px; margin: 0 auto; border-left: 1px solid var(--dl-line); border-right: 1px solid var(--dl-line);
        }
        .stat { text-align: center; padding: 14px 8px; border-radius: 14px; }
        .stat-highlight { background: var(--dl-soft); }
        .stat-n { font-size: clamp(26px, 4vw, 36px); font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: var(--dl-ink); margin-bottom: 8px; }
        .stat-l { font-family: var(--dl-mono); font-size: 11px; color: var(--dl-ink3); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }

        /* ─── ABOUT ─── */
        .about-section { padding: 80px clamp(16px, 4vw, 40px); max-width: 780px; margin: 0 auto; text-align: center; }
        .section-tag { font-family: var(--dl-mono); font-size: 12px; font-weight: 600; color: var(--dl-ink3); letter-spacing: .14em; text-transform: uppercase; margin-bottom: 16px; }
        .section-h { font-size: clamp(26px, 4vw, 38px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 22px; }
        .about-text { font-size: 16.5px; line-height: 1.75; color: var(--dl-ink2); margin-bottom: 14px; }
        .about-text strong { color: var(--dl-ink); font-weight: 600; }
        .about-highlight {
          display: inline-flex; align-items: center; gap: 8px; background: var(--dl-card); border: 1px solid var(--dl-line);
          border-radius: 12px; padding: 12px 18px; font-size: 14.5px; font-weight: 600; color: var(--dl-ink); margin-top: 8px;
        }

        /* ─── FEATURES ─── */
        .features-section { padding: 16px clamp(16px, 4vw, 40px) 80px; max-width: 1080px; margin: 0 auto; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px; }
        .feat-card { background: var(--dl-card); border: 1px solid var(--dl-line); border-radius: 18px; padding: 24px; }
        .feat-icon { width: 46px; height: 46px; border-radius: 13px; background: var(--dl-soft); display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 16px; }
        .feat-title { font-size: 16px; font-weight: 700; color: var(--dl-ink); margin-bottom: 6px; }
        .feat-desc { font-size: 14px; color: var(--dl-ink2); line-height: 1.6; }

        /* ─── SCREENSHOTS ─── */
        .screens-section { padding: 64px clamp(16px, 4vw, 40px) 72px; background: var(--dl-card); border-top: 1px solid var(--dl-line); border-bottom: 1px solid var(--dl-line); text-align: center; }
        .screens-row { display: flex; gap: 18px; overflow-x: auto; padding: 20px 4px 12px; scrollbar-width: none; justify-content: center; flex-wrap: wrap; }
        .screen-item { flex-shrink: 0; }
        .screen-phone { width: 170px; height: 345px; border-radius: 28px; border: 5px solid var(--dl-phone); outline: 1px solid var(--dl-line2); overflow: hidden; background: var(--dl-phone); transition: transform .2s; }
        .screen-phone:hover { transform: translateY(-6px); }
        .screen-phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
        .screen-lbl { margin-top: 12px; font-family: var(--dl-mono); font-size: 11px; color: var(--dl-ink3); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }

        /* ─── INSTALL ─── */
        .install-section { padding: 72px clamp(16px, 4vw, 40px); max-width: 680px; margin: 0 auto; text-align: center; }
        .steps { display: flex; flex-direction: column; gap: 12px; margin: 36px 0 0; text-align: left; }
        .step { display: flex; align-items: flex-start; gap: 16px; background: var(--dl-card); border: 1px solid var(--dl-line); border-radius: 16px; padding: 20px; }
        .step-n { width: 36px; height: 36px; border-radius: 11px; background: var(--dl-ink); color: var(--dl-on-ink); display: flex; align-items: center; justify-content: center; font-family: var(--dl-mono); font-size: 14px; font-weight: 700; flex-shrink: 0; }
        .step-body strong { display: block; color: var(--dl-ink); font-size: 15px; font-weight: 700; margin-bottom: 4px; }
        .step-body span { font-size: 14px; color: var(--dl-ink2); line-height: 1.6; }

        /* ─── CTA ─── */
        .cta-section { padding: 88px clamp(16px, 4vw, 40px); text-align: center; background: var(--dl-bg); border-top: 1px solid var(--dl-line); }
        .cta-h { font-size: clamp(28px, 5vw, 50px); font-weight: 800; letter-spacing: -0.035em; margin-bottom: 14px; line-height: 1.08; }
        .cta-sub { font-size: 16px; color: var(--dl-ink2); margin-bottom: 36px; }
        .cta-btn-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: center; }

        /* ─── FOOTER ─── */
        .footer { padding: 28px clamp(16px, 4vw, 40px); text-align: center; border-top: 1px solid var(--dl-line); }
        .footer p { font-size: 13px; color: var(--dl-ink3); line-height: 1.8; }
        .footer a { color: var(--dl-ink); text-decoration: none; font-weight: 600; }
        .footer a:hover { text-decoration: underline; }

        /* ─── TOAST ─── */
        .toast {
          position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
          background: var(--dl-ink); color: var(--dl-on-ink); padding: 12px 22px; border-radius: 12px;
          font-size: 14px; font-weight: 600; z-index: 9999; max-width: calc(100vw - 32px); text-align: center;
        }

        /* ─── MODALS ─── */
        .qr-modal-overlay, .ios-modal-overlay {
          position: fixed; inset: 0; background: rgba(10,10,9,0.55); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;
        }
        .qr-modal-content, .ios-modal-content {
          background: var(--dl-panel); color: var(--dl-ink); border: 1px solid var(--dl-line2); border-radius: 22px;
          padding: 32px 26px; width: 100%; max-width: 420px; max-height: calc(100dvh - 32px); overflow-y: auto; text-align: center; position: relative;
          display: flex; flex-direction: column; align-items: center;
        }
        .qr-modal-close, .ios-modal-close {
          position: absolute; top: 14px; right: 14px; background: var(--dl-soft); border: none; color: var(--dl-ink2);
          width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .qr-modal-close:hover, .ios-modal-close:hover { color: var(--dl-ink); }
        .qr-modal-title, .ios-modal-title { font-size: 20px; font-weight: 800; color: var(--dl-ink); margin-bottom: 6px; letter-spacing: -0.02em; }
        .qr-modal-desc, .ios-modal-subtitle { font-size: 14px; color: var(--dl-ink2); line-height: 1.5; margin-bottom: 22px; }
        .qr-modal-specs { font-family: var(--dl-mono); font-size: 10.5px; color: var(--dl-ink3); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 20px; }
        .btn-copy-link {
          width: 100%; background: var(--dl-card); border: 1px solid var(--dl-line2); border-radius: 12px; padding: 11px 0;
          font-size: 13.5px; font-weight: 700; color: var(--dl-ink); cursor: pointer; font-family: inherit;
        }
        .btn-copy-link:hover { background: var(--dl-soft); }
        .ios-modal-handle { display: none; }
        .ios-step { display: flex; align-items: flex-start; gap: 14px; text-align: left; padding: 12px 0; border-bottom: 1px solid var(--dl-line); width: 100%; }
        .ios-step:last-child { border-bottom: none; }
        .ios-step-num { width: 30px; height: 30px; border-radius: 9px; background: var(--dl-ink); color: var(--dl-on-ink); display: flex; align-items: center; justify-content: center; font-family: var(--dl-mono); font-size: 13px; font-weight: 700; flex-shrink: 0; }
        .ios-step-text { font-size: 14px; color: var(--dl-ink2); line-height: 1.5; }
        .ios-step-text strong { color: var(--dl-ink); font-weight: 700; }
        .ios-step-text svg { stroke: var(--dl-ink); }
        .ios-install-btn { display: flex; align-items: center; gap: 12px; padding: 12px 24px; border-radius: 14px; }
        .ios-installed-btn { display: flex; align-items: center; gap: 10px; padding: 13px 24px; border-radius: 14px; background: var(--dl-card); border: 1px solid var(--dl-line2); color: var(--dl-ok); font-size: 15px; font-weight: 700; }

        /* ─── QR CARDS ─── */
        .dual-qr-wrapper { margin-top: 26px; text-align: left; }
        .dual-qr-title { font-size: 15px; font-weight: 700; color: var(--dl-ink); margin-bottom: 14px; }
        .dual-qr-flex { display: flex; gap: 12px; flex-wrap: wrap; }
        .dual-qr-card {
          flex: 1 1 150px; min-width: 0; background: var(--dl-card); border: 1px solid var(--dl-line); border-radius: 16px; padding: 16px;
          display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
        }
        .dual-qr-card-label { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--dl-ink); }
        .dual-qr-card-sub { font-size: 11.5px; color: var(--dl-ink2); line-height: 1.4; }
        .dual-qr-code-wrap { background: #fff; padding: 6px; border-radius: 10px; border: 1px solid var(--dl-line); }
        .dual-qr-code-wrap img { width: 110px; height: 110px; display: block; }
        .cta-qr { background: var(--dl-card); border: 1px solid var(--dl-line); border-radius: 22px; padding: 22px; }

        /* ─── RESPONSIVE ─── */
        @media (max-width: 900px) {
          .hero { min-height: 0; padding-top: 96px; flex-direction: column; align-items: stretch; }
          .hero-left { max-width: none; flex: 0 0 auto; }
          .hero-right { align-self: center; }
          .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); border-left: none; border-right: none; }
        }
        @media (max-width: 640px) {
          .navbar { height: 58px; }
          .nav-login-link { padding: 8px 10px; }
          .hero { padding-bottom: 48px; gap: 40px; }
          .hero-desc { font-size: 15px; }
          .btn-row > div { width: 100%; }
          .play-btn, .dl-btn, .share-btn { width: 100%; justify-content: center; }
          .play-btn > div { text-align: left; }
          .about-section { padding-top: 56px; padding-bottom: 56px; }
          .features-section { padding-bottom: 56px; }
          .screens-section { padding-top: 48px; padding-bottom: 52px; }
          .screens-row { flex-wrap: nowrap; justify-content: flex-start; scroll-snap-type: x mandatory; margin: 0 -16px; padding-left: 16px; padding-right: 16px; }
          .screen-item { scroll-snap-align: center; }
          .screen-phone { width: 150px; height: 305px; }
          .install-section { padding-top: 52px; padding-bottom: 52px; }
          .step { padding: 16px; gap: 12px; }
          .cta-section { padding-top: 60px; padding-bottom: 60px; }
          .cta-qr { padding: 16px; }
          .qr-modal-content, .ios-modal-content { padding: 28px 18px; }
          .ios-modal-overlay { align-items: flex-end; padding: 0; }
          .ios-modal-content { border-radius: 22px 22px 0 0; max-width: none; }
          .ios-modal-handle { display: block; width: 40px; height: 4px; border-radius: 2px; background: var(--dl-line2); margin: 0 auto 18px; }
        }
        @media (max-width: 380px) {
          .phone-frame { width: 240px; height: 495px; }
          .stat-n { font-size: 24px; }
        }
        @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition: none !important; } }
      `}</style>

      {/* ─── NAVBAR ─── */}
      <nav className="navbar">
        <div className="nav-logo">
          <div className="nav-logo-dot" />
          GENz IITian
        </div>
        <div className="nav-actions">
          <Link href="/login" className="nav-login-link">
            Student Login
          </Link>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-cta"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
          >
            <PlayGlyph size={15} />
            <span>Google Play</span>
          </a>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="hero-left">
          <div className="badge">
            <span className="badge-live" />
            First-of-its-kind · IITM BS Community
          </div>

          <p className="hero-eyebrow">GENz IITian App</p>

          <h1 className="hero-title">Everything You Need,</h1>
          <h2 className="hero-title-sub">
            <span className="accent">In One Place.</span>
          </h2>

          <p className="hero-desc">
            Welcome to the <strong>GenZ IITian App</strong> – a first-of-its-kind platform for the{' '}
            <strong>IITM BS Degree community!</strong> Stay updated with lecture schedules, live sessions,
            course announcements, and community discussions. Built by students, for students.
          </p>

          <div className="btn-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', width: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', width: '100%' }}>
              {device === 'ios' ? (
                isStandalone ? (
                  <div className="ios-installed-btn">
                    <span>✓ GenZ IITian is installed</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button className="dl-btn ios-install-btn" onClick={handleDownload}>
                      <span className="dl-icon">📱</span>
                      <span>Install on iPhone</span>
                    </button>
                    <p style={{ fontSize: '13px', color: 'var(--dl-ink2)', margin: '4px 0 0 0', fontWeight: '500' }}>
                      Add GenZ IITian to your Home Screen
                    </p>
                  </div>
                )
              ) : (
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="play-btn"
                  onClick={() => posthog.capture('play_store_clicked', { source: 'hero' })}
                >
                  <span className="dl-icon" style={{ background: 'var(--dl-soft)' }}>
                    <PlayGlyph size={24} />
                  </span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, fontWeight: 600 }}>Get it on</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1.15 }}>Google Play</div>
                  </div>
                </a>
              )}
              <button className="share-btn" onClick={handleShare}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                {copied ? '✅ Copied!' : 'Share App'}
              </button>
            </div>
          </div>

          {(device === 'desktop' || !device) && (
            <div className="dual-qr-wrapper">
              <div className="dual-qr-title">Get GenZ IITian on your phone</div>
              <div className="dual-qr-flex">
                <div className="dual-qr-card">
                  <div className="dual-qr-card-label">
                    <PlayGlyph size={15} />
                    Android / Play Store
                  </div>
                  <div className="dual-qr-code-wrap">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(PLAY_STORE_URL)}`}
                      alt="Google Play QR"
                    />
                  </div>
                  <div className="dual-qr-card-sub">Scan to install from Google Play</div>
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '11px', color: 'var(--dl-ok)', fontWeight: '700', textDecoration: 'none' }}
                  >
                    Google Play Store ↗
                  </a>
                </div>

                <div className="dual-qr-card">
                  <div className="dual-qr-card-label">
                    iPhone/iPad
                  </div>
                  <div className="dual-qr-code-wrap">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(iosUrl)}`}
                      alt="iPhone App QR"
                    />
                  </div>
                  <div className="dual-qr-card-sub">Scan to add GenZ IITian to your iPhone</div>
                  <div style={{ fontSize: '11px', color: 'var(--dl-ink2)', fontWeight: '700' }}>Add to Home Screen</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Phone Mockup */}
        <div className="hero-right">
          <div className="phone-frame">
            <div className="phone-notch" />
            <img
              key={activeScreen}
              src={SCREENSHOTS[activeScreen].src}
              alt={SCREENSHOTS[activeScreen].label}
              className="phone-screen"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const parent = e.currentTarget.parentElement!
                parent.style.background = 'var(--dl-soft)'
              }}
            />
            <div className="screen-label">{SCREENSHOTS[activeScreen].label}</div>
          </div>
          <div className="dots">
            {SCREENSHOTS.map((_, i) => (
              <button key={i} className={`dot ${i === activeScreen ? 'on' : ''}`} onClick={() => setActiveScreen(i)} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <div className="stats">
        {[
          { n: '500+', l: 'Active Students', highlight: true },
          { n: '50+',  l: 'Live Sessions' },
          { n: '4.9★', l: 'Student Rating' },
          { n: '100%', l: 'Free to Download' },
        ].map(s => (
          <div key={s.l} className={`stat ${s.highlight ? 'stat-highlight' : ''}`}>
            <div className="stat-n">{s.n}</div>
            <div className="stat-l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* ─── SCREENSHOTS ─── */}
      <section className="screens-section">
        <p className="section-tag">App Preview</p>
        <h2 className="section-h">See It In Action</h2>
        <div className="screens-row">
          {SCREENSHOTS.map((s, i) => (
            <div key={i} className="screen-item">
              <div className="screen-phone">
                <img src={s.src} alt={s.label} onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.parentElement!.style.background = 'var(--dl-soft)'
                }} />
              </div>
              <div className="screen-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ABOUT ─── */}
      <section className="about-section">
        <p className="section-tag">About The App</p>
        <h2 className="section-h">Built by Students,<br /><span className="accent">For Students</span></h2>
        <p className="about-text">
          For the first time, students can <strong>access everything they need in one place.</strong>{' '}
          Explore and purchase courses, connect with fellow learners, receive instant updates,
          and never miss an important event or opportunity.
        </p>
        <p className="about-text">
          The GenZ IITian App is designed to make your learning journey{' '}
          <strong>simpler, faster, and more connected.</strong>{' '}
          Download now and become part of the future of the IITM BS student community.
        </p>
        <div className="about-highlight">
          🎓 Exclusively for the IITM BS Degree Community
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="features-section">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p className="section-tag">What's Inside</p>
          <h2 className="section-h">Everything For Your<br /><span className="accent">Learning Journey</span></h2>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feat-card">
              <div className="feat-icon">{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>



      {/* ─── INSTALL GUIDE ─── */}
      <section className="install-section">
        <p className="section-tag">Quick Setup</p>
        <h2 className="section-h">Install in <span className="accent">3 Simple Steps</span></h2>
        <div className="steps">
          {[
            { n: '1', t: 'Open Google Play Store', b: 'Click the button or scan the QR code to open GenZ IITian directly on the Google Play Store.' },
            { n: '2', t: 'Tap Install', b: 'Verified and secured by Google Play Protect. The app downloads and installs automatically in seconds.' },
            { n: '3', t: 'Sign In & Learn', b: 'Open the GENz IITian app and sign in with your Google account to access your courses instantly.' },
          ].map(s => (
            <div key={s.n} className="step">
              <div className="step-n">{s.n}</div>
              <div className="step-body">
                <strong>{s.t}</strong>
                <span>{s.b}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="cta-section">
        <h2 className="cta-h">Ready to Join the<br /><span className="accent">IITM BS Community?</span></h2>
        <p className="cta-sub">Install our official app from the Google Play Store and start learning today.</p>
        <div className="cta-btn-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'center' }}>
            {device === 'ios' ? (
              isStandalone ? (
                <div className="ios-installed-btn">
                  <span>✓ GenZ IITian is installed</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                  <button className="dl-btn ios-install-btn" onClick={handleDownload}>
                    <span className="dl-icon">📱</span>
                    <span>Install on iPhone</span>
                  </button>
                  <p style={{ fontSize: '13px', color: 'var(--dl-ink2)', margin: '4px 0 0 0', fontWeight: '500' }}>
                    Add GenZ IITian to your Home Screen
                  </p>
                </div>
              )
            ) : (
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="play-btn"
                onClick={() => posthog.capture('play_store_clicked', { source: 'cta' })}
              >
                <span className="dl-icon" style={{ background: 'var(--dl-soft)' }}>
                  <PlayGlyph size={24} />
                </span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, fontWeight: 600 }}>Get it on</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1.15 }}>Google Play</div>
                </div>
              </a>
            )}
            <button className="share-btn" onClick={handleShare}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              {copied ? '✅ Copied!' : 'Share with Friends'}
            </button>
          </div>
        </div>

        {(device === 'desktop' || !device) && (
          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
            <div className="dual-qr-wrapper cta-qr">
              <div className="dual-qr-title" style={{ textAlign: 'center', marginBottom: '20px' }}>Get GenZ IITian on your phone</div>
              <div className="dual-qr-flex" style={{ justifyContent: 'center' }}>
                <div className="dual-qr-card" style={{ maxWidth: '175px' }}>
                  <div className="dual-qr-card-label" style={{ fontSize: '13px' }}>
                    <PlayGlyph size={14} />
                    Google Play
                  </div>
                  <div className="dual-qr-code-wrap">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(PLAY_STORE_URL)}`}
                      alt="Google Play QR"
                      style={{ width: '90px', height: '90px' }}
                    />
                  </div>
                  <div className="dual-qr-card-sub" style={{ fontSize: '10.5px' }}>Scan for Google Play</div>
                </div>

                <div className="dual-qr-card" style={{ maxWidth: '175px' }}>
                  <div className="dual-qr-card-label" style={{ fontSize: '13px' }}>
                    iPhone/iPad
                  </div>
                  <div className="dual-qr-code-wrap">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(iosUrl)}`}
                      alt="iPhone App QR"
                      style={{ width: '90px', height: '90px' }}
                    />
                  </div>
                  <div className="dual-qr-card-sub" style={{ fontSize: '10.5px' }}>Scan to add to iPhone</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer">
        <p>
          © 2026 GENz IITian ·{' '}
          <a href="mailto:help@genziitian.in">help@genziitian.in</a> ·{' '}
          <a href="/login">Student Login</a>
        </p>
      </footer>

      {/* Toast */}
      {copied && <div className="toast">🔗 Link copied! Share it with your friends.</div>}
      {copiedLink && <div className="toast">🔗 Play Store link copied to clipboard!</div>}

      {/* Dual Device QR Code Modal Overlay */}
      {showQrModal && (
        <div className="qr-modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="qr-modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={() => setShowQrModal(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="qr-modal-title" style={{ fontSize: '22px', marginBottom: '6px' }}>Get GenZ IITian on your phone</div>
            <p className="qr-modal-desc" style={{ fontSize: '13px', marginBottom: '24px' }}>
              Scan the QR code corresponding to your device camera to get started.
            </p>
            
            <div className="dual-qr-flex" style={{ width: '100%', marginBottom: '24px' }}>
              {/* Android QR */}
              <div className="dual-qr-card" style={{ padding: '16px 12px' }}>
                <div className="dual-qr-card-label" style={{ fontSize: '13.5px' }}>
                  <PlayGlyph size={15} />
                  Google Play
                </div>
                <div className="dual-qr-code-wrap">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(PLAY_STORE_URL)}`}
                    alt="Google Play QR"
                    style={{ width: '105px', height: '105px' }}
                  />
                </div>
                <div className="dual-qr-card-sub" style={{ fontSize: '11px' }}>Scan to open Play Store</div>
              </div>

              {/* iPhone QR */}
              <div className="dual-qr-card" style={{ padding: '16px 12px' }}>
                <div className="dual-qr-card-label" style={{ fontSize: '13.5px' }}>
                  iPhone/iPad
                </div>
                <div className="dual-qr-code-wrap">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(iosUrl)}`}
                    alt="iPhone App QR"
                    style={{ width: '105px', height: '105px' }}
                  />
                </div>
                <div className="dual-qr-card-sub" style={{ fontSize: '11px' }}>Scan to install app</div>
              </div>
            </div>

            <div className="qr-modal-specs" style={{ fontSize: '11px', color: '#64748b', marginBottom: '20px' }}>
              Google Play Verified  •  iOS Safari  •  Free
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-copy-link"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <PlayGlyph size={16} />
                <span>Open Google Play Store</span>
              </a>
              <button className="btn-copy-link" onClick={handleCopyDownloadLink}>
                {copiedLink ? '✅ Link Copied!' : 'Copy Play Store Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Safari Install Guide Bottom Sheet */}
      {showIosModal && (
        <div className="ios-modal-overlay" onClick={() => setShowIosModal(false)}>
          <div className="ios-modal-content" onClick={e => e.stopPropagation()}>
            <div className="ios-modal-handle" />
            <button className="ios-modal-close" onClick={() => setShowIosModal(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            
            <div className="ios-modal-title">Install GenZ IITian</div>
            <div className="ios-modal-subtitle">Follow these quick steps to add the app to your Home Screen</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '0 0 24px 0' }}>
              <div className="ios-step">
                <div className="ios-step-num">1</div>
                <div className="ios-step-text">
                  Open this website in <strong>Safari browser</strong> if you aren't already.
                </div>
              </div>

              <div className="ios-step">
                <div className="ios-step-num">2</div>
                <div className="ios-step-text">
                  Tap the <strong>Share</strong> button
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px', borderRadius: '6px', verticalAlign: 'middle', margin: '0 4px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                      <polyline points="16 6 12 2 8 6"/>
                      <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </span>
                  at the bottom of Safari.
                </div>
              </div>

              <div className="ios-step">
                <div className="ios-step-num">3</div>
                <div className="ios-step-text">
                  Scroll down and tap <strong>Add to Home Screen</strong>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px', borderRadius: '6px', verticalAlign: 'middle', margin: '0 4px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="3" width="18" height="18" rx="5" ry="5"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                      <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </span>
                  from the menu.
                </div>
              </div>

              <div className="ios-step">
                <div className="ios-step-num">4</div>
                <div className="ios-step-text">
                  Tap <strong>Add</strong> in the top-right corner to complete installation.
                </div>
              </div>
            </div>
            
            <button className="dl-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowIosModal(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function PlayGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      <path fill="#34A853" d="M3.5 20.5 14.2 12 3.5 3.5v17z" />
      <path fill="#FBBC04" d="M3.5 20.5 14.2 12l3.2 2.6-13.9 5.9z" />
      <path fill="#EA4335" d="M3.5 3.5 17.4 9.4 14.2 12 3.5 3.5z" />
      <path fill="#4285F4" d="M17.4 9.4 20.5 11c.7.4.7 1.6 0 2l-3.1 1.6L14.2 12l3.2-2.6z" />
    </svg>
  )
}
