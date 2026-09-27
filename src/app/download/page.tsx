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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', sans-serif; background: #05050f; color: #fff; overflow-x: hidden; -webkit-font-smoothing: antialiased; }

        /* ─── NAVBAR ─── */
        .navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 18px 40px;
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(5,5,15,0.8);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .nav-logo {
          display: flex; align-items: center; gap: 10px;
          font-size: 18px; font-weight: 800; color: #fff; letter-spacing: -0.3px;
        }
        .nav-logo-dot { width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#a855f7); }
        .nav-cta {
          background: linear-gradient(135deg,#6366f1,#8b5cf6);
          color: #fff; border: none; border-radius: 12px;
          padding: 10px 22px; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: 'Inter', sans-serif;
          transition: all 0.2s ease; box-shadow: 0 4px 16px rgba(99,102,241,0.35);
        }
        .nav-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.5); }
        .nav-actions { display: flex; align-items: center; gap: 12px; }
        .nav-login-link {
          color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 600;
          padding: 10px 16px; transition: all 0.2s ease;
          border-radius: 12px; border: 1px solid transparent;
        }
        .nav-login-link:hover { color: #fff; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); }

        /* ─── HERO ─── */
        .hero {
          min-height: 100vh; padding: 120px 40px 80px;
          display: flex; align-items: center; justify-content: center;
          gap: 80px; flex-wrap: wrap;
          background:
            radial-gradient(ellipse 70% 50% at 20% 50%, rgba(99,102,241,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 20%, rgba(168,85,247,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 70% 80%, rgba(236,72,153,0.06) 0%, transparent 60%),
            #05050f;
        }

        /* ─── LEFT ─── */
        .hero-left { flex: 1; min-width: 300px; max-width: 580px; }

        .badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25);
          border-radius: 100px; padding: 7px 18px;
          font-size: 12px; font-weight: 600; color: #a5b4fc;
          letter-spacing: 0.5px; margin-bottom: 28px;
        }
        .badge-live {
          width: 7px; height: 7px; border-radius: 50%; background: #6366f1;
          animation: blink 2s infinite;
        }
        @keyframes blink {
          0%,100% { opacity:1; box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50% { opacity:0.6; box-shadow: 0 0 0 4px rgba(99,102,241,0); }
        }

        .hero-eyebrow {
          font-size: 13px; font-weight: 600; color: #6366f1;
          letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px;
        }

        .hero-title {
          font-size: clamp(36px, 5.5vw, 62px); font-weight: 900;
          line-height: 1.08; letter-spacing: -2px; margin-bottom: 8px;
        }
        .hero-title-sub {
          font-size: clamp(28px, 4vw, 46px); font-weight: 900;
          line-height: 1.08; letter-spacing: -1.5px; margin-bottom: 28px;
        }

        .grad { background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .grad2 { background: linear-gradient(135deg, #f59e0b, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        .hero-desc {
          font-size: 16px; line-height: 1.75; color: #94a3b8; font-weight: 400;
          margin-bottom: 40px; max-width: 520px;
        }
        .hero-desc strong { color: #e2e8f0; font-weight: 600; }

        .btn-row { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-bottom: 20px; }

        .dl-btn {
          display: inline-flex; align-items: center; gap: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff; border: none; border-radius: 16px;
          padding: 16px 32px; font-size: 16px; font-weight: 700;
          cursor: pointer; font-family: 'Inter', sans-serif;
          transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow: 0 8px 28px rgba(99,102,241,0.4); position: relative; overflow: hidden;
          text-decoration: none;
        }
        .dl-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, #818cf8, #a78bfa);
          opacity: 0; transition: opacity 0.3s;
        }
        .dl-btn:hover::after { opacity: 1; }
        .dl-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 16px 40px rgba(99,102,241,0.55); }
        .dl-btn:active { transform: scale(0.98); }
        .dl-btn > * { position: relative; z-index: 1; }
        .dl-btn:disabled { opacity: 0.7; cursor: wait; }

        .dl-icon {
          width: 40px; height: 40px; border-radius: 11px;
          background: rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
        }

        .share-btn {
          display: inline-flex; align-items: center; gap: 9px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8; border-radius: 16px; padding: 16px 26px;
          font-size: 15px; font-weight: 600; cursor: pointer;
          font-family: 'Inter', sans-serif; transition: all 0.25s ease;
        }
        .share-btn:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.18); color: #fff; transform: translateY(-2px); }

        .meta-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
        .pill {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 100px; padding: 6px 14px;
          font-size: 12px; color: #64748b; font-weight: 500;
        }
        .pill-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }

        /* ─── PLAY STORE BUTTON & ANNOUNCEMENT ─── */
        .play-btn {
          display: inline-flex; align-items: center; gap: 14px;
          background: #111119; color: #fff; border: 1.5px solid rgba(255,255,255,0.18);
          border-radius: 16px; padding: 12px 24px; cursor: pointer; text-decoration: none;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12);
          transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        .play-btn:hover {
          background: #191924; border-color: rgba(52,211,153,0.5);
          box-shadow: 0 12px 32px rgba(16,185,129,0.22);
          transform: translateY(-2px) scale(1.02);
        }
        .play-btn:active { transform: scale(0.98); }

        .announcement-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          background: linear-gradient(135deg, rgba(1,135,95,0.15) 0%, rgba(99,102,241,0.14) 100%);
          border: 1px solid rgba(52,211,153,0.35);
          border-radius: 18px; padding: 14px 20px; margin-bottom: 24px;
          box-shadow: 0 8px 30px rgba(1,135,95,0.12);
          backdrop-filter: blur(10px);
          animation: bannerFadeIn 0.5s ease-out;
        }
        @keyframes bannerFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .announcement-body {
          display: flex; align-items: center; gap: 10px; font-size: 13.5px;
          line-height: 1.5; color: #e2e8f0; text-align: left;
        }
        .announcement-tag {
          display: inline-flex; align-items: center; gap: 5px;
          background: #01875f; color: #fff; font-size: 10.5px;
          font-weight: 800; letter-spacing: 0.05em; padding: 4px 10px;
          border-radius: 8px; text-transform: uppercase; flex-shrink: 0;
        }
        .announcement-text { color: #cbd5e1; }
        .announcement-text strong { color: #fff; }
        .announcement-cta {
          display: inline-flex; align-items: center; gap: 8px;
          background: #ffffff; color: #0f172a; font-size: 13px;
          font-weight: 700; padding: 8px 16px; border-radius: 12px;
          text-decoration: none; flex-shrink: 0; transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(255,255,255,0.15);
        }
        .announcement-cta:hover {
          background: #f1f5f9; transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(255,255,255,0.25);
        }

        /* ─── PHONE MOCKUP ─── */
        .hero-right { flex-shrink: 0; position: relative; display: flex; flex-direction: column; align-items: center; }

        .phone-glow {
          position: absolute; width: 320px; height: 580px;
          border-radius: 60px;
          background: radial-gradient(circle at 50% 50%, rgba(99,102,241,0.25) 0%, transparent 70%);
          filter: blur(40px); z-index: 0;
          animation: breathe 4s ease-in-out infinite alternate;
        }
        @keyframes breathe { from { opacity:0.5; transform: scale(0.92); } to { opacity:1; transform: scale(1.08); } }

        .phone-frame {
          width: 270px; height: 555px; border-radius: 48px;
          background: #0f172a;
          border: 1.5px solid rgba(255,255,255,0.1);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08);
          overflow: hidden; position: relative; z-index: 1;
        }
        .phone-notch {
          position: absolute; top: 0; left: 50%; transform: translateX(-50%);
          width: 110px; height: 30px;
          background: #0f172a; border-radius: 0 0 22px 22px; z-index: 10;
        }
        .phone-screen { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }

        .dots { display: flex; gap: 6px; margin-top: 18px; z-index: 2; }
        .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(255,255,255,0.15); cursor: pointer;
          border: none; transition: all 0.3s ease;
        }
        .dot.on { background: #6366f1; width: 22px; border-radius: 4px; }

        /* floating screen labels */
        .screen-label {
          position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
          background: rgba(0,0,0,0.7); backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 100px; padding: 5px 14px;
          font-size: 11px; color: #94a3b8; font-weight: 600; white-space: nowrap; z-index: 5;
        }

        /* ─── STATS BAR ─── */
        .stats {
          background: rgba(255,255,255,0.025);
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 36px 40px;
          display: flex; justify-content: center; gap: 60px; flex-wrap: wrap;
        }
        .stat {
          text-align: center;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
          cursor: default;
          padding: 14px 28px;
          border-radius: 20px;
          border: 1px solid transparent;
        }
        .stat:hover {
          transform: translateY(-6px) scale(1.05);
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.04);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
        }
        .stat-highlight {
          background: rgba(99, 102, 241, 0.05);
          border: 1px solid rgba(99, 102, 241, 0.15);
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.06);
        }
        .stat-highlight:hover {
          background: rgba(99, 102, 241, 0.08);
          border-color: rgba(99, 102, 241, 0.25);
          box-shadow: 0 12px 36px rgba(99, 102, 241, 0.12);
        }
        .stat-n {
          font-size: 38px; font-weight: 900; letter-spacing: -1.5px; line-height: 1;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          margin-bottom: 6px;
          display: inline-block;
          animation: pulse-glow 3s ease-in-out infinite alternate;
        }
        @keyframes pulse-glow {
          0% { filter: drop-shadow(0 0 2px rgba(99, 102, 241, 0.2)); }
          100% { filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.5)); }
        }
        .stat-l { font-size: 13px; color: #475569; font-weight: 500; }

        /* ─── ABOUT ─── */
        .about-section {
          padding: 90px 40px; max-width: 780px; margin: 0 auto; text-align: center;
        }
        .section-tag {
          font-size: 12px; font-weight: 700; color: #6366f1;
          letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 18px;
        }
        .section-h { font-size: clamp(26px,4vw,40px); font-weight: 800; letter-spacing: -0.8px; line-height: 1.2; margin-bottom: 24px; }
        .about-text {
          font-size: 17px; line-height: 1.8; color: #64748b;
          margin-bottom: 16px;
        }
        .about-text strong { color: #94a3b8; font-weight: 600; }
        .about-highlight {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
          border-radius: 12px; padding: 12px 20px;
          font-size: 15px; font-weight: 600; color: #a5b4fc;
          margin-top: 8px;
        }

        /* ─── FEATURES ─── */
        .features-section { padding: 20px 40px 90px; max-width: 1080px; margin: 0 auto; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 16px; }
        .feat-card {
          background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px; padding: 28px;
          transition: all 0.3s ease; cursor: default;
        }
        .feat-card:hover { background: rgba(99,102,241,0.07); border-color: rgba(99,102,241,0.2); transform: translateY(-4px); }
        .feat-icon {
          width: 52px; height: 52px; border-radius: 15px;
          background: rgba(99,102,241,0.1); display: flex; align-items: center; justify-content: center;
          font-size: 24px; margin-bottom: 18px;
        }
        .feat-title { font-size: 16px; font-weight: 700; color: #e2e8f0; margin-bottom: 8px; }
        .feat-desc { font-size: 14px; color: #475569; line-height: 1.65; }

        /* ─── SCREENSHOTS ─── */
        .screens-section {
          padding: 70px 40px 90px;
          background: rgba(255,255,255,0.015);
          border-top: 1px solid rgba(255,255,255,0.05);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          text-align: center;
        }
        .screens-row {
          display: flex; gap: 20px; overflow-x: auto; padding: 24px 0 16px;
          scrollbar-width: none; justify-content: center; flex-wrap: wrap;
        }
        .screen-item { flex-shrink: 0; }
        .screen-phone {
          width: 175px; height: 355px; border-radius: 32px;
          border: 1.5px solid rgba(255,255,255,0.08);
          overflow: hidden; background: #0f172a;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          transition: transform 0.3s ease;
        }
        .screen-phone:hover { transform: translateY(-10px) scale(1.03); }
        .screen-phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
        .screen-lbl { margin-top: 12px; font-size: 12px; color: #334155; font-weight: 600; letter-spacing: 0.5px; }

        /* ─── INSTALL ─── */
        .install-section { padding: 80px 40px; max-width: 680px; margin: 0 auto; text-align: center; }
        .steps { display: flex; flex-direction: column; gap: 14px; margin: 40px 0; text-align: left; }
        .step {
          display: flex; align-items: flex-start; gap: 18px;
          background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 18px; padding: 22px 24px;
          transition: all 0.25s ease;
        }
        .step:hover { background: rgba(99,102,241,0.06); border-color: rgba(99,102,241,0.15); }
        .step-n {
          width: 38px; height: 38px; border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 800; flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(99,102,241,0.35);
        }
        .step-body strong { display: block; color: #e2e8f0; font-size: 15px; font-weight: 700; margin-bottom: 4px; }
        .step-body span { font-size: 14px; color: #475569; line-height: 1.6; }

        /* ─── CTA ─── */
        .cta-section {
          padding: 100px 40px;
          text-align: center;
          background:
            radial-gradient(ellipse 80% 60% at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 70%),
            #05050f;
        }
        .cta-h { font-size: clamp(30px,5vw,54px); font-weight: 900; letter-spacing: -1.5px; margin-bottom: 18px; line-height: 1.1; }
        .cta-sub { font-size: 17px; color: #475569; margin-bottom: 44px; font-weight: 400; }
        .cta-btn-row { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: center; }

        /* ─── FOOTER ─── */
        .footer {
          padding: 36px 40px; text-align: center;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .footer p { font-size: 13px; color: #1e293b; }
        .footer a { color: #6366f1; text-decoration: none; font-weight: 500; }
        .footer a:hover { color: #a5b4fc; }

        /* ─── TOAST ─── */
        .toast {
          position: fixed; bottom: 36px; left: 50%; transform: translateX(-50%);
          background: #0f172a; border: 1px solid rgba(99,102,241,0.4);
          color: #e2e8f0; padding: 14px 26px; border-radius: 14px;
          font-size: 14px; font-weight: 600; z-index: 9999;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          animation: popUp 0.35s cubic-bezier(0.34,1.56,0.64,1);
          white-space: nowrap;
        }
        @keyframes popUp {
          from { opacity:0; transform: translateX(-50%) translateY(16px) scale(0.95); }
          to   { opacity:1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        /* ─── PERMANENT QR CARD ─── */
        .qr-card-container {
          margin-top: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          padding: 20px;
          max-width: 440px;
          text-align: left;
        }
        .qr-card-img-wrapper {
          background: #fff;
          padding: 8px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .qr-card-img {
          width: 100px;
          height: 100px;
          display: block;
        }
        .qr-card-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .qr-card-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
        }
        .qr-card-subtitle {
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.4;
        }
        .qr-card-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          font-weight: 500;
          margin-top: 4px;
        }

        /* ─── QR MODAL OVERLAY ─── */
        .qr-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 5, 15, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }
        .qr-modal-content {
          background: rgba(20, 20, 35, 0.95);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 36px 30px;
          max-width: 360px;
          width: 100%;
          text-align: center;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: qrModalUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes qrModalUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .qr-modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: #94a3b8;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .qr-modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .qr-modal-title {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 8px;
        }
        .qr-modal-desc {
          font-size: 14px;
          color: #94a3b8;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .qr-modal-code-wrapper {
          background: #fff;
          padding: 12px;
          border-radius: 16px;
          margin-bottom: 20px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
        }
        .qr-modal-code {
          width: 180px;
          height: 180px;
          display: block;
        }
        .qr-modal-hint {
          font-size: 13px;
          font-weight: 600;
          color: #a5b4fc;
          margin-bottom: 8px;
        }
        .qr-modal-specs {
          font-size: 11px;
          color: #475569;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 24px;
        }
        .btn-copy-link {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 11px 0;
          font-size: 13.5px;
          font-weight: 700;
          color: #e2e8f0;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-copy-link:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.12);
        }
        .dl-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: #475569 !important;
          box-shadow: none !important;
          transform: none !important;
        }

        /* ─── IOS INSTALL BUTTON ─── */
        .ios-install-btn {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 28px;
          border-radius: 16px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          border: none;
          cursor: pointer;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
        }
        .ios-install-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.5);
        }
        .ios-install-btn:active {
          transform: scale(0.98);
        }
        .ios-installed-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 28px;
          border-radius: 16px;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #4ade80;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          cursor: default;
        }

        /* ─── DUAL QR CARDS ─── */
        .dual-qr-wrapper {
          margin-top: 28px;
          text-align: left;
        }
        .dual-qr-title {
          font-size: 15px;
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 14px;
        }
        .dual-qr-flex {
          display: flex;
          gap: 14px;
        }
        .dual-qr-card {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 18px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
          transition: all 0.25s ease;
        }
        .dual-qr-card:hover {
          background: rgba(99, 102, 241, 0.04);
          border-color: rgba(99, 102, 241, 0.15);
        }
        .dual-qr-card-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
        }
        .dual-qr-card-sub {
          font-size: 11.5px;
          color: #94a3b8;
          line-height: 1.4;
        }
        .dual-qr-code-wrap {
          background: #fff;
          padding: 6px;
          border-radius: 10px;
        }
        .dual-qr-code-wrap img {
          width: 110px;
          height: 110px;
          display: block;
        }

        /* ─── IOS INSTALL MODAL (BOTTOM SHEET) ─── */
        .ios-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(5, 5, 15, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 10000;
          padding: 0;
        }
        @media (min-width: 641px) {
          .ios-modal-overlay {
            align-items: center;
            padding: 20px;
          }
        }
        .ios-modal-content {
          background: rgba(20, 20, 35, 0.97);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px 24px 0 0;
          padding: 32px 24px 40px;
          width: 100%;
          max-width: 420px;
          text-align: center;
          box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4);
          position: relative;
          animation: iosSheetUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 641px) {
          .ios-modal-content {
            border-radius: 24px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1);
            animation: qrModalUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          }
        }
        @keyframes iosSheetUp {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ios-modal-handle {
          width: 40px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.15);
          margin: 0 auto 20px;
        }
        .ios-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: #94a3b8;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .ios-modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .ios-modal-title {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 6px;
        }
        .ios-modal-subtitle {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 28px;
        }
        .ios-step {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          text-align: left;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .ios-step:last-child {
          border-bottom: none;
        }
        .ios-step-num {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
        }
        .ios-step-text {
          font-size: 14px;
          color: #cbd5e1;
          line-height: 1.5;
        }
        .ios-step-text strong {
          color: #fff;
          font-weight: 700;
        }

        /* ─── RESPONSIVE ─── */
        @media (max-width: 640px) {
          .navbar { padding: 16px 20px; }
          .hero { padding: 100px 20px 60px; gap: 50px; }
          .stats { gap: 36px; padding: 32px 20px; }
          .features-section, .about-section, .install-section { padding-left: 20px; padding-right: 20px; }
          .screens-section { padding: 60px 20px 70px; }
          .cta-section { padding: 70px 20px; }
          .screen-phone { width: 150px; height: 305px; }
          .announcement-banner { flex-direction: column; align-items: stretch; gap: 12px; padding: 14px; }
          .announcement-body { flex-direction: column; align-items: flex-start; gap: 8px; font-size: 13px; }
          .announcement-cta { width: 100%; justify-content: center; }
          .play-btn { width: 100%; justify-content: center; }
        }
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
          {/* Announcement Banner */}
          <div className="announcement-banner">
            <div className="announcement-body">
              <span className="announcement-tag">Google Play</span>
              <span className="announcement-text">
                🎉 <strong>Official Release:</strong> We are proud to announce our official app is now live on Google Play Store! Please download it.
              </span>
            </div>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="announcement-cta"
            >
              <PlayGlyph size={15} />
              <span>Install App</span>
            </a>
          </div>

          <div className="badge">
            <span className="badge-live" />
            First-of-its-kind · IITM BS Community
          </div>

          <p className="hero-eyebrow">GENz IITian App</p>

          <h1 className="hero-title">Everything You Need,</h1>
          <h2 className="hero-title-sub">
            <span className="grad">In One Place.</span>
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
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0', fontWeight: '500' }}>
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
                  <span className="dl-icon" style={{ background: 'rgba(255,255,255,0.08)' }}>
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
                    style={{ fontSize: '11px', color: '#34d399', fontWeight: '700', textDecoration: 'none' }}
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
                  <div style={{ fontSize: '11px', color: '#a855f7', fontWeight: '700' }}>Add to Home Screen</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Phone Mockup */}
        <div className="hero-right">
          <div className="phone-glow" />
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
                parent.style.background = 'linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)'
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
                  e.currentTarget.parentElement!.style.background = 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)'
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
        <h2 className="section-h">Built by Students,<br /><span className="grad">For Students</span></h2>
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
          <h2 className="section-h">Everything For Your<br /><span className="grad2">Learning Journey</span></h2>
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
        <h2 className="section-h">Install in <span className="grad">3 Simple Steps</span></h2>
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
        <h2 className="cta-h">Ready to Join the<br /><span className="grad">IITM BS Community?</span></h2>
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
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0', fontWeight: '500' }}>
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
                <span className="dl-icon" style={{ background: 'rgba(255,255,255,0.08)' }}>
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
            <div className="dual-qr-wrapper" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '24px', padding: '24px' }}>
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
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #01875f, #029e6f)', color: '#fff' }}
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
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
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
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
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
