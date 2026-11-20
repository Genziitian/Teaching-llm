'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from '@/landing/shims/router';
import { animate, motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowRight, Briefcase, Camera, Clock, Play, Sparkles, Users, GraduationCap } from 'lucide-react';

/* Apple-style spring: critically damped, no overshoot. */
const SPRING = { type: 'spring' as const, bounce: 0, duration: 0.7 };

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => c.stop();
  }, [inView, to, reduce]);
  return <span ref={ref}>{value}{suffix}</span>;
}

const SOCIAL = 'w-10 h-10 rounded-full bg-white/70 backdrop-blur border border-black/10 flex items-center justify-center text-[#1d1d1f] hover:bg-white hover:scale-110 active:scale-95 transition-all duration-200';

export default function About() {
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] selection:bg-blue-100 overflow-x-hidden">
      {/* Hero */}
      <section className="relative px-6 pt-28 pb-20 md:pt-36 md:pb-28 text-center">
        <div className="relative max-w-3xl mx-auto">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-black/10 text-xs font-semibold text-gray-600 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" /> About Gen-Z IITian
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.03] tracking-[-0.03em]">
              Quality education,<br />
              <span className="text-blue-600">for everyone.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-6 text-lg md:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
              We are on a mission to democratize quality education and empower students to achieve their dreams.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Story */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] mb-5">Our Story</h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              Gen-Z IITian was founded with a simple yet powerful vision: to make high-quality, IIT-level education accessible to everyone, regardless of their background or location.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed">
              We recognized the challenges faced by online and hybrid degree students—lack of structured resources, limited mentorship, and isolation. Our platform bridges this gap by providing comprehensive courses, expert guidance, and a thriving community.
            </p>
          </Reveal>
          <div className="grid grid-cols-2 gap-4">
            {[
              { n: 10, s: 'K+', l: 'Students Empowered', Icon: Users, tint: 'from-blue-50 to-indigo-50', c: 'text-blue-600' },
              { n: 50, s: '+', l: 'Expert Instructors', Icon: GraduationCap, tint: 'from-orange-50 to-rose-50', c: 'text-orange-600' },
            ].map((st, i) => (
              <Reveal key={st.l} delay={0.08 * i}>
                <motion.div
                  whileHover={reduce ? undefined : { y: -6, scale: 1.02 }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  className={`rounded-3xl p-6 bg-gradient-to-br ${st.tint} border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.05)]`}
                >
                  <st.Icon className={`w-6 h-6 mb-6 ${st.c}`} />
                  <div className="text-4xl md:text-5xl font-bold tracking-[-0.03em]"><CountUp to={st.n} suffix={st.s} /></div>
                  <div className="mt-1 text-sm font-medium text-gray-500">{st.l}</div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Founders */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-sm font-semibold text-blue-600 mb-2">The people behind it</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-[-0.025em]">Meet the Founders</h2>
          </Reveal>

          <div className="grid lg:grid-cols-5 gap-5">
            {/* Founder */}
            <Reveal className="lg:col-span-3">
              <div className="h-full rounded-[2rem] bg-white border border-black/5 shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden grid sm:grid-cols-5">
                <div className="sm:col-span-2 relative min-h-[260px] overflow-hidden group">
                  <img
                    src="https://picsum.photos/seed/sriram/600/800"
                    alt="Sriram, Founder"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="sm:col-span-3 p-7 flex flex-col">
                  <span className="self-start px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Founder</span>
                  <h3 className="mt-3 text-3xl font-bold tracking-[-0.02em]">Sriram</h3>
                  <p className="mt-3 text-[15px] italic text-gray-700">"Education is not just about learning facts, but training the mind to think."</p>
                  <div className="mt-4 space-y-3 text-[15px] text-gray-500 leading-relaxed">
                    <p>Sriram is a passionate educator and visionary dedicated to transforming the landscape of online learning. With a deep understanding of the IIT Madras curriculum and the unique challenges of hybrid education, he founded Gen-Z IITian to provide students with the high-quality resources they deserve.</p>
                    <p>His mission is to create an ecosystem where every student, regardless of their starting point, has the tools and support to excel. Under his leadership, Gen-Z IITian has grown into a community of thousands of dedicated learners.</p>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <a aria-label="LinkedIn" href="https://www.linkedin.com/in/hustlewithsriram/" target="_blank" rel="noopener noreferrer" className={SOCIAL}><Briefcase className="w-4 h-4" /></a>
                    <a aria-label="Instagram" href="https://www.instagram.com/curious_sri/" target="_blank" rel="noopener noreferrer" className={SOCIAL}><Camera className="w-4 h-4" /></a>
                    <a aria-label="YouTube" href="https://www.youtube.com/@SriRam_in" target="_blank" rel="noopener noreferrer" className={SOCIAL}><Play className="w-4 h-4" /></a>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Co-founder */}
            <Reveal className="lg:col-span-2" delay={0.1}>
              <div className="h-full rounded-[2rem] bg-gradient-to-br from-[#0b1120] to-[#1e2a4a] text-white p-7 flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
                <motion.div
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-3xl font-bold"
                  animate={reduce ? undefined : { y: [0, -4, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  T
                </motion.div>
                <span className="mt-6 self-start px-3 py-1 rounded-full bg-white/10 text-xs font-semibold">Co-Founder</span>
                <h3 className="mt-3 text-3xl font-bold tracking-[-0.02em]">Tushar</h3>
                <p className="text-sm text-gray-400 mt-1">aka Laxmikant</p>
                <p className="mt-5 text-[15px] text-gray-300 leading-relaxed">
                  Helping build Gen-Z IITian from the ground up, from the platform to the community.
                </p>
                <p className="mt-auto pt-6 text-xs text-gray-500">Full profile coming soon.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Instructors */}
      <section className="px-6 pb-24">
        <Reveal>
          <div className="max-w-5xl mx-auto rounded-[2rem] bg-white border border-black/5 shadow-[0_8px_40px_rgba(0,0,0,0.05)] px-6 py-14 text-center relative overflow-hidden">
            <div className="flex justify-center -space-x-3 mb-6" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-12 h-12 rounded-full border-4 border-white bg-gradient-to-br from-gray-100 to-gray-200"
                  animate={reduce ? undefined : { y: [0, -5, 0] }}
                  transition={{ duration: 3, delay: i * 0.25, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold mb-4">
              <Clock className="w-3.5 h-3.5" /> Coming soon
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.025em]">Know Your Instructors</h2>
            <p className="mt-3 text-gray-500 max-w-md mx-auto">We are putting together profiles of the mentors who teach you. Stay tuned.</p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="px-6 pb-28">
        <Reveal>
          <div className="max-w-5xl mx-auto rounded-[2rem] bg-[#0b1120] text-white text-center px-6 py-16 md:py-20 relative overflow-hidden">
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold tracking-[-0.025em]">Join the Revolution</h2>
              <p className="mt-4 text-gray-300 max-w-2xl mx-auto leading-relaxed">
                Whether you're looking to master a new skill, prepare for an exam, or advance your career, we have the resources and community to support you every step of the way.
              </p>
              <motion.div className="mt-8 inline-block" whileHover={reduce ? undefined : { scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}>
                <Link to="/explore/courses" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0b1120] font-semibold">
                  Get Started Today <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
