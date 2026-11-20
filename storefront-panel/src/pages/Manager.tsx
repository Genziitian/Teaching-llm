import { useAuth } from '../context/AuthContext';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, ShoppingBag, ScrollText, BookOpen, Plus, Search, Trash2, Edit, Save, X, Loader2, AlertCircle, User, Download, TrendingUp, TrendingDown, Users, ShieldCheck, CreditCard, RefreshCw, Gift, ArrowRight, Copy, Coins, Eye, Settings, ClipboardList, Boxes, ArrowLeft, Calendar, IndianRupee, UserX, ChevronDown, Briefcase, EyeOff, Palette, HelpCircle, MessageSquare, BookMarked, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation, useSearchParams, NavLink } from 'react-router-dom';
import { apiService } from '../lib/api';
import BlogsManager from '../components/manager/BlogsManager';
import FaqsManager from '../components/manager/FaqsManager';
import ReviewsManager from '../components/manager/ReviewsManager';
import BookletsManager from '../components/manager/BookletsManager';
import EmployeesManager from '../components/manager/EmployeesManager';
import OneOnOneBookingsManager from '../components/manager/OneOnOneBookingsManager';
import JobApplicationsManager from '../components/manager/JobApplicationsManager';
import FollowUpsManager from '../components/manager/FollowUpsManager';
import UsersManager, { RoleBadges, waNumber } from '../components/manager/UsersManager';
import ManagerFullPageSheet from '../components/manager/ManagerFullPageSheet';
import { ConfirmDialog, BusyModal, type ConfirmOptions } from '../components/manager/ConfirmDialog';
import ErrorBoundary from '../components/ErrorBoundary';
import { getYouTubeId } from '../utils/youtube';
import { resolveBundleDiscountConfig } from '../utils/bundleDiscount';
import {
  COURSE_PAGE_SETTINGS_KEY,
  DEFAULT_FEEDBACK_BANK,
  parseCoursePageSettings,
  type CoursePageSettings,
  type CoursePageTheme,
  type FeedbackNote,
} from '../data/coursePage';


type Tab = 'users' | 'courses' | 'boxes' | 'discounts' | 'payments' | 'followups' | 'catalog' | 'referrals' | 'blogs' | 'settings' | 'employees' | '1on1' | 'applications' | 'faqs' | 'reviews' | 'booklets';
type CourseTerm = 'Re-attempt' | 'Foundation' | 'DIPLOMA' | 'Qualifier';

const TERM_OPTIONS: CourseTerm[] = ['Qualifier', 'Re-attempt', 'Foundation', 'DIPLOMA'];
const DEFAULT_BOX_CONFIG: Record<CourseTerm, string[]> = {
  Qualifier: ['Qualifier'],
  'Re-attempt': ['Re-attempt'],
  Foundation: ['Quiz 1', 'Quiz 2', 'End Term', 'Full Term'],
  DIPLOMA: ['Quiz 1', 'Quiz 2', 'End Term', 'Full Term']
};

function getBundleDiscountConfig(course: any): { mode: 'all' | 'any'; minCourses: 1 | 2 | 3 | 5 } {
  return resolveBundleDiscountConfig(course);
}

function sanitizeCourseId(value: string) {
  if (!value || typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function Manager() {
  const { isManager, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const embed = searchParams.get('embed') === '1';

  // Derive active tab from URL path (handles trailing slashes cleanly)
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const rawTab = pathSegments[pathSegments.length - 1];
  const activeTab = (rawTab && rawTab !== 'manager' ? rawTab : 'users') as Tab;
  
  // Validate tab - if path is just /manager, it's users. If invalid, could redirect.
  const validTabs: Tab[] = ['users', '1on1', 'applications', 'courses', 'boxes', 'discounts', 'payments', 'followups', 'referrals', 'blogs', 'faqs', 'reviews', 'booklets', 'settings', 'employees'];
  const effectiveTab = validTabs.includes(activeTab) ? activeTab : 'users';
  const [data, setData] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'yesterday' | 'custom' | '7days' | 'month' | 'not-purchased' | 'abandoned' | 'no-number' | 'all'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentSearchInput, setPaymentSearchInput] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmOptions | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const askConfirm = (opts: ConfirmOptions) => setConfirmDialog(opts);
  const withBusy = async (message: string, fn: () => Promise<unknown>) => {
    setBusyMessage(message);
    try { await fn(); } finally { setBusyMessage(null); }
  };
  const [isFetching, setIsFetching] = useState(false);
  const [showEarned, setShowEarned] = useState(false);
  const [showPotential, setShowPotential] = useState(false);
  const loadedTabRef = useRef<string | null>(null);
  const fetchSeqRef = useRef(0);
  const [userSearch, setUserSearch] = useState('');
  const [paymentStats, setPaymentStats] = useState({
    totalEarned: 0,
    totalUsers: 0,
    abandonedCount: 0,
    potentialMoney: 0,
  });
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [isBundle, setIsBundle] = useState(false);
  const [bundleCourses, setBundleCourses] = useState<{courseId: string, courseId2?: string, courseId3?: string, courseName: string, price: number}[]>([]);
  const [bundleDiscountPrice, setBundleDiscountPrice] = useState<number | ''>('');
  const [bundleDiscountCode, setBundleDiscountCode] = useState('');
  const [bundleDiscountMode, setBundleDiscountMode] = useState<'all' | 'any'>('all');
  const [bundleDiscountMinCourses, setBundleDiscountMinCourses] = useState<1 | 2 | 3 | 5>(3);
  const [isFixedBundle, setIsFixedBundle] = useState(false);
  const [pricingOptions, setPricingOptions] = useState<{name: string, price: number, type: 'live' | 'recorded', tag?: string, description?: string, banner_text?: string}[]>([]);
  const [courseTags, setCourseTags] = useState<string[]>([]);
  const [courseCategory, setCourseCategory] = useState<'QUALIFIER' | 'LIVE' | 'RECORDED' | 'NONE'>('NONE');
  const [courseTerm, setCourseTerm] = useState<CourseTerm | 'NONE'>('NONE');
  const [courseFoundationTerm, setCourseFoundationTerm] = useState<'Term 1' | 'Term 2' | 'BOTH'>('Term 1');
  const [selectedExamStages, setSelectedExamStages] = useState<string[]>([]);
  const [boxConfig, setBoxConfig] = useState<Record<CourseTerm, string[]>>(DEFAULT_BOX_CONFIG);
  const [feedbackBank, setFeedbackBank] = useState<FeedbackNote[]>(DEFAULT_FEEDBACK_BANK);
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>(DEFAULT_FEEDBACK_BANK.slice(0, 3).map((note) => note.id));
  const [accessVideoUrl, setAccessVideoUrl] = useState('');
  const [coursePageTheme, setCoursePageTheme] = useState<CoursePageTheme>('old');
  const [draftReview, setDraftReview] = useState({ name: '', role: '', text: '' });

  // Discount Coupons state
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [discountOptions, setDiscountOptions] = useState<any[]>([]); // To hold courses
  const [courseCatalog, setCourseCatalog] = useState<any[]>([]); // New state for full course ID -> Name mapping
  const [catalogSearch, setCatalogSearch] = useState('');
  const [editingDiscount, setEditingDiscount] = useState<any>(null);
  const [discountType, setDiscountType] = useState<'all' | 'specific'>('all');
  const [discountEmails, setDiscountEmails] = useState('');
  const [discountValueType, setDiscountValueType] = useState<'percentage' | 'amount'>('percentage');
  const [couponFirstPurchaseOnly, setCouponFirstPurchaseOnly] = useState(false);
  const [couponSingleUsePerUser, setCouponSingleUsePerUser] = useState(true);
  const [couponHidden, setCouponHidden] = useState(false);
  const [couponActive, setCouponActive] = useState(true);
  const discountOptionMap = new Map(discountOptions.map(option => [option.id, option]));

  // User Detail View state
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUserOrders, setSelectedUserOrders] = useState<any[]>([]);
  const [selectedUserReferrals, setSelectedUserReferrals] = useState<any[]>([]);
  const [selectedUserWallet, setSelectedUserWallet] = useState<any>(null);
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(false);

  useEffect(() => {
    if (editingDiscount) {
      setDiscountValueType(editingDiscount.discount_amount ? 'amount' : 'percentage');
      setCouponFirstPurchaseOnly(Boolean(editingDiscount.first_purchase_only));
      setCouponSingleUsePerUser(editingDiscount.single_use_per_user !== false);
      setCouponHidden(Boolean(editingDiscount.hidden));
      setCouponActive(editingDiscount.active !== false);
      if (editingDiscount.allowed_emails && editingDiscount.allowed_emails.length > 0) {
        setDiscountType('specific');
        setDiscountEmails(editingDiscount.allowed_emails.join(', '));
      } else {
        setDiscountType('all');
        setDiscountEmails('');
      }
    } else {
      setDiscountValueType('percentage');
      setCouponFirstPurchaseOnly(false);
      setCouponSingleUsePerUser(true);
      setCouponHidden(false);
      setCouponActive(true);
      setDiscountType('all');
      setDiscountEmails('');
    }
  }, [editingDiscount, showAddDiscount]);

  useEffect(() => {
    if (editingCourse) {
      const discountConfig = getBundleDiscountConfig(editingCourse);
      setIsBundle(editingCourse.isBundle || false);
      setBundleCourses(editingCourse.bundleCourses || []);
      setBundleDiscountPrice(editingCourse.bundleDiscountAmount || editingCourse.bundleDiscountPrice || editingCourse.bundleCourses?.[0]?._bundleDiscountAmount || '');
      setBundleDiscountCode(editingCourse.bundleDiscountCode || '');
      setBundleDiscountMode(discountConfig.mode);
      setBundleDiscountMinCourses(discountConfig.minCourses);
      setIsFixedBundle(editingCourse.isFixedBundle || false);
      setPricingOptions(editingCourse.pricing_options || []);
      setCourseTags(editingCourse.tags || []);
      setCourseCategory(editingCourse.courseCategory || 'NONE');
      setCourseTerm(editingCourse.term || 'NONE');

      const tags = editingCourse.tags || [];
      const hasTerm1 = tags.some((t: string) => t.toLowerCase() === 'term 1');
      const hasTerm2 = tags.some((t: string) => t.toLowerCase() === 'term 2');
      const hasBoth = tags.some((t: string) => t.toLowerCase() === 'both' || t.toLowerCase() === 'both terms');

      if (hasBoth || (hasTerm1 && hasTerm2)) {
        setCourseFoundationTerm('BOTH');
      } else if (hasTerm2) {
        setCourseFoundationTerm('Term 2');
      } else if (hasTerm1) {
        setCourseFoundationTerm('Term 1');
      } else {
        setCourseFoundationTerm('Term 1');
      }

      setSelectedExamStages(editingCourse.exam_stages || []);
    } else {
      setIsBundle(false);
      setBundleCourses([{ courseId: '', courseName: '', price: 0 }]);
      setBundleDiscountPrice('');
      setBundleDiscountCode('');
      setBundleDiscountMode('all');
      setBundleDiscountMinCourses(3);
      setIsFixedBundle(false);
      setPricingOptions([]);
      setCourseTags([]);
      setCourseCategory('NONE');
      setCourseTerm('NONE');
      setCourseFoundationTerm('Term 1');
      setSelectedExamStages([]);
      setCoursePageTheme('old');
      setAccessVideoUrl('');
    }
  }, [editingCourse, showAddCourse]);

  useEffect(() => {
    if (!showAddCourse && !editingCourse) return;
    let cancelled = false;

    async function loadCoursePage() {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', COURSE_PAGE_SETTINGS_KEY)
        .maybeSingle();
      if (cancelled) return;
      const settings = parseCoursePageSettings(data?.value);
      setFeedbackBank(settings.bank);
      const courseId = editingCourse?.id;
      const saved = courseId ? settings.courses[courseId] : undefined;
      setSelectedReviewIds(
        saved?.reviewIds?.length
          ? saved.reviewIds
          : settings.bank.slice(0, 3).map((note) => note.id)
      );
      setAccessVideoUrl(saved?.videoUrl || settings.defaultVideoUrl || '');
      setCoursePageTheme(saved?.theme === 'new' ? 'new' : 'old');
    }

    loadCoursePage();
    return () => {
      cancelled = true;
    };
  }, [editingCourse, showAddCourse]);

  const addDraftReview = () => {
    const name = draftReview.name.trim();
    const role = draftReview.role.trim();
    const text = draftReview.text.trim();
    if (!name || !role || !text) {
      alert('Add a name, the batch they were in, and the feedback.');
      return;
    }
    const note: FeedbackNote = {
      id: `note-${Date.now()}`,
      name,
      role,
      text,
      rating: 5,
    };
    setFeedbackBank((current) => [...current, note]);
    setSelectedReviewIds((current) => [...current, note.id]);
    setDraftReview({ name: '', role: '', text: '' });
  };

  const persistCoursePageSettings = async (courseId: string) => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', COURSE_PAGE_SETTINGS_KEY)
      .maybeSingle();
    const current = parseCoursePageSettings(data?.value);
    const next: CoursePageSettings = {
      bank: feedbackBank,
      defaultVideoUrl: accessVideoUrl.trim() || current.defaultVideoUrl || '',
      courses: {
        ...current.courses,
        [courseId]: {
          videoUrl: accessVideoUrl.trim(),
          reviewIds: selectedReviewIds,
          theme: coursePageTheme,
        },
      },
    };
    const { error } = await supabase
      .from('settings')
      .upsert({ key: COURSE_PAGE_SETTINGS_KEY, value: JSON.stringify(next) });
    return error;
  };

  const addBundleCourse = () => {
    if (bundleCourses.length >= 10) return;
    setBundleCourses([...bundleCourses, { courseId: '', courseName: '', price: 0 }]);
  };

  const updateBundleCourse = (index: number, key: string, value: string | number) => {
    const updated = [...bundleCourses];
    (updated[index] as any)[key] = value;
    setBundleCourses(updated);
  };

  const removeBundleCourse = (index: number) => {
    setBundleCourses(bundleCourses.filter((_, i) => i !== index));
  };

  const addPricingOption = () => {
    if (pricingOptions.length >= 3) return;
    setPricingOptions([...pricingOptions, { name: '', price: 0, type: 'recorded' }]);
  };

  const updatePricingOption = (index: number, key: string, value: any) => {
    const updated = [...pricingOptions];
    (updated[index] as any)[key] = value;
    setPricingOptions(updated);
  };

  const removePricingOption = (index: number) => {
    setPricingOptions(pricingOptions.filter((_, i) => i !== index));
  };

  const toggleTag = (tag: string) => {
    if (courseTags.includes(tag)) {
      setCourseTags(courseTags.filter(t => t !== tag));
    } else if (courseTags.length < 2) {
      setCourseTags([...courseTags, tag]);
    } else {
      alert("Maximum 2 tags can be shown.");
    }
  };

  const addCustomTag = () => {
    const tag = prompt("Enter custom tag text (max 10 chars):");
    if (tag && tag.trim()) {
      const formattedTag = tag.trim().substring(0, 10).toUpperCase();
      if (!courseTags.includes(formattedTag)) {
        toggleTag(formattedTag);
      }
    }
  };

  const handleCourseTermChange = (term: CourseTerm | 'NONE') => {
    setCourseTerm(term);
    if (term === 'NONE') {
      setSelectedExamStages([]);
      return;
    }

    const availableBoxes = boxConfig[term] || [];
    setSelectedExamStages((current) => current.filter((stage) => availableBoxes.includes(stage)));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isManager) return;
  }, [isManager, authLoading, navigate]);

  useEffect(() => {
    if (!isManager) return;

    const loadBoxes = async () => {
      const { data: boxesData, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'exam_visibility')
        .maybeSingle();

      if (error) {
        console.error('Failed to load boxes:', error);
        return;
      }

      if (boxesData?.value) {
        try {
          setBoxConfig({
            ...DEFAULT_BOX_CONFIG,
            ...JSON.parse(boxesData.value)
          });
        } catch (parseError) {
          console.error('Failed to parse boxes config:', parseError);
        }
      }
    };

    loadBoxes();
  }, [isManager]);

  useEffect(() => {
    // Reset filter and clear stale data when switching tabs so stale data from previous tab doesn't get rendered
    setData([]);
    setLoading(true);
    setFilter('all');
    setPaymentSearch('');
    setPaymentSearchInput('');
    loadedTabRef.current = null;
    setUserSearch('');
    setCustomFrom('');
    setCustomTo('');
  }, [effectiveTab]);

  // Debounce typing so each keystroke doesn't trigger a fetch
  useEffect(() => {
    if (paymentSearchInput === paymentSearch) return;
    const t = window.setTimeout(() => setPaymentSearch(paymentSearchInput), 350);
    return () => window.clearTimeout(t);
  }, [paymentSearchInput]);

  useEffect(() => {
    if (isManager) fetchData();
  }, [effectiveTab, isManager, filter, paymentSearch, userSearch, customFrom, customTo]);

  useEffect(() => {
    if (effectiveTab !== 'payments' || !isManager) return;

    let cancelled = false;

    const loadPaymentStats = async () => {
      const statsFilter =
        filter === 'today' || filter === 'yesterday' || filter === 'custom' || filter === 'all'
          ? filter
          : customFrom && customTo
            ? 'custom'
            : 'all';

      if (statsFilter === 'custom' && (!customFrom || !customTo)) {
        if (!cancelled) {
          setPaymentStats({ totalEarned: 0, totalUsers: 0, abandonedCount: 0, potentialMoney: 0 });
        }
        return;
      }

      try {
        const orders = await apiService.managerFetch(
          'payments',
          statsFilter,
          '',
          statsFilter === 'custom' ? customFrom : '',
          statsFilter === 'custom' ? customTo : ''
        );
        if (cancelled || !Array.isArray(orders)) return;

        const paid = orders.filter((o: any) => o.status === 'PAID');
        const created = orders.filter((o: any) => o.status === 'CREATED');
        const uniqueUsers = new Set(
          orders.map((o: any) => (o.user_email || '').toLowerCase()).filter(Boolean)
        );

        setPaymentStats({
          totalEarned: paid.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0),
          totalUsers: uniqueUsers.size,
          abandonedCount: created.length,
          potentialMoney: created.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0),
        });
      } catch (err) {
        console.error('Failed to load payment stats:', err);
        if (!cancelled) {
          setPaymentStats({ totalEarned: 0, totalUsers: 0, abandonedCount: 0, potentialMoney: 0 });
        }
      }
    };

    loadPaymentStats();
    return () => {
      cancelled = true;
    };
  }, [effectiveTab, isManager, filter, customFrom, customTo]);

  useEffect(() => {
    if ((showAddDiscount || editingDiscount) && discountOptions.length === 0) {
      fetchDiscountOptions();
    }
  }, [showAddDiscount, editingDiscount]);

  const fetchDiscountOptions = async () => {
    try {
      const coursesData = await apiService.managerFetch('courses');
      setDiscountOptions(coursesData || []);
    } catch (err) {
      console.error('Failed to fetch discount options via manager API, falling back to direct Supabase:', err);
      const { data: coursesData, error } = await supabase.from('courses').select('*').order('name');
      if (error) throw error;
      setDiscountOptions(coursesData || []);
    }
  };

  const fetchData = async () => {
    if (effectiveTab === 'blogs' || effectiveTab === 'faqs' || effectiveTab === 'reviews' || effectiveTab === 'booklets' || effectiveTab === 'settings' || effectiveTab === 'boxes' || effectiveTab === 'employees' || effectiveTab === '1on1' || effectiveTab === 'applications' || effectiveTab === 'users' || effectiveTab === 'followups') {
      setLoading(false);
      return;
    }
    // Only block the page on the first load of a tab; later searches/filters refresh in place
    const silent = loadedTabRef.current === effectiveTab;
    const seq = ++fetchSeqRef.current;
    if (!silent) setLoading(true);
    setIsFetching(true);
    try {
      // Always fetch catalog for mapping (merge denormalized catalog + main courses)
      const [{ data: catalog }, { data: courses }] = await Promise.all([
        supabase.from('course_catalog').select('id, name'),
        supabase.from('courses').select('id, name, bundleCourses, courseIds')
      ]);
      
      const merged = [
        ...(catalog || []),
        ...(courses || [])
      ];
      
      // Remove duplicates by ID (prefer catalog for override names)
      const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
      setCourseCatalog(unique);

      if (effectiveTab === 'discounts') {
        const [discountsData] = await Promise.all([
          apiService.managerFetch('discounts', filter),
          fetchDiscountOptions()
        ]);
        if (seq !== fetchSeqRef.current) return;
        setData(discountsData || []);
      } else if (effectiveTab === 'payments') {
        if (filter === 'custom' && (!customFrom || !customTo)) {
          setData([]);
        } else {
          const [paymentsData] = await Promise.all([
            apiService.managerFetch(
              'payments',
              filter,
              paymentSearch,
              filter === 'custom' ? customFrom : '',
              filter === 'custom' ? customTo : ''
            ),
            fetchDiscountOptions()
          ]);
          if (seq !== fetchSeqRef.current) return;
          setData(paymentsData || []);
        }
      } else {
        const result = await apiService.managerFetch(effectiveTab, filter, paymentSearch);
        if (seq !== fetchSeqRef.current) return;
        setData(result || []);
      }
      loadedTabRef.current = effectiveTab;
    } catch (err: any) {
      console.error(`Manager Fetch Error [${activeTab}]:`, err.message);
      if (seq === fetchSeqRef.current) setData([]);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setIsFetching(false);
      }
    }
  };

  const exportUsers = () => {
    if (effectiveTab !== 'users' || !Array.isArray(data)) return;
    
    const headers = ['Name', 'Email', 'Phone', 'Gender', 'Joined At'];
    const rows = data.map(u => [
      u.name || '',
      u.email || '',
      u.phone || '',
      u.gender || '',
      u.created_at ? new Date(u.created_at).toLocaleString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };
  
  const resolveCourseTitle = (cid: any): string => {
    if (!cid || typeof cid !== 'string') return '';
    for (const course of courseCatalog) {
      if (Array.isArray(course.bundleCourses)) {
        const matchedBc = course.bundleCourses.find((bc: any) => 
          bc.courseId === cid || bc.courseId2 === cid || bc.courseId3 === cid || bc.id === cid
        );
        if (matchedBc && matchedBc.courseName) return matchedBc.courseName;
      }
    }
    const directCourse = courseCatalog.find(c => c.id === cid);
    if (directCourse) {
      if (Array.isArray(directCourse.bundleCourses) && directCourse.bundleCourses.length > 0 && directCourse.bundleCourses[0].courseName) {
        return directCourse.bundleCourses[0].courseName;
      }
      return directCourse.name;
    }
    for (const course of courseCatalog) {
      if (Array.isArray(course.courseIds) && course.courseIds.includes(cid)) return course.name;
    }
    const inDiscount = discountOptions.find(c => c.id === cid);
    if (inDiscount) return inDiscount.name;

    if (cid.includes('-') || cid.includes('_')) {
      return cid.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return cid;
  };

  const exportPayments = () => {
    if (effectiveTab !== 'payments' || !Array.isArray(data)) return;
    
    const headers = ['Order ID', 'Name', 'Email', 'Phone', 'Courses', 'Amount', 'Status', 'Date'];
    const rows = data.map(order => [
      order?.order_id || '',
      order?.user_name || '',
      order?.user_email || '',
      order?.user_phone || '',
      Array.isArray(order?.course_ids) 
        ? order.course_ids.map((id: any) => resolveCourseTitle(id)).filter(Boolean).join('; ') 
        : '',
      order?.total_amount || 0,
      order?.status || '',
      order?.created_at ? new Date(order.created_at).toISOString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payments_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportReferrals = () => {
    if (effectiveTab !== 'referrals' || !Array.isArray(data)) return;
    
    const headers = ['Order ID', 'Buyer Email', 'Referrer Code', 'Original Price', 'Buyer Discount', 'Final Paid', 'Referrer Reward', 'Date'];
    const rows = data.map((tx: any) => [
      tx.order_id || '',
      tx.buyer_email || '',
      tx.referral_code || '',
      tx.original_price || 0,
      tx.buyer_discount || 0,
      tx.final_price || 0,
      tx.referrer_reward || 0,
      tx.created_at ? new Date(tx.created_at).toISOString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `referrals_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const fetchUserDetails = async (user: any) => {
    setSelectedUser(user);
    setIsLoadingUserDetails(true);
    try {
      const email = user.email;
      const [ordersRes, referralsRes, walletRes] = await Promise.all([
        supabase.from('website_orders').select('*').eq('user_email', email).order('created_at', { ascending: false }),
        supabase.from('referral_transactions').select('*').eq('referrer_email', email).order('created_at', { ascending: false }),
        supabase.from('referral_profiles').select('*').eq('email', email).maybeSingle()
      ]);
      
      setSelectedUserOrders(ordersRes.data || []);
      setSelectedUserReferrals(referralsRes.data || []);
      setSelectedUserWallet(walletRes.data || null);
    } catch (err) {
      console.error("Failed to load user details", err);
    } finally {
      setIsLoadingUserDetails(false);
    }
  };

  const exportCatalog = () => {
    if (effectiveTab !== 'catalog' || !Array.isArray(courseCatalog)) return;
    
    const headers = ['Course ID', 'Display Name', 'Last Updated'];
    const rows = courseCatalog.map(c => [
      c.id || '',
      c.name || '',
      c.updated_at ? new Date(c.updated_at).toLocaleString('en-GB') : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `manager_course_catalog_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleCourseAction = (course: any, isDelete = false) =>
    withBusy(isDelete ? 'Deleting course…' : 'Saving course…', () => handleCourseActionInner(course, isDelete));

  const handleCourseActionInner = async (course: any, isDelete = false) => {
    if (isDelete) {
      const { error } = await supabase.from('courses').delete().eq('id', course.id);
      if (error) alert(error.message);
      fetchData();
      return;
    } else {

      const nextCourseId = course.id || sanitizeCourseId(course.name);
      const previousCourseId = course.previousId || null;

      // Ensure specific fields for existing schema
      const cleanedCourse = {
        id: nextCourseId,
        name: course.name,
        description: course.subtitle, // subtitle maps to description in DB for now
        price: parseInt(course.price as string),
        isPinned: course.isPinned || false,
        active: course.active !== false,
        class_type: course.class_type || 'recorded',
        learn: [],
        who: '',
        outcomes: '',
        cohortContent: course.cohortContent || null,
        discountPrice: course.discountPrice ? parseInt(course.discountPrice) : null,
        isBundle: course.isBundle || false,
        bundleCourses: course.bundleCourses || [],
        bundleDiscountPrice: course.bundleDiscountPrice || null,
        bundleDiscountAmount: course.bundleDiscountAmount || course.bundleDiscountPrice || null,
        bundleDiscountCode: course.bundleDiscountCode || null,
        bundleDiscountMode: course.isBundle
          ? (course.bundleDiscountMode === 'any' ? 'any' : 'all')
          : null,
        bundleDiscountMinCourses: course.isBundle && course.bundleDiscountMode === 'any'
          ? Number(course.bundleDiscountMinCourses) || 3
          : null,
        isFixedBundle: course.isFixedBundle || false,
        pricing_options: course.pricing_options || [],
        subject: course.category || null,
        tags: course.tags || [],
        courseCategory: course.courseCategory || 'NONE',
        term: course.term === 'NONE' ? null : course.term || null,
        startDate: course.startDate || null,
        endDate: course.endDate || null,
        exam_stages: course.exam_stages || [],
      };

      let error = null;

      if (previousCourseId && previousCourseId !== nextCourseId) {
        const { data: existingCourse } = await supabase
          .from('courses')
          .select('id')
          .eq('id', nextCourseId)
          .maybeSingle();

        if (existingCourse) {
          alert('That database ID is already in use. Please choose a unique one.');
          return;
        }

        const { data: allCourses, error: fetchCoursesError } = await supabase.from('courses').select('*');
        if (fetchCoursesError) {
          alert(fetchCoursesError.message);
          return;
        }

        const coursesToUpdate = (allCourses || [])
          .filter((existing: any) =>
            existing.id !== previousCourseId &&
            existing.bundleCourses?.some((bundleCourse: any) => bundleCourse.courseId === previousCourseId)
          )
          .map((existing: any) => ({
            ...existing,
            bundleCourses: existing.bundleCourses.map((bundleCourse: any) =>
              bundleCourse.courseId === previousCourseId
                ? { ...bundleCourse, courseId: nextCourseId }
                : bundleCourse
            )
          }));

        let { error: insertError } = await supabase.from('courses').insert(cleanedCourse);
        if (insertError && insertError.message?.includes('bundleDiscountAmount')) {
          const fallbackCourse = { ...cleanedCourse };
          delete (fallbackCourse as any).bundleDiscountAmount;
          const retry = await supabase.from('courses').insert(fallbackCourse);
          insertError = retry.error;
        }
        if (insertError) {
          alert(insertError.message);
          return;
        }

        if (coursesToUpdate.length > 0) {
          const { error: referenceUpdateError } = await supabase.from('courses').upsert(coursesToUpdate);
          if (referenceUpdateError) {
            alert(referenceUpdateError.message);
            return;
          }
        }

        const { data: discountsToUpdate, error: fetchDiscountsError } = await supabase
          .from('discount_coupons')
          .select('*')
          .eq('applies_to', previousCourseId);

        if (fetchDiscountsError) {
          alert(fetchDiscountsError.message);
          return;
        }

        if ((discountsToUpdate || []).length > 0) {
          const { error: discountUpdateError } = await supabase.from('discount_coupons').upsert(
            discountsToUpdate.map((discount: any) => ({
              ...discount,
              applies_to: nextCourseId
            }))
          );

          if (discountUpdateError) {
            alert(discountUpdateError.message);
            return;
          }
        }

        const { error: deleteOldError } = await supabase.from('courses').delete().eq('id', previousCourseId);
        error = deleteOldError;
      } else {
        let response = await supabase.from('courses').upsert(cleanedCourse);
        if (response.error && response.error.message?.includes('bundleDiscountAmount')) {
          const fallbackCourse = { ...cleanedCourse };
          delete (fallbackCourse as any).bundleDiscountAmount;
          response = await supabase.from('courses').upsert(fallbackCourse);
        }
        error = response.error;
      }

      if (error) {
        alert(error.message);
      } else {
        // --- SYNC TO COURSE CATALOG ---
        const catalogEntries = [{ id: cleanedCourse.id, name: cleanedCourse.name }];
        if (cleanedCourse.isBundle && Array.isArray(cleanedCourse.bundleCourses)) {
          cleanedCourse.bundleCourses.forEach((bc: any) => {
            if (bc.courseId && bc.courseName) {
              catalogEntries.push({ id: bc.courseId, name: bc.courseName });
            }
            if (bc.courseId2 && bc.courseName) {
              catalogEntries.push({ id: bc.courseId2, name: bc.courseName });
            }
            if (bc.courseId3 && bc.courseName) {
              catalogEntries.push({ id: bc.courseId3, name: bc.courseName });
            }
          });
        }
        
        const { error: catalogError } = await supabase
          .from('course_catalog')
          .upsert(catalogEntries, { onConflict: 'id' });
          
        if (catalogError) console.error('Failed to sync course catalog:', catalogError);
      }

      setEditingCourse(null);
      setShowAddCourse(false);
    }
    fetchData();
  };

  const handleDiscountAction = (discount: any, isDelete = false) =>
    withBusy(isDelete ? 'Deleting coupon…' : 'Saving coupon…', () => handleDiscountActionInner(discount, isDelete));

  const handleDiscountActionInner = async (discount: any, isDelete = false) => {
    if (isDelete) {
      const { error } = await supabase.from('discount_coupons').delete().eq('id', discount.id);
      if (error) alert(error.message);
      fetchData();
      return;
    } else {

      const cleanedDiscount: any = {
        ...(discount.id ? { id: discount.id } : {}),
        code: discount.code.toUpperCase(),
        discount_percentage: discount.discount_percentage ? parseInt(discount.discount_percentage) : null,
        discount_amount: discount.discount_amount ? parseInt(discount.discount_amount) : null,
        max_discount_amount: discount.max_discount_amount ? parseInt(discount.max_discount_amount) : null,
        applies_to: discount.applies_to || 'ALL',
        allowed_emails: discount.discountType === 'specific'
          ? discount.discountEmails
              .split(',')
              .map((e: string) => e.trim().toLowerCase())
              .filter((e: string) => e !== '')
          : null,
        start_date: discount.start_date ? new Date(discount.start_date).toISOString() : null,
        expires_at: discount.expires_at ? new Date(discount.expires_at).toISOString() : null,
        max_uses: discount.max_uses ? parseInt(discount.max_uses) : null,
        min_order_value: discount.min_order_value ? parseInt(discount.min_order_value) : 0,
        first_purchase_only: Boolean(discount.first_purchase_only),
        single_use_per_user: Boolean(discount.single_use_per_user),
        hidden: Boolean(discount.hidden),
        active: Boolean(discount.active)
      };
      let error = null;
      if (discount.id) {
        const { id, ...updatePayload } = cleanedDiscount;
        const res = await supabase.from('discount_coupons').update(updatePayload).eq('id', discount.id);
        error = res.error;
        if (error && error.message?.includes('max_discount_amount')) {
          delete updatePayload.max_discount_amount;
          const retry = await supabase.from('discount_coupons').update(updatePayload).eq('id', discount.id);
          error = retry.error;
          if (!error) {
            alert('Saved! To persist Max Discount, run this SQL in Supabase SQL Editor: ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS max_discount_amount INTEGER;');
          }
        }
      } else {
        delete cleanedDiscount.id;
        const res = await supabase.from('discount_coupons').insert(cleanedDiscount);
        error = res.error;
        if (error && error.message?.includes('max_discount_amount')) {
          delete cleanedDiscount.max_discount_amount;
          const retry = await supabase.from('discount_coupons').insert(cleanedDiscount);
          error = retry.error;
          if (!error) {
            alert('Saved! To persist Max Discount, run this SQL in Supabase SQL Editor: ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS max_discount_amount INTEGER;');
          }
        }
      }

      if (error) {
        alert(error.message);
      } else {
        setEditingDiscount(null);
        setShowAddDiscount(false);
      }
    }
    fetchData();
  };

  const handlePaymentDelete = async (orderId: string) => {
    const { error } = await supabase.from('website_orders').delete().eq('order_id', orderId);
    if (error) alert(error.message);
    fetchData();
  };


  const paidSelectedUserOrders = selectedUserOrders.filter((order) => order.status === 'PAID');
  const selectedUserTotalSpent = paidSelectedUserOrders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading manager…
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 text-sm font-semibold">
        Access denied
      </div>
    );
  }

  const availableBoxesForSelectedTerm = courseTerm === 'NONE' ? [] : (boxConfig[courseTerm] || []);

  const managerTabs = [
    { id: 'users', label: 'Users', icon: User, path: '/manager/users' },
    { id: '1on1', label: '1:1 Bookings', icon: Calendar, path: '/manager/1on1' },
    { id: 'applications', label: 'Job Applications', icon: Briefcase, path: '/manager/applications' },
    { id: 'employees', label: 'Employees', icon: ShieldCheck, path: '/manager/employees' },
    { id: 'courses', label: 'Courses', icon: BookOpen, path: '/manager/courses' },
    { id: 'boxes', label: 'Boxes', icon: Boxes, path: '/manager/boxes' },
    { id: 'booklets', label: 'Booklets', icon: BookMarked, path: '/manager/booklets' },
    { id: 'discounts', label: 'Discounts', icon: ShoppingBag, path: '/manager/discounts' },
    { id: 'payments', label: 'Payments', icon: CreditCard, path: '/manager/payments' },
    { id: 'followups', label: 'Follow-ups', icon: PhoneCall, path: '/manager/followups' },
    { id: 'referrals', label: 'Referrals', icon: Gift, path: '/manager/referrals' },
    { id: 'blogs', label: 'Blogs', icon: ScrollText, path: '/manager/blogs' },
    { id: 'faqs', label: 'FAQs', icon: HelpCircle, path: '/manager/faqs' },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare, path: '/manager/reviews' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/manager/settings' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Header & Navigation */}
      <div className={`${embed ? 'hidden' : 'md:hidden'} bg-white border-b border-slate-200 sticky top-0 z-40`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => { try { (window.top || window).location.href = '/'; } catch { window.location.href = '/'; } }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit
            </button>
            <span className="font-semibold text-base text-slate-900 tracking-tight truncate">Manager</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md shrink-0">
            {effectiveTab === '1on1' ? '1:1 Bookings' : effectiveTab === 'applications' ? 'Job Applications' : effectiveTab === 'followups' ? 'Follow-ups' : effectiveTab}
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto no-scrollbar py-2 px-3 border-t border-slate-100">
          {managerTabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) => `
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
                ${isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}
              `}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label || tab.id}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Desktop Sidebar */}
      <aside className={`${embed ? '!hidden' : 'hidden md:flex'} md:w-56 lg:w-60 bg-white text-slate-700 p-4 flex-col gap-6 h-screen sticky top-0 border-r border-slate-200 shrink-0`}>
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-sm font-semibold text-white">G</div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-slate-900 truncate">GenZ Manager</div>
            <div className="text-[11px] text-slate-400">Manager panel</div>
          </div>
        </div>
        
        <nav className="space-y-0.5 flex-grow overflow-y-auto no-scrollbar">
          {managerTabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              end={tab.id === 'dashboard'}
              className={({ isActive }) => `
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}
              `}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span>{tab.label || tab.id}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => { try { (window.top || window).location.href = '/'; } catch { window.location.href = '/'; } }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors border border-slate-200"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Back to site
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0 w-full">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className={embed ? 'hidden' : undefined}>
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 capitalize tracking-tight">
                {effectiveTab === '1on1' ? '1:1 Bookings' : effectiveTab === 'applications' ? 'Job Applications' : effectiveTab === 'followups' ? 'Follow-ups' : effectiveTab}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {effectiveTab === '1on1'
                  ? 'Manage student consultations, follow-ups, and pipeline'
                  : effectiveTab === 'applications'
                  ? 'Review tutor faculty & campus leader submissions, contact candidates, and manage pipeline'
                  : effectiveTab === 'followups'
                  ? 'People who started checkout but didn’t pay — who to call, in order'
                  : 'Manager panel'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {effectiveTab === 'catalog' && (
                <button 
                  onClick={exportCatalog}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              )}
              {effectiveTab === 'payments' && (
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setFilter(filter === 'not-purchased' ? 'all' : 'not-purchased')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      filter === 'not-purchased'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-4 h-4" /> Just Created
                  </button>
                  <button 
                    onClick={fetchData}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
                    title="Sync with Database"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync
                  </button>
                  <button 
                    onClick={exportPayments}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                </div>
              )}
              {effectiveTab === 'courses' && (
                <button 
                  onClick={() => setShowAddCourse(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Course
                </button>
              )}
              {effectiveTab === 'discounts' && (
                <button 
                  onClick={() => setShowAddDiscount(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> New Coupon
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-20 text-slate-400 text-sm font-medium">Loading…</div>
          ) : (
            <ErrorBoundary fallbackTitle="Manager View Error">
              <div className="space-y-6">

                {effectiveTab === '1on1' && <OneOnOneBookingsManager />}

                {effectiveTab === 'applications' && <JobApplicationsManager />}

                {effectiveTab === 'followups' && <FollowUpsManager />}

                {effectiveTab === 'blogs' && <BlogsManager />}

                {effectiveTab === 'employees' && <EmployeesManager />}

              {effectiveTab === 'boxes' && <BoxesManager boxConfig={boxConfig} setBoxConfig={setBoxConfig} />}

              {effectiveTab === 'faqs' && <FaqsManager />}
              {effectiveTab === 'reviews' && <ReviewsManager />}
              {effectiveTab === 'booklets' && <BookletsManager />}
              {effectiveTab === 'settings' && <SettingsManager />}

              {effectiveTab === 'users' && <UsersManager onSelectUser={fetchUserDetails} />}

              {effectiveTab === 'payments' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="bg-white border-2 border-emerald-200 border-l-4 border-l-emerald-500 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Total Earned</span>
                        <button type="button" onClick={() => setShowEarned(v => !v)} title={showEarned ? 'Hide amount' : 'Show amount'} aria-label="Toggle total earned visibility" className="text-emerald-600 hover:text-emerald-800 cursor-pointer">{showEarned ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      </div>
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">{showEarned ? `₹${paymentStats.totalEarned.toLocaleString('en-IN')}` : '₹ ••••••'}</div>
                      <p className="mt-1 text-xs font-medium text-slate-500">Paid orders only</p>
                    </div>
                    <div className="bg-white border-2 border-blue-200 border-l-4 border-l-blue-500 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Total Users</span>
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">{paymentStats.totalUsers.toLocaleString('en-IN')}</div>
                      <p className="mt-1 text-xs font-medium text-slate-500">Unique emails in range</p>
                    </div>
                    <div className="bg-white border-2 border-amber-200 border-l-4 border-l-amber-500 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Abandoned</span>
                        <UserX className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">{paymentStats.abandonedCount.toLocaleString('en-IN')}</div>
                      <p className="mt-1 text-xs font-medium text-slate-500">Created checkouts</p>
                    </div>
                    <div className="bg-white border-2 border-rose-200 border-l-4 border-l-rose-500 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-rose-700">Potential Money</span>
                        <button type="button" onClick={() => setShowPotential(v => !v)} title={showPotential ? 'Hide amount' : 'Show amount'} aria-label="Toggle potential money visibility" className="text-rose-600 hover:text-rose-800 cursor-pointer">{showPotential ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      </div>
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">{showPotential ? `₹${paymentStats.potentialMoney.toLocaleString('en-IN')}` : '₹ ••••••'}</div>
                      <p className="mt-1 text-xs font-medium text-slate-500">From created (unpaid)</p>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-grow bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex gap-3 items-center">
                      <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search by name, email, phone, or order ID…"
                        value={paymentSearchInput}
                        onChange={(e) => setPaymentSearchInput(e.target.value)}
                        autoComplete="off"
                        className="w-full outline-none text-sm text-slate-800 placeholder:text-slate-400"
                      />
                      {isFetching && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-1 flex gap-1 overflow-x-auto whitespace-nowrap no-scrollbar">
                      {[
                        { id: 'all', label: 'All Time' },
                        { id: 'today', label: 'Today' },
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: 'custom', label: 'Custom' },
                        { id: 'not-purchased', label: 'Just Created' },
                        { id: 'abandoned', label: 'Abandoned' }
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFilter(f.id as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            filter === f.id 
                              ? 'bg-slate-900 text-white' 
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filter === 'custom' && (
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-end gap-3 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700 shrink-0 pb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wide">Date range</span>
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block">
                          <span className="block text-[11px] font-semibold text-slate-500 mb-1">From</span>
                          <input
                            type="date"
                            value={customFrom}
                            max={customTo || undefined}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[11px] font-semibold text-slate-500 mb-1">To</span>
                          <input
                            type="date"
                            value={customTo}
                            min={customFrom || undefined}
                            onChange={(e) => setCustomTo(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                          />
                        </label>
                      </div>
                      {(!customFrom || !customTo) && (
                        <p className="text-xs font-medium text-amber-700 sm:pb-2">Select both dates to load stats & orders.</p>
                      )}
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto w-full touch-pan-x">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 sm:px-5 py-3">Order</th>
                            <th className="px-4 sm:px-5 py-3">Courses</th>
                            <th className="px-4 sm:px-5 py-3">Amount</th>
                            <th className="px-4 sm:px-5 py-3">Status</th>
                            <th className="px-4 sm:px-5 py-3">Date</th>
                            <th className="px-4 sm:px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Array.isArray(data) && data.map((order: any, idx: number) => (
                            <tr 
                              key={order?.order_id || order?.id || idx} 
                              onClick={() => fetchUserDetails({
                                email: order?.user_email,
                                name: order?.user_name || order?.user_email,
                                phone: order?.user_phone,
                                created_at: order?.user_joined_at
                              })}
                              className="hover:bg-slate-50 transition-colors cursor-pointer group"
                            >
                              <td className="px-4 sm:px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors break-all">
                                    {order?.user_name || order?.user_email || 'Unknown User'}
                                  </div>
                                  <ArrowRight className="w-3.5 h-3.5 text-transparent group-hover:text-blue-600 transition-colors shrink-0" />
                                </div>
                                <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                                  <div className="break-all">{order?.user_email || 'No email'}</div>
                                  <div className="font-mono">{order?.user_phone || 'No phone'}</div>
                                  <div className="font-mono">{order?.order_id || ''}</div>
                                </div>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5">
                                <div className="flex flex-wrap gap-1">
                                  {Array.isArray(order?.course_ids) ? order.course_ids.map((cid: any, cIdx: number) => {
                                    if (!cid) return null;
                                    return (
                                      <span key={cIdx} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-medium max-w-full break-all">
                                        {resolveCourseTitle(cid)}
                                      </span>
                                    );
                                  }) : <span className="text-slate-400">No courses</span>}
                                </div>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 font-semibold text-emerald-600">₹{order?.total_amount ?? 0}</td>
                              <td className="px-4 sm:px-5 py-3.5">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium uppercase ${
                                  order?.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                                  order?.status === 'FAILED' ? 'bg-red-50 text-red-700' :
                                  order?.status === 'NOT_PURCHASED' ? 'bg-slate-100 text-slate-500' :
                                  'bg-amber-50 text-amber-700'
                                }`}>
                                  {typeof order?.status === 'string'
                                    ? order.status.replace('_', ' ')
                                    : (order?.status ? String(order.status) : 'PENDING')}
                                </span>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                                {order?.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 text-right">
                                {order?.order_id && !String(order.order_id).startsWith('LEAD_') && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      askConfirm({ title: 'Delete this payment record?', message: `Order ${order.order_id} will be permanently removed. This can’t be undone.`, confirmLabel: 'Delete record', onConfirm: () => withBusy('Deleting record…', async () => { await handlePaymentDelete(order.order_id); }) });
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Payment Record"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {data.length === 0 && (
                            <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-sm">
                              {filter === 'custom' && (!customFrom || !customTo)
                                ? 'Pick a from and to date to see payments'
                                : 'No payments found'}
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {effectiveTab === 'courses' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto w-full touch-pan-x">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 sm:px-5 py-3">Course</th>
                          <th className="px-4 sm:px-5 py-3">ID</th>
                          <th className="px-4 sm:px-5 py-3">Price</th>
                          <th className="px-4 sm:px-5 py-3">Term / Boxes</th>
                          <th className="px-4 sm:px-5 py-3">Status</th>
                          <th className="px-4 sm:px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.map((course) => (
                          <tr key={course.id} className={`hover:bg-slate-50 transition-colors ${course.active === false ? 'opacity-60' : ''}`}>
                            <td className="px-4 sm:px-5 py-3.5">
                              <div className="font-medium text-slate-900">{course.name}</div>
                            </td>
                            <td className="px-4 sm:px-5 py-3.5">
                              <code className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{course.id}</code>
                            </td>
                            <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                              {course.discountPrice ? (
                                <span className="font-semibold text-emerald-600">
                                  <span className="text-xs text-slate-400 line-through mr-1.5 font-normal">₹{course.price}</span>
                                  ₹{course.discountPrice}
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-800">₹{course.price}</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-5 py-3.5">
                              <div className="flex flex-wrap gap-1">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-medium uppercase">
                                  {course.term || 'No Term'}
                                </span>
                                {Array.isArray(course.exam_stages) && course.exam_stages.length > 0 ? course.exam_stages.map((box: string) => (
                                  <span key={box} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-medium uppercase">
                                    {box}
                                  </span>
                                )) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md text-[11px] font-medium uppercase">
                                    No Boxes
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 sm:px-5 py-3.5">
                              {course.active === false ? (
                                <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[11px] font-medium">Disabled</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-medium">Active</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={() => setEditingCourse(course)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button 
                                  onClick={() => askConfirm({ title: 'Delete this course?', message: `“${course.name}” will be permanently deleted. This can’t be undone.`, confirmLabel: 'Delete course', onConfirm: () => handleCourseAction(course, true) })}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete course"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {data.length === 0 && (
                          <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-400 text-sm">No courses yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {effectiveTab === 'discounts' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto w-full touch-pan-x">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 sm:px-5 py-3">Code</th>
                          <th className="px-4 sm:px-5 py-3">Value</th>
                          <th className="px-4 sm:px-5 py-3">Applies To</th>
                          <th className="px-4 sm:px-5 py-3">Uses</th>
                          <th className="px-4 sm:px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.map((discount) => (
                          <tr key={discount.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 sm:px-5 py-3.5">
                              <code className="font-semibold text-slate-900 tracking-wide uppercase">{discount.code}</code>
                            </td>
                            <td className="px-4 sm:px-5 py-3.5">
                              {discount.discount_percentage ? (
                                <div>
                                  <span className="font-semibold text-violet-600">{discount.discount_percentage}% OFF</span>
                                  {(discount.max_discount_amount || discount.max_discount) ? (
                                    <span className="block text-[11px] text-gray-500 font-bold">Max ₹{discount.max_discount_amount || discount.max_discount}</span>
                                  ) : null}
                                </div>
                              ) : discount.discount_amount ? (
                                <span className="font-semibold text-violet-600">₹{discount.discount_amount} OFF</span>
                              ) : (
                                <span className="text-slate-400">Invalid</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-5 py-3.5 text-slate-600 text-xs max-w-[280px]">
                              {discount.applies_to === 'ALL'
                                ? 'Everything (Global)'
                                : `${(discountOptionMap.get(discount.applies_to) as any)?.name || discount.applies_to} ${(discountOptionMap.get(discount.applies_to) as any)?.isBundle ? '[Bundle]' : '[Course]'}`}
                            </td>
                            <td className="px-4 sm:px-5 py-3.5 text-slate-500 text-xs">
                              {discount.used_count || 0} uses
                            </td>
                            <td className="px-4 sm:px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={() => setEditingDiscount(discount)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button 
                                  onClick={() => askConfirm({ title: 'Delete this coupon?', message: `Coupon “${discount.code}” will be permanently deleted. This can’t be undone.`, confirmLabel: 'Delete coupon', onConfirm: () => handleDiscountAction(discount, true) })}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete coupon"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {data.length === 0 && (
                          <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-400 text-sm">No coupons yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {effectiveTab === 'referrals' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button onClick={exportReferrals} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                      <Download className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto w-full touch-pan-x">
                      <table className="w-full min-w-[650px] text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 sm:px-5 py-3">Buyer</th>
                            <th className="px-4 sm:px-5 py-3">Referrer Code</th>
                            <th className="px-4 sm:px-5 py-3">Original</th>
                            <th className="px-4 sm:px-5 py-3">Discount</th>
                            <th className="px-4 sm:px-5 py-3">Final Paid</th>
                            <th className="px-4 sm:px-5 py-3">Reward</th>
                            <th className="px-4 sm:px-5 py-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.map((tx: any) => (
                            <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 sm:px-5 py-3.5">
                                <div className="text-sm font-medium text-slate-900 break-all">{tx.buyer_email}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{tx.order_id}</div>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5">
                                <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-md text-xs font-medium">
                                  {tx.referral_code}
                                </span>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 text-slate-500">₹{tx.original_price}</td>
                              <td className="px-4 sm:px-5 py-3.5 text-emerald-600 font-medium">-₹{tx.buyer_discount}</td>
                              <td className="px-4 sm:px-5 py-3.5 font-semibold text-slate-900">₹{tx.final_price}</td>
                              <td className="px-4 sm:px-5 py-3.5">
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-xs font-medium">
                                  +{tx.referrer_reward} Coins
                                </span>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                                {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                          {data.length === 0 && (
                            <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm">No referral transactions yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}
        </div>
      </div>

      {/* Course Editor — full page */}
      <ManagerFullPageSheet
        open={!!(showAddCourse || editingCourse)}
        title={editingCourse ? 'Edit course' : 'Create course'}
        subtitle={editingCourse?.name || 'Fill in the details below, then save'}
        onClose={() => { setShowAddCourse(false); setEditingCourse(null); }}
        onSave={() => document.getElementById('course-editor-save')?.click()}
        saveLabel="Save changes"
        maxWidthClass="max-w-6xl"
      >
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm self-start">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-3">Course Name</label>
                    <input 
                      type="text" 
                      defaultValue={editingCourse?.name} 
                      id="c-name" 
                      onChange={(e) => {
                        if (!editingCourse) {
                          const idInput = document.getElementById('c-id') as HTMLInputElement;
                          if (idInput) {
                            idInput.value = e.target.value
                              .toLowerCase()
                              .trim()
                              .replace(/[^\w\s-]/g, '')
                              .replace(/[\s_-]+/g, '-')
                              .replace(/^-+|-+$/g, '');
                          }
                        }
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle / Brief Description</label>
                    <textarea defaultValue={editingCourse?.description} id="c-subtitle" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none h-32" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-3">What You Get in the Cohort</label>
                    <p className="text-xs font-normal text-slate-500 mb-2">These lines show under “Included with enrollment” on the course page. One point per line.</p>
                    <textarea defaultValue={editingCourse?.cohortContent || ''} id="c-cohort" placeholder="e.g.&#10;Live doubt-solving sessions every week&#10;Structured notes + PYQs&#10;Mock tests before every quiz&#10;..." className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none h-48 leading-relaxed" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">Display Price / Starts From (₹)</label>
                      <input 
                        type="text" inputMode="decimal" 
                        defaultValue={editingCourse?.price} 
                        id="c-price" 
                        onChange={(e) => {
                          if (!isBundle && bundleCourses[0]) {
                            const discountVal = (document.getElementById('c-discount') as HTMLInputElement)?.value;
                            if (!discountVal) {
                              updateBundleCourse(0, 'price', parseInt(e.target.value) || 0);
                            }
                          }
                        }}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">Discount Display Price (₹)</label>
                      <input 
                        type="text" inputMode="decimal" 
                        defaultValue={editingCourse?.discountPrice} 
                        id="c-discount" 
                        placeholder="Optional" 
                        onChange={(e) => {
                          if (!isBundle && bundleCourses[0]) {
                            const val = parseInt(e.target.value);
                            if (val) {
                              updateBundleCourse(0, 'price', val);
                            } else {
                              const mainPrice = parseInt((document.getElementById('c-price') as HTMLInputElement)?.value) || 0;
                              updateBundleCourse(0, 'price', mainPrice);
                            }
                          }
                        }}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">Category</label>
                      <input type="text" defaultValue={editingCourse?.subject} id="c-category" placeholder="e.g. Data Science" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">
                        Class Type
                        {pricingOptions.length > 0 && (
                          <span className="text-xs font-normal text-slate-500 block mt-1">(Disabled: Using Pricing Tiers)</span>
                        )}
                      </label>
                      <select 
                        id="c-class-type" 
                        defaultValue={editingCourse?.class_type || 'recorded'} 
                        disabled={pricingOptions.length > 0}
                        className={`w-full px-3.5 py-2.5 border border-slate-300 rounded-2xl font-semibold focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-white transition-all ${pricingOptions.length > 0 ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:border-blue-500'}`}
                      >
                        <option value="recorded">Recorded</option>
                        <option value="live">Live</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">Visibility</label>
                      <select
                        id="c-active"
                        defaultValue={editingCourse?.active === false ? 'false' : 'true'}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-2xl font-semibold focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-white"
                      >
                        <option value="true">Enabled — visible to users</option>
                        <option value="false">Disabled — hidden from users</option>
                      </select>
                      <p className="mt-2 text-[11px] font-bold text-gray-400">
                        Disable during maintenance so the course disappears from the courses page.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">Pinned?</label>
                      <select id="c-pinned" defaultValue={editingCourse?.isPinned ? 'true' : 'false'} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-2xl font-semibold focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-white">
                        <option value="false">Regular</option>
                        <option value="true">Pinned</option>
                      </select>
                    </div>
                  </div>

                  <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">Course Marketing Tag</label>
                      <select value={courseCategory} onChange={(e) => setCourseCategory(e.target.value as 'QUALIFIER' | 'LIVE' | 'RECORDED' | 'NONE')} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-2xl font-semibold focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-white">
                        <option value="NONE">None</option>
                        <option value="QUALIFIER">Qualifier</option>
                        <option value="LIVE">Live</option>
                        <option value="RECORDED">Recorded</option>
                      </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">Select Term</label>
                      <select value={courseTerm} onChange={(e) => handleCourseTermChange(e.target.value as CourseTerm | 'NONE')} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-2xl font-semibold focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-white">
                        <option value="NONE">None</option>
                        {TERM_OPTIONS.map((term) => (
                          <option key={term} value={term}>{term}</option>
                        ))}
                      </select>
                    </div>

                    {courseTerm === 'Foundation' && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-xs font-semibold text-slate-700 mb-3">Foundation Term</label>
                        <select 
                          value={courseFoundationTerm} 
                          onChange={(e) => setCourseFoundationTerm(e.target.value as 'Term 1' | 'Term 2' | 'BOTH')} 
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-2xl font-semibold focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-white"
                        >
                          <option value="Term 1">TERM 1 (Math 1, Eng 1, Stats 1, CT)</option>
                          <option value="Term 2">TERM 2 (Math 2, Eng 2, Stats 2, Python)</option>
                          <option value="BOTH">Both Terms (Term 1 &amp; Term 2)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t-2 border-dashed border-gray-200 pt-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-3">Choose Boxes</label>
                    {courseTerm === 'NONE' ? (
                      <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-sm font-bold text-gray-400">
                        Select a term first to assign this course to boxes.
                      </div>
                    ) : availableBoxesForSelectedTerm.length === 0 ? (
                      <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-2xl text-sm font-bold text-yellow-700">
                        No boxes have been added for {courseTerm}. Add boxes in Manager &gt; Boxes first.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {availableBoxesForSelectedTerm.map((stage) => {
                          const isChecked = selectedExamStages.includes(stage);
                          return (
                            <label key={stage} className={`flex items-center gap-3 p-4 border rounded-2xl cursor-pointer font-bold select-none transition-all ${isChecked ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-900 text-slate-900'}`}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedExamStages([...selectedExamStages, stage]);
                                  } else {
                                    setSelectedExamStages(selectedExamStages.filter(s => s !== stage));
                                  }
                                }}
                                className="w-5 h-5 accent-blue-600 rounded border-gray-300"
                              />
                              <span>{stage}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">Start Date</label>
                      <input type="date" defaultValue={editingCourse?.startDate ? new Date(editingCourse.startDate).toISOString().slice(0, 10) : ''} id="c-start" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-3">End Date</label>
                      <input type="date" defaultValue={editingCourse?.endDate ? new Date(editingCourse.endDate).toISOString().slice(0, 10) : ''} id="c-end" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-white" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Course Tags (Max 2)</label>
                    <p className="text-xs font-normal text-slate-500 mb-3">Choose up to 2 tags to display on the course card corner.</p>
                    <div className="flex flex-wrap gap-2">
                      {['SALE', 'NEW', 'BESTSELLER', 'TRENDING', 'HOT', 'LIMITED'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-4 py-2 rounded-xl font-semibold text-xs border-2 transition-all ${
                            courseTags.includes(tag)
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white text-gray-400 border-gray-200 hover:border-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={addCustomTag}
                        className="px-4 py-2 rounded-xl font-semibold text-xs border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-all flex items-center gap-2"
                      >
                        <Plus className="w-3 h-3" /> CUSTOM
                      </button>
                    </div>
                    {courseTags.length > 0 && (
                      <div className="flex gap-2 pt-2">
                        {courseTags.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-semibold border border-blue-200 flex items-center gap-2">
                            {tag}
                            <X className="w-3 h-3 cursor-pointer" onClick={() => toggleTag(tag)} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {isBundle && (
                    <div className="p-6 bg-green-50 border border-[#10b981] rounded-2xl space-y-4 mt-6">
                      <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                        Bundle Discount Settings
                      </h4>
                      <p className="text-xs font-normal text-slate-500">
                        One discount mode can be active at a time. Whole bundle is selected by default.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setBundleDiscountMode('all')}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${bundleDiscountMode === 'all' ? 'border-[#10b981] bg-white shadow-sm' : 'border-green-200 bg-white/70 hover:border-[#10b981]'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold text-slate-900 ">Whole Bundle</div>
                              <div className="text-xs font-normal text-slate-500  mt-1">Student must select all included courses</div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 ${bundleDiscountMode === 'all' ? 'border-[#10b981] bg-[#10b981]' : 'border-gray-300 bg-white'}`} />
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setBundleDiscountMode('any');
                            if (![1, 2, 3, 5].includes(Number(bundleDiscountMinCourses))) {
                              setBundleDiscountMinCourses(3);
                            }
                          }}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${bundleDiscountMode === 'any' ? 'border-[#10b981] bg-white shadow-sm' : 'border-green-200 bg-white/70 hover:border-[#10b981]'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-semibold text-slate-900 ">Choose Any N</div>
                              <div className="text-xs font-normal text-slate-500  mt-1">Student can unlock discount with minimum selected count</div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 ${bundleDiscountMode === 'any' ? 'border-[#10b981] bg-[#10b981]' : 'border-gray-300 bg-white'}`} />
                          </div>
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className={`text-xs font-semiboldst pl-1 ${bundleDiscountMode === 'any' ? 'text-[#10b981]' : 'text-gray-400'}`}>Choose Any Count</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[3, 2, 1, 5].map((count) => {
                            const isSelected = bundleDiscountMode === 'any' && bundleDiscountMinCourses === count;
                            const isDisabled = bundleDiscountMode !== 'any';
                            return (
                              <button
                                key={count}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setBundleDiscountMinCourses(count as 1 | 2 | 3 | 5)}
                                className={`py-3 rounded-xl border-2 font-semibold text-xs  transition-all ${
                                  isSelected
                                    ? 'bg-[#10b981] text-white border-[#10b981] shadow-sm'
                                    : isDisabled
                                    ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
                                    : 'bg-white text-slate-900 border-green-200 hover:border-[#10b981]'
                                }`}
                              >
                                Any {count}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-[#10b981]st pl-1">
                            {bundleDiscountMode === 'any' ? `Discount for Any ${bundleDiscountMinCourses}+ (₹ Off)` : 'Bundle Discount (₹ Off)'}
                          </label>
                          <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xl">₹</span>
                            <input
                              type="text" inputMode="decimal"
                              value={bundleDiscountPrice}
                              onChange={e => setBundleDiscountPrice(e.target.value ? parseInt(e.target.value) : '')}
                              placeholder="e.g. 200"
                              className="w-full pl-12 pr-6 py-4 border-2 border-green-200 rounded-2xl font-semibold text-xl outline-none focus:border-[#10b981] transition-all bg-white"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-[#10b981]st pl-1">Discount Code</label>
                          <input
                            type="text"
                            value={bundleDiscountCode}
                            onChange={e => setBundleDiscountCode(e.target.value.toUpperCase())}
                            placeholder="e.g. TERM1SAVE"
                            className="w-full px-3.5 py-2.5 border-2 border-green-200 rounded-2xl font-semibold text-lg outline-none focus:border-[#10b981] transition-all bg-white "
                          />
                        </div>
                      </div>
                      {bundleDiscountPrice && bundleCourses.length > 0 && (
                        <div className="p-3 bg-white border-2 border-green-200 rounded-xl text-xs font-bold text-gray-600">
                          {bundleDiscountMode === 'all'
                            ? <>Whole bundle mode: Student gets <span className="text-[#10b981] font-semibold">₹{bundleDiscountPrice} OFF</span> when all courses are selected.</>
                            : <>Any {bundleDiscountMinCourses}+ mode: Student gets <span className="text-[#10b981] font-semibold">₹{bundleDiscountPrice} OFF</span> when selecting {bundleDiscountMinCourses} or more courses.</>
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm self-start">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-3">URL ID (Unique Text)</label>
                    <input
                      type="text"
                      defaultValue={editingCourse?.id}
                      placeholder="python-basics"
                      id="c-id"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-blue-50"
                    />
                  </div>

                  <div className="p-6 bg-blue-50/50 border border-slate-300 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <label className="block text-xs font-semibold text-slate-700">Enable Bundle System</label>
                        <span className="text-xs font-normal text-slate-500">Toggle to add multiple sub-courses</span>
                      </div>
                      <button type="button" onClick={() => setIsBundle(!isBundle)} className={`w-14 h-8 rounded-full border border-slate-300 flex items-center p-1 transition-colors ${isBundle ? 'bg-[#10b981]' : 'bg-gray-300'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full border border-slate-300 transition-transform ${isBundle ? 'translate-x-6' : ''}`} />
                      </button>
                    </div>

                    {isBundle && (
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex flex-col">
                          <label className="block text-xs font-semibold text-slate-700">Fixed Bundle?</label>
                          <span className="text-xs font-normal text-slate-500">Students cannot unselect courses</span>
                        </div>
                        <button type="button" onClick={() => setIsFixedBundle(!isFixedBundle)} className={`w-14 h-8 rounded-full border border-slate-300 flex items-center p-1 transition-colors ${isFixedBundle ? 'bg-[#3b82f6]' : 'bg-gray-300'}`}>
                          <div className={`w-5 h-5 bg-white rounded-full border border-slate-300 transition-transform ${isFixedBundle ? 'translate-x-6' : ''}`} />
                        </button>
                      </div>
                    )}

                    {isBundle && isFixedBundle && (
                      <div className="pt-6 border-t-2 border-slate-200 space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <label className="block text-sm font-semibold text-blue-600 ">Multi-Pricing Tiers</label>
                            <span className="text-xs font-normal text-slate-500">Add 2 or 3 pricing options for this fixed bundle</span>
                          </div>
                          {pricingOptions.length < 3 && (
                            <button 
                              type="button" 
                              onClick={addPricingOption}
                              className="text-xs font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 shadow-sm"
                            >
                              + ADD TIER
                            </button>
                          )}
                        </div>

                        {pricingOptions.length === 1 && (
                          <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-xl flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <p className="text-[10px] font-semibold text-amber-800 ">Multi-pricing requires at least 2 options. Add another or remove this one to use default pricing.</p>
                          </div>
                        )}

                        <div className="space-y-4">
                          {pricingOptions.map((opt, idx) => (
                            <div key={idx} className="p-5 bg-white border border-slate-300 rounded-2xl shadow-sm space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-gray-400 ">Tier Name</label>
                                  <input 
                                    value={opt.name} 
                                    onChange={e => updatePricingOption(idx, 'name', e.target.value)}
                                    placeholder="e.g. Live Only"
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl font-bold outline-none focus:border-blue-400"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-gray-400 ">Price (₹)</label>
                                  <input 
                                    type="text" inputMode="decimal"
                                    value={opt.price} 
                                    onChange={e => updatePricingOption(idx, 'price', parseInt(e.target.value) || 0)}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl font-bold outline-none focus:border-blue-400"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-400  block mb-1">Class Type</label>
                                  <select 
                                    value={opt.type}
                                    onChange={e => updatePricingOption(idx, 'type', e.target.value)}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl font-bold outline-none focus:border-blue-400 bg-white"
                                  >
                                    <option value="recorded">Recorded</option>
                                    <option value="live">Live</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-400  block mb-1">Tag (Optional)</label>
                                  <select 
                                    value={opt.tag || ''}
                                    onChange={e => updatePricingOption(idx, 'tag', e.target.value || undefined)}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl font-bold outline-none focus:border-blue-400 bg-white"
                                  >
                                    <option value="">None</option>
                                    <option value="bestseller">Bestseller</option>
                                    <option value="new">New</option>
                                    <option value="popular">Popular</option>
                                    <option value="limited">Limited</option>
                                  </select>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-gray-400 ">Description (Optional)</label>
                                <textarea 
                                  value={opt.description || ''}
                                  onChange={e => updatePricingOption(idx, 'description', e.target.value)}
                                  placeholder="e.g. Includes all live sessions with doubt clearing and 1-on-1 mentoring"
                                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl font-bold outline-none focus:border-blue-400 resize-none h-20"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-blue-600 ">Custom Banner Context (Optional)</label>
                                <input 
                                  type="text"
                                  value={opt.banner_text || ''}
                                  onChange={e => updatePricingOption(idx, 'banner_text', e.target.value)}
                                  placeholder="e.g. GET LIVE DOUBT SOLVING + EXCLUSIVE STUDY NOTES WITH THIS PLAN!"
                                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl font-bold outline-none focus:border-blue-400 bg-white"
                                />
                              </div>
                              <div className="flex justify-end">
                                <button 
                                  type="button" 
                                  onClick={() => askConfirm({ title: 'Remove this pricing tier?', message: 'It will be removed from the course. You still need to save the course for this to take effect.', confirmLabel: 'Remove tier', onConfirm: () => removePricingOption(idx) })}
                                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl border-2 border-transparent hover:border-red-100"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {pricingOptions.length === 0 && (
                            <div className="text-center py-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold text-xs">
                              No special pricing tiers added. Will use default course price.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t-2 border-slate-200 space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-500st">
                          {isBundle ? `Included Courses (${bundleCourses.length}/10)` : 'Main Enrollment ID'}
                        </span>
                        {isBundle && bundleCourses.length < 10 && (
                          <button type="button" onClick={addBundleCourse} className="text-xs font-semibold bg-slate-900 text-white px-3 py-1 rounded-lg hover:bg-gray-800">
                            + ADD COURSE
                          </button>
                        )}
                      </div>
                      {bundleCourses.map((bc, idx) => (
                        <div key={idx} className="p-8 bg-white border border-slate-300 rounded-[2.5rem] shadow-sm space-y-6 mb-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-blue-600st pl-1">Course ID</label>
                              {bc.courseId3 === undefined && (
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    if (bc.courseId2 === undefined) updateBundleCourse(idx, 'courseId2', '');
                                    else if (bc.courseId3 === undefined) updateBundleCourse(idx, 'courseId3', '');
                                  }}
                                  className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5 shadow-sm hover:shadow-none translate-y-[-2px] hover:translate-y-0"
                                >
                                  <Plus className="w-3 h-3" /> ADD ID
                                </button>
                              )}
                            </div>
                            
                            <div className="space-y-3">
                              <input 
                                value={bc.courseId} 
                                onChange={e => updateBundleCourse(idx, 'courseId', e.target.value)} 
                                placeholder="Primary Course ID" 
                                className="w-full px-6 py-4 bg-blue-50/50 border-2 border-blue-200 rounded-xl font-medium text-base outline-none focus:border-blue-400 focus:bg-white transition-all " 
                              />

                              {bc.courseId2 !== undefined && (
                                <div className="relative">
                                  <input 
                                    value={bc.courseId2} 
                                    onChange={e => updateBundleCourse(idx, 'courseId2', e.target.value)} 
                                    placeholder="Extra ID 2 (Optional)" 
                                    className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-medium text-base outline-none focus:border-blue-400 focus:bg-white transition-all " 
                                  />
                                  <button 
                                    onClick={() => {
                                      const updated = [...bundleCourses];
                                      const { courseId2: _, ...rest } = updated[idx];
                                      updated[idx] = rest as any;
                                      setBundleCourses(updated);
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 p-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}

                              {bc.courseId3 !== undefined && (
                                <div className="relative">
                                  <input 
                                    value={bc.courseId3} 
                                    onChange={e => updateBundleCourse(idx, 'courseId3', e.target.value)} 
                                    placeholder="Extra ID 3 (Optional)" 
                                    className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-medium text-base outline-none focus:border-blue-400 focus:bg-white transition-all " 
                                  />
                                  <button 
                                    onClick={() => {
                                      const updated = [...bundleCourses];
                                      const { courseId3: _, ...rest } = updated[idx];
                                      updated[idx] = rest as any;
                                      setBundleCourses(updated);
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 p-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400st pl-1">Course Title</label>
                            <input 
                              value={bc.courseName} 
                              onChange={e => updateBundleCourse(idx, 'courseName', e.target.value)} 
                              placeholder="Enter the full display name..." 
                              className="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-xl font-medium text-base outline-none focus:border-slate-400 transition-all" 
                            />
                          </div>

                          <div className="space-y-6 pt-2">
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-[#10b981]st pl-1">Price (₹)</label>
                              <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xl">₹</span>
                                <input 
                                  type="text" inputMode="decimal" 
                                  value={bc.price} 
                                  onChange={e => {
                                     const newPrice = parseInt(e.target.value) || 0;
                                     updateBundleCourse(idx, 'price', newPrice);
                                     if (!isBundle) {
                                       const discountInput = document.getElementById('c-discount') as HTMLInputElement;
                                       const priceInput = document.getElementById('c-price') as HTMLInputElement;
                                       if (discountInput && discountInput.value) {
                                         discountInput.value = String(newPrice);
                                       } else if (priceInput) {
                                         priceInput.value = String(newPrice);
                                       }
                                     }
                                   }} 
                                  className="w-full pl-12 pr-6 py-4 border-2 border-gray-200 rounded-2xl font-semibold text-lg outline-none focus:border-[#10b981] transition-all" 
                                />
                              </div>
                            </div>

                            {isBundle && (
                              <button 
                                type="button" 
                                onClick={() => askConfirm({ title: 'Remove this course from the bundle?', message: 'You still need to save the course for this to take effect.', confirmLabel: 'Remove course', onConfirm: () => removeBundleCourse(idx) })} 
                                className="w-full py-4 text-red-500 bg-red-50 border-2 border-red-100 rounded-2xl font-semibold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center gap-3"
                              >
                                <Trash2 className="w-5 h-5" /> Remove Course
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>


                  </div>
                </div>
              </div>

              <div className="hidden">
                <button 
                  id="course-editor-save"
                  onClick={() => {
                    const rawId = (document.getElementById('c-id') as HTMLInputElement)?.value || editingCourse?.id;
                    const id = sanitizeCourseId(rawId);
                    const name = (document.getElementById('c-name') as HTMLInputElement).value;
                    const subtitle = (document.getElementById('c-subtitle') as HTMLTextAreaElement).value;
                    const cohortContent = (document.getElementById('c-cohort') as HTMLTextAreaElement).value;
                    let price = (document.getElementById('c-price') as HTMLInputElement).value;
                    let discountPrice = (document.getElementById('c-discount') as HTMLInputElement).value;

                    // Keep SQL columns price/discountPrice in sync with Main Enrollment price for single courses
                    if (!isBundle && bundleCourses.length > 0) {
                      const mainPrice = bundleCourses[0].price || 0;
                      if (discountPrice) {
                        discountPrice = String(mainPrice);
                      } else {
                        price = String(mainPrice);
                      }
                    }

                    const isPinned = (document.getElementById('c-pinned') as HTMLSelectElement)?.value === 'true';
                    const active = (document.getElementById('c-active') as HTMLSelectElement)?.value !== 'false';
                    const category = (document.getElementById('c-category') as HTMLInputElement).value;
                    const class_type = (document.getElementById('c-class-type') as HTMLSelectElement)?.value || 'recorded';

                    const startDate = (document.getElementById('c-start') as HTMLInputElement).value;
                    const endDate = (document.getElementById('c-end') as HTMLInputElement).value;

                    if (!id) {
                      alert('Please enter a valid database ID.');
                      return;
                    }
                    if (bundleCourses.length === 0 || bundleCourses.some(bc => !bc.courseId || !bc.courseName)) {
                      alert('Please fill course ID and name for at least one entry!');
                      return;
                    }
                    if (discountPrice && parseInt(discountPrice) >= parseInt(price)) {
                      alert('Discount price must be less than the original price!');
                      return;
                    }

                    if (isBundle && isFixedBundle && pricingOptions.length === 1) {
                      alert('Multi-pricing requires at least 2 tiers. Please add another tier or remove the current one to use default pricing.');
                      return;
                    }

                    if (isBundle && bundleDiscountMode === 'any' && ![1, 2, 3, 5].includes(Number(bundleDiscountMinCourses))) {
                      alert('Please choose a valid minimum course count (1, 2, 3, or 5) for Any mode.');
                      return;
                    }
                    if (isBundle && bundleDiscountMode === 'any' && Number(bundleDiscountMinCourses) > bundleCourses.length) {
                      alert(`This bundle has only ${bundleCourses.length} course rows. Choose a smaller Any count.`);
                      return;
                    }
                    if (courseTerm !== 'NONE' && availableBoxesForSelectedTerm.length > 0 && selectedExamStages.length === 0) {
                      alert('Please choose at least one box for this course.');
                      return;
                    }

                    void persistCoursePageSettings(id).then((pageError) => {
                      if (pageError) console.error('Course page notes were not saved:', pageError.message);
                    });

                    const bundleCoursesForSave = bundleCourses.map((bc, idx) => {
                      if (idx !== 0) {
                        const { _bundleDiscountMode: _mode, _bundleDiscountMinCourses: _min, _bundleDiscountAmount: _amt, ...rest } = bc as any;
                        return rest;
                      }

                      return {
                        ...bc,
                        _bundleDiscountAmount: isBundle && bundleDiscountPrice ? Number(bundleDiscountPrice) : undefined,
                        _bundleDiscountMode: isBundle ? bundleDiscountMode : undefined,
                        _bundleDiscountMinCourses: isBundle && bundleDiscountMode === 'any' ? bundleDiscountMinCourses : undefined,
                      };
                    });

                    let finalCourseTags = courseTags.filter(t => !['Term 1', 'Term 2', 'TERM 1', 'TERM 2', 'Both Terms', 'BOTH'].includes(t));
                    if (courseTerm === 'Foundation') {
                      if (courseFoundationTerm === 'BOTH') {
                        finalCourseTags.push('Term 1', 'Term 2');
                      } else {
                        finalCourseTags.push(courseFoundationTerm);
                      }
                    }

                    handleCourseAction({ 
                      id, previousId: editingCourse?.id, name, price, isPinned, active, subtitle,
                      cohortContent,
                      category,
                      class_type,

                      discountPrice: discountPrice || null,
                      isBundle,
                      bundleCourses: bundleCoursesForSave,
                      bundleDiscountPrice: isBundle && bundleDiscountPrice ? Number(bundleDiscountPrice) : null,
                      bundleDiscountAmount: isBundle && bundleDiscountPrice ? Number(bundleDiscountPrice) : null,
                      bundleDiscountCode: isBundle && bundleDiscountCode ? bundleDiscountCode : null,
                      bundleDiscountMode: isBundle ? bundleDiscountMode : null,
                      bundleDiscountMinCourses: isBundle && bundleDiscountMode === 'any' ? bundleDiscountMinCourses : null,
                      isFixedBundle: isBundle && isFixedBundle,
                      pricing_options: isBundle && isFixedBundle ? pricingOptions : [],
                      tags: finalCourseTags,
                      courseCategory,
                      term: courseTerm,
                      startDate: startDate ? new Date(startDate).toISOString() : null,
                      endDate: endDate ? new Date(endDate).toISOString() : null,
                      exam_stages: selectedExamStages,
                    });
                  }}
                />
              </div>
      </ManagerFullPageSheet>


      {/* Discount Editor — full page */}
      <ManagerFullPageSheet
        open={!!(showAddDiscount || editingDiscount)}
        title={editingDiscount ? 'Edit coupon' : 'Create coupon'}
        subtitle={editingDiscount?.code || 'Configure discount rules and limits'}
        onClose={() => { setShowAddDiscount(false); setEditingDiscount(null); }}
        onSave={() => document.getElementById('discount-editor-save')?.click()}
        saveLabel="Save coupon"
        maxWidthClass="max-w-6xl"
      >
              <div className="space-y-6 bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm">
                <div>
                  <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">Coupon Code*</label>
                  <input type="text" defaultValue={editingDiscount?.code} id="d-code" placeholder="e.g. WELCOME100" className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-black text-xl uppercase focus:ring-[6px] ring-purple-100 outline-none" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">Discount Type</label>
                    <select
                      value={discountValueType}
                      onChange={e => setDiscountValueType(e.target.value as 'percentage' | 'amount')}
                      className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-bold focus:ring-[6px] ring-purple-100 outline-none bg-white"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="amount">Fixed Amount (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">Discount Value</label>
                    <input
                      key={discountValueType}
                      type="text" inputMode="decimal"
                      defaultValue={discountValueType === 'percentage' ? editingDiscount?.discount_percentage : editingDiscount?.discount_amount}
                      id="d-value"
                      placeholder={discountValueType === 'percentage' ? '% Off' : '₹ Off'}
                      className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-bold focus:ring-[6px] ring-purple-100 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">For Whom:</label>
                  <select 
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value as 'all' | 'specific')}
                    className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-bold focus:ring-[6px] ring-purple-100 outline-none bg-white mb-4"
                  >
                    <option value="all">Everyone</option>
                    <option value="specific">Specific Emails</option>
                  </select>

                  {discountType === 'specific' && (
                    <div className="space-y-3 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl mb-6">
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">Allowed Email Addresses</label>
                      <textarea
                        value={discountEmails}
                        onChange={e => setDiscountEmails(e.target.value)}
                        placeholder="student@example.com, parent@example.com, another@email.com"
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-bold outline-none focus:border-purple-400 resize-y"
                      />
                      <p className="text-xs font-bold text-gray-400">
                        Add any number of emails. Separate each email with a comma.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">Applies To:</label>
                  <select id="d-applies" defaultValue={editingDiscount?.applies_to || 'ALL'} className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-bold focus:ring-[6px] ring-purple-100 outline-none bg-white">
                    <option value="ALL">ALL COURSES (Global Discount)</option>
                    {discountOptions.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.isBundle ? '[Bundle]' : '[Course]'} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">Start Date (Optional)</label>
                    <input type="datetime-local" defaultValue={toDateTimeLocal(editingDiscount?.start_date)} id="d-start" className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-bold focus:ring-[6px] ring-purple-100 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">Expiry Date (Optional)</label>
                    <input type="datetime-local" defaultValue={toDateTimeLocal(editingDiscount?.expires_at)} id="d-expires" className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-bold focus:ring-[6px] ring-purple-100 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">Max Uses (Optional)</label>
                    <input type="text" inputMode="decimal" min="1" defaultValue={editingDiscount?.max_uses || ''} id="d-max-uses" placeholder="Unlimited" className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-bold focus:ring-[6px] ring-purple-100 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">Min Order Value (Optional)</label>
                    <input type="text" inputMode="decimal" min="0" defaultValue={editingDiscount?.min_order_value || ''} id="d-min-order" placeholder="₹ No minimum" className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-bold focus:ring-[6px] ring-purple-100 outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-black text-[#0b1120] uppercase mb-3">Max Discount (Optional)</label>
                    <input type="text" inputMode="decimal" min="0" defaultValue={editingDiscount?.max_discount_amount || editingDiscount?.max_discount || ''} id="d-max-discount" placeholder="₹ No maximum (e.g. 100 or 1000)" className="w-full px-6 py-4 border-[3px] border-[#0b1120] rounded-2xl font-bold focus:ring-[6px] ring-purple-100 outline-none" />
                    <p className="text-xs font-bold text-gray-400 mt-2">
                      Cap the maximum discount amount a user can get (e.g. for a 15% discount, cap savings to ₹100 or ₹1000).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'First Purchase Only', description: 'Only users with no prior paid orders', checked: couponFirstPurchaseOnly, set: setCouponFirstPurchaseOnly },
                    { label: 'Single Use per User', description: 'Each user can use only once', checked: couponSingleUsePerUser, set: setCouponSingleUsePerUser },
                    { label: 'Hidden/Private', description: 'Stored as private for public listings', checked: couponHidden, set: setCouponHidden },
                    { label: 'Active', description: 'Coupon is usable', checked: couponActive, set: setCouponActive },
                  ].map(option => (
                    <button
                      type="button"
                      key={option.label}
                      onClick={() => option.set(!option.checked)}
                      className="p-4 rounded-2xl border-2 border-gray-200 text-left flex items-start gap-3 hover:border-purple-300 transition-colors"
                    >
                      <span className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${option.checked ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white border-gray-300'}`}>
                        {option.checked ? '✓' : ''}
                      </span>
                      <span>
                        <span className="block font-black text-[#0b1120]">{option.label}</span>
                        <span className="block text-xs font-bold text-gray-400 mt-1">{option.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden">
                <button 
                  id="discount-editor-save"
                  onClick={() => {
                    const code = (document.getElementById('d-code') as HTMLInputElement).value;
                    const discount_value = (document.getElementById('d-value') as HTMLInputElement).value;
                    const applies_to = (document.getElementById('d-applies') as HTMLSelectElement).value;
                    const start_date = (document.getElementById('d-start') as HTMLInputElement).value;
                    const expires_at = (document.getElementById('d-expires') as HTMLInputElement).value;
                    const max_uses = (document.getElementById('d-max-uses') as HTMLInputElement).value;
                    const min_order_value = (document.getElementById('d-min-order') as HTMLInputElement).value;
                    const max_discount_amount = (document.getElementById('d-max-discount') as HTMLInputElement).value;

                    if (!code) {
                      alert('Please enter a coupon code.');
                      return;
                    }
                    if (!discount_value) {
                      alert('Please specify a discount value.');
                      return;
                    }
                    if (discountValueType === 'percentage' && (Number(discount_value) <= 0 || Number(discount_value) > 100)) {
                      alert('Percentage discount must be between 1 and 100.');
                      return;
                    }
                    if (discountValueType === 'amount' && Number(discount_value) <= 0) {
                      alert('Fixed amount discount must be greater than 0.');
                      return;
                    }
                    if (start_date && expires_at && new Date(start_date) >= new Date(expires_at)) {
                      alert('Expiry date must be after the start date.');
                      return;
                    }

                    handleDiscountAction({ 
                      id: editingDiscount?.id,
                      code,
                      discount_percentage: discountValueType === 'percentage' ? discount_value : '',
                      discount_amount: discountValueType === 'amount' ? discount_value : '',
                      max_discount_amount,
                      applies_to,
                      start_date,
                      expires_at,
                      max_uses,
                      min_order_value,
                      first_purchase_only: couponFirstPurchaseOnly,
                      single_use_per_user: couponSingleUsePerUser,
                      hidden: couponHidden,
                      active: couponActive,
                      discountType,
                      discountEmails
                    });
                  }}
                />
              </div>
      </ManagerFullPageSheet>

      {/* User details — full page */}
      <ManagerFullPageSheet
        open={!!selectedUser}
        title={selectedUser?.name || 'Anonymous user'}
        subtitle={[selectedUser?.email, selectedUser?.phone].filter(Boolean).join(' · ')}
        onClose={() => setSelectedUser(null)}
        maxWidthClass="max-w-6xl"
      >
              {isLoadingUserDetails ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm font-medium">Loading user data…</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
                  {/* LEFT: profile + stats */}
                  <aside className="space-y-5 lg:sticky lg:top-0">
                    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-semibold shrink-0">
                          {(selectedUser?.name || selectedUser?.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-slate-900 truncate">{selectedUser?.name || 'Anonymous user'}</div>
                          <div className="text-xs text-slate-500">
                            {selectedUser?.created_at ? `Joined ${new Date(selectedUser.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Join date unknown'}
                          </div>
                        </div>
                      </div>

                      <dl className="mt-5 space-y-3 text-sm">
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</dt>
                          <dd className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-slate-800 break-all">{selectedUser?.email || '—'}</span>
                            {selectedUser?.email && (
                              <button type="button" onClick={() => navigator.clipboard?.writeText(selectedUser.email)} title="Copy email" className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Phone</dt>
                          <dd className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-slate-800 font-mono text-[13px]">{selectedUser?.phone || '—'}</span>
                            {selectedUser?.phone && (
                              <button type="button" onClick={() => navigator.clipboard?.writeText(selectedUser.phone)} title="Copy phone" className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Roles</dt>
                          <dd className="mt-1">
                            {selectedUser?._roles ? (
                              <div className="space-y-1.5">
                                <RoleBadges roles={selectedUser._roles} max={12} />
                                {selectedUser._roles.employee && (
                                  <div className="text-xs text-slate-500">
                                    Employee ID {selectedUser._roles.employee.employee_id} · {selectedUser._roles.employee.department} · {selectedUser._roles.employee.status}
                                  </div>
                                )}
                                {selectedUser._roles.applications.map((a: any, i: number) => (
                                  <div key={i} className="text-xs text-slate-500">Application: {a.role_title} — {a.status}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Open from the Users tab to see roles.</span>
                            )}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        {waNumber(selectedUser?.phone) ? (
                          <a href={`https://wa.me/${waNumber(selectedUser?.phone)}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                            WhatsApp
                          </a>
                        ) : (
                          <span className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-semibold">No number</span>
                        )}
                        {selectedUser?.email ? (
                          <a href={`mailto:${selectedUser.email}`}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                            Email
                          </a>
                        ) : (
                          <span className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-semibold">No email</span>
                        )}
                      </div>
                    </section>

                    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
                        <div className="p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Orders</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{selectedUserOrders.length}</div>
                          <div className="text-xs text-slate-500">{paidSelectedUserOrders.length} paid</div>
                        </div>
                        <div className="p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total spent</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">₹{selectedUserTotalSpent.toLocaleString('en-IN')}</div>
                          <div className="text-xs text-slate-500">Paid orders</div>
                        </div>
                        <div className="p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Referrals</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{selectedUserReferrals.length}</div>
                          <div className="text-xs text-slate-500">
                            {selectedUserWallet?.referral_code ? (
                              <>Code <span className="font-mono font-semibold text-violet-700">{selectedUserWallet.referral_code}</span></>
                            ) : 'No code'}
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Coin wallet</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums flex items-center gap-1.5">
                            {selectedUserWallet?.wallet_balance || 0} <Coins className="w-4 h-4 text-amber-500" />
                          </div>
                          <div className="text-xs text-slate-500">
                            Earned {selectedUserReferrals.reduce((sum, r) => sum + (r.referrer_reward || 0), 0)}
                          </div>
                        </div>
                      </div>
                    </section>
                  </aside>

                  {/* RIGHT: activity */}
                  <div className="space-y-5 min-w-0">
                    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-slate-500" /> Order history
                        </h4>
                        <span className="text-xs text-slate-500">{selectedUserOrders.length} total</span>
                      </div>

                      {selectedUserOrders.length === 0 ? (
                        <p className="text-sm text-slate-500 px-5 py-10 text-center">No orders found.</p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {selectedUserOrders.map((order) => (
                            <li key={order.order_id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
                              <div className="sm:w-32 shrink-0">
                                <div className="text-sm font-medium text-slate-800">
                                  {order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400 truncate" title={order.order_id}>{order.order_id}</div>
                              </div>
                              <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
                                {Array.isArray(order.course_ids) && order.course_ids.length > 0 ? order.course_ids.map((cid: string) => (
                                  <span key={cid} className="px-2.5 py-1 bg-slate-50 text-xs font-medium text-slate-700 rounded-md border border-slate-200">
                                    {resolveCourseTitle(cid)}
                                  </span>
                                )) : <span className="text-xs text-slate-400">—</span>}
                              </div>
                              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:w-24 shrink-0">
                                <div className="text-sm font-semibold text-slate-900 tabular-nums">₹{order.total_amount}</div>
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase border ${
                                  order.status === 'PAID'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {order.status}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <Gift className="w-4 h-4 text-violet-500" /> Referral activity
                        </h4>
                        <span className="text-xs text-slate-500">{selectedUserReferrals.length} total</span>
                      </div>

                      {selectedUserReferrals.length === 0 ? (
                        <p className="text-sm text-slate-500 px-5 py-10 text-center">No referrals yet.</p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {selectedUserReferrals.map((ref) => (
                            <li key={ref.id} className="px-5 py-3.5 flex items-center gap-4">
                              <div className="flex-1 min-w-0 text-sm font-medium text-slate-800 break-all">{ref.buyer_email}</div>
                              <div className="text-xs text-slate-500 whitespace-nowrap">
                                {ref.created_at ? new Date(ref.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                              </div>
                              <div className="w-16 text-right text-sm font-semibold text-amber-700 tabular-nums">+{ref.referrer_reward}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                </div>
              )}
      </ManagerFullPageSheet>

      <ConfirmDialog options={confirmDialog} onClose={() => setConfirmDialog(null)} />
      <BusyModal message={busyMessage} />
    </div>
  );
}

function BoxesManager({
  boxConfig,
  setBoxConfig
}: {
  boxConfig: Record<CourseTerm, string[]>;
  setBoxConfig: Dispatch<SetStateAction<Record<CourseTerm, string[]>>>;
}) {
  const [activeTerm, setActiveTerm] = useState<CourseTerm>('Foundation');
  const [draftConfig, setDraftConfig] = useState<Record<CourseTerm, string[]>>(boxConfig);
  const [newBoxName, setNewBoxName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setDraftConfig(boxConfig);
  }, [boxConfig]);

  const boxesForActiveTerm = draftConfig[activeTerm] || [];

  const addBox = () => {
    const boxName = newBoxName.trim();
    if (!boxName) return;

    const alreadyExists = boxesForActiveTerm.some((box) => box.toLowerCase() === boxName.toLowerCase());
    if (alreadyExists) {
      setError('That box already exists for this term.');
      setSuccess('');
      return;
    }

    setDraftConfig({
      ...draftConfig,
      [activeTerm]: [...boxesForActiveTerm, boxName]
    });
    setNewBoxName('');
    setError('');
    setSuccess('');
  };

  const updateBox = (index: number, value: string) => {
    const updatedBoxes = [...boxesForActiveTerm];
    updatedBoxes[index] = value;
    setDraftConfig({
      ...draftConfig,
      [activeTerm]: updatedBoxes
    });
  };

  const [confirmDialog, setConfirmDialog] = useState<ConfirmOptions | null>(null);
  const askConfirm = (opts: ConfirmOptions) => setConfirmDialog(opts);

  const removeBox = (boxName: string) => {
    setDraftConfig({
      ...draftConfig,
      [activeTerm]: boxesForActiveTerm.filter((box) => box !== boxName)
    });
    setError('');
    setSuccess('');
  };

  const handleSaveBoxes = async () => {
    const cleanedConfig = TERM_OPTIONS.reduce((acc, term) => {
      const uniqueBoxes = Array.from(new Set(
        (draftConfig[term] || [])
          .map((box) => box.trim())
          .filter(Boolean)
      ));
      acc[term] = uniqueBoxes;
      return acc;
    }, {} as Record<CourseTerm, string[]>);

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const { error: saveError } = await supabase
        .from('settings')
        .upsert({ key: 'exam_visibility', value: JSON.stringify(cleanedConfig) });

      if (saveError) throw saveError;

      setDraftConfig(cleanedConfig);
      setBoxConfig(cleanedConfig);
      setSuccess('Boxes saved successfully.');
    } catch (err: any) {
      console.error('Failed to save boxes:', err);
      setError(err.message || 'Failed to save boxes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm space-y-6">
      <ConfirmDialog options={confirmDialog} onClose={() => setConfirmDialog(null)} />
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Boxes</h2>
        <p className="text-slate-500 text-sm">
          Add exam boxes students choose after selecting a term, then assign courses into those boxes from course edit.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        {TERM_OPTIONS.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => {
              setActiveTerm(term);
              setError('');
              setSuccess('');
            }}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
              activeTerm === term
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {term}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{activeTerm} Boxes</h3>
          {boxesForActiveTerm.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-sm">
              No boxes added
            </div>
          ) : (
            <div className="space-y-2">
              {boxesForActiveTerm.map((box, index) => (
                <div key={`${box}-${index}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={box}
                    onChange={(e) => updateBox(index, e.target.value)}
                    className="flex-grow px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => askConfirm({ title: 'Remove this box?', message: `“${box}” will be removed from the list.`, confirmLabel: 'Remove box', onConfirm: () => removeBox(box) })}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove box"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-fit space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Add Box to {activeTerm}</h3>
          <div className="space-y-2">
            <input
              type="text"
              value={newBoxName}
              placeholder="e.g. Quiz 1, End Term"
              onChange={(e) => setNewBoxName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:border-slate-400"
            />
            <button
              type="button"
              onClick={addBox}
              className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
            >
              + Add Box
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveBoxes}
            disabled={saving}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Boxes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsManager() {
  const [videoUrl, setVideoUrl] = useState('');
  const [howToUrl, setHowToUrl] = useState('');
  const [savingHowTo, setSavingHowTo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const { data: videoData, error: videoError } = await supabase
          .from('settings')
          .select('*')
          .eq('key', 'homepage_video_url')
          .maybeSingle();
        
        if (videoError) throw videoError;
        if (videoData) {
          setVideoUrl(videoData.value);
        }
        const { data: howToData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'course_howto_video_url')
          .maybeSingle();
        if (howToData?.value) setHowToUrl(howToData.value);
      } catch (err: any) {
        console.error('Failed to load settings:', err);
        setError('Failed to load system settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const { error: videoError } = await supabase
        .from('settings')
        .upsert({ key: 'homepage_video_url', value: videoUrl.trim() });
      if (videoError) throw videoError;

      setSuccess('Video settings saved successfully!');
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const saveHowTo = async () => {
    try {
      setSavingHowTo(true);
      setError('');
      setSuccess('');
      const { error: howToError } = await supabase
        .from('settings')
        .upsert({ key: 'course_howto_video_url', value: howToUrl.trim() });
      if (howToError) throw howToError;
      setSuccess('How-to video saved. It now shows beside the FAQs on every course page.');
    } catch (err: any) {
      setError(err.message || 'Failed to save the how-to video');
    } finally {
      setSavingHowTo(false);
    }
  };

  const videoId = getYouTubeId(videoUrl);
  const howToId = getYouTubeId(howToUrl);

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-400 text-sm font-medium bg-white border border-slate-200 rounded-xl shadow-sm">
          Loading settings…
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Homepage Video Modal</h2>
            <p className="text-slate-500 text-sm">
              Configure the YouTube video popup shown to homepage visitors.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 block">
                YouTube Video URL
              </label>
              <input
                type="text"
                placeholder="e.g. https://www.youtube.com/watch?v=…"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-colors placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-400">
                Supports normal, short, or embed links. Clear the URL to disable the popup.
              </p>
            </div>

            {videoId ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 block">
                  Player Preview
                </label>
                <div className="max-w-md aspect-video border border-slate-200 rounded-xl overflow-hidden bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube video player preview"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full"
                  ></iframe>
                </div>
              </div>
            ) : videoUrl.trim() ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
                Invalid YouTube URL. Preview not available.
              </div>
            ) : null}

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Video Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Course Page &ldquo;How to use&rdquo; Video</h2>
            <p className="text-slate-500 text-sm">
              Shown beside the FAQs at the bottom of every course page. Clear the URL to hide the video and show the FAQs full width.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 block">YouTube Video URL</label>
              <input
                type="text"
                placeholder="e.g. https://www.youtube.com/watch?v=…"
                value={howToUrl}
                onChange={(e) => setHowToUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-colors placeholder:text-slate-400"
              />
            </div>
            {howToId ? (
              <div className="max-w-md aspect-video border border-slate-200 rounded-xl overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${howToId}`}
                  title="How-to video preview"
                  frameBorder="0"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            ) : howToUrl.trim() ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
                Invalid YouTube URL. Preview not available.
              </div>
            ) : null}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={saveHowTo}
                disabled={savingHowTo}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {savingHowTo ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>) : (<><Save className="w-4 h-4" /> Save How-to Video</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
