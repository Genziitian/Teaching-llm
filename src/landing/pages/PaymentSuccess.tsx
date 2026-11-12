'use client';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from '@/landing/shims/router';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '@/landing/context/AuthContext';
import { Check, ArrowRight, CreditCard, MessageCircle, Clock, BookOpen, Hash } from 'lucide-react';
import { apiService } from '@/landing/lib/api';
import { supabase } from '@/landing/lib/supabase';

export default function PaymentSuccess() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [orderDetails, setOrderDetails] = useState<any>(location.state?.orderDetails || null);
  const [courseTitles, setCourseTitles] = useState<string>(location.state?.courseTitle || 'your selected course(s)');
  const [loadingOrder, setLoadingOrder] = useState(!orderDetails);
  const [countdown, setCountdown] = useState(15); // Increased to give time to read receipt
  const LMS_URL = "https://class.genziitian.in";
  const reduce = useReducedMotion();

  useEffect(() => {
    async function fetchOrder() {
      if (orderDetails || !user?.email) return;
      
      try {
        const lastOrder = await apiService.getLastOrder(user.email);
        if (lastOrder && lastOrder.status === 'PAID') {
          setOrderDetails(lastOrder);
          // If we have IDs but no titles, try to fetch titles from both catalog and courses
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
      } finally {
        setLoadingOrder(false);
      }
    }
    
    fetchOrder();
  }, [user?.email, orderDetails]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = LMS_URL; 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const rise = (d: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, bounce: 0, duration: 0.6, delay: d },
  });

  const rows = [
    { Icon: BookOpen, label: 'Purchased', value: courseTitles, wrap: true },
    { Icon: CreditCard, label: 'Amount paid', value: orderDetails ? `₹${orderDetails.total_amount}` : 'Processing...', strong: true },
    { Icon: Clock, label: 'Date & time', value: orderDetails?.created_at ? new Date(orderDetails.created_at).toLocaleString() : new Date().toLocaleString() },
    { Icon: Hash, label: 'Order ID', value: orderDetails?.order_id || 'Generating...', mono: true },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center px-4 py-24 sm:py-28 relative overflow-hidden">
      <div className="w-full max-w-lg text-center">
        {/* Animated check */}
        <div className="relative mx-auto mb-7 w-20 h-20">
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-emerald-400/40"
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.4, duration: 0.7 }}
            className="relative w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_16px_40px_-8px_rgba(16,185,129,0.6)]"
          >
            <Check className="w-10 h-10" strokeWidth={3} />
          </motion.div>
        </div>

        <motion.div {...rise(0.15)}>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-[#1d1d1f]">Payment successful</h1>
          <p className="mt-2 text-gray-500">Thank you for your purchase. You are all set.</p>
        </motion.div>

        {/* Receipt */}
        <motion.div {...rise(0.25)} className="mt-8 rounded-3xl bg-white border border-black/5 shadow-[0_8px_40px_rgba(0,0,0,0.07)] text-left overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-black/5 text-xs font-semibold uppercase tracking-wider text-gray-500">Receipt</div>
          <dl className="divide-y divide-black/5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <dt className="flex items-center gap-2 text-sm text-gray-500 shrink-0"><r.Icon className="w-4 h-4" />{r.label}</dt>
                <dd className={`text-sm text-right min-w-0 ${r.strong ? 'font-bold text-emerald-600 text-base' : 'font-semibold text-[#0b1120]'} ${r.mono ? 'font-mono text-xs text-gray-500 break-all' : ''} ${r.wrap ? 'line-clamp-2' : ''}`}>{r.value}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.p {...rise(0.32)} className="mt-6 text-sm text-gray-500">
          Your access has been granted to <span className="font-semibold text-[#0b1120] break-all">{user?.email}</span>.
        </motion.p>

        <motion.div {...rise(0.38)} className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => (window.location.href = LMS_URL)}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#0b1120] text-white font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all cursor-pointer"
          >
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </button>
          <Link
            to="/explore/courses"
            className="sm:w-auto inline-flex items-center justify-center py-3.5 px-7 rounded-full bg-white border border-black/15 text-[#0b1120] font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            Back to courses
          </Link>
        </motion.div>

        {/* Redirect progress */}
        <motion.div {...rise(0.45)} className="mt-8">
          <div className="h-1 w-full max-w-xs mx-auto rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-[width] duration-1000 ease-linear" style={{ width: `${((15 - countdown) / 15) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-400">Taking you to your dashboard in {countdown}s</p>
          <Link to="/contact" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#0b1120] transition-colors">
            <MessageCircle className="w-4 h-4" /> Need help? Contact support
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
