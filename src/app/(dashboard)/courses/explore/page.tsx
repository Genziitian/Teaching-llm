'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import useSWR from 'swr'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, FileText, Users, ClipboardList, Trash2, Pencil, Sparkles, IndianRupee, Calendar, Plus, ExternalLink, HelpCircle, ChevronRight, X, Info, ArrowLeft, Upload } from 'lucide-react'
import { normalizeMeetLink } from '@/lib/meet-link'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

const fetcher = (url: string) => fetch(url).then(res => res.json())

const CATEGORY_LABELS: Record<string, string> = {
  qualifier: 'Qualifier Courses',
  foundation: 'Foundation Courses',
  diploma: 'Diploma Courses',
  notes: 'Notes & PYQs',
}
const CATEGORY_TO_VIEW: Record<string, 'courses' | 'notes' | 'mentorship'> = {
  qualifier: 'courses',
  foundation: 'courses',
  diploma: 'courses',
  notes: 'notes',
}

export default function ExploreCoursesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryParam = (searchParams?.get('category') || '').toLowerCase()
  const { data: userData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false })
  const { data: offerings, error, isLoading } = useSWR('/api/course-offerings', fetcher, {
    revalidateOnFocus: false,
  })
  const loadingFact = useLoadingFact(isLoading)
  const { data: bundleOfferings } = useSWR('/api/bundle-offerings', fetcher, { revalidateOnFocus: false })
  const { data: storeNotesData } = useSWR('/api/store/notes', fetcher, { revalidateOnFocus: false })
  const { data: mentorshipsData } = useSWR('/api/store/mentorships', fetcher, { revalidateOnFocus: false })
  const { data: myMentorshipsData } = useSWR('/api/store/mentorships/my-bookings', fetcher, { revalidateOnFocus: true })
  const { data: staffData } = useSWR('/api/users/staff', fetcher, { revalidateOnFocus: false })
  const { data: courses } = useSWR('/api/courses', fetcher, { revalidateOnFocus: false })
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [purchasedCourse, setPurchasedCourse] = useState<any>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeSuccessOrderId, setUpgradeSuccessOrderId] = useState<string | null>(null)
  const [showInfoHint, setShowInfoHint] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingOffering, setEditingOffering] = useState<any | null>(null)
  const [editFormData, setEditFormData] = useState<any>({})
  const [editSaving, setEditSaving] = useState(false)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [recordedOriginalPrice, setRecordedOriginalPrice] = useState('')
  const [recordedDiscountPrice, setRecordedDiscountPrice] = useState('')
  const [liveOriginalPrice, setLiveOriginalPrice] = useState('')
  const [liveDiscountPrice, setLiveDiscountPrice] = useState('')
  const [championOriginalPrice, setChampionOriginalPrice] = useState('')
  const [championDiscountPrice, setChampionDiscountPrice] = useState('')
  const [championSubtitle, setChampionSubtitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [creating, setCreating] = useState(false)
  // Bundle creation (recommended bundle) states
  const [createBundle, setCreateBundle] = useState(false)
  const [bundleName, setBundleName] = useState('')
  const [bundleSelectedCourses, setBundleSelectedCourses] = useState<string[]>([])
  const [bundleRecordedOriginalPrice, setBundleRecordedOriginalPrice] = useState('')
  const [bundleRecordedDiscountPrice, setBundleRecordedDiscountPrice] = useState('')
  const [bundleLiveOriginalPrice, setBundleLiveOriginalPrice] = useState('')
  const [bundleLiveDiscountPrice, setBundleLiveDiscountPrice] = useState('')
  const [bundleChampionOriginalPrice, setBundleChampionOriginalPrice] = useState('')
  const [bundleChampionDiscountPrice, setBundleChampionDiscountPrice] = useState('')
  const [bundleChampionSubtitle, setBundleChampionSubtitle] = useState('')
  const [bundleForceClassType, setBundleForceClassType] = useState<string | null>(null)
  const [bundleIndividualMapping, setBundleIndividualMapping] = useState<Record<string, { recorded?: string; live?: string; champion?: string }>>({})
  const [bundleAllowIndividualPurchase, setBundleAllowIndividualPurchase] = useState(true)
  const [bundleTierPrices, setBundleTierPrices] = useState<Record<number, { recordedOriginal?: string, recordedDiscount?: string, liveOriginal?: string, liveDiscount?: string, championOriginal?: string, championDiscount?: string }>>({})
  const [bundleStartingPrice, setBundleStartingPrice] = useState('')
  const [bundleStartingFromText, setBundleStartingFromText] = useState('Courses start from')
  const [bundleBannerText, setBundleBannerText] = useState('Class starts from 1 June 2026')
  const [bundleCourseHeadline, setBundleCourseHeadline] = useState('Included Courses')
  const [bundleDescription, setBundleDescription] = useState('')
  const [bundleEnableBundleDiscount, setBundleEnableBundleDiscount] = useState(false)
  const [bundleDiscountType, setBundleDiscountType] = useState('PERCENTAGE')
  const [bundleDiscountValue, setBundleDiscountValue] = useState('')
  const [bundleDiscountApplicability, setBundleDiscountApplicability] = useState('BOTH')
  const [bundleRequireAllCourses, setBundleRequireAllCourses] = useState(true)
  const [infoModalOffering, setInfoModalOffering] = useState<any | null>(null)
  // Bundle purchase UI states
  const [showBundleModal, setShowBundleModal] = useState(false)
  const [activeBundle, setActiveBundle] = useState<any | null>(null)
  const [bundleAccessType, setBundleAccessType] = useState<'RECORDED' | 'LIVE'>('RECORDED')
  const [bundleSelectedForPurchase, setBundleSelectedForPurchase] = useState<Record<string, 'RECORDED' | 'LIVE' | 'CHAMPION'>>({})
  const [bundleGlobalAccessType, setBundleGlobalAccessType] = useState<'RECORDED' | 'LIVE' | 'CHAMPION'>('LIVE')
  const [bundleSelectedCoursesToBuy, setBundleSelectedCoursesToBuy] = useState<string[]>([])
  const [showBatchComparisonModal, setShowBatchComparisonModal] = useState(false)
  
  const [editingBundle, setEditingBundle] = useState<any>(null)
  const [editBundleData, setEditBundleData] = useState<any>({})
  const [editBundleSaving, setEditBundleSaving] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState<any>(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  const [storeView, setStoreView] = useState<null | 'courses' | 'notes' | 'mentorship'>(null)
  const [activeCategory, setActiveCategory] = useState<string>('')

  // New store tabs and modals category select state variables
  const [selectedStoreTab, setSelectedStoreTab] = useState<string>('')
  const [selectedNotesTab, setSelectedNotesTab] = useState<string>('')
  const [selectedNotesSubjectTab, setSelectedNotesSubjectTab] = useState<string>('')

  const [offeringCategory, setOfferingCategory] = useState<string>('')
  const [bundleCategory, setBundleCategory] = useState<string>('')
  const [noteCategory, setNoteCategory] = useState<string>('General')
  const [noteSubject, setNoteSubject] = useState<string>('')

  // If running inside Capacitor APK, prevent in-app purchases and redirect to courses
  useEffect(() => {
    const w = window as any
    const isCapacitor = !!(w?.Capacitor?.isNativePlatform?.() || w?.Capacitor?.isNative)
    if (isCapacitor) {
      router.replace('/courses')
    }
  }, [router])

  // Sync ?category= URL param into store view + active filter on mount or param change
  useEffect(() => {
    if (categoryParam && CATEGORY_TO_VIEW[categoryParam]) {
      setStoreView(CATEGORY_TO_VIEW[categoryParam])
      setActiveCategory(categoryParam)
    }
  }, [categoryParam])

  function clearCategory() {
    setActiveCategory('')
    router.replace('/courses/explore', { scroll: false })
  }
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const [showCreateBundleModal, setShowCreateBundleModal] = useState(false)
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState<any>(null)
  const [uploadingNoteFile, setUploadingNoteFile] = useState(false)
  const [showCreateMentorshipModal, setShowCreateMentorshipModal] = useState(false)
  const [editingMentorship, setEditingMentorship] = useState<any>(null)

  // Mentorship Booking
  const [showMentorshipBookingModal, setShowMentorshipBookingModal] = useState<any>(null)
  const [mentorshipBookingDate, setMentorshipBookingDate] = useState('')
  const [mentorshipBookingTimes, setMentorshipBookingTimes] = useState<string[]>([])

  // Mentorship Slots Management
  const [showManageSlotsModal, setShowManageSlotsModal] = useState<any>(null)
  const [showManageBookingsModal, setShowManageBookingsModal] = useState<any>(null)
  const [allBookingsData, setAllBookingsData] = useState<any[]>([])
  const [loadingAllBookings, setLoadingAllBookings] = useState(false)
  const [editingBookingLink, setEditingBookingLink] = useState<string | null>(null)
  const [showManualBookingModal, setShowManualBookingModal] = useState(false)
  const [allStudentsData, setAllStudentsData] = useState<any[]>([])
  const [loadingAllStudents, setLoadingAllStudents] = useState(false)
  const [manageSlotsDate, setManageSlotsDate] = useState('')
  const [manageSlotsTime, setManageSlotsTime] = useState('')
  const [editingSlots, setEditingSlots] = useState<{date: string, time: string}[]>([])
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [bookingSearchQuery, setBookingSearchQuery] = useState('')
  const [manualAvailableSlots, setManualAvailableSlots] = useState<any[]>([])
  const [loadingManualSlots, setLoadingManualSlots] = useState(false)

  // Helper to get enrollment status
  const getEnrollmentStatus = (courseId: string) => {
    const coursesArray = Array.isArray(courses) ? courses : (courses as any)?.courses || []
    const course = coursesArray.find((c: any) => c.id === courseId)
    return course?.enrollmentType || null
  }

  // Handle upgrade to Live Pro
  const handleUpgrade = async (courseId: string, offeringId: string) => {
    setIsProcessing(true)
    setUpgrading(true)
    try {
      // Create Razorpay order
      const orderRes = await fetch(`/api/courses/${courseId}/create-razorpay-order`, { method: 'POST' })
      if (!orderRes.ok) {
        const data = await orderRes.json()
        alert(data.error || 'Failed to create order')
        setIsProcessing(false)
        setUpgrading(false)
        return
      }
      const orderData = await orderRes.json()

      // Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'GenZ IItian',
        description: `PRO Upgrade — ${orderData.courseName}`,
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: orderData.userName,
          email: orderData.userEmail,
        },
        theme: { color: 'var(--accent)' },
        handler: async (response: any) => {
          setIsProcessing(true)
          try {
            const verifyRes = await fetch(`/api/courses/${courseId}/upgrade`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyRes.ok) {
              setUpgradeSuccessOrderId(verifyData.orderId)
            } else {
              alert(verifyData.error || 'Payment verification failed')
            }
          } catch {
            alert('Payment verification failed. Please contact support.')
          } finally {
            setIsProcessing(false)
            setUpgrading(false)
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false)
            setUpgrading(false)
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
      setIsProcessing(false)
    } catch (e: any) {
      alert(e.message || 'Something went wrong')
      setIsProcessing(false)
      setUpgrading(false)
    }
  }

  const handlePurchase = async (offeringId: string, accessType: 'RECORDED' | 'LIVE' | 'CHAMPION') => {
    setIsProcessing(true)
    setPurchasing(`${offeringId}-${accessType}`)
    try {
      const res = await fetch(`/api/course-offerings/${offeringId}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment')

      if (data.isFree) {
        setIsProcessing(false)
        setSuccessOrderId('FREE-ENROLLMENT')
        setPurchasedCourse({ courseName: data.courseName, accessType })
        return
      }

      // Store course info for success modal
      const offering = activeOfferings.find((o: any) => o.id === offeringId)

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'GenZ IItian',
        description: `Purchase ${data.courseName} (${accessType})`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.userName || '',
          email: data.userEmail || '',
        },
        theme: { color: 'var(--accent)' },
        handler: async (response: any) => {
          setIsProcessing(true)
          setVerifyingPayment(true)
          try {
            const verifyRes = await fetch(`/api/course-offerings/${offeringId}/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                accessType,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyRes.ok) {
              setSuccessOrderId(verifyData.orderId || 'SUCCESS')
              setPurchasedCourse({ 
                courseName: data.courseName,
                accessType,
                orderId: verifyData.orderId,
                courseTier: accessType === 'LIVE' ? 'Live + Recorded (Pro)' : 'Recorded (Plus)'
              })
            } else {
              alert('Verification failed: ' + verifyData.error)
            }
          } catch {
            alert('Payment verification failed. Please contact support.')
          } finally {
            setIsProcessing(false)
            setPurchasing(null)
            setVerifyingPayment(false)
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false)
            setPurchasing(null)
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
      setIsProcessing(false)
    } catch (err: any) {
      alert(err.message)
      setIsProcessing(false)
      setPurchasing(null)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingNoteFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'store-notes')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const json = await res.json()
        const linkEl = document.getElementById('noteLinkInput') as HTMLInputElement
        if (linkEl) {
          linkEl.value = json.url
        }
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to upload file')
      }
    } catch {
      alert('Error uploading file')
    } finally {
      setUploadingNoteFile(false)
    }
  }

  const handleNotePurchase = async (note: any) => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/store/notes/${note.id}/create-order`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.isFree) {
        alert('Note accessed successfully! You can find it in Free Resources -> Purchased Materials')
        window.open(note.files?.[0]?.fileUrl, '_blank')
        setIsProcessing(false)
        return
      }

      const options = {
        key: data.key,
        amount: data.amount,
        currency: 'INR',
        name: 'GenZ IITian',
        description: `Note Purchase: ${note.title}`,
        order_id: data.razorpayOrderId,
        handler: async function (response: any) {
          setIsProcessing(true)
          setVerifyingPayment(true)
          try {
            const verifyRes = await fetch(`/api/store/notes/${note.id}/verify-payment`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
            })
            if (verifyRes.ok) {
              setSuccessOrderId(response.razorpay_order_id);
              setPurchasedCourse({ 
                courseName: note.title, 
                courseTier: '30-Day Access',
                type: 'note' 
              });
              setTimeout(() => { window.open(note.files?.[0]?.fileUrl, '_blank') }, 1500);
            } else { alert('Payment verification failed') }
          } catch { alert('Payment verification failed') }
          finally { 
            setIsProcessing(false)
            setVerifyingPayment(false)
          }
        },
        modal: { ondismiss: () => setIsProcessing(false) }
      }
      const rzp = new (window as any).Razorpay(options)
      rzp.open()
      setIsProcessing(false)
    } catch (err: any) {
      alert(err.message || 'Error processing')
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="page-container fade-in">
        {loadingFact && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={loadingFact} />
          </div>
        )}
        <div className="grid-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card skeleton" style={{ height: '360px', borderRadius: '28px' }} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container fade-in">
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>
          Failed to load offerings. Please try again later.
        </div>
      </div>
    )
  }

  const activeOfferings = offerings || []
  const activeBundles = bundleOfferings || []

  // Dynamic Level Tabs for Courses & Bundles
  const visibleCategories = ['Re-attempt', 'Foundation', 'Diploma', 'General'].filter(cat => {
    const hasOfferings = activeOfferings.some((o: any) => (o.category || 'General') === cat)
    const hasBundles = activeBundles.some((b: any) => (b.category || 'General') === cat)
    return hasOfferings || hasBundles
  })
  const currentStoreTab = visibleCategories.includes(selectedStoreTab)
    ? selectedStoreTab
    : (visibleCategories[0] || 'General')

  const filteredOfferings = activeOfferings.filter((o: any) => (o.category || 'General') === currentStoreTab)
  const filteredBundles = activeBundles.filter((b: any) => (b.category || 'General') === currentStoreTab)

  // Dynamic Level and Subject Tabs for Store Notes
  const activeNotes = storeNotesData?.notes || []
  const visibleNotesCategories = ['Re-attempt', 'Foundation', 'Diploma', 'General'].filter(cat => {
    return activeNotes.some((n: any) => (n.category || 'General') === cat)
  })
  const currentNotesTab = visibleNotesCategories.includes(selectedNotesTab)
    ? selectedNotesTab
    : (visibleNotesCategories[0] || 'General')

  const filteredNotesByLevel = activeNotes.filter((n: any) => (n.category || 'General') === currentNotesTab)

  const getSubjectListForLevel = (level: string) => {
    if (level === 'Foundation') return ['STATS 1', 'STATS 2', 'MATH 2', 'MATH 1', 'ENG 1', 'ENG 2', 'CT', 'PYTHON']
    if (level === 'Re-attempt') return ['ENG 1', 'CT', 'MATH 1', 'STATS 1']
    return []
  }
  const levelSubjects = getSubjectListForLevel(currentNotesTab)
  const visibleNotesSubjects = levelSubjects.filter(sub => {
    return filteredNotesByLevel.some((n: any) => n.subject === sub)
  })
  const currentNotesSubjectTab = visibleNotesSubjects.includes(selectedNotesSubjectTab)
    ? selectedNotesSubjectTab
    : (visibleNotesSubjects[0] || '')

  const filteredNotes = filteredNotesByLevel.filter((n: any) => {
    if (currentNotesTab === 'Foundation' || currentNotesTab === 'Re-attempt') {
      return n.subject === currentNotesSubjectTab
    }
    return true
  })

  const getMobileHeaderConfig = () => {
    switch (storeView) {
      case 'courses':
        return {
          title: 'Courses & Bundles',
          subtitle: 'Explore our learning programs',
          backAction: () => setStoreView(null)
        }
      case 'notes':
        return {
          title: 'Premium Notes',
          subtitle: 'Handwritten & digital revision guides',
          backAction: () => setStoreView(null)
        }
      case 'mentorship':
        return {
          title: '1:1 Mentorship',
          subtitle: 'Book a live call with expert mentors',
          backAction: () => setStoreView(null)
        }
      default:
        return {
          title: 'Official Store',
          subtitle: 'Upgrade your learning package',
          backAction: () => router.back()
        }
    }
  }

  const mobileHeader = getMobileHeaderConfig()

  return (
    <>
      <style>{`
        .mobile-back-header {
          display: none !important;
        }
        @media (max-width: 767px) {
          .mobile-back-header {
            display: flex !important;
          }
          .desktop-back-btn {
            display: none !important;
          }
          .page-container {
            padding: 16px 14px 24px !important;
          }
          .store-header-banner {
            margin-top: 0 !important;
            padding-top: 10px !important;
            padding-bottom: 12px !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 40 !important;
            background: #e8eaf0 !important;
          }
          .store-category-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
          .store-category-grid .store-cat-card {
            padding: 18px 14px !important;
            border-radius: 20px !important;
          }
          .store-category-grid .store-cat-card .store-cat-icon {
            width: 48px !important;
            height: 48px !important;
            border-radius: 14px !important;
            margin-bottom: 12px !important;
          }
          .store-category-grid .store-cat-card .store-cat-icon svg {
            width: 22px !important;
            height: 22px !important;
          }
          .store-category-grid .store-cat-card h3 {
            font-size: 14px !important;
            margin-bottom: 4px !important;
          }
          .store-category-grid .store-cat-card .store-cat-sub {
            font-size: 11px !important;
            margin-bottom: 10px !important;
          }
          .store-category-grid .store-cat-card .store-cat-explore {
            font-size: 11px !important;
          }
          
          /* Responsive Bundle Buy Modal */
          .bundle-modal-box {
            padding: 16px 12px !important;
            height: calc(100dvh - 24px) !important;
            max-height: calc(100dvh - 24px) !important;
            display: flex !important;
            flex-direction: column !important;
            border-radius: 16px !important;
          }
          .bundle-modal-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
            overflow-y: auto !important;
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .bundle-modal-grid > div {
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .bundle-modal-item-body {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            width: 100% !important;
          }
          .bundle-modal-item-body > div:first-child {
            width: 100% !important;
          }
          .bundle-modal-item-body > div:last-child {
            width: 100% !important;
            justify-content: flex-start !important;
            align-items: center !important;
            gap: 12px !important;
            margin-top: 4px !important;
            padding-top: 8px !important;
            border-top: 1px dashed var(--border) !important;
          }
        }
      `}</style>
      {/* Header Banner */}
      <div className="store-header-banner" style={{
        background: 'transparent',
        padding: '0 clamp(16px, 4vw, 32px) 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '16px',
        flexWrap: 'wrap',
        marginTop: '0'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Help Button */}
          <a
            href="/support"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              padding: '10px 18px',
              borderRadius: '12px',
              border: '1.5px solid var(--border)',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              textDecoration: 'none',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-2)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <HelpCircle size={16} strokeWidth={2.5} />
            Facing any issue? Get Support
          </a>

          {userData?.user?.role === 'MANAGER' && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Create
              </button>
              {showCreateDropdown && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--surface)', borderRadius: '12px', padding: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 100, minWidth: '160px',
                  display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                  {[
                    { label: '📚 Course', action: () => { setOfferingCategory(''); setShowCreateModal(true); setShowCreateDropdown(false) } },
                    { label: '📦 Bundle', action: () => { setBundleCategory(''); setShowCreateBundleModal(true); setShowCreateDropdown(false) } },
                    { label: '📝 Notes', action: () => { setNoteCategory('General'); setNoteSubject(''); setShowCreateNoteModal(true); setShowCreateDropdown(false) } },
                    { label: '🤝 Mentorship', action: () => { setShowCreateMentorshipModal(true); setShowCreateDropdown(false) } }
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={item.action}
                      style={{
                        padding: '10px 12px', background: 'transparent', border: 'none',
                        borderRadius: '8px', textAlign: 'left', fontSize: '13px',
                        fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="page-container fade-in">
        {/* Mobile-only Header with Back Button */}
        <div className="mobile-back-header" style={{
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          padding: '8px 4px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          <button
            onClick={mobileHeader.backAction}
            style={{
              background: 'var(--surface-2)',
              boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
              border: 'none',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <span style={{ display: 'block', fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', 'Nunito', sans-serif", letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              {mobileHeader.title}
            </span>
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {mobileHeader.subtitle}
            </span>
          </div>
        </div>

      {/* STORE CATEGORY CARDS */}
      {!storeView && (
        <div className="store-category-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '24px', marginBottom: '32px' }}>
          {[
            { key: 'courses' as const, title: 'Courses', subtitle: `${(offerings || []).length + (bundleOfferings || []).length} available`, icon: <BookOpen size={28} color="#fff" />, gradient: 'linear-gradient(135deg, #4f46e5, #0ea5e9)', shadow: 'rgba(79, 70, 229, 0.25)' },
            { key: 'notes' as const, title: 'Premium Notes', subtitle: `${storeNotesData?.notes?.length || 0} notes`, icon: <FileText size={28} color="#fff" />, gradient: 'linear-gradient(135deg, #0d9488, #10b981)', shadow: 'rgba(13, 148, 136, 0.25)' },
            { key: 'mentorship' as const, title: 'Book a Call with Mentor', subtitle: `${mentorshipsData?.mentorships?.length || 0} mentors`, icon: <Users size={28} color="#fff" />, gradient: 'linear-gradient(135deg, #f97316, #f59e0b)', shadow: 'rgba(249, 115, 22, 0.25)' },
          ].map(card => (
            <div key={card.key} className="store-cat-card" onClick={() => setStoreView(card.key)} style={{ background: 'var(--surface)', borderRadius: '24px', padding: 'clamp(20px, 5vw, 32px)', cursor: 'pointer', boxShadow: '0 10px 30px rgba(15,23,42,0.06)', border: '1.5px solid var(--border)', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = `0 20px 40px ${card.shadow}` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(15,23,42,0.06)' }}
            >
              <div className="store-cat-icon" style={{ width: '64px', height: '64px', borderRadius: '20px', background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: `0 8px 20px ${card.shadow}` }}>{card.icon}</div>
              <h3 style={{ fontSize: 'clamp(18px, 4.4vw, 22px)', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '6px' }}>{card.title}</h3>
              <p className="store-cat-sub" style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '16px' }}>{card.subtitle}</p>
              <div className="store-cat-explore" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontSize: '13px', fontWeight: '700' }}>
                Explore <ChevronRight size={16} strokeWidth={3} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BACK BUTTON when inside a view */}
      {storeView && (
        <button className="desktop-back-btn" onClick={() => {
          setStoreView(null)
          setSelectedStoreTab('')
          setSelectedNotesTab('')
          setSelectedNotesSubjectTab('')
        }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginBottom: '20px', padding: '8px 0' }}>
          <ArrowLeft size={20} />
          Back to Store
        </button>
      )}

      {/* Category filter pill (when arrived via Home category card) */}
      {activeCategory && CATEGORY_LABELS[activeCategory] && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          padding: '8px 14px 8px 16px',
          borderRadius: '50px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(139,92,246,0.10))',
          border: '1px solid rgba(99, 102, 241, 0.20)',
          color: 'var(--primary)', fontSize: '12.5px', fontWeight: 800,
          marginBottom: '14px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px #6366f1' }} />
          Showing: {CATEGORY_LABELS[activeCategory]}
          <button onClick={clearCategory} aria-label="Clear filter" style={{
            background: 'rgba(99,102,241,0.15)', border: 'none', borderRadius: '50%',
            width: '22px', height: '22px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--primary)',
          }}>
            <X size={12} strokeWidth={3} />
          </button>
        </div>
      )}



      {/* Category options selection screen */}
      {storeView === 'courses' && !selectedStoreTab && visibleCategories.length > 0 && (
        <div style={{ padding: '20px 0' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '950', textAlign: 'center', marginBottom: '8px' }}>Select Level</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px' }}>Choose a level to explore available courses</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {visibleCategories.map(cat => {
              const courseCount = activeOfferings.filter((o: any) => (o.category || 'General') === cat).length;
              const bundleCount = activeBundles.filter((b: any) => (b.category || 'General') === cat).length;
              return (
                <div
                  key={cat}
                  onClick={() => setSelectedStoreTab(cat)}
                  style={{
                    background: 'var(--surface)',
                    borderRadius: '24px',
                    padding: '32px 24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
                    border: '1.5px solid var(--border)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(99,102,241,0.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(15,23,42,0.06)';
                  }}
                >
                  <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                    {cat === 'Re-attempt' ? '🔄' : cat === 'Foundation' ? '🌱' : cat === 'Diploma' ? '🎓' : '📚'}
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px' }}>{cat}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {courseCount > 0 && `${courseCount} Course${courseCount > 1 ? 's' : ''}`}
                    {courseCount > 0 && bundleCount > 0 && ' • '}
                    {bundleCount > 0 && `${bundleCount} Bundle${bundleCount > 1 ? 's' : ''}`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected category header with Change Category button */}
      {storeView === 'courses' && selectedStoreTab && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>{selectedStoreTab} Level</h2>
          <button
            onClick={() => setSelectedStoreTab('')}
            style={{
              padding: '8px 16px',
              borderRadius: '12px',
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >
            🔄 Change Category
          </button>
        </div>
      )}

      {/* Bundle offerings section */}
      {storeView === 'courses' && selectedStoreTab && filteredBundles.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ marginTop: '12px' }} />
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {filteredBundles.map((b: any) => {
              const bundlePriceRecorded = b.recordedDiscountPrice ?? b.recordedOriginalPrice
              const bundlePriceLive = b.liveDiscountPrice ?? b.liveOriginalPrice
              const bundlePriceChampion = b.championDiscountPrice ?? b.championOriginalPrice
              return (
                <div key={b.id} style={{ 
                  minWidth: '320px', 
                  maxWidth: '350px',
                  background: 'var(--surface)', 
                  borderRadius: '24px', 
                  padding: '22px', 
                  boxShadow: '0 10px 40px rgba(15,23,42,0.08)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'transform 0.3s ease',
                  cursor: 'default'
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(99,102,241,0.08)', padding: '4px 10px', borderRadius: '20px' }}>Bundle</div>
                        <Sparkles size={14} /> {b.courses.length} Courses
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px' }}>{b.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500', lineHeight: '1.5', minHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {b.description || `Special curated bundle with ${b.courses.length} premium courses.`}
                    </div>
                    {/* Included Courses Tags */}
                    {b.courses && b.courses.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                        {b.courses.map((c: any) => (
                          <span key={c.course.id} style={{ 
                            fontSize: '11px', 
                            fontWeight: '700', 
                            color: 'var(--text-secondary)', 
                            background: 'var(--surface)', 
                            padding: '4px 8px', 
                            borderRadius: '6px',
                            border: '1px solid var(--border)'
                          }}>
                            {c.course.name || c.course.subject || 'Course'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {b.bannerText || 'Class starts from 1 June 2026'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>{b.startingFromText || 'Courses start from'}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>₹</span>
                      <span style={{ fontSize: '28px', fontWeight: '950', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{b.startingPrice || (bundlePriceLive || bundlePriceRecorded || 0)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button onClick={() => { 
                      setActiveBundle(b); 
                      const defaultType = b.forceClassType || (bundlePriceChampion ? 'CHAMPION' : (bundlePriceLive ? 'LIVE' : (bundlePriceRecorded ? 'RECORDED' : 'LIVE')));
                      setBundleAccessType(defaultType as 'RECORDED' | 'LIVE'); // Cast for compatibility with existing state if needed, but we'll update the state type below
                      setBundleGlobalAccessType(defaultType as 'RECORDED' | 'LIVE' | 'CHAMPION');
                      
                      // Initialize per-course access types
                      const initialSelections: Record<string, 'RECORDED' | 'LIVE' | 'CHAMPION'> = {};
                      b.courses.forEach((bc: any) => {
                        const offering = bc.course.courseOfferings?.[0];
                        const hasChamp = offering?.championDiscountPrice > 0 || offering?.championOriginalPrice > 0;
                        
                        // If bundle is fixed, everyone gets the global default. 
                        // If not fixed, we try to set CHAMPION for individual courses if available, else bundle default.
                        if (b.allowIndividualPurchase === false) {
                          initialSelections[bc.course.id] = defaultType as 'RECORDED' | 'LIVE' | 'CHAMPION';
                        } else {
                          initialSelections[bc.course.id] = (hasChamp ? 'CHAMPION' : (defaultType || 'LIVE')) as 'RECORDED' | 'LIVE' | 'CHAMPION';
                        }
                      });
                      setBundleSelectedForPurchase(initialSelections);

                      setBundleSelectedCoursesToBuy(b.courses.map((c: any) => c.course.id).filter((id: string) => {
                        if (b.allowIndividualPurchase === false) return true;
                        const isManager = userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER';
                        return isManager || getEnrollmentStatus(id) === null;
                      })); 
                      setCouponApplied(null);
                      setCouponCode('');
                      setCouponError('');
                      setShowBundleModal(true) 
                    }} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: '900', fontSize: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 20px rgba(99,102,241,0.25)' }}>View / Buy</button>
                    
                    {(userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER') && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={(e) => { 
                          e.preventDefault(); 
                          e.stopPropagation(); 
                          setEditingBundle(b); 
                          setEditBundleData({ 
                            name: b.name, 
                            description: b.description || '', 
                            recordedOriginalPrice: b.recordedOriginalPrice ?? '', 
                            recordedDiscountPrice: b.recordedDiscountPrice ?? '', 
                            liveOriginalPrice: b.liveOriginalPrice ?? '', 
                            liveDiscountPrice: b.liveDiscountPrice ?? '', 
                            championOriginalPrice: b.championOriginalPrice ?? '',
                            championDiscountPrice: b.championDiscountPrice ?? '',
                            championSubtitle: b.championSubtitle ?? '',
                            courseIds: b.courses.map((c: any) => c.course.id), 
                            allowIndividualPurchase: b.allowIndividualPurchase ?? true, 
                            enableBundleDiscount: b.enableBundleDiscount ?? false, 
                            bundleDiscountType: b.bundleDiscountType ?? 'PERCENTAGE', 
                            bundleDiscountValue: b.bundleDiscountValue ?? '', 
                            bundleDiscountApplicability: b.bundleDiscountApplicability ?? 'BOTH', 
                            requireAllCourses: b.requireAllCourses ?? true,
                            coursePrices: b.coursePrices || '[]',
                            startingPrice: b.startingPrice ?? '',
                            startingFromText: b.startingFromText ?? 'Courses start from',
                            bannerText: b.bannerText ?? 'Class starts from 1 June 2026',
                            courseHeadline: b.courseHeadline ?? 'Included Courses',
                            category: b.category || 'General'
                          }) 
                        }} style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Pencil size={18} /></button>
                        <button onClick={async () => {
                          if (!confirm(`Delete bundle "${b.name}"? This cannot be undone.`)) return
                          try {
                            const res = await fetch(`/api/bundle-offerings/${b.id}`, { method: 'DELETE' })
                            if (res.ok) window.location.reload()
                            else { const d = await res.json(); alert(d.error || 'Failed to delete') }
                          } catch { alert('Failed to delete bundle') }
                        }} style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--danger-light)', border: '1px solid var(--border)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={18} /></button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Category options selection screen for Notes */}
      {storeView === 'notes' && !selectedNotesTab && visibleNotesCategories.length > 0 && (
        <div style={{ padding: '20px 0' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '950', textAlign: 'center', marginBottom: '8px' }}>Select Level</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px' }}>Choose a level to explore available study notes</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {visibleNotesCategories.map(cat => {
              const notesCount = activeNotes.filter((n: any) => (n.category || 'General') === cat).length;
              return (
                <div
                  key={cat}
                  onClick={() => setSelectedNotesTab(cat)}
                  style={{
                    background: 'var(--surface)',
                    borderRadius: '24px',
                    padding: '32px 24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
                    border: '1.5px solid var(--border)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = 'var(--success)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(16,185,129,0.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(15,23,42,0.06)';
                  }}
                >
                  <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                    {cat === 'Re-attempt' ? '🔄' : cat === 'Foundation' ? '🌱' : cat === 'Diploma' ? '🎓' : '📝'}
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px' }}>{cat}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {notesCount > 0 ? `${notesCount} Note${notesCount > 1 ? 's' : ''}` : 'No notes'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected category header with Change Category button for Notes */}
      {storeView === 'notes' && selectedNotesTab && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>{selectedNotesTab} Level Notes</h2>
          <button
            onClick={() => {
              setSelectedNotesTab('');
              setSelectedNotesSubjectTab('');
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '12px',
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
          >
            🔄 Change Category
          </button>
        </div>
      )}

      {/* Subject Sub-tabs for Notes */}
      {storeView === 'notes' && (currentNotesTab === 'Foundation' || currentNotesTab === 'Re-attempt') && visibleNotesSubjects.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingBottom: '4px'
        }}>
          {visibleNotesSubjects.map(sub => {
            const isActive = currentNotesSubjectTab === sub;
            return (
              <button
                key={sub}
                onClick={() => setSelectedNotesSubjectTab(sub)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '12px',
                  border: isActive ? '1.5px solid var(--success)' : '1.5px solid var(--border)',
                  background: isActive ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                  color: isActive ? 'var(--success)' : 'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {sub}
              </button>
            )
          })}
        </div>
      )}

      {/* Notes empty state */}
      {storeView === 'notes' && activeNotes.length === 0 && (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>No notes available yet</p>
          <p style={{ fontSize: '13px' }}>Check back soon for new study notes!</p>
        </div>
      )}

      {/* Notes section */}
      {storeView === 'notes' && selectedNotesTab && filteredNotes.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', margin: '6px 0 12px' }}>Study Notes</h2>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {filteredNotes.map((n: any) => {
              const currentUserId = userData?.user?.id
              const isManager = userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER'
              const hasAccess = n.price === 0 || 
                                isManager || 
                                n.accesses?.some((acc: any) => acc.userId === currentUserId)

              return (
                <div key={n.id} style={{ minWidth: '320px', background: 'var(--surface)', borderRadius: '16px', padding: '16px', boxShadow: '0 8px 20px rgba(15,23,42,0.06)' }}>
                  <div style={{ fontSize: '16px', fontWeight: '900', marginBottom: '6px' }}>{n.title}</div>
                  {n.description && <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{n.description}</div>}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                    <div style={{ fontWeight: '800', color: n.price > 0 ? 'var(--text-primary)' : 'var(--success)' }}>{n.price > 0 ? `₹${n.price}` : 'Free'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        if (hasAccess) {
                          window.open(`/api/store/notes/${n.id}/download`, '_blank')
                        } else {
                          handleNotePurchase(n)
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: hasAccess ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
                        color: '#fff',
                        fontWeight: '800',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {hasAccess ? 'Access Notes' : 'Get Now'}
                    </button>
                  {(userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER') && (
                    <>
                      <button onClick={(e) => {
                        e.stopPropagation()
                        setEditingNote(n)
                        setNoteCategory(n.category || 'General')
                        setNoteSubject(n.subject || '')
                        setShowCreateNoteModal(true)
                        setTimeout(() => {
                          const titleEl = document.getElementById('noteTitleInput') as HTMLInputElement
                          const descEl = document.getElementById('noteDescInput') as HTMLTextAreaElement
                          const linkEl = document.getElementById('noteLinkInput') as HTMLInputElement
                          const priceEl = document.getElementById('notePriceInput') as HTMLInputElement
                          if (titleEl) titleEl.value = n.title
                          if (descEl) descEl.value = n.description || ''
                          if (linkEl) linkEl.value = n.files?.[0]?.fileUrl || ''
                          if (priceEl) priceEl.value = n.price
                        }, 100)
                      }} style={{ padding: '10px 12px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: '800', fontSize: '13px' }}>Edit</button>
                      <button onClick={async () => {
                        if (!confirm(`Delete note "${n.title}"?`)) return
                        try {
                          const res = await fetch(`/api/store/notes/${n.id}`, { method: 'DELETE' })
                          if (res.ok) window.location.reload()
                          else alert('Failed to delete')
                        } catch { alert('Failed to delete') }
                      }} style={{ padding: '10px 12px', borderRadius: '12px', background: 'var(--danger-light)', border: '1px solid var(--border)', color: 'var(--danger)', fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          </div>
        </div>
      )}

      {/* Mentorship offerings section */}
      {storeView === 'mentorship' && mentorshipsData?.mentorships?.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>1-on-1 Mentorship</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER') && (
                  <button 
                    onClick={async () => {
                      setShowManualBookingModal(true)
                      setLoadingAllStudents(true)
                      try {
                        const res = await fetch('/api/users/students')
                        const data = await res.json()
                        setAllStudentsData(data.students || [])
                      } catch { alert('Failed to fetch students') }
                      finally { setLoadingAllStudents(false) }
                    }}
                    style={{ padding: '8px 16px', borderRadius: '50px', background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                  >
                    <Plus size={14} /> Manual Book
                  </button>
                )}
                <button 
                  onClick={async () => {
                  setShowManageBookingsModal(true)
                  setLoadingAllBookings(true)
                  try {
                    const res = await fetch('/api/store/mentorships/all-bookings')
                    const data = await res.json()
                    setAllBookingsData(data.bookings || [])
                  } catch { alert('Failed to fetch bookings') }
                  finally { setLoadingAllBookings(false) }
                }}
                style={{ padding: '8px 16px', borderRadius: '50px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(54,54,232,0.2)' }}
              >
                📋 View All Bookings
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '20px', paddingRight: '20px' }}>
            {mentorshipsData.mentorships.map((m: any) => (
              <div key={m.id} style={{ 
                minWidth: '380px', 
                background: 'var(--surface)', 
                borderRadius: '24px', 
                padding: '28px', 
                boxShadow: '0 10px 40px rgba(15,23,42,0.06)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                transition: 'transform 0.3s ease',
                position: 'relative'
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-6px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#fff', fontWeight: '900', boxShadow: '0 8px 16px rgba(245,158,11,0.2)' }}>
                    {m.mentorName[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>{m.mentorName}</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>{m.mentorTitle || 'IIT Mentorship Specialist'}</div>
                  </div>
                </div>

                <div style={{ minHeight: '48px' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>{m.description || 'Experienced mentor ready to guide you through your JEE/NEET journey and beyond.'}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--warning-light)', padding: '14px 20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'var(--warning-light)' }}>
                    <IndianRupee size={18} color="#92400e" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Starting From</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--warning)' }}>₹{m.pricePerSlot} <span style={{ fontSize: '13px', fontWeight: '600', opacity: 0.8 }}>/ {m.slotDurationMinutes} mins session</span></div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                  <button 
                    onClick={() => { setShowMentorshipBookingModal(m); setMentorshipBookingDate(''); setMentorshipBookingTimes([]) }} 
                    style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '15px', boxShadow: '0 8px 20px rgba(217,119,6,0.2)' }}
                  >
                    Book a Slot
                  </button>
                  
                  {(userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER') && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={(e) => { 
                        e.stopPropagation(); 
                        setEditingMentorship(m)
                        setShowCreateMentorshipModal(true)
                        setTimeout(() => {
                          const mentorEl = document.getElementById('mentorNameInput') as HTMLInputElement
                          const titleEl = document.getElementById('mentorTitleInput') as HTMLInputElement
                          const descEl = document.getElementById('mentorDescInput') as HTMLTextAreaElement
                          const priceEl = document.getElementById('mentorPriceInput') as HTMLInputElement
                          const durationEl = document.getElementById('mentorDurationInput') as HTMLInputElement
                          if (mentorEl) mentorEl.value = m.mentorName
                          if (titleEl) titleEl.value = m.mentorTitle || 'IIT Mentorship Specialist'
                          if (descEl) descEl.value = m.description || ''
                          if (priceEl) priceEl.value = m.pricePerSlot
                          if (durationEl) durationEl.value = m.slotDurationMinutes
                        }, 100)
                      }} style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>⚙️</button>
                      <button onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowManageSlotsModal(m); 
                        setEditingSlots(JSON.parse(m.availableSlots || '[]'));
                        setManageSlotsDate('');
                        setManageSlotsTime('');
                      }} style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>📅</button>
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete mentorship "${m.mentorName}"?`)) return
                        try {
                          const res = await fetch(`/api/store/mentorships/${m.id}`, { method: 'DELETE' })
                          if (res.ok) window.location.reload()
                          else alert('Failed to delete')
                        } catch { alert('Failed to delete') }
                      }} style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--danger-light)', border: '1px solid var(--border)', color: 'var(--danger)', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>🗑️</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MY BOOKINGS SECTION */}
      {storeView === 'mentorship' && myMentorshipsData?.bookings?.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '20px' }}>Your Booked Sessions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: '20px' }}>
            {myMentorshipsData.bookings.map((booking: any) => {
              const isPast = new Date(`${booking.slotDate}T${booking.slotTime}`) < new Date();
              const isToday = booking.slotDate === new Date().toISOString().split('T')[0];
              
              return (
                <div key={booking.id} style={{ 
                  background: isPast ? 'var(--surface)' : '#fff', 
                  borderRadius: '20px', 
                  padding: '20px', 
                  boxShadow: isPast ? 'none' : '0 10px 30px rgba(0,0,0,0.04)',
                  border: isPast ? '1px solid var(--border)' : '2px solid #f59e0b',
                  opacity: isPast ? 0.7 : 1,
                  filter: isPast ? 'grayscale(0.5)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)' }}>{booking.mentorship?.mentorName}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>{booking.mentorship?.slotDuration} mins Session</div>
                    </div>
                    {isToday && !isPast && <span style={{ padding: '4px 10px', borderRadius: '50px', background: 'var(--success)', color: '#fff', fontSize: '10px', fontWeight: '800' }}>TODAY</span>}
                    {isPast && <span style={{ padding: '4px 10px', borderRadius: '50px', background: 'var(--text-muted)', color: '#fff', fontSize: '10px', fontWeight: '800' }}>COMPLETED</span>}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px', background: isPast ? 'var(--surface)' : 'var(--warning-light)', padding: '12px', borderRadius: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Date</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{new Date(booking.slotDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Time</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{booking.slotTime} IST</div>
                    </div>
                  </div>

                  {!isPast && (
                    <div style={{ marginTop: '4px' }}>
                      {booking.meetLink ? (
                        <a href={normalizeMeetLink(booking.meetLink) ?? '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: '12px', background: 'var(--primary)', color: '#fff', fontWeight: '800', textDecoration: 'none', fontSize: '14px' }}>
                          Join Meeting →
                        </a>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '12px', borderRadius: '12px', background: 'var(--surface)', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '13px', border: '1.5px dashed #cbd5e1' }}>
                          Link will be added soon
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {myMentorshipsData.bookings.length > 5 && (
             <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', fontStyle: 'italic' }}>
               Completed sessions are displayed above in grey.
             </div>
          )}
        </div>
      )}

      {storeView === 'courses' && activeOfferings.length === 0 && activeBundles.length === 0 && (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--neu-dark)" strokeWidth="1.5">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
          </svg>
          <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>No courses available yet</p>
          <p style={{ fontSize: '13px' }}>Check back soon for new offerings!</p>
        </div>
      )}

      {storeView === 'courses' && selectedStoreTab && filteredOfferings.length > 0 && <div className="grid-3">
        {[...filteredOfferings].sort((a: any, b: any) => {
          const isManager = userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER'
          const aEnroll = getEnrollmentStatus(a.courseId)
          const bEnroll = getEnrollmentStatus(b.courseId)
          const aFull = (!isManager && (aEnroll === 'LIVE' || (aEnroll === 'RECORDED' && !a.hasLive))) ? 1 : 0
          const bFull = (!isManager && (bEnroll === 'LIVE' || (bEnroll === 'RECORDED' && !b.hasLive))) ? 1 : 0
          return aFull - bFull
        }).map((offering: any) => {
          const recPrice = Math.max(Number(offering.recordedDiscountPrice || 0), 1)
          const recOriginal = Math.max(Number(offering.recordedOriginalPrice || 0), recPrice)
          const livePrice = Math.max(Number(offering.liveDiscountPrice || 0), 1)
          const liveOriginal = Math.max(Number(offering.liveOriginalPrice || 0), livePrice)
          const discountRecorded = recOriginal > 0
            ? Math.round((1 - recPrice / recOriginal) * 100)
            : 0
          const discountLive = liveOriginal > 0
            ? Math.round((1 - livePrice / liveOriginal) * 100)
            : 0
          
          // Get enrollment status
          const isManager = userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER'
          const enrollmentType = getEnrollmentStatus(offering.courseId)
          const isRecordedEnrolled = !isManager && enrollmentType === 'RECORDED'
          const isLiveEnrolled = !isManager && enrollmentType === 'LIVE'
          const isFullyPurchased = isLiveEnrolled || (isRecordedEnrolled && !offering.hasLive)

          return (
            <div
              key={offering.id}
              style={{
                background: isFullyPurchased ? '#dfdfe5' : 'var(--surface-2)',
                borderRadius: '28px',
                boxShadow: isFullyPurchased ? 'none' : '8px 8px 16px var(--neu-dark), -8px -8px 16px var(--neu-light)',
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                maxWidth: '420px',
                margin: '0 auto',
                transition: 'all 0.25s ease',
                filter: isFullyPurchased ? 'grayscale(0.4) opacity(0.9)' : 'none',
                pointerEvents: (isFullyPurchased && !isManager) ? 'none' : 'auto',
              } as React.CSSProperties}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)'
                e.currentTarget.style.boxShadow = '12px 12px 24px var(--neu-dark), -12px -12px 24px var(--neu-light)'
                setShowInfoHint(offering.id)
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '8px 8px 16px var(--neu-dark), -8px -8px 16px var(--neu-light)'
                setShowInfoHint(null)
              }}
            >
              {/* Banner */}
              <div style={{
                height: 'var(--course-banner-height, 110px)',
                background: `linear-gradient(135deg, ${offering.course?.color || 'var(--accent)'}ee, ${offering.course?.color || 'var(--accent)'}88)`,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{ position: 'absolute', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', top: '-60px', right: '-30px' }} />
                <div style={{ position: 'absolute', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', bottom: '-30px', left: '20px' }} />
                
                {/* Course icon */}
                <div style={{
                  width: 'var(--course-icon-size, 60px)', height: 'var(--course-icon-size, 60px)', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1,
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                  </svg>
                </div>

                {/* Info button with tooltip and Edit button */}
                <div style={{ position: 'absolute', bottom: '12px', right: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Edit button for managers */}
                  {(userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER') && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingOffering(offering); setEditFormData({ recordedOriginalPrice: offering.recordedOriginalPrice ?? '', recordedDiscountPrice: offering.recordedDiscountPrice ?? '', liveOriginalPrice: offering.liveOriginalPrice ?? '', liveDiscountPrice: offering.liveDiscountPrice ?? '', championOriginalPrice: offering.championOriginalPrice ?? '', championDiscountPrice: offering.championDiscountPrice ?? '', championSubtitle: offering.championSubtitle ?? '', detailsLink: offering.detailsLink ?? '', category: offering.category || 'General' }) }}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '14px', fontWeight: '800',
                      }}
                      title="Edit course offering"
                    >
                      ✎
                    </button>
                  )}
                  
                  {/* Info button */}
                  {(offering.hasRecorded || offering.hasLive) && !isFullyPurchased && !isManager && (
                    <div style={{ position: 'relative' }}>
                      {showInfoHint === offering.id && (
                        <div style={{
                          position: 'absolute', bottom: 'calc(100% + 12px)', right: '-6px',
                          background: '#0f172a', color: '#ffffff', padding: '10px 14px', borderRadius: '12px',
                          fontSize: '12px', fontWeight: '600', width: '245px', textAlign: 'center',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.4)', zIndex: 60,
                          animation: 'fadeIn 0.2s ease-out',
                          pointerEvents: 'none',
                        }}>
                          Click here to see the difference between PRO and PLUS Batch
                          <div style={{ position: 'absolute', top: '100%', right: '12px', border: '7px solid transparent', borderTopColor: '#0f172a' }} />
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInfoModalOffering(offering) }}
                        onMouseEnter={() => setShowInfoHint(offering.id)}
                        onMouseLeave={() => setShowInfoHint(null)}
                        style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)',
                          border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: '14px', fontWeight: '800',
                        }}
                        title="Compare access types"
                      >
                        i
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: 'var(--course-card-padding, 20px 22px 10px)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Course Name - Big and Prominent */}
                {offering.course?.name && (
                  <h2 style={{
                    fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)',
                    marginBottom: '4px', lineHeight: '1.2',
                  }}>
                    {offering.course.name}
                  </h2>
                )}
                
                {/* Subject Name - Below course name */}
                {offering.course?.subject && (
                  <p style={{
                    fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '12px',
                  }}>
                    {offering.course.subject}
                  </p>
                )}

                {/* Duplicate name removed - course name already shown above */}

                {offering.description && (
                  <p style={{
                    fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5',
                    marginBottom: '16px',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden',
                  }}>
                    {offering.description}
                  </p>
                )}

                {/* Pricing Tiers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                  {/* Already Enrolled in LIVE - Show both sections with "Already Enrolled" */}
                  {isLiveEnrolled && offering.hasRecorded && (
                    <>
                      <div style={{
                        padding: '14px 16px', borderRadius: '18px',
                        background: 'var(--surface-2)',
                        boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                        filter: 'grayscale(0.8)', opacity: 0.8,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                              📹 Recorded Batch - PLUS
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{recPrice}</span>
                              {recOriginal > recPrice && (
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{recOriginal}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          disabled={true}
                          style={{
                            width: '100%', padding: '11px', borderRadius: '50px',
                            border: '2px solid #6366f1', background: 'var(--surface-2)',
                            color: 'var(--accent)', fontSize: '13px', fontWeight: '800',
                            cursor: 'not-allowed',
                            opacity: 0.6,
                            boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                            transition: 'all 0.2s',
                          }}
                        >
                          ✅ Already Enrolled
                        </button>
                      </div>
                      <div style={{
                        padding: '14px 16px', borderRadius: '18px',
                        background: 'linear-gradient(135deg, var(--border), var(--border))',
                        border: '1.5px solid var(--border)',
                        position: 'relative', overflow: 'hidden',
                        filter: 'grayscale(0.8)', opacity: 0.8,
                      }}>
                        <div style={{
                          position: 'absolute', top: '10px', right: '12px',
                          padding: '3px 10px', borderRadius: '20px',
                          background: 'var(--accent)', color: '#fff',
                          fontSize: '9px', fontWeight: '900', letterSpacing: '0.08em',
                        }}>
                          PRO
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                              🔴 Live + Recorded Batch - PRO
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{livePrice}</span>
                              {liveOriginal > livePrice && (
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{liveOriginal}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          disabled={true}
                          style={{
                            width: '100%', padding: '11px', borderRadius: '50px',
                            border: 'none', background: 'var(--accent)',
                            color: '#fff', fontSize: '13px', fontWeight: '800',
                            cursor: 'not-allowed',
                            opacity: 0.6,
                            boxShadow: '0 8px 16px rgba(99,102,241,0.35)',
                            transition: 'all 0.2s',
                          }}
                        >
                          ✅ Already Enrolled
                        </button>
                      </div>
                    </>
                  )}

                  {/* Already Enrolled in LIVE but no recorded option */}
                  {isLiveEnrolled && !offering.hasRecorded && (
                    <div style={{
                      padding: '14px 16px', borderRadius: '18px',
                      background: 'linear-gradient(135deg, var(--border), var(--border))',
                      border: '1.5px solid var(--border)',
                      position: 'relative', overflow: 'hidden',
                      filter: 'grayscale(0.8)', opacity: 0.8,
                    }}>
                      <div style={{
                        position: 'absolute', top: '10px', right: '12px',
                        padding: '3px 10px', borderRadius: '20px',
                        background: 'var(--accent)', color: '#fff',
                        fontSize: '9px', fontWeight: '900', letterSpacing: '0.08em',
                      }}>
                        PRO
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            🔴 Live + Recorded Batch - PRO
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{livePrice}</span>
                            {liveOriginal > livePrice && (
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{liveOriginal}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        disabled={true}
                        style={{
                          width: '100%', padding: '11px', borderRadius: '50px',
                          border: 'none', background: 'var(--accent)',
                          color: '#fff', fontSize: '13px', fontWeight: '800',
                          cursor: 'not-allowed',
                          opacity: 0.6,
                          boxShadow: '0 8px 16px rgba(99,102,241,0.35)',
                          transition: 'all 0.2s',
                        }}
                      >
                        ✅ Already Enrolled
                      </button>
                    </div>
                  )}

                  {/* Recorded Option - Show purchase when not enrolled */}
                  {offering.hasRecorded && !isLiveEnrolled && !isRecordedEnrolled && (
                    <div 
                      style={{
                        padding: '14px 16px', borderRadius: '18px',
                        background: 'var(--surface-2)',
                        boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.02)'
                        e.currentTarget.style.boxShadow = '4px 4px 12px var(--neu-dark), -4px -4px 12px var(--neu-light), inset 2px 2px 4px var(--neu-dark)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            📹 Recorded Batch - PLUS
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{recPrice}</span>
                            {recOriginal > recPrice && (
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{recOriginal}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePurchase(offering.id, 'RECORDED')}
                        disabled={!!purchasing}
                        style={{
                          width: '100%', padding: '11px', borderRadius: '50px',
                          border: '2px solid #6366f1', background: 'var(--surface-2)',
                          color: 'var(--accent)', fontSize: '13px', fontWeight: '800',
                          cursor: purchasing ? 'not-allowed' : 'pointer',
                          opacity: purchasing ? 0.5 : 1,
                          boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                          transition: 'all 0.2s',
                        }}
                      >
                        {purchasing === `${offering.id}-RECORDED` ? 'Processing...' : 'Buy PLUS Batch'}
                      </button>
                    </div>
                  )}

                  {/* Recorded Option - Show "Already Enrolled" when user has PLUS but not PRO */}
                  {offering.hasRecorded && isRecordedEnrolled && !isLiveEnrolled && (
                    <div style={{
                      padding: '14px 16px', borderRadius: '18px',
                      background: 'var(--surface-2)',
                      boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                      filter: 'grayscale(0.8)', opacity: 0.8,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            📹 Recorded Batch - PLUS
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{recPrice}</span>
                            {recOriginal > recPrice && (
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{recOriginal}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        disabled={true}
                        style={{
                          width: '100%', padding: '11px', borderRadius: '50px',
                          border: '2px solid #6366f1', background: 'var(--surface-2)',
                          color: 'var(--accent)', fontSize: '13px', fontWeight: '800',
                          cursor: 'not-allowed',
                          opacity: 0.6,
                          boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                          transition: 'all 0.2s',
                        }}
                      >
                        ✅ Already Enrolled
                      </button>
                    </div>
                  )}

                  {/* Upgrade Option - Show for RECORDED enrolled users */}
                  {isRecordedEnrolled && offering.hasLive && (
                    <div 
                      style={{
                        padding: '14px 16px', borderRadius: '18px',
                        background: 'linear-gradient(135deg, var(--border), var(--border))',
                        border: '1.5px solid var(--border)',
                        position: 'relative', overflow: 'hidden',
                        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.02)'
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.15)'
                        e.currentTarget.style.borderColor = 'var(--accent)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.borderColor = 'var(--border)'
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: '10px', right: '12px',
                        padding: '3px 10px', borderRadius: '20px',
                        background: 'var(--accent)', color: '#fff',
                        fontSize: '9px', fontWeight: '900', letterSpacing: '0.08em',
                      }}>
                        PRO
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                          ⚡ Upgrade to PRO Batch
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{livePrice}</span>
                          {liveOriginal > livePrice && (
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{liveOriginal}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleUpgrade(offering.courseId, offering.id)}
                        disabled={upgrading}
                        style={{
                          width: '100%', padding: '11px', borderRadius: '50px',
                          border: 'none', background: 'var(--text-primary)',
                          color: '#fff', fontSize: '13px', fontWeight: '800',
                          cursor: upgrading ? 'not-allowed' : 'pointer',
                          opacity: upgrading ? 0.5 : 1,
                          boxShadow: '0 8px 16px rgba(30, 30, 58, 0.4)',
                          transition: 'all 0.2s',
                        }}
                      >
                        {upgrading ? 'Processing Upgrade...' : '⚡ Upgrade to PRO'}
                      </button>
                    </div>
                  )}

                  {/* Live Option - Show only for non-recorded users */}
                  {offering.hasLive && !isRecordedEnrolled && !isLiveEnrolled && (
                    <div 
                      style={{
                        padding: '14px 16px', borderRadius: '18px',
                        background: 'linear-gradient(135deg, var(--border), var(--border))',
                        border: '1.5px solid var(--border)',
                        position: 'relative', overflow: 'hidden',
                        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.02)'
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.15)'
                        e.currentTarget.style.borderColor = 'var(--accent)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.borderColor = 'var(--border)'
                      }}
                    >
                      {/* PRO Badge */}
                      <div style={{
                        position: 'absolute', top: '10px', right: '12px',
                        padding: '3px 10px', borderRadius: '20px',
                        background: 'var(--accent)', color: '#fff',
                        fontSize: '9px', fontWeight: '900', letterSpacing: '0.08em',
                      }}>
                        PRO
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            🔴 Live + Recorded Batch - PRO
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{livePrice}</span>
                            {liveOriginal > livePrice && (
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{liveOriginal}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePurchase(offering.id, 'LIVE')}
                        disabled={!!purchasing}
                        style={{
                          width: '100%', padding: '11px', borderRadius: '50px',
                          border: 'none', background: 'var(--accent)',
                          color: '#fff', fontSize: '13px', fontWeight: '800',
                          cursor: purchasing ? 'not-allowed' : 'pointer',
                          opacity: purchasing ? 0.5 : 1,
                          boxShadow: '0 8px 16px rgba(99,102,241,0.35)',
                          transition: 'all 0.2s',
                        }}
                      >
                        {purchasing === `${offering.id}-LIVE` ? 'Processing...' : '⚡ Buy PLUS + PRO Batch'}
                      </button>
                    </div>
                  )}

                  {/* Champion Option */}
                  {offering.championDiscountPrice > 0 && !isLiveEnrolled && (
                    <div 
                      style={{
                        padding: '14px 16px', borderRadius: '18px',
                        background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                        border: '1.5px solid #fca5a5',
                        position: 'relative', overflow: 'hidden',
                        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        marginTop: '12px'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.02)'
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(220, 38, 38, 0.15)'
                        e.currentTarget.style.borderColor = 'var(--danger)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.borderColor = '#fca5a5'
                      }}
                    >
                      {/* CHAMPION Badge */}
                      <div style={{
                        position: 'absolute', top: '10px', right: '12px',
                        padding: '3px 10px', borderRadius: '20px',
                        background: 'var(--danger)', color: '#fff',
                        fontSize: '9px', fontWeight: '900', letterSpacing: '0.08em',
                      }}>
                        CHAMPION
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                            🏆 Champion - {offering.championSubtitle || 'Premium Wrapper'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{offering.championDiscountPrice}</span>
                            {offering.championOriginalPrice > offering.championDiscountPrice && (
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{offering.championOriginalPrice}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePurchase(offering.id, 'CHAMPION')}
                        disabled={!!purchasing}
                        style={{
                          width: '100%', padding: '11px', borderRadius: '50px',
                          border: 'none', background: 'var(--danger)',
                          color: '#fff', fontSize: '13px', fontWeight: '800',
                          cursor: purchasing ? 'not-allowed' : 'pointer',
                          opacity: purchasing ? 0.5 : 1,
                          boxShadow: '0 8px 16px rgba(220,38,38,0.35)',
                          transition: 'all 0.2s',
                        }}
                      >
                        {purchasing === `${offering.id}-CHAMPION` ? 'Processing...' : '💎 Buy Champion Batch'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 22px', marginTop: '10px',
                borderTop: '1.5px solid rgba(0,0,0,0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600',
              }}>
                <span>⏳ Access Till End Term</span>
                {offering.detailsLink && (
                  <a href={offering.detailsLink} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: '11px', fontWeight: '800', color: 'var(--accent)',
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    More Details →
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>}

      {/* Bundle Choose / Buy Modal */}
      {showBundleModal && activeBundle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '12px' }} onClick={() => { setShowBundleModal(false); setActiveBundle(null) }}>
          {(() => {
            const selectedList = activeBundle.allowIndividualPurchase === false ? activeBundle.courses.map((c: any) => c.course.id) : bundleSelectedCoursesToBuy;
            return (
              <div className="bundle-modal-box" style={{ width: '100%', maxWidth: 'min(1024px, calc(100vw - 24px))', height: 'min(86vh, calc(100vh - 24px))', background: 'var(--surface)', borderRadius: 'clamp(16px, 4vw, 24px)', padding: 'clamp(16px, 4vw, 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }} onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => { setShowBundleModal(false); setActiveBundle(null) }}
                  style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', zIndex: 10 }}
                >
                  <X size={20} />
                </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingRight: '48px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <h3 style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: '900', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{activeBundle.name}</h3>
                {activeBundle.description && (
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>{activeBundle.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowBatchComparisonModal(true) }}
                  style={{
                    padding: '8px 14px', borderRadius: '12px',
                    background: 'rgba(99,102,241,0.08)',
                    border: '1.5px solid rgba(99,102,241,0.2)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: 'var(--accent)', fontSize: '12px', fontWeight: '800',
                    whiteSpace: 'nowrap'
                  }}
                >
                  See difference {'>'}
                </button>
              </div>
            </div>
            <div className="bundle-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {activeBundle.allowIndividualPurchase !== false && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '16px', padding: '0 6px 10px 6px', marginBottom: '4px', borderBottom: '1.5px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{activeBundle.courseHeadline || 'Course'}</div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', minWidth: '160px' }}>Prices</div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', minWidth: '110px' }}>Class Type</div>
                  </div>
                )}
                <div style={{ maxHeight: '420px', overflow: 'auto', paddingRight: '12px', marginBottom: '20px' }}>
                  {activeBundle.courses.map((bc: any) => {
                    const course = bc.course
                    const offering = (activeOfferings as any[]).find(o => o.courseId === course.id)
                    
                    let bPriceData = {};
                    try { bPriceData = JSON.parse(activeBundle.coursePrices || '{}'); } catch(e) {}
                    const bundleMappings = (bPriceData as any).individualMapping || {};
                    const bundleCustomPrice = bundleMappings[course.id];

                    const currentCount = bundleSelectedCoursesToBuy.length || activeBundle.courses.length;
                    const tierForCount = (bPriceData as any)[currentCount];

                    const recPrice = Number(bundleCustomPrice?.recorded || tierForCount?.recordedDiscount || tierForCount?.recordedOriginal || offering?.recordedDiscountPrice || offering?.recordedOriginalPrice || 0);
                    const livePrice = Number(bundleCustomPrice?.live || tierForCount?.liveDiscount || tierForCount?.liveOriginal || offering?.liveDiscountPrice || offering?.liveOriginalPrice || 0);
                    const selectedType = bundleSelectedForPurchase[course.id] || (activeBundle.forceClassType || bundleGlobalAccessType) || 'RECORDED';
                    
                    return (
                      <div key={course.id} className="bundle-modal-item" style={{ 
                        padding: '16px', 
                        borderRadius: '16px', 
                        border: '1.5px solid var(--border)', 
                        marginBottom: '12px',
                        background: bundleSelectedCoursesToBuy.includes(course.id) ? 'var(--surface)' : '#fff',
                        transition: 'all 0.2s ease'
                      }}>
                        <div className="bundle-modal-item-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {(() => {
                              const enrollmentType = getEnrollmentStatus(course.id);
                              const isManager = userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER';
                              const isEnrolled = !isManager && enrollmentType !== null;
                              const isFixed = activeBundle.allowIndividualPurchase === false;
                              return (
                                <>
                                  <div 
                                    onClick={() => {
                                      if (isFixed || isEnrolled) return
                                      if (bundleSelectedCoursesToBuy.includes(course.id)) {
                                        setBundleSelectedCoursesToBuy(bundleSelectedCoursesToBuy.filter(id => id !== course.id))
                                      } else {
                                        setBundleSelectedCoursesToBuy([...bundleSelectedCoursesToBuy, course.id])
                                      }
                                    }}
                                    style={{ 
                                      width: '24px', height: '24px', 
                                      borderRadius: '8px', 
                                      border: `2px solid ${bundleSelectedCoursesToBuy.includes(course.id) ? 'var(--accent)' : 'var(--text-muted)'}`,
                                      background: bundleSelectedCoursesToBuy.includes(course.id) ? 'var(--accent)' : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: (isFixed || isEnrolled) ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.2s ease',
                                      opacity: isFixed ? 0.7 : 1
                                    }}
                                  >
                                    {bundleSelectedCoursesToBuy.includes(course.id) && (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                      {course.name}
                                      {isEnrolled && <span style={{ marginLeft: '8px', fontSize: '10px', background: 'var(--success-light)', color: 'var(--success)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', fontWeight: '900' }}>Purchased</span>}
                                    </div>
                                    {course.description && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', marginTop: '2px', maxWidth: '400px' }}>{course.description}</div>}
                                  </div>
                                </>
                              )
                            })()}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {!activeBundle.allowIndividualPurchase ? (
                              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent)', background: 'rgba(99,102,241,0.06)', padding: '6px 12px', borderRadius: '8px', textTransform: 'uppercase' }}>
                                ✨ Part of Package
                              </div>
                            ) : (
                              <>
                                {/* Dual price display: show both Recorded + Live prices */}
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Recorded</div>
                                      <div style={{ fontSize: '14px', fontWeight: '900', color: selectedType === 'RECORDED' ? 'var(--text-primary)' : 'var(--text-muted)' }}>₹{recPrice}</div>
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>|</div>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase' }}>Live Pro</div>
                                      <div style={{ fontSize: '14px', fontWeight: '900', color: selectedType === 'LIVE' ? 'var(--primary)' : 'var(--text-muted)' }}>₹{livePrice}</div>
                                    </div>
                                    {offering?.championDiscountPrice > 0 && (
                                      <>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>|</div>
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700', textTransform: 'uppercase' }}>Champ</div>
                                          <div style={{ fontSize: '14px', fontWeight: '900', color: selectedType === 'CHAMPION' ? 'var(--danger)' : 'var(--text-muted)' }}>₹{offering.championDiscountPrice}</div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                {!getEnrollmentStatus(course.id) || userData?.user?.role === 'MANAGER' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '200px' }}>
                                      <button 
                                        onClick={() => {
                                          setBundleSelectedForPurchase({ ...bundleSelectedForPurchase, [course.id]: 'RECORDED' })
                                          if (couponApplied?.code?.includes('LIVE')) {
                                            setCouponApplied(null)
                                            setCouponError('Live-only coupon removed (requires all subjects to be Live).')
                                          }
                                        }}
                                        style={{ padding: '6px 10px', borderRadius: '8px', border: selectedType === 'RECORDED' ? '1.5px solid #3b82f6' : '1px solid var(--border)', background: selectedType === 'RECORDED' ? 'var(--info-light)' : '#fff', color: selectedType === 'RECORDED' ? 'var(--info)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                      >
                                        Recorded
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setBundleSelectedForPurchase({ ...bundleSelectedForPurchase, [course.id]: 'LIVE' })
                                        }}
                                        style={{ padding: '6px 10px', borderRadius: '8px', border: selectedType === 'LIVE' ? '1.5px solid #3b82f6' : '1px solid var(--border)', background: selectedType === 'LIVE' ? 'var(--info-light)' : '#fff', color: selectedType === 'LIVE' ? 'var(--info)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                      >
                                        Live
                                      </button>
                                      {offering?.championDiscountPrice > 0 && (
                                        <button 
                                          onClick={() => {
                                            setBundleSelectedForPurchase({ ...bundleSelectedForPurchase, [course.id]: 'CHAMPION' })
                                          }}
                                          style={{ padding: '6px 10px', borderRadius: '8px', border: selectedType === 'CHAMPION' ? '1.5px solid #ef4444' : '1px solid var(--border)', background: selectedType === 'CHAMPION' ? 'var(--danger-light)' : '#fff', color: selectedType === 'CHAMPION' ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                        >
                                          Champion
                                        </button>
                                      )}
                                    </div>
                                    {selectedType === 'CHAMPION' && offering?.championSubtitle && (
                                      <div style={{ padding: '4px 8px', background: 'var(--danger-light)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--danger)', fontSize: '10px', fontWeight: '700', maxWidth: '140px', textAlign: 'right' }}>
                                        {offering.championSubtitle}
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Left Bottom Info Area */}
                <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '20px', border: '1.5px solid var(--border)' }}>
                  {activeBundle.enableBundleDiscount && activeBundle.bundleDiscountValue && (() => {
                    // Read from coursePrices JSON first (that's where it's stored), fallback to direct field
                    let applicability = activeBundle.bundleDiscountApplicability || 'BOTH';
                    try {
                      const pd = JSON.parse(activeBundle.coursePrices || '{}');
                      if (pd.bundleDiscountApplicability) applicability = pd.bundleDiscountApplicability;
                    } catch(e) {}

                    const requiresAll = activeBundle.requireAllCourses !== false;
                    const n = activeBundle.courses.length;

                    let subtitle = '';
                    if (requiresAll) {
                      if (applicability === 'LIVE') subtitle = `Enroll all ${n} subjects in Live Pro to unlock this discount.`;
                      else if (applicability === 'RECORDED') subtitle = `Enroll all ${n} subjects in Recorded Plus to unlock this discount.`;
                      else subtitle = `Enroll all ${n} subjects (any class type) to unlock this discount.`;
                    } else {
                      if (applicability === 'LIVE') subtitle = `Applies to Live Pro selections.`;
                      else if (applicability === 'RECORDED') subtitle = `Applies to Recorded Plus selections.`;
                      else subtitle = `Applies to any class type.`;
                    }

                    return (
                      <div style={{ padding: '14px 18px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--border), var(--border))', marginBottom: '16px', border: '1px solid #f59e0b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '18px' }}>🏷️</span>
                          <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--warning)' }}>
                            {activeBundle.bundleDiscountType === 'PERCENTAGE' ? `Bundle Offer: ${activeBundle.bundleDiscountValue}% OFF` : `Bundle Offer: ₹${activeBundle.bundleDiscountValue} OFF`}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: '600', paddingLeft: '28px' }}>
                          {subtitle}
                        </div>
                      </div>
                    );
                  })()}

                  {activeBundle.allowIndividualPurchase === false && (
                    <div style={{ padding: '12px 18px', borderRadius: '16px', background: 'var(--info-light)', border: '1px solid var(--border)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>🔒</span>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--info)' }}>Fixed Course Bundle</div>
                          <div style={{ fontSize: '11px', color: 'var(--info)', fontWeight: '600' }}>This course set must be purchased as a complete package. Class type applies to all subjects.</div>
                        </div>
                      </div>
                      
                      {!activeBundle.forceClassType && (
                        <div style={{ background: 'var(--surface)', borderRadius: '10px', padding: '10px', border: '1px solid #dbeafe', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--info)' }}>Select Class Type</span>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button 
                                onClick={() => setBundleGlobalAccessType('RECORDED')}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: bundleGlobalAccessType === 'RECORDED' ? '2px solid #3b82f6' : '1.5px solid var(--border)', background: bundleGlobalAccessType === 'RECORDED' ? 'var(--info-light)' : '#fff', color: bundleGlobalAccessType === 'RECORDED' ? 'var(--info)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
                              >
                                Recorded Plus
                              </button>
                              <button 
                                onClick={() => setBundleGlobalAccessType('LIVE')}
                                style={{ padding: '8px 12px', borderRadius: '8px', border: bundleGlobalAccessType === 'LIVE' ? '2px solid #3b82f6' : '1.5px solid var(--border)', background: bundleGlobalAccessType === 'LIVE' ? 'var(--info-light)' : '#fff', color: bundleGlobalAccessType === 'LIVE' ? 'var(--info)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
                              >
                                Live Pro
                              </button>
                              {activeBundle.championDiscountPrice > 0 && (
                                <button 
                                  onClick={() => setBundleGlobalAccessType('CHAMPION')}
                                  style={{ padding: '8px 12px', borderRadius: '8px', border: bundleGlobalAccessType === 'CHAMPION' ? '2px solid #ef4444' : '1.5px solid var(--border)', background: bundleGlobalAccessType === 'CHAMPION' ? 'var(--danger-light)' : '#fff', color: bundleGlobalAccessType === 'CHAMPION' ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
                                >
                                  Champion
                                </button>
                              )}
                            </div>
                          </div>
                          {bundleGlobalAccessType === 'CHAMPION' && activeBundle.championSubtitle && (
                            <div style={{ padding: '8px 12px', background: 'var(--danger-light)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--danger)', fontSize: '12px', fontWeight: '700' }}>
                              ⭐ {activeBundle.championSubtitle}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '24px', display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  let totalPrice = 0;
                  let originalTotalPrice = 0;
                  const isFixed = activeBundle.allowIndividualPurchase === false;
                  
                  // Check if ALL selected courses are already enrolled
                  const isManager = userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER';
                  const isAllEnrolled = !isManager && selectedList.length > 0 && selectedList.every(id => getEnrollmentStatus(id) !== null);

                  const tierPrices = activeBundle.coursePrices ? JSON.parse(activeBundle.coursePrices) : {};
                  const count = selectedList.length;
                  const effectiveGlobalType = activeBundle.forceClassType || bundleGlobalAccessType;
                  const individualMapping = tierPrices.individualMapping || {};
                  const hasIndividualMapping = Object.keys(individualMapping).length > 0;

                  if (isFixed) {
                    // Fixed bundle: use global bundle price fields
                    const bundlePrice = effectiveGlobalType === 'RECORDED'
                      ? activeBundle.recordedDiscountPrice ?? activeBundle.recordedOriginalPrice
                      : effectiveGlobalType === 'CHAMPION'
                        ? activeBundle.championDiscountPrice ?? activeBundle.championOriginalPrice ?? activeBundle.liveDiscountPrice ?? activeBundle.liveOriginalPrice
                        : activeBundle.liveDiscountPrice ?? activeBundle.liveOriginalPrice;
                    const bundleOriginal = effectiveGlobalType === 'RECORDED'
                      ? activeBundle.recordedOriginalPrice ?? activeBundle.recordedDiscountPrice
                      : effectiveGlobalType === 'CHAMPION'
                        ? activeBundle.championOriginalPrice ?? activeBundle.championDiscountPrice ?? activeBundle.liveOriginalPrice
                        : activeBundle.liveOriginalPrice ?? activeBundle.liveDiscountPrice;
                    totalPrice = Number(bundlePrice) || 0;
                    originalTotalPrice = Number(bundleOriginal) || totalPrice;
                  } else if (hasIndividualMapping) {
                    // Non-fixed with subject-specific pricing: sum individual course prices
                    selectedList.forEach((courseId: string) => {
                      const offering = (activeOfferings as any[]).find(o => o.courseId === courseId);
                      const selectedType = bundleSelectedForPurchase[courseId] || effectiveGlobalType || 'RECORDED';
                      const custom = individualMapping[courseId];
                      if (selectedType === 'RECORDED') {
                        const p = Number(custom?.recorded || offering?.recordedDiscountPrice ?? offering?.recordedOriginalPrice ?? 0);
                        totalPrice += p;
                        originalTotalPrice += p;
                      } else if (selectedType === 'CHAMPION') {
                        const p = Number(custom?.champion || offering?.championDiscountPrice ?? offering?.championOriginalPrice ?? offering?.liveDiscountPrice ?? 0);
                        totalPrice += p;
                        originalTotalPrice += p;
                      } else {
                        const p = Number(custom?.live || offering?.liveDiscountPrice ?? offering?.liveOriginalPrice ?? 0);
                        totalPrice += p;
                        originalTotalPrice += p;
                      }
                    });
                  } else {
                    // Fallback: use tiered pricing (tier[count] = bundle total for N courses)
                    const tier = tierPrices[count];
                    if (tier) {
                      if (effectiveGlobalType === 'RECORDED') {
                        totalPrice = Number(tier.recordedDiscount) || Number(tier.recordedOriginal) || 0;
                        originalTotalPrice = Number(tier.recordedOriginal) || totalPrice;
                      } else if (effectiveGlobalType === 'CHAMPION') {
                        totalPrice = Number(tier.championDiscount) || Number(tier.championOriginal) || Number(tier.liveDiscount) || Number(tier.liveOriginal) || 0;
                        originalTotalPrice = Number(tier.championOriginal) || Number(tier.liveOriginal) || totalPrice;
                      } else {
                        totalPrice = Number(tier.liveDiscount) || Number(tier.liveOriginal) || 0;
                        originalTotalPrice = Number(tier.liveOriginal) || totalPrice;
                      }
                    } else {
                      // Last resort: sum offering prices
                      selectedList.forEach((courseId: string) => {
                        const offering = (activeOfferings as any[]).find(o => o.courseId === courseId);
                        const selectedType = bundleSelectedForPurchase[courseId] || effectiveGlobalType || 'RECORDED';
                        if (selectedType === 'RECORDED') {
                          totalPrice += Number(offering?.recordedDiscountPrice ?? offering?.recordedOriginalPrice ?? 0);
                          originalTotalPrice += Number(offering?.recordedOriginalPrice ?? offering?.recordedDiscountPrice ?? 0);
                        } else if (selectedType === 'CHAMPION') {
                          totalPrice += Number(offering?.championDiscountPrice ?? offering?.championOriginalPrice ?? offering?.liveDiscountPrice ?? 0);
                          originalTotalPrice += Number(offering?.championOriginalPrice ?? offering?.liveOriginalPrice ?? 0);
                        } else {
                          totalPrice += Number(offering?.liveDiscountPrice ?? offering?.liveOriginalPrice ?? 0);
                          originalTotalPrice += Number(offering?.liveOriginalPrice ?? offering?.liveDiscountPrice ?? 0);
                        }
                      });
                    }
                  }

                  // Calculate bundle discount
                  let bundleDiscountAmt = 0;
                  if (activeBundle.enableBundleDiscount && activeBundle.bundleDiscountValue) {
                    let applicability = activeBundle.bundleDiscountApplicability || 'BOTH';
                    try {
                      const pd = JSON.parse(activeBundle.coursePrices || '{}');
                      if (pd.bundleDiscountApplicability) applicability = pd.bundleDiscountApplicability;
                    } catch(e) {}
                    const allSelected = selectedList.length === activeBundle.courses.length;
                    const meetsRequireAll = !activeBundle.requireAllCourses || allSelected;
                    
                    let accessOk = true;
                    if (applicability === 'LIVE') {
                      accessOk = selectedList.every((id: string) => (bundleSelectedForPurchase[id] || effectiveGlobalType || 'RECORDED') === 'LIVE');
                    } else if (applicability === 'RECORDED') {
                      accessOk = selectedList.every((id: string) => (bundleSelectedForPurchase[id] || effectiveGlobalType || 'RECORDED') === 'RECORDED');
                    }
                    
                    if (accessOk && meetsRequireAll) {
                      if (activeBundle.bundleDiscountType === 'PERCENTAGE') {
                        bundleDiscountAmt = Math.round((totalPrice * activeBundle.bundleDiscountValue) / 100);
                      } else {
                        bundleDiscountAmt = activeBundle.bundleDiscountValue;
                      }
                      bundleDiscountAmt = Math.min(bundleDiscountAmt, totalPrice);
                    }
                  }

                  const afterBundleDiscount = totalPrice - bundleDiscountAmt;
                  const couponDiscountAmt = couponApplied ? Math.min(couponApplied.discountAmount || 0, afterBundleDiscount) : 0;
                  const finalTotal = Math.max(0, afterBundleDiscount - couponDiscountAmt);
                  const totalSavings = bundleDiscountAmt + couponDiscountAmt + (originalTotalPrice > totalPrice ? originalTotalPrice - totalPrice : 0);

                  return (
                    <>
                      <div style={{ marginBottom: 'auto', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: '900', marginBottom: '12px', borderBottom: '2px solid var(--border)', paddingBottom: '12px' }}>Detailed Breakdown</div>
                        
                        {!isFixed && selectedList.length === 0 ? (
                          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>👈</div>
                            <div style={{ fontSize: '13px', fontWeight: '800' }}>Please select at least one course</div>
                            <div style={{ fontSize: '11px', marginTop: '4px' }}>to see your price breakdown</div>
                          </div>
                        ) : (
                          <>
                            {/* For non-fixed bundles: per-course breakdown */}
                            <div style={{ marginBottom: '20px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                              {!isFixed && selectedList.map((courseId: string) => {
                                const bc = activeBundle.courses.find((c: any) => c.course.id === courseId);
                                const offering = (activeOfferings as any[]).find(o => o.courseId === courseId);
                                const selectedType = bundleSelectedForPurchase[courseId] || effectiveGlobalType || 'RECORDED';
                                
                                const bPriceData = activeBundle.coursePrices ? JSON.parse(activeBundle.coursePrices) : {};
                                const bundleMappings = bPriceData.individualMapping || {};
                                const bundleCustomPrice = bundleMappings[courseId];
                                const tierForCount2 = bPriceData[selectedList.length];

                                const price = selectedType === 'RECORDED' 
                                  ? Number(bundleCustomPrice?.recorded || tierForCount2?.recordedDiscount || tierForCount2?.recordedOriginal || offering?.recordedDiscountPrice ?? offering?.recordedOriginalPrice ?? 0)
                                  : Number(bundleCustomPrice?.live || tierForCount2?.liveDiscount || tierForCount2?.liveOriginal || offering?.liveDiscountPrice ?? offering?.liveOriginalPrice ?? 0);
                                
                                return (
                                  <div key={courseId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <div style={{ flex: 1, paddingRight: '12px' }}>
                                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '800' }}>{bc?.course.name}</div>
                                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>{selectedType === 'LIVE' ? 'LIVE PRO' : 'RECORDED PLUS'}</div>
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{price}</span>
                                  </div>
                                )
                              })}
                              {isFixed && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                  <div style={{ flex: 1, paddingRight: '12px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '800' }}>{activeBundle.title}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>{effectiveGlobalType === 'LIVE' ? 'LIVE PRO' : 'RECORDED PLUS'}</div>
                                  </div>
                                  <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)' }}>₹{totalPrice}</span>
                                </div>
                              )}
                            </div>

                            {/* Subtotal removed to save vertical space */}

                            {bundleDiscountAmt > 0 && (() => {
                              let discountApplicability = 'BOTH';
                              try {
                                const pd = JSON.parse(activeBundle.coursePrices || '{}');
                                if (pd.bundleDiscountApplicability) discountApplicability = pd.bundleDiscountApplicability;
                              } catch(e) {}
                              const applicabilityLabel = discountApplicability === 'LIVE' ? 'Live Pro Only' : discountApplicability === 'RECORDED' ? 'Recorded Plus Only' : 'Live & Recorded';
                              return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '10px 14px', borderRadius: '12px', background: 'var(--success-light)', border: '1px solid #dcfce7' }}>
                                  <div>
                                    <div style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '900' }}>🏷️ Bundle Discount</div>
                                    <div style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '700', marginTop: '2px' }}>Applies to: {applicabilityLabel}</div>
                                  </div>
                                  <span style={{ fontSize: '13px', fontWeight: '950', color: 'var(--success)' }}>-₹{bundleDiscountAmt}</span>
                                </div>
                              );
                            })()}

                            {couponApplied && couponDiscountAmt > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', padding: '10px 14px', borderRadius: '12px', background: 'var(--info-light)', border: '1px solid #dbeafe' }}>
                                <span style={{ fontSize: '13px', color: 'var(--info)', fontWeight: '900' }}>Coupon: {couponApplied.code}</span>
                                <span style={{ fontSize: '13px', fontWeight: '950', color: 'var(--info)' }}>-₹{couponDiscountAmt}</span>
                              </div>
                            )}
                          </>
                        )}

                        {!isAllEnrolled && (
                          <div style={{ marginTop: '24px', marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Apply Coupon</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input 
                                type="text" 
                                value={couponCode} 
                                onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError('') }} 
                                placeholder="ENTER CODE" 
                                style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '2.5px solid var(--border)', fontSize: '14px', fontWeight: '900', outline: 'none', transition: 'border-color 0.2s' }} 
                                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                                onBlur={e => e.currentTarget.style.borderColor = 'var(--surface)'}
                                disabled={!!couponApplied} 
                              />
                              {couponApplied ? (
                                <button onClick={() => { setCouponApplied(null); setCouponCode(''); setCouponError('') }} style={{ padding: '12px 18px', borderRadius: '12px', background: 'var(--danger-light)', border: 'none', color: 'var(--danger)', fontWeight: '900', cursor: 'pointer' }}>✕</button>
                              ) : (
                                <button 
                                  disabled={!couponCode || couponLoading} 
                                  onClick={async () => {
                                    setCouponLoading(true); setCouponError('')
                                    try {
                                      const res = await fetch('/api/store/coupons/validate', { 
                                        method: 'POST', 
                                        headers: { 'Content-Type': 'application/json' }, 
                                        body: JSON.stringify({ 
                                          code: couponCode, 
                                          bundleOfferingId: activeBundle.id, 
                                          subtotal: afterBundleDiscount,
                                          perCourseAccessTypes: bundleSelectedForPurchase 
                                        }) 
                                      })
                                      const data = await res.json()
                                      if (res.ok && data.valid) { setCouponApplied(data) }
                                      else { setCouponError(data.error || 'Invalid coupon') }
                                    } catch { setCouponError('Failed to validate') }
                                    finally { setCouponLoading(false) }
                                  }} 
                                  style={{ padding: '12px 20px', borderRadius: '12px', background: couponCode ? 'var(--text-primary)' : 'var(--surface)', color: couponCode ? '#fff' : 'var(--text-muted)', fontWeight: '900', cursor: couponCode ? 'pointer' : 'not-allowed', border: 'none' }}
                                >{couponLoading ? '...' : 'APPLY'}</button>
                              )}
                            </div>
                            {couponError && <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '800', marginTop: '8px', padding: '4px 8px', background: 'var(--danger-light)', borderRadius: '6px' }}>{couponError}</div>}
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '3px solid var(--border)' }}>
                          <span style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: '950' }}>Total Payable</span>
                          <div style={{ textAlign: 'right' }}>
                            {(originalTotalPrice > finalTotal || bundleDiscountAmt > 0 || couponDiscountAmt > 0) && (
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through', marginBottom: '2px', fontWeight: '800' }}>₹{originalTotalPrice > totalPrice ? originalTotalPrice : totalPrice}</div>
                            )}
                            <div style={{ fontSize: '32px', fontWeight: '1000', color: 'var(--accent)', lineHeight: '1', letterSpacing: '-1px' }}>₹{isAllEnrolled ? 0 : finalTotal}</div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <button 
                          disabled={isProcessing || isAllEnrolled || selectedList.length === 0}
                          onClick={async () => {
                            try {
                              if (selectedList.length === 0) { alert('Select at least one course'); return }
                              setIsProcessing(true)
                              const res = await fetch(`/api/bundle-offerings/${activeBundle.id}/create-order`, { 
                                method: 'POST', 
                                headers: { 'Content-Type': 'application/json' }, 
                                body: JSON.stringify({ 
                                  buyAll: selectedList.length === activeBundle.courses.length, 
                                  accessType: effectiveGlobalType, 
                                  selectedCourseIds: selectedList, 
                                  perCourseAccessTypes: bundleSelectedForPurchase, 
                                  couponCode: couponApplied?.code || null 
                                }) 
                              })
                              const data = await res.json()
                              if (!res.ok) { alert(data.error || 'Failed to create order'); setIsProcessing(false); return }
                              if (data.freeCheckout) {
                                setSuccessOrderId(data.orderId || 'FREE'); setPurchasedCourse({ courseName: data.bundleName, accessType: 'MIXED' }); setShowBundleModal(false); setIsProcessing(false); return
                              }
                              const options = {
                                key: data.keyId,
                                amount: data.amount,
                                currency: data.currency,
                                name: 'GenZ IItian',
                                description: `Purchase courses from bundle — ${data.bundleName}`,
                                order_id: data.razorpayOrderId,
                                prefill: { name: userData?.user?.name || '', email: userData?.user?.email || '' },
                                theme: { color: 'var(--accent)' },
                                handler: async (response: any) => {
                                  try {
                                    const verifyRes = await fetch('/api/orders/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ razorpay_payment_id: response.razorpay_payment_id, razorpay_order_id: response.razorpay_order_id, razorpay_signature: response.razorpay_signature }) })
                                    const verifyData = await verifyRes.json()
                                    if (verifyRes.ok) {
                                      setSuccessOrderId(verifyData.orderId || 'SUCCESS')
                                      setPurchasedCourse({ courseName: data.bundleName, accessType: 'MIXED' })
                                      setShowBundleModal(false)
                                    } else {
                                      alert('Verification failed: ' + verifyData.error)
                                    }
                                  } catch (err) { alert('Payment verification failed') }
                                  finally { setIsProcessing(false) }
                                },
                                modal: { ondismiss: () => setIsProcessing(false) }
                              }
                              const rzp = new (window as any).Razorpay(options)
                              rzp.open()
                              setIsProcessing(false)
                            } catch (err: any) { alert(err.message || 'Something went wrong'); setIsProcessing(false) }
                          }} 
                          style={{ 
                            width: '100%', 
                            padding: '20px', 
                            borderRadius: '18px', 
                            background: (isAllEnrolled || selectedList.length === 0) ? 'var(--surface)' : 'linear-gradient(135deg, #6366f1, #4f46e5)', 
                            color: (isAllEnrolled || selectedList.length === 0) ? 'var(--text-muted)' : '#fff', 
                            fontWeight: '1000', 
                            fontSize: '17px', 
                            boxShadow: (isAllEnrolled || selectedList.length === 0) ? 'none' : '0 15px 30px rgba(99, 102, 241, 0.35)', 
                            border: 'none', 
                            cursor: (isProcessing || isAllEnrolled || selectedList.length === 0) ? 'not-allowed' : 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                          }}
                          onMouseEnter={(e) => { if (!isProcessing && !isAllEnrolled && selectedList.length > 0) e.currentTarget.style.transform = 'translateY(-4px)' }}
                          onMouseLeave={(e) => { if (!isProcessing && !isAllEnrolled && selectedList.length > 0) e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                          {isProcessing ? 'Processing Order...' : (isAllEnrolled ? 'ALREADY ENROLLED' : (selectedList.length === 0 ? 'SELECT SUBJECTS' : (finalTotal === 0 ? 'GET FOR FREE 🎉' : 'GET NOW')))}
                        </button>
                        {isAllEnrolled && (
                          <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800', marginTop: '16px' }}>
                            All selected subjects are already in your account.
                          </div>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )}
      {/* ── Batch Comparison Modal (opened from bundle i button) ── */}
      {showBatchComparisonModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
          padding: '20px'
        }} onClick={() => setShowBatchComparisonModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '750px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
            animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '30px 40px', background: 'linear-gradient(135deg, var(--surface-2), var(--border))', borderBottom: '1.5px solid var(--border)', position: 'relative' }}>
              <button onClick={() => setShowBatchComparisonModal(false)} style={{ position: 'absolute', top: '25px', right: '30px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Batch Comparison</h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>Choose the experience that fits your learning style</p>
            </div>

            {/* Comparison Table */}
            <div style={{ padding: '30px 40px' }}>
              <div style={{ borderRadius: '24px', overflow: 'hidden', border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th style={{ padding: '18px 24px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Features</th>
                      <th style={{ padding: '18px 24px', fontSize: '13px', color: 'var(--warning)', fontWeight: '800', background: 'var(--warning-light)', textAlign: 'center' }}>PLUS ( Recorded )</th>
                      <th style={{ padding: '18px 24px', fontSize: '13px', color: 'var(--primary-dark)', fontWeight: '800', background: 'var(--primary-light)', textAlign: 'center' }}>PRO ( Live )</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { f: 'Course Lectures', g: '✅ Full Access', p: '✅ Full Access' },
                      { f: 'Course Materials', g: '✅ Full Access', p: '✅ Full Access' },
                      { f: 'Live Classes', g: '❌ No Access', p: '✅ Direct Entry' },
                      { f: 'Direct Q&A with Teacher', g: '❌ No', p: '✅ Yes (Live)' },
                      { f: 'Weekly Mentorship', g: '❌ No', p: '✅ Every Sunday' },
                      { f: 'Priority Support', g: '❌ Standard', p: '✅ 24/7 Priority' },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>{row.f}</td>
                        <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--warning)', textAlign: 'center', background: 'var(--warning-light)' }}>{row.g}</td>
                        <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--primary-dark)', fontWeight: '700', textAlign: 'center', background: 'var(--surface)' }}>{row.p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '0 40px 40px', textAlign: 'center' }}>
              <button onClick={() => setShowBatchComparisonModal(false)} style={{ background: 'var(--primary)', color: 'white', padding: '14px 40px', borderRadius: '16px', fontSize: '15px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Offering Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px', overflow: 'auto'
        }} onClick={() => setShowCreateModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '960px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px',
            animation: 'modalSlideUp 0.3s ease-out',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowCreateModal(false)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', zIndex: 10 }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '24px' }}>
              Add Course to Store
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Select Course *
                  </label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid var(--border)',
                      fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', 
                      background: 'var(--surface)', cursor: 'pointer'
                    }}
                  >
                    <option value="">Choose a course...</option>
                    {courses?.map((course: any) => {
                      const isExisting = activeOfferings?.some((o: any) => o.courseId === course.id);
                      return (
                        <option key={course.id} value={course.id} disabled={isExisting}>
                          {course.name} {isExisting ? '(Already in store)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Select Category *
                  </label>
                  <select
                    value={offeringCategory}
                    onChange={(e) => setOfferingCategory(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid var(--border)',
                      fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', 
                      background: 'var(--surface)', cursor: 'pointer'
                    }}
                  >
                    <option value="">Choose a category...</option>
                    <option value="Re-attempt">Re-attempt</option>
                    <option value="Foundation">Foundation</option>
                    <option value="Diploma">Diploma</option>
                    <option value="General">General</option>
                  </select>
                </div>

                {selectedCourse && courses && (
                  (() => {
                    const selected = courses.find((c: any) => c.id === selectedCourse)
                    return selected ? (
                      <div style={{
                        background: `linear-gradient(135deg, ${selected.color || 'var(--accent)'}15, ${selected.color || 'var(--accent)'}08)`,
                        border: `2px solid ${selected.color || 'var(--accent)'}40`,
                        padding: '20px',
                        borderRadius: '16px',
                        marginBottom: '24px'
                      }}>
                        <h3 style={{
                          fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '4px',
                          lineHeight: '1.2'
                        }}>
                          {selected.name}
                        </h3>
                        {selected.subject && (
                          <p style={{
                            fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '0'
                          }}>
                            {selected.subject}
                          </p>
                        )}
                      </div>
                    ) : null
                  })()
                )}

                <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '18px', marginBottom: '24px', border: '2px solid var(--border)' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📹 Recording Batch - Plus
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Real Price (₹)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={recordedOriginalPrice}
                        onChange={(e) => setRecordedOriginalPrice(e.target.value)}
                        placeholder="0"
                        style={{
                          width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid var(--neu-dark)',
                          fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--surface)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Discount Price (₹)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={recordedDiscountPrice}
                        onChange={(e) => setRecordedDiscountPrice(e.target.value)}
                        placeholder="0"
                        style={{
                          width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid var(--neu-dark)',
                          fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--surface)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f0f3ff', padding: '20px', borderRadius: '18px', marginBottom: '24px', border: '2px solid var(--border)' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🔴 Live Batch - Pro
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Real Price (₹)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={liveOriginalPrice}
                        onChange={(e) => setLiveOriginalPrice(e.target.value)}
                        placeholder="0"
                        style={{
                          width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid var(--neu-dark)',
                          fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--surface)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Discount Price (₹)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={liveDiscountPrice}
                        onChange={(e) => setLiveDiscountPrice(e.target.value)}
                        placeholder="0"
                        style={{
                          width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid var(--neu-dark)',
                          fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--surface)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--danger-light)', padding: '20px', borderRadius: '18px', marginBottom: '24px', border: '2px solid var(--border)' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--danger)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🏆 Champion Batch
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Real Price (₹)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={championOriginalPrice}
                        onChange={(e) => setChampionOriginalPrice(e.target.value)}
                        placeholder="0"
                        style={{
                          width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid var(--neu-dark)',
                          fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--surface)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Discount Price (₹)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={championDiscountPrice}
                        onChange={(e) => setChampionDiscountPrice(e.target.value)}
                        placeholder="0"
                        style={{
                          width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid var(--neu-dark)',
                          fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--surface)'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Champion Subtitle (e.g. Includes Unlimited Support)
                    </label>
                    <input
                      type="text"
                      value={championSubtitle}
                      onChange={(e) => setChampionSubtitle(e.target.value)}
                      placeholder="Special words for Champion tier..."
                      style={{
                        width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid var(--neu-dark)',
                        fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--surface)'
                      }}
                    />
                  </div>
                </div>

              </div>

              <div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Tags / Badges
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {tags.map((tag, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--accent)', color: '#fff', padding: '6px 12px', borderRadius: '20px',
                          fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        {tag}
                        <button
                          onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          setTags([...tags, tagInput.trim()])
                          setTagInput('')
                        }
                      }}
                      placeholder="e.g., Bestseller, 50% OFF (press Enter)"
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid var(--neu-dark)',
                        fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--surface)'
                      }}
                    />
                    <button
                      onClick={() => {
                        if (tagInput.trim()) {
                          setTags([...tags, tagInput.trim()])
                          setTagInput('')
                        }
                      }}
                      style={{
                        padding: '10px 16px', borderRadius: '10px', border: 'none',
                        background: 'var(--accent)', color: '#fff', fontWeight: '700',
                        cursor: 'pointer', fontSize: '12px'
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedCourse) {
                    alert('Please select a course')
                    return
                  }
                  if (!offeringCategory) {
                    alert('Please select a category')
                    return
                  }
                  if (activeOfferings?.some((o: any) => o.courseId === selectedCourse)) {
                    alert('This course is already in the store.')
                    return
                  }
                  const recordedOriginal = Math.max(parseInt(recordedOriginalPrice || '0', 10) || 0, 0)
                  const recordedDiscount = Math.max(parseInt(recordedDiscountPrice || '0', 10) || 0, 0)
                  const liveOriginal = Math.max(parseInt(liveOriginalPrice || '0', 10) || 0, 0)
                  const liveDiscount = Math.max(parseInt(liveDiscountPrice || '0', 10) || 0, 0)
                  const championOriginal = Math.max(parseInt(championOriginalPrice || '0', 10) || 0, 0)
                  const championDiscount = Math.max(parseInt(championDiscountPrice || '0', 10) || 0, 0)

                  if (!recordedOriginal && !liveOriginal && !championOriginal) {
                    alert('Please enter at least one price (recording, live, or champion)')
                    return
                  }
                  if ((recordedOriginal && recordedOriginal < 1) || (recordedDiscount && recordedDiscount < 1) || (liveOriginal && liveOriginal < 1) || (liveDiscount && liveDiscount < 1) || (championOriginal && championOriginal < 1) || (championDiscount && championDiscount < 1)) {
                    alert('Price cannot be less than 1')
                    return
                  }
                  setCreating(true)
                  try {
                    const res = await fetch('/api/course-offerings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        courseId: selectedCourse,
                        recordedOriginalPrice: recordedOriginal,
                        recordedDiscountPrice: recordedDiscount,
                        liveOriginalPrice: liveOriginal,
                        liveDiscountPrice: liveDiscount,
                        championOriginalPrice: championOriginal,
                        championDiscountPrice: championDiscount,
                        championSubtitle: championSubtitle,
                        tags: tags,
                        hasRecorded: recordedOriginal > 0 || recordedDiscount > 0,
                        hasLive: liveOriginal > 0 || liveDiscount > 0,
                        hasChampion: championOriginal > 0 || championDiscount > 0,
                        category: offeringCategory,
                      }),
                    })
                    if (res.ok) {
                      alert('Course added to store successfully!')
                      setShowCreateModal(false)
                      setSelectedCourse('')
                      setOfferingCategory('')
                      setRecordedOriginalPrice('')
                      setRecordedDiscountPrice('')
                      setLiveOriginalPrice('')
                      setLiveDiscountPrice('')
                      setChampionOriginalPrice('')
                      setChampionDiscountPrice('')
                      setChampionSubtitle('')
                      setTags([])
                      // reset bundle form
                      setCreateBundle(false)
                      setBundleName('')
                      setBundleSelectedCourses([])
                      setBundleRecordedOriginalPrice('')
                      setBundleRecordedDiscountPrice('')
                      setBundleLiveOriginalPrice('')
                      setBundleLiveDiscountPrice('')
                      setBundleAllowIndividualPurchase(true)
                      window.location.reload()
                    } else {
                      const data = await res.json()
                      alert('Error: ' + (data.error || 'Failed to create offering'))
                    }
                  } catch (err: any) {
                    alert('Error: ' + err.message)
                  } finally {
                    setCreating(false)
                  }
                }}
                disabled={!selectedCourse || creating}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                  background: !selectedCourse || creating ? '#d0d5e0' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', fontWeight: '700', fontSize: '14px',
                  cursor: !selectedCourse || creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.8 : 1
                }}
              >
                {creating ? 'Creating...' : 'Add to Store'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Verification Loading Modal */}
      {verifyingPayment && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '440px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px', textAlign: 'center',
            position: 'relative'
          }}>
            <button 
              onClick={() => setVerifyingPayment(false)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', zIndex: 10 }}
            >
              <X size={20} />
            </button>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              animation: 'spin 1s linear infinite'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Verifying Payment...
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '0' }}>
              Please wait while we confirm your payment and activate your course access.
            </p>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successOrderId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px'
          }} onClick={() => { setSuccessOrderId(null); router.push('/courses') }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '480px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px', textAlign: 'center',
            animation: 'modalSlideUp 0.3s ease-out',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => { setSuccessOrderId(null); router.push('/courses') }}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', zIndex: 10 }}
            >
              <X size={20} />
            </button>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎉</div>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '16px' }}>
              Payment Successful!
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              {purchasedCourse?.type === 'mentorship' 
                ? "Your mentorship session is confirmed! A Google Meet invite has been sent to your email. You can also join from the 'Live Sessions' tab." 
                : "Your access has been activated! You can start learning immediately. A confirmation email has been sent to your inbox."}
            </p>

            <div style={{ background: 'var(--surface)', borderRadius: '24px', padding: '24px', marginBottom: '32px', border: '1.5px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Recommended Next Step</div>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '600', lineHeight: '1.5', margin: 0 }}>
                While we prepare your content, explore our <strong>Free Resources</strong> section for extra study materials!
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => { setSuccessOrderId(null); router.push(purchasedCourse?.type === 'mentorship' ? '/courses?view=mentorship' : '/courses') }}
                style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--text-primary)', color: '#fff', fontWeight: '800', border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: '16px' }}
              >
                {purchasedCourse?.type === 'mentorship' ? 'View My Bookings' : 'Start Learning Now'}
              </button>
              <button 
                onClick={() => { setSuccessOrderId(null); router.push('/dashboard?view=free') }}
                style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--surface)', color: 'var(--text-secondary)', fontWeight: '800', border: '2px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '16px' }}
              >
                Visit Free Resources
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Success Modal */}
      {upgradeSuccessOrderId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px'
        }} onClick={() => { setUpgradeSuccessOrderId(null); router.push('/courses') }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '480px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px', textAlign: 'center',
            animation: 'modalSlideUp 0.3s ease-out',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => { setUpgradeSuccessOrderId(null); router.push('/courses') }}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', zIndex: 10 }}
            >
              <X size={20} />
            </button>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚡</div>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '16px' }}>
              Upgraded to PRO!
            </h2>

            <div style={{
              background: 'linear-gradient(135deg, var(--border), var(--border))',
              borderRadius: '20px', padding: '20px', marginBottom: '24px',
              border: '2px solid var(--border)'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>
                Access Upgraded
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)', marginBottom: '6px' }}>
                Live + Recorded (PRO)
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '700', marginBottom: '0' }}>
                You now have full access to live sessions!
              </div>
            </div>

            {/* Order ID */}
            {upgradeSuccessOrderId && upgradeSuccessOrderId !== 'SUCCESS' && (
              <div style={{ background: 'var(--bg)', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1.5px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Order ID
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-secondary)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                  {upgradeSuccessOrderId}
                </div>
              </div>
            )}

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              Your upgrade is complete! You can now join live sessions and access all premium features.
            </p>

            <button
              onClick={() => { setUpgradeSuccessOrderId(null); router.push('/courses') }}
              style={{
                width: '100%', padding: '16px', borderRadius: '18px', border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(99, 102, 241, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              Go to My Courses 🚀
            </button>
          </div>
        </div>
      )}



      {/* Edit Offering Modal */}
      {editingOffering && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px', overflow: 'auto'
        }} onClick={() => setEditingOffering(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '960px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px',
            animation: 'modalSlideUp 0.3s ease-out',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setEditingOffering(null)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', zIndex: 10 }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '24px' }}>
              Edit Course Offering
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Course</label>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{editingOffering.course?.name}</div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Category *</label>
                  <select
                    value={editFormData.category || 'General'}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', background: 'var(--surface)', cursor: 'pointer' }}
                  >
                    <option value="Re-attempt">Re-attempt</option>
                    <option value="Foundation">Foundation</option>
                    <option value="Diploma">Diploma</option>
                    <option value="General">General</option>
                  </select>
                </div>

                {editingOffering.hasRecorded && (
                  <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '18px', marginBottom: '20px', border: '2px solid var(--border)' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px' }}>
                      Recorded Batch
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Original Price (₹)</label>
                        <input type="number" min={1} value={editFormData.recordedOriginalPrice ?? ''} onChange={e => setEditFormData({...editFormData, recordedOriginalPrice: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Discount Price (₹)</label>
                        <input type="number" min={1} value={editFormData.recordedDiscountPrice ?? ''} onChange={e => setEditFormData({...editFormData, recordedDiscountPrice: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  </div>
                )}

                {editingOffering.hasLive && (
                  <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '18px', border: '2px solid var(--border)' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '16px' }}>
                      Live Batch
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Original Price (₹)</label>
                        <input type="number" min={1} value={editFormData.liveOriginalPrice ?? ''} onChange={e => setEditFormData({...editFormData, liveOriginalPrice: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Discount Price (₹)</label>
                        <input type="number" min={1} value={editFormData.liveDiscountPrice ?? ''} onChange={e => setEditFormData({...editFormData, liveDiscountPrice: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                {editingOffering.hasLive && (
                  <div style={{ marginBottom: '20px', padding: '20px', borderRadius: '18px', background: 'var(--danger-light)', border: '2px solid var(--border)' }}>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--danger)', marginBottom: '16px' }}>Champion Batch</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Real Price (₹)</label>
                        <input type="number" min={1} value={editFormData.championOriginalPrice ?? ''} onChange={e => setEditFormData({...editFormData, championOriginalPrice: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Discount Price (₹)</label>
                        <input type="number" min={1} value={editFormData.championDiscountPrice ?? ''} onChange={e => setEditFormData({...editFormData, championDiscountPrice: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Champion Subtitle</label>
                      <input type="text" value={editFormData.championSubtitle ?? ''} onChange={e => setEditFormData({...editFormData, championSubtitle: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} placeholder="e.g. Includes Unlimited Support..." />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Details Link (optional)</label>
                  <input type="url" value={editFormData.detailsLink ?? ''} onChange={e => setEditFormData({...editFormData, detailsLink: e.target.value})} placeholder="https://example.com/course-details" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>If set, a "More Details" button will appear on the course card for students.</div>
                </div>

              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={async () => {
                  if (!confirm('Are you sure you want to DELETE this course offering? This cannot be undone.')) return
                  try {
                    const res = await fetch(`/api/course-offerings/${editingOffering.id}`, { method: 'DELETE' })
                    if (res.ok) {
                      setEditingOffering(null)
                      window.location.reload()
                    } else {
                      const d = await res.json()
                      alert(d.error || 'Failed to delete')
                    }
                  } catch { alert('Failed to delete offering') }
                }}
                style={{
                  padding: '14px 18px', borderRadius: '12px', border: '2px solid var(--border)',
                  background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: '700', fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                🗑️
              </button>
              <button
                onClick={() => setEditingOffering(null)}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                disabled={editSaving}
                onClick={async () => {
                  try {
                    setEditSaving(true)
                    const res = await fetch(`/api/course-offerings/${editingOffering.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                        courseId: editingOffering.courseId,
                        name: editingOffering.name,
                        thumbnail: editingOffering.thumbnail,
                        recordedOriginalPrice: editFormData.recordedOriginalPrice || null,
                        recordedDiscountPrice: editFormData.recordedDiscountPrice || null,
                        liveOriginalPrice: editFormData.liveOriginalPrice || null,
                        liveDiscountPrice: editFormData.liveDiscountPrice || null,
                        championOriginalPrice: editFormData.championOriginalPrice || null,
                        championDiscountPrice: editFormData.championDiscountPrice || null,
                        championSubtitle: editFormData.championSubtitle || null,
                        detailsLink: editFormData.detailsLink || null,
                        hasRecorded: (editFormData.recordedOriginalPrice > 0 || editFormData.recordedDiscountPrice > 0),
                        hasLive: (editFormData.liveOriginalPrice > 0 || editFormData.liveDiscountPrice > 0),
                        category: editFormData.category || 'General',
                      })
                    })
                    if (res.ok) {
                      setEditingOffering(null)
                      window.location.reload()
                    } else {
                      const d = await res.json()
                      alert(d.error || 'Failed to save')
                    }
                  } catch { alert('Failed to save changes') }
                  finally { setEditSaving(false) }
                }}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                  background: editSaving ? 'var(--text-muted)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', fontWeight: '700', fontSize: '14px',
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bundle Modal */}
      {editingBundle && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          padding: '20px'
        }} onClick={() => setEditingBundle(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '600px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px',
            animation: 'modalSlideUp 0.3s ease-out',
            maxHeight: '90vh', overflowY: 'auto',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setEditingBundle(null)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', zIndex: 10 }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px' }}>Edit Bundle</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Update pricing, name, and selected courses for this bundle.</p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Bundle Name</label>
              <input type="text" value={editBundleData.name ?? ''} onChange={e => setEditBundleData({...editBundleData, name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Category *</label>
              <select
                value={editBundleData.category || 'General'}
                onChange={e => setEditBundleData({...editBundleData, category: e.target.value})}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', background: 'var(--surface)', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <option value="Re-attempt">Re-attempt</option>
                <option value="Foundation">Foundation</option>
                <option value="Diploma">Diploma</option>
                <option value="General">General</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Description</label>
              <input type="text" value={editBundleData.description ?? ''} onChange={e => setEditBundleData({...editBundleData, description: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Banner Text</label>
                <input type="text" value={editBundleData.bannerText ?? ''} onChange={e => setEditBundleData({...editBundleData, bannerText: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Starting From Text</label>
                <input type="text" value={editBundleData.startingFromText ?? ''} onChange={e => setEditBundleData({...editBundleData, startingFromText: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Course Section Headline</label>
              <input type="text" value={editBundleData.courseHeadline ?? ''} onChange={e => setEditBundleData({...editBundleData, courseHeadline: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Starting Price (₹)</label>
              <input type="number" value={editBundleData.startingPrice ?? ''} onChange={e => setEditBundleData({...editBundleData, startingPrice: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>


            {/* 1. Fixed Bundle Toggle - NOW AT TOP */}
            <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', background: 'var(--primary-light)', border: '1.5px solid #dbeafe' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)' }}>🔒 Fixed Bundle</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Users must buy all courses together (No individual selection)</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={editBundleData.allowIndividualPurchase === false} 
                  onChange={e => setEditBundleData({ ...editBundleData, allowIndividualPurchase: !e.target.checked })} 
                  style={{ width: '22px', height: '22px', accentColor: 'var(--accent)' }} 
                />
              </label>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Select Courses</label>
              <div style={{ maxHeight: '160px', overflow: 'auto', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                {(courses || []).map((c: any) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editBundleData.courseIds?.includes(c.id) || false}
                      onChange={(e) => {
                        const current = editBundleData.courseIds || []
                        if (e.target.checked) setEditBundleData({ ...editBundleData, courseIds: [...current, c.id] })
                        else setEditBundleData({ ...editBundleData, courseIds: current.filter((id: string) => id !== c.id) })
                      }}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                    />
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{c.name}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Bundle Pricing Section */}
            {editBundleData.allowIndividualPurchase === false ? (
              // FIXED BUNDLE PRICING - SHOW ONLY GLOBAL PRICES
              <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '20px', background: 'var(--success-light)', border: '1.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '20px' }}>🏷️</span>
                  <label style={{ fontSize: '14px', fontWeight: '900', color: 'var(--success)', textTransform: 'uppercase' }}>Bundle Prices (Fixed Package)</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', marginBottom: '4px' }}>Bundle Recorded Price (₹)</div>
                    <input 
                      type="number" 
                      value={editBundleData.recordedDiscountPrice ?? ''} 
                      onChange={e => setEditBundleData({ ...editBundleData, recordedDiscountPrice: e.target.value, recordedOriginalPrice: e.target.value })} 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #86efac', fontSize: '14px', fontWeight: '700' }} 
                      placeholder="e.g. 4000"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', marginBottom: '4px' }}>Bundle Live Price (₹)</div>
                    <input 
                      type="number" 
                      value={editBundleData.liveDiscountPrice ?? ''} 
                      onChange={e => setEditBundleData({ ...editBundleData, liveDiscountPrice: e.target.value, liveOriginalPrice: e.target.value })} 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #86efac', fontSize: '14px', fontWeight: '700' }} 
                      placeholder="e.g. 5500"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--danger)', marginBottom: '4px' }}>Bundle Champion Price (₹)</div>
                    <input 
                      type="number" 
                      value={editBundleData.championDiscountPrice ?? ''} 
                      onChange={e => setEditBundleData({ ...editBundleData, championDiscountPrice: e.target.value, championOriginalPrice: e.target.value })} 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #fca5a5', fontSize: '14px', fontWeight: '700' }} 
                      placeholder="e.g. 7500"
                    />
                  </div>
                </div>
                <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', marginBottom: '4px' }}>Champion Subtitle</div>
                    <input 
                      type="text" 
                      value={editBundleData.championSubtitle ?? ''} 
                      onChange={e => setEditBundleData({ ...editBundleData, championSubtitle: e.target.value })} 
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #86efac', fontSize: '13px' }} 
                      placeholder="e.g. Includes Unlimited Support..."
                    />
                  </div>
                <p style={{ fontSize: '10px', color: 'var(--success)', marginTop: '10px', fontWeight: '600' }}>* This price will be applied to the entire bundle when users buy all subjects.</p>
              </div>
            ) : (
              // NON-FIXED PRICING - SHOW INDIVIDUAL SUBJECT PRICES
              <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '20px', background: 'var(--info-light)', border: '1.5px solid #bae6fd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '20px' }}>💰</span>
                  <label style={{ fontSize: '14px', fontWeight: '900', color: '#0369a1', textTransform: 'uppercase' }}>Subject Specific Pricing</label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(() => {
                    let priceData = {};
                    try { priceData = JSON.parse(editBundleData.coursePrices || '{}'); } catch(e) {}
                    const mappings = (priceData as any).individualMapping || {};
                    
                    return (editBundleData.courseIds || []).map((id: string) => {
                      const course = (courses || []).find((c: any) => c.id === id);
                      if (!course) return null;
                      const mapping = mappings[id] || {};
                      
                      return (
                        <div key={id} style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '10px' }}>{course.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>Recorded Price (₹)</div>
                              <input 
                                type="number" 
                                value={mapping.recorded || ''} 
                                onChange={e => {
                                  const newMappings = { ...mappings, [id]: { ...mapping, recorded: e.target.value } };
                                  const newData = { ...priceData, individualMapping: newMappings };
                                  setEditBundleData({ ...editBundleData, coursePrices: JSON.stringify(newData) });
                                }}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }} 
                                placeholder="e.g. 1000"
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>Live Price (₹)</div>
                              <input 
                                type="number" 
                                value={mapping.live || ''} 
                                onChange={e => {
                                  const newMappings = { ...mappings, [id]: { ...mapping, live: e.target.value } };
                                  const newData = { ...priceData, individualMapping: newMappings };
                                  setEditBundleData({ ...editBundleData, coursePrices: JSON.stringify(newData) });
                                }}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }} 
                                placeholder="e.g. 2000"
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>Champ Price (₹)</div>
                              <input 
                                type="number" 
                                value={mapping.champion || ''} 
                                onChange={e => {
                                  const newMappings = { ...mappings, [id]: { ...mapping, champion: e.target.value } };
                                  const newData = { ...priceData, individualMapping: newMappings };
                                  setEditBundleData({ ...editBundleData, coursePrices: JSON.stringify(newData) });
                                }}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }} 
                                placeholder="e.g. 3000"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Force Class Type Configuration */}
            {editBundleData.allowIndividualPurchase === false && (
              <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>🎯 Force Class Type</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Force users to buy a specific class type (Live or Recorded)</div>
                  </div>
                </div>
                <select 
                  value={editBundleData.forceClassType || ''} 
                  onChange={e => setEditBundleData({ ...editBundleData, forceClassType: e.target.value === '' ? null : e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                >
                  <option value="">Let user choose (Live or Recorded)</option>
                  <option value="RECORDED">Force Recorded Classes</option>
                  <option value="LIVE">Force Live Classes</option>
                </select>
              </div>
            )}

            {/* Bundle Discount Configuration */}
            <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '12px', background: 'var(--warning-light)', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: editBundleData.enableBundleDiscount ? '14px' : 0 }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--warning)' }}>🏷️ Bundle Discount</div>
                  <div style={{ fontSize: '12px', color: '#a16207', marginTop: '2px' }}>Apply a discount when users buy from this bundle</div>
                </div>
                <input type="checkbox" checked={!!editBundleData.enableBundleDiscount} onChange={e => setEditBundleData({ ...editBundleData, enableBundleDiscount: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--warning)' }} />
              </label>
              {editBundleData.enableBundleDiscount && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--warning)', display: 'block', marginBottom: '4px' }}>Discount Type</label>
                      <select value={editBundleData.bundleDiscountType || 'PERCENTAGE'} onChange={e => setEditBundleData({ ...editBundleData, bundleDiscountType: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED">Fixed Amount (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--warning)', display: 'block', marginBottom: '4px' }}>Discount Value</label>
                      <input type="number" min={0} value={editBundleData.bundleDiscountValue ?? ''} onChange={e => setEditBundleData({ ...editBundleData, bundleDiscountValue: e.target.value })} placeholder={editBundleData.bundleDiscountType === 'FIXED' ? '₹ Amount' : '% Off'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--warning)', display: 'block', marginBottom: '4px' }}>Applies To</label>
                      <select value={editBundleData.bundleDiscountApplicability || 'BOTH'} onChange={e => setEditBundleData({ ...editBundleData, bundleDiscountApplicability: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                        <option value="BOTH">Both (Recorded + Live)</option>
                        <option value="RECORDED">Recorded Only</option>
                        <option value="LIVE">Live Only</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: '18px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editBundleData.requireAllCourses !== false} onChange={e => setEditBundleData({ ...editBundleData, requireAllCourses: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: 'var(--warning)' }} />
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--warning)' }}>Only when all courses selected</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setEditingBundle(null)}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                disabled={editBundleSaving}
                onClick={async () => {
                  try {
                    setEditBundleSaving(true)
                    const res = await fetch(`/api/bundle-offerings/${editingBundle.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(editBundleData)
                    })
                    if (res.ok) {
                      setEditingBundle(null)
                      window.location.reload()
                    } else {
                      const d = await res.json()
                      alert(d.error || 'Failed to save')
                    }
                  } catch { alert('Failed to save changes') }
                  finally { setEditBundleSaving(false) }
                }}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                  background: editBundleSaving ? 'var(--text-muted)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', fontWeight: '700', fontSize: '14px',
                  cursor: editBundleSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {editBundleSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Type Comparison Modal */}
      {infoModalOffering && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '12px'
        }} onClick={() => setInfoModalOffering(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'clamp(16px, 4vw, 32px)', width: '100%', maxWidth: 'min(750px, calc(100vw - 24px))',
            maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: 'clamp(20px, 5vw, 30px) clamp(20px, 5vw, 40px)', background: 'linear-gradient(135deg, var(--surface-2), var(--border))', borderBottom: '1.5px solid var(--border)', position: 'relative' }}>
              <button onClick={() => setInfoModalOffering(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
              <h2 style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px', paddingRight: '40px' }}>Access Comparison</h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '500' }}>Choose the access type that suits your learning needs</p>
            </div>

            {/* Comparison Table */}
            <div style={{ padding: '30px 40px' }}>
              <div style={{ borderRadius: '24px', overflow: 'hidden', border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th style={{ padding: '18px 24px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Features</th>
                      {infoModalOffering.hasRecorded && (
                        <th style={{ padding: '18px 24px', fontSize: '13px', color: 'var(--warning)', fontWeight: '800', background: 'var(--warning-light)', textAlign: 'center' }}>Recorded ( PLUS )</th>
                      )}
                      {infoModalOffering.hasLive && (
                        <th style={{ padding: '18px 24px', fontSize: '13px', color: 'var(--primary-dark)', fontWeight: '800', background: 'var(--primary-light)', textAlign: 'center' }}>Live + Recorded (PRO)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { f: 'Recorded Lectures', recorded: '✅ Full Access', live: '✅ Full Access' },
                      { f: 'Course Materials', recorded: '✅ Full Access', live: '✅ Full Access' },
                      { f: 'Live Classes', recorded: '❌ No Access', live: '✅ Direct Entry' },
                      { f: 'Direct Q&A with Teacher', recorded: '❌ No', live: '✅ Yes (Live)' },
                      { f: 'Class Recordings', recorded: '✅ Available', live: '✅ Available' },
                      { f: 'Priority Support', recorded: '❌ Standard', live: '✅ 24/7 Priority' },
                      { f: 'Course Duration', recorded: 'Access Till End Term', live: 'Access Till End Term' },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>{row.f}</td>
                        {infoModalOffering.hasRecorded && (
                          <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--warning)', textAlign: 'center', background: 'var(--warning-light)' }}>{row.recorded}</td>
                        )}
                        {infoModalOffering.hasLive && (
                          <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--primary-dark)', fontWeight: '700', textAlign: 'center', background: 'var(--surface)' }}>{row.live}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '0 40px 40px', textAlign: 'center' }}>
              <button onClick={() => setInfoModalOffering(null)} style={{ background: 'var(--primary)', color: 'white', padding: '14px 40px', borderRadius: '16px', fontSize: '15px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing Modal */}
      {isProcessing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface)', padding: '40px', borderRadius: '32px',
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            width: '320px', position: 'relative'
          }}>
            <button 
              onClick={() => setIsProcessing(false)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--surface)', border: 'none', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', zIndex: 10 }}
            >
              <X size={18} />
            </button>
            <div className="spinner" style={{
              width: '40px', height: '40px', border: '4px solid #f3f3f3',
              borderTop: '4px solid #6366f1', borderRadius: '50%',
              margin: '0 auto 20px'
            }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Processing...</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Please wait while we set up your course access.</p>
          </div>
        </div>
      )}

      {/* CREATE BUNDLE MODAL */}
      {showCreateBundleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }} onClick={() => setShowCreateBundleModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '600px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px', maxHeight: '90vh', overflowY: 'auto',
            animation: 'modalSlideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                  Create Bundle 📦
                </h2>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '500', lineHeight: '1.5' }}>
                  Group multiple courses into a single package.
                </p>
              </div>
              <button onClick={() => setShowCreateBundleModal(false)} style={{ background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Bundle Name</label>
              <input value={bundleName} onChange={e => setBundleName(e.target.value)} placeholder="E.g., Complete Developer Bootcamp" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Category *</label>
              <select
                value={bundleCategory}
                onChange={e => setBundleCategory(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px', background: 'var(--surface)', cursor: 'pointer' }}
              >
                <option value="">Select Category...</option>
                <option value="Re-attempt">Re-attempt</option>
                <option value="Foundation">Foundation</option>
                <option value="Diploma">Diploma</option>
                <option value="General">General</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Bundle Description</label>
              <textarea value={bundleDescription} onChange={e => setBundleDescription(e.target.value)} placeholder="Tell students what's included in this bundle..." rows={3} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px', resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Courses Start From (₹)</label>
              <input type="number" value={bundleStartingPrice} onChange={e => setBundleStartingPrice(e.target.value)} placeholder="E.g., 499" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5 solid #dbeafe', fontSize: '14px' }} />
            </div>

            <div style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Banner Text</label>
                <input value={bundleBannerText} onChange={e => setBundleBannerText(e.target.value)} placeholder="Class starts from..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Starting From Text</label>
                <input value={bundleStartingFromText} onChange={e => setBundleStartingFromText(e.target.value)} placeholder="Courses start from..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Course Section Headline</label>
              <input value={bundleCourseHeadline} onChange={e => setBundleCourseHeadline(e.target.value)} placeholder="Included Courses" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
            </div>

            {/* Fixed Bundle Toggle - AT TOP */}
            <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', background: 'var(--primary-light)', border: '1.5px solid #dbeafe' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)' }}>🔒 Fixed Bundle</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Users must buy all courses together (No individual selection)</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={!bundleAllowIndividualPurchase} 
                  onChange={e => setBundleAllowIndividualPurchase(!e.target.checked)} 
                  style={{ width: '22px', height: '22px', accentColor: 'var(--accent)' }} 
                />
              </label>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Select Courses</label>
              <div style={{ maxHeight: '160px', overflow: 'auto', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
                {(courses || []).map((c: any) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={bundleSelectedCourses.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) setBundleSelectedCourses([...bundleSelectedCourses, c.id])
                        else setBundleSelectedCourses(bundleSelectedCourses.filter(id => id !== c.id))
                      }}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                    />
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{c.name}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Pricing Section - Conditional on Bundle Type */}
            {bundleSelectedCourses.length > 0 && (
              !bundleAllowIndividualPurchase ? (
                // FIXED BUNDLE — just two price inputs
                <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '20px', background: 'var(--success-light)', border: '1.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '20px' }}>🏷️</span>
                    <label style={{ fontSize: '14px', fontWeight: '900', color: 'var(--success)', textTransform: 'uppercase' }}>Bundle Prices (Fixed Package)</label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', marginBottom: '4px' }}>Bundle Recorded Price (₹)</div>
                      <input 
                        type="number" 
                        value={bundleRecordedDiscountPrice} 
                        onChange={e => { setBundleRecordedDiscountPrice(e.target.value); setBundleRecordedOriginalPrice(e.target.value); }} 
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #86efac', fontSize: '14px', fontWeight: '700' }} 
                        placeholder="e.g. 4000"
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', marginBottom: '4px' }}>Bundle Live Price (₹)</div>
                      <input 
                        type="number" 
                        value={bundleLiveDiscountPrice} 
                        onChange={e => { setBundleLiveDiscountPrice(e.target.value); setBundleLiveOriginalPrice(e.target.value); }} 
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #86efac', fontSize: '14px', fontWeight: '700' }} 
                        placeholder="e.g. 5500"
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--danger)', marginBottom: '4px' }}>Bundle Champion Price (₹)</div>
                      <input 
                        type="number" 
                        value={bundleChampionDiscountPrice} 
                        onChange={e => { setBundleChampionDiscountPrice(e.target.value); setBundleChampionOriginalPrice(e.target.value); }} 
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #fca5a5', fontSize: '14px', fontWeight: '700' }} 
                        placeholder="e.g. 7500"
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', marginBottom: '4px' }}>Champion Subtitle</div>
                    <input 
                      type="text" 
                      value={bundleChampionSubtitle} 
                      onChange={e => setBundleChampionSubtitle(e.target.value)} 
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #86efac', fontSize: '13px' }} 
                      placeholder="e.g. Includes Unlimited Support..."
                    />
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--success)', marginTop: '10px', fontWeight: '600' }}>* This price applies to the entire set of courses in this bundle.</p>
                </div>
              ) : (
                // NON-FIXED — subject specific pricing per course
                <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '20px', background: 'var(--info-light)', border: '1.5px solid #bae6fd' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '20px' }}>💰</span>
                    <label style={{ fontSize: '14px', fontWeight: '900', color: '#0369a1', textTransform: 'uppercase' }}>Subject Specific Pricing</label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {bundleSelectedCourses.map((id: string) => {
                      const course = (courses || []).find((c: any) => c.id === id);
                      if (!course) return null;
                      const mapping = bundleIndividualMapping[id] || {};
                      return (
                        <div key={id} style={{ background: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '10px' }}>{course.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>Recorded Price (₹)</div>
                              <input type="number" value={mapping.recorded || ''} onChange={e => setBundleIndividualMapping({ ...bundleIndividualMapping, [id]: { ...mapping, recorded: e.target.value } })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }} placeholder="e.g. 1000" />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>Live Price (₹)</div>
                              <input type="number" value={mapping.live || ''} onChange={e => setBundleIndividualMapping({ ...bundleIndividualMapping, [id]: { ...mapping, live: e.target.value } })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }} placeholder="e.g. 2000" />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>Champ Price (₹)</div>
                              <input type="number" value={mapping.champion || ''} onChange={e => setBundleIndividualMapping({ ...bundleIndividualMapping, [id]: { ...mapping, champion: e.target.value } })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }} placeholder="e.g. 3000" />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            )}

            {/* Bundle Discount Configuration */}
            <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', background: 'var(--warning-light)', border: '1.5px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: bundleEnableBundleDiscount ? '16px' : '0' }}>
                <input type="checkbox" checked={bundleEnableBundleDiscount} onChange={e => setBundleEnableBundleDiscount(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--warning)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--warning)' }}>🏷️ Enable Bundle Discount</div>
                  <div style={{ fontSize: '12px', color: 'var(--warning)' }}>Extra discount applied on top of course prices</div>
                </div>
              </label>
              {bundleEnableBundleDiscount && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--warning)', display: 'block', marginBottom: '4px' }}>Discount Type</label>
                      <select value={bundleDiscountType} onChange={e => setBundleDiscountType(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED">Fixed Amount (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--warning)', display: 'block', marginBottom: '4px' }}>Discount Value</label>
                      <input type="number" min={0} value={bundleDiscountValue} onChange={e => setBundleDiscountValue(e.target.value)} placeholder={bundleDiscountType === 'FIXED' ? '₹ Amount' : '% Off'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--warning)', display: 'block', marginBottom: '4px' }}>Applies To</label>
                      <select value={bundleDiscountApplicability} onChange={e => setBundleDiscountApplicability(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
                        <option value="BOTH">Both (Recorded + Live)</option>
                        <option value="RECORDED">Recorded Only</option>
                        <option value="LIVE">Live Only</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: '18px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={bundleRequireAllCourses} onChange={e => setBundleRequireAllCourses(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--warning)' }} />
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--warning)' }}>Only when all courses selected</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '24px', padding: '14px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>🔒 Fixed Bundle</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Users must buy all courses together</div>
                </div>
                <input type="checkbox" checked={!bundleAllowIndividualPurchase} onChange={e => setBundleAllowIndividualPurchase(!e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
              </label>

              {!bundleAllowIndividualPurchase && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>🎯 Force Class Type</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Force users to buy a specific class type (Live or Recorded)</div>
                    </div>
                  </div>
                  <select 
                    value={bundleForceClassType || ''} 
                    onChange={e => setBundleForceClassType(e.target.value === '' ? null : e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                  >
                    <option value="">Let user choose (Live or Recorded)</option>
                    <option value="RECORDED">Force Recorded Classes</option>
                    <option value="LIVE">Force Live Classes</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowCreateBundleModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button
                disabled={creating}
                onClick={async () => {
                  if (!bundleName || bundleSelectedCourses.length === 0) { alert('Bundle requires a name and at least one course.'); return }
                  if (!bundleCategory) { alert('Category is required.'); return }
                  setCreating(true)
                  try {
                    const combinedCoursePrices = { 
                      ...bundleTierPrices,
                      individualMapping: bundleIndividualMapping
                    };
                    const res = await fetch('/api/bundle-offerings', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: bundleName, description: bundleDescription, courseIds: bundleSelectedCourses,
                        recordedOriginalPrice: bundleTierPrices[bundleSelectedCourses.length]?.recordedOriginal ? Number(bundleTierPrices[bundleSelectedCourses.length].recordedOriginal) : (bundleRecordedOriginalPrice ? Number(bundleRecordedOriginalPrice) : undefined),
                        recordedDiscountPrice: bundleTierPrices[bundleSelectedCourses.length]?.recordedDiscount ? Number(bundleTierPrices[bundleSelectedCourses.length].recordedDiscount) : (bundleRecordedDiscountPrice ? Number(bundleRecordedDiscountPrice) : undefined),
                        liveOriginalPrice: bundleTierPrices[bundleSelectedCourses.length]?.liveOriginal ? Number(bundleTierPrices[bundleSelectedCourses.length].liveOriginal) : (bundleLiveOriginalPrice ? Number(bundleLiveOriginalPrice) : undefined),
                        liveDiscountPrice: bundleTierPrices[bundleSelectedCourses.length]?.liveDiscount ? Number(bundleTierPrices[bundleSelectedCourses.length].liveDiscount) : (bundleLiveDiscountPrice ? Number(bundleLiveDiscountPrice) : undefined),
                        championOriginalPrice: bundleTierPrices[bundleSelectedCourses.length]?.championOriginal ? Number(bundleTierPrices[bundleSelectedCourses.length].championOriginal) : (bundleChampionOriginalPrice ? Number(bundleChampionOriginalPrice) : undefined),
                        championDiscountPrice: bundleTierPrices[bundleSelectedCourses.length]?.championDiscount ? Number(bundleTierPrices[bundleSelectedCourses.length].championDiscount) : (bundleChampionDiscountPrice ? Number(bundleChampionDiscountPrice) : undefined),
                        championSubtitle: bundleChampionSubtitle,
                        allowIndividualPurchase: !!bundleAllowIndividualPurchase,
                        enableBundleDiscount: bundleEnableBundleDiscount,
                        bundleDiscountType: bundleDiscountType,
                        bundleDiscountValue: bundleDiscountValue,
                        bundleDiscountApplicability: bundleDiscountApplicability,
                        requireAllCourses: bundleRequireAllCourses,
                        forceClassType: bundleForceClassType || null,
                        coursePrices: JSON.stringify(combinedCoursePrices),
                        startingPrice: bundleStartingPrice ? Number(bundleStartingPrice) : undefined,
                        startingFromText: bundleStartingFromText,
                        bannerText: bundleBannerText,
                        courseHeadline: bundleCourseHeadline,
                        category: bundleCategory,
                      })
                    })
                    if (res.ok) {
                      setShowCreateBundleModal(false)
                      setBundleCategory('')
                      window.location.reload()
                    } else { alert('Failed to create bundle') }
                  } catch { alert('Error creating bundle') }
                  finally { setCreating(false) }
                }}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: creating ? 'var(--text-muted)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: creating ? 'not-allowed' : 'pointer' }}
              >
                {creating ? 'Creating...' : 'Create Bundle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NOTE MODAL */}
      {showCreateNoteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }} onClick={() => setShowCreateNoteModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '500px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px', maxHeight: '90vh', overflowY: 'auto',
            animation: 'modalSlideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                  {editingNote ? 'Edit Notes 📝' : 'Add Notes 📝'}
                </h2>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '500', lineHeight: '1.5' }}>
                  Upload notes or provide a link for students to access.
                </p>
              </div>
              <button onClick={() => { setShowCreateNoteModal(false); setEditingNote(null) }} style={{ background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Note Title</label>
              <input id="noteTitleInput" placeholder="E.g., Physics Chapter 1 Notes" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Level *</label>
              <select
                id="noteCategoryInput"
                value={noteCategory}
                onChange={(e) => {
                  setNoteCategory(e.target.value)
                  setNoteSubject('') // clear subject on level change
                }}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px', background: 'var(--surface)', cursor: 'pointer' }}
              >
                <option value="Re-attempt">Re-attempt</option>
                <option value="Foundation">Foundation</option>
                <option value="Diploma">Diploma</option>
                <option value="General">General</option>
              </select>
            </div>

            {(noteCategory === 'Foundation' || noteCategory === 'Re-attempt') && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Subject *</label>
                <select
                  id="noteSubjectInput"
                  value={noteSubject}
                  onChange={(e) => setNoteSubject(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px', background: 'var(--surface)', cursor: 'pointer' }}
                >
                  <option value="">Select Subject...</option>
                  {noteCategory === 'Foundation' && [
                    'STATS 1', 'STATS 2', 'MATH 2', 'MATH 1', 'ENG 1', 'ENG 2', 'CT', 'PYTHON'
                  ].map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  {noteCategory === 'Re-attempt' && [
                    'ENG 1', 'CT', 'MATH 1', 'STATS 1'
                  ].map(sub => <option key={sub} value={sub}>{sub}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description (Optional)</label>
              <textarea id="noteDescInput" rows={3} placeholder="Brief description of these notes..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px', resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Link (Google Drive, Notion, etc.)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input id="noteLinkInput" type="url" placeholder="https://..." style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
                <label style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'var(--surface-hover)',
                  border: '1.5px dashed var(--border)',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}>
                  <Upload size={16} />
                  {uploadingNoteFile ? 'Uploading...' : 'Upload Notes'}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.zip"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                    disabled={uploadingNoteFile}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Price (₹)</label>
                <input id="notePriceInput" type="number" min={0} placeholder="0 for Free" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowCreateNoteModal(false); setEditingNote(null) }} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={async () => {
                  const title = (document.getElementById('noteTitleInput') as HTMLInputElement).value
                  const desc = (document.getElementById('noteDescInput') as HTMLTextAreaElement).value
                  const link = (document.getElementById('noteLinkInput') as HTMLInputElement).value
                  const price = (document.getElementById('notePriceInput') as HTMLInputElement).value
                  if (!title || !link) { alert('Title and Link are required'); return }
                  if ((noteCategory === 'Foundation' || noteCategory === 'Re-attempt') && !noteSubject) {
                    alert('Subject is required for the selected Level')
                    return
                  }

                  setCreating(true)
                  try {
                    const method = editingNote ? 'PUT' : 'POST'
                    const url = editingNote ? `/api/store/notes/${editingNote.id}` : '/api/store/notes'
                    const res = await fetch(url, {
                      method, headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        title, 
                        description: desc, 
                        fileUrl: link, 
                        price: Number(price) || 0,
                        category: noteCategory,
                        subject: noteSubject || null
                      })
                    })
                    if (res.ok) { window.location.reload() }
                    else { alert(editingNote ? 'Failed to update notes' : 'Failed to add notes') }
                  } catch { alert('Error saving notes') }
                  finally { setCreating(false) }
                }}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
              >
                {editingNote ? 'Save Changes' : 'Create Notes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MENTORSHIP MODAL */}
      {showCreateMentorshipModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }} onClick={() => setShowCreateMentorshipModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '500px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px', maxHeight: '90vh', overflowY: 'auto',
            animation: 'modalSlideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                  {editingMentorship ? 'Edit Mentorship 🤝' : 'Create Mentorship 🤝'}
                </h2>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: '500', lineHeight: '1.5' }}>
                  Set up 1-on-1 mentorship slots for students to book.
                </p>
              </div>
              <button onClick={() => { setShowCreateMentorshipModal(false); setEditingMentorship(null) }} style={{ background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            {/* MENTOR SELECTION */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Assign Mentor (Staff)</label>
              <select id="mentorIdInput" defaultValue={editingMentorship?.mentorId || ''} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px', background: 'var(--surface)' }}>
                <option value="">Select a Mentor...</option>
                {staffData?.staff?.filter((s: any) => s.role === 'ADMIN' || s.role === 'MANAGER').map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Mentor Display Name</label>
              <input id="mentorNameInput" defaultValue={editingMentorship?.mentorName || ''} placeholder="E.g., John Doe" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Mentor Title / Tagline</label>
              <input id="mentorTitleInput" defaultValue={editingMentorship?.mentorTitle || 'IIT Mentorship Specialist'} placeholder="E.g., IIT Mentorship Specialist" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description</label>
              <textarea id="mentorDescInput" defaultValue={editingMentorship?.description || ''} rows={3} placeholder="What will this mentorship cover?" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Price Per Slot (₹)</label>
                <input id="mentorPriceInput" defaultValue={editingMentorship?.pricePerSlot || ''} type="number" min={1} placeholder="E.g., 500" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Slot Duration (min)</label>
                <select id="mentorDurationInput" defaultValue={editingMentorship?.slotDuration || '30'} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #dbeafe', fontSize: '14px', backgroundColor: 'var(--surface)' }}>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="45">45 Minutes</option>
                  <option value="60">60 Minutes</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowCreateMentorshipModal(false); setEditingMentorship(null) }} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={async () => {
                  const mentorId = (document.getElementById('mentorIdInput') as HTMLSelectElement).value
                  const mentorName = (document.getElementById('mentorNameInput') as HTMLInputElement).value
                  const mentorTitle = (document.getElementById('mentorTitleInput') as HTMLInputElement).value
                  const desc = (document.getElementById('mentorDescInput') as HTMLTextAreaElement).value
                  const price = (document.getElementById('mentorPriceInput') as HTMLInputElement).value
                  const duration = (document.getElementById('mentorDurationInput') as HTMLSelectElement).value
                  if (!mentorName || !price || !duration) { alert('Name, Price, and Duration are required'); return }

                  setCreating(true)
                  try {
                    const method = editingMentorship ? 'PUT' : 'POST'
                    const url = editingMentorship ? `/api/store/mentorships/${editingMentorship.id}` : '/api/store/mentorships'
                    const res = await fetch(url, {
                      method, headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mentorId, mentorName, mentorTitle, description: desc, pricePerSlot: Number(price), slotDuration: Number(duration) })
                    })
                    if (res.ok) { window.location.reload() }
                    else { alert(editingMentorship ? 'Failed to update mentorship' : 'Failed to add mentorship') }
                  } catch { alert('Error saving mentorship') }
                  finally { setCreating(false) }
                }}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
              >
                {editingMentorship ? 'Save Changes' : 'Create Mentorship'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENTORSHIP BOOKING MODAL */}
      {showMentorshipBookingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowMentorshipBookingModal(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: '32px', padding: '24px', width: '95%', maxWidth: '480px', animation: 'modalSlideUp 0.3s ease-out', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowMentorshipBookingModal(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--surface)', border: 'none', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
            
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '8px' }}>Book Session with {showMentorshipBookingModal.mentorName}</h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '5px 10px', borderRadius: '8px', fontWeight: '700' }}>⏱️ {showMentorshipBookingModal.slotDuration} mins / slot</span>
                <span style={{ fontSize: '12px', color: 'var(--warning)', background: 'var(--warning-light)', padding: '5px 10px', borderRadius: '8px', fontWeight: '700' }}>💰 ₹{showMentorshipBookingModal.pricePerSlot} / slot</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', marginBottom: '10px', color: 'var(--text-primary)' }}>1. Select Date</label>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                {Array.from(new Set(JSON.parse(showMentorshipBookingModal.availableSlots || '[]').map((s: any) => s.date))).sort().map((d: any) => {
                  const isSelected = mentorshipBookingDate === d;
                  return (
                    <button
                      key={d}
                      onClick={() => { setMentorshipBookingDate(d); setMentorshipBookingTimes([]) }}
                      style={{
                        padding: '10px 16px', borderRadius: '12px', border: isSelected ? '2px solid #f59e0b' : '2px solid var(--border)',
                        background: isSelected ? 'var(--warning-light)' : '#fff', color: isSelected ? 'var(--warning)' : 'var(--text-secondary)',
                        fontWeight: '800', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                      }}
                    >
                      {new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', marginBottom: '10px', color: 'var(--text-primary)' }}>
                2. Choose Time Slots <span style={{ fontWeight: '500', color: 'var(--text-secondary)', fontSize: '11px' }}>(Multi-select)</span>
              </label>
              {!mentorshipBookingDate ? (
                <div style={{ padding: '24px', background: 'var(--surface)', borderRadius: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', border: '2px dashed var(--border)' }}>
                  Please select a date first
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                  {(() => {
                    const now = new Date();
                    const slots = JSON.parse(showMentorshipBookingModal.availableSlots || '[]')
                      .filter((s: any) => s.date === mentorshipBookingDate)
                      .sort((a: any, b: any) => a.time.localeCompare(b.time));
                    
                    if (slots.length === 0) return <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No slots available for this day.</p>;

                    return slots.map((s: any) => {
                      const [h, m] = s.time.split(':').map(Number);
                      const startTime = new Date(`${s.date}T${s.time}:00`);
                      const isPast = startTime < now;
                      const booked = showMentorshipBookingModal.bookings?.some((b: any) => b.slotDate === s.date && b.slotTime === s.time && b.status === 'PAID');
                      
                      // Calculate End Time
                      const totalMins = h * 60 + m + (showMentorshipBookingModal.slotDuration || 30);
                      const endH = Math.floor(totalMins / 60) % 24;
                      const endM = totalMins % 60;
                      const timeInterval = `${s.time} - ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                      
                      const isSelected = mentorshipBookingTimes.includes(s.time);
                      const disabled = booked || isPast;

                      return (
                        <button
                          key={s.time}
                          disabled={disabled}
                          onClick={() => {
                            if (isSelected) setMentorshipBookingTimes(mentorshipBookingTimes.filter(t => t !== s.time))
                            else setMentorshipBookingTimes([...mentorshipBookingTimes, s.time])
                          }}
                          style={{
                            padding: '10px', borderRadius: '14px', border: isSelected ? '2px solid #f59e0b' : '2px solid var(--border)',
                            background: isSelected ? 'var(--warning-light)' : (disabled ? 'var(--surface)' : '#fff'),
                            color: isSelected ? 'var(--warning)' : (disabled ? 'var(--text-muted)' : 'var(--text-secondary)'),
                            fontWeight: '800', fontSize: '12.5px', cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s', position: 'relative'
                          }}
                        >
                          {timeInterval}
                          {booked && <div style={{ fontSize: '8px', color: 'var(--danger)', marginTop: '2px' }}>BOOKED</div>}
                          {isPast && !booked && <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '2px' }}>PAST</div>}
                        </button>
                      )
                    });
                  })()}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '24px', border: '1.5px solid var(--border)' }}>
              {/* Mentorship Note */}
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(54,54,232,0.05)', borderRadius: '14px', border: '1px solid rgba(54,54,232,0.1)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px' }}>📧</span>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4', fontWeight: '600' }}>
                  <strong>Note:</strong> A Google Meet invite will be sent to your email after payment. Access it in the <span style={{ color: 'var(--primary)' }}>"Live Sessions"</span> tab or Calendar.
                </p>
              </div>

              {/* STUDENT QUESTION FIELD */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>Questions for Mentor (Optional)</label>
                <textarea 
                  id="userQuestionInput"
                  placeholder="e.g. JEE Main Strategy, specific doubts, etc."
                  style={{ width: '100%', padding: '12px', borderRadius: '14px', border: '2px solid var(--border)', fontSize: '13px', color: 'var(--text-primary)', minHeight: '60px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>Total Selected</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>{mentorshipBookingTimes.length} slots for {mentorshipBookingDate ? new Date(mentorshipBookingDate).toLocaleDateString() : '...'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Amount</div>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--warning)' }}>₹{mentorshipBookingTimes.length * showMentorshipBookingModal.pricePerSlot}</div>
                </div>
              </div>

              <button 
                disabled={isProcessing || mentorshipBookingTimes.length === 0}
                onClick={async () => {
                  if (!mentorshipBookingDate || mentorshipBookingTimes.length === 0) { alert('Please select at least one time slot.'); return }
                  setIsProcessing(true)
                  try {
                    const res = await fetch(`/api/store/mentorships/${showMentorshipBookingModal.id}/create-order`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ slotDate: mentorshipBookingDate, slotTimes: mentorshipBookingTimes })
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    if (data.isFree) {
                      setShowMentorshipBookingModal(null)
                      alert('Booking confirmed!')
                      setIsProcessing(false)
                      window.location.reload()
                      return
                    }
                    const options = {
                      key: data.key,
                      amount: data.amount,
                      currency: 'INR',
                      name: 'GenZ IITian',
                      description: `Mentorship Booking (${mentorshipBookingTimes.length} slots)`,
                      order_id: data.razorpayOrderId,
                      handler: async function (response: any) {
                        setIsProcessing(true)
                        setVerifyingPayment(true)
                        try {
                          const verifyRes = await fetch(`/api/store/mentorships/${showMentorshipBookingModal.id}/verify-payment`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              razorpay_order_id: response.razorpay_order_id,
                              razorpay_payment_id: response.razorpay_payment_id,
                              razorpay_signature: response.razorpay_signature
                            })
                          })
                          if (verifyRes.ok) {
                            setShowMentorshipBookingModal(null)
                            setSuccessOrderId(response.razorpay_order_id);
                            setPurchasedCourse({ 
                              courseName: `Mentorship with ${showMentorshipBookingModal.mentorName}`, 
                              courseTier: `${mentorshipBookingTimes.length} Slot(s)`,
                              type: 'mentorship' 
                            });
                          } else { 
                            const errData = await verifyRes.json();
                            alert(errData.error || 'Payment verification failed'); 
                          }
                        } catch (err: any) { alert(err.message || 'Payment verification failed') }
                        finally { 
                          setIsProcessing(false)
                          setVerifyingPayment(false)
                        }
                      },
                      modal: { ondismiss: () => setIsProcessing(false) }
                    }
                    const rzp = new (window as any).Razorpay(options)
                    rzp.open()
                    setIsProcessing(false)
                  } catch (e: any) {
                    setIsProcessing(false)
                    alert(e.message || 'Error processing')
                  }
                }} 
                style={{ 
                  width: '100%', padding: '18px', 
                  background: (isProcessing || mentorshipBookingTimes.length === 0) ? 'var(--surface-2)' : 'linear-gradient(135deg, #f59e0b, #d97706)', 
                  color: (isProcessing || mentorshipBookingTimes.length === 0) ? 'var(--text-muted)' : 'white', 
                  fontWeight: '900', fontSize: '16px', borderRadius: '16px', border: 'none', 
                  cursor: (isProcessing || mentorshipBookingTimes.length === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: (isProcessing || mentorshipBookingTimes.length === 0) ? 'none' : '0 10px 20px rgba(245, 158, 11, 0.3)',
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}
              >
                {isProcessing ? 'Processing...' : (mentorshipBookingTimes.length === 0 ? 'Select a slot to proceed' : `Confirm & Pay ₹${mentorshipBookingTimes.length * showMentorshipBookingModal.pricePerSlot}`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE SLOTS MODAL */}
      {showManageSlotsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowManageSlotsModal(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '480px', animation: 'modalSlideUp 0.3s ease-out', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>Manage Time Slots</h3>
              <button onClick={() => setShowManageSlotsModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Mentorship with {showManageSlotsModal.mentorName} ({showManageSlotsModal.slotDuration} mins)</p>

            <div style={{ background: 'var(--surface)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Add New Slot</h4>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Date</label>
                  <input type="date" value={manageSlotsDate} onChange={e => setManageSlotsDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Time</label>
                  <input type="time" value={manageSlotsTime} onChange={e => setManageSlotsTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
                <button onClick={() => {
                  if (!manageSlotsDate || !manageSlotsTime) return;
                  if (editingSlots.some(s => s.date === manageSlotsDate && s.time === manageSlotsTime)) return;
                  setEditingSlots([...editingSlots, { date: manageSlotsDate, time: manageSlotsTime }]);
                  setManageSlotsTime('');
                }} style={{ padding: '10px 16px', background: 'var(--info)', color: '#fff', borderRadius: '8px', fontWeight: '700', border: 'none' }}>Add</button>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Available Slots</h4>
              {editingSlots.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No slots added yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {editingSlots.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).map((slot, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>
                        {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {slot.time}
                      </div>
                      <button onClick={() => {
                        setEditingSlots(editingSlots.filter((_, i) => i !== idx))
                      }} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '14px' }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true)
                try {
                  const res = await fetch(`/api/store/mentorships/${showManageSlotsModal.id}/slots`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slots: editingSlots })
                  })
                  if (!res.ok) throw new Error('Failed to update slots')
                  setShowManageSlotsModal(null)
                  window.location.reload()
                } catch (e: any) {
                  alert(e.message || 'Error updating slots')
                } finally {
                  setIsProcessing(false)
                }
              }} 
              style={{ width: '100%', padding: '14px', background: 'var(--primary)', color: 'white', fontWeight: '700', borderRadius: '12px', border: 'none', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
              {isProcessing ? 'Saving...' : 'Save Slots'}
            </button>
          </div>
        </div>
      )}

      {/* MANAGE ALL BOOKINGS MODAL (Manager Only) */}
      {showManageBookingsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={() => setShowManageBookingsModal(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: '32px', padding: '40px', width: '100%', maxWidth: '900px', maxHeight: '85vh', overflow: 'auto', animation: 'modalSlideUp 0.3s ease-out', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowManageBookingsModal(null)} style={{ position: 'absolute', top: '30px', right: '30px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={20} />
            </button>
            
            <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '16px' }}>All Mentorship Bookings</h3>
            
            <div style={{ marginBottom: '24px' }}>
              <input 
                type="text" 
                placeholder="Filter by student, mentor, or date (YYYY-MM-DD)..." 
                value={bookingSearchQuery}
                onChange={(e) => setBookingSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '14px 20px', borderRadius: '18px', border: '1.5px solid var(--border)', fontSize: '14px', outline: 'none', background: '#fcfcfd' }}
              />
            </div>

            {loadingAllBookings ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading bookings...</div>
            ) : allBookingsData.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--surface)', borderRadius: '20px' }}>No bookings found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 2fr', gap: '12px', padding: '0 16px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <span>Student / Mentor</span>
                  <span>Date</span>
                  <span>Time</span>
                  <span>Status</span>
                  <span>Actions / Meeting Link</span>
                </div>
                {allBookingsData
                  .filter(b => 
                    b.user?.name?.toLowerCase().includes(bookingSearchQuery.toLowerCase()) || 
                    b.mentorship?.mentorName?.toLowerCase().includes(bookingSearchQuery.toLowerCase()) ||
                    b.slotDate?.includes(bookingSearchQuery)
                  )
                  .map((b: any) => (
                    <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 2fr', gap: '12px', padding: '16px', background: 'var(--surface)', borderRadius: '20px', alignItems: 'center', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>{b.user?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Mentor: {b.mentorship?.mentorName}</div>
                        {b.userQuestion && <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600', marginTop: '4px' }}>Q: {b.userQuestion}</div>}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700' }}>{b.slotDate}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700' }}>{b.slotTime}</div>
                      <div>
                        <span style={{ padding: '4px 10px', borderRadius: '50px', background: b.status === 'PAID' ? 'var(--success-light)' : 'var(--danger-light)', color: b.status === 'PAID' ? 'var(--success)' : 'var(--danger)', fontSize: '11px', fontWeight: '800' }}>{b.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {editingBookingLink === b.id ? (
                          <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                            <input id={`link-input-${b.id}`} defaultValue={b.meetLink || ''} placeholder="Meet Link" style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #3636e8', fontSize: '13px' }} />
                            <button onClick={async () => {
                              const link = (document.getElementById(`link-input-${b.id}`) as HTMLInputElement)?.value;
                              try {
                                const res = await fetch(`/api/store/mentorships/bookings/${b.id}`, {
                                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ meetLink: link })
                                })
                                if (res.ok) {
                                  setAllBookingsData(allBookingsData.map(item => item.id === b.id ? { ...item, meetLink: link } : item))
                                  setEditingBookingLink(null)
                                } else alert('Failed to update')
                              } catch { alert('Error updating') }
                            }} style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: '700', fontSize: '12px' }}>Save</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ flex: 1, fontSize: '12px', color: b.meetLink ? 'var(--primary)' : 'var(--text-muted)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.meetLink || 'No link'}</div>
                            <button onClick={() => setEditingBookingLink(b.id)} style={{ padding: '6px 12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '11px' }}>Edit</button>
                            {(userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER') && (
                              <button onClick={async () => {
                                if (!confirm('Cancel this booking?')) return
                                try {
                                  const res = await fetch(`/api/store/mentorships/bookings/${b.id}`, { method: 'DELETE' })
                                  if (res.ok) setAllBookingsData(allBookingsData.filter(item => item.id !== b.id))
                                  else alert('Failed')
                                } catch { alert('Error') }
                              }} style={{ padding: '6px 12px', borderRadius: '8px', background: 'var(--danger-light)', border: '1px solid var(--border)', color: 'var(--danger)', fontWeight: '700', fontSize: '11px' }}>Cancel</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANUAL BOOKING MODAL (Manager Only) */}
      {showManualBookingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={() => { setShowManualBookingModal(false); setStudentSearchQuery(''); }}>
          <div style={{ background: 'var(--surface)', borderRadius: '32px', padding: '40px', width: '100%', maxWidth: '500px', animation: 'modalSlideUp 0.3s ease-out', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowManualBookingModal(false); setStudentSearchQuery(''); }} style={{ position: 'absolute', top: '30px', right: '30px', background: 'var(--surface)', border: 'none', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '24px' }}>Manual Booking</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Select Student</label>
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid var(--border)', marginBottom: '10px', fontSize: '14px', outline: 'none' }}
              />
              <select id="manualStudentInput" style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '2px solid var(--border)', background: 'var(--surface)', fontSize: '14px' }}>
                <option value="">{studentSearchQuery ? 'Matching students...' : 'Choose student...'}</option>
                {allStudentsData
                  .filter(s => 
                    s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || 
                    s.email.toLowerCase().includes(studentSearchQuery.toLowerCase())
                  )
                  .map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
              </select>
              {studentSearchQuery && allStudentsData.filter(s => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || s.email.toLowerCase().includes(studentSearchQuery.toLowerCase())).length === 0 && (
                <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', fontWeight: '600' }}>No students found matching "{studentSearchQuery}"</div>
              )}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Select Mentorship Offering</label>
              <select id="manualMentorshipInput" onChange={async (e) => {
                const mid = e.target.value;
                if (!mid) { setManualAvailableSlots([]); return; }
                setLoadingManualSlots(true);
                try {
                  const res = await fetch(`/api/store/mentorships/${mid}/slots`);
                  const data = await res.json();
                  setManualAvailableSlots(data.slots || []);
                } catch { alert('Error fetching slots'); }
                finally { setLoadingManualSlots(false); }
              }} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '2px solid var(--border)' }}>
                <option value="">Choose mentorship...</option>
                {mentorshipsData?.mentorships?.map((m: any) => <option key={m.id} value={m.id}>{m.mentorName}</option>)}
              </select>
            </div>

            {manualAvailableSlots.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px', textTransform: 'uppercase' }}>Pick an Existing Slot</label>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {manualAvailableSlots.map((s, idx) => (
                    <button key={idx} onClick={() => {
                      (document.getElementById('manualDateInput') as HTMLInputElement).value = s.date;
                      (document.getElementById('manualTimeInput') as HTMLInputElement).value = s.time;
                    }} style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--primary-light)', border: '1.5px solid #dbeafe', fontSize: '12px', fontWeight: '700', color: 'var(--primary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                      {s.date} {s.time}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Date</label>
                <input id="manualDateInput" type="date" style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '2px solid var(--border)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Time (HH:MM)</label>
                <input id="manualTimeInput" type="time" style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '2px solid var(--border)' }} />
              </div>
            </div>
            <button onClick={async () => {
              const studentId = (document.getElementById('manualStudentInput') as HTMLSelectElement).value;
              const mentorshipId = (document.getElementById('manualMentorshipInput') as HTMLSelectElement).value;
              const date = (document.getElementById('manualDateInput') as HTMLInputElement).value;
              const time = (document.getElementById('manualTimeInput') as HTMLInputElement).value;
              if (!studentId || !mentorshipId || !date || !time) return alert('All fields required')
              try {
                const res = await fetch('/api/store/mentorships/manual-book', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ studentId, mentorshipId, date, time })
                })
                if (res.ok) { alert('Success!'); setShowManualBookingModal(false); window.location.reload() }
                else alert('Failed')
              } catch { alert('Error') }
            }} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--text-primary)', color: '#fff', fontWeight: '800', border: 'none', cursor: 'pointer' }}>Create Booking</button>
          </div>
        </div>
      )}

      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 5px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      </div>
    </>
  )
}
