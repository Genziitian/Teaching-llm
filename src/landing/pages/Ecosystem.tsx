'use client';

import { useState } from 'react';
import { Link } from '@/landing/shims/router';
import { motion } from 'motion/react';
import {
  Globe, LayoutDashboard, Smartphone, ClipboardCheck, Share2,
  ArrowRight, ArrowUpRight, Download, Check, Play, Youtube, Instagram, Linkedin, MessageCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';

/* ----------------------------------------------------------------------------
   Snapshot frames — real screenshots from /Image/ecosystem with a styled CSS
   fallback so the page never looks broken before the images are added.
---------------------------------------------------------------------------- */

function Shot({ src, alt, fallback }: { src: string; alt: string; fallback: ReactNode }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <>{fallback}</>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setOk(false)} className="w-full h-full object-cover object-top" />;
}

function BrowserMock({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="w-full rounded-2xl border-[3px] border-[#0b1120] bg-white shadow-[10px_10px_0px_#0b1120] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b-[3px] border-[#0b1120] bg-gray-50">
        <span className="w-3 h-3 rounded-full bg-red-400 border border-[#0b1120]" />
        <span className="w-3 h-3 rounded-full bg-yellow-400 border border-[#0b1120]" />
        <span className="w-3 h-3 rounded-full bg-green-400 border border-[#0b1120]" />
        <div className="ml-2 flex-1 truncate rounded-md bg-white border-2 border-[#0b1120]/15 px-3 py-1 text-[10px] font-bold text-gray-400">{url}</div>
      </div>
      <div className="aspect-[16/10] bg-white overflow-hidden">{children}</div>
    </div>
  );
}

function PhoneMock({ children, w = 200 }: { children: ReactNode; w?: number }) {
  return (
    <div className="shrink-0 rounded-[2rem] border-[4px] border-[#0b1120] bg-[#0b1120] p-1.5 shadow-[10px_10px_0px_#0b1120]" style={{ width: w }}>
      <div className="relative rounded-[1.5rem] overflow-hidden bg-[#f1f3f7] aspect-[9/18]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-3 bg-[#0b1120] rounded-b-lg z-20" />
        {children}
      </div>
    </div>
  );
}

const Bar = ({ w, c = 'bg-gray-200' }: { w: string; c?: string }) => <div className={`h-2 rounded-full ${c}`} style={{ width: w }} />;

/* ---- CSS fallbacks (used only if a screenshot file is missing) ---- */

const WebsiteSnap = (
  <div className="h-full w-full flex flex-col">
    <div className="flex items-center justify-between px-3 py-2 border-b-2 border-gray-100">
      <div className="flex items-center gap-1 text-[9px] font-black"><span className="text-[#0b1120]">Gen-Z</span><span className="text-red-500">IITian</span></div>
      <div className="flex gap-2"><Bar w="22px" /><Bar w="22px" /><Bar w="22px" /></div>
    </div>
    <div className="flex-1 bg-[#0b1120] p-3 flex flex-col justify-center gap-1.5">
      <div className="h-2.5 w-1/2 rounded bg-gradient-to-r from-red-500 to-orange-400" />
      <Bar w="70%" c="bg-white/25" /><Bar w="40%" c="bg-white/15" />
    </div>
  </div>
);

const DashboardSnap = (
  <div className="h-full w-full flex">
    <div className="w-1/4 bg-[#0b1120] p-2 flex flex-col gap-2">
      <div className="h-5 w-5 rounded-md bg-blue-500" />
      {[0, 1, 2, 3].map(i => <Bar key={i} w="100%" c={i === 0 ? 'bg-white/40' : 'bg-white/15'} />)}
    </div>
    <div className="flex-1 p-3 space-y-2 bg-white">
      <div className="aspect-video rounded-lg bg-gradient-to-br from-[#11182b] to-[#1e293b]" />
      <Bar w="60%" c="bg-gray-300" />
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full w-3/4 bg-[#10b981]" /></div>
    </div>
  </div>
);

const ExamSnap = (
  <div className="h-full w-full bg-white p-3 flex flex-col gap-2">
    <div className="flex items-center justify-between"><Bar w="40%" c="bg-gray-300" /><div className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[8px] font-black text-red-500">14:59</div></div>
    {[true, false, false].map((sel, i) => (
      <div key={i} className={`flex items-center gap-2 rounded-lg border-2 p-1.5 ${sel ? 'border-[#10b981] bg-green-50' : 'border-gray-100'}`}>
        <div className={`w-4 h-4 rounded-full border-2 ${sel ? 'border-[#10b981] bg-[#10b981]' : 'border-gray-300'}`} /><Bar w={`${60 - i * 8}%`} />
      </div>
    ))}
  </div>
);

const SocialSnap = (
  <div className="h-full w-full bg-white p-3 grid grid-cols-2 gap-2">
    {[{ Icon: Youtube, c: 'bg-red-500' }, { Icon: Instagram, c: 'bg-pink-500' }, { Icon: Linkedin, c: 'bg-blue-600' }, { Icon: MessageCircle, c: 'bg-green-500' }].map(({ Icon, c }, i) => (
      <div key={i} className="rounded-xl border-2 border-[#0b1120]/10 p-2 flex items-center justify-center"><div className={`w-7 h-7 rounded-lg ${c} flex items-center justify-center text-white`}><Icon className="w-4 h-4" /></div></div>
    ))}
  </div>
);

const AppSnap = (
  <div className="h-full w-full bg-[#f1f3f7] pt-4 px-2 pb-2 flex flex-col gap-1.5 text-[8px]">
    <div className="flex items-center gap-1.5 bg-white rounded-lg p-1.5"><div className="w-5 h-5 rounded-full bg-blue-100" /><Bar w="40px" c="bg-gray-300" /></div>
    <div className="rounded-lg bg-gradient-to-br from-[#0b1120] to-[#11331f] p-2 text-white"><div className="text-[7px] font-black text-[#9bf6c4]">MAY 2026 TERM</div><div className="text-[9px] font-black">Ace Your Exam</div></div>
    <div className="rounded-lg bg-white p-2 text-center text-gray-300 text-[7px] font-bold">No upcoming sessions</div>
  </div>
);

const E = '/Image/ecosystem';

/* ----------------------------------------------------------------------------
   Products
---------------------------------------------------------------------------- */

type Cta = { label: string; to?: string; href?: string; download?: boolean };
type Product = {
  key: string; Icon: typeof Globe; tint: string; glyph: string; tag: string;
  name: string; desc: string; points: string[]; cta: Cta; media: ReactNode;
};

const PRODUCTS: Product[] = [
  {
    key: 'website', Icon: Globe, tint: '#E7EEFF', glyph: '#2563EB', tag: 'The Front Door',
    name: 'Website', desc: 'genziitian.in — discover courses, free PYQs & notes, blogs and enroll in seconds. Fully responsive on desktop and mobile.',
    points: ['Curated IIT-level courses', 'Free resources & graded assignments', 'Secure Razorpay checkout'],
    cta: { label: 'Visit Website', href: 'https://genziitian.in' },
    media: (
      <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="flex-1 w-full max-w-md"><BrowserMock url="genziitian.in"><Shot src={`${E}/website-desktop.png`} alt="Gen-Z IITian website" fallback={WebsiteSnap} /></BrowserMock></div>
        <PhoneMock w={150}><Shot src={`${E}/website-mobile.png`} alt="Gen-Z IITian mobile site" fallback={WebsiteSnap} /></PhoneMock>
      </div>
    ),
  },
  {
    key: 'dashboard', Icon: LayoutDashboard, tint: '#E4F7EE', glyph: '#0E9E6A', tag: 'Learn',
    name: 'Class Dashboard', desc: 'class.genziitian.in — your student portal with live & recorded lectures, courses, live sessions, calendar and free resources.',
    points: ['Live + recorded lectures', 'Sessions, calendar & store', 'Track courses and progress'],
    cta: { label: 'Open Dashboard', href: 'https://class.genziitian.in' },
    media: <BrowserMock url="class.genziitian.in"><Shot src={`${E}/dashboard.png`} alt="Class dashboard" fallback={DashboardSnap} /></BrowserMock>,
  },
  {
    key: 'exam', Icon: ClipboardCheck, tint: '#FEF1DF', glyph: '#FF7A00', tag: 'Practice',
    name: 'Exam Platform — LAB', desc: 'lab.genziitian.in — gamified practice & exams. Earn XP, build streaks, climb the leaderboard and crush your weak spots.',
    points: ['Timed, exam-pattern mocks & quizzes', 'XP, streaks & leaderboard', 'Weak-spot review and analytics'],
    cta: { label: 'Open LAB', href: 'https://lab.genziitian.in' },
    media: <BrowserMock url="lab.genziitian.in"><Shot src={`${E}/exam.png`} alt="LAB exam platform" fallback={ExamSnap} /></BrowserMock>,
  },
  {
    key: 'social', Icon: Share2, tint: '#FBE3EE', glyph: '#EC1E79', tag: 'Community',
    name: 'Social Platform', desc: 'genziitian.live — plus a 15.4K+ community across YouTube, Instagram, LinkedIn and WhatsApp. Free content and a support system that never sleeps.',
    points: ['15.4K+ YouTube subscribers', 'Daily tips & reels', 'Active WhatsApp community'],
    cta: { label: 'Explore genziitian.live', href: 'https://genziitian.live' },
    media: <BrowserMock url="genziitian.live"><Shot src={`${E}/social.png`} alt="Social platform" fallback={SocialSnap} /></BrowserMock>,
  },
  {
    key: 'app', Icon: Smartphone, tint: '#F3E8FF', glyph: '#7C3AED', tag: 'On the go',
    name: 'Mobile App', desc: 'Learn anywhere. Daily 15-minute sessions, live class reminders, lecture pickup and instant support — right in your pocket.',
    points: ['Daily bite-size sessions', 'Live class reminders', 'Resume where you left off'],
    cta: { label: 'Download App (APK)', href: 'https://zedmvgqhnapmpqpnzoqh.supabase.co/storage/v1/object/public/downloads/class%20genz.apk', download: true },
    media: <div className="flex justify-center"><PhoneMock w={210}><Shot src={`${E}/app.png`} alt="Gen-Z IITian mobile app" fallback={AppSnap} /></PhoneMock></div>,
  },
];

function CtaButton({ cta }: { cta: Cta }) {
  const cls = 'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm border-[3px] border-[#0b1120] bg-[#10b981] text-[#0b1120] shadow-[4px_4px_0px_#0b1120] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#0b1120] transition-all';
  const icon = cta.download ? <Download className="w-4 h-4" /> : cta.href ? <ArrowUpRight className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />;
  if (cta.href) return <a href={cta.href} target="_blank" rel="noopener noreferrer" {...(cta.download ? { download: '' } : {})} className={cls}>{cta.label} {icon}</a>;
  return <Link to={cta.to!} className={cls}>{cta.label} {icon}</Link>;
}

export default function Ecosystem() {
  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100 overflow-hidden">
      {/* Hero */}
      <section className="relative px-5 sm:px-6 pt-14 pb-14 md:pt-20 md:pb-20 max-w-6xl mx-auto text-center">
        <div className="absolute top-10 left-[6%] w-14 h-14 bg-yellow-200 rounded-full border-[3px] border-[#0b1120] shadow-[4px_4px_0px_#0b1120] opacity-50 hidden md:block" />
        <div className="absolute bottom-6 right-[8%] w-16 h-16 bg-blue-200 rounded-2xl border-[3px] border-[#0b1120] shadow-[5px_5px_0px_#0b1120] opacity-50 rotate-12 hidden md:block" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#f3e8ff] text-[#7c3aed] border-2 border-[#7c3aed] rounded-full font-black text-xs sm:text-sm mb-5 shadow-[3px_3px_0px_#7c3aed]">
          ✨ The Gen-Z IITian Ecosystem
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-5">
          One ecosystem.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Everything</span>{' '}
          you need to crack IITM BS.
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed">
          Website, class dashboard, exam platform, mobile app and a 14K+ community — every Gen-Z IITian product, built to work together.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {PRODUCTS.map(p => (
            <a key={p.key} href={`#${p.key}`} className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border-2 border-[#0b1120] rounded-full text-xs font-black shadow-[2px_2px_0px_#0b1120] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#0b1120] transition-all">
              <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: p.tint, color: p.glyph }}><p.Icon className="w-3 h-3" /></span>
              {p.name}
            </a>
          ))}
        </div>
      </section>

      {/* Product showcase */}
      <div className="bg-[#f8fafc] border-y-[3px] border-[#0b1120]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 md:py-20 space-y-16 md:space-y-28">
          {PRODUCTS.map((p, i) => (
            <motion.section
              id={p.key}
              key={p.key}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className={`flex flex-col-reverse ${i % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 md:gap-12 items-center scroll-mt-24`}
            >
              {/* Copy */}
              <div className="flex-1 w-full">
                <div className="inline-flex items-center gap-2.5 mb-4">
                  <span className="w-11 h-11 rounded-xl border-[2.5px] border-[#0b1120] flex items-center justify-center shadow-[3px_3px_0px_#0b1120]" style={{ background: p.tint, color: p.glyph }}>
                    <p.Icon className="w-5 h-5" strokeWidth={2.2} />
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white border-2 border-[#0b1120] text-[10px] font-black uppercase tracking-widest">{p.tag}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight mb-3">{p.name}</h2>
                <p className="text-gray-500 font-medium text-base sm:text-lg leading-relaxed mb-5 max-w-xl">{p.desc}</p>
                <ul className="space-y-2.5 mb-7">
                  {p.points.map(pt => (
                    <li key={pt} className="flex items-start gap-2.5">
                      <span className="mt-0.5 w-5 h-5 rounded-md bg-[#10b981] border-2 border-[#0b1120] flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" strokeWidth={4} /></span>
                      <span className="font-bold text-[#0b1120] text-sm sm:text-base">{pt}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton cta={p.cta} />
              </div>

              {/* Snapshot (shown first on mobile via flex-col-reverse) */}
              <div className="flex-1 w-full flex justify-center">{p.media}</div>
            </motion.section>
          ))}
        </div>
      </div>

      {/* Closing CTA */}
      <section className="px-5 sm:px-6 py-16 md:py-24 max-w-5xl mx-auto">
        <div className="relative bg-[#0b1120] border-[4px] border-[#0b1120] rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-14 text-center shadow-[10px_10px_0px_#10b981] overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">Ready to join the ecosystem?</h2>
            <p className="text-gray-300 font-medium text-base md:text-lg max-w-xl mx-auto mb-8">Start with a course and unlock the dashboard, exam platform and community in one place.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/explore/courses" className="inline-flex items-center gap-2 px-8 py-4 bg-[#10b981] text-[#0b1120] rounded-xl font-black text-base border-[3px] border-[#0b1120] shadow-[5px_5px_0px_#fff] hover:-translate-y-1 hover:shadow-[8px_8px_0px_#fff] transition-all">
                Explore Courses <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="https://class.genziitian.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#0b1120] rounded-xl font-black text-base border-[3px] border-[#0b1120] hover:-translate-y-1 transition-all">
                Open Dashboard <ArrowUpRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
