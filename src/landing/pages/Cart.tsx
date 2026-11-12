'use client';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '@/landing/context/CartContext';
import { useAuth } from '@/landing/context/AuthContext';
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, Loader2, X, Gift, Coins } from 'lucide-react';
import { Link, useNavigate } from '@/landing/shims/router';
import { supabase } from '@/landing/lib/supabase';
import { apiService } from '@/landing/lib/api';
import { getStoredReferralCode, clearReferralCookie, validateReferralCode, getReferralProfile } from '@/landing/lib/referral';

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export default function Cart() {
  const { cart, removeFromCart, total, clearCart } = useCart();
  const { user, profile, openLoginModal } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Processing Order...");
  const navigate = useNavigate();

  // Unified Promo logic states
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  
  // Actually applied logic (mutually exclusive)
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [isReferralFromCookie, setIsReferralFromCookie] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Wallet / Coins states
  const [walletBalance, setWalletBalance] = useState(0);
  const [coinsToApply, setCoinsToApply] = useState(0);
  const [coinsApplied, setCoinsApplied] = useState(0);

  // Auto-recover mobile payments
  useEffect(() => {
    if (!user || isProcessing || cart.length === 0) return;

    const checkRecentPayment = async () => {
      try {
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: recentOrders } = await supabase
          .from('website_orders')
          .select('*')
          .eq('user_email', user.email)
          .eq('status', 'PAID')
          .gt('created_at', tenMinsAgo)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentOrders && recentOrders.length > 0) {
          const courseTitle = cart.map(item => item.name).join(', ');
          clearCart();
          navigate("/payment-success", { state: { courseTitle } });
        }
      } catch (err) {
        console.error("Auto-recovery check failed:", err);
      }
    };

    const timer = setTimeout(checkRecentPayment, 1500);
    return () => clearTimeout(timer);
  }, [user, navigate, clearCart, cart, isProcessing]);

  // Auto-fill referral code from cookie
  useEffect(() => {
    const storedCode = getStoredReferralCode();
    if (storedCode && !appliedReferralCode) {
      setPromoCodeInput(storedCode);
      setIsReferralFromCookie(true);
    }
  }, []);

  // Fetch wallet balance
  useEffect(() => {
    if (user) {
      fetchWalletBalance();
    }
  }, [user]);

  const fetchWalletBalance = async () => {
    if (!user) return;
    try {
      const refProfile = await getReferralProfile(user.id, user.email || '');
      if (refProfile) {
        setWalletBalance(refProfile.wallet_balance || 0);
      }
    } catch (err) {
      console.error('Wallet fetch error:', err);
    }
  };

  useEffect(() => {
    loadScript(RAZORPAY_SCRIPT_URL);
  }, []);

  // ---- PROMO LOGIC ----
  const applyPromo = async () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;
    if (!user) { openLoginModal(); return; }

    setIsApplyingPromo(true);
    setPromoError('');
    
    // Clear previously applied codes
    setAppliedDiscountCode(null);
    setDiscountAmount(0);
    setAppliedReferralCode(null);
    setReferralDiscount(0);

    try {
      // 1. Try as Discount Coupon first
      const couponResult = await apiService.validateCoupon({
        code,
        total,
        courseIds: cart.map(item => String(item.id)),
      });

      if (couponResult.found) {
        setDiscountAmount(couponResult.discount || 0);
        setAppliedDiscountCode(couponResult.code || code);
        setPromoCodeInput('');
        return;
      }

      // 2. Try as Referral Code
      const result = await validateReferralCode(code);
      if (result.valid) {
        if (total < 200) {
          throw new Error('Cart total must be at least ₹200 to use a referral code.');
        }
        if (result.referrerEmail?.toLowerCase() === user.email?.toLowerCase()) {
          throw new Error('You cannot use your own referral code.');
        }

        const refDisc = Math.floor(total * 0.05); // 5% off
        setReferralDiscount(refDisc);
        setAppliedReferralCode(code);
        setPromoCodeInput('');
        return;
      }

      // 3. Neither valid
      throw new Error('Invalid discount or referral code.');
    } catch (err: any) {
      setPromoError(err.message);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const removePromo = () => {
    setAppliedDiscountCode(null);
    setDiscountAmount(0);
    setAppliedReferralCode(null);
    setReferralDiscount(0);
    setPromoError('');
    setIsReferralFromCookie(false);
    clearReferralCookie();
  };

  // ---- COINS ----
  const MAX_COINS_PER_ORDER = 50;
  const handleApplyCoins = () => {
    const afterDiscounts = Math.max(total - discountAmount - referralDiscount, 0);
    const maxCoins = Math.min(MAX_COINS_PER_ORDER, walletBalance, afterDiscounts - 1); // max 50, actual balance, keep cart ≥ ₹1
    const applied = Math.min(Math.max(coinsToApply, 0), Math.max(maxCoins, 0));
    setCoinsApplied(applied);
  };

  const removeCoins = () => {
    setCoinsApplied(0);
    setCoinsToApply(0);
  };

  // ---- FINAL TOTAL ----
  const finalTotal = Math.max(total - discountAmount - referralDiscount - coinsApplied, 1);

  const loadScript = (src: string) => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) { resolve(true); return; }
      const existingScript = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true), { once: true });
        existingScript.addEventListener('error', () => resolve(false), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    if (!user) { openLoginModal(); return; }

    let finalName = profile?.name;
    if (!finalName) {
      const promptedName = window.prompt("Please enter your full name for the certificate:");
      if (!promptedName) return;
      finalName = promptedName;
      try {
        await supabase.from('profiles').upsert({ id: user.id, email: user.email, name: finalName });
      } catch (err) { console.warn('Profile update failed:', err); }
    }

    setPaymentError('');
    setIsProcessing(true);
    setLoadingMessage("Preparing Checkout...");
    try {
      const orderData = await apiService.createOrder({
        amount: finalTotal,
        email: user.email!,
        courseIds: cart.flatMap((item) =>
          item.isBundle && item.bundleCourses && item.bundleCourses.length > 0
            ? item.bundleCourses.flatMap(b => [b.courseId, b.courseId2, b.courseId3].filter(Boolean))
            : [item.id as string]
        ),
        discountCode: appliedDiscountCode || undefined,
        referralCode: appliedReferralCode || undefined,
        coinsToApply: coinsApplied || undefined,
      });
      if (!orderData.id) throw new Error("Order creation failed");

      const scriptLoaded = await loadScript(RAZORPAY_SCRIPT_URL);
      if (!scriptLoaded || !(window as any).Razorpay) {
        throw new Error("Razorpay checkout could not load. Disable ad blockers and try again.");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_STOREFRONT_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: "INR",
        name: "GenZ IITIAN",
        description: cart.map(item => item.name).join(', ').substring(0, 255),
        notes: { courses: cart.map(item => item.name).join(', '), user_email: user.email },
        order_id: orderData.id,
        handler: async (response: any) => {
          setIsProcessing(true);
          setLoadingMessage("Processing your payment, please wait...");
          try {
            await apiService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              email: user.email,
              courseIds: cart.flatMap((item) =>
                item.isBundle && item.bundleCourses && item.bundleCourses.length > 0
                  ? item.bundleCourses.flatMap(b => [b.courseId, b.courseId2, b.courseId3].filter(Boolean))
                  : [item.id as string]
              ),
              discountCode: appliedDiscountCode || undefined,
              referralCode: appliedReferralCode || undefined,
              coinsApplied: coinsApplied || undefined,
            });

            const courseTitle = cart.map(item => item.name).join(', ');
            clearCart();
            clearReferralCookie();

            const flatCourseIds = cart.flatMap((item) =>
              item.isBundle && item.bundleCourses && item.bundleCourses.length > 0
                ? item.bundleCourses.flatMap(b => [b.courseId, b.courseId2, b.courseId3].filter(Boolean))
                : [item.id as string]
            );

            navigate("/payment-success", {
              state: {
                courseTitle,
                orderDetails: {
                  order_id: orderData.id,
                  total_amount: orderData._serverTotal || finalTotal,
                  created_at: new Date().toISOString(),
                  status: 'PAID',
                  course_ids: flatCourseIds
                }
              }
            });
          } catch (err) {
            console.error("Payment verification error:", err);
            setPaymentError("Payment verification failed. Please try again.");
          } finally {
            setIsProcessing(false);
          }
        },
        modal: { ondismiss: () => { setIsProcessing(false); } },
        prefill: { name: finalName || "", email: user.email },
        theme: { color: "#0b1120" },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on?.('payment.failed', (response: any) => {
        setIsProcessing(false);
        setPaymentError(response?.error?.description || "Payment failed. Please try again.");
      });
      rzp.open();
    } catch (err: any) {
      console.error(err);
      setPaymentError(err?.message || "Unable to start Razorpay checkout.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-6">
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0b1120]/80 backdrop-blur-md flex items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full bg-white border-[4px] border-[#0b1120] rounded-2xl p-6 shadow-[10px_10px_0px_#3b82f6]"
            >
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-black text-[#0b1120] mb-4">{loadingMessage}</h2>
              <p className="text-gray-500 font-bold leading-relaxed">
                Please do not refresh or change the tab <br />
                while we confirm your order.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between border-b-[4px] border-[#0b1120] pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-[#0b1120] mb-1">Your Cart</h1>
            <p className="text-base text-gray-500 font-bold tracking-tight">Ready to level up your skills?</p>
          </div>
          <div className="hidden md:flex items-center gap-3 text-sm font-black text-gray-400">
            <ShieldCheck className="w-5 h-5 text-green-500" /> Secure Checkout
          </div>
        </div>

        {cart.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 bg-white border-[3px] border-dashed border-gray-200 rounded-2xl">
            <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-[#0b1120] mb-2">Your cart is empty</h3>
            <p className="text-gray-500 font-bold text-sm mb-8">Don't let your future wait. Pick a course and start learning.</p>
            <Link to="/explore/courses" className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-[#0b1120] text-white rounded-xl font-black text-lg border-[3px] border-[#0b1120] shadow-[5px_5px_0px_#3b82f6] hover:translate-y-1 hover:shadow-none transition-all">
              Browse Courses <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            <div className="lg:col-span-2 space-y-6">
              <AnimatePresence>
                {cart.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="bg-white border-[3px] border-[#0b1120] rounded-2xl p-4 flex gap-4 items-center shadow-[6px_6px_0px_#0b1120]"
                  >
                    <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gray-100 rounded-2xl border-2 border-[#0b1120] overflow-hidden flex-shrink-0">
                      <img src={item.image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=300'} className="w-full h-full object-cover" alt={item.name} />
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-lg font-black text-[#0b1120] mb-1">{item.name}</h3>
                      <div className="text-xl font-black text-[#10b981]">₹{item.price}</div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="lg:col-span-1 sticky top-24">
              <div className="bg-white border-[3px] border-[#0b1120] rounded-2xl p-6 shadow-[8px_8px_0px_#0b1120]">
                <h3 className="text-lg font-black text-[#0b1120] mb-6 border-b-2 border-gray-100 pb-3">Order Summary</h3>

                <div className="space-y-3 mb-8">
                  <div className="flex justify-between font-bold text-gray-500 text-sm">
                    <span>Items ({cart.length})</span>
                    <span>₹{total}</span>
                  </div>

                  {/* ---- PROMO / REFERRAL CODE ---- */}
                  <div className="py-2 border-t border-b border-gray-100 my-4">
                    {!(appliedDiscountCode || appliedReferralCode) ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="relative flex-grow">
                            <input
                              type="text"
                              placeholder="Promo or Referral Code"
                              value={promoCodeInput}
                              onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                              className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-200 rounded-lg font-black text-sm outline-none focus:border-[#10b981] uppercase placeholder:normal-case"
                            />
                            {isReferralFromCookie && promoCodeInput && (
                              <button
                                onClick={() => { setPromoCodeInput(''); setIsReferralFromCookie(false); clearReferralCookie(); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <button
                            onClick={applyPromo}
                            disabled={isApplyingPromo || !promoCodeInput.trim()}
                            className="px-4 py-2 bg-[#0b1120] text-white rounded-lg font-black text-xs hover:bg-gray-800 transition-colors disabled:opacity-50"
                          >
                            {isApplyingPromo ? 'WAIT...' : 'APPLY'}
                          </button>
                        </div>
                        {isReferralFromCookie && promoCodeInput && (
                          <p className="text-purple-500 font-bold text-[10px] uppercase">🔗 Auto-filled from referral link</p>
                        )}
                        {promoError && <p className="text-red-500 font-bold text-[10px] uppercase">{promoError}</p>}
                      </div>
                    ) : (
                      <div className={`p-3 border-2 rounded-lg flex items-center justify-between ${appliedDiscountCode ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'}`}>
                        <div>
                          <div className={`text-[10px] font-black uppercase ${appliedDiscountCode ? 'text-green-600' : 'text-purple-600'}`}>
                            {appliedDiscountCode ? 'Discount Applied!' : 'Referral Applied! 🎉'}
                          </div>
                          <div className="text-sm font-black text-[#0b1120] font-mono tracking-widest">
                            {appliedDiscountCode || appliedReferralCode}
                          </div>
                        </div>
                        <button onClick={removePromo} className="text-[10px] font-black text-red-500 hover:underline uppercase">Remove</button>
                      </div>
                    )}
                  </div>

                  {/* ---- WALLET / COINS ---- */}
                  {user && walletBalance > 0 && (
                    <div className="py-2 border-b border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Wallet: {walletBalance} Coins (₹{walletBalance})</span>
                      </div>
                      {coinsApplied === 0 ? (
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <input
                              type="text" inputMode="decimal"
                              min={0}
                              max={Math.min(MAX_COINS_PER_ORDER, walletBalance, Math.max(total - discountAmount - referralDiscount - 1, 0))}
                              placeholder={`Max ${Math.min(MAX_COINS_PER_ORDER, walletBalance, Math.max(total - discountAmount - referralDiscount - 1, 0))}`}
                              value={coinsToApply || ''}
                              onChange={(e) => setCoinsToApply(parseInt(e.target.value) || 0)}
                              className="flex-grow px-3 py-2 bg-amber-50 border-2 border-amber-200 rounded-lg font-black text-sm outline-none focus:border-amber-500"
                            />
                            <button
                              onClick={handleApplyCoins}
                              disabled={coinsToApply <= 0}
                              className="px-4 py-2 bg-amber-500 text-white rounded-lg font-black text-xs hover:bg-amber-600 transition-colors disabled:opacity-50"
                            >
                              USE
                            </button>
                          </div>
                          <p className="text-[10px] font-bold text-gray-400">Max 50 coins per order. 1 Coin = ₹1</p>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-lg flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-black text-amber-600 uppercase">Coins Applied!</div>
                            <div className="text-sm font-black text-[#0b1120]">{coinsApplied} Coins = ₹{coinsApplied} off</div>
                          </div>
                          <button onClick={removeCoins} className="text-[10px] font-black text-red-500 hover:underline uppercase">Remove</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- SUMMARY LINES ---- */}
                  {discountAmount > 0 && (
                    <div className="flex justify-between font-bold text-gray-500 text-sm">
                      <span>Coupon Discount</span>
                      <span className="text-green-600">-₹{discountAmount}</span>
                    </div>
                  )}
                  {referralDiscount > 0 && (
                    <div className="flex justify-between font-bold text-gray-500 text-sm">
                      <span>Referral Discount (5%)</span>
                      <span className="text-purple-600">-₹{referralDiscount}</span>
                    </div>
                  )}
                  {coinsApplied > 0 && (
                    <div className="flex justify-between font-bold text-gray-500 text-sm">
                      <span>Coins Applied</span>
                      <span className="text-amber-600">-₹{coinsApplied}</span>
                    </div>
                  )}

                  {paymentError && (
                    <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                      <p className="text-red-600 font-bold text-[10px] uppercase leading-relaxed">{paymentError}</p>
                    </div>
                  )}
                  <div className="h-0.5 bg-gray-100 my-3" />
                  <div className="flex justify-between items-end">
                    <span className="font-black text-[#0b1120] text-sm">Total</span>
                    <span className="text-2xl font-black text-[#0b1120]">₹{finalTotal}</span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isProcessing}
                  onClick={handleCheckout}
                  className="w-full py-4 bg-[#10b981] text-[#0b1120] rounded-xl font-black text-lg border-[3px] border-[#0b1120] shadow-[5px_5px_0px_#0b1120] flex items-center justify-center gap-2.5 hover:shadow-none hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                  ) : (
                    <>Checkout Now <ArrowRight className="w-5 h-5" /></>
                  )}
                </motion.button>

                <p className="mt-8 text-center text-xs font-black text-gray-400 leading-relaxed uppercase tracking-widest">
                  By clicking checkout, you agree to our <br /> Terms and Conditions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
