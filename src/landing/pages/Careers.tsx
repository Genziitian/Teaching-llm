'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@/landing/shims/router';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  Laptop,
  MapPin,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/landing/context/AuthContext';

/* ---------------------------------------------------------------------------
 * Careers — editorial / professional layout.
 * Uses the site font and colours: light
 * background, hairline rules, serif display type, one restrained accent.
 * Apply flow (login gate, pending-role resume, /careers/apply/:role) unchanged.
 * ------------------------------------------------------------------------- */

type RoleId = 'tutor' | 'campus-leader';

const C = {
  paper: '#fbfbfd',
  card: '#ffffff',
  ink: '#0b1120',
  muted: '#5b6472',
  faint: '#8a919c',
  rule: '#e5e7eb',
  accent: '#2563eb',
  accentSoft: '#eff6ff',
  good: '#166534',
};

const testimonials = [
  {
    name: 'Vaibhav',
    role: 'Maths 1 Tutor',
    quote:
      'Working here helped me master my own college subjects. Teaching others the same syllabus I studied gave me a unique edge in my career interviews.',
  },
  {
    name: 'Ayush',
    role: 'Computational Thinking Tutor',
    quote:
      'The flexible hours let me balance my own studies while earning a good stipend. The students are eager to learn, which makes the work very rewarding.',
  },
  {
    name: 'Ankit K.',
    role: 'Machine Learning Tutor',
    quote:
      'It is an amazing platform for peer-to-peer learning. Preparing course material strengthened my ML foundations more than regular coursework could.',
  },
];

const steps = [
  { title: 'Apply', body: 'Complete the role-specific application. Sign-in is required so you can follow its progress.' },
  { title: 'Review', body: 'Our team reads every application and may reach out for clarifications.' },
  { title: 'Shortlist', body: 'Shortlisted candidates are contacted directly by the team for the next round.' },
  { title: 'Decision', body: 'The outcome appears in your application tracker as soon as it is recorded.' },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.accent }}>
      {children}
    </p>
  );
}

function SectionTitle({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="careers-serif mt-3 text-3xl sm:text-[2.35rem] leading-[1.15] font-medium" style={{ color: C.ink }}>
        {title}
      </h2>
      {lead && (
        <p className="mt-4 text-[15px] leading-relaxed" style={{ color: C.muted }}>
          {lead}
        </p>
      )}
    </div>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: C.ink }}>
          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full" style={{ background: C.faint }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Perks({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: C.ink }}>
          <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: C.good }} strokeWidth={2.5} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function H4({ children }: { children: ReactNode }) {
  return (
    <h4 className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] first:mt-0" style={{ color: C.faint }}>
      {children}
    </h4>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3.5" style={{ borderTop: `1px solid ${C.rule}` }}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.faint }} />
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.faint }}>
          {label}
        </div>
        <div className="mt-0.5 text-sm font-medium" style={{ color: C.ink }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function Careers() {
  const { user, openLoginModal } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState<RoleId | null>(null);

  // Resume an apply intent that started before sign-in
  useEffect(() => {
    if (!user) return;
    try {
      const pending = localStorage.getItem('gzi_pending_apply_role');
      if (pending === 'tutor' || pending === 'campus-leader') {
        localStorage.removeItem('gzi_pending_apply_role');
        navigate(`/careers/apply/${pending}`);
      }
    } catch {
      /* storage unavailable */
    }
  }, [user, navigate]);

  const handleApply = (role: RoleId) => {
    if (!user) {
      try {
        localStorage.setItem('gzi_pending_apply_role', role);
      } catch {
        /* storage unavailable */
      }
      openLoginModal();
      return;
    }
    navigate(`/careers/apply/${role}`);
  };

  const focusRole = (role: RoleId) => {
    setOpen(role);
    requestAnimationFrame(() => {
      document.getElementById(`role-${role}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const roles: {
    id: RoleId;
    title: string;
    summary: string;
    tags: string[];
    comp: string;
  }[] = [
    {
      id: 'tutor',
      title: 'Subject Tutor (Faculty)',
      summary: 'Teach foundation and diploma-level subjects to fellow students in Hindi, English or both.',
      tags: ['Part-time', 'Paid', 'Remote'],
      comp: '₹5,000 – ₹10,000 / month',
    },
    {
      id: 'campus-leader',
      title: 'Campus Leader',
      summary: 'Partner with us as the owner of an IIT Madras BS student community and grow it with real support.',
      tags: ['Part-time', 'Performance-based', 'Remote'],
      comp: 'Up to ₹5,000 / month',
    },
  ];

  return (
    <div className="careers-ui" style={{ background: C.paper, color: C.ink }}>
      {/* ───────────── Hero ───────────── */}
      <section style={{ borderBottom: `1px solid #d6e4ff`, background: '#e8f0ff' }}>
        <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <Eyebrow>Careers at GenZ IITian</Eyebrow>
            <h1
              className="careers-serif mt-5 text-[2.6rem] leading-[1.06] font-medium sm:text-6xl"
              style={{ color: C.ink }}
            >
              Teach what you've mastered.
              <br />
              <span style={{ color: C.accent }}>Build what's next.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed sm:text-[17px]" style={{ color: C.muted }}>
              We're a student-built learning platform for the IIT Madras BS community. Join as a tutor or campus
              leader — work remotely, on your own schedule, and graduate with experience that stands out.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#openings"
                className="inline-flex items-center justify-center gap-2 rounded-md px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: C.accent }}
              >
                View open roles <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/careers/track"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-[#f3f1ea]"
                style={{ border: `1px solid ${C.rule}`, color: C.ink }}
              >
                <ClipboardList className="h-4 w-4" /> Track my application
              </Link>
            </div>
          </div>

          {/* Roles summary */}
          <aside className="rounded-lg bg-white" style={{ border: `1px solid ${C.rule}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.rule}` }}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.faint }}>
                Now hiring
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.good }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#22c55e' }} /> {roles.length} open roles
              </span>
            </div>
            {roles.map((r, i) => (
              <button
                key={r.id}
                onClick={() => focusRole(r.id)}
                className="group flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[#faf9f6]"
                style={i > 0 ? { borderTop: `1px solid ${C.rule}` } : undefined}
              >
                <div>
                  <div className="text-[15px] font-semibold" style={{ color: C.ink }}>
                    {r.title}
                  </div>
                  <div className="mt-1 text-[13px]" style={{ color: C.muted }}>
                    {r.comp} · Remote
                  </div>
                </div>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  style={{ color: C.faint }}
                />
              </button>
            ))}
          </aside>
        </div>
      </section>

      {/* ───────────── Open roles ───────────── */}
      <section id="openings" className="scroll-mt-24" style={{ background: '#ffffff' }}>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <SectionTitle
            eyebrow="Open roles"
            title="Find where you fit"
            lead="Both roles are remote and flexible. Open a role to read the full brief before you apply."
          />

          <div className="mt-10 overflow-hidden rounded-lg bg-white" style={{ border: `1px solid ${C.rule}` }}>
            {roles.map((r, i) => {
              const isOpen = open === r.id;
              return (
                <div
                  key={r.id}
                  id={`role-${r.id}`}
                  className="scroll-mt-24"
                  style={i > 0 ? { borderTop: `1px solid ${C.rule}` } : undefined}
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : r.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start justify-between gap-4 px-5 py-6 text-left transition-colors hover:bg-[#fcfbf8] sm:px-8 sm:py-7"
                  >
                    <div className="min-w-0">
                      <h3 className="careers-serif text-2xl font-medium sm:text-[1.75rem]" style={{ color: C.ink }}>
                        {r.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed" style={{ color: C.muted }}>
                        {r.summary}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]" style={{ color: C.muted }}>
                        {r.tags.map(t => (
                          <span key={t} className="inline-flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full" style={{ background: C.faint }} />
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronDown
                      className={`mt-2 h-5 w-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      style={{ color: C.faint }}
                    />
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${C.rule}`, background: '#f5f8ff' }}>
                      <div className="grid gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1fr_300px]">
                        <div className="max-w-2xl">
                          {r.id === 'tutor' ? <TutorBrief /> : <LeaderBrief />}
                        </div>

                        <div className="lg:sticky lg:top-24 lg:self-start">
                          <div className="rounded-lg bg-white p-5" style={{ border: `1px solid ${C.rule}` }}>
                            <div className="pb-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.faint }}>
                              At a glance
                            </div>
                            <Fact icon={Clock} label="Commitment" value="Part-time, flexible hours" />
                            <Fact icon={MapPin} label="Location" value="Remote" />
                            <Fact icon={Wallet} label="Compensation" value={r.comp} />
                            {r.id === 'tutor' && <Fact icon={Laptop} label="Setup" value="Laptop, pen tablet, mic, stable internet" />}
                            <button
                              onClick={() => handleApply(r.id)}
                              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md px-5 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                              style={{ background: C.accent }}
                            >
                              Apply for this role <ArrowRight className="h-4 w-4" />
                            </button>
                            <Link
                              to="/careers/track"
                              className="mt-3 block text-center text-[13px] font-medium underline-offset-4 hover:underline"
                              style={{ color: C.muted }}
                            >
                              Already applied? Track your application
                            </Link>
                            {r.id === 'campus-leader' && (
                              <a
                                href="https://forms.gle/bQL5p6Bb9zX3pk2n8"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 block text-center text-[13px] underline-offset-4 hover:underline"
                                style={{ color: C.faint }}
                              >
                                Prefer a form? Open Google Form
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────── Why us ───────────── */}
      <section style={{ borderTop: `1px solid #fde4c8`, borderBottom: `1px solid #fde4c8`, background: '#fff4e6' }}>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <SectionTitle eyebrow="Why GenZ IITian" title="Work that compounds for your career" />
          <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-0">
            <div className="md:pr-12">
              <div className="careers-serif text-5xl font-medium" style={{ color: '#fdba74' }}>01</div>
              <h3 className="mt-4 text-lg font-semibold" style={{ color: C.ink }}>A culture where ideas matter</h3>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: C.muted }}>
                Flexible working hours, creative freedom in how you teach, and a peer-driven environment that pushes
                you to do your best work.
              </p>
            </div>
            <div className="md:pl-12 md:border-l" style={{ borderColor: C.rule }}>
              <div className="careers-serif text-5xl font-medium" style={{ color: '#fdba74' }}>02</div>
              <h3 className="mt-4 text-lg font-semibold" style={{ color: C.ink }}>Internships that bridge theory and practice</h3>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: C.muted }}>
                Teaching solidifies your own foundations while building a professional network and adding real weight
                to your résumé.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Process ───────────── */}
      <section style={{ background: '#e9f9ef' }}>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <SectionTitle eyebrow="How it works" title="A clear, trackable hiring process" />
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="relative lg:px-6 lg:first:pl-0 lg:last:pr-0"
                style={i > 0 ? { borderLeft: undefined } : undefined}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: C.accentSoft, color: C.accent }}
                  >
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span className="hidden h-px flex-1 lg:block" style={{ background: C.rule }} />
                  )}
                </div>
                <h3 className="mt-4 text-base font-semibold" style={{ color: C.ink }}>{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── Voices ───────────── */}
      <section style={{ borderTop: `1px solid #ead9ff`, background: '#f4ecff' }}>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <SectionTitle eyebrow="Tutor voices" title="What our tutors say" />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map(t => (
              <figure key={t.name} className="flex flex-col justify-between rounded-lg p-6" style={{ border: `1px solid #ead9ff`, background: '#ffffff' }}>
                <blockquote className="careers-serif text-[1.15rem] leading-[1.55]" style={{ color: C.ink }}>
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                    style={{ background: C.accentSoft, color: C.accent }}
                  >
                    {t.name[0]}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: C.ink }}>{t.name}</span>
                    <span className="block text-xs" style={{ color: C.muted }}>{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Track + Recruiters ───────────── */}
      <section style={{ borderTop: `1px solid #d6e4ff`, background: '#e8f0ff' }}>
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-lg p-8" style={{ background: C.ink, color: '#fff' }}>
            <div>
              <ClipboardList className="h-6 w-6" style={{ color: '#9fb2f2' }} />
              <h3 className="careers-serif mt-5 text-2xl font-medium">Already applied?</h3>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: '#b9c0cc' }}>
                Follow your application's status and add extra notes, links or subjects to strengthen it.
              </p>
            </div>
            <Link
              to="/careers/track"
              className="mt-8 inline-flex w-fit items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ color: C.ink }}
            >
              Track my application <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col justify-between rounded-lg bg-white p-8" style={{ border: `1px solid ${C.rule}` }}>
            <div>
              <Eyebrow>For recruiters</Eyebrow>
              <h3 className="careers-serif mt-4 text-2xl font-medium" style={{ color: C.ink }}>Verify a candidate</h3>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: C.muted }}>
                Validate career histories, contract durations and department roles against our secure ledger of
                authenticated digital records.
              </p>
            </div>
            <Link
              to="/verify"
              className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: C.accent }}
            >
              Open recruiter portal <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ───────────── Role briefs ───────────── */

function TutorBrief() {
  return (
    <div>
      <p className="text-base leading-relaxed" style={{ color: C.ink }}>
        Are you passionate about educating peers and simplifying tough subjects? We're looking for dedicated Subject
        Tutors to guide students towards academic excellence. Share your knowledge, earn while you learn, and build a
        stellar profile.
      </p>

      <H4>Roles &amp; responsibilities</H4>
      <Bullets
        items={[
          <>Deliver high-quality lessons in <strong>Hindi, English, or comfortably blended (both)</strong>.</>,
          'Teach foundational or diploma-level subjects aligned with the curriculum.',
          'Solve student doubts and create engaging academic content.',
        ]}
      />

      <H4>What we need from you</H4>
      <Bullets
        items={[
          <><strong>Tech-ready:</strong> a digital pen tablet / graphic pad, a laptop, a good microphone and stable internet are mandatory.</>,
          <><strong>Academic excellence:</strong> a CGPA of 7.5+ in the subject you wish to teach is highly preferred.</>,
          <><strong>Background:</strong> being an IIT Madras BS student is a bonus, but completely optional.</>,
          'Unwavering passion for teaching.',
        ]}
      />

      <H4>Perks &amp; compensation</H4>
      <Perks
        items={[
          <><strong>Stipend:</strong> ₹5,000 to ₹10,000 per month, based on interview and merit.</>,
          <><strong>Experience:</strong> add a highly valued teaching internship to your CV.</>,
          <><strong>Visibility:</strong> open doors to future career prospects.</>,
        ]}
      />

      <p className="mt-8 text-sm" style={{ color: C.muted }}>
        Want to see how we teach?{' '}
        <a
          href="https://www.youtube.com/@Gen-ZIITian/videos"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-4"
          style={{ color: C.accent }}
        >
          Watch our videos on YouTube
        </a>
        .
      </p>
    </div>
  );
}

function LeaderBrief() {
  return (
    <div>
      <p className="text-base leading-relaxed" style={{ color: C.ink }}>
        Do you own or manage an <strong>IIT Madras BS Degree</strong> WhatsApp, Telegram, Discord or other student
        community? If yes, we'd love to work with you.
      </p>
      <p className="mt-4 text-[15px] leading-relaxed" style={{ color: C.muted }}>
        At GenZ IITian we're building a unified ecosystem for IIT Madras BS students through high-quality resources,
        mentorship and community-driven initiatives. Instead of communities working in isolation, we believe they can
        grow together while continuing to serve students independently. So far we've launched:
      </p>
      <Bullets
        items={[
          <><strong>exam.genziitian.in</strong> — previous-year questions, video solutions, PDFs and exam resources.</>,
          <><strong>genziitian.in/resources</strong> — completely free study materials.</>,
          <><strong>Free YouTube marathon classes</strong> before exams.</>,
          <><strong>genziitian.live</strong> — a dedicated social platform for IIT Madras BS students with better privacy and organised discussions.</>,
        ]}
      />

      <H4>Who can apply</H4>
      <Bullets
        items={[
          <>You must be the <strong>owner or primary administrator</strong> of an IIT Madras BS student community.</>,
          'Your community should actively serve IIT Madras BS Degree students.',
          'You should be interested in a long-term partnership with GenZ IITian.',
        ]}
      />

      <H4>What you'll get</H4>
      <Perks
        items={[
          <>Official <strong>GenZ IITian Campus Leader</strong> recognition.</>,
          'Your own referral code with earning opportunities.',
          <>Students using your code receive <strong>5% off</strong> on courses.</>,
          'Rewards on every successful referral.',
          <>A free onboarding course worth approximately <strong>₹500</strong>.</>,
          <>Performance-based stipends of <strong>up to ₹5,000 per month</strong>.</>,
          <>Priority consideration for future <strong>paid internships, part-time roles and leadership opportunities</strong>.</>,
          'Direct access to our core team and upcoming projects.',
        ]}
      />
    </div>
  );
}
