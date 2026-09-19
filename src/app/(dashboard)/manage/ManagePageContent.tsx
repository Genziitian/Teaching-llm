'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { SOLID_COLORS, GRADIENT_COLORS, isGradient } from '@/lib/color-utils'
import {
  COURSE_ICON_OPTIONS,
  CourseIconBadge,
  getCourseIconOption,
  normalizeCourseIconType,
  type CourseIconType,
} from '@/lib/course-icons'
import {
  IITM_LEVELS,
  IITM_SUBJECTS_BY_LEVEL,
  IITM_ALL_SUBJECTS,
} from '@/lib/iitm-taxonomy'
import { type PlatformQuery, QUERY_CATEGORIES } from '@/lib/queries-master'
import ClearCourseEnrollmentsModal from '@/components/ClearCourseEnrollmentsModal'
import AcademicTermsModal from '@/components/manage/AcademicTermsModal'

export type Tab = 'courses' | 'offerings' | 'bundles' | 'lectures' | 'events' | 'materials' | 'announcements' | 'notifications' | 'home-slides' | 'faqs' | 'queries'

interface ManagePageInnerProps {
  forcedTab?: Tab
}

const PROMO_SPLASH_PAGE_OPTIONS = [
  { value: '/dashboard', label: 'Home' },
  { value: '/courses', label: 'Courses and course details' },
  { value: '/academics', label: 'Academics' },
  { value: '/community', label: 'Community' },
  { value: '/live', label: 'Live Classes' },
  { value: '/calendar', label: 'Calendar' },
  { value: '/announcements', label: 'Announcements' },
  { value: '/free-resources', label: 'Free Resources' },
  { value: '/support', label: 'Support' },
  { value: '/more', label: 'More' },
  { value: '/settings', label: 'Settings' },
]

export function ManagePageInner({ forcedTab }: ManagePageInnerProps = {}) {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const searchParams = useSearchParams()
  const initialTab = forcedTab || (searchParams.get('tab') as Tab) || 'courses'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [clearEnrollmentsCourse, setClearEnrollmentsCourse] = useState<{ id: string; name: string } | null>(null)
  const [academicTermsModalOpen, setAcademicTermsModalOpen] = useState(false)

  const fetcher = async (url: string) => {
    const res = await fetch(url)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || `Request failed for ${url}`)
    }
    return data
  }

  const { data: authData, error: authError } = useSWR('/api/auth/me', fetcher)
  const userRole = authData?.user?.role || ''

  // Courses & instructors always loaded — used in form dropdowns across all tabs
  const { data: coursesData, error: coursesError, isLoading: loadingCourses, mutate: mutateCourses } = useSWR('/api/courses', fetcher)
  const { data: instructorsData, error: instructorsError, mutate: mutateInstructors } = useSWR('/api/instructors', fetcher)
  const { data: termsConfigData, mutate: mutateTermsConfig } = useSWR('/api/manage/academic-terms', fetcher)

  // All other tabs: only fetch when that tab is active
  const { data: bundlesData, error: bundlesError, isLoading: loadingBundles, mutate: mutateBundles } = useSWR(
    (tab === 'bundles' || tab === 'notifications') && userRole === 'MANAGER' ? '/api/course-bundles' : null, fetcher
  )
  const { data: lecturesData, error: lecturesError, isLoading: loadingLectures, mutate: mutateLectures } = useSWR(
    tab === 'lectures' ? '/api/content?hasVideo=true' : null, fetcher
  )
  const { data: eventsData, error: eventsError, isLoading: loadingEvents, mutate: mutateEvents } = useSWR(
    tab === 'events' ? '/api/events' : null, fetcher
  )
  const { data: materialsData, error: materialsError, isLoading: loadingMaterials, mutate: mutateMaterials } = useSWR(
    tab === 'materials' ? '/api/materials' : null, fetcher
  )
  const { data: announcementsData, error: announcementsError, isLoading: loadingAnnouncements, mutate: mutateAnnouncements } = useSWR(
    tab === 'announcements' ? '/api/announcements' : null, fetcher
  )
  const { data: offeringsData, error: offeringsError, isLoading: loadingOfferings, mutate: mutateOfferings } = useSWR(
    tab === 'offerings' ? '/api/course-offerings' : null, fetcher
  )
  const { data: campaignsData, error: campaignsError, isLoading: loadingCampaigns, mutate: mutateCampaigns } = useSWR(
    tab === 'notifications' ? '/api/notifications/campaigns' : null, fetcher
  )
  const { data: homeSlidesData, error: slidesError, isLoading: loadingSlides, mutate: mutateSlides } = useSWR(
    tab === 'home-slides' ? '/api/admin/home-slides?manage=1' : null, fetcher
  )
  const { data: homeContentSettings, error: homeContentSettingsError, mutate: mutateHomeContentSettings } = useSWR(
    tab === 'home-slides' ? '/api/admin/home-content-settings' : null, fetcher
  )
  const { data: faqsData, error: faqsError, isLoading: loadingFaqs, mutate: mutateFaqs } = useSWR(
    tab === 'faqs' ? '/api/support/faq' : null, fetcher
  )
  const { data: queriesData, error: queriesError, isLoading: loadingQueries, mutate: mutateQueries } = useSWR(
    tab === 'queries' ? '/api/manage/queries' : null, fetcher
  )

  const courses = Array.isArray(coursesData) ? coursesData : Array.isArray(coursesData?.courses) ? coursesData.courses : []
  const offerings = Array.isArray(offeringsData) ? offeringsData : []
  const bundles = Array.isArray(bundlesData) ? bundlesData : Array.isArray(bundlesData?.bundles) ? bundlesData.bundles : []
  const lectures = Array.isArray(lecturesData?.content) ? lecturesData.content : []
  const events = Array.isArray(eventsData) ? eventsData : []
  const materials = Array.isArray(materialsData) ? materialsData : Array.isArray(materialsData?.materials) ? materialsData.materials : []
  const announcements = Array.isArray(announcementsData) ? announcementsData : Array.isArray(announcementsData?.announcements) ? announcementsData.announcements : []
  const instructors = Array.isArray(instructorsData) ? instructorsData : []
  const campaigns = Array.isArray(campaignsData) ? campaignsData : []
  const slides = Array.isArray(homeSlidesData) ? homeSlidesData : []
  const faqs = Array.isArray(faqsData) ? faqsData : []
  const queries: PlatformQuery[] = Array.isArray(queriesData) ? queriesData : []

  // Loading = only the active tab's loader
  const loading = loadingCourses ||
    (tab === 'offerings' && loadingOfferings) ||
    (tab === 'bundles' && loadingBundles) ||
    (tab === 'lectures' && loadingLectures) ||
    (tab === 'events' && loadingEvents) ||
    (tab === 'materials' && loadingMaterials) ||
    (tab === 'announcements' && loadingAnnouncements) ||
    (tab === 'notifications' && loadingCampaigns) ||
    (tab === 'home-slides' && loadingSlides) ||
    (tab === 'faqs' && loadingFaqs) ||
    (tab === 'queries' && loadingQueries)
  const loadError =
    authError ||
    coursesError ||
    offeringsError ||
    bundlesError ||
    lecturesError ||
    eventsError ||
    materialsError ||
    announcementsError ||
    instructorsError ||
    campaignsError ||
    slidesError ||
    homeContentSettingsError ||
    faqsError ||
    queriesError



  // Revalidate only the active tab's data (+ courses which are always loaded)
  async function loadData() {
    if (typeof mutateCourses === 'function') await mutateCourses()
    if (typeof mutateInstructors === 'function') await mutateInstructors()
    mutate('/api/courses')
    mutate('/api/instructors')
    mutate('/api/live-sessions')
    if (tab === 'bundles' || tab === 'notifications') {
      if (typeof mutateBundles === 'function') await mutateBundles()
      mutate('/api/course-bundles')
    }
    if (tab === 'lectures') {
      if (typeof mutateLectures === 'function') await mutateLectures()
      mutate('/api/content?hasVideo=true')
    }
    if (tab === 'events') {
      if (typeof mutateEvents === 'function') await mutateEvents()
      mutate('/api/events')
    }
    if (tab === 'materials') {
      if (typeof mutateMaterials === 'function') await mutateMaterials()
      mutate('/api/materials')
    }
    if (tab === 'announcements') {
      if (typeof mutateAnnouncements === 'function') await mutateAnnouncements()
      mutate('/api/announcements')
    }
    if (tab === 'offerings') {
      if (typeof mutateOfferings === 'function') await mutateOfferings()
      mutate('/api/course-offerings')
    }
    if (tab === 'notifications') {
      if (typeof mutateCampaigns === 'function') await mutateCampaigns()
      mutate('/api/notifications/campaigns')
    }
    if (tab === 'home-slides') {
      if (typeof mutateSlides === 'function') await mutateSlides()
      if (typeof mutateHomeContentSettings === 'function') await mutateHomeContentSettings()
      mutate('/api/admin/home-slides?manage=1')
      mutate('/api/admin/home-slides')
      mutate('/api/admin/home-content-settings')
    }
    if (tab === 'faqs') {
      if (typeof mutateFaqs === 'function') await mutateFaqs()
      mutate('/api/support/faq')
    }
    if (tab === 'queries') {
      if (typeof mutateQueries === 'function') await mutateQueries()
      mutate('/api/manage/queries')
    }
    try {
      router.refresh()
    } catch (e) {}
  }

  const [showModal, setShowModal]       = useState(false)
  const [editId, setEditId]             = useState<string | null>(null)
  const [formData, setFormData]         = useState<Record<string, any>>({})
  const [courseIconPickerOpen, setCourseIconPickerOpen] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [copiedId, setCopiedId]         = useState<string | null>(null)
  const [materialSourceType, setMaterialSourceType] = useState<'FILE' | 'LINK'>('FILE')
  const [promoSplashDraft, setPromoSplashDraft] = useState('/splash-screen.png')
  const selectedPromoPages = String(homeContentSettings?.promoSplashTargetPages || '/dashboard')
    .split(',')
    .map((page: string) => page.trim())
    .filter(Boolean)

  useEffect(() => {
    if (homeContentSettings?.promoSplashImage) {
      setPromoSplashDraft(homeContentSettings.promoSplashImage)
    }
  }, [homeContentSettings?.promoSplashImage])

  async function updateHomeContentSettings(patch: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/home-content-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...homeContentSettings, ...patch }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update home content settings')
      await mutateHomeContentSettings(data, { revalidate: false })
      mutate('/api/admin/home-slides')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update home content settings')
    } finally {
      setSaving(false)
    }
  }

  // Dedicated states for Advanced Inline Notification Dashboard
  const [inlineNotif, setInlineNotif] = useState({
    presetStyle: '',
    title: '',
    body: '',
    imageUrl: '',
    ctaText: '',
    ctaLink: '',
    targetType: 'ALL' as 'ALL' | 'COURSE' | 'BUNDLE',
    targetId: '',
    scheduledFor: '',
    sendLater: false,
    category: 'PROMOTIONAL',
    priority: 'HIGH',
  })
  
  const [notifSearch, setNotifSearch] = useState('')
  const [notifStatusFilter, setNotifStatusFilter] = useState<'ALL' | 'SENT' | 'PENDING'>('ALL')
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isSendingCampaign, setIsSendingCampaign] = useState(false)

  // Recent photos picker states
  const [showRecentModal, setShowRecentModal] = useState(false)
  const [recentPhotos, setRecentPhotos] = useState<string[]>([])
  const [recentPhotosPage, setRecentPhotosPage] = useState(1)
  const [recentPhotosHasNext, setRecentPhotosHasNext] = useState(false)
  const [recentPhotosLoading, setRecentPhotosLoading] = useState(false)

  async function fetchRecentPhotos(pageNumber: number) {
    setRecentPhotosLoading(true)
    try {
      const res = await fetch(`/api/manage/recent-photos?page=${pageNumber}&limit=10`)
      const d = await res.json()
      if (d.photos) {
        setRecentPhotos(d.photos)
        setRecentPhotosHasNext(d.pagination.hasNext)
      }
    } catch (e) {
      console.error('Error fetching recent photos:', e)
    }
    setRecentPhotosLoading(false)
  }

  // ── Dedicated State & Handlers for Queries Tab ───────────────────────────
  const [querySearch, setQuerySearch] = useState('')
  const [queryCategoryFilter, setQueryCategoryFilter] = useState<string>('ALL')
  const [queryPlatformFilter, setQueryPlatformFilter] = useState<string>('ALL')
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null)
  const [queryModalOpen, setQueryModalOpen] = useState(false)
  const [editingQuery, setEditingQuery] = useState<PlatformQuery | null>(null)
  const [queryFormData, setQueryFormData] = useState<{
    question: string
    answer: string
    category: PlatformQuery['category']
    appliesTo: PlatformQuery['appliesTo']
    order: number
  }>({
    question: '',
    answer: '',
    category: 'COURSE_EXPIRY',
    appliesTo: 'BOTH',
    order: 0,
  })
  const [querySaving, setQuerySaving] = useState(false)
  const [copiedQueryId, setCopiedQueryId] = useState<string | null>(null)

  function openCreateQuery() {
    setEditingQuery(null)
    setQueryFormData({
      question: '',
      answer: '',
      category: 'COURSE_EXPIRY',
      appliesTo: 'BOTH',
      order: queries.length + 1,
    })
    setQueryModalOpen(true)
  }

  function openEditQuery(q: PlatformQuery) {
    setEditingQuery(q)
    setQueryFormData({
      question: q.question,
      answer: q.answer,
      category: q.category,
      appliesTo: q.appliesTo,
      order: q.order ?? 0,
    })
    setQueryModalOpen(true)
  }

  async function handleSaveQuery() {
    if (!queryFormData.question.trim() || !queryFormData.answer.trim()) {
      alert('Question and answer are required.')
      return
    }
    setQuerySaving(true)
    try {
      if (editingQuery) {
        const res = await fetch(`/api/manage/queries/${editingQuery.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryFormData),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update query')
      } else {
        const res = await fetch('/api/manage/queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryFormData),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to create query')
      }
      setQueryModalOpen(false)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Error saving query')
    } finally {
      setQuerySaving(false)
    }
  }

  async function handleDeleteQuery(id: string, qTitle: string) {
    const ok = await confirm({
      title: 'Delete Query?',
      message: `Are you sure you want to delete "${qTitle}"?`,
      confirmLabel: 'Delete Query',
      tone: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/manage/queries/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete query')
      }
      loadData()
    } catch (err: any) {
      alert(err.message || 'Error deleting query')
    }
  }

  function copyQueryAnswer(id: string, answerText: string) {
    navigator.clipboard.writeText(answerText)
    setCopiedQueryId(id)
    setTimeout(() => setCopiedQueryId(null), 2000)
  }

  async function handleNotificationImageUpload(file: File) {
    if (!file) return
    setIsUploadingImage(true)
    const uploadData = new FormData()
    uploadData.append('file', file)
    uploadData.append('type', 'announcements')

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData,
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setInlineNotif(p => ({ ...p, imageUrl: data.url }))
        alert('Banner image uploaded successfully!')
      } else {
        alert(`Upload failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      alert('Error uploading image file')
    } finally {
      setIsUploadingImage(false)
    }
  }

  async function handleSendCampaign() {
    if (!inlineNotif.title || !inlineNotif.body) {
      alert('Campaign Title and Message Body are required.')
      return
    }

    setIsSendingCampaign(true)
    try {
      const payload: Record<string, any> = {
        title: inlineNotif.title,
        body: inlineNotif.body,
        imageUrl: inlineNotif.imageUrl || null,
        ctaText: inlineNotif.ctaText || null,
        ctaLink: inlineNotif.ctaLink || null,
        targetType: inlineNotif.targetType,
        targetId: inlineNotif.targetId || null,
      }

      if (inlineNotif.sendLater) {
        if (!inlineNotif.scheduledFor) {
          alert('Please select a scheduled date and time.')
          setIsSendingCampaign(false)
          return
        }
        payload.scheduledFor = new Date(inlineNotif.scheduledFor).toISOString()
      } else {
        payload.scheduledFor = null
      }

      const res = await fetch('/api/notifications/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create campaign')
      }

      alert(inlineNotif.sendLater ? '🎉 Notification campaign scheduled successfully!' : '🚀 Notification broadcasted successfully!')
      
      // Reset form
      setInlineNotif({
        presetStyle: '',
        title: '',
        body: '',
        imageUrl: '',
        ctaText: '',
        ctaLink: '',
        targetType: 'ALL',
        targetId: '',
        scheduledFor: '',
        sendLater: false,
        category: 'PROMOTIONAL',
        priority: 'HIGH',
      })
      
      // Mutate SWR
      mutate('/api/notifications/campaigns')
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Error launching notification campaign')
    } finally {
      setIsSendingCampaign(false)
    }
  }

  // For lecture / material forms: topic selector
  const [topicsForCourse, setTopicsForCourse] = useState<any[]>([])
  const [loadingTopics, setLoadingTopics]   = useState(false)

  async function loadTopicsForCourse(courseId: string) {
    if (!courseId) { setTopicsForCourse([]); return }
    setLoadingTopics(true)
    try {
      const data = await fetch(`/api/courses/${courseId}/topics`).then(r => r.json())
      setTopicsForCourse(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoadingTopics(false)
  }

  function openCreate() {
    setEditId(null)
    setFormData(
      tab === 'courses' ? { isDisabled: false, googleGroupEmail: '', courseIconType: 'book_open', icon: 'BookOpen', academicTerm: '', academicYear: new Date().getFullYear(), examCycle: 'FULL_TERM' } :
      tab === 'faqs' ? { question: '', answer: '', order: faqs.length } :
      {}
    )
    setCourseIconPickerOpen(false)
    setTopicsForCourse([])
    setMaterialSourceType('FILE')
    setShowModal(true)
  }

  async function toggleCourseDisabled(item: any) {
    const isCurrentlyOff = Boolean(item.isDisabled || item.isExpired)
    const nextIsDisabled = !isCurrentlyOff

    // Optimistic SWR Cache Update — instant 0ms UI feedback
    const currentList = Array.isArray(coursesData) ? coursesData : (Array.isArray((coursesData as any)?.courses) ? (coursesData as any).courses : [])
    const optimisticList = currentList.map((c: any) =>
      c.id === item.id ? { ...c, isDisabled: nextIsDisabled } : c
    )

    if (typeof mutateCourses === 'function') {
      mutateCourses(optimisticList, false)
    }

    try {
      const res = await fetch(`/api/courses/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          description: item.description,
          subject: item.subject,
          color: item.color,
          icon: item.icon,
          courseIconType: item.courseIconType || 'book_open',
          teacherName: item.teacherName,
          isDemo: item.isDemo,
          isCommunityActive: item.isCommunityActive,
          expiresAt: item.expiresAt,
          isDisabled: nextIsDisabled,
          aboutUs: item.aboutUs || null,
          startDate: item.startDate || null,
          endDate: item.endDate || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to update course state')
        if (typeof mutateCourses === 'function') mutateCourses()
        return
      }
      if (typeof mutateCourses === 'function') mutateCourses()
      mutate('/api/live-sessions')
    } catch (e) {
      console.error(e)
      alert('Network error updating course state')
      if (typeof mutateCourses === 'function') mutateCourses()
    }
  }

  function openEdit(item: any) {
    setEditId(item.id)
    if (tab === 'lectures') {
      const courseId = item.topic?.courseId || ''
      setFormData({
        id: item.id,
        title: item.title || '',
        description: item.description || '',
        videoUrl: item.videoUrl || '',
        pptUrl: item.pptUrl || '',
        topicId: item.topicId || '',
        duration: item.duration || '',
        courseId,
      })
      setTopicsForCourse([])
      setShowModal(true)
      if (courseId) loadTopicsForCourse(courseId)
    } else if (tab === 'materials') {
      setMaterialSourceType(item.sourceType || 'FILE')
      setFormData({
        id: item.id,
        title: item.title || '',
        description: item.description || '',
        fileUrl: item.fileUrl || '',
        fileType: item.fileType || '',
        courseId: item.courseId || '',
      })
      setShowModal(true)
    } else if (tab === 'bundles') {
      setFormData({
        id: item.id,
        name: item.name || '',
        description: item.description || '',
        courseIds: item.courses?.map((entry: any) => entry.course.id) || [],
      } as any)
      setShowModal(true)
    } else if (tab === 'offerings') {
      setFormData({
        id: item.id,
        courseId: item.courseId || '',
        name: item.name || '',
        thumbnail: item.thumbnail || '',
        hasRecorded: item.hasRecorded ?? true,
        recordedOriginalPrice: item.recordedOriginalPrice || '',
        recordedDiscountPrice: item.recordedDiscountPrice || '',
        hasLive: item.hasLive ?? false,
        liveOriginalPrice: item.liveOriginalPrice || '',
        liveDiscountPrice: item.liveDiscountPrice || '',
      })
      setShowModal(true)
    } else {
      setFormData({
        ...item,
        courseId: item.courseId || item.course?.id || '',
        ...(tab === 'courses' ? { courseIconType: normalizeCourseIconType(item.courseIconType || item.icon), icon: item.icon || 'BookOpen' } : {}),
      })
      setCourseIconPickerOpen(false)
      setShowModal(true)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (tab === 'lectures') {
        const { topicId, title, description, videoUrl, pptUrl, duration } = formData
        if (editId) {
          const res = await fetch(`/api/content/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, videoUrl, pptUrl, duration }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || 'Failed to save lecture')
          }
        } else {
          if (!topicId) { setSaving(false); return }
          const res = await fetch(`/api/topics/${topicId}/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, videoUrl, pptUrl, duration }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || 'Failed to save lecture')
          }
        }
      } else {
        const endpoints: Record<Tab, string> = {
          courses:       '/api/courses',
          offerings:     '/api/course-offerings',
          bundles:       '/api/course-bundles',
          lectures:      '',            // handled above
          events:        '/api/events',
          materials:     '/api/materials',
          announcements: '/api/announcements',
          notifications: '/api/notifications/campaigns',
          'home-slides': '/api/admin/home-slides',
          faqs:          '/api/support/faq',
          queries:       '/api/manage/queries',
        }
        const base = endpoints[tab]
        const url  = editId ? `${base}/${editId}` : base

        let payload = formData;
        if (tab === 'courses') {
          payload = {
            ...formData,
            courseIconType: normalizeCourseIconType(formData.courseIconType || formData.icon),
            icon: formData.icon || 'BookOpen',
          };
        }
        if (tab === 'events') {
          payload = { ...formData };
          if (payload.startTime && !payload.startTime.includes('+') && !payload.startTime.includes('Z')) {
            payload.startTime += '+05:30';
          }
          if (payload.endTime && !payload.endTime.includes('+') && !payload.endTime.includes('Z')) {
            payload.endTime += '+05:30';
          }
        } else if (tab === 'materials') {
          payload = { ...formData, sourceType: materialSourceType };
        }

        // When the manager flags a material as a Free Resource, route the
        // POST to /api/free-resources/materials so it's saved with
        // isFree=true / courseId=null and gets indexed by the Flutter Free
        // Materials browser. PUT (edit) still hits the regular endpoint
        // because /api/materials/[id] handles both flavors via the body.
        let postUrl = url
        if (tab === 'materials' && !editId && (formData as any).isFreeResource) {
          postUrl = '/api/free-resources/materials'
          payload = {
            title: formData.title,
            description: formData.description,
            fileUrl: formData.fileUrl,
            fileType: formData.fileType,
            fileSize: formData.fileSize,
            sourceType: materialSourceType,
            category: formData.category || 'NOTE',
            level: formData.level || null,
            subject: formData.subject || null,
            term: formData.term || null,
          }
        }

        const res = await fetch(postUrl, {
          method: editId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Failed to save ${tab}`)
        }

        const savedData = await res.json().catch(() => ({}))
        if (tab === 'courses') {
          const currentList = Array.isArray(coursesData)
            ? coursesData
            : Array.isArray((coursesData as any)?.courses)
              ? (coursesData as any).courses
              : []
          let nextCourses = currentList
          if (editId) {
            nextCourses = currentList.map((c: any) =>
              c.id === editId ? { ...c, ...savedData, ...payload, _count: c._count || savedData._count } : c
            )
          } else if (savedData && savedData.id) {
            nextCourses = [{ ...savedData, ...payload, _count: { topics: 0, lectures: 0, materials: 0, courseEvents: 0 } }, ...currentList]
          }
          if (typeof mutateCourses === 'function') {
            await mutateCourses(nextCourses, { revalidate: true })
          }
        }
      }
      setShowModal(false)
      await loadData()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to save changes')
    }
    setSaving(false)
  }

  async function handleDuplicate(course: any) {
    const allowed = await confirm({
      title: 'Duplicate Course?',
      message: 'This will create a complete copy of the course with all topics, lectures, and materials.',
      confirmLabel: 'Duplicate',
      tone: 'default',
    })
    if (!allowed) return

    try {
      setSaving(true)
      const res = await fetch(`/api/courses/${course.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to duplicate course')
        return
      }

      const result = await res.json()
      loadData()
      alert(`Course duplicated successfully! New course ID: ${result.id}`)
    } catch (e) {
      console.error(e)
      alert('Error duplicating course')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, targetItem?: any) {
    const entityName = targetItem?.code || targetItem?.title || targetItem?.name || targetItem?.subject || id
    let entityType = 'Item'
    if (tab === 'courses') entityType = 'Course'
    else if (tab === 'offerings') entityType = 'Course Offering'
    else if (tab === 'bundles') entityType = 'Course Bundle'
    else if (tab === 'lectures') entityType = 'Lecture'
    else if (tab === 'materials') entityType = 'Material'
    else if (tab === 'events') entityType = 'Event'
    else if (tab === 'announcements') entityType = 'Announcement'
    else if (tab === 'home-slides') entityType = 'Home Slide'
    else if (tab === 'faqs') entityType = 'FAQ'

    const allowed = await confirm({
      title: `Delete ${entityType}`,
      message: `This will permanently delete the ${entityType.toLowerCase()}. Existing data using this entity will not be affected, but new actions will not be able to use it.`,
      confirmLabel: `Delete ${entityType}`,
      tone: 'danger',
      strictDelete: true,
      entityType,
      entityName,
      confirmationPhrase: `DELETE MY ${entityType.toUpperCase()}`,
    })
    if (!allowed) return
    if (tab === 'lectures') {
      await fetch(`/api/content/${id}`, { method: 'DELETE' })
    } else if (tab === 'materials') {
      await fetch(`/api/materials/${id}`, { method: 'DELETE' })
    } else if (tab === 'notifications') {
      alert('For audit compliance, notification campaign history cannot be deleted.')
      return
    } else if (tab === 'home-slides') {
      await fetch(`/api/admin/home-slides/${id}`, { method: 'DELETE' })
    } else {
      const endpoints: Record<Tab, string> = {
        courses:       '/api/courses',
        offerings:     '/api/course-offerings',
        bundles:       '/api/course-bundles',
        lectures:      '',
        events:        '/api/events',
        materials:     '',
        announcements: '/api/announcements',
        notifications: '',
        'home-slides': '',
        faqs:          '/api/support/faq',
        queries:       '/api/manage/queries',
      }
      await fetch(`${endpoints[tab]}/${id}`, { method: 'DELETE' })
    }
    loadData()
  }

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    ...(userRole === 'MANAGER' ? [{ key: 'courses' as Tab, label: 'Courses', count: courses.length }] : []),
    ...(userRole === 'MANAGER' ? [{ key: 'offerings' as Tab, label: 'Course Offerings', count: offerings.length }] : []),
    ...(userRole === 'MANAGER' ? [{ key: 'bundles' as Tab, label: 'Course Bundles', count: bundles.length }] : []),
    ...(userRole === 'MANAGER' ? [{ key: 'lectures' as Tab, label: 'Lectures', count: lectures.length }] : []),
    { key: 'events',        label: 'Events',        count: events.length },
    ...(userRole === 'MANAGER' ? [{ key: 'materials' as Tab, label: 'Materials', count: materials.length }] : []),
    { key: 'announcements', label: 'Announcements', count: announcements.length },
    ...(userRole === 'MANAGER' ? [{ key: 'faqs' as Tab, label: 'FAQs', count: faqs.length }] : []),
    ...(userRole === 'MANAGER' ? [{ key: 'queries' as Tab, label: 'Queries', count: queries.length }] : []),
  ]

  const ALL_COLORS = [...SOLID_COLORS, ...GRADIENT_COLORS]

  function renderForm() {
    const f = formData
    const set = (key: string, val: any) => setFormData(prev => ({ ...prev, [key]: val }))
    const courseOptions = courses.map(c => ({ value: c.id, label: c.name }))

    // shared course + topic selector used in lectures & materials
    const courseTopicSelector = (
      <>
        <div className="form-group">
          <label className="form-label">Course *</label>
          <select
            className="form-input"
            value={f.courseId || ''}
            onChange={e => { set('courseId', e.target.value); set('topicId', ''); loadTopicsForCourse(e.target.value) }}
          >
            <option value="">Select course...</option>
            {courseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Topic *</label>
          <select
            className="form-input"
            value={f.topicId || ''}
            onChange={e => set('topicId', e.target.value)}
            disabled={!f.courseId || loadingTopics}
          >
            <option value="">{loadingTopics ? 'Loading topics…' : 'Select topic…'}</option>
            {topicsForCourse.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          {f.courseId && !loadingTopics && topicsForCourse.length === 0 && (
            <p style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>
              No topics found. Add a topic in the Courses tab first.
            </p>
          )}
        </div>
      </>
    )

    switch (tab) {
      case 'courses':
        return (
          <>
            <style>{`
              .ce-form {
                display: flex;
                flex-direction: column;
                gap: 28px;
              }
              .ce-section {
                display: flex;
                flex-direction: column;
                gap: 16px;
              }
              .ce-section-label {
                font-size: 11px;
                font-weight: 650;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--text-muted);
                margin: 0;
              }
              .ce-row {
                display: grid;
                gap: 20px;
              }
              .ce-row.r2 { grid-template-columns: 1fr 1fr; }
              .ce-row.r2-wide { grid-template-columns: 1.5fr 1fr; }
              .ce-row.r3 { grid-template-columns: 1fr 1fr 1fr; }
              .ce-row.r4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
              .ce-field {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin: 0;
                min-width: 0;
              }
              .ce-field label {
                font-size: 13px;
                font-weight: 500;
                color: var(--text-secondary);
              }
              .ce-hint {
                font-size: 12px;
                color: var(--text-muted);
                line-height: 1.4;
                margin: 0;
              }
              .ce-checks {
                display: flex;
                flex-wrap: wrap;
                gap: 24px;
                align-items: center;
              }
              .ce-check {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                margin: 0;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-primary);
              }
              .ce-stages {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
              }
              .ce-stage {
                flex: 1;
                min-width: 88px;
                padding: 10px 12px;
                border-radius: 10px;
                border: 1px solid var(--border);
                background: transparent;
                color: var(--text-secondary);
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                text-align: center;
                transition: border-color 0.15s, color 0.15s, background 0.15s;
                font-family: inherit;
              }
              .ce-stage.is-on {
                border-color: var(--primary);
                color: var(--primary);
                background: color-mix(in srgb, var(--primary) 10%, transparent);
              }
              .ce-icon-btn {
                width: 100%;
                min-height: 48px;
                border-radius: 12px;
                border: 1px solid var(--border);
                background: var(--bg);
                color: var(--text-primary);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 8px 14px;
                cursor: pointer;
                font-family: inherit;
                text-align: left;
              }
              .ce-colors {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
              }
              .ce-swatch {
                width: 30px;
                height: 30px;
                border-radius: 9px;
                border: 2px solid transparent;
                cursor: pointer;
                padding: 0;
                transition: box-shadow 0.15s, border-color 0.15s;
              }
              @media (max-width: 860px) {
                .ce-row.r2,
                .ce-row.r2-wide,
                .ce-row.r3,
                .ce-row.r4 {
                  grid-template-columns: 1fr;
                }
                .ce-stages { display: grid; grid-template-columns: 1fr 1fr; }
              }
            `}</style>

            <div className="ce-form">
              {/* Basics */}
              <section className="ce-section">
                <p className="ce-section-label">Basics</p>
                <div className="ce-row r2-wide">
                  <div className="ce-field">
                    <label>Name *</label>
                    <input className="form-input" value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="Course name" />
                  </div>
                  <div className="ce-field">
                    <label>Subject</label>
                    <input className="form-input" value={f.subject || ''} onChange={e => set('subject', e.target.value)} placeholder="e.g. Computer Science" />
                  </div>
                </div>
                <div className="ce-row r2">
                  <div className="ce-field">
                    <label>Teacher</label>
                    <input className="form-input" value={f.teacherName || ''} onChange={e => set('teacherName', e.target.value)} placeholder="Teacher name" />
                  </div>
                  <div className="ce-field">
                    <label>Icon</label>
                    <button type="button" className="ce-icon-btn" onClick={() => setCourseIconPickerOpen(true)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <CourseIconBadge type={f.courseIconType || f.icon} size={34} iconSize={18} radius={10} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getCourseIconOption(f.courseIconType || f.icon).label}
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Shared across web &amp; app
                          </span>
                        </span>
                      </span>
                      <span style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>Choose</span>
                    </button>
                  </div>
                </div>
                <div className="ce-checks">
                  <label className="ce-check" style={{ opacity: editId ? 0.65 : 1, cursor: editId ? 'default' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!f.isFree}
                      disabled={editId !== null}
                      onChange={e => setFormData(p => ({ ...p, isFree: e.target.checked as any }))}
                    />
                    Free course
                    {editId && <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>Fixed</span>}
                  </label>
                  <label className="ce-check">
                    <input
                      type="checkbox"
                      checked={!!f.isDisabled}
                      onChange={e => setFormData(p => ({ ...p, isDisabled: e.target.checked as any }))}
                    />
                    Disable course
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>Hidden from students</span>
                  </label>
                </div>
              </section>

              {/* Groups */}
              <section className="ce-section">
                <p className="ce-section-label">Google Groups</p>
                <div className="ce-row r2">
                  <div className="ce-field">
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Recorded / Default</span>
                      {(() => {
                        const emails = (f.googleGroupEmail || '').split(',').filter((e: string) => e.trim())
                        const count = Math.max(emails.length, 1)
                        return count < 5 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const current = (f.googleGroupEmail || '').split(',').filter((e: string) => e.trim())
                              if (current.length === 0) current.push('')
                              current.push('')
                              set('googleGroupEmail', current.join(','))
                            }}
                            style={{
                              background: 'transparent',
                              color: 'var(--primary)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              width: '28px',
                              height: '28px',
                              fontSize: '16px',
                              lineHeight: 1,
                              cursor: 'pointer',
                            }}
                            title="Add another email (max 5)"
                          >+</button>
                        ) : null
                      })()}
                    </label>
                    {(() => {
                      const raw = f.googleGroupEmail || ''
                      const emails = raw.split(',')
                      if (emails.length === 0 || (emails.length === 1 && emails[0] === '')) {
                        return (
                          <input
                            className="form-input"
                            type="email"
                            value=""
                            onChange={e => set('googleGroupEmail', e.target.value.toLowerCase())}
                            placeholder="recorded-batch@yourdomain.com"
                          />
                        )
                      }
                      return emails.map((email: string, idx: number) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: idx < emails.length - 1 ? '8px' : 0 }}>
                          <input
                            className="form-input"
                            type="email"
                            value={email.trim()}
                            onChange={e => {
                              const updated = [...emails]
                              updated[idx] = e.target.value.toLowerCase()
                              set('googleGroupEmail', updated.join(','))
                            }}
                            placeholder={`recorded-batch${idx + 1}@yourdomain.com`}
                            style={{ flex: 1 }}
                          />
                          {emails.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = emails.filter((_: string, i: number) => i !== idx)
                                set('googleGroupEmail', updated.length > 0 ? updated.join(',') : '')
                              }}
                              style={{
                                background: 'transparent',
                                color: 'var(--danger)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                              title="Remove"
                            >×</button>
                          )}
                        </div>
                      ))
                    })()}
                    <p className="ce-hint">Used for all students when Live group is empty.</p>
                  </div>
                  <div className="ce-field">
                    <label>Live (optional)</label>
                    <input
                      className="form-input"
                      type="email"
                      value={f.liveGoogleGroupEmail || ''}
                      onChange={e => set('liveGoogleGroupEmail', e.target.value.toLowerCase())}
                      placeholder="live-batch@yourdomain.com"
                    />
                    <p className="ce-hint">Only Live-batch students. Leave blank for general batches.</p>
                  </div>
                </div>
              </section>

              {/* Content */}
              <section className="ce-section">
                <p className="ce-section-label">Content</p>
                <div className="ce-row r2">
                  <div className="ce-field">
                    <label>Description</label>
                    <textarea
                      className="form-input"
                      value={f.description || ''}
                      onChange={e => set('description', e.target.value)}
                      placeholder="Short course description"
                      rows={4}
                      style={{ resize: 'vertical', minHeight: '96px' }}
                    />
                  </div>
                  <div className="ce-field">
                    <label>About</label>
                    <textarea
                      className="form-input"
                      value={f.aboutUs || ''}
                      onChange={e => set('aboutUs', e.target.value)}
                      placeholder="About this course…"
                      rows={4}
                      style={{ resize: 'vertical', minHeight: '96px' }}
                    />
                  </div>
                </div>
              </section>

              {/* Schedule */}
              <section className="ce-section">
                <p className="ce-section-label">Schedule &amp; Access</p>
                <div className="ce-row r2">
                  <div className="ce-field">
                    <label>Academic term</label>
                    <select
                      className="form-input"
                      value={f.academicTerm && f.academicYear ? `${f.academicTerm}_${f.academicYear}` : (f.academicTerm || '')}
                      onChange={e => {
                        const val = e.target.value
                        if (!val) {
                          set('academicTerm', '')
                          set('academicYear', '')
                        } else if (val.includes('_')) {
                          const [termKey, yearStr] = val.split('_')
                          set('academicTerm', termKey)
                          set('academicYear', Number(yearStr))
                        } else {
                          set('academicTerm', val)
                        }
                      }}
                    >
                      <option value="">None / Not assigned</option>
                      {(termsConfigData?.terms || []).map((t: any) => (
                        <option key={t.id} value={`${t.termKey}_${t.year}`}>
                          {t.name}{t.isCurrent ? ' · Current' : ''}
                        </option>
                      ))}
                      {!termsConfigData?.terms?.length && (
                        <>
                          <option value={`JAN_${new Date().getFullYear()}`}>January {new Date().getFullYear()} Term</option>
                          <option value={`MAY_${new Date().getFullYear()}`}>May {new Date().getFullYear()} Term</option>
                          <option value={`SEP_${new Date().getFullYear()}`}>September {new Date().getFullYear()} Term</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="ce-field">
                    <label>Exam stage</label>
                    <div className="ce-stages">
                      {[
                        { id: 'QUIZ_1', label: 'Quiz 1' },
                        { id: 'QUIZ_2', label: 'Quiz 2' },
                        { id: 'END_TERM', label: 'End Term' },
                        { id: 'FULL_TERM', label: 'Full Term' },
                      ].map(stage => {
                        const isSelected = (f.examCycle || 'FULL_TERM') === stage.id
                        return (
                          <button
                            key={stage.id}
                            type="button"
                            className={`ce-stage${isSelected ? ' is-on' : ''}`}
                            onClick={() => set('examCycle', stage.id)}
                          >
                            {stage.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="ce-row r4">
                  <div className="ce-field">
                    <label>Start</label>
                    <input
                      type="date"
                      className="form-input"
                      value={f.startDate ? f.startDate.split('T')[0] : ''}
                      onChange={e => set('startDate', e.target.value)}
                    />
                  </div>
                  <div className="ce-field">
                    <label>End</label>
                    <input
                      type="date"
                      className="form-input"
                      value={f.endDate ? f.endDate.split('T')[0] : ''}
                      onChange={e => set('endDate', e.target.value)}
                    />
                  </div>
                  <div className="ce-field">
                    <label>Access expiry</label>
                    <input
                      type="date"
                      className="form-input"
                      value={f.expiresAt ? f.expiresAt.split('T')[0] : ''}
                      onChange={e => {
                        const val = e.target.value
                        if (!val) { set('expiresAt', ''); return }
                        const year = new Date(val).getFullYear()
                        if ([2025, 2026, 2027].includes(year)) {
                          set('expiresAt', val)
                        } else {
                          alert('Please select a year between 2025 and 2027')
                        }
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      max="2027-12-31"
                    />
                  </div>
                  <div className="ce-field">
                    <label>Live upgrade (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="1"
                      value={f.liveUpgradePrice ?? ''}
                      onChange={e => set('liveUpgradePrice', e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </section>

              {/* Appearance */}
              <section className="ce-section">
                <p className="ce-section-label">Appearance</p>
                <div className="ce-field">
                  <label>Color</label>
                  <div className="ce-colors">
                    {SOLID_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        className="ce-swatch"
                        onClick={() => set('color', c)}
                        style={{
                          background: c,
                          borderColor: f.color === c ? '#fff' : 'transparent',
                          boxShadow: f.color === c ? `0 0 0 2px ${c}` : 'none',
                        }}
                        title={c}
                      />
                    ))}
                    <span style={{ width: '1px', height: '22px', background: 'var(--border)', margin: '0 4px' }} />
                    {GRADIENT_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        className="ce-swatch"
                        onClick={() => set('color', c)}
                        style={{
                          background: c,
                          borderColor: f.color === c ? '#fff' : 'transparent',
                          boxShadow: f.color === c ? '0 0 0 2px var(--primary)' : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </>
        )

      case 'bundles':
        return (
          <>
            <div className="form-group"><label className="form-label">Bundle Name *</label><input className="form-input" value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. First Semester Pack" /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" value={f.description || ''} onChange={e => set('description', e.target.value)} rows={3} style={{ resize: 'vertical' }} placeholder="Optional note for managers" /></div>
            <div className="form-group">
              <label className="form-label">Included Courses *</label>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '6px',
                maxHeight: '220px', overflowY: 'auto',
                padding: '10px', borderRadius: '8px',
                background: 'var(--primary-light)', border: '1px solid var(--border)',
              }}>
                {courses.map((course: any) => (
                  <label key={course.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={(f.courseIds || []).includes(course.id)}
                      disabled={!!course.isEffectivelyDisabled}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        courseIds: e.target.checked
                          ? [...(prev.courseIds || []), course.id]
                          : (prev.courseIds || []).filter((id: string) => id !== course.id),
                      }))}
                    />
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: course.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px' }}>{course.name}</span>
                    {course.subject && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({course.subject})</span>}
                    {course.isExpired && <span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '700' }}>Expired</span>}
                    {course.isEffectivelyDisabled && !course.isExpired && <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700' }}>Disabled</span>}
                  </label>
                ))}
              </div>
            </div>
          </>
        )

      case 'lectures': {
        const parseDuration = (dStr: string) => {
          if (!dStr) return { h: 0, m: 0, s: 0 };
          const parts = dStr.split(':').map(Number);
          if (parts.length === 3) return { h: parts[0], m: parts[1], s: parts[2] };
          if (parts.length === 2) return { h: 0, m: parts[0], s: parts[1] };
          return { h: 0, m: 0, s: 0 };
        };
        const currentDur = parseDuration(f.duration || '');
        const handleDurationChange = (key: 'h' | 'm' | 's', val: number) => {
          const nextDur = { ...currentDur, [key]: val };
          if (nextDur.h === 0 && nextDur.m === 0 && nextDur.s === 0) {
            set('duration', '');
          } else {
            const pad = (num: number) => String(num).padStart(2, '0');
            if (nextDur.h > 0) {
              set('duration', `${nextDur.h}:${pad(nextDur.m)}:${pad(nextDur.s)}`);
            } else {
              set('duration', `${nextDur.m}:${pad(nextDur.s)}`);
            }
          }
        };

        return (
          <>
            {courseTopicSelector}
            <div className="form-group"><label className="form-label">Lecture Title *</label><input className="form-input" value={f.title || ''} onChange={e => set('title', e.target.value)} placeholder="e.g. Introduction to Variables" /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" value={f.description || ''} onChange={e => set('description', e.target.value)} rows={2} style={{ resize: 'vertical' }} /></div>
            <div className="form-group"><label className="form-label">Video URL</label><input className="form-input" value={f.videoUrl || ''} onChange={e => set('videoUrl', e.target.value)} placeholder="https://youtube.com/watch?v=… or direct video link" /></div>
            <div className="form-group"><label className="form-label">Attachment / PPT URL</label><input className="form-input" value={f.pptUrl || ''} onChange={e => set('pptUrl', e.target.value)} placeholder="https://… (PDF, PPT, or any file — optional)" /></div>
            <div className="form-group">
              <label className="form-label">Duration (Optional)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Hours</span>
                  <select className="form-input" value={currentDur.h} onChange={e => handleDurationChange('h', Number(e.target.value))}>
                    {Array.from({ length: 11 }, (_, i) => (
                      <option key={i} value={i}>{i}h</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Minutes</span>
                  <select className="form-input" value={currentDur.m} onChange={e => handleDurationChange('m', Number(e.target.value))}>
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i}>{i}m</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Seconds</span>
                  <select className="form-input" value={currentDur.s} onChange={e => handleDurationChange('s', Number(e.target.value))}>
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i}>{i}s</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        )
      }

      case 'events':
        return (
          <>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="isGlobal"
                checked={!!f.isGlobal} 
                onChange={e => setFormData(p => ({ ...p, isGlobal: e.target.checked as any }))}
              />
              <label htmlFor="isGlobal" className="form-label" style={{ marginBottom: 0 }}>Global Event (Visible to everyone)</label>
            </div>
            {!f.isGlobal && (
              <div className="form-group">
                <label className="form-label">Course *</label>
                <select className="form-input" value={f.courseId || ''} onChange={e => set('courseId', e.target.value)}>
                  <option value="">Select course...</option>
                  {courseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            <div className="form-group"><label className="form-label">Title *</label><input className="form-input" value={f.title || ''} onChange={e => set('title', e.target.value)} placeholder="Event title" /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" value={f.description || ''} onChange={e => set('description', e.target.value)} placeholder="Event description" rows={2} /></div>
            <div className="form-group"><label className="form-label">Meeting Link (Optional)</label><input className="form-input" value={f.meetLink || f.meetingLink || ''} onChange={e => set('meetLink', e.target.value)} placeholder="https://meet.jit.si/..." /></div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Start Date & Time *</label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  value={f.startTime ? new Date(f.startTime).toISOString().slice(0, 16) : ''} 
                  onChange={e => set('startTime', e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date & Time *</label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  value={f.endTime ? new Date(f.endTime).toISOString().slice(0, 16) : ''} 
                  onChange={e => set('endTime', e.target.value)} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Event Type</label>
                <select className="form-input" value={f.type || 'class'} onChange={e => set('type', e.target.value)}>
                  <option value="class">Class / Lecture</option>
                  <option value="exam">Exam / Test</option>
                  <option value="holiday">Holiday</option>
                  <option value="assignment">Assignment</option>
                  <option value="introduction">Introduction</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={f.status || 'SCHEDULED'} onChange={e => set('status', e.target.value)}>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="RESCHEDULED">Rescheduled</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Recurrence</label>
                <select className="form-input" value={f.recurrence || 'ONETIME'} onChange={e => set('recurrence', e.target.value)}>
                  <option value="ONETIME">One-time</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="CUSTOM">Custom Interval</option>
                </select>
              </div>
              {f.recurrence === 'CUSTOM' && (
                <div className="form-group">
                  <label className="form-label">Interval (Days)</label>
                  <input type="number" className="form-input" value={f.interval || ''} onChange={e => set('interval', e.target.value)} placeholder="e.g. 3" min="1" />
                </div>
              )}
            </div>
          </>
        )

      case 'materials':
        return (
          <>
            {/* Free Resource toggle — when on, this material lands in the
                Flutter Free Materials browser (Level → Subject → 3 tabs)
                instead of being scoped to one course. */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '12px', borderRadius: '8px', border: `2px solid ${f.isFreeResource ? '#10b981' : '#e5e7eb'}`, background: f.isFreeResource ? '#ecfdf5' : 'transparent' }}>
                <input
                  type="checkbox"
                  checked={!!f.isFreeResource}
                  onChange={e => set('isFreeResource', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e1e3a' }}>
                  📂 Free Resource (visible in app's Free Materials browser)
                </span>
              </label>
            </div>
            {f.isFreeResource ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select className="form-input" value={f.category || 'NOTE'} onChange={e => set('category', e.target.value)}>
                      <option value="NOTE">Notes</option>
                      <option value="PYQ">PYQ</option>
                      <option value="ASSIGNMENT">Assignment</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Level</label>
                    <input className="form-input" value={f.level || ''} onChange={e => set('level', e.target.value)} placeholder="e.g. Foundation / Diploma / Degree" list="level-options" />
                    <datalist id="level-options">
                      {IITM_LEVELS.map(l => (<option key={l} value={l} />))}
                    </datalist>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <input
                      className="form-input"
                      value={f.subject || ''}
                      onChange={e => set('subject', e.target.value)}
                      placeholder="e.g. Maths 1, Stats 1, MLF"
                      list="subject-options"
                    />
                    {/* Narrow the suggestions to the chosen Level when set;
                        show every curated IITM subject when not. Managers can
                        still type a custom subject the curated list doesn't
                        cover. */}
                    <datalist id="subject-options">
                      {(f.level && IITM_SUBJECTS_BY_LEVEL[f.level as keyof typeof IITM_SUBJECTS_BY_LEVEL]
                        ? IITM_SUBJECTS_BY_LEVEL[f.level as keyof typeof IITM_SUBJECTS_BY_LEVEL]
                        : IITM_ALL_SUBJECTS
                      ).map(s => (<option key={s} value={s} />))}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Term</label>
                    <input className="form-input" value={f.term || ''} onChange={e => set('term', e.target.value)} placeholder="e.g. Term 1 · 2024" />
                  </div>
                </div>
              </>
            ) : (
              <div className="form-group">
                <label className="form-label">Subject *</label>
                <select className="form-input" value={f.courseId || ''} onChange={e => set('courseId', e.target.value)}>
                  <option value="">Select subject...</option>
                  {courseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            <div className="form-group"><label className="form-label">Topic Name *</label><input className="form-input" value={f.title || ''} onChange={e => set('title', e.target.value)} placeholder="e.g. Week 1 Slides" /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" value={f.description || ''} onChange={e => set('description', e.target.value)} rows={2} style={{ resize: 'vertical' }} /></div>

            {/* Source Type Toggle */}
            <div className="form-group">
              <label className="form-label">Source Type *</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${materialSourceType === 'FILE' ? 'var(--accent)' : 'var(--surface-2)'}`, background: materialSourceType === 'FILE' ? 'var(--primary-light)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="materialSourceType"
                    value="FILE"
                    checked={materialSourceType === 'FILE'}
                    onChange={() => setMaterialSourceType('FILE')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: materialSourceType === 'FILE' ? '600' : '500', color: 'var(--text-primary)' }}>📄 Upload File</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${materialSourceType === 'LINK' ? 'var(--accent)' : 'var(--surface-2)'}`, background: materialSourceType === 'LINK' ? 'var(--primary-light)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="materialSourceType"
                    value="LINK"
                    checked={materialSourceType === 'LINK'}
                    onChange={() => setMaterialSourceType('LINK')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: materialSourceType === 'LINK' ? '600' : '500', color: 'var(--text-primary)' }}>🔗 External Link</span>
                </label>
              </div>
            </div>

            {/* Show File URL or Link Input */}
            {materialSourceType === 'FILE' ? (
              <>
                <div className="form-group"><label className="form-label">File URL *</label><input className="form-input" value={f.fileUrl || ''} onChange={e => set('fileUrl', e.target.value)} placeholder="https://… (PDF, PPT, DOCX, etc.)" /></div>
                <div className="form-group"><label className="form-label">File Type</label><input className="form-input" value={f.fileType || ''} onChange={e => set('fileType', e.target.value)} placeholder="e.g. pdf, pptx, docx" /></div>
              </>
            ) : (
              <div className="form-group"><label className="form-label">External Link URL *</label><input className="form-input" value={f.fileUrl || ''} onChange={e => set('fileUrl', e.target.value)} placeholder="https://example.com/resource" /></div>
            )}
          </>
        )

      case 'offerings':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Course *</label>
              <select className="form-input" value={f.courseId || ''} onChange={e => set('courseId', e.target.value)}>
                <option value="">Select course...</option>
                {courseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Offering Name / Bundle Name *</label><input className="form-input" value={f.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Full Stack Mastery" /></div>
            <div className="form-group"><label className="form-label">Thumbnail URL</label><input className="form-input" value={f.thumbnail || ''} onChange={e => set('thumbnail', e.target.value)} placeholder="https://... (optional image URL)" /></div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'var(--primary-light)', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input type="checkbox" checked={!!f.hasRecorded} onChange={e => set('hasRecorded', e.target.checked)} />
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>📹 Recorded (Basic) Access</span>
              </label>
              {f.hasRecorded && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group"><label className="form-label">Original Price (₹)</label><input type="number" className="form-input" value={f.recordedOriginalPrice || ''} onChange={e => set('recordedOriginalPrice', e.target.value)} placeholder="e.g. 2999" min="0" /></div>
                  <div className="form-group"><label className="form-label">Discount Price (₹) *</label><input type="number" className="form-input" value={f.recordedDiscountPrice || ''} onChange={e => set('recordedDiscountPrice', e.target.value)} placeholder="e.g. 999" min="0" /></div>
                </div>
              )}
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'var(--primary-light)', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input type="checkbox" checked={!!f.hasLive} onChange={e => set('hasLive', e.target.checked)} />
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>🔴 Live (Pro) Access</span>
              </label>
              {f.hasLive && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group"><label className="form-label">Original Price (₹)</label><input type="number" className="form-input" value={f.liveOriginalPrice || ''} onChange={e => set('liveOriginalPrice', e.target.value)} placeholder="e.g. 5999" min="0" /></div>
                  <div className="form-group"><label className="form-label">Discount Price (₹) *</label><input type="number" className="form-input" value={f.liveDiscountPrice || ''} onChange={e => set('liveDiscountPrice', e.target.value)} placeholder="e.g. 2999" min="0" /></div>
                </div>
              )}
            </div>
          </>
        )

      case 'announcements':
        return (
          <>
            <div className="form-group"><label className="form-label">Title *</label><input className="form-input" value={f.title || ''} onChange={e => set('title', e.target.value)} placeholder="Announcement title" /></div>
            <div className="form-group"><label className="form-label">Content *</label><textarea className="form-input" value={f.content || ''} onChange={e => set('content', e.target.value)} rows={3} style={{ resize: 'vertical' }} placeholder="Announcement content" /></div>
            <div className="form-group"><label className="form-label">Type</label><select className="form-input" value={f.type || 'info'} onChange={e => set('type', e.target.value)}><option value="info">Info</option><option value="warning">Warning</option><option value="success">Success</option><option value="error">Error</option></select></div>
          </>
        )

      case 'notifications':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', width: '100%', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Campaign Title *</label>
                <input className="form-input" value={f.title || ''} onChange={e => set('title', e.target.value)} placeholder="e.g. ⚡ IITian Live Batch starts today!" />
              </div>
              <div className="form-group">
                <label className="form-label">Message Body *</label>
                <textarea className="form-input" value={f.body || ''} onChange={e => set('body', e.target.value)} rows={3} style={{ resize: 'vertical' }} placeholder="e.g. Get live classes, study materials, and tests designed by IITians. Tap to enroll!" />
              </div>
              <div className="form-group">
                <label className="form-label">Banner Image URL (Optional)</label>
                <input className="form-input" value={f.imageUrl || ''} onChange={e => set('imageUrl', e.target.value)} placeholder="https://example.com/banner-image.png" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">CTA Text (Optional)</label>
                  <input className="form-input" value={f.ctaText || ''} onChange={e => set('ctaText', e.target.value)} placeholder="e.g. Join Batch" />
                </div>
                <div className="form-group">
                  <label className="form-label">CTA Link (Optional)</label>
                  <input className="form-input" value={f.ctaLink || ''} onChange={e => set('ctaLink', e.target.value)} placeholder="e.g. /store or /events" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Target Audience *</label>
                <select className="form-input" value={f.targetType || 'ALL'} onChange={e => { set('targetType', e.target.value); set('targetId', '') }}>
                  <option value="ALL">All Students</option>
                  <option value="COURSE">Course Batch</option>
                  <option value="BUNDLE">Course Bundle</option>
                </select>
              </div>
              {f.targetType === 'COURSE' && (
                <div className="form-group">
                  <label className="form-label">Select Course Batch *</label>
                  <select className="form-input" value={f.targetId || ''} onChange={e => set('targetId', e.target.value)}>
                    <option value="">Select course...</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {f.targetType === 'BUNDLE' && (
                <div className="form-group">
                  <label className="form-label">Select Course Bundle *</label>
                  <select className="form-input" value={f.targetId || ''} onChange={e => set('targetId', e.target.value)}>
                    <option value="">Select bundle...</option>
                    {bundles.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Timing *</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="radio" name="timing" checked={!f.scheduledFor} onChange={() => set('scheduledFor', null)} /> Send Now
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="radio" name="timing" checked={!!f.scheduledFor} onChange={() => set('scheduledFor', new Date(Date.now() + 5*60*1000).toISOString().slice(0, 16))} /> Schedule for Later
                  </label>
                </div>
              </div>
              {f.scheduledFor && (
                <div className="form-group">
                  <label className="form-label">Scheduled Time (IST) *</label>
                  <input type="datetime-local" className="form-input" value={f.scheduledFor ? new Date(new Date(f.scheduledFor).getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 16) : ''} onChange={e => set('scheduledFor', e.target.value)} />
                </div>
              )}
            </div>

            {/* Simulated Smartphone Preview Block */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '24px', padding: '16px', minWidth: '250px' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#909196', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px' }}>📱 Preview on Device</div>
              <div style={{
                width: '240px', height: '390px', background: '#09080c', border: '6px solid #202022', borderRadius: '32px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 24px rgba(0,0,0,0.2)'
              }}>
                <div style={{ width: '80px', height: '12px', background: '#202022', borderRadius: '0 0 10px 10px', alignSelf: 'center', position: 'absolute', top: 0, zIndex: 10 }}></div>
                <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', background: 'linear-gradient(150deg, #1f1a3a 0%, #0d0b18 100%)', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#888596', marginBottom: '28px', fontWeight: '600' }}>
                    <span>09:41</span>
                    <span>🔋 100%</span>
                  </div>
                  
                  {/* Push Banner */}
                  <div style={{
                    width: '100%', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', borderRadius: '14px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: '900' }}>G</div>
                        <span style={{ fontSize: '8px', fontWeight: '700', color: 'var(--text-primary)' }}>GENz IITian</span>
                      </div>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>now</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-primary)' }}>{f.title || 'Campaign Title'}</div>
                      <div style={{ fontSize: '8.5px', color: 'var(--text-secondary)', lineHeight: '1.2' }}>{f.body || 'This is how your rich body message will look on students\' screens. Keep it highly engaging!'}</div>
                    </div>
                    {f.imageUrl && (
                      <div style={{
                        width: '100%', height: '80px', backgroundSize: 'cover', backgroundImage: `url(${f.imageUrl})`, backgroundPosition: 'center', borderRadius: '8px', marginTop: '2px'
                      }}></div>
                    )}
                    {f.ctaText && (
                      <div style={{
                        width: '100%', padding: '5px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--primary)', fontSize: '8.5px', fontWeight: '700', textAlign: 'center', marginTop: '2px'
                      }}>{f.ctaText}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'home-slides':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Banner Image *</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  value={f.image || ''}
                  onChange={e => set('image', e.target.value)}
                  placeholder="https://example.com/slide.png"
                  style={{ flex: 1 }}
                />
                {f.image && (
                  <button
                    type="button"
                    onClick={() => set('image', '')}
                    className="btn btn-ghost"
                    style={{ color: 'var(--danger)', border: '1px solid #fee2e2', padding: '10px 14px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    🗑️ Remove Photo
                  </button>
                )}
                <label className="btn btn-ghost" style={{ border: '1px solid var(--neu-dark)', cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', padding: '10px 14px', fontSize: '13px' }}>
                  📂 Upload File
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      const uploadData = new FormData();
                      uploadData.append('file', file);
                      uploadData.append('type', 'announcements');

                      try {
                        setSaving(true);
                        const res = await fetch('/api/upload', {
                          method: 'POST',
                          body: uploadData
                        });
                        const data = await res.json();
                        if (res.ok && data.url) {
                          set('image', data.url);
                          alert('Image uploaded successfully!');
                        } else {
                          alert(`Upload failed: ${data.error || 'Unknown error'}`);
                        }
                      } catch (err) {
                        alert('Error uploading image file');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  />
                </label>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Upload a 16:9 ratio visual promotion slide (maximum 10MB).
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Alt Text (Accessibility) *</label>
              <input
                className="form-input"
                value={f.alt || ''}
                onChange={e => set('alt', e.target.value)}
                placeholder="e.g. Special May qualifier exam session banner"
              />
            </div>

            <div className="form-group">
              <label className="form-label">CTA Link / Redirect Link *</label>
              <input
                className="form-input"
                value={f.href || ''}
                onChange={e => set('href', e.target.value)}
                placeholder="e.g. /courses or https://youtube.com/..."
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Students will redirect to this page/URL when they click the banner slide.
              </p>
            </div>

            {f.image && (
              <div style={{ marginTop: '12px', width: '100%' }}>
                <label className="form-label">Carousel Slide Preview:</label>
                <div style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  borderRadius: '14px',
                  background: 'var(--text-primary)',
                  backgroundImage: `url(${f.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '6px'
                  }}>
                    <div style={{ width: '20px', height: '6px', borderRadius: '50px', background: 'var(--primary)' }}></div>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50px', background: 'var(--surface-2)' }}></div>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50px', background: 'var(--surface-2)' }}></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )
      case 'faqs':
        return (
          <>
            <div className="form-group">
              <label className="form-label">Question *</label>
              <input
                type="text"
                className="form-input"
                value={f.question || ''}
                onChange={e => set('question', e.target.value)}
                placeholder="e.g. What is the difference between PLUS and PRO?"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Answer *</label>
              <textarea
                className="form-input"
                rows={5}
                value={f.answer || ''}
                onChange={e => set('answer', e.target.value)}
                placeholder="Provide a clear, helpful answer for students..."
                required
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Display Order</label>
              <input
                type="number"
                className="form-input"
                value={f.order ?? 0}
                onChange={e => set('order', parseInt(e.target.value, 10) || 0)}
                min={0}
              />
            </div>
          </>
        )
    }
  }

  function getItems(): any[] {
    switch (tab) {
      case 'courses':       return courses
      case 'offerings':     return offerings
      case 'bundles':       return bundles
      case 'lectures':      return lectures
      case 'events':        return events
      case 'materials':     return materials
      case 'announcements': return announcements
      case 'notifications': return campaigns
      case 'home-slides':   return slides
      case 'faqs':          return faqs
    }
  }

  return (
    <div className="page-container fade-in">
      {confirmDialog}
      {clearEnrollmentsCourse && (
        <ClearCourseEnrollmentsModal
          open
          courseId={clearEnrollmentsCourse.id}
          courseName={clearEnrollmentsCourse.name}
          onClose={() => setClearEnrollmentsCourse(null)}
          onCleared={({ removedCount }) => {
            setClearEnrollmentsCourse(null)
            window.alert(
              `Removed ${removedCount} student enrollment${removedCount === 1 ? '' : 's'}. Those users no longer have access. You can reuse this course with a new batch.`
            )
          }}
        />
      )}
      <AcademicTermsModal
        isOpen={academicTermsModalOpen}
        onClose={() => setAcademicTermsModalOpen(false)}
        onUpdated={() => {
          if (typeof mutateTermsConfig === 'function') mutateTermsConfig()
        }}
      />
      {loadError ? (
        <div
          className="card"
          style={{
            marginBottom: '16px',
            padding: '14px 18px',
            border: '1px solid var(--border)',
            color: 'var(--danger)',
            background: 'var(--danger-light)',
          }}
        >
          Failed to load manage data. {loadError.message}
        </div>
      ) : null}
      <div className="page-header">
        <div style={{ display: 'flex', gap: '8px' }}>
          {tab === 'events' && (
            <>
              <button 
                onClick={async () => {
                  const res = await fetch('/api/events/export?format=csv');
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `events-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                }} 
                className="btn btn-ghost"
                style={{ border: '1px solid var(--neu-dark)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </button>
              <label className="btn btn-ghost" style={{ border: '1px solid var(--neu-dark)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Import JSON
                <input 
                  type="file" 
                  accept=".json" 
                  style={{ display: 'none' }} 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      try {
                        const json = JSON.parse(event.target?.result as string);
                        const res = await fetch('/api/events/import', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ events: json })
                        });
                        const data = await res.json();
                        if (res.ok) {
                          alert(data.message);
                          loadData();
                        } else {
                          alert(`Import failed: ${data.error}\n${data.details?.join('\n') || ''}`);
                        }
                      } catch (err) {
                        alert('Invalid JSON file');
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {tab === 'faqs' && (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Reset to Master FAQs?',
                  message: 'This will replace all FAQ questions with the official master list of 20 questions.',
                  confirmLabel: 'Reset FAQs',
                  tone: 'danger',
                })
                if (!ok) return
                await fetch('/api/support/faq', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'RESET_DEFAULTS' }),
                })
                loadData()
              }}
              className="btn btn-secondary"
              style={{ borderRadius: '50px', fontSize: '12px', padding: '8px 16px' }}
            >
              Reset to Defaults
            </button>
          )}
          {tab === 'queries' && (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Reset to Master Queries?',
                  message: 'This will restore all default platform queries and SOPs to the official master list.',
                  confirmLabel: 'Reset Queries',
                  tone: 'danger',
                })
                if (!ok) return
                await fetch('/api/manage/queries', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'RESET_DEFAULTS' }),
                })
                loadData()
              }}
              className="btn btn-secondary"
              style={{ borderRadius: '50px', fontSize: '12px', padding: '8px 16px' }}
            >
              Reset to Defaults
            </button>
          )}
          {tab === 'courses' && userRole === 'MANAGER' && (
            <button
              type="button"
              onClick={() => setAcademicTermsModalOpen(true)}
              className="btn btn-secondary"
              style={{
                borderRadius: '50px',
                fontSize: '12px',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Academic Terms & Exam Cycles
            </button>
          )}
          {tab !== 'notifications' && ((tab === 'events' || tab === 'announcements' || tab === 'home-slides' || tab === 'faqs' || tab === 'queries') || userRole === 'MANAGER' || userRole === 'ADMIN') && (
            <button
              onClick={() => {
                if (tab === 'home-slides' && slides.length >= 10) {
                  alert('Maximum limit of 10 slides reached. Delete an existing slide first.')
                  return
                }
                if (tab === 'queries') {
                  openCreateQuery()
                  return
                }
                openCreate()
              }}
              className="btn btn-primary"
              style={{ ...(tab === 'home-slides' && slides.length >= 10 ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {tab === 'events' ? 'Add Event' : tab === 'home-slides' ? 'Add Banner Slide' : tab === 'faqs' ? 'Add FAQ' : tab === 'queries' ? 'Add Query' : 'Create New'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {!forcedTab && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--neu-dark)', paddingBottom: '0' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '500',
                color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: tab === t.key ? '2px solid #6366f1' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
              <span style={{
                marginLeft: '6px',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '600',
                background: tab === t.key ? 'var(--primary-light)' : '#d0d2d9',
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      )}



      {/* Items List */}
      {tab === 'home-slides' && homeContentSettings && (
        <div className="card" style={{ padding: '18px', marginBottom: '18px', display: 'grid', gap: '18px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Student Home Display Controls</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              These settings apply to the website, Capacitor app, and Flutter app.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Home Carousel</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Turn every home banner on or off.</div>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => updateHomeContentSettings({ homeCarouselEnabled: !homeContentSettings.homeCarouselEnabled })}
                  className="btn btn-sm"
                  style={{ background: homeContentSettings.homeCarouselEnabled ? '#16a34a' : 'var(--surface-2)', color: homeContentSettings.homeCarouselEnabled ? 'white' : 'var(--text-secondary)' }}
                >
                  {homeContentSettings.homeCarouselEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--surface)', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Promotional Splash</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Optional full-screen image after the logo loader.</div>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => updateHomeContentSettings({ promoSplashEnabled: !homeContentSettings.promoSplashEnabled })}
                  className="btn btn-sm"
                  style={{ background: homeContentSettings.promoSplashEnabled ? '#16a34a' : 'var(--surface-2)', color: homeContentSettings.promoSplashEnabled ? 'white' : 'var(--text-secondary)' }}
                >
                  {homeContentSettings.promoSplashEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  value={promoSplashDraft}
                  onChange={event => setPromoSplashDraft(event.target.value)}
                  placeholder="/splash-screen.png or uploaded image URL"
                  style={{ flex: '1 1 240px' }}
                />
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                  Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    hidden
                    onChange={async event => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      const uploadData = new FormData()
                      uploadData.append('file', file)
                      uploadData.append('type', 'announcements')
                      setSaving(true)
                      try {
                        const response = await fetch('/api/upload', { method: 'POST', body: uploadData })
                        const data = await response.json().catch(() => ({}))
                        if (!response.ok || !data.url) throw new Error(data.error || 'Upload failed')
                        setPromoSplashDraft(data.url)
                        await updateHomeContentSettings({ promoSplashImage: data.url })
                      } catch (error) {
                        alert(error instanceof Error ? error.message : 'Upload failed')
                      } finally {
                        setSaving(false)
                      }
                    }}
                  />
                </label>
                <button type="button" className="btn btn-primary btn-sm" disabled={saving || !promoSplashDraft.trim()} onClick={() => updateHomeContentSettings({ promoSplashImage: promoSplashDraft.trim() })}>
                  Save Image
                </button>
              </div>

              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Display time (milliseconds, 1000–10000)
                <input
                  type="number"
                  min={1000}
                  max={10000}
                  step={500}
                  className="form-input"
                  defaultValue={homeContentSettings.promoSplashDurationMs}
                  onBlur={event => updateHomeContentSettings({ promoSplashDurationMs: Number(event.target.value) })}
                  style={{ marginTop: '5px' }}
                />
              </label>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '7px' }}>Show when the user first visits any selected page</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {PROMO_SPLASH_PAGE_OPTIONS.map(option => {
                    const selected = selectedPromoPages.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          const next = selected
                            ? selectedPromoPages.filter((page: string) => page !== option.value)
                            : [...selectedPromoPages, option.value]
                          if (next.length === 0) {
                            alert('Select at least one page for the promotional splash.')
                            return
                          }
                          updateHomeContentSettings({ promoSplashTargetPages: next })
                        }}
                        className="btn btn-sm"
                        style={{
                          background: selected ? 'var(--primary)' : 'var(--surface-2)',
                          color: selected ? 'white' : 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {selected ? '✓ ' : ''}{option.label}
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '7px' }}>
                  Multiple selected pages are one shared campaign: the first eligible page claims the display.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(140px, 1fr)', gap: '10px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Frequency
                  <select
                    className="form-input"
                    value={homeContentSettings.promoSplashFrequency || 'ONCE'}
                    onChange={event => updateHomeContentSettings({ promoSplashFrequency: event.target.value })}
                    style={{ marginTop: '5px' }}
                  >
                    <option value="ONCE">Once per user</option>
                    <option value="RECURRING">Recurring</option>
                  </select>
                </label>
                {homeContentSettings.promoSplashFrequency === 'RECURRING' && (
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Repeat every (days)
                    <input
                      type="number"
                      min={1}
                      max={365}
                      className="form-input"
                      defaultValue={homeContentSettings.promoSplashIntervalDays || 1}
                      onBlur={event => updateHomeContentSettings({ promoSplashIntervalDays: Number(event.target.value) })}
                      style={{ marginTop: '5px' }}
                    />
                  </label>
                )}
              </div>

              <button
                type="button"
                disabled={saving}
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  const allowed = window.confirm('Show this promotional splash again to users who already saw it?')
                  if (allowed) await updateHomeContentSettings({ resetPromoSplashViews: true })
                }}
              >
                Reset Seen History
              </button>

              {promoSplashDraft && (
                <img src={promoSplashDraft} alt="Promotional splash preview" style={{ width: '120px', aspectRatio: '9 / 20', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border)' }} />
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Recommended: 1080 × 2400 px (9:20), PNG/JPG, under 2 MB.</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'notifications' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Custom scoped styles for premium UI */}
          <style dangerouslySetInnerHTML={{__html: `
            .notif-console-container {
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 28px;
              width: 100%;
              align-items: start;
            }
            @media (max-width: 1024px) {
              .notif-console-container {
                grid-template-columns: 1fr;
              }
            }
            .notif-glow-card {
              background: var(--surface);
              border: 1px solid rgba(226, 232, 240, 0.8);
              border-radius: 24px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
              padding: 28px;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              display: flex;
              flex-direction: column;
              gap: 20px;
            }
            .notif-glow-card:hover {
              box-shadow: 0 20px 40px rgba(99, 102, 241, 0.06);
              border-color: rgba(99, 102, 241, 0.2);
            }
            .section-title {
              font-size: 18px;
              font-weight: 800;
              color: var(--text-primary);
              display: flex;
              align-items: center;
              gap: 8px;
              margin: 0;
              padding-bottom: 12px;
              border-bottom: 1px solid var(--border);
            }
            .input-group {
              display: flex;
              flex-direction: column;
              gap: 6px;
              width: 100%;
            }
            .input-label {
              font-size: 12.5px;
              font-weight: 700;
              color: var(--text-secondary);
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .char-limit {
              font-size: 10.5px;
              font-weight: 500;
              color: var(--text-muted);
            }
            .premium-input {
              width: 100%;
              padding: 12px 16px;
              border-radius: 12px;
              border: 1.5px solid var(--border);
              background: var(--surface-2);
              font-size: 14px;
              color: var(--text-primary);
              transition: all 0.2s ease;
            }
            .premium-input:focus {
              outline: none;
              border-color: #6366f1;
              background: var(--surface);
              box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
            }
            .chip-container {
              display: flex;
              gap: 8px;
              flex-wrap: wrap;
              margin-top: 4px;
            }
            .category-chip {
              padding: 8px 16px;
              border-radius: 50px;
              font-size: 12.5px;
              font-weight: 700;
              cursor: pointer;
              transition: all 0.2s ease;
              border: 2px solid transparent;
            }
            .category-chip.active {
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            .phone-preview-card {
              border: 12px solid #202022;
              border-radius: 36px;
              background: linear-gradient(150deg, #1f1a3a 0%, #0d0b18 100%);
              padding: 16px;
              width: 100%;
              max-width: 290px;
              height: 480px;
              display: flex;
              flex-direction: column;
              position: relative;
              overflow: hidden;
              box-shadow: 0 20px 50px rgba(0,0,0,0.25);
              margin: 0 auto;
            }
            .phone-notch {
              width: 110px;
              height: 18px;
              background: #202022;
              border-radius: 0 0 14px 14px;
              position: absolute;
              top: 0;
              left: 50%;
              transform: translateX(-50%);
              z-index: 10;
            }
            .phone-status-bar {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              color: #a78bfa;
              margin-bottom: 24px;
              padding-top: 4px;
              font-weight: 600;
            }
            .push-notification-banner {
              width: 100%;
              background: rgba(255, 255, 255, 0.96);
              backdrop-filter: blur(20px);
              border-radius: 18px;
              padding: 12px;
              display: flex;
              flex-direction: column;
              gap: 6px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.4);
              animation: slideDown 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
              transform-origin: top center;
            }
            @keyframes slideDown {
              0% { transform: translateY(-40px) scale(0.95); opacity: 0; }
              100% { transform: translateY(0) scale(1); opacity: 1; }
            }
            .push-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .push-app-badge {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .push-logo {
              width: 16px;
              height: 16px;
              border-radius: 4px;
              background: #6366f1;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 9px;
              font-weight: 900;
            }
            .push-app-name {
              font-size: 10.5px;
              font-weight: 800;
              color: var(--text-primary);
            }
            .push-time {
              font-size: 9.5px;
              color: var(--text-muted);
            }
            .push-title {
              font-size: 12.5px;
              font-weight: 800;
              color: var(--text-primary);
              margin: 0;
            }
            .push-body {
              font-size: 10.5px;
              color: var(--text-secondary);
              line-height: 1.35;
              margin: 0;
            }
            .push-banner-img {
              width: 100%;
              height: 110px;
              background-size: cover;
              background-position: center;
              border-radius: 10px;
              margin-top: 4px;
              border: 1px solid rgba(0,0,0,0.05);
            }
            .push-cta-btn {
              width: 100%;
              padding: 8px;
              border-radius: 8px;
              background: var(--border);
              border: 1px solid var(--border);
              color: #6366f1;
              font-size: 11px;
              font-weight: 800;
              text-align: center;
              margin-top: 4px;
              transition: background 0.2s;
            }
            .metric-bar {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              width: 100%;
            }
            .metric-card {
              background: var(--surface);
              border: 1.5px solid var(--border);
              border-radius: 16px;
              padding: 16px;
              text-align: center;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.01), 0 2px 4px -1px rgba(0,0,0,0.01);
            }
            .metric-num {
              font-size: 20px;
              font-weight: 800;
              color: #6366f1;
              line-height: 1;
              margin-bottom: 4px;
            }
            .metric-label {
              font-size: 11px;
              font-weight: 700;
              color: var(--text-secondary);
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .history-item-card {
              background: var(--surface);
              border: 1px solid var(--border);
              border-radius: 18px;
              padding: 18px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.01);
              transition: all 0.2s ease;
              display: flex;
              flex-direction: column;
              gap: 12px;
            }
            .history-item-card:hover {
              transform: translateX(3px);
              box-shadow: 0 8px 20px rgba(99, 102, 241, 0.04);
              border-color: rgba(99, 102, 241, 0.1);
            }
          `}} />

          {/* Quick Metrics Bar */}
          <div className="metric-bar">
            <div className="metric-card">
              <div className="metric-num" style={{ color: 'var(--accent)' }}>{campaigns.filter(c => c.status === 'SENT').length}</div>
              <div className="metric-label">Delivered</div>
            </div>
            <div className="metric-card">
              <div className="metric-num" style={{ color: 'var(--warning)' }}>{campaigns.filter(c => c.status === 'PENDING').length}</div>
              <div className="metric-label">Scheduled</div>
            </div>
            <div className="metric-card">
              <div className="metric-num" style={{ color: 'var(--success)' }}>100%</div>
              <div className="metric-label">Channel Health</div>
            </div>
          </div>

          <div className="notif-console-container">
            {/* LEFT COLUMN: Sender Console */}
            <div className="notif-glow-card">
              <h3 className="section-title">
                <span style={{ fontSize: '20px' }}>🚀</span> Advanced Broadcast Console
              </h3>

              {/* Presets Select */}
              <div className="input-group">
                <label className="input-label" style={{ color: 'var(--accent)' }}>
                  <span>🎨 Quick Swiggy / Zomato Presets</span>
                  <span style={{ fontSize: '10px', background: 'var(--primary-light)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '5px' }}>Engage instantly</span>
                </label>
                <select
                  className="premium-input"
                  value={inlineNotif.presetStyle || ''}
                  onChange={e => {
                    const val = e.target.value
                    if (val === 'PROMO') {
                      setInlineNotif(p => ({
                        ...p,
                        presetStyle: val,
                        title: '🍔 Hungry for Success? 50% Off is Served!',
                        body: 'Satisfy your learning cravings. Get comprehensive lectures, IITian study notes, and masterclass blueprints for half-off. Limited portions remaining! ⚡',
                        ctaText: 'Claim 50% Deal 🎁',
                        ctaLink: '/courses/explore',
                        category: 'PROMOTIONAL',
                      }))
                    } else if (val === 'LIVE_NOW') {
                      setInlineNotif(p => ({
                        ...p,
                        presetStyle: val,
                        title: '🚨 Boom! IITian session starting in 2 minutes!',
                        body: 'The exam syllabus analysis, high-yield cheat sheets, and direct qualifier mock review is starting. Quick, tap to join the pro livestream room! 🎥',
                        ctaText: 'Enter Live Stream 📲',
                        ctaLink: '/live',
                        category: 'ALERT',
                      }))
                    } else if (val === 'NEW_MATERIAL') {
                      setInlineNotif(p => ({
                        ...p,
                        presetStyle: val,
                        title: '📚 Dropped: May Term solved blueprint notes!',
                        body: 'We just uploaded the handwritten formulas, solved practice sets, and last-year exam banks to supercharge your test scores. Score high! 🧠',
                        ctaText: 'Get Blueprint Notes 📂',
                        ctaLink: '/materials',
                        category: 'ACADEMIC',
                      }))
                    } else if (val === 'ALERT') {
                      setInlineNotif(p => ({
                        ...p,
                        presetStyle: val,
                        title: '⚠️ ATTENTION: Mock schedule overlap fixed!',
                        body: 'We adjusted the exam dates to prevent slot overlaps with qualifiers. Open to review the final schedule blueprint immediately to update your calendar. 🗓️',
                        ctaText: 'See New Schedule 📢',
                        ctaLink: '/announcements',
                        category: 'ALERT',
                      }))
                    } else {
                      setInlineNotif(p => ({ ...p, presetStyle: '' }))
                    }
                  }}
                  style={{ border: '2px dashed #6366f1', background: 'var(--surface-2)' }}
                >
                  <option value="">-- Choose High-Converting Preset --</option>
                  <option value="PROMO">🏷️ Promotional Deal / Offer (Zomato Style)</option>
                  <option value="LIVE_NOW">🚨 Live Class Alert (Instant Swiggy Style)</option>
                  <option value="NEW_MATERIAL">📚 Study Notes & PDF Release Alert</option>
                  <option value="ALERT">📢 High-Alert Syllabus Reschedule</option>
                </select>
              </div>

              {/* Category Badge Chips */}
              <div className="input-group">
                <label className="input-label">Category</label>
                <div className="chip-container">
                  {[
                    { key: 'PROMOTIONAL', label: '🏷️ Promo', bg: 'var(--danger-light)', text: 'var(--danger)', border: 'var(--border)' },
                    { key: 'ACADEMIC', label: '📚 Academic', bg: 'var(--primary-light)', text: '#3730a3', border: 'var(--border)' },
                    { key: 'ALERT', label: '🚨 System Alert', bg: 'var(--warning-light)', text: 'var(--warning)', border: 'var(--border)' },
                    { key: 'GENERAL', label: '📢 General Info', bg: 'var(--success-light)', text: '#065f46', border: '#a7f3d0' }
                  ].map(c => {
                    const isActive = inlineNotif.category === c.key
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setInlineNotif(p => ({ ...p, category: c.key }))}
                        className={`category-chip ${isActive ? 'active' : ''}`}
                        style={{
                          background: isActive ? c.bg : 'var(--surface)',
                          color: isActive ? c.text : 'var(--text-secondary)',
                          borderColor: isActive ? c.border : 'transparent',
                        }}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Campaign Title */}
              <div className="input-group">
                <div className="input-label">
                  <span>Campaign Title *</span>
                  <span className="char-limit">{inlineNotif.title.length}/50 chars</span>
                </div>
                <input
                  type="text"
                  className="premium-input"
                  value={inlineNotif.title}
                  onChange={e => {
                    if (e.target.value.length <= 50) {
                      setInlineNotif(p => ({ ...p, title: e.target.value }))
                    }
                  }}
                  placeholder="e.g. 🍔 Hungry for success? 50% Off is Served!"
                />
              </div>

              {/* Message Body */}
              <div className="input-group">
                <div className="input-label">
                  <span>Message Body *</span>
                  <span className="char-limit">{inlineNotif.body.length}/150 chars</span>
                </div>
                <textarea
                  className="premium-input"
                  rows={3}
                  value={inlineNotif.body}
                  onChange={e => {
                    if (e.target.value.length <= 150) {
                      setInlineNotif(p => ({ ...p, body: e.target.value }))
                    }
                  }}
                  placeholder="e.g. Satisfy your learning cravings. Get video courses for half-off..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Banner Image with Upload */}
              <div className="input-group">
                <label className="input-label">Banner Image Visual (Optional)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    className="premium-input"
                    value={inlineNotif.imageUrl}
                    onChange={e => setInlineNotif(p => ({ ...p, imageUrl: e.target.value }))}
                    placeholder="https://example.com/banner.png"
                    style={{ flex: 1 }}
                  />
                  <button type="button" onClick={() => { setRecentPhotosPage(1); fetchRecentPhotos(1); setShowRecentModal(true); }} className="btn btn-ghost" style={{ border: '1.5px solid #6366f1', color: 'var(--accent)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', background: 'var(--surface)' }}>
                    🕒 Choose from Recent
                  </button>
                  <label className="btn btn-ghost" style={{ border: '1.5px solid var(--neu-dark)', cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', padding: '10px 14px', fontSize: '13px', background: 'var(--surface)' }}>
                    {isUploadingImage ? 'Uploading...' : '📂 Upload Banner'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingImage}
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleNotificationImageUpload(file)
                      }}
                    />
                  </label>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0, lineHeight: '1.4' }}>
                  💡 <strong>Recommended:</strong> 2:1 or 16:9 aspect ratio (e.g. <code>1024x512 px</code> or <code>1200x675 px</code>) with main content centered. Compress under <code>80-100 KB</code> (WebP/JPG format) for fast loading.
                </p>
              </div>

              {/* CTA Configuration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">CTA Button Label</label>
                  <input
                    type="text"
                    className="premium-input"
                    value={inlineNotif.ctaText}
                    onChange={e => setInlineNotif(p => ({ ...p, ctaText: e.target.value }))}
                    placeholder="e.g. Claim 50% Off 🎁"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">CTA Link Destination</label>
                  <select
                    className="premium-input"
                    value={inlineNotif.ctaLink}
                    onChange={e => setInlineNotif(p => ({ ...p, ctaLink: e.target.value }))}
                  >
                    <option value="">-- Choose or Write Custom --</option>
                    <option value="/courses/explore">Explore Batches 🛍️</option>
                    <option value="/materials">Prep Materials / Handouts 📂</option>
                    <option value="/calendar">Events Schedule 🗓️</option>
                    <option value="/announcements">News & Updates 📢</option>
                    <option value="/profile">Student Profile 👤</option>
                  </select>
                </div>
              </div>

              {/* Optional Custom CTA Link Field */}
              <div className="input-group">
                <input
                  type="text"
                  className="premium-input"
                  value={inlineNotif.ctaLink}
                  onChange={e => setInlineNotif(p => ({ ...p, ctaLink: e.target.value }))}
                  placeholder="Or enter custom URL/route, e.g. /courses/clg123"
                />
              </div>

              {/* Target Audience */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">Audience Segment</label>
                  <select
                    className="premium-input"
                    value={inlineNotif.targetType}
                    onChange={e => setInlineNotif(p => ({ ...p, targetType: e.target.value as any, targetId: '' }))}
                  >
                    <option value="ALL">All Registered Students</option>
                    <option value="COURSE">Specific Course Batch</option>
                    <option value="BUNDLE">Specific Bundle Pack</option>
                  </select>
                </div>

                {inlineNotif.targetType === 'COURSE' && (
                  <div className="input-group">
                    <label className="input-label">Select Course Batch *</label>
                    <select
                      className="premium-input"
                      value={inlineNotif.targetId}
                      onChange={e => setInlineNotif(p => ({ ...p, targetId: e.target.value }))}
                    >
                      <option value="">-- Select Course --</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {inlineNotif.targetType === 'BUNDLE' && (
                  <div className="input-group">
                    <label className="input-label">Select Course Bundle *</label>
                    <select
                      className="premium-input"
                      value={inlineNotif.targetId}
                      onChange={e => setInlineNotif(p => ({ ...p, targetId: e.target.value }))}
                    >
                      <option value="">-- Select Bundle --</option>
                      {bundles.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Delivery Timing */}
              <div className="input-group">
                <label className="input-label">Broadcast Delivery Timing</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="inlineTiming"
                      checked={!inlineNotif.sendLater}
                      onChange={() => setInlineNotif(p => ({ ...p, sendLater: false }))}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    ⚡ Instant Broadcast
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="inlineTiming"
                      checked={inlineNotif.sendLater}
                      onChange={() => setInlineNotif(p => ({ ...p, sendLater: true, scheduledFor: new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16) }))}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    🗓️ Schedule for later (IST)
                  </label>
                </div>
              </div>

              {inlineNotif.sendLater && (
                <div className="input-group">
                  <label className="input-label">Scheduled Date & Time (Indian Standard Time)</label>
                  <input
                    type="datetime-local"
                    className="premium-input"
                    value={inlineNotif.scheduledFor}
                    onChange={e => setInlineNotif(p => ({ ...p, scheduledFor: e.target.value }))}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                    Campaign will broadcast automatically to target audience at the specified local time.
                  </p>
                </div>
              )}

              {/* Launch Broadcast Button */}
              <button
                type="button"
                onClick={handleSendCampaign}
                disabled={isSendingCampaign || isUploadingImage || !inlineNotif.title || !inlineNotif.body}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '800',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4F46E5 100%)',
                  border: 'none',
                  boxShadow: '0 8px 20px rgba(99,102,241,0.2)',
                  color: 'white',
                  cursor: (isSendingCampaign || isUploadingImage || !inlineNotif.title || !inlineNotif.body) ? 'not-allowed' : 'pointer',
                  opacity: (isSendingCampaign || isUploadingImage || !inlineNotif.title || !inlineNotif.body) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isSendingCampaign ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24" style={{ marginRight: '6px' }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Executing Broadcast...
                  </>
                ) : inlineNotif.sendLater ? (
                  '🗓️ Schedule Push Campaign'
                ) : (
                  '🚀 Broadcast Push Notification'
                )}
              </button>
            </div>

            {/* PREVIEW & HISTORY PANEL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Smartphone Real-time Preview */}
              <div className="notif-glow-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    📱 Push Notification Live Preview
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }}></span> Pushed Live
                  </span>
                </div>

                <div className="phone-preview-card">
                  <div className="phone-notch"></div>
                  <div className="phone-status-bar">
                    <span>09:41</span>
                    <span>🔋 100%</span>
                  </div>

                  <div className="push-notification-banner">
                    <div className="push-header">
                      <div className="push-app-badge">
                        <div className="push-logo" style={{
                          background: inlineNotif.category === 'ALERT' ? 'var(--warning)' : inlineNotif.category === 'ACADEMIC' ? '#1e1a3a' : 'var(--accent)'
                        }}>G</div>
                        <span className="push-app-name">GENz IITian</span>
                      </div>
                      <span className="push-time">now</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <h5 className="push-title">{inlineNotif.title || '⚡ IITian Live Batch starts today!'}</h5>
                      <p className="push-body">
                        {inlineNotif.body || "Get live classes, study materials, and tests designed by IITians. Tap to enroll instantly!"}
                      </p>
                    </div>

                    {inlineNotif.imageUrl && (
                      <div className="push-banner-img" style={{ backgroundImage: `url(${inlineNotif.imageUrl})` }}></div>
                    )}

                    {inlineNotif.ctaText && (
                      <div className="push-cta-btn">{inlineNotif.ctaText}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Broadcast History */}
              <div className="notif-glow-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                    📰 Broadcast Logs & Audit
                  </h3>
                  <span style={{ fontSize: '11px', background: 'var(--surface)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                    Total: {campaigns.length}
                  </span>
                </div>

                {/* Filters Row */}
                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  <input
                    type="text"
                    className="premium-input"
                    value={notifSearch}
                    onChange={e => setNotifSearch(e.target.value)}
                    placeholder="Search logs..."
                    style={{ flex: 1, padding: '8px 12px', fontSize: '13px', borderRadius: '8px' }}
                  />
                  <select
                    className="premium-input"
                    value={notifStatusFilter}
                    onChange={e => setNotifStatusFilter(e.target.value as any)}
                    style={{ width: '120px', padding: '8px 12px', fontSize: '13px', borderRadius: '8px' }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="SENT">Delivered</option>
                    <option value="PENDING">Scheduled</option>
                  </select>
                </div>

                {/* History List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                  {campaigns
                    .filter(c => {
                      const matchesSearch = c.title.toLowerCase().includes(notifSearch.toLowerCase()) || c.body.toLowerCase().includes(notifSearch.toLowerCase())
                      const matchesStatus = notifStatusFilter === 'ALL' || c.status === notifStatusFilter
                      return matchesSearch && matchesStatus
                    })
                    .map((item: any) => {
                      const isSent = item.status === 'SENT'
                      const isPending = item.status === 'PENDING'
                      return (
                        <div key={item.id} className="history-item-card" style={{
                          borderLeft: `5px solid ${isSent ? 'var(--success)' : isPending ? 'var(--warning)' : 'var(--danger)'}`,
                          background: isPending ? 'var(--warning-light)' : 'var(--surface)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '900',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                background: isSent ? 'var(--success-light)' : isPending ? 'var(--warning-light)' : 'var(--danger-light)',
                                color: isSent ? '#065f46' : isPending ? 'var(--warning)' : 'var(--danger)',
                                textTransform: 'uppercase'
                              }}>
                                {item.status}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                                Target: {item.targetType}
                              </span>
                            </div>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {item.id.slice(0, 8)}...
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                                {item.title}
                              </h4>
                              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: '1.4', margin: '4px 0 0 0' }}>
                                {item.body}
                              </p>
                              {item.ctaText && (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '6px' }}>
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--accent)', background: 'var(--primary-light)', padding: '2px 6px', borderRadius: '4px' }}>
                                    CTA: {item.ctaText}
                                  </span>
                                  {item.ctaLink && (
                                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                      → {item.ctaLink}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {item.imageUrl && (
                              <div style={{
                                width: '70px',
                                height: '44px',
                                backgroundSize: 'cover',
                                backgroundImage: `url(${item.imageUrl})`,
                                backgroundPosition: 'center',
                                borderRadius: '6px',
                                flexShrink: 0
                              }}></div>
                            )}
                          </div>

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            borderTop: '1px solid #f8fafc',
                            paddingTop: '6px',
                            marginTop: '2px'
                          }}>
                            <div>Sender: <strong>{item.createdBy?.name || 'Manager'}</strong></div>
                            <div>
                              {isSent && item.sentAt && `${new Date(item.sentAt).toLocaleString('en-IN', { hour12: true })}`}
                              {isPending && item.scheduledFor && `Sched: ${new Date(item.scheduledFor).toLocaleString('en-IN', { hour12: true })}`}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  {campaigns.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No sent notifications in log history.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : tab === 'queries' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Banner / Card */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid var(--border)',
            boxShadow: '4px 4px 12px var(--neu-dark), -4px -4px 12px var(--neu-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: 'var(--primary-light)', color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    💡
                  </span>
                  Platform Queries & System Knowledge Base
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Internal single-source-of-truth for managers: course expiry behavior, app vs web functionality, batches, exams, and platform rules.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Reset to Master Queries?',
                      message: 'This will restore all default platform queries and SOPs to the official master list.',
                      confirmLabel: 'Reset Queries',
                      tone: 'danger',
                    })
                    if (!ok) return
                    await fetch('/api/manage/queries', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'RESET_DEFAULTS' }),
                    })
                    loadData()
                  }}
                  className="btn btn-secondary"
                  style={{ borderRadius: '50px', fontSize: '12.5px', padding: '8px 16px', fontWeight: '700' }}
                >
                  🔄 Reset Defaults
                </button>
                <button
                  onClick={openCreateQuery}
                  className="btn btn-primary"
                  style={{ borderRadius: '50px', fontSize: '12.5px', padding: '8px 18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Query
                </button>
              </div>
            </div>

            {/* Search Input Bar */}
            <div style={{ position: 'relative', width: '100%' }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={querySearch}
                onChange={e => setQuerySearch(e.target.value)}
                placeholder="Search queries by keyword, topic, expiry, app, web, exam, tokens..."
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 46px',
                  borderRadius: '16px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: '600',
                  outline: 'none',
                  boxShadow: 'inset 2px 2px 5px var(--neu-dark), inset -2px -2px 5px var(--neu-light)',
                }}
              />
              {querySearch && (
                <button
                  onClick={() => setQuerySearch('')}
                  style={{
                    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '16px', fontWeight: 'bold', padding: '4px'
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Platform Filter Pills & Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>Platform:</span>
                {[
                  { id: 'ALL', label: 'All Platforms' },
                  { id: 'BOTH', label: '📱+💻 Both (App & Web)' },
                  { id: 'APP_ONLY', label: '📱 App Only' },
                  { id: 'WEB_ONLY', label: '💻 Web Only' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setQueryPlatformFilter(p.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      border: 'none',
                      background: queryPlatformFilter === p.id ? 'var(--primary)' : 'var(--surface-2)',
                      color: queryPlatformFilter === p.id ? '#ffffff' : 'var(--text-secondary)',
                      boxShadow: queryPlatformFilter === p.id
                        ? '0 2px 8px rgba(99, 102, 241, 0.3)'
                        : '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                Showing {queries.filter(q => {
                  const s = querySearch.trim().toLowerCase()
                  const matchesSearch = !s || q.question.toLowerCase().includes(s) || q.answer.toLowerCase().includes(s) || q.category.toLowerCase().includes(s) || (q.appliesTo && q.appliesTo.toLowerCase().includes(s))
                  const matchesCat = queryCategoryFilter === 'ALL' || q.category === queryCategoryFilter
                  const matchesPlatform = queryPlatformFilter === 'ALL' || q.appliesTo === queryPlatformFilter
                  return matchesSearch && matchesCat && matchesPlatform
                }).length} of {queries.length} queries
              </div>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              <button
                onClick={() => setQueryCategoryFilter('ALL')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: 'none',
                  background: queryCategoryFilter === 'ALL' ? 'var(--accent)' : 'var(--surface-2)',
                  color: queryCategoryFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: queryCategoryFilter === 'ALL'
                    ? '0 2px 8px rgba(99, 102, 241, 0.3)'
                    : '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)',
                  transition: 'all 0.15s ease',
                }}
              >
                All Categories ({queries.length})
              </button>
              {QUERY_CATEGORIES.map(cat => {
                const count = queries.filter(q => q.category === cat.id).length
                const active = queryCategoryFilter === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setQueryCategoryFilter(cat.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      border: 'none',
                      background: active ? 'var(--accent)' : 'var(--surface-2)',
                      color: active ? '#ffffff' : 'var(--text-secondary)',
                      boxShadow: active
                        ? '0 2px 8px rgba(99, 102, 241, 0.3)'
                        : '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {cat.label} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Queries List */}
          {loadingQueries ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading platform queries…
            </div>
          ) : (() => {
            const filteredQueries = queries.filter(q => {
              const s = querySearch.trim().toLowerCase()
              const matchesSearch = !s || q.question.toLowerCase().includes(s) || q.answer.toLowerCase().includes(s) || q.category.toLowerCase().includes(s) || (q.appliesTo && q.appliesTo.toLowerCase().includes(s))
              const matchesCat = queryCategoryFilter === 'ALL' || q.category === queryCategoryFilter
              const matchesPlatform = queryPlatformFilter === 'ALL' || q.appliesTo === queryPlatformFilter
              return matchesSearch && matchesCat && matchesPlatform
            })

            if (filteredQueries.length === 0) {
              return (
                <div style={{
                  background: 'var(--surface)',
                  borderRadius: '24px',
                  padding: '50px 20px',
                  textAlign: 'center',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                    No matching platform queries found
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px 0' }}>
                    Try searching for something else or reset your active filters.
                  </p>
                  <button
                    onClick={() => { setQuerySearch(''); setQueryCategoryFilter('ALL'); setQueryPlatformFilter('ALL') }}
                    className="btn btn-secondary"
                    style={{ borderRadius: '50px', fontSize: '12px', padding: '8px 20px' }}
                  >
                    Clear Filters
                  </button>
                </div>
              )
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredQueries.map((q, index) => {
                  const isExpanded = expandedQueryId === q.id || (querySearch.trim().length > 0)
                  const categoryObj = QUERY_CATEGORIES.find(c => c.id === q.category)
                  const catLabel = categoryObj?.label || q.category
                  const platformBadge =
                    q.appliesTo === 'APP_ONLY' ? { label: '📱 App Only', bg: '#f59e0b18', color: '#d97706', border: '#f59e0b40' } :
                    q.appliesTo === 'WEB_ONLY' ? { label: '💻 Web Only', bg: '#0ea5e918', color: '#0284c7', border: '#0ea5e940' } :
                    { label: '📱+💻 Both', bg: '#10b98118', color: '#059669', border: '#10b98140' }

                  return (
                    <div
                      key={q.id}
                      style={{
                        background: 'var(--surface-2)',
                        borderRadius: '18px',
                        border: '1px solid var(--border)',
                        boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Header Row */}
                      <div
                        onClick={() => setExpandedQueryId(expandedQueryId === q.id ? null : q.id)}
                        style={{
                          padding: '16px 20px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '14px',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                          <span style={{
                            width: '28px', height: '28px', borderRadius: '8px',
                            background: 'var(--surface)', color: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: '800', flexShrink: 0,
                            boxShadow: '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)'
                          }}>
                            Q{index + 1}
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                              <span style={{
                                fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                                background: 'var(--primary-light)', color: 'var(--accent)',
                              }}>
                                {catLabel}
                              </span>
                              <span style={{
                                fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                                background: platformBadge.bg, color: platformBadge.color, border: `1px solid ${platformBadge.border}`
                              }}>
                                {platformBadge.label}
                              </span>
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                              {q.question}
                            </div>
                          </div>
                        </div>

                        {/* Controls on right */}
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                        >
                          <button
                            onClick={() => copyQueryAnswer(q.id, q.answer)}
                            className="btn btn-ghost btn-sm"
                            style={{
                              padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700',
                              color: copiedQueryId === q.id ? 'var(--success)' : 'var(--text-secondary)',
                              background: copiedQueryId === q.id ? 'var(--success-light)' : 'var(--surface)',
                              border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                            title="Copy answer to clipboard"
                          >
                            {copiedQueryId === q.id ? (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                                Copy
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => openEditQuery(q)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px 8px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}
                            title="Edit query"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleDeleteQuery(q.id, q.question)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px 8px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--danger)' }}
                            title="Delete query"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>

                          <button
                            onClick={() => setExpandedQueryId(expandedQueryId === q.id ? null : q.id)}
                            style={{
                              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                              padding: '4px', display: 'flex', alignItems: 'center'
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              style={{
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease'
                              }}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Answer Accordion Body */}
                      {isExpanded && (
                        <div style={{
                          padding: '18px 22px 22px 22px',
                          borderTop: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text-primary)',
                          fontSize: '13.5px',
                          lineHeight: '1.75',
                          whiteSpace: 'pre-line',
                        }}>
                          {q.answer}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : getItems().length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No {tab} yet. Click &quot;Create New&quot; to add one.
            </div>
          ) : (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tab === 'home-slides' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
                {slides.map((item: any, idx: number) => {
                  return (
                    <div key={item.id} style={{
                      display: 'flex', gap: '16px', padding: '16px', borderRadius: '16px', background: 'var(--surface)', alignItems: 'center', boxShadow: '2px 2px 5px rgba(0,0,0,0.03)'
                    }}>
                      <div 
                        onClick={() => {
                          if (item.image) {
                            window.open(item.image, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        title="Click to view full size"
                        style={{
                          width: '120px', aspectRatio: '16/9', borderRadius: '10px', background: 'var(--surface-2)', backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0, cursor: 'pointer'
                        }}
                      ></div>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Alt: {item.alt || 'No alt description'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          CTA Redirect: <a href={item.href} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{item.href}</a>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Display order position: <strong style={{ color: 'var(--text-primary)' }}>{idx + 1}</strong>
                        </div>
                        <div style={{ fontSize: '10px', color: item.isActive === false ? 'var(--danger)' : '#16a34a', marginTop: '4px', fontWeight: 800 }}>
                          {item.isActive === false ? 'Hidden' : 'Active'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={async () => {
                            setSaving(true)
                            try {
                              const res = await fetch(`/api/admin/home-slides/${item.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isActive: item.isActive === false }),
                              })
                              if (!res.ok) throw new Error('Failed to update slide')
                              await loadData()
                            } catch (error) {
                              alert(error instanceof Error ? error.message : 'Failed to update slide')
                            } finally {
                              setSaving(false)
                            }
                          }}
                          className="btn btn-sm"
                          style={{ background: item.isActive === false ? 'var(--surface-2)' : '#16a34a', color: item.isActive === false ? 'var(--text-secondary)' : 'white' }}
                          title="Show or hide this slide"
                        >
                          {item.isActive === false ? 'OFF' : 'ON'}
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button
                            disabled={idx === 0 || saving}
                            onClick={async () => {
                              try {
                                setSaving(true);
                                const updated = [...slides];
                                const temp = updated[idx].order;
                                updated[idx].order = updated[idx - 1].order;
                                updated[idx - 1].order = temp;
                                
                                const res = await fetch('/api/admin/home-slides', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ slides: updated })
                                });
                                if (res.ok) loadData();
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setSaving(false);
                              }
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px', fontSize: '10px', height: '22px' }}
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            disabled={idx === slides.length - 1 || saving}
                            onClick={async () => {
                              try {
                                setSaving(true);
                                const updated = [...slides];
                                const temp = updated[idx].order;
                                updated[idx].order = updated[idx + 1].order;
                                updated[idx + 1].order = temp;
                                
                                const res = await fetch('/api/admin/home-slides', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ slides: updated })
                                });
                                if (res.ok) loadData();
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setSaving(false);
                              }
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px', fontSize: '10px', height: '22px' }}
                            title="Move Down"
                          >
                            ▼
                          </button>
                        </div>

                         <button
                          type="button"
                          onClick={() => {
                            if (item.image) {
                              window.open(item.image, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '6px', color: 'var(--accent)' }}
                          title="Preview Image"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                        <button onClick={() => openEdit(item)} className="btn btn-ghost btn-sm" style={{ padding: '6px' }} title="Edit">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(item.id, item)} className="btn btn-ghost btn-sm" style={{ padding: '6px', color: 'var(--danger)' }} title="Delete">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <>
                {tab === 'courses' && (
                  <div style={{
                    background: 'var(--primary)',
                    borderRadius: '16px',
                    padding: '20px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    boxShadow: '0 8px 16px rgba(54,54,232,0.15)'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Mapping</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px' }}>LMS-COURSE-global</div>
                      <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>Assign this ID to events for global visibility (all students).</div>
                    </div>
                    <button 
                      onClick={() => { navigator.clipboard.writeText('LMS-COURSE-global'); setCopiedId('global'); setTimeout(() => setCopiedId(null), 2000) }}
                      className="btn btn-sm"
                      style={{ background: 'var(--surface)', color: 'var(--primary)', fontWeight: '800', border: 'none', borderRadius: '50px', padding: '8px 16px' }}
                    >
                      {copiedId === 'global' ? 'Copied!' : 'Copy ID'}
                    </button>
                  </div>
                )}
                {getItems().map((item, idx) => {
              const rawDetail = item.description || item.content || item.duration || item.answer || ''
              const itemDetail = rawDetail.length > 72 ? rawDetail.slice(0, 69) + '…' : rawDetail

              // For content items course lives in item.topic.course
              const isContent = tab === 'lectures' || tab === 'materials'
              const itemCourseName = isContent ? item.topic?.course?.name : item.course?.name
              const showCourseName = tab !== 'announcements' && tab !== 'courses' && tab !== 'faqs' && itemCourseName

              // Build subtitle: CourseName › TopicName · description
              const subtitleParts: string[] = []
              if (showCourseName) subtitleParts.push(itemCourseName)
              if (isContent && item.topic?.title) subtitleParts.push(item.topic.title)
              if (tab === 'courses' && item.subject) subtitleParts.push(item.subject)
              if (itemDetail) subtitleParts.push(itemDetail)
              const subtitle = subtitleParts.join(' › ')

              const iconLabel =
                tab === 'courses'       ? item.name?.slice(0, 2).toUpperCase() :
                tab === 'offerings'     ? 'OFF' :
                tab === 'bundles'       ? 'BG' :
                tab === 'events'        ? '▶' :
                tab === 'announcements' ? '!' :
                tab === 'faqs'          ? '?' :
                tab === 'materials'     ? (item.fileType || 'DOC').slice(0, 3).toUpperCase() :
                String(idx + 1).padStart(2, '0')

              return (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 16px',
                  borderRadius: '50px',
                  background: 'var(--surface-2)',
                  boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                  transition: 'box-shadow 0.2s',
                  width: '100%',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)')}
                >
                  {/* Icon badge */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--surface-2)',
                    boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)', fontSize: '13px', fontWeight: '700',
                  }}>
                    {iconLabel}
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name || item.title || item.question}
                    </div>
                    {tab === 'courses' && (
                      <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--accent)', marginTop: '0px', fontWeight: '700', opacity: 0.7 }}>
                        ID: {item.id}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {subtitle}
                    </div>
                  </div>

                  {/* Details badge */}
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {tab === 'courses' && (
                      <>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>{item._count?.lectures || 0}L</span>
                        {item.isDemo && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '8px', background: 'var(--primary)', color: 'white', fontWeight: '900', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>DEMO</span>}
                        {item.isFree && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '8px', background: 'var(--success)', color: 'white', fontWeight: '900', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>FREE</span>}
                        {item.isExpired && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '8px', background: 'var(--warning-light)', color: 'var(--warning)', fontWeight: '900', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>EXP</span>}
                        {item.isEffectivelyDisabled && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '8px', background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: '900', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>DIS</span>}
                      </>
                    )}
                    {tab === 'offerings' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {item.hasRecorded && (
                          <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--accent)', fontWeight: '900', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                            REC: ₹{item.recordedDiscountPrice}
                          </span>
                        )}
                        {item.hasLive && (
                          <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '900', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                            LIVE: ₹{item.liveDiscountPrice}
                          </span>
                        )}
                      </div>
                    )}
                    {tab === 'bundles' && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--accent)', fontWeight: '700' }}>
                        {item._count?.courses || item.courses?.length || 0} courses
                      </span>
                    )}
                    {tab === 'events' && (
                      <>
                        {item.isGlobal && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--primary)', color: 'white', fontWeight: '900', letterSpacing: '0.05em', marginRight: '6px' }}>GLOBAL</span>}
                        <span className={`badge badge-${item.status === 'live' ? 'danger' : item.status === 'CANCELLED' ? 'warning' : item.status === 'RESCHEDULED' ? 'info' : 'success'}`}>
                          {item.status}
                        </span>
                      </>
                    )}
                    {tab === 'lectures' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {(item.videoUrl || item.youtubeUrl) && (
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--accent)', fontWeight: '600' }}>Video</span>
                        )}
                        {item.pptUrl && (
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--success-light)', color: 'var(--success)', fontWeight: '600' }}>File</span>
                        )}
                      </div>
                    )}
                    {tab === 'materials' && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--success-light)', color: 'var(--success)', fontWeight: '600' }}>Study Material</span>
                    )}
                    {tab === 'announcements' && (
                      <span className={`badge badge-${item.type === 'warning' ? 'warning' : item.type === 'success' ? 'success' : 'info'}`}>
                        {item.type}
                      </span>
                    )}
                    {tab === 'faqs' && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--accent)', fontWeight: '700' }}>
                        #{item.order ?? 0}
                      </span>
                    )}
                  </div>

                   {(userRole === 'MANAGER' || (tab !== 'courses' && tab !== 'lectures' && tab !== 'materials')) && (
                     <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {tab === 'courses' && !item.isDisabled && (
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(item.id);
                            setCopiedId(item.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }} 
                          className="btn btn-ghost btn-sm" 
                          title={`Copy ID: ${item.id}`}
                          style={{ ... (copiedId === item.id ? { color: 'var(--success)', borderColor: 'var(--success)' } : {}), padding: '6px' }}
                        >
                          {copiedId === item.id ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                          )}
                        </button>
                      )}
                       {tab === 'courses' && (item.isDisabled || item.isExpired) && (
                         <button
                           onClick={() => toggleCourseDisabled(item)}
                           className="btn btn-ghost btn-sm"
                           style={{
                             color: 'var(--danger)',
                             border: '1px solid var(--danger-light)',
                             padding: '6px 12px',
                             fontSize: '11px',
                             fontWeight: '700',
                             cursor: 'pointer',
                             borderRadius: '20px',
                             display: 'flex',
                             alignItems: 'center',
                             gap: '4px'
                           }}
                           title="Turn Course ON"
                         >
                           <span style={{
                             width: '8px',
                             height: '8px',
                             borderRadius: '50%',
                             background: 'var(--danger)',
                             display: 'inline-block'
                           }} />
                           OFF
                         </button>
                       )}
                       {tab === 'courses' && (
                         <button
                           onClick={() => handleDuplicate(item)}
                           disabled={saving}
                           className="btn btn-ghost btn-sm"
                           style={{
                             color: 'var(--info)',
                             border: '1px solid #cffafe',
                             padding: '6px',
                             cursor: 'pointer',
                             opacity: 1
                           }}
                           title="Duplicate"
                         >
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                             <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><path d="M3 4h2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4h2"/><path d="M9 9h6v6H9z"/>
                           </svg>
                         </button>
                       )}
                       {tab === 'courses' && !item.isDemo && (
                         <button
                           onClick={() => setClearEnrollmentsCourse({ id: item.id, name: item.name })}
                           className="btn btn-ghost btn-sm"
                           style={{
                             color: 'var(--danger)',
                             border: '1px solid var(--danger-light)',
                             padding: '6px',
                             cursor: 'pointer',
                           }}
                           title="Remove all enrolled students (for course reuse)"
                         >
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                             <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                             <circle cx="9" cy="7" r="4"/>
                             <line x1="23" y1="11" x2="17" y2="11"/>
                           </svg>
                         </button>
                       )}
                       <button 
                         onClick={() => openEdit(item)} 
                         className="btn btn-ghost btn-sm" 
                         style={{ 
                           padding: '6px', 
                           cursor: 'pointer',
                           opacity: 1 
                         }} 
                         title="Edit"
                       >
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                           <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                           <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                         </svg>
                       </button>
                        <button 
                          onClick={() => handleDelete(item.id, item)} 
                         disabled={item.isDemo}
                         title={item.isDemo ? "Cannot delete system demo course" : "Delete course"}
                         className="btn btn-sm" 
                         style={{ 
                           color: item.isDemo ? 'var(--border)' : 'var(--danger)', 
                           border: `1px solid ${item.isDemo ? 'var(--surface-2)' : 'var(--danger-light)'}`, 
                           cursor: item.isDemo ? 'not-allowed' : 'pointer',
                           opacity: item.isDemo ? 0.4 : 1
                         }}
                       >
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                           <polyline points="3 6 5 6 21 6"/>
                           <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                         </svg>
                       </button>
                     </div>
                    )}
                </div>
              )
            })}
              </>
            )}
          </div>
        )}
      </div>
    )}

      {/* Recently Used Photos Modal */}
      {showRecentModal && (
        <div className="modal-overlay" style={{ zIndex: 10001, backdropFilter: 'blur(8px)', background: 'rgba(15,23,42,0.6)' }} onClick={() => setShowRecentModal(false)}>
          <div
            style={{
              maxWidth: '560px', width: '92%', borderRadius: '24px', overflow: 'hidden',
              background: 'var(--surface)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              animation: 'bounceIn 0.3s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              padding: '24px 28px', position: 'relative', flexShrink: 0,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>
                🕒 Choose from Recent Photos
              </h3>
              <button onClick={() => setShowRecentModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: 'var(--surface)' }}>
              {recentPhotosLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Loading recent photos…</span>
                </div>
              ) : recentPhotos.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', gap: '8px', border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '20px' }}>
                  <span style={{ fontSize: '32px' }}>📷</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '700' }}>No recently uploaded photos</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Upload a new photo to get started.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                  {recentPhotos.map((url, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setInlineNotif(p => ({ ...p, imageUrl: url }))
                        setShowRecentModal(false)
                      }}
                      style={{
                        position: 'relative',
                        aspectRatio: '16/9',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s ease',
                        background: 'var(--surface-2)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.borderColor = 'var(--accent)'
                        e.currentTarget.style.boxShadow = '0 10px 15px rgba(99, 102, 241, 0.15)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.borderColor = 'transparent'
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)'
                      }}
                    >
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                Page {recentPhotosPage}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={recentPhotosPage === 1 || recentPhotosLoading}
                  onClick={() => {
                    const prevPage = recentPhotosPage - 1
                    setRecentPhotosPage(prevPage)
                    fetchRecentPhotos(prevPage)
                  }}
                  className="btn btn-sm"
                  style={{
                    background: recentPhotosPage === 1 ? 'var(--surface)' : 'var(--surface-2)',
                    color: recentPhotosPage === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    border: '1px solid #cbd5e1',
                    cursor: recentPhotosPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px'
                  }}
                >
                  ◀ Previous 10
                </button>
                <button
                  type="button"
                  disabled={!recentPhotosHasNext || recentPhotosLoading}
                  onClick={() => {
                    const nextPage = recentPhotosPage + 1
                    setRecentPhotosPage(nextPage)
                    fetchRecentPhotos(nextPage)
                  }}
                  className="btn btn-sm"
                  style={{
                    background: !recentPhotosHasNext ? 'var(--surface)' : 'var(--surface-2)',
                    color: !recentPhotosHasNext ? 'var(--text-muted)' : 'var(--text-secondary)',
                    border: '1px solid #cbd5e1',
                    cursor: !recentPhotosHasNext ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px'
                  }}
                >
                  Next 10 ▶
                </button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            style={{
              ...(tab === 'notifications' ? { maxWidth: '780px', width: '92%' } : {}),
              ...(tab === 'courses' ? {
                maxWidth: 'min(1120px, calc(100vw - 48px))',
                width: '96%',
                borderRadius: '18px',
                maxHeight: '92vh',
              } : {}),
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="modal-header"
              style={tab === 'courses' ? { padding: '22px 32px 18px' } : undefined}
            >
              <h3 style={{ fontSize: tab === 'courses' ? '18px' : '16px', fontWeight: '600', letterSpacing: '-0.01em' }}>
                {editId ? 'Edit' : 'Create'} {tab === 'faqs' ? 'FAQ' : tab.slice(0, -1).charAt(0).toUpperCase() + tab.slice(1, -1)}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div
              className="modal-body"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tab === 'courses' ? '0' : '14px',
                ...(tab === 'courses' ? { padding: '8px 32px 28px' } : {}),
              }}
            >
              {renderForm()}
            </div>
            <div
              className="modal-footer"
              style={tab === 'courses' ? { padding: '16px 32px 22px' } : undefined}
            >
              <button onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving…' : (editId ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showModal && tab === 'courses' && courseIconPickerOpen && (
        <CourseIconTypeModal
          value={formData.courseIconType || formData.icon}
          onClose={() => setCourseIconPickerOpen(false)}
          onSelect={(type) => {
            setFormData(prev => ({ ...prev, courseIconType: type, icon: prev.icon || 'BookOpen' }))
            setCourseIconPickerOpen(false)
          }}
        />
      )}

      {/* Dedicated Query Modal */}
      {queryModalOpen && (
        <div className="modal-overlay" onClick={() => setQueryModalOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: '640px', width: '92%', borderRadius: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {editingQuery ? 'Edit Platform Query' : 'Add Platform Query'}
              </h3>
              <button
                onClick={() => setQueryModalOpen(false)}
                style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Question *</label>
                <input
                  type="text"
                  className="form-input"
                  value={queryFormData.question}
                  onChange={e => setQueryFormData(p => ({ ...p, question: e.target.value }))}
                  placeholder="e.g., What happens after a course expires?"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-input"
                    value={queryFormData.category}
                    onChange={e => setQueryFormData(p => ({ ...p, category: e.target.value as any }))}
                  >
                    {QUERY_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Applies To *</label>
                  <select
                    className="form-input"
                    value={queryFormData.appliesTo}
                    onChange={e => setQueryFormData(p => ({ ...p, appliesTo: e.target.value as any }))}
                  >
                    <option value="BOTH">📱+💻 Both (App & Web)</option>
                    <option value="APP_ONLY">📱 App Only</option>
                    <option value="WEB_ONLY">💻 Web Only</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Answer *</label>
                <textarea
                  className="form-input"
                  rows={8}
                  value={queryFormData.answer}
                  onChange={e => setQueryFormData(p => ({ ...p, answer: e.target.value }))}
                  placeholder="Explain step-by-step how the system behaves, student visibility, limitations, etc..."
                  style={{ resize: 'vertical', lineHeight: '1.6' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Display Order</label>
                <input
                  type="number"
                  className="form-input"
                  value={queryFormData.order}
                  onChange={e => setQueryFormData(p => ({ ...p, order: Number(e.target.value) || 0 }))}
                  style={{ maxWidth: '140px' }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setQueryModalOpen(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuery}
                disabled={querySaving}
                className="btn btn-primary"
                style={{ borderRadius: '50px', padding: '10px 24px', fontWeight: '800' }}
              >
                {querySaving ? 'Saving...' : editingQuery ? 'Update Query' : 'Create Query'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}

function CourseIconTypeModal({
  value,
  onClose,
  onSelect,
}: {
  value?: string | null
  onClose: () => void
  onSelect: (type: CourseIconType) => void
}) {
  const [query, setQuery] = useState('')
  const selectedType = normalizeCourseIconType(value)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredOptions = COURSE_ICON_OPTIONS.filter(option =>
    !normalizedQuery ||
    option.label.toLowerCase().includes(normalizedQuery) ||
    option.type.replace(/_/g, ' ').includes(normalizedQuery)
  )

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 1200 }}
    >
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(760px, 94vw)',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
        }}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
              Course Icon Type
            </h3>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', margin: '3px 0 0' }}>
              Pick one shared icon style for website and app.
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          <input
            className="form-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search icons..."
            autoFocus
            style={{ width: '100%' }}
          />
        </div>
        <div
          style={{
            padding: '16px 20px 20px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
            gap: '10px',
          }}
        >
          {filteredOptions.map(option => {
            const selected = option.type === selectedType
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => onSelect(option.type)}
                style={{
                  minHeight: '112px',
                  borderRadius: '16px',
                  border: selected
                    ? '2px solid var(--course-icon-selected-border)'
                    : '1px solid color-mix(in srgb, var(--border) 82%, transparent)',
                  background: selected
                    ? 'var(--course-icon-selected-bg)'
                    : 'color-mix(in srgb, var(--surface) 82%, var(--surface-2) 18%)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: selected ? '0 10px 22px rgba(79, 70, 229, 0.14)' : 'none',
                }}
              >
                <CourseIconBadge type={option.type} size={46} iconSize={23} radius={14} />
                <span style={{ fontSize: '12px', fontWeight: 800, lineHeight: 1.25, textAlign: 'center' }}>
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ManagePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--accent)' }}>
        <div className="animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    }>
      <ManagePageInner />
    </Suspense>
  )
}
