'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from '@/landing/shims/router';
import { motion, AnimatePresence } from 'motion/react';
import { rememberCheckout } from '@/landing/lib/abandonedCart';
import { supabase } from '@/landing/lib/supabase';
import { apiService } from '@/landing/lib/api';
import { validateReferralCode, getReferralProfile } from '@/landing/lib/referral';
import { useAuth } from '@/landing/context/AuthContext';
import { Check, Loader2, ShieldCheck, AlertCircle, User, UserCheck, CreditCard, ArrowRight, BookOpen, Copy, CheckCheck } from 'lucide-react';
import { resolveBundleDiscountConfig } from '@/landing/utils/bundleDiscount';

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const MIN_PROMO_ORDER_AMOUNT = 300;

interface SubCourse {
  courseId: string;
  courseName: string;
  price: number;
}

import { CheckCircle2, Star, Quote } from 'lucide-react';
import StickyEnrollBanner from '@/landing/components/StickyEnrollBanner';

// Batch descriptions shown on the Qualifier checkout (prices come from the
// manager's pricing options; these are the per-plan feature lists).
const QUALIFIER_PLAN_FEATURES: Record<string, { highlight?: string; subjects: string; items: string[]; footnote?: string }> = {
  recorded: {
    subjects: 'CT, Stats 1, Maths 1, Eng 1',
    items: [
      'Week 1–4 Detailed Recording Lectures',
      'Recorded PYQs Session',
      'Weekly Doubt Session',
      'Graded Assignment Recordings',
      'Best Handwritten Notes',
      'Important Questions & Blueprint',
    ],
  },
  live: {
    subjects: 'CT, Stats 1, Maths 1, Eng 1',
    items: [
      'Week 1–4 Detailed Recording + Live Lectures',
      'Live PYQs Session',
      'Live Revision Session',
      'Weekly Doubt Session',
      'Graded Assignment Recordings',
      'Resume & LinkedIn Workshops',
      'Access to Exam Platform',
    ],
  },
  champion: {
    highlight: 'Full Refund if Not Qualified!',
    subjects: 'CT, Stats 1, Maths 1, Eng 1',
    items: [
      'All 4 Subjects + Live & Mentorship Sessions',
      'Recordings + Activities',
      'PYQs + Graded Assignments',
      'Dedicated Personal Mentorship',
      'Career Guidance & Support',
      'Lifetime Reattempt Support',
      'Access to Exam Platform',
    ],
    footnote: '*Terms & Conditions apply',
  },
};

// Map a manager-defined pricing option to its Qualifier feature set by name/type.
function getQualifierPlan(opt: any) {
  const n = (opt?.name || '').toLowerCase();
  const t = (opt?.type || '').toLowerCase();
  if (n.includes('champion')) return QUALIFIER_PLAN_FEATURES.champion;
  if (n.includes('live') || n.includes('advanced') || t === 'live') return QUALIFIER_PLAN_FEATURES.live;
  if (n.includes('record') || n.includes('basic') || t === 'recorded') return QUALIFIER_PLAN_FEATURES.recorded;
  return null;
}

export default function CourseSelection() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, profile, loading: authLoading, openLoginModal } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Processing Enrollment...");
  const [step, setStep] = useState<'profile' | 'selection'>('selection');
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

  // Discount Logic
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [discountError, setDiscountError] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [coinsApplied, setCoinsApplied] = useState(0);
  const [coinsToApply, setCoinsToApply] = useState(0);
  const [coinsError, setCoinsError] = useState('');
  const [selectedPricingTier, setSelectedPricingTier] = useState<number | null>(null);
  const [overriddenPrice, setOverriddenPrice] = useState<number | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const enrollCtaRef = useRef<HTMLButtonElement>(null);
  const coursesPickerRef = useRef<HTMLDivElement>(null);

  // 🔄 Auto-recovery for mobile users:
  // If the page reloads after a mobile redirect payment, check if any order was successfully PAID
  // in the last 10 minutes and redirect to success page automatically.
  useEffect(() => {
    if (!user || isProcessing || !course || selectedCourses.length === 0) return;

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
          const order = recentOrders[0];
          const recentCourseIds = Array.isArray(order.course_ids) ? order.course_ids : [];
          
          // Calculate the course IDs currently being checked out
          const currentCourseIds = course.isBundle && Array.isArray(course.bundleCourses)
            ? course.bundleCourses
                .filter((bc: any) => selectedCourses.includes(bc.courseId))
                .flatMap((bc: any) => [bc.courseId, bc.courseId2, bc.courseId3].filter(Boolean))
            : selectedCourses;

          // Only auto-recover and redirect if the paid order actually matches the current selection
          const hasOverlap = currentCourseIds.some(id => recentCourseIds.includes(id));
          if (hasOverlap) {
            const courseTitle = course.isBundle 
              ? course.bundleCourses.filter((bc: any) => selectedCourses.includes(bc.courseId)).map((bc: any) => bc.courseName).join(', ')
              : course.name;

            navigate("/payment-success", { state: { courseTitle } });
          }
        }
      } catch (err) {
        console.error("Auto-recovery check failed:", err);
      }
    };

    // Small delay to give the webhook/server time to process the status update
    const timer = setTimeout(checkRecentPayment, 1500);
    return () => clearTimeout(timer);
  }, [user, navigate, course, selectedCourses, isProcessing]);


  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const courseLookupId = searchParams.get('courseId') || id;

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
      console.error(err);
    }
  };

  // Profile Form State
  const [profileData, setProfileData] = useState({
    name: '',
    gender: '',
    phone: ''
  });

  useEffect(() => {
    if (!authLoading && !user) {
      openLoginModal();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (profile) {
      setProfileData({
          name: profile.name || '',
          gender: profile.gender || '',
          phone: profile.phone || ''
      });
      
      // If user has existing data, show prompt to confirm
      if (profile.name && profile.gender && profile.phone) {
        setShowProfilePrompt(true);
        setStep('selection');
      } else {
        setStep('profile');
      }
    }
  }, [profile]);

  const fetchCourse = async () => {
    try {
      const { data, error } = await supabase.from('courses').select('*').eq('id', courseLookupId).single();
      if (error) throw error;
      if (data.active === false) {
        navigate('/explore/courses');
        return;
      }
      setCourse(data);

      // Auto-select behavior:
      if (!data.isBundle) {
          setSelectedCourses([data.id]);
      } else if (data.isFixedBundle) {
          // Mandatory selection for fixed bundles
          setSelectedCourses(data.bundleCourses?.map((bc: any) => bc.courseId) || []);
          // Do not auto-select a pricing tier — user must choose a plan
          setSelectedPricingTier(null);
      } else {
          // Selectable bundles start empty per user request
          setSelectedCourses([]);
      }
    } catch (err) {
      console.error(err);
      navigate('/explore/courses');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profileData.name || !profileData.gender || !profileData.phone) return;

    if (profileData.phone.length !== 10) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }
    if (profileData.name.length > 20) {
      alert("Name must be 20 characters or less.");
      return;
    }

    setIsProcessing(true);
    setLoadingMessage("Saving Profile...");
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user?.id,
        email: user?.email,
        name: profileData.name,
        gender: profileData.gender,
        phone: profileData.phone
      });
      if (error) throw error;
      setStep('selection');
      setShowProfilePrompt(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, [courseLookupId]);

  useEffect(() => {
    loadScript(RAZORPAY_SCRIPT_URL);
  }, []);

  const toggleCourse = (courseId: string) => {
    setSelectedCourses(prev => {
      const next = prev.includes(courseId) 
        ? prev.filter(i => i !== courseId) 
        : [...prev, courseId];
      
      // Auto-revoke bundle discount if criteria broken
      if (course?.isBundle && appliedDiscountCode === course?.bundleDiscountCode) {
         const { mode, minCourses } = resolveBundleDiscountConfig(course);
         const requiredCountRaw = mode === 'any'
           ? minCourses
           : Number(course?.bundleCourses?.length || 0);
         const requiredCount = Math.max(1, Math.min(requiredCountRaw, Number(course?.bundleCourses?.length || requiredCountRaw || 1)));
         const isStillEligible = next.length >= requiredCount;
         if (!isStillEligible) {
            setAppliedDiscountCode(null);
            setDiscountAmount(0);
         }
      }
      return next;
    });
  };

  const { mode: bundleDiscountMode, minCourses: bundleDiscountMinCoursesResolved } = resolveBundleDiscountConfig(course);
  const bundleDiscountRequiredCountRaw = bundleDiscountMode === 'any'
    ? bundleDiscountMinCoursesResolved
    : Number(course?.bundleCourses?.length || 0);
  const bundleDiscountRequiredCount = Math.max(
    1,
    Math.min(bundleDiscountRequiredCountRaw, Number(course?.bundleCourses?.length || bundleDiscountRequiredCountRaw || 1))
  );
  const isBundleDiscountEligible = !!(course?.isBundle && selectedCourses.length >= bundleDiscountRequiredCount);

  const bundleTotalRaw = course?.isBundle 
    ? course.bundleCourses?.reduce((sum: number, bc: any) => sum + bc.price, 0) || 0
    : 0;

  const bundleSelectedRaw = course?.isBundle
    ? course.bundleCourses
        ?.filter((bc: SubCourse) => selectedCourses.includes(bc.courseId))
        .reduce((sum: number, bc: SubCourse) => sum + bc.price, 0) || 0
    : 0;

  const bundleDiscountVal = Number(course?.bundleDiscountAmount || course?.bundleDiscountPrice || 0);
  const bundleDiscountPreviewSavings = bundleDiscountVal;

  const bundleSelectionProgress = course?.isBundle && bundleDiscountRequiredCount > 0
    ? Math.min((selectedCourses.length / bundleDiscountRequiredCount) * 100, 100)
    : 0;

  const hasBundleDiscount = course?.isBundle && (
    bundleDiscountVal > 0 || 
    !!course.bundleDiscountCode
  );

  // ---- Exit offer: nudge users who are about to leave the main checkout without a discount ----
  const [showExitOffer, setShowExitOffer] = useState(false);
  const [autoApplyOffer, setAutoApplyOffer] = useState(false);
  const exitArmedRef = useRef(false);
  const exitShownRef = useRef(false);
  const pendingNavRef = useRef<string | null>(null);
  const exitHasPlans = !!(course?.isFixedBundle && course?.pricing_options && course.pricing_options.length > 0);
  exitArmedRef.current =
    !!course && step === 'selection' && !showProfilePrompt && !isProcessing &&
    (!exitHasPlans || planConfirmed) &&
    !appliedDiscountCode && !appliedReferralCode && !discountAmount && !referralDiscount;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!exitArmedRef.current || exitShownRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(a.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      pendingNavRef.current = url.pathname + url.search + url.hash;
      exitShownRef.current = true;
      setShowExitOffer(true);
    };
    const onMouseOut = (e: MouseEvent) => {
      if (!exitArmedRef.current || exitShownRef.current) return;
      if (e.relatedTarget === null && e.clientY <= 0) {
        pendingNavRef.current = null;
        exitShownRef.current = true;
        setShowExitOffer(true);
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!exitArmedRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('mouseout', onMouseOut);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (autoApplyOffer && discountCodeInput === 'GENZ5') {
      setAutoApplyOffer(false);
      applyDiscount();
    }
  }, [autoApplyOffer, discountCodeInput]);

  // Arriving from the cart reminder (?offer=GENZ5): apply the code once the order total qualifies
  const offerFromLink = (searchParams.get('offer') || '').toUpperCase() === 'GENZ5';
  const offerAppliedRef = useRef(false);
  useEffect(() => {
    if (!offerFromLink || offerAppliedRef.current || !user || !course || showProfilePrompt || step !== 'selection') return;
    if (appliedDiscountCode || calculateTotal() <= MIN_PROMO_ORDER_AMOUNT) return;
    offerAppliedRef.current = true;
    setDiscountCodeInput('GENZ5');
    setAutoApplyOffer(true);
  }, [offerFromLink, user, course, showProfilePrompt, step, selectedCourses, selectedPricingTier, appliedDiscountCode]);

  const acceptExitOffer = () => {
    pendingNavRef.current = null;
    setShowExitOffer(false);
    setDiscountCodeInput('GENZ5');
    setAutoApplyOffer(true);
  };
  const cancelExitOffer = () => {
    const target = pendingNavRef.current;
    pendingNavRef.current = null;
    setShowExitOffer(false);
    if (target) navigate(target);
  };

  const isTierSelectionRequired = () => (
    course?.isFixedBundle && Array.isArray(course.pricing_options) && course.pricing_options.length > 0
  );

  const getSelectedPricingOption = () => {
    if (!isTierSelectionRequired()) {
      return null;
    }

    if (selectedPricingTier === null) {
      return null;
    }

    return course.pricing_options[selectedPricingTier] || null;
  };

  const calculateTotal = () => {
    if (!course) return 0;
    if (!course.isBundle) return course.discountPrice || course.price;
    
    // Multi-pricing logic for fixed bundles
    const selectedTier = getSelectedPricingOption();
    if (selectedTier) {
      return Number(selectedTier.price || 0);
    }

    // Manual-Only Logic: Always return the raw sum of selected items.
    // Price only drops if a user enters and applies a coupon code.
    return course.bundleCourses
      .filter((bc: SubCourse) => selectedCourses.includes(bc.courseId))
      .reduce((sum: number, bc: SubCourse) => sum + bc.price, 0);
  };

  const getSavings = () => {
     // Manual-Only Logic: Savings are purely from applied discount modifiers
     return (discountAmount || 0) + (referralDiscount || 0);
  };

  const getOfferShortfall = (amount: number) => Math.max(Math.ceil((MIN_PROMO_ORDER_AMOUNT + 1) - amount), 0);
  const getOfferEligibilityMessage = (amount: number) => (
    `Add ₹${getOfferShortfall(amount)} more to use discount, referral code, or coins (order must be above ₹${MIN_PROMO_ORDER_AMOUNT}).`
  );

  const applyDiscount = async () => {
    if (!discountCodeInput.trim()) return;
    if (!user) {
      openLoginModal();
      return;
    }
    setIsApplyingDiscount(true);
    setDiscountError('');
    try {
      const total = calculateTotal();
      if (total <= MIN_PROMO_ORDER_AMOUNT) {
        throw new Error(getOfferEligibilityMessage(total));
      }

      const codeToApply = discountCodeInput.trim().toUpperCase();

      // 0. Handle Special Course Bundle Code first (stored on the course record)
      if (course?.isBundle && course.bundleDiscountCode && codeToApply === course.bundleDiscountCode.toUpperCase()) {
          if (!isBundleDiscountEligible) {
            throw new Error(
              bundleDiscountMode === 'all'
                ? 'Please select ALL bundle courses to use this code.'
                : `Please select at least ${bundleDiscountRequiredCount} courses to use this code.`
            );
          }
          
          // Re-calculate raw sum (without any automatic bundle price)
          const rawTotal = course.bundleCourses
            .filter((bc: SubCourse) => selectedCourses.includes(bc.courseId))
            .reduce((sum: number, bc: SubCourse) => sum + bc.price, 0);
            
          const bundleDiscountVal = Number(course.bundleDiscountAmount || course.bundleDiscountPrice || 0);
          const calculatedDiscount = Math.min(bundleDiscountVal, rawTotal);
          
          setDiscountAmount(calculatedDiscount);
          setAppliedDiscountCode(codeToApply);
          
          // SINGLE DISCOUNT ENFORCEMENT: Clear referral if a manual coupon/bundle code is applied
          setReferralDiscount(0);
          setAppliedReferralCode(null);

          setDiscountCodeInput('');
          setShowSuccessModal(true);
          setTimeout(() => setShowSuccessModal(false), 2200);
          return;
      }

      // 1. Check if it exists in the global coupons table
      const couponResult = await apiService.validateCoupon({
        code: codeToApply,
        total,
        courseIds: selectedCourses,
        bundleId: course?.isBundle ? course.id : null,
      });

      if (couponResult.found) {
          setDiscountAmount(couponResult.discount || 0);
          setAppliedDiscountCode(couponResult.code || codeToApply);

          // SINGLE DISCOUNT ENFORCEMENT: Clear referral if a manual coupon is applied
          setReferralDiscount(0);
          setAppliedReferralCode(null);

          setDiscountCodeInput('');
          setShowSuccessModal(true);
          setTimeout(() => setShowSuccessModal(false), 2200);
          return;
      }

      // Try as Referral Code
      const result = await validateReferralCode(codeToApply);
      if (result.valid) {
          if (result.referrerEmail?.toLowerCase() === user.email?.toLowerCase()) {
              throw new Error('You cannot use your own referral code.');
          }

          const refDisc = Math.floor(total * 0.05); // 5% off
          setReferralDiscount(refDisc);
          setAppliedReferralCode(codeToApply);

          // SINGLE DISCOUNT ENFORCEMENT: Clear manual coupon/bundle discount if referral is applied
          setDiscountAmount(0);
          setAppliedDiscountCode(null);

          setDiscountCodeInput('');
          setShowSuccessModal(true);
          setTimeout(() => setShowSuccessModal(false), 2200);
          return;
      }

      throw new Error('Invalid discount or referral code.');
    } catch (err: any) {
      setDiscountError(err.message);
      setDiscountAmount(0);
      setAppliedDiscountCode(null);
      setReferralDiscount(0);
      setAppliedReferralCode(null);
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  const removeDiscount = () => {
    setAppliedDiscountCode(null);
    setDiscountAmount(0);
    setAppliedReferralCode(null);
    setReferralDiscount(0);
    setDiscountError('');
  };

  // ---- COINS ----
  const MAX_COINS_PER_ORDER = 50;
  const handleApplyCoins = () => {
    setCoinsError('');
    const total = calculateTotal();
    if (total <= MIN_PROMO_ORDER_AMOUNT) {
      setCoinsApplied(0);
      setCoinsError(getOfferEligibilityMessage(total));
      return;
    }

    const afterDiscounts = Math.max(total - discountAmount - referralDiscount, 0);
    const maxCoins = Math.min(MAX_COINS_PER_ORDER, walletBalance, afterDiscounts - 1); // max 50, actual balance, keep cart ≥ ₹1
    const applied = Math.max(maxCoins, 0);
    setCoinsToApply(applied);
    setCoinsApplied(applied);
  };

  const removeCoins = () => {
    setCoinsApplied(0);
    setCoinsToApply(0);
    setCoinsError('');
  };

  // Keep bundle discount when selection still meets minimum (N or more); recalculate savings.
  // Only clear non-bundle codes when the course selection actually changes — not when
  // the code is first applied (appliedDiscountCode is in deps, which used to wipe it instantly).
  const selectionKey = selectedCourses.slice().sort().join('|');
  const prevSelectionKeyRef = useRef(selectionKey);

  useEffect(() => {
    const selectionChanged = prevSelectionKeyRef.current !== selectionKey;
    prevSelectionKeyRef.current = selectionKey;

    if (!appliedDiscountCode || !course) return;

    const isBundleCode =
      course.isBundle &&
      course.bundleDiscountCode &&
      appliedDiscountCode.toUpperCase() === String(course.bundleDiscountCode).toUpperCase();

    if (isBundleCode) {
      const { mode, minCourses } = resolveBundleDiscountConfig(course);
      const requiredCountRaw = mode === 'any'
        ? minCourses
        : Number(course.bundleCourses?.length || 0);
      const requiredCount = Math.max(
        1,
        Math.min(requiredCountRaw, Number(course.bundleCourses?.length || requiredCountRaw || 1))
      );
      const stillEligible = selectedCourses.length >= requiredCount;

      if (!stillEligible) {
        setAppliedDiscountCode(null);
        setDiscountAmount(0);
        return;
      }

      const rawTotal = course.bundleCourses
        .filter((bc: SubCourse) => selectedCourses.includes(bc.courseId))
        .reduce((sum: number, bc: SubCourse) => sum + bc.price, 0);
      const bundleDiscountVal = Number(course.bundleDiscountAmount || course.bundleDiscountPrice || 0);
      setDiscountAmount(Math.min(bundleDiscountVal, rawTotal));
      return;
    }

    if (selectionChanged) {
      setAppliedDiscountCode(null);
      setDiscountAmount(0);
    }
  }, [selectedCourses, course, appliedDiscountCode, selectionKey]);

  useEffect(() => {
    const total = calculateTotal();
    if (total > MIN_PROMO_ORDER_AMOUNT) return;

    const message = getOfferEligibilityMessage(total);
    if (appliedDiscountCode || appliedReferralCode) {
      setAppliedDiscountCode(null);
      setDiscountAmount(0);
      setAppliedReferralCode(null);
      setReferralDiscount(0);
      setDiscountError(message);
    }

    if (coinsApplied > 0 || coinsToApply > 0) {
      setCoinsApplied(0);
      setCoinsToApply(0);
      setCoinsError(message);
    }
  }, [selectedCourses, course, selectedPricingTier]);

  const loadScript = (src: string) => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }

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

  const handlePayment = async () => {
    if (selectedCourses.length === 0) {
      alert("Please select at least one course!");
      return;
    }

    const selectedTier = getSelectedPricingOption();
    if (isTierSelectionRequired() && (!selectedTier || !Number.isFinite(Number(selectedTier.price)) || Number(selectedTier.price) <= 0)) {
      alert("Please select a valid pricing plan before enrolling.");
      return;
    }

    setPaymentError('');
    setIsProcessing(true);
    setLoadingMessage("Preparing Checkout...");
    let total = calculateTotal();

    // CRITICAL: For fixed bundles with pricing options, FORCE use of the selected pricing tier
    // This prevents fallback to individual course prices (which are 0)
    if (selectedTier) {
      total = Number(selectedTier.price);
    }

    const finalCourseIds = course?.isBundle && Array.isArray(course.bundleCourses)
      ? course.bundleCourses
          .filter((bc: any) => selectedCourses.includes(bc.courseId))
          .flatMap((bc: any) => [bc.courseId, bc.courseId2, bc.courseId3].filter(Boolean))
      : selectedCourses;

    const checkoutClassType = selectedTier?.type || course?.class_type || undefined;

    try {
      const orderData = await apiService.createOrder({
        amount: Math.max(total - discountAmount - referralDiscount - coinsApplied, 1),
        email: user?.email || '',
        courseIds: finalCourseIds,
        bundleId: course?.isBundle ? course.id : undefined,
        discountCode: appliedDiscountCode || undefined,
        referralCode: appliedReferralCode || undefined,
        coinsToApply: coinsApplied,
        selectedClassType: checkoutClassType,
        selectedPricingTierIndex: selectedPricingTier ?? undefined,
        selectedPricingTierName: selectedTier?.name || undefined,
        selectedPricingTierPrice: selectedTier ? Number(selectedTier.price) : undefined
      });
      if (!orderData.id) throw new Error("Order creation failed");
      rememberCheckout(orderData.id, courseLookupId || String(course?.id || ''), String(course?.name || ''));

      const scriptLoaded = await loadScript(RAZORPAY_SCRIPT_URL);
      if (!scriptLoaded || !(window as any).Razorpay) {
        throw new Error("Razorpay checkout could not load. Disable ad blockers and try again.");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_STOREFRONT_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: "INR",
        name: "GenZ IITIAN",
        description: course.isBundle 
          ? course.bundleCourses.filter((bc: any) => selectedCourses.includes(bc.courseId)).map((bc: any) => bc.courseName).join(', ').substring(0, 255)
          : course.name,
        notes: {
          courses: course.isBundle 
            ? course.bundleCourses.filter((bc: any) => selectedCourses.includes(bc.courseId)).map((bc: any) => bc.courseName).join(', ')
            : course.name,
          user_email: user?.email
        },
        order_id: orderData.id,
        handler: async (response: any) => {
          setIsProcessing(true);
          setLoadingMessage("Processing your payment, please wait...");
          try {
            await apiService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              email: user?.email,
              courseIds: finalCourseIds,
              discountCode: appliedDiscountCode || undefined,
              referralCode: appliedReferralCode || undefined,
              coinsToApply: coinsApplied,
              selectedClassType: checkoutClassType
            });

            const courseTitle = course.isBundle 
              ? course.bundleCourses.filter((bc: any) => selectedCourses.includes(bc.courseId)).map((bc: any) => bc.courseName).join(', ')
              : course.name;

            navigate("/payment-success", { 
              state: { 
                courseTitle,
                orderDetails: {
                  order_id: orderData.id,
                  total_amount: orderData._serverTotal || Math.max(total - discountAmount - referralDiscount - coinsApplied, 1),
                  created_at: new Date().toISOString(),
                  status: 'PAID',
                  course_ids: finalCourseIds
                }
              } 
            });
          } catch (err: any) {
            console.error("Payment verification error:", err);
            setPaymentError(err?.message || "Payment verification failed. Please try again.");
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: profileData.name,
          email: user?.email,
        },
        theme: { color: "#0b1120" },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on?.('payment.failed', (response: any) => {
        setIsProcessing(false);
        // --- LOG FRONTEND FAILURE ---
        apiService.logPaymentFailure({
          email: user?.email || '',
          order_id: orderData.id,
          failure_source: 'FRONTEND_RAZORPAY',
          courseIds: selectedCourses
        });
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

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-[3px] border-gray-200" />
            <div className="absolute inset-0 rounded-full border-[3px] border-[#0b1120] border-t-transparent animate-spin" />
          </div>
          <div>
            <p className="text-base font-semibold text-[#0b1120]">Preparing your checkout</p>
            <p className="mt-1 text-sm text-gray-500">This will only take a moment</p>
          </div>
        </div>
      </div>
    );
  }

  const isQualifier = course?.courseCategory === 'QUALIFIER';
  const hasPricingPlans = !!(course?.isFixedBundle && course?.pricing_options && course.pricing_options.length > 0);
  const goToSummary = () => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const listTotal = calculateTotal();
  const grandTotal = Math.max(
    listTotal - (discountAmount || 0) - (referralDiscount || 0) - (coinsApplied || 0),
    1
  );
  const needsCoursePick = selectedCourses.length === 0;
  const needsPlanPick = isTierSelectionRequired() && !getSelectedPricingOption();
  const enrollLabel = needsCoursePick ? 'Select a Course' : needsPlanPick ? 'Select a Plan' : 'Enroll Now';
  const onBannerEnroll = () => {
    if (needsCoursePick) {
      coursesPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (hasPricingPlans && !planConfirmed && !needsPlanPick) {
      confirmPlan();
      return;
    }
    if (needsPlanPick) {
      document.getElementById('checkout-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    handlePayment();
  };
  const selectPricingPlan = (idx: number) => {
    setSelectedPricingTier(idx);
  };
  const confirmPlan = () => {
    setPlanConfirmed(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-8 sm:pt-16 pb-28 px-4 sm:px-6 text-[#0b1120]">
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
            className="bg-white border-[4px] border-[#0b1120] rounded-2xl p-5 md:p-6 flex flex-col items-center gap-4 shadow-[8px_8px_0px_#3b82f6] max-w-sm w-full mx-6"
          >
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 border-[4px] border-blue-100 rounded-full"></div>
              <div className="absolute inset-0 border-[4px] border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-[#0b1120] mb-1 uppercase tracking-tight">Processing Payment</h3>
              <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">Please don't close this window</p>
            </div>
          </motion.div>
          </motion.div>
        )}

        {showSuccessModal && !showProfilePrompt && (
          <motion.div
            key="discount-applied"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowSuccessModal(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/35 backdrop-blur-[4px] overflow-hidden"
            role="status"
          >
            {/* party popper confetti */}
            {[...Array(36)].map((_, i) => {
              const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444'];
              const dir = i % 2 === 0 ? -1 : 1;
              const spread = 40 + ((i * 53) % 260);
              const rise = 120 + ((i * 37) % 200);
              const fall = 260 + ((i * 71) % 260);
              const size = 6 + ((i * 7) % 7);
              return (
                <motion.span
                  key={i}
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-[44%]"
                  style={{ width: size, height: size * (i % 3 === 0 ? 2.2 : 1), background: colors[i % colors.length], borderRadius: i % 4 === 0 ? 999 : 2 }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
                  animate={{ x: dir * spread, y: [0, -rise, fall], opacity: [1, 1, 0], rotate: dir * (180 + i * 40), scale: 1 }}
                  transition={{ duration: 1.7, delay: 0.1 + (i % 6) * 0.03, ease: 'easeOut', times: [0, 0.35, 1] }}
                />
              );
            })}

            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.7, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ type: 'spring', bounce: 0.35, duration: 0.6 }}
              className="relative w-full max-w-xs rounded-3xl bg-white px-8 pt-9 pb-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
            >
              <div className="relative mx-auto mb-5 w-16 h-16">
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-emerald-400/40"
                  initial={{ scale: 1, opacity: 0.7 }}
                  animate={{ scale: 1.9, opacity: 0 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', bounce: 0.5, duration: 0.7, delay: 0.1 }}
                  className="relative w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_12px_30px_-6px_rgba(16,185,129,0.6)]"
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <motion.path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.45, delay: 0.3, ease: 'easeOut' }}
                    />
                  </svg>
                </motion.div>
              </div>
              <h4 className="text-xl font-bold tracking-tight text-[#0b1120]">Discount applied</h4>
              <p className="mt-1 text-sm text-gray-500">Your savings are locked in.</p>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="mt-6 w-full rounded-full bg-[#0b1120] py-3 text-sm font-semibold text-white hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
              >
                Okay
              </button>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      <div className="max-w-6xl mx-auto">
        <div className="mb-6 md:mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 tracking-[-0.025em] text-[#1d1d1f]">Complete <span className="text-blue-600">Enrollment</span></h1>
            <p className="text-sm text-gray-500 mx-auto max-w-md sm:max-w-none px-2 sm:px-0 leading-snug">You&apos;re just one step away from joining {course.name}. Follow the steps below.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-7">
            <button
              onClick={() => { setStep('profile'); setShowProfilePrompt(false); }}
              className={`flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2.5 md:py-3 rounded-xl md:rounded-2xl border text-xs md:text-sm font-semibold whitespace-nowrap transition-all w-full active:scale-[0.98] cursor-pointer ${step === 'profile' ? 'bg-[#0b1120] border-[#0b1120] text-white shadow-lg shadow-black/10' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}
            >
                <User className="w-4 h-4" />
                <span>Step 1: Profile</span>
            </button>
            <button
              disabled={!profileData.name || !profileData.gender || !profileData.phone}
              onClick={() => setStep('selection')}
              className={`flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2.5 md:py-3 rounded-xl md:rounded-2xl border text-xs md:text-sm font-semibold whitespace-nowrap transition-all w-full active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${step === 'selection' ? 'bg-[#0b1120] border-[#0b1120] text-white shadow-lg shadow-black/10' : 'bg-white border-black/10 text-gray-500 hover:bg-gray-50'}`}
            >
                <BookOpen className="w-4 h-4" />
                <span>Step 2: Checkout</span>
            </button>
            <div className="col-span-2 md:col-span-2 md:bg-white md:border md:border-black/10 md:rounded-2xl px-3 py-0.5 md:py-3 flex items-center justify-center">
                <div className="flex items-center gap-1.5 md:gap-2 text-gray-400 md:text-gray-500 font-medium text-xs md:text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Secure checkout by Razorpay
                </div>
            </div>
        </div>

      <AnimatePresence>
        {showProfilePrompt && (
          <motion.div
            key="profile-prompt-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
              className="w-full max-w-lg bg-white rounded-3xl p-8 sm:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.35)] text-center relative"
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.35, duration: 0.6, delay: 0.1 }}
                className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5"
              >
                <UserCheck className="w-7 h-7 text-emerald-600" />
              </motion.div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-[#1d1d1f] mb-2">Welcome back</h2>
              <p className="text-base md:text-lg text-gray-500 mb-8 leading-relaxed">
                Continue as <span className="font-semibold text-[#0b1120]">{profileData.name}</span>
                <span className="block text-sm text-gray-400 mt-0.5">{profileData.phone}</span>
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowProfilePrompt(false)}
                  className="flex-1 max-w-[260px] py-3.5 bg-[#0b1120] text-white rounded-full font-semibold text-sm md:text-base hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
                >
                  Yes, Continue
                </button>
                <button
                  onClick={() => { setShowProfilePrompt(false); setStep('profile'); }}
                  className="px-8 py-3.5 bg-white text-[#0b1120] rounded-full font-semibold text-sm md:text-base border border-black/15 hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
                >
                  No
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 'profile' ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto bg-white border-[3px] md:border-[4px] border-[#0b1120] rounded-2xl p-4 sm:p-6 lg:p-10 shadow-[8px_8px_0px_#10b981]"
            >
              <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-6">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center border-2 border-[#0b1120]">
                    <UserCheck className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                </div>
                <div>
                    <h2 className="text-base md:text-xl font-black text-[#0b1120]">Complete Your Profile</h2>
                    <p className="font-bold text-gray-500 text-[11px] md:text-xs">We need these details for your Registration</p>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                  <div>
                    <label className="block text-[10px] md:text-[12px] font-black text-[#0b1120] uppercase mb-1 md:mb-1.5">Your Full Name</label>
                    <input 
                      required
                      maxLength={20}
                      value={profileData.name}
                      onChange={e => {
                        const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                        setProfileData({...profileData, name: val});
                      }}
                      placeholder="Enter your name"
                      className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-gray-50 border-[2.5px] md:border-[3px] border-[#0b1120] rounded-xl font-black text-sm md:text-base focus:bg-white focus:shadow-[4px_4px_0px_#3b82f6] transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] md:text-[12px] font-black text-[#0b1120] uppercase mb-1 md:mb-1.5">Phone Number (WhatsApp)</label>
                    <input 
                      required
                      type="tel"
                      maxLength={10}
                      value={profileData.phone}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setProfileData({...profileData, phone: val});
                      }}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-gray-50 border-[2.5px] md:border-[3px] border-[#0b1120] rounded-xl font-black text-sm md:text-base focus:bg-white focus:shadow-[4px_4px_0px_#3b82f6] transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] md:text-[12px] font-black text-[#0b1120] uppercase mb-1 md:mb-1.5">Gender</label>
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    {['MALE', 'FEMALE'].map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setProfileData({...profileData, gender: g})}
                        className={`py-2 md:py-2.5 rounded-xl border-[2.5px] md:border-[3px] font-black text-sm md:text-base transition-all ${profileData.gender === g ? 'bg-[#0b1120] text-white border-[#0b1120] shadow-[2px_2px_0px_#3b82f6] md:shadow-[3px_3px_0px_#3b82f6]' : 'bg-white text-[#0b1120] border-gray-100 hover:border-[#0b1120]'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="flex items-start gap-1.5 text-[11px] md:text-xs text-gray-500 leading-snug">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />
                    <span>Course access will be granted to <span className="font-semibold text-[#0b1120] break-all">{user?.email}</span>. Please ensure this is correct.</span>
                </p>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-2.5 md:py-3.5 bg-[#0b1120] text-white rounded-xl font-black text-sm md:text-lg border-2 border-[#0b1120] shadow-[4px_4px_0px_#3b82f6] md:shadow-[5px_5px_0px_#3b82f6] hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin w-4 h-4 md:w-5 md:h-5" /> : <>Continue to Payment <ArrowRight className="w-4 h-4 md:w-5 md:h-5" /></>}
                </button>
                <p className="mt-2 md:mt-4 text-center text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                  By continuing, you agree to the <Link to="/terms" className="underline hover:text-blue-600 transition-colors">Terms & Conditions</Link> and <Link to="/refund" className="underline hover:text-blue-600 transition-colors">Refund Policy</Link>.
                </p>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="selection"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {course.isBundle && hasBundleDiscount && (
                  <div className={`p-3 md:p-5 rounded-3xl border-[4px] transition-all duration-500 shadow-[8px_8px_0px_#0b1120] ${isBundleDiscountEligible ? 'bg-green-50 border-[#10b981]' : 'bg-blue-50 border-[#0b1120]'}`}>
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                              <div className={`w-14 h-14 rounded-2xl border-2 border-[#0b1120] flex items-center justify-center shadow-[4px_4px_0px_#0b1120] ${isBundleDiscountEligible ? 'bg-[#10b981]' : 'bg-white'}`}>
                                  <Star className={`w-7 h-7 ${isBundleDiscountEligible ? 'text-white' : 'text-blue-500'}`} fill={isBundleDiscountEligible ? 'white' : 'transparent'} strokeWidth={3} />
                              </div>
                              <div>
                                  <div className="font-black text-xl md:text-2xl text-[#0b1120] uppercase tracking-tight leading-tight">
                                      {isBundleDiscountEligible 
                                          ? "🎉 Bundle Discount Unlocked!" 
                                          : (bundleDiscountMode === 'all'
                                              ? `Select All ${course.bundleCourses.length} Courses to Save ₹${bundleDiscountVal}`
                                              : `Select at least ${bundleDiscountRequiredCount} Courses to Save ₹${bundleDiscountVal}`
                                            )
                                      }
                                  </div>
                                  <div className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-[0.05em] mt-2 flex flex-wrap items-center gap-2 leading-relaxed">
                                      {isBundleDiscountEligible ? (
                                        <>
                                          Use code 
                                          <span className="bg-yellow-300 text-[#0b1120] px-2 py-0.5 rounded-lg border-[2px] border-[#0b1120] font-black shadow-[2px_2px_0px_#0b1120] inline-block -rotate-1 transform">
                                            {course.bundleDiscountCode}
                                          </span>
                                          to get ₹{bundleDiscountPreviewSavings} off or tap to Apply
                                        </>
                                      ) : (
                                        bundleDiscountMode === 'all'
                                          ? 'Select all courses to unlock the bundle discount.'
                                          : `Select at least ${bundleDiscountRequiredCount} courses to unlock this code.`
                                      )}
                                  </div>
                              </div>
                          </div>

                          {isBundleDiscountEligible ? (
                              <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                                  <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(course.bundleDiscountCode);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                      }}
                                      className="group relative w-full md:w-auto flex flex-col items-center gap-1.5"
                                  >
                                      <div className="w-full md:w-auto px-5 py-3 bg-white border-[3px] border-[#0b1120] rounded-xl flex items-center justify-center gap-3 font-black text-base md:text-lg text-[#0b1120] uppercase tracking-wider shadow-[4px_4px_0px_#0b1120] hover:translate-y-0.5 hover:shadow-none transition-all active:bg-gray-100">
                                          {course.bundleDiscountCode}
                                          {copied ? <CheckCheck className="w-5 h-5 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />}
                                      </div>
                                      <span className={`text-[8px] font-black uppercase tracking-widest transition-all ${copied ? 'text-green-600' : 'text-gray-400 opacity-60'}`}>
                                          {copied ? 'Copied!' : 'Tap to Copy'}
                                      </span>
                                  </button>

                                  {!appliedDiscountCode && (
                                      <button 
                                          onClick={() => {
                                              setDiscountCodeInput(course.bundleDiscountCode);
                                              setTimeout(() => applyDiscount(), 100);
                                          }}
                                          className="w-full md:w-auto px-8 py-4 bg-[#0b1120] text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-[6px_6px_0px_#3b82f6] hover:translate-y-1 hover:shadow-none active:translate-y-1 active:shadow-none"
                                      >
                                          Apply Now
                                      </button>
                                  )}
                              </div>
                          ) : (
                              <div className="w-full md:w-64 bg-white border-[3px] border-[#0b1120] rounded-full h-5 overflow-hidden shadow-[4px_4px_0px_#0b1120]">
                                  <motion.div 
                                      initial={{ width: 0 }}
                                  animate={{ width: `${bundleSelectionProgress}%` }}
                                      className="h-full bg-blue-500 transition-all duration-700"
                                  />
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {hasPricingPlans && !planConfirmed && (
                <div id="checkout-plans" className="space-y-4 mb-8 scroll-mt-24">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#0b1120] rounded-xl flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#0b1120]">Select your plan</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Pick a plan to continue to checkout</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                    {course.pricing_options.map((opt: any, idx: number) => {
                      const selected = selectedPricingTier === idx;
                      const plan = isQualifier ? getQualifierPlan(opt) : null;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectPricingPlan(idx)}
                          className={`relative p-5 md:p-6 rounded-3xl border transition-all duration-300 text-left flex flex-col gap-3 hover:-translate-y-1 active:scale-[0.99] cursor-pointer ${
                            selected
                              ? 'bg-[#0b1120] border-[#0b1120] text-white shadow-[0_20px_40px_-12px_rgba(11,17,32,0.5)]'
                              : 'bg-white border-black/10 hover:border-black/20 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] text-[#0b1120]'
                          }`}
                        >
                          {opt.tag && (
                            <div className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider w-fit border ${
                              selected ? 'bg-white/20 border-white text-white' : 'bg-blue-50 border-blue-100 text-blue-600'
                            }`}>
                              {opt.tag}
                            </div>
                          )}

                          <div className="flex items-baseline justify-between gap-2 pr-7">
                            <div className="text-lg md:text-xl font-semibold leading-tight tracking-tight">{opt.name}</div>
                            <div className={`text-xl md:text-2xl font-bold shrink-0 ${selected ? 'text-white' : 'text-[#0b1120]'}`}>₹{opt.price}</div>
                          </div>

                          {plan ? (
                            <div className="space-y-2.5">
                              {plan.highlight && (
                                <div className={`text-xs font-black uppercase tracking-tight ${selected ? 'text-green-200' : 'text-[#10b981]'}`}>{plan.highlight}</div>
                              )}
                              <div className={`h-px w-full ${selected ? 'bg-white/25' : 'bg-gray-100'}`} />
                              <div className={`text-[11px] font-black uppercase tracking-tight ${selected ? 'text-white/80' : 'text-gray-500'}`}>
                                Subjects: <span className={selected ? 'text-white' : 'text-[#0b1120]'}>{plan.subjects}</span>
                              </div>
                              <ul className="space-y-1.5">
                                {plan.items.map((f) => (
                                  <li key={f} className="flex items-start gap-2">
                                    <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${selected ? 'text-white' : 'text-[#10b981]'}`} strokeWidth={3} />
                                    <span className={`text-[11.5px] font-bold leading-snug ${selected ? 'text-white/95' : 'text-gray-700'}`}>{f}</span>
                                  </li>
                                ))}
                              </ul>
                              {plan.footnote && (
                                <div className={`text-[10px] font-bold italic ${selected ? 'text-white/70' : 'text-gray-400'}`}>{plan.footnote}</div>
                              )}
                            </div>
                          ) : (
                            opt.description && (
                              <p className={`text-xs font-bold leading-relaxed ${selected ? 'text-white/90' : 'text-gray-500'}`}>{opt.description}</p>
                            )
                          )}

                          {selected && (
                            <div className="absolute top-4 right-4 bg-white rounded-full p-1">
                              <Check className="w-4 h-4 text-blue-600" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {!isQualifier && selectedPricingTier !== null && course.pricing_options[selectedPricingTier]?.description && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                      <p className="text-sm font-bold text-gray-700 leading-relaxed">
                        {course.pricing_options[selectedPricingTier].description}
                      </p>
                    </div>
                  )}

                  {selectedPricingTier !== null && course.pricing_options?.[selectedPricingTier]?.banner_text && (
                    <div className="mt-5 p-4 md:p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3.5">
                      <div className="shrink-0 w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Star className="w-5 h-5 text-amber-500 fill-amber-500" strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-black text-[#0b1120] uppercase tracking-tight leading-relaxed">
                          {course.pricing_options[selectedPricingTier].banner_text}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedPricingTier === null && (
                    <div className="text-center py-2 text-sm text-gray-400">
                      Select a plan above to continue
                    </div>
                  )}
                </div>
              )}

              {(!hasPricingPlans || planConfirmed) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div ref={coursesPickerRef} className="lg:col-span-7 space-y-6 scroll-mt-24">
                  <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
                      <h2 className="text-lg font-semibold tracking-tight text-[#0b1120] mb-4">{!course.isBundle || course.isFixedBundle ? 'Course Package' : 'Select Your Courses'}</h2>
                    
                    {!course.isBundle || course.isFixedBundle ? (
                        <div className="p-3.5 bg-slate-50 border border-black/5 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 bg-[#0b1120] rounded-full flex items-center justify-center text-white">
                                    <Check className="w-4 h-4" />
                                </div>
                                <span className="font-semibold text-base text-[#0b1120]">{course.name}</span>
                            </div>
                            <span className="font-bold text-lg text-emerald-600">
                              {isTierSelectionRequired() && !getSelectedPricingOption()
                                ? '—'
                                : `₹${calculateTotal()}`}
                            </span>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {course.bundleCourses.map((bc: SubCourse) => (
                                <button
                                    key={bc.courseId}
                                    onClick={() => toggleCourse(bc.courseId)}
                                    className={`w-full p-3 text-left border rounded-2xl flex items-center justify-between transition-all ${selectedCourses.includes(bc.courseId) ? 'bg-slate-50 border-[#0b1120]' : 'bg-white border-black/10 hover:border-black/20'}`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedCourses.includes(bc.courseId) ? 'bg-[#0b1120] border-[#0b1120] text-white' : 'bg-white border-gray-300'}`}>
                                            {selectedCourses.includes(bc.courseId) && <Check className="w-3.5 h-3.5" />}
                                        </div>
                                        <div>
                                            <div className="font-black text-sm text-[#0b1120]">{bc.courseName}</div>
                                        </div>
                                    </div>
                                    <span className="font-black text-base text-[#0b1120]">₹{bc.price}</span>
                                </button>
                            ))}


                        </div>
                    )}
                </div>
                {hasPricingPlans && planConfirmed && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-100 border border-gray-200 px-4 py-3.5">
                    <div className="min-w-0 text-sm">
                      <span className="text-gray-500">Selected plan: </span>
                      <span className="font-semibold text-[#0b1120]">{getSelectedPricingOption()?.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPlanConfirmed(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      Change plan
                    </button>
                  </div>
                )}
              </div>

              <div ref={summaryRef} className="lg:col-span-5 scroll-mt-24">
                <div className="bg-white border border-black/5 rounded-3xl p-5 md:p-6 shadow-[0_8px_40px_rgba(0,0,0,0.07)] sticky top-24">
                    <h3 className="text-base md:text-lg font-semibold tracking-tight text-[#0b1120] mb-3 md:mb-4 border-b border-gray-100 pb-3">Enrollment summary</h3>
                    
                    <div className="space-y-3 mb-6">
                        {course.isBundle && (
                            <div className="space-y-3">
                                {/* Summary List */}
                                <div className="space-y-1.5 pt-2">
                                    {course.bundleCourses.filter((bc: SubCourse) => selectedCourses.includes(bc.courseId)).map((bc: SubCourse) => (
                                        <div key={bc.courseId} className="flex justify-between font-medium text-[#0b1120] text-sm">
                                            <span>{bc.courseName}</span>
                                            {!course.isFixedBundle && <span>₹{bc.price}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Discount Applier */}
                        <div className="py-2 border-t border-b border-gray-100 my-4">
                          {!appliedDiscountCode && !appliedReferralCode ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  placeholder="Discount or Referral Code" 
                                  value={discountCodeInput}
                                  onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                                  className="flex-grow px-3 py-2 bg-gray-50 border-[2px] border-gray-200 rounded-lg font-black text-sm outline-none focus:border-[#10b981] uppercase placeholder:normal-case"
                                />
                                <button 
                                  onClick={applyDiscount}
                                  disabled={isApplyingDiscount || !discountCodeInput.trim()}
                                  className="px-4 py-2 bg-[#0b1120] text-white rounded-lg font-black text-xs hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                  {isApplyingDiscount ? 'WAIT...' : 'APPLY'}
                                </button>
                              </div>
                        {discountError && <p className="text-red-500 font-bold text-[10px] uppercase">{discountError}</p>}
                      </div>
                    ) : (
                            <div className="p-3 bg-green-50 border-2 border-green-200 rounded-lg flex items-center justify-between">
                              <div>
                                <div className="text-[10px] font-black text-green-600 uppercase">Discount Applied!</div>
                                <div className="text-sm font-black text-[#0b1120] font-mono tracking-widest">{appliedDiscountCode || appliedReferralCode}</div>
                              </div>
                              <button onClick={removeDiscount} className="text-[10px] font-black text-red-500 hover:underline uppercase">Remove</button>
                            </div>
                          )}
                        </div>

                        {paymentError && (
                          <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg my-4">
                            <p className="text-red-600 font-bold text-[10px] uppercase leading-relaxed">{paymentError}</p>
                          </div>
                        )}

                        {/* ---- WALLET / COINS ---- */}
                        {user && walletBalance > 0 && (
                          <div className="py-2 border-b border-gray-100 mb-4">
                            {coinsApplied === 0 ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs md:text-sm font-black text-[#0b1120]">
                                  Wallet - ₹{walletBalance}
                                </span>
                                <button
                                  type="button"
                                  onClick={handleApplyCoins}
                                  className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg font-black text-[11px] md:text-xs hover:bg-amber-600 transition-colors"
                                >
                                  Use balance
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs md:text-sm font-black text-[#0b1120]">
                                  Wallet - ₹{coinsApplied} used
                                </span>
                                <button type="button" onClick={removeCoins} className="text-[10px] font-black text-red-500 hover:underline uppercase">Remove</button>
                              </div>
                            )}
                            {coinsError && <p className="text-red-500 font-bold text-[10px] uppercase mt-1.5">{coinsError}</p>}
                          </div>
                        )}

                        {(appliedDiscountCode || appliedReferralCode) && (
                          <div className="flex justify-between font-black text-[#0b1120] text-sm mb-2">
                            <span className="uppercase tracking-tight text-gray-400 text-[11px]">Applied Discount</span>
                            <span className="text-green-600">-₹{discountAmount + referralDiscount}</span>
                          </div>
                        )}
                        
                        {coinsApplied > 0 && (
                          <div className="flex justify-between font-black text-[#0b1120] text-sm mb-2">
                            <span className="uppercase tracking-tight text-gray-400 text-[11px]">Coins Used</span>
                            <span className="text-amber-500">-₹{coinsApplied}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-[11px] font-black uppercase text-gray-400 mb-0.5 tracking-widest">Grand Total</div>
                                <div className="flex items-end gap-2">
                                    <div className="text-2xl font-black text-[#0b1120]">
                                      ₹{Math.max(
                                        calculateTotal() - (discountAmount || 0) - (referralDiscount || 0) - (coinsApplied || 0),
                                        1
                                      )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        ref={enrollCtaRef}
                        onClick={handlePayment}
                        disabled={isProcessing || selectedCourses.length === 0 || (isTierSelectionRequired() && !getSelectedPricingOption())}
                        className="w-full py-3.5 bg-[#10b981] text-[#0b1120] rounded-xl font-black text-lg border-[3px] border-[#0b1120] shadow-[5px_5px_0px_#0b1120] hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:grayscale"
                    >
                        {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : (
                          selectedCourses.length === 0
                            ? "Select a Course"
                            : (isTierSelectionRequired() && !getSelectedPricingOption())
                              ? "Select a Plan"
                              : <>Enroll Now <ArrowRight className="w-5 h-5" /></>
                        )}
                    </button>

                    <p className="mt-6 text-center text-[8px] font-black text-gray-400 uppercase tracking-widest leading-relaxed">
                        Access will be granted immediately <br /> after successful payment verification.
                    </p>
                </div>
              </div>
            </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

        {/* Why Gen-Z IITian? Section */}
        <div className="mt-32 mb-12">
            <div className="text-center mb-10">
                <h2 className="text-4xl md:text-5xl font-black text-[#0b1120] mb-4 tracking-tight">Why Gen-Z IITian?</h2>
                <p className="text-lg md:text-xl text-gray-500 font-bold max-w-3xl mx-auto px-4 leading-relaxed">
                    Most students fail the Qualifier not because they lack intelligence — but because they <span className="text-red-500 underline decoration-[3px]">lack structure.</span>
                </p>
            </div>

            <div className="bg-white border-[4px] border-[#0b1120] rounded-[2.5rem] p-6 md:p-10 shadow-[15px_15px_0px_#0b1120] grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
                    {[
                        { title: "Academic Structure", desc: "Meticulously designed roadmap for consistent progress." },
                        { title: "Expert Strategy", desc: "Direct guidance from those who've cracked it." },
                        { title: "Real-Time Support", desc: "Live doubt clearing and progress monitoring." },
                        { title: "Mock Practice", desc: "High-yield PYQ analysis and exam-style simulator." }
                    ].map((item, idx) => (
                        <div key={idx} className="flex gap-4 items-start group">
                            <div className="shrink-0 w-10 h-10 bg-green-50 border-[2px] border-[#0b1120] rounded-xl flex items-center justify-center shadow-[3px_3px_0px_#0b1120] group-hover:-translate-y-1 transition-transform">
                                <CheckCircle2 className="w-5 h-5 text-[#10b981]" strokeWidth={3} />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-[#0b1120] tracking-tight">{item.title}</h4>
                                <p className="text-[10px] text-gray-500 font-bold mt-0.5 uppercase tracking-tighter leading-tight">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="lg:col-span-1 relative group">
                    <div className="absolute -inset-2 bg-blue-50 rounded-3xl -rotate-1 group-hover:rotate-0 transition-transform -z-10 border-2 border-[#0b1120]" />
                    <div className="bg-blue-600 border-[4px] border-[#0b1120] rounded-3xl p-6 md:p-8 shadow-[10px_10px_0px_#0b1120] relative overflow-hidden">
                        <Quote className="absolute -top-2 -left-2 w-16 h-16 text-white/10 -rotate-12" />
                        <p className="text-sm md:text-base font-black text-white italic leading-snug relative z-10">
                            "Gen-Z IITian bridges the gap between self-study and success. We prepare you for the challenge of being an IITian."
                        </p>
                        <div className="mt-4 flex items-center gap-3 relative z-10">
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-400" />
                            <div>
                                <div className="text-white font-black text-xs tracking-tight">Founder Team</div>
                                <div className="text-blue-200 font-bold text-[8px] uppercase tracking-widest">IIT Madras Mentors</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <AnimatePresence>
        {showExitOffer && (
          <motion.div
            key="exit-offer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[260] flex items-center justify-center p-5 bg-black/45 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            onClick={() => { pendingNavRef.current = null; setShowExitOffer(false); }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.88, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: 'spring', bounce: 0.25, duration: 0.55 }}
              className="relative w-full max-w-sm rounded-3xl bg-white p-7 sm:p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.4)]"
            >
              <motion.div
                animate={{ rotate: [0, -6, 6, -4, 4, 0] }}
                transition={{ duration: 1.2, delay: 0.4, repeat: Infinity, repeatDelay: 2.5 }}
                className="mx-auto mb-5 inline-flex flex-col items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_40px_-8px_rgba(16,185,129,0.6)]"
              >
                <span className="text-3xl font-bold leading-none">5%</span>
                <span className="mt-1 text-xs font-semibold tracking-widest">OFF</span>
              </motion.div>
              <h3 className="text-2xl font-bold tracking-tight text-[#0b1120]">You have 5% off</h3>
              <p className="mt-1.5 text-gray-500">Don&apos;t lose this offer. Apply code <span className="font-semibold text-[#0b1120]">GENZ5</span> before you go.</p>
              <div className="mt-7 flex flex-col-reverse sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={cancelExitOffer}
                  className="flex-1 rounded-full border border-black/15 bg-white py-3 text-sm font-semibold text-[#0b1120] hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={acceptExitOffer}
                  className="flex-1 rounded-full bg-emerald-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.97] transition-all cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasPricingPlans && !planConfirmed && step === 'selection' && !showProfilePrompt && selectedPricingTier !== null && (
          <motion.div
            key="plan-continue-bar"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
            className="fixed inset-x-0 bottom-0 z-[120] border-t border-black/10 bg-white/90 backdrop-blur-xl px-4 md:px-8 pt-3 md:pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto flex max-w-6xl items-center gap-4 md:gap-6 md:py-1">
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs md:text-sm text-gray-500">{getSelectedPricingOption()?.name} plan</div>
                <div className="text-lg md:text-3xl font-bold tracking-tight text-[#0b1120]">₹{getSelectedPricingOption()?.price}</div>
              </div>
              <button
                type="button"
                onClick={confirmPlan}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 md:px-12 md:py-4 text-sm md:text-lg font-semibold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.97] transition-all cursor-pointer"
              >
                Continue to Checkout <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasPricingPlans && planConfirmed && step === 'selection' && !showProfilePrompt && (
          <motion.div
            key="plan-pay-bar"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
            className="fixed inset-x-0 bottom-0 z-[120] border-t border-black/10 bg-white/90 backdrop-blur-xl px-4 md:px-8 pt-3 md:pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto flex max-w-6xl items-center gap-4 md:gap-6 md:py-1">
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs md:text-sm text-gray-500">{getSelectedPricingOption()?.name} plan · total</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg md:text-3xl font-bold tracking-tight text-[#0b1120]">₹{grandTotal}</span>
                  {listTotal > grandTotal && <span className="text-xs text-gray-400 line-through">₹{listTotal}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={onBannerEnroll}
                disabled={isProcessing}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-7 py-3 md:px-14 md:py-4 text-sm md:text-lg font-semibold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.97] disabled:opacity-60 transition-all cursor-pointer"
              >
                {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <>{enrollLabel} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 'selection' && !showProfilePrompt && !hasPricingPlans && (
        <StickyEnrollBanner
          courseName={course.name}
          price={grandTotal}
          originalPrice={listTotal > grandTotal ? listTotal : null}
          watchRef={enrollCtaRef}
          watchKey={`${selectedCourses.join(',')}:${selectedPricingTier ?? 'none'}`}
          onClick={onBannerEnroll}
          label={enrollLabel}
          busy={isProcessing}
        />
      )}
    </div>
  );
}
