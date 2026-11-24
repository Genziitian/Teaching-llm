'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown, HelpCircle, ShieldCheck, Tag, Clock, User, Monitor, Info, Mail, Phone, MessageCircle, Instagram, Linkedin, Youtube, Users, Sparkles, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

const FAQ_DATA = [
  {
    question: "Who We Are",
    answer: "GENZ IITIAN is a growing YouTube channel with 13K+ subscribers and a strong community of students from the IIT Madras BS degree program. We focus on helping foundation-qualified students by providing structured guidance, quality courses, and support tailored specifically for this degree.",
    icon: <Info className="w-6 h-6" />
  },
  {
    question: "Who is the teacher?",
    answer: "Our courses are taught by your seniors from the IIT Madras BS degree who have successfully progressed through the program. They understand the curriculum, challenges, and exam patterns deeply, and provide high-quality teaching along with digital notes and all necessary resources to help you succeed.",
    icon: <User className="w-6 h-6" />
  },
  {
    question: "Where we take our lectures?",
    answer: "All lectures are conducted on our Learning Management System (LMS). Students get access to a personalized dashboard where they can attend classes and access recorded lectures anytime for flexible learning.",
    icon: <Monitor className="w-6 h-6" />
  },
  {
    question: "What is the refund policy?",
    answer: "We do not offer refunds. Since we provide extensive resources and value in our courses, we recommend purchasing only when you are fully sure. For more details, please refer to our Refund & Policy page.",
    icon: <ShieldCheck className="w-6 h-6" />
  },
  {
    question: "When do the courses expire?",
    answer: "Our courses are valid until the END TERM. Typically, this means around 3 months of access if you join at the start of the term, or until the term's final examination is completed.",
    icon: <Clock className="w-6 h-6" />
  },
  {
    question: "Are there any discount rules?",
    answer: "Yes. You can apply only one discount at a time. We offer bundle discounts when purchasing multiple courses, and referral discounts when purchasing individual subjects.",
    icon: <Tag className="w-6 h-6" />
  },
  {
    question: "How can I contact support?",
    answer: "You can reach us through multiple channels: email us at admin@genziitian.org, call or message us directly on WhatsApp at +91 72549 26179 for quick assistance.",
    icon: <HelpCircle className="w-6 h-6" />
  }
];

const PHONE_DISPLAY = '+91 72549 26179';
const PHONE_TEL = '+917254926179';
const WA_DIRECT = 'https://wa.me/917254926179';
const EMAIL = 'admin@genziitian.org';

function FAQItem({ question, answer, icon, isOpen, onClick }: {
  question: string;
  answer: string;
  icon: ReactNode;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${isOpen ? 'bg-white border-emerald-200 shadow-[0_8px_30px_rgba(16,185,129,0.12)]' : 'bg-white border-black/5 hover:border-black/10 hover:shadow-sm'}`}>
      <button onClick={onClick} className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 cursor-pointer">
        <div className="flex items-center gap-3.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-300 [&>svg]:w-4.5 [&>svg]:h-4.5 ${isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {icon}
          </div>
          <span className="text-base font-semibold text-[#0b1120]">{question}</span>
        </div>
        <ChevronDown className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          >
            <p className="px-5 pb-5 pl-[4.1rem] text-[15px] text-gray-500 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.65, delay }}
    >
      {children}
    </motion.div>
  );
}

const CHANNELS = [
  { title: 'Call us', value: PHONE_DISPLAY, href: `tel:${PHONE_TEL}`, Icon: Phone, grad: 'from-orange-50 to-amber-50', chip: 'bg-orange-500', external: false },
  { title: 'Email us', value: EMAIL, href: `mailto:${EMAIL}`, Icon: Mail, grad: 'from-blue-50 to-indigo-50', chip: 'bg-blue-600', external: false },
  { title: 'WhatsApp us', value: 'Chat directly with our team', href: WA_DIRECT, Icon: MessageCircle, grad: 'from-emerald-50 to-green-50', chip: 'bg-emerald-500', external: true },
];

const SOCIALS = [
  { title: 'WhatsApp Community', href: 'https://chat.whatsapp.com/Gi4D9yAd99p7q1XeVh0J1e', Icon: Users, color: 'text-emerald-600 bg-emerald-50' },
  { title: 'LinkedIn', href: 'https://www.linkedin.com/company/102554405/', Icon: Linkedin, color: 'text-blue-600 bg-blue-50' },
  { title: 'Instagram', href: 'https://www.instagram.com/genz_iitian/', Icon: Instagram, color: 'text-pink-600 bg-pink-50' },
  { title: 'YouTube', href: 'https://youtube.com/@Gen-ZIITian/', Icon: Youtube, color: 'text-red-600 bg-red-50' },
];

export default function Contact() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] selection:bg-blue-100 overflow-x-hidden">
      {/* Hero */}
      <section className="relative px-6 pt-28 pb-14 md:pt-36 md:pb-20 text-center">
        <div className="relative max-w-2xl mx-auto">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-black/10 text-xs font-semibold text-gray-600 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> We reply fast
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.03] tracking-[-0.03em]">
              Let&apos;s{' '}
              <span className="text-emerald-600">talk.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 text-lg md:text-xl text-gray-500 leading-relaxed">
              Questions about a course, a batch or your prep? Reach the team directly, we are happy to help.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Primary channels */}
      <section className="px-6 pb-8">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          {CHANNELS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.07}>
              <motion.a
                href={c.href}
                {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                whileHover={reduce ? undefined : { y: -6 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                className={`group block h-full rounded-3xl p-6 bg-gradient-to-br ${c.grad} border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.05)]`}
              >
                <div className={`w-11 h-11 rounded-2xl ${c.chip} text-white flex items-center justify-center mb-8 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
                  <c.Icon className="w-5 h-5" />
                </div>
                <div className="text-sm font-medium text-gray-500">{c.title}</div>
                <div className="mt-1 text-lg md:text-xl font-semibold tracking-tight break-words">{c.value}</div>
                <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#0b1120]">
                  Get in touch <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </motion.a>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Socials */}
      <section className="px-6 pb-20">
        <Reveal>
          <div className="max-w-5xl mx-auto rounded-3xl bg-white border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 md:p-6">
            <div className="text-sm font-semibold text-gray-400 mb-4 px-1">Find us everywhere</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SOCIALS.map((s) => (
                <motion.a
                  key={s.title}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={reduce ? undefined : { y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
                  className="flex items-center gap-3 rounded-2xl border border-black/5 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}><s.Icon className="w-4 h-4" /></span>
                  <span className="text-sm font-semibold">{s.title}</span>
                </motion.a>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-28">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-10">
          <Reveal className="lg:col-span-1">
            <div className="lg:sticky lg:top-28">
              <p className="text-sm font-semibold text-emerald-600 mb-2">Knowledge base</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.025em] leading-tight">Frequently asked questions</h2>
              <p className="mt-4 text-gray-500 leading-relaxed">Everything you need to know about GenZ IITian and our courses. Can&apos;t find an answer? Reach out above.</p>
            </div>
          </Reveal>
          <div className="lg:col-span-2 flex flex-col gap-3">
            {FAQ_DATA.map((faq, index) => (
              <Reveal key={index} delay={index * 0.03}>
                <FAQItem
                  question={faq.question}
                  answer={faq.answer}
                  icon={faq.icon}
                  isOpen={openIndex === index}
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
