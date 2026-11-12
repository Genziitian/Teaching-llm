'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/landing/context/AuthContext';
import { supabase } from '@/landing/lib/supabase';
import { Loader2, CheckCircle2, Gift, Coins, Copy, Share2, Trophy, Target, ChevronDown, HelpCircle, Lock, Check } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion, animate } from 'motion/react';
import { getReferralProfile, getReferralHistory, getMilestones, type ReferralProfile, type ReferralTransaction } from '@/landing/lib/referral';

const REFERRAL_FAQs = [
  {
    question: "How can I refer someone?",
    answer: "You can refer your friends by sharing your unique referral code or referral link. When your friend uses your code while purchasing any course, the referral will be successfully applied."
  },
  {
    question: "What happens when someone uses my referral code?",
    answer: "When your friend applies your referral code, they get a 5% discount, and you earn 5% of the course value as coins in your account."
  },
  {
    question: "How can I use my coins?",
    answer: "Your coins can be used as discounts while purchasing courses. The value is simple: 1 coin = ₹1. You can use a maximum of 50 coins per purchase."
  },
  {
    question: "Can I transfer my coins to my bank account?",
    answer: "No, coins cannot be withdrawn or transferred to a bank account. They can only be used for discounts on our platform."
  },
  {
    question: "I didn’t receive my cashback/coins. What should I do?",
    answer: "If you didn’t receive your coins, please contact us through the Contact Us page. Our team will review the issue and help resolve it."
  }
];

function AnimatedNumber({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setV(value); return; }
    const c = animate(0, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [value, reduce]);
  return <>{v}</>;
}

function FAQItem({ question, answer, isOpen, onClick }: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className={`rounded-2xl border bg-white overflow-hidden transition-all duration-300 ${isOpen ? 'border-violet-200 shadow-[0_8px_30px_rgba(139,92,246,0.12)]' : 'border-black/5 hover:border-black/10'}`}>
      <button onClick={onClick} className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 cursor-pointer">
        <span className="text-base font-semibold text-[#0b1120]">{question}</span>
        <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-violet-600' : 'text-gray-400'}`} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          >
            <p className="px-5 pb-5 text-[15px] text-gray-500 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Referral() {
  const { user, loading: authLoading } = useAuth();
  const reduce = useReducedMotion();
  
  // Referral states
  const [referralProfile, setReferralProfile] = useState<ReferralProfile | null>(null);
  const [referralHistory, setReferralHistory] = useState<ReferralTransaction[]>([]);
  const [milestones, setMilestones] = useState<{ referrals_required: number; bonus_coins: number }[]>([]);
  const [referralLoading, setReferralLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      fetchReferralData();

      // Real-time subscription: wallet updates live when someone uses your code
      const channel = supabase
        .channel('referral-profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'referral_profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as ReferralProfile;
            setReferralProfile(updated);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchReferralData = async () => {
    if (!user) return;
    setReferralLoading(true);
    try {
      const [refProfile, history, ms] = await Promise.all([
        getReferralProfile(user.id, user.email || '', user.user_metadata?.full_name || ''),
        getReferralHistory(user.email || ''),
        getMilestones(),
      ]);
      setReferralProfile(refProfile);
      setReferralHistory(history);
      setMilestones(ms);
    } catch (err) {
      console.error('Referral data error:', err);
    } finally {
      setReferralLoading(false);
    }
  };

  const copyCode = () => {
    if (!referralProfile) return;
    navigator.clipboard.writeText(referralProfile.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    if (!referralProfile) return;
    const link = `${window.location.origin}?ref=${referralProfile.referral_code}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Milestone progress calculation
  const getNextMilestone = () => {
    if (!referralProfile || milestones.length === 0) return null;
    const current = referralProfile.quarterly_referrals;
    for (const ms of milestones) {
      if (current < ms.referrals_required) {
        return ms;
      }
    }
    return null; // all milestones achieved
  };

  const nextMilestone = getNextMilestone();
  const progressPercent = nextMilestone
    ? Math.min((referralProfile?.quarterly_referrals || 0) / nextMilestone.referrals_required * 100, 100)
    : 100;
  const remaining = nextMilestone
    ? nextMilestone.referrals_required - (referralProfile?.quarterly_referrals || 0)
    : 0;

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin" /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center font-black text-2xl">PLEASE LOG IN TO VIEW REFERRALS</div>;

  const card = 'rounded-3xl bg-white border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.05)]';
  const rise = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, bounce: 0, duration: 0.6, delay: i * 0.08 },
  });

  return (
    <div className="min-h-screen bg-[#fbfbfd] pt-28 pb-16 px-6 relative overflow-hidden">
      <div className="relative max-w-4xl mx-auto space-y-10">
        <motion.div className="text-center" {...rise(0)}>
          <h1 className="text-4xl md:text-6xl font-bold text-[#1d1d1f] mb-3 tracking-[-0.03em]">
            Refer &amp; <span className="text-violet-600">Earn</span>
          </h1>
          <p className="text-gray-500 text-lg">Help your friends join IIT Madras Online Degree and get rewarded.</p>
        </motion.div>

        {!referralLoading && referralProfile && (
          <section className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Referral code */}
              <motion.div {...rise(1)} className={`md:col-span-2 ${card} p-7 relative overflow-hidden`}>
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-violet-100/70 blur-2xl" aria-hidden />
                <div className="relative">
                  <div className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-3">Your referral code</div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="px-5 py-3 rounded-2xl bg-slate-50 border border-black/5 text-3xl md:text-4xl font-bold font-mono tracking-[0.25em] text-[#0b1120]">
                      {referralProfile.referral_code}
                    </div>
                    <motion.button
                      onClick={copyCode}
                      whileTap={{ scale: 0.9 }}
                      title="Copy code"
                      aria-label="Copy code"
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors cursor-pointer ${copied ? 'bg-emerald-500 text-white' : 'bg-violet-100 text-violet-600 hover:bg-violet-600 hover:text-white'}`}
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </motion.button>
                  </div>
                  <motion.button
                    onClick={copyLink}
                    whileHover={reduce ? undefined : { scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-[#0b1120] text-white rounded-full font-semibold text-sm cursor-pointer"
                  >
                    {linkCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />} {linkCopied ? 'Link copied' : 'Copy referral link'}
                  </motion.button>
                  <p className="mt-5 text-sm text-gray-500">
                    Share your code. They get <span className="font-semibold text-violet-600">5% off</span>, you earn <span className="font-semibold text-amber-600">5% in coins</span>.
                  </p>
                </div>
              </motion.div>

              {/* Wallet */}
              <motion.div {...rise(2)} className="rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 text-white p-7 flex flex-col justify-between shadow-[0_16px_40px_-12px_rgba(245,158,11,0.6)]">
                <motion.div
                  className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center"
                  animate={reduce ? undefined : { y: [0, -4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Coins className="w-6 h-6" />
                </motion.div>
                <div className="mt-8">
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Wallet balance</div>
                  <div className="text-5xl font-bold tracking-[-0.03em] mt-1"><AnimatedNumber value={referralProfile.wallet_balance} /></div>
                  <div className="text-sm text-white/80 mt-1">Coins = ₹{referralProfile.wallet_balance}</div>
                </div>
              </motion.div>
            </div>

            {/* Milestones */}
            <motion.div {...rise(3)} className={`${card} p-7`}>
              <div className="flex items-center gap-3 mb-6">
                <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Target className="w-5 h-5" /></span>
                <h3 className="text-lg font-semibold text-[#0b1120]">Quarterly milestone progress</h3>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-2 text-sm">
                  <span className="font-medium text-gray-500">
                    {referralProfile.quarterly_referrals} referral{referralProfile.quarterly_referrals !== 1 ? 's' : ''} this quarter
                  </span>
                  {nextMilestone ? (
                    <span className="font-semibold text-violet-600">{remaining} more for {nextMilestone.bonus_coins} coins</span>
                  ) : (
                    <span className="font-semibold text-emerald-600">All milestones achieved</span>
                  )}
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ type: 'spring', bounce: 0, duration: 1.2, delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-violet-500 to-sky-500 rounded-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 md:gap-4">
                {milestones.map((ms, i) => {
                  const achieved = (referralProfile.quarterly_referrals || 0) >= ms.referrals_required;
                  return (
                    <motion.div
                      key={ms.referrals_required}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.5, delay: 0.4 + i * 0.08 }}
                      whileHover={reduce ? undefined : { y: -4 }}
                      className={`p-4 rounded-2xl border text-center ${achieved ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-black/5'}`}
                    >
                      <div className={`mx-auto mb-3 w-9 h-9 rounded-full flex items-center justify-center ${achieved ? 'bg-emerald-500 text-white' : 'bg-white text-gray-400 border border-black/5'}`}>
                        {achieved ? <Check className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </div>
                      <div className="text-base md:text-lg font-semibold text-[#0b1120]">{ms.referrals_required} referrals</div>
                      <div className={`text-sm font-medium ${achieved ? 'text-emerald-600' : 'text-gray-400'}`}>+{ms.bonus_coins} coins</div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center gap-3 p-4 bg-blue-50/70 rounded-2xl">
                <Trophy className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-[#0b1120]">
                  Lifetime referrals: <span className="font-bold text-blue-600">{referralProfile.lifetime_referrals}</span>
                </span>
              </div>
            </motion.div>

            {/* History */}
            {referralHistory.length > 0 && (
              <motion.div {...rise(4)} className={`${card} overflow-hidden`}>
                <div className="p-6 border-b border-black/5">
                  <h3 className="text-lg font-semibold text-[#0b1120]">Referral history</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[11px] uppercase text-gray-400 tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Buyer</th>
                        <th className="px-6 py-3 font-semibold">Reward</th>
                        <th className="px-6 py-3 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {referralHistory.map((tx) => (
                        <tr key={tx.id} className="hover:bg-violet-50/40 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {tx.buyer_email ? String(tx.buyer_email).replace(/(.{3}).+(@.+)/, '$1***$2') : 'Anonymous'}
                          </td>
                          <td className="px-6 py-4"><span className="text-emerald-600 font-semibold text-sm">+{tx.referrer_reward} coins</span></td>
                          <td className="px-6 py-4 text-sm text-gray-400">
                            {new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </section>
        )}

        {/* FAQ */}
        <motion.div {...rise(5)} className="pt-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.02em] text-[#0b1120] mb-6 flex items-center gap-3">
            <HelpCircle className="w-7 h-7 text-violet-600" /> Referral FAQs
          </h2>
          <div className="flex flex-col gap-3">
            {REFERRAL_FAQs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFaqIndex === index}
                onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
              />
            ))}
          </div>
        </motion.div>

        {referralLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-violet-500" />
            <p className="mt-4 text-gray-400 font-medium">Loading your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}
