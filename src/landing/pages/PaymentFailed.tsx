'use client';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from '@/landing/shims/router';
import { motion, useReducedMotion } from 'motion/react';
import { X, RefreshCcw, BookOpen, MessageCircle, Clock, CreditCard, Info } from 'lucide-react';
import { useAuth } from '@/landing/context/AuthContext';
import { apiService } from '@/landing/lib/api';
import { supabase } from '@/landing/lib/supabase';

export default function PaymentFailed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [orderDetails, setOrderDetails] = useState<any>(location.state?.orderDetails || null);
  const [courseTitles, setCourseTitles] = useState<string>(location.state?.courseTitle || 'your selected course(s)');
  
  useEffect(() => {
    async function fetchOrder() {
      if (orderDetails || !user?.email) return;
      
      try {
        const lastOrder = await apiService.getLastOrder(user.email);
        // We show the last order even if it's CREATED or FAILED so they can see the details
        if (lastOrder) {
          setOrderDetails(lastOrder);
          if (Array.isArray(lastOrder.course_ids)) {
            const [{ data: catalog }, { data: mainCourses }] = await Promise.all([
              supabase.from('course_catalog').select('id, name').in('id', lastOrder.course_ids),
              supabase.from('courses').select('id, name').in('id', lastOrder.course_ids)
            ]);

            const merged = [...(catalog || []), ...(mainCourses || [])];
            const nameMap = new Map(merged.map(c => [c.id, c.name]));
            const titles = lastOrder.course_ids.map((id: string) => nameMap.get(id) || id);
            
            if (titles.length > 0) {
              setCourseTitles(titles.join(', '));
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch fallback order:', err);
      }
    }
    
    fetchOrder();
  }, [user?.email, orderDetails]);

  const rise = (d: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, bounce: 0, duration: 0.6, delay: d },
  });

  const rows = [
    { Icon: BookOpen, label: 'Attempted', value: courseTitles, wrap: true },
    { Icon: CreditCard, label: 'Amount', value: orderDetails ? `₹${orderDetails.total_amount}` : '...', strong: true },
    { Icon: Clock, label: 'Time', value: orderDetails?.created_at ? new Date(orderDetails.created_at).toLocaleTimeString() : new Date().toLocaleTimeString() },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center px-4 py-24 sm:py-28 relative overflow-hidden">
      <div className="w-full max-w-lg text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={reduce ? { scale: 1 } : { scale: 1, x: [0, -8, 8, -5, 5, 0] }}
          transition={{ scale: { type: 'spring', bounce: 0.4, duration: 0.6 }, x: { delay: 0.5, duration: 0.5 } }}
          className="mx-auto mb-7 w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-[0_16px_40px_-8px_rgba(239,68,68,0.55)]"
        >
          <X className="w-10 h-10" strokeWidth={3} />
        </motion.div>

        <motion.div {...rise(0.15)}>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-[#1d1d1f]">Payment failed</h1>
          <p className="mt-2 text-gray-500">Unfortunately, your transaction could not be processed.</p>
        </motion.div>

        <motion.div {...rise(0.25)} className="mt-8 rounded-3xl bg-white border border-black/5 shadow-[0_8px_40px_rgba(0,0,0,0.07)] text-left overflow-hidden">
          <div className="px-5 py-3 bg-red-50/70 border-b border-black/5 text-xs font-semibold uppercase tracking-wider text-red-500">Attempt details</div>
          <dl className="divide-y divide-black/5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <dt className="flex items-center gap-2 text-sm text-gray-500 shrink-0"><r.Icon className="w-4 h-4" />{r.label}</dt>
                <dd className={`text-sm text-right min-w-0 ${r.strong ? 'font-bold text-red-500 text-base' : 'font-semibold text-[#0b1120]'} ${r.wrap ? 'line-clamp-2' : ''}`}>{r.value}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.div {...rise(0.32)} className="mt-4 flex gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-4 text-left">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900/80 leading-relaxed">
            If money was deducted from your account, your bank will refund it automatically within 5-7 business days.
          </p>
        </motion.div>

        <motion.div {...rise(0.4)} className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#0b1120] text-white font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RefreshCcw className="w-4 h-4" /> Try again
          </button>
          <Link
            to="/explore/courses"
            className="inline-flex items-center justify-center py-3.5 px-7 rounded-full bg-white border border-black/15 text-[#0b1120] font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            Browse courses
          </Link>
        </motion.div>

        <motion.div {...rise(0.47)} className="mt-8">
          <Link to="/contact" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#0b1120] transition-colors">
            <MessageCircle className="w-4 h-4" /> Still stuck? Contact our support team
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
