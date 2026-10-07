'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import ManagerUserModal from '@/components/ManagerUserModal'
import SwipeableMessage from './SwipeableMessage'
import { colorWithOpacity } from '@/lib/color-utils'
import { CourseIconBadge } from '@/lib/course-icons'
import Script from 'next/script'
import UserAvatar from '@/components/UserAvatar'
import CommunityAttachment from '@/components/CommunityAttachment'
import { describeCommunityAttachment } from '@/lib/community-attachment'
import SocialCardModal from '@/components/SocialCardModal'
import StaffRoleBadge, { getStaffRoleLabel } from '@/components/StaffRoleBadge'
import { Sparkles, UserRound } from 'lucide-react'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

interface ClassItem {
  id: string
  name: string
  color: string
  subject?: string
  icon?: string
  courseIconType?: string | null
  isCommunityActive?: boolean
  isDisabled?: boolean
  isExpired?: boolean
  expiresAt?: string | null
  hasUnread?: boolean
  isDirectChat?: boolean
  isDmDisabled?: boolean
  _count?: { lectures: number }
  role?: string
  avatar?: string | null
  gender?: string | null
  participantId?: string | null
  isMuted?: boolean
}

interface CommMsg {
  id: string
  content: string
  imageUrl?: string | null
  createdAt: string
  isDeleted?: boolean
  deletedAt?: string | null
  isPinned?: boolean
  isEdited?: boolean
  editedAt?: string | null
  sender: {
    id: string
    name: string
    role: string
    securityNumber?: string
    avatar?: string | null
    gender?: string | null
  }
  replyTo?: {
    id: string
    content: string
    imageUrl?: string | null
    sender: {
      id: string
      name: string
      role?: string | null
      avatar?: string | null
      gender?: string | null
    }
  } | null
  replyToId?: string | null
  courseId?: string
  likes?: string
  reactions?: string
}

interface TranscriptMsg {
  id: string
  content: string
  isDeleted: boolean
  deletedAt?: string | null
  createdAt: string
  sender: {
    id: string
    name: string
    role: string
    securityNumber?: string
    avatar?: string | null
    gender?: string | null
  }
}

function formatMessageDate(dateString: string) {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  } else {
    // Return dd/mm/yyyy format as requested across the system
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
}

const LECTURE_LINK_REGEX = /\[LECTURE_COMMENT_LINK:courseId=([^;]+);lectureId=([^;]+);commentId=([^;\]]+)(?:;lectureTitle=([^\]]+))?\]/

function hasLectureLink(content: string): boolean {
  if (!content) return false
  return LECTURE_LINK_REGEX.test(content)
}

function cleanContent(content: string): string {
  if (!content) return ''
  return content.replace(LECTURE_LINK_REGEX, '').trim()
}

function parseLectureLink(content: string) {
  if (!content) return null
  const match = content.match(LECTURE_LINK_REGEX)
  if (!match) return null
  return {
    courseId: match[1],
    lectureId: match[2],
    commentId: match[3],
    lectureTitle: match[4] ? decodeURIComponent(match[4]) : 'Lecture'
  }
}

function stripAnnouncementMeta(content: string) {
  if (!content) return ''
  return content.replace(/\s*<!-- fcm_meta:(\{[\s\S]*?\}) -->\s*$/, '').trim()
}

export default function CommunityPage() {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null)
  
  const [offering, setOffering] = useState<any | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [isCapacitor, setIsCapacitor] = useState<boolean>(false)
  const [longPressedClass, setLongPressedClass] = useState<ClassItem | null>(null)
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hasLongPressedRef = useRef<boolean>(false)

  useEffect(() => {
    const check = () => {
      const hasClass = document.documentElement.classList.contains('is-native')
      const hasWindow = !!(window as any).Capacitor?.isNativePlatform?.()
      if (hasClass || hasWindow) {
        setIsCapacitor(true)
        return true
      }
      return false
    }

    if (check()) return

    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        setIsCapacitor(true)
      }
    }).catch(() => {})

    const intervalId = setInterval(() => {
      if (check()) {
        clearInterval(intervalId)
      }
    }, 100)

    const timeoutId = setTimeout(() => {
      clearInterval(intervalId)
    }, 2000)

    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [])

  const handleTouchStart = (cls: ClassItem) => {
    hasLongPressedRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      hasLongPressedRef.current = true
      setLongPressedClass(cls)
    }, 600)
  }

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleCardClick = (cls: ClassItem) => {
    if (hasLongPressedRef.current) {
      hasLongPressedRef.current = false
      return
    }
    setMobileForumOpen(false)
    setSelectedClass(cls)
  }
  const [messages, setMessages] = useState<CommMsg[]>([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState('STUDENT')
  const [loadingUser, setLoadingUser] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const chatFact = useLoadingFact(loadingMessages && messages.length === 0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [managingCommunity, setManagingCommunity] = useState(false)
  
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMsg[]>([])
  const [loadingTranscript, setLoadingTranscript] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedUserDetailsId, setSelectedUserDetailsId] = useState<string | null>(null)
  const [socialCardUserId, setSocialCardUserId] = useState<string | null>(null)
  const [managerProfileChoice, setManagerProfileChoice] = useState<CommMsg['sender'] | null>(null)
  const [hoveredManagerAction, setHoveredManagerAction] = useState<'profile' | 'social' | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // DM state
  const [showNewDMModal, setShowNewDMModal] = useState(false)
  const [dmSearch, setDmSearch] = useState('')
  const [dmResults, setDmResults] = useState<{ id: string; name: string; email: string; role: string; avatar?: string | null; gender?: string | null }[]>([])
  const [dmSearching, setDmSearching] = useState(false)
  const [dmStarting, setDmStarting] = useState(false)
  const [userName, setUserName] = useState('')
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userGender, setUserGender] = useState<string | null>(null)
  // Image upload state
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<CommMsg | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<CommMsg | null>(null)
  const [pinnedMessage, setPinnedMessage] = useState<CommMsg | null>(null)
  const [managerActionMessage, setManagerActionMessage] = useState<CommMsg | null>(null)
  const [editingMessage, setEditingMessage] = useState<CommMsg | null>(null)
  const [editContent, setEditContent] = useState('')
  const [guidelinesOpen, setGuidelinesOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'general' | 'announcements'>('general')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showGeneralEmojiPicker, setShowGeneralEmojiPicker] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadFileName, setUploadFileName] = useState<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [postTargetCourseId, setPostTargetCourseId] = useState<string>('')
  const [generalDiscussionPosts, setGeneralDiscussionPosts] = useState<CommMsg[]>([])
  const [loadingGeneralFeed, setLoadingGeneralFeed] = useState(false)
  const [generalHasMore, setGeneralHasMore] = useState(false)
  const [generalFeedError, setGeneralFeedError] = useState<string | null>(null)
  const generalCursor = useRef<string | null>(null)
  const generalFetching = useRef(false)
  const generalPages = useRef(1)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [generalFeedFilter, setGeneralFeedFilter] = useState<'recent' | 'popular' | 'unanswered'>('recent')
  const [hoveredReactionMessageId, setHoveredReactionMessageId] = useState<string | null>(null)
  const [expandedCommentsMessageId, setExpandedCommentsMessageId] = useState<string | null>(null)
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({})
  const [hoveredChatMsgId, setHoveredChatMsgId] = useState<string | null>(null)
  const [mobileForumOpen, setMobileForumOpen] = useState(false)

  const isDocumentAttachment = (file: File | null) => !!file && !file.type.startsWith('image/')
  const isMobileGeneralOpen = isMobile && mobileForumOpen
  const selectedClassId = selectedClass?.id

  const handleUpgradeClick = async () => {
    if (!selectedClass || !selectedClass.id) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/course-offerings')
      if (res.ok) {
        const offerings = await res.json()
        if (Array.isArray(offerings)) {
          const found = offerings.find((o: any) => o.courseId === selectedClass.id)
          if (found) {
            setOffering(found)
            setShowPurchaseModal(true)
          } else {
            alert('No batch offering found for this course.')
          }
        }
      } else {
        alert('Failed to load upgrade options.')
      }
    } catch (e) {
      console.error(e)
      alert('Something went wrong.')
    } finally {
      setIsProcessing(false)
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
        return
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'GenZ IItian',
        description: `Purchase ${data.courseName} (${accessType})`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.userName,
          email: data.userEmail,
        },
        theme: { color: 'var(--accent)' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          setIsProcessing(true)
          try {
            const verifyRes = await fetch(`/api/course-offerings/verify`, {
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
              setShowPurchaseModal(false)
              setSuccessOrderId(verifyData.orderId || 'SUCCESS')
            } else {
              alert(verifyData.error || 'Payment verification failed')
            }
          } catch (e) {
            console.error(e)
            alert('Something went wrong during payment verification')
          } finally {
            setIsProcessing(false)
          }
        },
        modal: {
          onDismiss: () => {
            setPurchasing(null)
          }
        }
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
      setIsProcessing(false)
    } catch (e: any) {
      alert(e.message || 'Something went wrong')
      setIsProcessing(false)
      setPurchasing(null)
    }
  }

  // Pagination & infinite scroll state
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef<boolean>(false)
  const shouldScrollToBottomRef = useRef<boolean>(true)
  const isInitialLoadRef = useRef<boolean>(true)

  // Tagging state
  const [staff, setStaff] = useState<{
    id: string
    name: string
    role: string
    avatar?: string | null
    gender?: string | null
    enrollments?: { courseId: string }[]
    instructorAssignments?: { courseId: string }[]
  }[]>([])
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const [tagTriggerIndex, setTagTriggerIndex] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const generalComposerRef = useRef<HTMLTextAreaElement>(null)

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const menuBackdropZIndex = 999
  const menuLayerZIndex = 1001

  const handleMarkAsRead = async (e: React.MouseEvent, classId: string) => {
    e.stopPropagation()
    setActiveMenuId(null)
    try {
      await fetch(`/api/community/${classId}/read`, { method: 'POST' })
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, hasUnread: false } : c))
    } catch (err) {
      console.error('Failed to mark community as read', err)
    }
  }

  const handleOpenCoursePage = (e: React.MouseEvent, classId: string) => {
    e.stopPropagation()
    setActiveMenuId(null)
    router.push(`/courses/${classId}`)
  }

  const openGeneralDiscussion = (focusComposer = false) => {
    setSidebarTab('general')
    setSelectedClass(null)
    setMobileForumOpen(true)
    if (focusComposer) {
      setTimeout(() => {
        generalComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        generalComposerRef.current?.focus()
      }, 120)
    }
  }

  const canEditOwnGeneralPost = (msg: CommMsg) => (
    msg.sender.id === userId &&
    !msg.isDeleted &&
    !msg.id.startsWith('temp-') &&
    Date.now() - new Date(msg.createdAt).getTime() <= 24 * 60 * 60 * 1000
  )

  const canDeleteGeneralPost = (msg: CommMsg) => (
    userRole === 'MANAGER' ||
    canEditOwnGeneralPost(msg)
  )

  const startGeneralPostEdit = (msg: CommMsg) => {
    setEditingMessage(msg)
    setInput(msg.content)
    clearPendingImage()
    openGeneralDiscussion(true)
  }

  async function deleteGeneralPost(msg: CommMsg) {
    if (deletingId) return
    const allowed = await confirm({
      title: 'Delete Post?',
      message: userRole === 'MANAGER'
        ? 'This post will be removed from General Discussion.'
        : 'You can delete your own post within 24 hours.',
      confirmLabel: 'Delete Post',
      tone: 'danger',
    })
    if (!allowed) return
    setDeletingId(msg.id)
    try {
      const res = await fetch(`/api/community/${msg.courseId}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msg.id }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to delete post')
      }
      loadGeneralDiscussionPosts()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Could not delete post')
    } finally {
      setDeletingId(null)
    }
  }

  const loadPinnedMessage = useCallback(async (classId: string) => {
    try {
      const res = await fetch(`/api/community/${classId}/messages/pinned`)
      if (res.ok) {
        const data = await res.json()
        setPinnedMessage(data?.pinnedMessage || null)
      } else {
        setPinnedMessage(null)
      }
    } catch (err) {
      console.error('Failed to load pinned message', err)
      setPinnedMessage(null)
    }
  }, [])

  const loadMessages = useCallback(async (classId: string, options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true
    // Reset pagination states
    setHasMore(true)
    setLoadingMore(false)
    shouldRestoreScrollRef.current = false
    shouldScrollToBottomRef.current = true
    isInitialLoadRef.current = true
    if (showLoading) {
      setLoadingMessages(true)
      setMessages([])
      setPinnedMessage(null)
    }

    try {
      const url = classId.startsWith('dm_')
        ? `/api/community/${classId}/messages`
        : `/api/community/${classId}/messages?limit=50`

      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load messages')
      }
      const loaded = Array.isArray(data) ? data : []
      setMessages(loaded)

      if (classId.startsWith('dm_')) {
        setHasMore(false)
      } else {
        setHasMore(loaded.length >= 50)
      }
      
      // Fetch pinned message for community (non-blocking)
      if (!classId.startsWith('dm_')) {
        loadPinnedMessage(classId).catch(console.error)
      } else {
        setPinnedMessage(null)
      }
    } finally {
      if (showLoading) setLoadingMessages(false)
    }
  }, [loadPinnedMessage])

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    if (isInitialLoadRef.current) return
    if (container.scrollTop === 0 && !loadingMore && hasMore && messages.length > 0 && selectedClass) {
      if (messages[0].id.startsWith('temp-')) return

      setLoadingMore(true)
      prevScrollHeightRef.current = container.scrollHeight
      shouldRestoreScrollRef.current = true
      shouldScrollToBottomRef.current = false

      try {
        const oldestId = messages[0].id
        const res = await fetch(`/api/community/${selectedClass.id}/messages?cursor=${oldestId}&limit=50`)
        const data = await res.json().catch(() => ([]))
        if (res.ok && Array.isArray(data)) {
          if (data.length < 50) {
            setHasMore(false)
          }
          if (data.length > 0) {
            setMessages(prev => [...data, ...prev])
          } else {
            setHasMore(false)
          }
        }
      } catch (err) {
        console.error('Failed to load older messages', err)
      } finally {
        setLoadingMore(false)
      }
    }
  }

  const handlePinToggle = useCallback(async (messageId: string, pin: boolean) => {
    if (!selectedClass) return
    try {
      const action = pin ? 'pin' : 'unpin'
      const res = await fetch(`/api/community/${selectedClass.id}/messages/${messageId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Failed to ${action} message`)
      }
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : `Failed to ${pin ? 'pin' : 'unpin'} message`)
    }
  }, [selectedClass])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        setUserRole(d.user?.role || 'STUDENT')
        setUserId(d.user?.id || '')
        setUserName(d.user?.name || '')
        setUserAvatar(d.user?.avatar || null)
        setUserGender(d.user?.gender || null)
      })
      .catch(console.error)
      .finally(() => setLoadingUser(false))
    
    // Fetch staff list for tagging
    fetch('/api/users/staff')
      .then(r => r.json())
      .then(d => setStaff(Array.isArray(d.staff) ? d.staff : []))
      .catch(console.error)
    
    // Parse query params to auto-focus the channel (e.g. from push notifications)
    let preferredId: string | undefined = undefined
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const course = searchParams.get('course')
      const dm = searchParams.get('dm')
      if (course) {
        preferredId = course
      } else if (dm) {
        preferredId = `dm_${dm}`
      }
    }
    loadClasses(preferredId)
  }, [])

  // Close tag suggestions on click outside
  useEffect(() => {
    if (!showTagSuggestions) return
    const close = () => setShowTagSuggestions(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showTagSuggestions])

  async function loadClasses(preferredId?: string) {
    try {
      setLoadingClasses(true)
      setLoadError(null)
      const res = await fetch('/api/classes')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load communities')
      }
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.classes)
          ? data.classes
          : []
      setClasses(list)
      if (preferredId && !list.some((item: ClassItem) => item.id === preferredId)) {
        setLoadError(preferredId.startsWith('dm_') ? 'Direct message not available' : 'Community not available for this course')
      }
      setSelectedClass(current => {
        const nextId = preferredId || current?.id
        const match = nextId ? list.find((item: ClassItem) => item.id === nextId) : null
        if (match) return match
        // Never auto-open the first community — let the user pick from the list.
        return current || null
      })
    } catch (error) {
      console.error(error)
      setClasses([])
      setSelectedClass(null)
      setLoadError(error instanceof Error ? error.message : 'Failed to load communities')
    } finally {
      setLoadingClasses(false)
    }
  }

  const loadGeneralDiscussionPosts = useCallback(async (append = false) => {
    if (generalFetching.current) return
    generalFetching.current = true
    setLoadingGeneralFeed(true)
    setGeneralFeedError(null)
    try {
      let cursor = append ? generalCursor.current : null
      let hasMore = false
      const messages: CommMsg[] = []
      // Refresh every loaded page so polling never removes older posts the
      // reader has already opened, and moderation changes remain visible.
      for (let page = 0; page < (append ? 1 : generalPages.current); page++) {
        const query = new URLSearchParams({ view: 'feed', limit: '10' })
        if (cursor) query.set('cursor', cursor)
        const res = await fetch(`/api/community/general-discussion/messages?${query}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not load discussions')
        if (!Array.isArray(data.messages)) throw new Error('Could not load discussions')
        messages.push(...data.messages)
        cursor = data.nextCursor
        hasMore = data.hasMore === true
        if (!hasMore) break
      }
      const mapped = messages.map((m: CommMsg) => ({
        ...m,
        courseId: 'general-discussion',
        courseName: 'General Discussion',
        courseColor: '#4F46E5',
      }))
      setGeneralDiscussionPosts(previous => append
        ? Array.from(new Map([...previous, ...mapped].map(m => [m.id, m])).values())
        : mapped)
      generalCursor.current = cursor
      if (append) generalPages.current += 1
      setGeneralHasMore(hasMore)
    } catch (err) {
      setGeneralFeedError(err instanceof Error ? err.message : 'Could not load discussions')
    } finally {
      generalFetching.current = false
      setLoadingGeneralFeed(false)
    }
  }, [])

  const loadAnnouncements = useCallback(async () => {
    setLoadingAnnouncements(true)
    try {
      const res = await fetch('/api/announcements')
      if (res.ok) {
        const data = await res.json()
        setAnnouncements(data)
      }
    } catch (err) {
      console.error('Failed to load announcements', err)
    } finally {
      setLoadingAnnouncements(false)
    }
  }, [])

  useEffect(() => {
    const enrolled = classes.filter(c => !c.isDirectChat && c.id !== 'general-discussion')
    if (enrolled.length > 0 && !postTargetCourseId) {
      setPostTargetCourseId(enrolled[0].id)
    }
  }, [classes, postTargetCourseId])

  useEffect(() => {
    if (!selectedClass) {
      if (sidebarTab === 'general') {
        loadGeneralDiscussionPosts()
      } else if (sidebarTab === 'announcements') {
        loadAnnouncements()
      }
    }
  }, [selectedClass, sidebarTab, loadGeneralDiscussionPosts, loadAnnouncements])

  // Poll for general feed updates when on General tab
  useEffect(() => {
    if (!selectedClass && sidebarTab === 'general') {
      const interval = setInterval(() => {
        loadGeneralDiscussionPosts()
      }, 15000)
      return () => clearInterval(interval)
    }
  }, [selectedClass, sidebarTab, loadGeneralDiscussionPosts])

  // Poll for unread status every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/classes')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return
        const fresh = Array.isArray(data)
          ? data
          : Array.isArray(data?.classes)
            ? data.classes
            : []
        
        // Update unread flags, keep existing list order to prevent shifting UI, but remove deleted/disabled classes and append new ones
        setClasses(prev => {
          const updated = prev
            .filter(c => fresh.some((f: ClassItem) => f.id === c.id))
            .map(c => {
              const update = fresh.find((f: ClassItem) => f.id === c.id)
              return update ? { ...c, hasUnread: update.hasUnread } : c
            })

          const existingIds = new Set(prev.map(c => c.id))
          const newClasses = fresh.filter((f: ClassItem) => !existingIds.has(f.id))
          
          return [...updated, ...newClasses]
        })
      } catch (err) {
        console.error('Failed to poll classes', err)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Mark community as read when selected
  useEffect(() => {
    if (selectedClassId) {
      fetch(`/api/community/${selectedClassId}/read`, { method: 'POST' }).catch(console.error);
      
      // Optimistically clear the unread dot LOCALLY
      setClasses(prev => prev.map(c => c.id === selectedClassId ? { ...c, hasUnread: false } : c))
    }
  }, [selectedClassId])

  // SSE connection for real-time messages
  useEffect(() => {
    if (!selectedClassId) return
    loadMessages(selectedClassId)

    const eventSource = new EventSource(`/api/community/${selectedClassId}/messages/stream`)

    eventSource.addEventListener('message', (e) => {
      try {
        const newMsg = JSON.parse(e.data)
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          const filtered = prev.filter(m => !m.id.startsWith('temp-'))
          return [...filtered, newMsg]
        })
      } catch (err) {
        console.error('SSE Message Error', err)
      }
    })

    eventSource.addEventListener('delete', (e) => {
      try {
        const { messageId } = JSON.parse(e.data)
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDeleted: true, content: '' } : m))
      } catch (err) {
        console.error('SSE Delete Error', err)
      }
    })

    eventSource.addEventListener('clear', () => {
      setMessages([])
    })

    eventSource.addEventListener('pin', (e) => {
      try {
        const { messageId } = JSON.parse(e.data)
        setMessages(prev => prev.map(m => ({
          ...m,
          isPinned: m.id === messageId
        })))
        if (!messageId) {
          setPinnedMessage(null)
        } else {
          loadPinnedMessage(selectedClassId).catch(console.error)
        }
      } catch (err) {
        console.error('SSE Pin Error', err)
      }
    })

    eventSource.addEventListener('edit', (e) => {
      try {
        const { messageId, content, editedAt } = JSON.parse(e.data)
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, isEdited: true, editedAt } : m))
      } catch (err) {
        console.error('SSE Edit Error', err)
      }
    })

    eventSource.addEventListener('update', (e) => {
      try {
        const updated = JSON.parse(e.data)
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, likes: updated.likes, reactions: updated.reactions } : m))
      } catch (err) {
        console.error('SSE Update Error', err)
      }
    })

    return () => eventSource.close()
  }, [selectedClassId, loadMessages, loadPinnedMessage])

  useEffect(() => {
    if (shouldRestoreScrollRef.current && chatContainerRef.current) {
      const container = chatContainerRef.current
      const newScrollHeight = container.scrollHeight
      const diff = newScrollHeight - prevScrollHeightRef.current
      container.scrollTop = diff
      shouldRestoreScrollRef.current = false
    } else if (shouldScrollToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      isInitialLoadRef.current = false
    }
  }, [messages])

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      confirm({
        title: 'Image Too Large',
        message: 'Upload size is 20 MB only max. Please select a smaller image.',
        confirmLabel: 'OK',
        tone: 'danger'
      })
      if (e.target) e.target.value = ''
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Only JPG, PNG, and WEBP images are allowed.')
      if (e.target) e.target.value = ''
      return
    }
    setPendingImage(file)
    setPendingImagePreview(URL.createObjectURL(file))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      confirm({
        title: 'File Too Large',
        message: 'Upload size is 20 MB only max. Please select a smaller file.',
        confirmLabel: 'OK',
        tone: 'danger'
      })
      if (e.target) e.target.value = ''
      return
    }
    const allowedExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip']
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      alert('Supported document formats: PDF, PPT, DOCX, ZIP, and XLS.')
      if (e.target) e.target.value = ''
      return
    }
    setPendingImage(file)
    setPendingImagePreview(file.name)
  }

  function clearPendingImage() {
    setPendingImage(null)
    if (pendingImagePreview && pendingImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(pendingImagePreview)
    }
    setPendingImagePreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadFileWithProgress = (file: File, onProgress: (pct: number) => void, signal: AbortSignal): Promise<string> => {
    return new Promise((resolve, reject) => {
      const token = Math.random().toString()
      
      // Notify start
      window.dispatchEvent(new CustomEvent('app-upload-start', { detail: { fileName: file.name, token } }))

      const xhr = new XMLHttpRequest()
      const handleCancel = (e: any) => {
        if (e.detail?.token === token) {
          xhr.abort()
        }
      }
      const cleanupCancelHandler = () => window.removeEventListener('app-upload-cancel', handleCancel)
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100)
          onProgress(pct)
          window.dispatchEvent(new CustomEvent('app-upload-progress', { detail: { pct } }))
        }
      }
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText)
            window.dispatchEvent(new CustomEvent('app-upload-complete'))
            cleanupCancelHandler()
            resolve(res.url)
          } catch (e) {
            window.dispatchEvent(new CustomEvent('app-upload-error'))
            cleanupCancelHandler()
            reject(new Error('Invalid response format'))
          }
        } else {
          try {
            const res = JSON.parse(xhr.responseText)
            window.dispatchEvent(new CustomEvent('app-upload-error'))
            cleanupCancelHandler()
            reject(new Error(res.error || 'Upload failed'))
          } catch (e) {
            window.dispatchEvent(new CustomEvent('app-upload-error'))
            cleanupCancelHandler()
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }
      }
      
      xhr.onerror = () => {
        window.dispatchEvent(new CustomEvent('app-upload-error'))
        cleanupCancelHandler()
        reject(new Error('Network error'))
      }
      
      xhr.onabort = () => {
        window.dispatchEvent(new CustomEvent('app-upload-error'))
        cleanupCancelHandler()
        reject(new Error('Upload cancelled'))
      }
      
      // Wire cancel event from layout
      window.addEventListener('app-upload-cancel', handleCancel)

      signal.addEventListener('abort', () => {
        xhr.abort()
      })
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'announcements')
      
      xhr.open('POST', '/api/upload/chat-image')
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
      xhr.send(formData)
    })
  }

  async function sendMessage() {
    // Enforce role check: General batch or demo enrollments cannot post/reply
    const isDemoOrGeneral = selectedClass && (
      (selectedClass as any).isDemoEnrollment || 
      (selectedClass as any).enrollmentType === 'DEMO' || 
      selectedClass.name.toLowerCase().includes('general') || 
      selectedClass.name.toLowerCase().includes('demo')
    );
    if (isDemoOrGeneral && userRole !== 'MANAGER' && (userRole !== 'ADMIN' && userRole !== 'MODERATOR')) {
      alert('Posting is restricted for Demo/General batch users.');
      return;
    }

    // Enforce Character Limits
    const isReply = !!replyingTo;
    const limit = isReply ? 300 : 500;
    if (input.length > limit) {
      alert(`Message exceeds the maximum limit of ${limit} characters.`);
      return;
    }

    // Rate Limit Enforcements (using LocalStorage as client-side tracker)
    const today = new Date().toDateString();
    const rateLimitKey = `rate_limit_${userId}_${today}`;
    const trackingStr = localStorage.getItem(rateLimitKey);
    let tracking = { posts: 0, replies: 0 };
    if (trackingStr) {
      try { tracking = JSON.parse(trackingStr); } catch (e) {}
    }

    if (isReply) {
      if (tracking.replies >= 20 && userRole !== 'MANAGER' && (userRole !== 'ADMIN' && userRole !== 'MODERATOR')) {
        alert('You have reached the maximum limit of 20 replies/comments per day.');
        return;
      }
      tracking.replies += 1;
    } else {
      if (tracking.posts >= 5 && userRole !== 'MANAGER' && (userRole !== 'ADMIN' && userRole !== 'MODERATOR')) {
        alert('You have reached the maximum limit of 5 posts per day.');
        return;
      }
      tracking.posts += 1;
    }
    localStorage.setItem(rateLimitKey, JSON.stringify(tracking));

    // Cap comments count limit check
    if (isReply && messages.length >= 200) {
      alert('This post has reached the maximum capacity of 200 comments.');
      return;
    }

    let imageUrl: string | null = null

    // Upload image first if present
    if (pendingImage) {
      setUploadingImage(true)
      try {
        const formData = new FormData()
        formData.append('file', pendingImage)
        const uploadRes = await fetch('/api/upload/chat-image', { method: 'POST', body: formData })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed')
        imageUrl = uploadData.url
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Image upload failed')
        setUploadingImage(false)
        return
      }
      setUploadingImage(false)
    }

    const optimistic: CommMsg = {
      id: 'temp-' + Date.now(),
      content: input,
      imageUrl,
      createdAt: new Date().toISOString(),
      sender: { id: userId, name: 'You', role: userRole },
      replyTo: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        imageUrl: replyingTo.imageUrl,
        sender: { id: replyingTo.sender.id, name: replyingTo.sender.name, role: replyingTo.sender.role }
      } : undefined
    }
    setMessages(prev => [...prev, optimistic])
    const msgContent = input
    setInput('')
    setShowEmojiPicker(false)
    clearPendingImage()

    await fetch(`/api/community/${selectedClass.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content: msgContent || '', 
        imageUrl,
        replyToId: replyingTo?.id 
      }),
    })
    setReplyingTo(null)
    loadMessages(selectedClass.id, { showLoading: false }).catch(console.error)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

    const cursor = e.target.selectionStart || 0
    const textBeforeCursor = val.slice(0, cursor)
    const lastWord = textBeforeCursor.split(/\s/).pop() || ''
    if (lastWord.startsWith('@')) {
      const query = lastWord.slice(1)
      setShowTagSuggestions(true)
      setTagSearchQuery(query)
      setTagTriggerIndex(cursor - lastWord.length)
    } else {
      setShowTagSuggestions(false)
    }
  }

  const selectTagUser = (user: { id: string; name: string }) => {
    const val = input
    const cursor = inputRef.current?.selectionStart || 0
    const textBeforeTrigger = val.slice(0, tagTriggerIndex)
    const textAfterCursor = val.slice(cursor)
    
    const newText = `${textBeforeTrigger}@${user.name} ${textAfterCursor}`
    setInput(newText)
    setShowTagSuggestions(false)
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const newCursorPos = tagTriggerIndex + user.name.length + 2 // trigger + name + space
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 50)
  }

  const filteredStaff = staff.filter(user => {
    if (!user.name.toLowerCase().includes(tagSearchQuery.toLowerCase())) {
      return false
    }
    // Managers are global and show up in all groups
    if (user.role === 'MANAGER') {
      return true
    }
    // Admins must be part of the current course group (enrolled or assigned)
    if (selectedClass && selectedClass.isDirectChat !== true) {
      const courseId = selectedClass.id
      const isEnrolled = user.enrollments?.some((e: any) => e.courseId === courseId)
      const isAssigned = user.instructorAssignments?.some((a: any) => a.courseId === courseId)
      return !!(isEnrolled || isAssigned)
    }
    return true
  })

  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  const linkifyText = (text: string) => {
    if (!text) return []
    const urlRegex = /(https?:\/\/[^\s]+)/gi
    const splitParts = text.split(urlRegex)
    
    return splitParts.map((subPart, i) => {
      if (subPart.match(urlRegex)) {
        return (
          <a
            key={`link-${i}-${Math.random()}`}
            href={subPart}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--primary)',
              textDecoration: 'underline',
              fontWeight: '600',
              cursor: 'pointer',
              wordBreak: 'break-all'
            }}
          >
            {subPart}
          </a>
        )
      }
      return subPart
    })
  }

  // Detect emoji-only messages (no text, just emojis)
  const isEmojiOnly = (text: string): boolean => {
    if (!text || !text.trim()) return false
    const t = text.trim()
    
    // Curated emoji list we support, plus any others we want to detect
    const emojiSet = new Set(['😂','😭','😅','🙂','😎','🤔','❤️','🔥','👏','👍','🙏','🎉','🥳','📚','📝','🎓','💯','✅','❌','⏰','💡','😤','🫡','💪','🤝','😴','🤯','👀','😬','🫠']);
    
    // Convert string to array of characters (correctly handles surrogate pairs)
    const chars = Array.from(t).filter(c => c.trim() !== '');
    if (chars.length === 0 || chars.length > 8) return false;
    
    // If every non-whitespace character in the message is one of our emojis, render big
    return chars.every(char => emojiSet.has(char));
  }

  const renderMessageContent = (content: string) => {
    if (!content) return null
    if (staff.length === 0) {
      return linkifyText(content)
    }

    const sortedStaff = [...staff].sort((a, b) => b.name.length - a.name.length)
    let parts: (string | React.JSX.Element)[] = [content]

    for (const member of sortedStaff) {
      const tagStr = `@${member.name}`
      const nextParts: (string | React.JSX.Element)[] = []

      for (const part of parts) {
        if (typeof part !== 'string') {
          nextParts.push(part)
          continue
        }

        const regex = new RegExp(`(${escapeRegExp(tagStr)})`, 'gi')
        const splitPart = part.split(regex)

        for (const subPart of splitPart) {
          if (subPart.toLowerCase() === tagStr.toLowerCase()) {
            nextParts.push(
              <span key={`${member.id}-${Math.random()}`} style={{ color: 'var(--primary)', fontWeight: '800', cursor: 'pointer' }}>
                {subPart}
              </span>
            )
          } else {
            nextParts.push(subPart)
          }
        }
      }
      parts = nextParts
    }

    const finalParts: (string | React.JSX.Element)[] = []
    for (const part of parts) {
      if (typeof part !== 'string') {
        finalParts.push(part)
      } else {
        finalParts.push(...linkifyText(part))
      }
    }

    return finalParts
  }

  async function toggleMuteCourse(courseId: string, currentMuted: boolean) {
    // Optimistically update
    setClasses(prev => prev.map(c => c.id === courseId ? { ...c, isMuted: !currentMuted } : c))
    
    try {
      const res = await fetch(`/api/community/${courseId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: !currentMuted }),
      })
      if (!res.ok) {
        throw new Error('Failed to toggle mute')
      }
    } catch (err) {
      console.error(err)
      // Revert if failed
      setClasses(prev => prev.map(c => c.id === courseId ? { ...c, isMuted: currentMuted } : c))
      alert('Could not update notification settings.')
    }
  }

  async function deleteMessage(messageId: string) {
    if (!selectedClass || deletingId) return
    const allowed = await confirm({
      title: 'Delete Message?',
      message: 'This message will be removed from the chat.',
      confirmLabel: 'Delete Message',
      tone: 'danger',
    })
    if (!allowed) return
    setDeletingId(messageId)
    try {
      const res = await fetch(`/api/community/${selectedClass.id}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDeleted: true, content: '' } : m))
      }
    } catch (e) {
      console.error(e)
    }
    setDeletingId(null)
  }

  async function editMessage(messageId: string, newContent: string) {
    if (!selectedClass || !newContent.trim()) return
    try {
      // Optimistically update
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, isEdited: true } : m))
      setEditingMessage(null)
      setEditContent('')

      const res = await fetch(`/api/community/${selectedClass.id}/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, content: newContent }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to edit message')
      }
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Could not edit message')
      loadMessages(selectedClass.id, { showLoading: false }).catch(console.error)
    }
  }

  async function clearCommunityMessages() {
    if (!selectedClass || userRole !== 'MANAGER' || managingCommunity) return
    const allowed = await confirm({
      title: 'Clear Community Chat?',
      message: 'This will remove all messages from this community for everyone.',
      confirmLabel: 'Clear Messages',
      tone: 'danger',
    })
    if (!allowed) return

    setManagingCommunity(true)
    try {
      const res = await fetch(`/api/community/${selectedClass.id}/clear`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to clear community')
      }
      await loadMessages(selectedClass.id, { showLoading: false })
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to clear community')
    } finally {
      setManagingCommunity(false)
    }
  }

  async function toggleCommunityStatus() {
    if (!selectedClass || userRole !== 'MANAGER' || managingCommunity) return
    const nextActive = !selectedClass.isCommunityActive
    const allowed = await confirm({
      title: nextActive ? 'Enable Community?' : 'Disable Community?',
      message: nextActive
        ? 'Students and admins will be able to see and use this community again.'
        : 'Students and admins will no longer see this community, but managers will still have access.',
      confirmLabel: nextActive ? 'Enable Community' : 'Disable Community',
      tone: nextActive ? 'default' : 'danger',
    })
    if (!allowed) return

    setManagingCommunity(true)
    try {
      const res = await fetch(`/api/courses/${selectedClass.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCommunityActive: nextActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update community')
      }
      await loadClasses(selectedClass.id)
      await loadMessages(selectedClass.id, { showLoading: false })
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to update community')
    } finally {
      setManagingCommunity(false)
    }
  }

  async function exportTranscript(format: 'csv' | 'json' | 'pdf') {
    if (!selectedClass || userRole !== 'MANAGER') return
    try {
      const res = await fetch(`/api/community/transcripts/export?courseId=${selectedClass.id}&format=${format}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to export transcript')
      }
      const blob = await res.blob()
      const ext = format === 'pdf' ? 'html' : format
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `transcript-${selectedClass.name.replace(/\s+/g, '_')}.${ext}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to export transcript')
    }
  }

  async function openTranscript() {
    if (!selectedClass || userRole !== 'MANAGER') return
    setTranscriptOpen(true)
    setLoadingTranscript(true)
    try {
      // DM transcripts come from messages endpoint directly
      if (selectedClass.isDirectChat) {
        const res = await fetch(`/api/community/${selectedClass.id}/messages`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load transcript')
        setTranscriptMessages(Array.isArray(data) ? data.map((m: any) => ({ ...m, isDeleted: m.isDeleted || false })) : [])
      } else {
        const res = await fetch(`/api/community/transcripts?courseId=${selectedClass.id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load transcript')
        setTranscriptMessages(data.messages || [])
      }
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to load transcript')
    } finally {
      setLoadingTranscript(false)
    }
  }

  async function searchDMUsers(q: string) {
    if (q.length < 2) { setDmResults([]); return }
    setDmSearching(true)
    try {
      const res = await fetch(`/api/community/direct/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setDmResults(Array.isArray(data) ? data : [])
    } catch { setDmResults([]) }
    setDmSearching(false)
  }

  async function startDM(studentId: string) {
    if (dmStarting) return
    setDmStarting(true)
    try {
      const res = await fetch('/api/community/direct/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start chat')
      setShowNewDMModal(false)
      setDmSearch('')
      setDmResults([])
      await loadClasses(data.chatId)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to start chat')
    }
    setDmStarting(false)
  }

  function openUserIdentity(user: CommMsg['sender']) {
    if (!user?.id) return
    if (userRole === 'MANAGER' && user.id !== userId && user.role === 'STUDENT') {
      setManagerProfileChoice(user)
      return
    }
    setSocialCardUserId(user.id)
  }

  const isDM = (cls: ClassItem | null) => cls?.isDirectChat === true
  const isCommunityModerator = userRole === 'MANAGER' || (userRole === 'ADMIN' || userRole === 'MODERATOR')
  const isCourseCommunityChat = (cls: ClassItem | null) => !!cls && !isDM(cls) && cls.id !== 'general-discussion'
  const isWithinMessageActionWindow = (msg: CommMsg) => Date.now() - new Date(msg.createdAt).getTime() <= 24 * 60 * 60 * 1000
  const canShowChatMessageActions = (msg: CommMsg) => (
    isCourseCommunityChat(selectedClass) &&
    !isMobile &&
    !msg.isDeleted &&
    !msg.id.startsWith('temp-')
  )
  const canReplyToChatMessage = (msg: CommMsg) => canShowChatMessageActions(msg)
  const canEditChatMessage = (msg: CommMsg) => (
    canShowChatMessageActions(msg) &&
    msg.sender.id === userId
  )
  const canDeleteChatMessage = (msg: CommMsg) => (
    canShowChatMessageActions(msg) &&
    (userRole === 'MANAGER' || (msg.sender.id === userId && isWithinMessageActionWindow(msg)))
  )
  const canOpenChatMessageActionMenu = (msg: CommMsg) => (
    isCourseCommunityChat(selectedClass) &&
    !msg.isDeleted &&
    !msg.id.startsWith('temp-')
  )
  const canLongPressReplyToChatMessage = (msg: CommMsg) => canOpenChatMessageActionMenu(msg)
  const canLongPressEditChatMessage = (msg: CommMsg) => (
    canOpenChatMessageActionMenu(msg) &&
    isCommunityModerator &&
    msg.sender.id === userId
  )
  const canLongPressDeleteChatMessage = (msg: CommMsg) => (
    canOpenChatMessageActionMenu(msg) &&
    (userRole === 'MANAGER' || (msg.sender.id === userId && isWithinMessageActionWindow(msg)))
  )
  const canLongPressPinChatMessage = (msg: CommMsg) => (
    canOpenChatMessageActionMenu(msg) &&
    isCommunityModerator
  )
  const courseClasses = classes.filter(cls => !cls.isDirectChat && cls.id !== 'general-discussion')
  const directChatClasses = classes.filter(cls => cls.isDirectChat)
  const shouldShowCourseSkeletons = loadingClasses && courseClasses.length === 0
  const shouldShowDirectSkeletons = loadingClasses && directChatClasses.length === 0

  const SkeletonBlock = ({ style }: { style?: React.CSSProperties }) => (
    <span className="community-skeleton-block" style={style} aria-hidden="true" />
  )

  const CourseRowSkeleton = ({ compact = false }: { compact?: boolean }) => (
    <div
      className="community-skeleton-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '10px' : '12px',
        padding: compact ? '10px 8px' : '12px',
        minHeight: compact ? '72px' : '72px',
        borderRadius: compact ? '18px' : '18px',
      }}
    >
      <SkeletonBlock style={{ width: compact ? '34px' : '44px', height: compact ? '34px' : '44px', borderRadius: compact ? '10px' : '14px', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SkeletonBlock style={{ width: compact ? '64%' : '58%', height: compact ? '12px' : '14px' }} />
        <SkeletonBlock style={{ width: compact ? '38%' : '34%', height: '10px' }} />
      </div>
      <SkeletonBlock style={{ width: compact ? '24px' : '26px', height: compact ? '24px' : '26px', borderRadius: '50%', flexShrink: 0 }} />
    </div>
  )

  const DirectMessageSkeleton = () => (
    <div className="community-skeleton-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '18px', minHeight: '56px' }}>
      <SkeletonBlock style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <SkeletonBlock style={{ width: '62%', height: '12px' }} />
        <SkeletonBlock style={{ width: '44%', height: '9px' }} />
      </div>
    </div>
  )

  const ComposerSkeleton = () => (
    <div className="community-skeleton-card" style={{ borderRadius: '20px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <SkeletonBlock style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
          <SkeletonBlock style={{ width: '84%', height: '14px' }} />
          <SkeletonBlock style={{ width: '68%', height: '14px' }} />
          <SkeletonBlock style={{ width: '46%', height: '14px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <SkeletonBlock style={{ width: '64px', height: '14px' }} />
        <SkeletonBlock style={{ width: '86px', height: '14px' }} />
        <SkeletonBlock style={{ width: '58px', height: '14px' }} />
        <SkeletonBlock style={{ width: '64px', height: '32px', borderRadius: '999px', marginLeft: 'auto' }} />
      </div>
    </div>
  )

  const PostCardSkeleton = () => (
    <div className="community-skeleton-card" style={{ borderRadius: '20px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <SkeletonBlock style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <SkeletonBlock style={{ width: '32%', height: '13px' }} />
          <SkeletonBlock style={{ width: '22%', height: '10px' }} />
        </div>
      </div>
      <SkeletonBlock style={{ width: '92%', height: '13px', marginTop: '6px' }} />
      <SkeletonBlock style={{ width: '76%', height: '13px' }} />
      <SkeletonBlock style={{ width: '48%', height: '13px' }} />
      <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
        <SkeletonBlock style={{ width: '56px', height: '13px' }} />
        <SkeletonBlock style={{ width: '96px', height: '13px' }} />
      </div>
    </div>
  )

  const PostFeedSkeleton = ({ count = 3 }: { count?: number }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {Array.from({ length: count }, (_, i) => <PostCardSkeleton key={i} />)}
    </div>
  )

  const ChatMessageSkeleton = ({ align = 'left' }: { align?: 'left' | 'right' }) => (
    <div style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: '8px', alignItems: 'flex-end' }}>
      {align === 'left' && <SkeletonBlock style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />}
      <div className="community-skeleton-card" style={{ width: align === 'right' ? '58%' : '64%', maxWidth: '420px', borderRadius: '18px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SkeletonBlock style={{ width: '72%', height: '12px' }} />
        <SkeletonBlock style={{ width: '48%', height: '12px' }} />
      </div>
      {align === 'right' && <SkeletonBlock style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />}
    </div>
  )

  const ChatThreadSkeleton = () => (
    <>
      <div style={{ padding: isMobile ? '12px 14px' : '16px 22px', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {isMobile && <SkeletonBlock style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0 }} />}
        <SkeletonBlock style={{ width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px', borderRadius: isDM(selectedClass) ? '50%' : '12px', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonBlock style={{ width: '34%', height: '14px' }} />
          <SkeletonBlock style={{ width: '22%', height: '10px' }} />
        </div>
      </div>
      <div className="chat-wallpaper" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {chatFact && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <LoadingFactCard fact={chatFact} />
          </div>
        )}
        <ChatMessageSkeleton />
        <ChatMessageSkeleton align="right" />
        <ChatMessageSkeleton />
        <ChatMessageSkeleton align="right" />
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1.5px solid var(--border)', flexShrink: 0 }}>
        <div className="community-skeleton-card" style={{ borderRadius: '20px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SkeletonBlock style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
          <SkeletonBlock style={{ flex: 1, height: '16px' }} />
          <SkeletonBlock style={{ width: '42px', height: '30px', borderRadius: '999px' }} />
        </div>
      </div>
    </>
  )

  const neu = { background: 'var(--community-item-bg)', boxShadow: 'var(--community-box-shadow)', border: '1.5px solid var(--border)' }
  const neuInset = { background: 'var(--community-item-bg)', boxShadow: 'inset 4px 4px 8px var(--community-item-shadow-dark), inset -4px -4px 8px var(--community-item-shadow-light)' }


  return (
    <div className="page-container fade-in" style={isMobile ? { display: 'flex', flexDirection: 'column', gap: '0px', padding: '12px', position: 'relative', boxSizing: 'border-box', overflowX: 'hidden' } : { display: 'flex', gap: '20px', height: 'calc(100vh - 152px)', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        .msg-row:hover .msg-actions { opacity: 1 !important; }
        @keyframes communityMessageActionsIn {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(var(--action-slide, 0)) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0) scale(1);
          }
        }
        .community-message-action-toolbar {
          animation: communityMessageActionsIn 170ms ease-out both;
        }
        .community-message-action-button:hover,
        .community-message-action-button:focus-visible {
          transform: scale(1.06);
        }
        .community-message-action-button:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
        }
        .community-sidebar-tab:hover,
        .community-sidebar-tab:focus-visible {
          background: var(--primary-light) !important;
          color: var(--primary) !important;
          box-shadow: 0 8px 18px rgba(54,54,232,0.16) !important;
        }
        .community-channel-btn:hover:not(.active),
        .community-channel-btn:focus-visible:not(.active) {
          background: color-mix(in srgb, var(--primary-light) 34%, var(--surface) 66%) !important;
          border-color: color-mix(in srgb, var(--primary) 42%, var(--border) 58%) !important;
          color: var(--text-primary) !important;
          box-shadow: 0 8px 18px rgba(54,54,232,0.14) !important;
        }
        .community-sidebar-tab:focus-visible,
        .community-channel-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .community-sidebar-divider {
          height: 1px;
          background: color-mix(in srgb, var(--text-primary) 30%, transparent);
          border-radius: 999px;
          pointer-events: none;
        }
        .community-secondary-panel {
          display: contents;
        }
        .community-courses-panel {
          display: contents;
        }
        @media (min-width: 768px) {
          .community-secondary-panel {
            width: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 22px;
            border-radius: 22px;
            background: color-mix(in srgb, var(--sidebar-bg) 86%, var(--surface) 14%);
            border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
            box-shadow: 0 10px 26px rgba(15, 23, 42, 0.035);
          }
          .community-courses-panel {
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            gap: 10px;
            padding: 0;
            border-radius: 0;
            background: transparent;
            border: none;
          }
        }
        :root[data-theme="dark"] .community-secondary-panel {
          background: color-mix(in srgb, var(--sidebar-bg) 74%, var(--surface-2) 26%);
          border-color: color-mix(in srgb, var(--border) 62%, transparent);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
        }
        :root[data-theme="dark"] .community-courses-panel {
          background: transparent;
          border-color: transparent;
        }
        .mobile-page-divider {
          height: 1px;
          width: 100%;
          background: color-mix(in srgb, var(--border) 78%, transparent);
          flex-shrink: 0;
        }
        .community-skeleton-card {
          background: color-mix(in srgb, var(--surface) 82%, var(--surface-2) 18%);
          border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.035);
          overflow: hidden;
          box-sizing: border-box;
        }
        .community-skeleton-block {
          display: block;
          border-radius: 999px;
          background:
            linear-gradient(
              90deg,
              color-mix(in srgb, var(--surface-3) 84%, transparent) 0%,
              color-mix(in srgb, var(--surface) 72%, var(--surface-3) 28%) 42%,
              color-mix(in srgb, var(--surface-3) 84%, transparent) 78%
            );
          background-size: 220% 100%;
          animation: communitySkeletonShimmer 1.6s ease-in-out infinite;
        }
        :root[data-theme="dark"] .community-skeleton-card {
          background: color-mix(in srgb, var(--surface) 66%, var(--surface-2) 34%);
          border-color: color-mix(in srgb, var(--border) 64%, transparent);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
        }
        :root[data-theme="dark"] .community-skeleton-block {
          background:
            linear-gradient(
              90deg,
              color-mix(in srgb, var(--surface-3) 72%, transparent) 0%,
              color-mix(in srgb, var(--surface-2) 64%, var(--surface-3) 36%) 42%,
              color-mix(in srgb, var(--surface-3) 72%, transparent) 78%
            );
          background-size: 220% 100%;
        }
        @keyframes communitySkeletonShimmer {
          0% { background-position: 120% 0; opacity: 0.78; }
          50% { opacity: 1; }
          100% { background-position: -120% 0; opacity: 0.78; }
        }
      `}</style>
      {confirmDialog}
      {activeMenuId && (
        <div
          onClick={() => setActiveMenuId(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: menuBackdropZIndex,
            background: 'transparent',
          }}
        />
      )}
      {loadError ? (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            padding: '12px 16px',
            border: '1px solid var(--border)',
            color: 'var(--danger)',
            background: 'var(--danger-light)',
          }}
        >
          {loadError}
        </div>
      ) : null}

      {/* Left: Class list */}
      <div style={{ width: isMobile ? '100%' : '230px', flexShrink: 0, display: (isMobile && (selectedClass || isMobileGeneralOpen)) ? 'none' : 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '8px', overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '4px 4px 16px' : '0' }}>
        {isMobile && (
          /* Premium Neumorphic Page Header */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '10px',
            padding: '0 4px',
            justifyContent: 'flex-start'
          }}>
            <button
              onClick={() => router.back()}
              aria-label="Go Back"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--surface)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
                color: 'var(--text-secondary)',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontSize: '22px',
                fontWeight: 900,
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                fontFamily: "'Outfit', 'Nunito', sans-serif"
              }}>
                Community
              </h1>
              <p style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                margin: '3px 0 0',
                fontFamily: "'Outfit', sans-serif"
              }}>
                Connect with your coursemates
              </p>
            </div>
          </div>
        )}
        {isMobile && <div className="mobile-page-divider" style={{ margin: '2px 4px 16px' }} />}
        <div className="community-secondary-panel">
        {/* If Mobile, render grid (same as Capacitor app) */}
        {isMobile ? (
          <>
            <section
              style={{
                margin: '10px 2px 14px',
                padding: '16px',
                borderRadius: '22px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{
                      margin: 0,
                      color: 'var(--text-primary)',
                      fontSize: '19px',
                      fontWeight: 900,
                      lineHeight: 1.15,
                      fontFamily: "'Outfit', 'Nunito', sans-serif",
                    }}>
                      General Discussion
                    </h2>
                    <p style={{
                      margin: '6px 0 0',
                      color: 'var(--text-secondary)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      lineHeight: 1.45,
                    }}>
                      Public posts and questions from everyone.
                    </p>
                  </div>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '14px',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => openGeneralDiscussion(true)}
                    style={{
                      minHeight: '42px',
                      borderRadius: '14px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: 'var(--bg)',
                      fontSize: '12.5px',
                      fontWeight: 900,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      boxShadow: '0 8px 18px rgba(54, 54, 232, 0.24)',
                    }}
                  >
                    Create Post
                  </button>
                  <button
                    onClick={() => openGeneralDiscussion(false)}
                    style={{
                      minHeight: '42px',
                      borderRadius: '14px',
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                      fontWeight: 900,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    All Posts
                  </button>
                </div>
            </section>
            <div className="mobile-page-divider" style={{ margin: '20px 8px 16px' }} />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '0 8px',
              margin: '0 0 12px',
            }}>
              <div
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.13em',
                  textTransform: 'uppercase',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                MY COURSES
              </div>
              <button
                onClick={() => router.push('/courses')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  padding: '4px 0',
                  flexShrink: 0,
                }}
              >
                View All &gt;
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 2px 18px', overflow: 'hidden' }}>
            {shouldShowCourseSkeletons ? (
              <>
                {[1, 2, 3, 4].map(i => <CourseRowSkeleton key={i} />)}
              </>
            ) : courseClasses.length === 0 ? (
              <div style={{
                padding: '18px 14px',
                borderRadius: '18px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 700,
                textAlign: 'center',
              }}>
                No courses available
              </div>
            ) : (
              courseClasses.map((cls) => (
                <div
                  key={cls.id}
                  onTouchStart={() => handleTouchStart(cls)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={() => handleTouchStart(cls)}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                  onClick={() => handleCardClick(cls)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 12px',
                    minHeight: '72px',
                    borderRadius: '18px',
                    border: '1px solid color-mix(in srgb, var(--border) 82%, transparent)',
                    background: 'color-mix(in srgb, var(--surface) 82%, var(--surface-2) 18%)',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.055), 0 2px 7px rgba(15, 23, 42, 0.035)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    width: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    minWidth: 0,
                  }}
                >
                  {cls.hasUnread && (
                    <span style={{
                      position: 'absolute',
                      top: '12px',
                      right: '42px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--danger)',
                      boxShadow: '0 0 6px var(--danger)',
                      zIndex: 9
                    }} />
                  )}

                  <CourseIconBadge
                    type={cls.courseIconType}
                    size={44}
                    iconSize={21}
                    radius={14}
                    style={{
                      background: 'var(--course-icon-bg)',
                      color: 'var(--course-icon-color)',
                      borderColor: 'var(--course-icon-border)',
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14.5px',
                      fontWeight: 850,
                      color: 'var(--text-primary)',
                      lineHeight: 1.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {cls.name}
                    </div>
                    {cls.subject && (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 650,
                      }}>
                        {cls.subject}
                      </div>
                    )}
                  </div>

                  <div style={{ position: 'relative', zIndex: activeMenuId === cls.id ? menuLayerZIndex : 10, flexShrink: 0 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuId(activeMenuId === cls.id ? null : cls.id)
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '50%',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s',
                        width: '24px',
                        height: '24px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>
                    {activeMenuId === cls.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: '32px',
                          right: '0px',
                          background: 'var(--surface)',
                          borderRadius: '16px',
                          boxShadow: 'var(--shadow-md)',
                          border: '1px solid var(--border)',
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          zIndex: 1000,
                          minWidth: '160px',
                          maxWidth: 'calc(100vw - 60px)',
                          alignItems: 'flex-start'
                        }}
                      >
                        <button
                          onClick={(e) => handleMarkAsRead(e, cls.id)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '10px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14.5px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            transition: 'background 0.2s',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          Mark as read
                        </button>
                        <button
                          onClick={(e) => handleOpenCoursePage(e, cls.id)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '10px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14.5px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            transition: 'background 0.2s',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          Open course page
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleMuteCourse(cls.id, cls.isMuted || false)
                            setActiveMenuId(null)
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '10px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14.5px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            transition: 'background 0.2s',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          {cls.isMuted ? 'Unmute notification' : 'Mute notification'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <p style={{
            textAlign: 'center',
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            margin: '0 16px 8px',
            lineHeight: 1.5,
            opacity: 0.7,
          }}>
            Please click on any course tab to chat with mentor &amp; your course mates
          </p>
          </>
        ) : (
          <>
            {/* Forum Navigation Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', position: 'relative' }}>
              <button
                className={`community-sidebar-tab ${(sidebarTab === 'general' && !selectedClass) ? 'active' : ''}`}
                onClick={() => {
                  setSidebarTab('general')
                  setSelectedClass(null)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '14px', border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  background: (sidebarTab === 'general' && !selectedClass) ? 'var(--primary-light)' : 'transparent',
                  color: (sidebarTab === 'general' && !selectedClass) ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: '700', fontSize: '13px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  if (sidebarTab !== 'general' || selectedClass) {
                    e.currentTarget.style.background = 'var(--surface-3)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  if (sidebarTab !== 'general' || selectedClass) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                General Discussion
              </button>

              <button
                className={`community-sidebar-tab ${(sidebarTab === 'announcements' && !selectedClass) ? 'active' : ''}`}
                onClick={() => {
                  setSidebarTab('announcements')
                  setSelectedClass(null)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '14px', border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  background: (sidebarTab === 'announcements' && !selectedClass) ? 'var(--primary-light)' : 'transparent',
                  color: (sidebarTab === 'announcements' && !selectedClass) ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: '700', fontSize: '13px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  if (sidebarTab !== 'announcements' || selectedClass) {
                    e.currentTarget.style.background = 'var(--surface-3)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  if (sidebarTab !== 'announcements' || selectedClass) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                Announcements
              </button>

              <button
                className="community-sidebar-tab"
                onClick={() => setGuidelinesOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '14px', border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: '700', fontSize: '13px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.background = 'var(--surface-3)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
	                Community Guidelines
	              </button>
	              <div
	                aria-hidden="true"
	                className="community-sidebar-divider"
	                style={{
	                  position: 'absolute',
	                  left: '6px',
	                  right: '6px',
	                  bottom: '-7px',
	                }}
	              />
	            </div>

            <div className="community-courses-panel">
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px', padding: '0 6px' }}>
                Communities
              </div>
              {shouldShowCourseSkeletons ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[1, 2, 3, 4].map(i => <CourseRowSkeleton key={i} compact />)}
                </div>
              ) : courseClasses.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px 10px' }}>
                  No courses available
                </div>
              ) : courseClasses.map((cls, idx, courseList) => {
                const active = selectedClass?.id === cls.id
                const isExpiredCommunity = isCommunityModerator && Boolean(cls.isExpired)
                const inactiveBackground = isExpiredCommunity
                  ? 'color-mix(in srgb, var(--surface-2) 72%, #64748b 28%)'
                  : 'color-mix(in srgb, var(--surface) 78%, var(--sidebar-bg) 22%)'
                const activeBackground = isExpiredCommunity
                  ? 'linear-gradient(135deg, #64748b, #475569)'
                  : cls.color
                const inactiveBorder = isExpiredCommunity
                  ? '1px solid color-mix(in srgb, #64748b 46%, var(--border) 54%)'
                  : '1px solid color-mix(in srgb, var(--border) 72%, transparent)'
                const inactiveShadow = isExpiredCommunity
                  ? '0 4px 12px rgba(71, 85, 105, 0.12)'
                  : '0 4px 12px rgba(15, 23, 42, 0.035)'
                return (
                <React.Fragment key={cls.id}>
	                <button
	                  onClick={() => setSelectedClass(cls)}
	                  className={`community-channel-btn ${active ? 'active' : ''}`}
	                style={{
	                  display: 'flex', alignItems: 'center', gap: isMobile ? '14px' : '0',
	                  padding: isMobile ? '14px 16px' : '11px 14px',
	                  borderRadius: isMobile ? '20px' : '14px',
	                  border: active ? 'none' : inactiveBorder,
	                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
	                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
	                  background: active ? activeBackground : inactiveBackground,
	                  color: active ? '#fff' : 'var(--community-item-text)',
	                  boxShadow: active
	                    ? isExpiredCommunity
                        ? '5px 5px 14px rgba(71, 85, 105, 0.28), -3px -3px 8px var(--community-item-shadow-light)'
                        : `5px 5px 14px ${cls.color}55, -3px -3px 8px var(--community-item-shadow-light)`
	                    : inactiveShadow,
	                  position: 'relative',
	                  minHeight: isMobile ? '64px' : '56px',
	                  width: '100%',
	                }}
	                onMouseEnter={e => {
	                  if (!active) {
	                    e.currentTarget.style.background = isExpiredCommunity
                        ? 'color-mix(in srgb, var(--surface-2) 64%, #64748b 36%)'
                        : 'color-mix(in srgb, var(--primary-light) 34%, var(--surface) 66%)'
	                    e.currentTarget.style.borderColor = isExpiredCommunity
                        ? 'color-mix(in srgb, #64748b 62%, var(--border) 38%)'
                        : 'color-mix(in srgb, var(--primary) 42%, var(--border) 58%)'
	                    e.currentTarget.style.color = 'var(--text-primary)'
	                    e.currentTarget.style.transform = 'translateY(-2px)'
	                    e.currentTarget.style.boxShadow = isExpiredCommunity
                        ? '0 8px 18px rgba(71, 85, 105, 0.18)'
                        : '0 8px 18px rgba(54,54,232,0.14)'
	                  }
	                }}
	                onMouseLeave={e => {
	                  if (!active) {
	                    e.currentTarget.style.background = inactiveBackground
	                    e.currentTarget.style.borderColor = isExpiredCommunity
                        ? 'color-mix(in srgb, #64748b 46%, var(--border) 54%)'
                        : 'color-mix(in srgb, var(--border) 72%, transparent)'
	                    e.currentTarget.style.color = 'var(--community-item-text)'
	                    e.currentTarget.style.transform = 'translateY(0)'
	                    e.currentTarget.style.boxShadow = inactiveShadow
	                  }
	                }}
	                onMouseDown={e => {
	                  e.currentTarget.style.transform = 'translateY(0) scale(0.98)'
	                }}
	                onMouseUp={e => {
	                  if (!active) {
	                    e.currentTarget.style.transform = 'translateY(-2px)'
	                  } else {
	                    e.currentTarget.style.transform = 'translateY(0)'
	                  }
	                }}
	              >
	                {cls.hasUnread && !active && (
	                  <div style={{ position: 'absolute', top: '10px', right: '12px', width: '9px', height: '9px', borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 6px rgba(239,68,68,0.6)' }} />
	                )}
	                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
	                  <div style={{ fontSize: isMobile ? '14.5px' : '14px', fontWeight: '850', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', lineHeight: 1.2 }}>
	                    {cls.name}
	                  </div>
	                  {cls.subject && (
	                    <div style={{ fontSize: isMobile ? '12px' : '12px', opacity: active ? 0.85 : 0.62, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 650, lineHeight: 1.2 }}>
	                      {cls.subject}
	                    </div>
	                  )}
                  {userRole === 'MANAGER' && cls.isCommunityActive === false && (
                    <div style={{ fontSize: '10px', fontWeight: '800', marginTop: '4px', color: active ? '#fff' : 'var(--danger)' }}>
                      COMMUNITY OFF
                    </div>
                  )}
                  {isExpiredCommunity && (
                    <div style={{ fontSize: '10px', fontWeight: '900', marginTop: '4px', color: active ? '#fff' : '#64748b', letterSpacing: '0.08em' }}>
                      EXPIRED
                    </div>
                  )}
                </div>
	                {isMobile && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#ffffff' : 'var(--text-muted)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: '4px' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
                </button>
	                </React.Fragment>
                )
              })}
            </div>
          </>
        )}

        {/* Direct Messages section — hidden for students with zero DMs, and hidden entirely on mobile views */}
        {!isMobile && (shouldShowDirectSkeletons || userRole === 'MANAGER' || directChatClasses.length > 0) && (
          <>
            <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '12px 0 4px', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Direct Messages</span>
              {userRole === 'MANAGER' && (
                <button
                  onClick={() => setShowNewDMModal(true)}
                  title="New Direct Chat"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', padding: '2px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              )}
            </div>
            {shouldShowDirectSkeletons ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1, 2, 3].map(i => <DirectMessageSkeleton key={i} />)}
              </div>
            ) : directChatClasses.map(cls => (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls)}
                className={`dm-channel-btn ${selectedClass?.id === cls.id ? 'active' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '18px', border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  background: selectedClass?.id === cls.id ? '#3636e8' : undefined,
                  color: selectedClass?.id === cls.id ? '#fff' : 'var(--community-item-text)',
                  boxShadow: selectedClass?.id === cls.id
                    ? '5px 5px 12px rgba(54,54,232,0.35), -3px -3px 8px var(--community-item-shadow-light)'
                    : undefined,
                  opacity: cls.isDmDisabled ? 0.55 : 1,
                  position: 'relative'
                }}
              >
                {cls.hasUnread && selectedClass?.id !== cls.id && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 6px rgba(239,68,68,0.6)' }} />
                )}
                <UserAvatar
                  user={{ name: cls.name.replace('Chat with ', ''), avatar: cls.avatar, gender: cls.gender, role: cls.role }}
                  size={32}
                  style={{
                    border: selectedClass?.id === cls.id ? '2px solid rgba(255,255,255,0.35)' : '2px solid var(--primary-light)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: cls.isDmDisabled ? '2px' : 0, paddingRight: cls.hasUnread && selectedClass?.id !== cls.id ? '12px' : 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.name.replace('Chat with ', '')}</span>
                  </div>
                  {cls.isDmDisabled && (
                    <div style={{ fontSize: '10px', opacity: 0.68, fontWeight: '700' }}>
                      Hidden From Student
                    </div>
                  )}
                </div>
              </button>
            ))}
            {!shouldShowDirectSkeletons && directChatClasses.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '8px 10px' }}>
                {userRole === 'MANAGER' ? 'No active DMs — click + to start one' : 'No direct messages yet'}
              </div>
            )}
          </>
        )}

        {/* System Rules & Limits Button for Manager */}
        {userRole === 'MANAGER' && (
          <button
            onClick={() => setRulesOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', borderRadius: '14px',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              marginTop: '16px', width: '100%'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.background = 'var(--surface-3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.background = 'var(--surface-2)'
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            System Rules & Limits
          </button>
        )}

        </div>
      </div>

      {/* Right: Chat area */}
      <div style={{ 
        flex: 1, 
        borderRadius: isMobile ? '0' : '24px', 
        ...(isMobile ? {} : neu), 
        display: (isMobile && !selectedClass && !isMobileGeneralOpen) ? 'none' : 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden', 
        minWidth: 0,
        ...(isMobile ? { height: '100dvh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: 'var(--surface)', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : {}),
      }}>
        {!selectedClass && sidebarTab === 'general' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: isMobile ? '12px 14px' : '16px 22px', borderBottom: '1.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isMobileGeneralOpen && (
                  <button
                    onClick={() => setMobileForumOpen(false)}
                    aria-label="Back to communities"
                    style={{
                      width: '36px', height: '36px', borderRadius: '12px', border: 'none',
                      background: 'var(--surface-2)', color: 'var(--text-primary)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      boxShadow: '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12"/>
                      <polyline points="12 19 5 12 12 5"/>
                    </svg>
                  </button>
                )}
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>General Discussion</div>
                </div>
              </div>
              {/* Guidelines Button */}
              <button
                onClick={() => setGuidelinesOpen(true)}
                style={{
                  padding: '6px 12px', borderRadius: '10px', background: 'none', border: '1.5px solid var(--border)',
                  fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Guidelines
              </button>
            </div>

            {/* Feed Wall */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--surface-2)' }}>
              {/* Composer Card */}
              {shouldShowCourseSkeletons ? (
                <ComposerSkeleton />
              ) : (isMobile || isCapacitor || courseClasses.length > 0) && (
                <div style={{
                  background: 'var(--surface)', borderRadius: '20px', padding: '18px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {loadingUser ? (
                      <SkeletonBlock style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0 }} />
                    ) : (
                      <UserAvatar
                        user={{ name: userName, avatar: userAvatar, gender: userGender }}
                        size={38}
                      />
                    )}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <textarea
                        ref={generalComposerRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value.slice(0, 500))}
                        placeholder="What's happening in your class? Ask a question or share updates..."
                        style={{
                          width: '100%', minHeight: '80px', border: 'none', resize: 'none', outline: 'none',
                          background: 'none', fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'inherit',
                          padding: '4px 0'
                        }}
                      />
                      <div style={{ position: 'absolute', bottom: '-10px', right: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {input.length}/500
                      </div>
                    </div>
                  </div>

                  {/* Attachment Preview */}
                  {pendingImagePreview && (
                    <div style={{ position: 'relative', width: 'fit-content', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', padding: pendingImage?.type.startsWith('image/') ? '0' : '10px 16px', background: pendingImage?.type.startsWith('image/') ? 'transparent' : 'var(--surface-2)' }}>
                      {pendingImage?.type.startsWith('image/') ? (
                        <img src={pendingImagePreview} alt="Upload preview" style={{ maxHeight: '150px', display: 'block' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', paddingRight: '20px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                          <span>{pendingImagePreview}</span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setPendingImage(null);
                          setPendingImagePreview(null);
                          if (imageInputRef.current) imageInputRef.current.value = '';
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        style={{
                          position: 'absolute', top: pendingImage?.type.startsWith('image/') ? '6px' : '50%', right: '6px', transform: pendingImage?.type.startsWith('image/') ? 'none' : 'translateY(-50%)', width: '24px', height: '24px',
                          borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {editingMessage?.courseId === 'general-discussion' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '9px 12px',
                      borderRadius: '12px',
                      background: 'rgba(217, 119, 6, 0.08)',
                      color: '#d97706',
                      fontSize: '12px',
                      fontWeight: 800,
                    }}>
                      <span>Editing post</span>
                      <button
                        onClick={() => {
                          setEditingMessage(null)
                          setInput('')
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#d97706',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 900,
                          fontFamily: 'inherit',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Composer Footer Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12.5px', flexWrap: 'wrap' }}>
                      {/* Image Picker */}
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '750'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        Image
                      </button>
                      <input
                        type="file"
                        ref={imageInputRef}
                        onChange={handleImageSelect}
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                      />

                      {/* Document Picker */}
                      <button
                        onClick={async () => {
                          const allowed = await confirm({
                            title: 'Upload Document Guidelines',
                            message: 'Maximum allowed file size is 20 MB only max. Supported formats: PDF, PPT, DOCX, ZIP, XLS.',
                            confirmLabel: 'Select File',
                            cancelLabel: 'Cancel',
                            tone: 'default'
                          });
                          if (allowed) {
                            fileInputRef.current?.click();
                          }
                        }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '750'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        Document
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                        style={{ display: 'none' }}
                      />

                      {/* Emoji Picker */}
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setShowGeneralEmojiPicker(!showGeneralEmojiPicker)}
                          style={{
                            background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '750'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                            <line x1="9" y1="9" x2="9.01" y2="9" />
                            <line x1="15" y1="9" x2="15.01" y2="9" />
                          </svg>
                          Emoji
                        </button>
                        {showGeneralEmojiPicker && (
                          <>
                            <div
                              onClick={() => setShowGeneralEmojiPicker(false)}
                              style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                            />
                            <div style={{
                              position: 'absolute', bottom: '30px', left: 0,
                              background: 'var(--sidebar-bg)', borderRadius: '16px',
                              border: '1px solid var(--border)',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              padding: '12px', width: '280px', zIndex: 50,
                            }}>
                              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Emojis</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {['😂','😭','😅','🙂','😎','🤔','❤️','🔥','👏','👍','🙏','🎉','🥳','📚','📝','🎓','💯','✅','❌','⏰','💡','😤','🫡','💪','🤝','😴','🤯','👀','😬','🫠'].map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={() => {
                                      setInput(prev => prev + emoji);
                                      setShowGeneralEmojiPicker(false);
                                    }}
                                    style={{
                                      width: '36px', height: '36px', fontSize: '20px',
                                      background: 'none', border: 'none', borderRadius: '8px',
                                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(54,54,232,0.08)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>


                    </div>

                    <button
                      onClick={async () => {
                        if (!input.trim() && !pendingImage) return;

                        setUploadingImage(true);
                        const isEditingGeneralPost = editingMessage?.courseId === 'general-discussion'
                        let imageUrl: string | null = null;
                        if (!isEditingGeneralPost && pendingImage) {
                          try {
                            if (isDocumentAttachment(pendingImage)) {
                              setUploadProgress(0);
                              setUploadFileName(pendingImage.name);
                              const controller = new AbortController();
                              abortControllerRef.current = controller;
                              imageUrl = await uploadFileWithProgress(pendingImage, setUploadProgress, controller.signal);
                              setUploadProgress(null);
                              setUploadFileName('');
                              abortControllerRef.current = null;
                            } else {
                              const formData = new FormData();
                              formData.append('file', pendingImage);
                              const uploadRes = await fetch('/api/upload/chat-image', { method: 'POST', body: formData });
                              const uploadData = await uploadRes.json();
                              if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
                              imageUrl = uploadData.url;
                            }
                          } catch (err) {
                            if (err instanceof Error && err.message === 'Upload cancelled') {
                              // silent cancel
                            } else {
                              console.error('General Discussion attachment upload failed:', err);
                              await confirm({
                                title: 'Upload Failed',
                                message: pendingImage && isDocumentAttachment(pendingImage)
                                  ? "Couldn't upload the document. Please try again."
                                  : "Couldn't upload the attachment. Please try again.",
                                confirmLabel: 'OK',
                                tone: 'danger'
                              });
                            }
                            setUploadingImage(false);
                            setUploadProgress(null);
                            abortControllerRef.current = null;
                            return;
                          }
                        }
                        // Done upload

                        try {
                          if (isEditingGeneralPost && editingMessage) {
                            const res = await fetch(`/api/community/general-discussion/messages`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ messageId: editingMessage.id, content: input })
                            });
                            if (!res.ok) {
                              const errData = await res.json();
                              throw new Error(errData.error || 'Failed to edit post');
                            }
                            setInput('');
                            setEditingMessage(null);
                            loadGeneralDiscussionPosts();
                            return;
                          }
                          const res = await fetch(`/api/community/general-discussion/messages`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: input, imageUrl })
                          });
                          if (res.ok) {
                            setInput('');
                            clearPendingImage();
                            loadGeneralDiscussionPosts();
                          } else {
                            const errData = await res.json();
                            alert(errData.error || 'Failed to post message');
                          }
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setUploadingImage(false);
                        }
                      }}
                      disabled={uploadingImage || (!input.trim() && !pendingImage)}
                      style={{
                        padding: '8px 16px', borderRadius: '50px', background: 'var(--primary)',
                        color: 'white', border: 'none', fontWeight: '800', fontSize: '13px',
                        cursor: 'pointer', opacity: (uploadingImage || (!input.trim() && !pendingImage)) ? 0.6 : 1,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      {uploadingImage ? 'Uploading...' : editingMessage?.courseId === 'general-discussion' ? 'Save' : 'Post'}
                    </button>
                  </div>
                </div>
              )}

              {/* Sorting Filter Row */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                {(['recent', 'popular', 'unanswered'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setGeneralFeedFilter(filter)}
                    style={{
                      padding: '6px 14px', borderRadius: '50px', border: 'none', cursor: 'pointer',
                      fontSize: '12px', fontWeight: '800', transition: 'all 0.2s',
                      background: generalFeedFilter === filter ? 'var(--primary-light)' : 'transparent',
                      color: generalFeedFilter === filter ? 'var(--primary)' : 'var(--text-secondary)'
                    }}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>

              {generalFeedError && (
                <div role="alert" style={{ color: 'var(--danger)', padding: '12px' }}>
                  {generalFeedError}{' '}
                  <button onClick={() => loadGeneralDiscussionPosts(generalDiscussionPosts.length > 0)} disabled={loadingGeneralFeed}>Retry</button>
                </div>
              )}
              {/* Posts Stream */}
              {loadingGeneralFeed && generalDiscussionPosts.length === 0 ? (
                <PostFeedSkeleton count={3} />
              ) : (
                (() => {
                  const visibleGeneralMessages = generalDiscussionPosts.filter(m => !m.isDeleted && !m.deletedAt && !(m as any).isSystemDeleted);
                  const mainPosts = visibleGeneralMessages.filter(m => !m.replyToId);
                  const sortedPosts = [...mainPosts];

                // Sort client side based on filter
                if (generalFeedFilter === 'recent') {
                  sortedPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                } else if (generalFeedFilter === 'popular') {
                  const getInteractionCount = (m: any) => {
                    let likes = 0;
                    try { likes = JSON.parse(m.likes || '[]').length; } catch (e) {}
                    let rxCount = 0;
                    try {
                      const rx = JSON.parse(m.reactions || '{}');
                      Object.keys(rx).forEach(k => {
                        if (!k.startsWith('__')) rxCount += Array.isArray(rx[k]) ? rx[k].length : 0;
                      });
                    } catch (e) {}
                    return likes + rxCount;
                  };
                  sortedPosts.sort((a, b) => getInteractionCount(b) - getInteractionCount(a));
                } else if (generalFeedFilter === 'unanswered') {
                  const filtered = sortedPosts.filter(p => visibleGeneralMessages.filter(r => r.replyToId === p.id).length === 0);
                  sortedPosts.length = 0;
                  sortedPosts.push(...filtered);
                }
                sortedPosts.sort((a, b) => {
                  if (!!a.isPinned === !!b.isPinned) return 0;
                  return a.isPinned ? -1 : 1;
                });

                if (sortedPosts.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                        </svg>
                      </div>
                      <p style={{ fontWeight: '700', marginTop: '12px' }}>No posts match this filter</p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {sortedPosts.map(post => {
                      const comments = visibleGeneralMessages.filter(r => r.replyToId === post.id);
                      let likesList: string[] = [];
                      try { likesList = JSON.parse(post.likes || '[]'); } catch(e){}
                      const userHasLiked = likesList.includes(userId);

                      let reactionsObj: Record<string, string[]> = {};
                      try { reactionsObj = JSON.parse(post.reactions || '{}'); } catch(e){}

                      const commentsOpen = expandedCommentsMessageId === post.id;
                      const canEditPost = canEditOwnGeneralPost(post);
                      const canDeletePost = canDeleteGeneralPost(post);
                      const canManageGeneralPost = userRole === 'MANAGER';
                      const isHighlighted = Array.isArray((reactionsObj as any).__highlight);

                      return (
                        <div key={post.id} style={{
                          background: isHighlighted ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.10), var(--surface) 46%)' : 'var(--surface)',
                          borderRadius: '20px',
                          padding: '18px',
                          border: isHighlighted ? '1.5px solid rgba(245, 158, 11, 0.48)' : '1px solid var(--border)',
                          boxShadow: isHighlighted ? '0 10px 24px rgba(245, 158, 11, 0.10)' : '0 4px 12px rgba(0,0,0,0.01)',
                          display: 'flex', flexDirection: 'column', gap: '12px'
                        }}>
                          {/* Post Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <UserAvatar
                                user={post.sender}
                                size={36}
                                onClick={() => openUserIdentity(post.sender)}
                              />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                                  <button
                                    onClick={() => openUserIdentity(post.sender)}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      padding: 0,
                                      fontWeight: '800',
                                      fontSize: '13.5px',
                                      color: 'var(--primary)',
                                      cursor: 'pointer',
                                      fontFamily: 'inherit',
                                      textAlign: 'left',
                                    }}
                                  >
                                    {post.sender.name}
                                  </button>
                                  <StaffRoleBadge role={post.sender.role} />
                                  {post.isPinned && (
                                    <span style={{
                                      fontSize: '9px',
                                      color: '#d97706',
                                      background: 'rgba(217, 119, 6, 0.12)',
                                      border: '1px solid rgba(217, 119, 6, 0.22)',
                                      padding: '2px 8px',
                                      borderRadius: '50px',
                                      fontWeight: 900,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}>
                                      Pinned
                                    </span>
                                  )}
                                  {isHighlighted && (
                                    <span style={{
                                      fontSize: '9px',
                                      color: '#b45309',
                                      background: 'rgba(245, 158, 11, 0.14)',
                                      border: '1px solid rgba(245, 158, 11, 0.25)',
                                      padding: '2px 8px',
                                      borderRadius: '50px',
                                      fontWeight: 900,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}>
                                      Highlighted
                                    </span>
                                  )}
                                  {post.isEdited && (
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>(edited)</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                  {new Date(post.createdAt).toLocaleDateString()} at {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                            {(canManageGeneralPost || canEditPost || canDeletePost) && (
                              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                {canManageGeneralPost && (
                                  <>
                                    <button
                                      onClick={async () => {
                                        try {
                                          await fetch(`/api/community/${post.courseId}/messages/${post.id}/pin`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ action: post.isPinned ? 'unpin' : 'pin' })
                                          });
                                          loadGeneralDiscussionPosts();
                                        } catch (e) {}
                                      }}
                                      title={post.isPinned ? 'Unpin post' : 'Pin post'}
                                      style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border)',
                                        background: post.isPinned ? 'rgba(217, 119, 6, 0.12)' : 'var(--surface-2)',
                                        color: post.isPinned ? '#d97706' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill={post.isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="17" x2="12" y2="22"/>
                                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        try {
                                          await fetch(`/api/community/${post.courseId}/messages/${post.id}/pin`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ action: isHighlighted ? 'unhighlight' : 'highlight' })
                                          });
                                          loadGeneralDiscussionPosts();
                                        } catch (e) {}
                                      }}
                                      title={isHighlighted ? 'Remove highlight' : 'Highlight post'}
                                      style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border)',
                                        background: isHighlighted ? 'rgba(245, 158, 11, 0.16)' : 'var(--surface-2)',
                                        color: isHighlighted ? '#b45309' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill={isHighlighted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                      </svg>
                                    </button>
                                  </>
                                )}
                                {canEditPost && (
                                  <button
                                    onClick={() => startGeneralPostEdit(post)}
                                    title="Edit post"
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      borderRadius: '10px',
                                      border: '1px solid var(--border)',
                                      background: 'var(--surface-2)',
                                      color: '#d97706',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
                                    </svg>
                                  </button>
                                )}
                                {canDeletePost && (
                                  <button
                                    onClick={() => deleteGeneralPost(post)}
                                    title={userRole === 'MANAGER' ? 'Delete post' : 'Delete post within 24 hours'}
                                    disabled={deletingId === post.id}
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      borderRadius: '10px',
                                      border: '1px solid var(--border)',
                                      background: 'var(--danger-light)',
                                      color: 'var(--danger)',
                                      cursor: deletingId === post.id ? 'wait' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      opacity: deletingId === post.id ? 0.65 : 1,
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                      <path d="M10 11v6"/>
                                      <path d="M14 11v6"/>
                                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Post Body */}
                          <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {post.content}
                          </div>

                          {post.imageUrl && <CommunityAttachment url={post.imageUrl} native={isCapacitor} onImageClick={setLightboxUrl} />}


                          {/* Reactions Summary */}
                          {likesList.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                              <div style={{
                                fontSize: '11px', padding: '4px 8px', borderRadius: '50px', background: 'var(--surface-2)',
                                color: 'var(--text-secondary)', border: '1px solid var(--border)', fontWeight: '750',
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ef4444' }}>
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                </svg>
                                {likesList.length}
                              </div>
                            </div>
                          )}

                          {/* Post Footer Actions */}
                          <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                            <button
                              onClick={async () => {
                                try {
                                  await fetch(`/api/community/${post.courseId}/messages/${post.id}/pin`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'like' })
                                  });
                                  loadGeneralDiscussionPosts();
                                } catch (e){}
                              }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '800',
                                color: userHasLiked ? 'var(--primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px'
                              }}
                            >
                              {userHasLiked ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--primary)' }}>
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                              )}
                              <span>Like</span>
                            </button>

                            <button
                              onClick={() => setExpandedCommentsMessageId(commentsOpen ? null : post.id)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '800',
                                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px'
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                              </svg>
                              <span>Comments ({comments.length})</span>
                            </button>
                          </div>

                          {/* Expanded Comments Section */}
                          {commentsOpen && (
                            <div style={{
                              marginTop: '8px', borderTop: '1.5px solid var(--border)', paddingTop: '12px',
                              display: 'flex', flexDirection: 'column', gap: '10px'
                            }}>
                              {/* Comments stream */}
                              {comments.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                                  {comments.map(comment => {
                                    let cLikes: string[] = [];
                                    try { cLikes = JSON.parse(comment.likes || '[]'); } catch(e){}
                                    const cLiked = cLikes.includes(userId);
                                    const canEditComment = canEditOwnGeneralPost(comment);
                                    const canDeleteComment = canDeleteGeneralPost(comment);

                                    return (
                                      <div key={comment.id} style={{
                                        background: 'var(--surface-2)', borderRadius: '12px', padding: '10px 14px',
                                        display: 'flex', flexDirection: 'column', gap: '4px'
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                                            <UserAvatar
                                              user={comment.sender}
                                              size={24}
                                              onClick={() => openUserIdentity(comment.sender)}
                                            />
                                            <button
                                              onClick={() => openUserIdentity(comment.sender)}
                                              style={{
                                                border: 'none',
                                                background: 'transparent',
                                                padding: 0,
                                                fontWeight: '800',
                                                fontSize: '12px',
                                                color: 'var(--primary)',
                                                cursor: 'pointer',
                                                fontFamily: 'inherit',
                                                textAlign: 'left',
                                              }}
                                            >
                                              {comment.sender.name}
                                            </button>
                                            <StaffRoleBadge role={comment.sender.role} />
                                            {comment.isEdited && (
                                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>(edited)</span>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(comment.createdAt).toLocaleDateString()}</span>
                                            {canEditComment && (
                                              <button
                                                onClick={() => startGeneralPostEdit(comment)}
                                                title="Edit comment"
                                                style={{ border: 'none', background: 'transparent', color: '#d97706', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                              >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
                                                </svg>
                                              </button>
                                            )}
                                            {canDeleteComment && (
                                              <button
                                                onClick={() => deleteGeneralPost(comment)}
                                                title={userRole === 'MANAGER' ? 'Delete comment' : 'Delete comment within 24 hours'}
                                                disabled={deletingId === comment.id}
                                                style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: deletingId === comment.id ? 'wait' : 'pointer', padding: '2px', display: 'flex', opacity: deletingId === comment.id ? 0.65 : 1 }}
                                              >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                  <polyline points="3 6 5 6 21 6"/>
                                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                                  <path d="M10 11v6"/>
                                                  <path d="M14 11v6"/>
                                                </svg>
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>{comment.content}</p>
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                          <button
                                            onClick={async () => {
                                              try {
                                                await fetch(`/api/community/${post.courseId}/messages/${comment.id}/pin`, {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ action: 'like' })
                                                });
                                                loadGeneralDiscussionPosts();
                                              } catch (e){}
                                            }}
                                            style={{
                                              background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px',
                                              color: cLiked ? 'var(--primary)' : 'var(--text-muted)', fontWeight: '750',
                                              display: 'flex', alignItems: 'center', gap: '4px'
                                            }}
                                          >
                                            {cLiked ? (
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--primary)' }}>
                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                              </svg>
                                            ) : (
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                              </svg>
                                            )}
                                            <span>{cLikes.length > 0 ? cLikes.length : 'Like'}</span>
                                          </button>
                                        </div>
                                        {comment.imageUrl && <CommunityAttachment url={comment.imageUrl} native={isCapacitor} onImageClick={setLightboxUrl} />}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0' }}>No comments yet. Start the conversation!</p>
                              )}

                              {/* Comment Composer */}
                              {comments.length < 200 ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                                  <input
                                    type="text"
                                    value={commentInputMap[post.id] || ''}
                                    onChange={(e) => setCommentInputMap(prev => ({ ...prev, [post.id]: e.target.value.slice(0, 300) }))}
                                    placeholder="Write a comment... (max 300 chars)"
                                    style={{
                                      flex: 1, padding: '8px 14px', borderRadius: '50px', border: '1.5px solid var(--border)',
                                      background: 'var(--surface-2)', color: 'var(--text-primary)', fontSize: '12.5px', outline: 'none'
                                    }}
                                    onKeyDown={async (e) => {
                                      if (e.key === 'Enter') {
                                        const cText = commentInputMap[post.id] || '';
                                        if (!cText.trim()) return;
                                        try {
                                          const res = await fetch(`/api/community/${post.courseId}/messages`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ content: cText, replyToId: post.id })
                                          });
                                          if (res.ok) {
                                            setCommentInputMap(prev => ({ ...prev, [post.id]: '' }));
                                            loadGeneralDiscussionPosts();
                                          } else {
                                            const errData = await res.json();
                                            alert(errData.error || 'Failed to comment');
                                          }
                                        } catch (e){}
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={async () => {
                                      const cText = commentInputMap[post.id] || '';
                                      if (!cText.trim()) return;
                                      try {
                                        const res = await fetch(`/api/community/${post.courseId}/messages`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ content: cText, replyToId: post.id })
                                        });
                                        if (res.ok) {
                                          setCommentInputMap(prev => ({ ...prev, [post.id]: '' }));
                                          loadGeneralDiscussionPosts();
                                        } else {
                                          const errData = await res.json();
                                          alert(errData.error || 'Failed to comment');
                                        }
                                      } catch (e){}
                                    }}
                                    style={{
                                      padding: '8px 14px', borderRadius: '50px', background: 'var(--primary)',
                                      color: '#white', border: 'none', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
                                    }}
                                  >
                                    Reply
                                  </button>
                                </div>
                              ) : (
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Comments locked (reached limit of 200 comments per post)</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  </div>
                );
              })())}
              {generalHasMore && (
                <button
                  onClick={() => loadGeneralDiscussionPosts(true)}
                  disabled={loadingGeneralFeed}
                  style={{ alignSelf: 'center', flexShrink: 0, padding: '12px 24px', borderRadius: '50px', background: 'var(--surface-3)', border: '1.5px solid var(--border)', color: 'var(--text-primary)', fontWeight: '800', cursor: loadingGeneralFeed ? 'wait' : 'pointer' }}
                >
                  {loadingGeneralFeed ? 'Loading…' : 'Load More Posts'}
                </button>
              )}
            </div>
          </div>
        ) : !selectedClass && sidebarTab === 'announcements' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Header */}
            <div style={{ padding: isMobile ? '12px 14px' : '16px clamp(14px, 2vw, 22px)', borderBottom: '1.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>Announcements</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>Official notifications and course announcements</div>
              </div>
            </div>

            {/* Announcements Wall */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '14px' : 'clamp(14px, 2vw, 24px)', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--surface-2)', minWidth: 0 }}>
              {loadingAnnouncements ? (
                <PostFeedSkeleton count={2} />
              ) : announcements.length === 0 ? (
                <div style={{ padding: '24px', borderRadius: '20px', background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                  </div>
                  <h4 style={{ margin: '12px 0 6px 0', fontWeight: '800', color: 'var(--text-primary)' }}>Official Announcements</h4>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    There are no global announcements at this moment. Course-specific announcements can be viewed inside individual course forums.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                  {announcements.map((ann) => (
                    <div key={ann.id} style={{
                      background: 'var(--surface)', borderRadius: '20px', padding: '20px',
                      border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                      display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0, overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minWidth: 0 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{ann.title}</h4>
                            {ann.course && (
                              <span style={{
                                fontSize: '9px', fontWeight: '800', padding: '2px 8px', borderRadius: '50px',
                                background: ann.course.color + '15', color: ann.course.color, maxWidth: '100%', overflowWrap: 'anywhere'
                              }}>
                                {ann.course.name}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '4px', overflowWrap: 'anywhere' }}>
                            Posted on {new Date(ann.createdAt).toLocaleDateString()} by {ann.createdBy?.name || 'Staff'}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {stripAnnouncementMeta(ann.content)}
                      </div>

                      {ann.attachmentUrl && (
                        <div style={{
                          marginTop: '8px', padding: '12px 16px', borderRadius: '14px', background: 'var(--surface-2)',
                          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: '12px', flexWrap: 'wrap', minWidth: 0
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              📄
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{ann.attachmentName || 'Attachment'}</div>
                              {ann.attachmentSize && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{Math.round(ann.attachmentSize / 1024)} KB</div>
                              )}
                            </div>
                          </div>
                          <a
                            href={ann.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '6px 14px', borderRadius: '50px', background: 'var(--surface)',
                              color: 'var(--text-primary)', border: '1.5px solid var(--border)', fontSize: '12px',
                              fontWeight: '800', textDecoration: 'none'
                            }}
                          >
                            Download
                          </a>
                        </div>
                      )}

                      {ann.ctaText && ann.ctaLink && (
                        <a
                          href={ann.ctaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            marginTop: '8px', width: 'fit-content', padding: '8px 18px', borderRadius: '50px',
                            background: 'var(--primary)', color: 'white', fontWeight: '800', fontSize: '12.5px',
                            textDecoration: 'none', textAlign: 'center'
                          }}
                        >
                          {ann.ctaText}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : !selectedClass ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', color: 'var(--text-muted)', padding: '40px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p style={{ fontWeight: '700', fontSize: '15px', margin: 0 }}>Tap on a community to start chatting</p>
            <p style={{ fontSize: '12px', margin: 0, opacity: 0.7, textAlign: 'center', lineHeight: 1.5 }}>Select any course community from the left panel to view messages and chat with your coursemates.</p>
          </div>
        ) : loadingMessages && messages.length === 0 ? (
          <ChatThreadSkeleton />
        ) : (
          <>
            {/* Header */}
            {selectedMessage ? (
              <div style={{ 
                padding: isMobile ? '12px 14px' : '16px 22px', 
                borderBottom: '1.5px solid rgba(0,0,0,0.06)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                background: 'var(--primary-light)', // Vibrant light indigo highlight for selection
                transition: 'all 0.3s ease',
              }}>
                <button
                  onClick={() => setSelectedMessage(null)}
                  title="Cancel selection"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'var(--surface)',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)',
                    color: 'var(--primary)',
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '850', fontSize: '16px', color: 'var(--text-primary)' }}>
                    1 message selected
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {/* Reply Button */}
                  <button
                    onClick={() => {
                      setReplyingTo(selectedMessage)
                      setSelectedMessage(null)
                    }}
                    title="Reply to message"
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'var(--surface)',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '2px 2px 5px rgba(0,0,0,0.08), -2px -2px 5px var(--neu-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 17 4 12 9 7"/>
                      <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                    </svg>
                  </button>

                  {/* Edit Button */}
                  {(userRole === 'MANAGER' || (userRole === 'ADMIN' || userRole === 'MODERATOR')) && selectedMessage.sender.id === userId && !selectedMessage.isDeleted && !selectedMessage.id.startsWith('temp-') && (
                    <button
                      onClick={() => {
                        setEditingMessage(selectedMessage)
                        setEditContent(selectedMessage.content)
                        setSelectedMessage(null)
                      }}
                      title="Edit message"
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'var(--surface)',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '2px 2px 5px rgba(0,0,0,0.08), -2px -2px 5px var(--neu-light)',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
                      </svg>
                    </button>
                  )}

                  {/* Copy Button */}
                  {selectedMessage.content && (
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(selectedMessage.content)
                        }
                        setSelectedMessage(null)
                      }}
                      title="Copy content"
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'var(--surface)',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '2px 2px 5px rgba(0,0,0,0.08), -2px -2px 5px var(--neu-light)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                  )}

                  {/* Delete Button */}
                  {(userRole === 'MANAGER' || selectedMessage.sender.id === userId) && !selectedMessage.id.startsWith('temp-') && (
                    <button
                      onClick={() => {
                        deleteMessage(selectedMessage.id)
                        setSelectedMessage(null)
                      }}
                      title="Delete message"
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'var(--danger-light)',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '2px 2px 5px rgba(239,68,68,0.15), -2px -2px 5px var(--neu-light)',
                        color: 'var(--danger)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/>
                        <path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: isMobile ? '12px 14px' : '16px 22px', borderBottom: '1.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px', flexWrap: 'wrap', flexShrink: 0 }}>
                {isMobile && (
                  <button
                    onClick={() => setSelectedClass(null)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: 'var(--surface)',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)',
                      color: 'var(--text-secondary)',
                      marginRight: '4px',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12"/>
                      <polyline points="12 19 5 12 12 5"/>
                    </svg>
                  </button>
                )}
                {isDM(selectedClass) ? (
                  <UserAvatar
                    user={{ name: selectedClass.name.replace('Chat with ', ''), avatar: selectedClass.avatar, gender: selectedClass.gender, role: selectedClass.role }}
                    size={isMobile ? 36 : 40}
                    style={{ border: '2px solid var(--primary-light)' }}
                  />
                ) : (
                  <CourseIconBadge
                    type={selectedClass.courseIconType || selectedClass.icon}
                    size={isMobile ? 36 : 40}
                    iconSize={isMobile ? 18 : 20}
                    radius={12}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                    <div style={{ fontWeight: '800', fontSize: isMobile ? '15px' : '16px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {isDM(selectedClass) ? selectedClass.name.replace('Chat with ', '') : selectedClass.name}
                    </div>
                    {isDM(selectedClass) && <StaffRoleBadge role={selectedClass.role} />}
                    {!isDM(selectedClass) && isCommunityModerator && selectedClass.isExpired && (
                      <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'color-mix(in srgb, #64748b 16%, var(--surface-2) 84%)', border: '1px solid color-mix(in srgb, #64748b 36%, var(--border) 64%)', color: '#64748b', fontSize: '10px', fontWeight: 900, letterSpacing: '0.06em' }}>
                        EXPIRED
                      </span>
                    )}
                  </div>
                  {isDM(selectedClass) ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Direct Message</div>
                  ) : selectedClass.subject && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedClass.subject} · {isCommunityModerator && selectedClass.isExpired ? 'Expired Community' : 'Community Chat'}</div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                  {!isDM(selectedClass) && selectedClass.isCommunityActive === false && (
                    <span style={{ padding: '4px 10px', borderRadius: '50px', background: 'var(--danger-light)', color: 'var(--danger)', fontSize: '11px', fontWeight: '700' }}>
                      Off
                    </span>
                  )}
                  {isDM(selectedClass) && selectedClass.isDmDisabled && (
                    <span style={{ padding: '4px 10px', borderRadius: '50px', background: 'var(--danger-light)', color: 'var(--danger)', fontSize: '11px', fontWeight: '700' }}>
                      Hidden
                    </span>
                  )}

                  {/* Guidelines Button */}
                  {!isMobile && !isCapacitor && !isDM(selectedClass) && (
                    <button
                      onClick={() => setGuidelinesOpen(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 14px', borderRadius: '50px',
                        background: 'var(--surface-2)', border: '1.5px solid var(--border)',
                        color: 'var(--text-primary)', fontSize: '12px', fontWeight: '800',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      Guidelines
                    </button>
                  )}

                  <div style={{ position: 'relative', zIndex: activeMenuId === 'active-header' ? menuLayerZIndex : 10 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuId(activeMenuId === 'active-header' ? null : 'active-header')
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '50%',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s',
                        width: '36px',
                        height: '36px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>
                    {activeMenuId === 'active-header' && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: '40px',
                          right: '0px',
                          background: 'var(--surface)',
                          borderRadius: '16px',
                          boxShadow: '0 10px 28px rgba(0,0,0,0.15)',
                          border: '1px solid rgba(0,0,0,0.06)',
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          zIndex: 1000,
                          minWidth: '185px',
                          alignItems: 'flex-start'
                        }}
                      >
                        {userRole === 'MANAGER' && (
                          <button
                            onClick={() => {
                              openTranscript()
                              setActiveMenuId(null)
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              background: 'none',
                              border: 'none',
                              borderRadius: '10px',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14.5px',
                              fontWeight: '600',
                              color: 'var(--primary)',
                              transition: 'background 0.2s',
                              fontFamily: 'inherit',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            Chat Transcript
                          </button>
                        )}
                        {userRole === 'MANAGER' && !isDM(selectedClass) && (
                          <button
                            onClick={() => {
                              toggleCommunityStatus()
                              setActiveMenuId(null)
                            }}
                            disabled={managingCommunity}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              background: 'none',
                              border: 'none',
                              borderRadius: '10px',
                              textAlign: 'left',
                              cursor: managingCommunity ? 'default' : 'pointer',
                              fontSize: '14.5px',
                              fontWeight: '600',
                              color: selectedClass.isCommunityActive === false ? 'var(--success)' : 'var(--warning)',
                              transition: 'background 0.2s',
                              fontFamily: 'inherit',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            {selectedClass.isCommunityActive === false ? 'Enable Community' : 'Disable Community'}
                          </button>
                        )}
                        {userRole === 'MANAGER' && isDM(selectedClass) && (
                          <button
                            onClick={async () => {
                              if (managingCommunity) return
                              const action = selectedClass.isDmDisabled ? 'enable' : 'disable'
                              const allowed = await confirm({
                                title: action === 'disable' ? 'Hide Chat from Student?' : 'Show Chat to Student?',
                                message: action === 'disable'
                                  ? 'This will hide the chat from the student. All messages are preserved and you can re-enable it anytime.'
                                  : 'This will make the chat visible to the student again.',
                                confirmLabel: action === 'disable' ? 'Hide Chat' : 'Show Chat',
                                tone: action === 'disable' ? 'danger' : 'default',
                              })
                              if (!allowed) return
                              setManagingCommunity(true)
                              try {
                                const chatId = selectedClass.id.replace('dm_', '')
                                const res = await fetch('/api/community/direct/toggle', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ chatId, action }),
                                })
                                if (!res.ok) throw new Error('Failed to toggle chat')
                                await loadClasses(selectedClass.id)
                              } catch (error) {
                                console.error(error)
                                alert(error instanceof Error ? error.message : 'Failed to toggle chat')
                              } finally {
                                setManagingCommunity(false)
                                setActiveMenuId(null)
                              }
                            }}
                            disabled={managingCommunity}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              background: 'none',
                              border: 'none',
                              borderRadius: '10px',
                              textAlign: 'left',
                              cursor: managingCommunity ? 'default' : 'pointer',
                              fontSize: '14.5px',
                              fontWeight: '600',
                              color: selectedClass.isDmDisabled ? 'var(--success)' : 'var(--warning)',
                              transition: 'background 0.2s',
                              fontFamily: 'inherit',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            {selectedClass.isDmDisabled ? 'Show to Student' : 'Hide from Student'}
                          </button>
                        )}
                        {userRole === 'MANAGER' && (
                          <button
                            onClick={() => {
                              clearCommunityMessages()
                              setActiveMenuId(null)
                            }}
                            disabled={managingCommunity || messages.length === 0}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              background: 'none',
                              border: 'none',
                              borderRadius: '10px',
                              textAlign: 'left',
                              cursor: (managingCommunity || messages.length === 0) ? 'default' : 'pointer',
                              fontSize: '14.5px',
                              fontWeight: '600',
                              color: 'var(--danger)',
                              transition: 'background 0.2s',
                              fontFamily: 'inherit',
                              opacity: (managingCommunity || messages.length === 0) ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            Clear Chat History
                          </button>
                        )}
                        <button
                          onClick={(e) => handleMarkAsRead(e, selectedClass.id)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '10px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14.5px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            transition: 'background 0.2s',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          Mark as read
                        </button>
                        <button
                          onClick={(e) => handleOpenCoursePage(e, selectedClass.id)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '10px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14.5px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            transition: 'background 0.2s',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          Open course page
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleMuteCourse(selectedClass.id, selectedClass.isMuted || false)
                            setActiveMenuId(null)
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderRadius: '10px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14.5px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            transition: 'background 0.2s',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          {selectedClass.isMuted ? 'Unmute notification' : 'Mute notification'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pinned Message Banner */}
            {!isDM(selectedClass) && pinnedMessage && (
              <div 
                onClick={() => {
                  const el = document.getElementById(`msg-${pinnedMessage.id}`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  } else {
                    alert('Pinned message is older and not loaded. Scroll up to load older messages.')
                  }
                }}
                style={{
                  background: 'var(--surface)',
                  borderBottom: '1px solid var(--border)',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  zIndex: 2,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ flexShrink: 0, transform: 'rotate(45deg)' }}>
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.24l-2.78 3.5a2 2 0 0 0-.44 1.24z"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Pinned Message
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }}>
                    <strong>{pinnedMessage.sender.name}: </strong>
                    {hasLectureLink(pinnedMessage.content) ? `💬 Comment: ${cleanContent(pinnedMessage.content)}` : pinnedMessage.content || (pinnedMessage.imageUrl ? (describeCommunityAttachment(pinnedMessage.imageUrl)?.isImage ? '📷 Photo' : '📎 Document') : '')}
                  </div>
                </div>
                {userRole === 'MANAGER' && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      await handlePinToggle(pinnedMessage.id, false)
                    }}
                    title="Unpin message"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '4px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            )}

            {/* Messages */}
            <div 
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="chat-wallpaper" 
              style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {loadingMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>
                  Loading older messages...
                </div>
              )}
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  <p style={{ marginTop: '12px', fontWeight: '700' }}>No messages yet</p>
                  <p style={{ fontSize: '13px', marginTop: '4px' }}>Be the first to say something!</p>
                </div>
              )}

              {messages.map((msg, idx) => {
                const isMe = msg.sender.id === userId
                const isAdmin = msg.sender.role !== 'STUDENT'
                const isDirectMessageThread = isDM(selectedClass)
                
                const currentDate = new Date(msg.createdAt).toDateString()
                const prevDate = idx > 0 ? new Date(messages[idx - 1].createdAt).toDateString() : null
                const showDateHeader = currentDate !== prevDate
                
                const showAvatar = idx === 0 || messages[idx - 1]?.sender.id !== msg.sender.id || showDateHeader
                const showSenderIdentityInMessage = !isDirectMessageThread && !isMe

                if (msg.isDeleted && userRole !== 'MANAGER') {
                  return null
                }

                return (
                  <React.Fragment key={msg.id}>
                    {showDateHeader && (
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 12px' }}>
                        <span style={{
                          padding: '4px 14px', borderRadius: '50px',
                          background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)',
                          fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                        }}>
                          {formatMessageDate(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <div id={`msg-${msg.id}`} className="msg-row" style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-end', marginBottom: showAvatar ? '6px' : '1px', position: 'relative' }} onMouseEnter={() => setHoveredChatMsgId(msg.id)} onMouseLeave={() => setHoveredChatMsgId(null)}>
                      {/* Avatar */}
                      {showSenderIdentityInMessage && (
                        <UserAvatar
                          user={msg.sender}
                          size={28}
                          onClick={() => openUserIdentity(msg.sender)}
                          style={{ display: showAvatar ? 'inline-flex' : 'none' }}
                        />
                      )}
                      {showSenderIdentityInMessage && !showAvatar && <div style={{ width: '32px', flexShrink: 0 }} />}

                      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%', maxWidth: '100%', minWidth: 0 }}>
                          <SwipeableMessage
                            onSwipeTrigger={() => setReplyingTo(msg)}
                            onLongPress={() => {
                              if (canOpenChatMessageActionMenu(msg)) {
                                setManagerActionMessage(msg)
                              }
                            }}
                            isMe={isMe}
                            disabled={msg.id.startsWith('temp-')}
                          >
                            <div className="chat-msg-bubble" style={{
                              padding: msg.imageUrl ? '5px' : '7px 12px 6px 12px',
                              borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              background: selectedMessage?.id === msg.id
                                ? '#d0e1fd'
                                : isMe ? '#dcf8c6' : isAdmin ? '#e0e7ff' : '#ffffff',
                              color: '#1e1e3a',
                              fontSize: '14px', lineHeight: '1.5',
                              boxShadow: selectedMessage?.id === msg.id
                                ? '0 0 0 2.5px #3636e8, 0 4px 12px rgba(54,54,232,0.2)'
                                : '0 2px 4px rgba(0,0,0,0.05)',
                              minWidth: '80px',
                              maxWidth: '100%',
                              border: selectedMessage?.id === msg.id
                                ? 'none'
                                : isMe ? 'none' : '1px solid #e8eaf0',
                              position: 'relative',
                              transition: 'all 0.2s',
                            }}>
                              {/* Pinned indicator inside bubble */}
                              {msg.isPinned && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontSize: '11px', color: 'var(--primary)', fontWeight: '700' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: 'rotate(45deg)', flexShrink: 0 }}>
                                    <line x1="12" y1="17" x2="12" y2="22"/>
                                    <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.24l-2.78 3.5a2 2 0 0 0-.44 1.24z"/>
                                  </svg>
                                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pinned</span>
                                </div>
                              )}
                              {/* Reply info */}
                              {msg.replyTo && (
                                <div 
                                  onClick={() => {
                                    const el = document.getElementById(`msg-${msg.replyTo!.id}`)
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  }}
                                  style={{
                                    background: isMe ? 'rgba(0,0,0,0.06)' : 'rgba(54,54,232,0.04)',
                                    padding: '8px 12px',
                                    borderRadius: '10px',
                                    borderLeft: `4px solid ${isAdmin ? 'var(--primary)' : 'var(--text-secondary)'}`,
                                    marginBottom: '8px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    borderTop: '1px solid rgba(0,0,0,0.02)',
                                    borderRight: '1px solid rgba(0,0,0,0.02)',
                                    borderBottom: '1px solid rgba(0,0,0,0.02)',
                                    transition: 'all 0.2s',
                                    maxWidth: '100%',
                                    minWidth: 0,
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = isMe ? 'rgba(0,0,0,0.1)' : 'rgba(54,54,232,0.08)'}
                                  onMouseLeave={e => e.currentTarget.style.background = isMe ? 'rgba(0,0,0,0.06)' : 'rgba(54,54,232,0.04)'}
                                >
                                  {!isDirectMessageThread && (
                                    <div style={{ fontWeight: '800', color: isAdmin ? 'var(--primary)' : '#555', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.replyTo.sender.name}</span>
                                      <StaffRoleBadge role={msg.replyTo.sender.role} />
                                    </div>
                                  )}
                                  <div style={{ color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', fontSize: '11.5px', lineHeight: '1.4' }}>
                                    {hasLectureLink(msg.replyTo.content) ? `💬 Comment: ${cleanContent(msg.replyTo.content)}` : msg.replyTo.content || (msg.replyTo.imageUrl ? (describeCommunityAttachment(msg.replyTo.imageUrl)?.isImage ? '📷 Image' : '📎 Document') : 'Message')}
                                  </div>
                                </div>
                              )}
                              {/* Name inside for group/staff */}
                              {showSenderIdentityInMessage && showAvatar && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', minWidth: 0 }}>
                                  <span 
                                    onClick={() => openUserIdentity(msg.sender)}
                                    style={{ 
                                      fontSize: '11px', fontWeight: '800', 
                                      color: isAdmin ? 'var(--primary)' : '#888',
                                      cursor: 'pointer',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {msg.sender.name}
                                  </span>
                                  <StaffRoleBadge role={isAdmin ? msg.sender.role : undefined} />
                                </div>
                              )}

                              {msg.imageUrl && <CommunityAttachment url={msg.imageUrl} native={isCapacitor} onImageClick={setLightboxUrl} />}
                              {msg.content && (
                                <div>
                                  {hasLectureLink(msg.content) ? (() => {
                                    const parsed = parseLectureLink(msg.content)
                                    if (!parsed) return null
                                    const cleanedText = cleanContent(msg.content)
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '8px' }}>
                                        <div style={{ fontSize: '12px', color: 'rgba(30, 30, 58, 0.7)', fontWeight: '600' }}>
                                          Commented on <strong>{parsed.lectureTitle}</strong>:
                                        </div>
                                        <div style={{
                                          background: 'rgba(54, 54, 232, 0.05)',
                                          borderLeft: '3px solid #3636e8',
                                          padding: '8px 12px',
                                          borderRadius: '6px',
                                          fontSize: '13px',
                                          lineHeight: '1.4',
                                          color: '#1e1e3a',
                                          fontStyle: 'italic',
                                          wordBreak: 'break-word',
                                          whiteSpace: 'pre-wrap',
                                        }}>
                                          "{cleanedText}"
                                        </div>
                                        <button
                                          onClick={() => {
                                            router.push(`/courses/${parsed.courseId}/lectures/${parsed.lectureId}?commentId=${parsed.commentId}`)
                                          }}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            alignSelf: 'flex-start',
                                            gap: '5px',
                                            marginTop: '2px',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            background: 'linear-gradient(135deg, #3636e8, #6366f1)',
                                            color: '#ffffff',
                                            border: 'none',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            boxShadow: '0 3px 8px rgba(54,54,232,0.2)',
                                            transition: 'all 0.2s',
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-1px)'
                                            e.currentTarget.style.boxShadow = '0 5px 12px rgba(54,54,232,0.3)'
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)'
                                            e.currentTarget.style.boxShadow = '0 3px 8px rgba(54,54,232,0.2)'
                                          }}
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                          </svg>
                                          View Comments
                                        </button>
                                      </div>
                                    )
                                  })() : (
                                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: isEmojiOnly(msg.content) ? '48px' : undefined, lineHeight: isEmojiOnly(msg.content) ? '1.2' : undefined }}>
                                      {renderMessageContent(msg.content)}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Message metadata */}
                              <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '4px',
                                marginTop: msg.content || msg.imageUrl ? '4px' : 0,
                                paddingLeft: '18px',
                                fontSize: '10px',
                                color: isMe ? '#4a7c44' : 'var(--text-muted)',
                                fontWeight: '600',
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                              }}>
                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {msg.isEdited && (
                                  <span style={{ fontSize: '9px', fontStyle: 'italic', opacity: 0.72 }} title={msg.editedAt ? `Edited at ${new Date(msg.editedAt).toLocaleString()}` : 'Edited'}>
                                    (edited)
                                  </span>
                                )}
                                {isMe && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ display: 'block', flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                                )}
                                {msg.isDeleted && (
                                  <span style={{ fontSize: '9px', background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '50px', fontWeight: '800' }}>
                                    Deleted
                                  </span>
                                )}
                              </div>

                              </div>
                            </SwipeableMessage>

                        {/* Hover action toolbar */}
                        {hoveredChatMsgId === msg.id && canShowChatMessageActions(msg) && (canReplyToChatMessage(msg) || canEditChatMessage(msg) || canDeleteChatMessage(msg)) && (
                          <div
                            className="community-message-action-toolbar"
                            onMouseEnter={() => setHoveredChatMsgId(msg.id)}
                            style={{
                              ['--action-slide' as any]: isMe ? '4px' : '-4px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              alignItems: 'center',
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              boxShadow: 'none',
                              zIndex: 8,
                              position: 'absolute',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              ...(isMe ? { right: 'calc(100% + 8px)' } : { left: 'calc(100% + 8px)' }),
                            }}
                          >
                            {canDeleteChatMessage(msg) && (
                              <button
                                className="community-message-action-button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteMessage(msg.id)
                                }}
                                title="Delete"
                                aria-label="Delete"
                                style={{
                                  width: '30px', height: '30px', borderRadius: '50%',
                                  background: 'rgba(239,68,68,0.09)', border: 'none',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--danger)', transition: 'background 0.16s ease, transform 0.16s ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.09)'}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            )}

                            {canEditChatMessage(msg) && (
                              <button
                                className="community-message-action-button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingMessage(msg)
                                  setEditContent(msg.content)
                                }}
                                title="Edit"
                                aria-label="Edit"
                                style={{
                                  width: '30px', height: '30px', borderRadius: '50%',
                                  background: 'rgba(100,116,139,0.10)', border: 'none',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: '#64748b', transition: 'background 0.16s ease, transform 0.16s ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(54,54,232,0.10)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,116,139,0.10)'}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>
                              </button>
                            )}

                            {canReplyToChatMessage(msg) && (
                              <button
                                className="community-message-action-button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setReplyingTo(msg)
                                }}
                                title="Reply"
                                aria-label="Reply"
                                style={{
                                  width: '30px', height: '30px', borderRadius: '50%',
                                  background: 'var(--primary-light)', border: 'none',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--primary)', transition: 'background 0.16s ease, transform 0.16s ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(54,54,232,0.16)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-light)'}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                              </button>
                            )}
                          </div>
                        )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input — DMs are two-way: both sides can reply */}
            {(!isDM(selectedClass) && selectedClass.isCommunityActive === false && userRole !== 'MANAGER') ? (
              <div style={{ padding: '14px 20px', borderTop: '1.5px solid rgba(0,0,0,0.06)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px', opacity: 0.6 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                This community is currently disabled.
              </div>
            ) : (
            <div style={{ padding: '12px 16px', borderTop: '1.5px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
              {/* Reply Preview */}
              {replyingTo && (
                <div style={{ 
                  marginBottom: '8px', padding: '10px 14px', 
                  background: 'var(--primary-light)', borderRadius: '12px',
                  borderLeft: '4px solid #3636e8',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '12px'
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>Replying to {replyingTo.sender.name}</span>
                      <StaffRoleBadge role={replyingTo.sender.role} />
                    </div>
                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {replyingTo.content || 'Image'}
                    </div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}

              {/* Edit Preview */}
              {editingMessage && (
                <div style={{ 
                  marginBottom: '8px', padding: '10px 14px', 
                  background: 'rgba(217, 119, 6, 0.08)', borderRadius: '12px',
                  borderLeft: '4px solid #d97706',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '12px'
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '800', color: '#d97706', marginBottom: '2px' }}>Editing message</div>
                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {editingMessage.content}
                    </div>
                  </div>
                  <button onClick={() => { setEditingMessage(null); setEditContent('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}

              {/* Image/File preview */}
              {pendingImagePreview && (
                <div style={{ 
                  marginBottom: '10px', position: 'relative', display: 'inline-flex', 
                  alignItems: 'center', gap: '8px', padding: '10px 14px', 
                  borderRadius: '16px', background: 'var(--surface-2)', 
                  border: '1.5px solid var(--border)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                }}>
                  {pendingImagePreview.startsWith('blob:') ? (
                    <img src={pendingImagePreview} alt="Preview" style={{ maxHeight: '100px', maxWidth: '200px', borderRadius: '10px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', paddingRight: '20px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span>{pendingImagePreview}</span>
                    </div>
                  )}
                  <button
                    onClick={clearPendingImage}
                    style={{
                      position: 'absolute', top: '-8px', right: '-8px',
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: 'var(--danger)', color: '#fff', border: '2px solid var(--border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '800', boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
                      zIndex: 10
                    }}
                  >✕</button>
                </div>
              )}
              {uploadingImage && (
                <div style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--primary)', fontWeight: '600' }}>
                  Uploading image...
                </div>
              )}
              {(() => {
                const isDemo = selectedClass && ((selectedClass as any).isDemoEnrollment || (selectedClass as any).enrollmentType === 'DEMO') && userRole !== 'MANAGER' && (userRole !== 'ADMIN' && userRole !== 'MODERATOR');
                if (isDemo) {
                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 20px',
                      borderRadius: '50px',
                      background: 'var(--surface-2)',
                      boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                      border: '1.5px solid var(--border)',
                      color: 'var(--text-secondary)',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      gap: '12px',
                      margin: '10px 0 4px 0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '16px' }}>🔒</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Community chat is read-only in Demo mode.
                        </span>
                      </div>
                      <button
                        onClick={handleUpgradeClick}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '50px',
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#ffffff',
                          fontWeight: '800',
                          fontSize: '12px',
                          border: 'none',
                          boxShadow: '0 4px 10px rgba(99, 102, 241, 0.25)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        Upgrade to Chat
                      </button>
                    </div>
                  );
                }
                return (
                   <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      ref={imageInputRef}
                      onChange={handleImageSelect}
                      style={{ display: 'none' }}
                    />
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage || !!editingMessage}
                      title="Attach image"
                      style={{
                        width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                        cursor: editingMessage ? 'default' : 'pointer', flexShrink: 0,
                        background: (pendingImage && !editingMessage && pendingImagePreview?.startsWith('blob:')) ? 'var(--primary-light)' : 'var(--surface-2)',
                        boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: (pendingImage && !editingMessage && pendingImagePreview?.startsWith('blob:')) ? 'var(--primary)' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                        opacity: editingMessage ? 0.5 : 1,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </button>
                    <button
                      onClick={async () => {
                        const allowed = await confirm({
                          title: 'Upload Document Guidelines',
                          message: 'Maximum allowed file size is 20 MB only max. Supported formats: PDF, PPT, DOCX, ZIP, XLS.',
                          confirmLabel: 'Select File',
                          cancelLabel: 'Cancel',
                          tone: 'default'
                        });
                        if (allowed) {
                          fileInputRef.current?.click();
                        }
                      }}
                      disabled={uploadingImage || !!editingMessage}
                      title="Attach document"
                      style={{
                        width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                        cursor: editingMessage ? 'default' : 'pointer', flexShrink: 0,
                        background: (pendingImage && !editingMessage && !pendingImagePreview?.startsWith('blob:')) ? 'var(--primary-light)' : 'var(--surface-2)',
                        boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: (pendingImage && !editingMessage && !pendingImagePreview?.startsWith('blob:')) ? 'var(--primary)' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                        opacity: editingMessage ? 0.5 : 1,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                    <div style={{ flex: 1, position: 'relative' }}>
                      {showTagSuggestions && filteredStaff.length > 0 && !isDM(selectedClass) && !editingMessage && (
                        <div style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '12px',
                          marginBottom: '8px',
                          background: 'var(--community-item-bg)',
                          border: '1.5px solid rgba(0,0,0,0.08)',
                          borderRadius: '16px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 10,
                          width: '280px',
                          display: 'flex',
                          flexDirection: 'column',
                        }}>
                          {filteredStaff.map((user) => (
                            <button
                              key={user.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                selectTagUser(user)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 14px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                                color: 'var(--community-item-text)',
                                borderBottom: '1px solid rgba(0,0,0,0.02)',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(54,54,232,0.08)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <UserAvatar user={user} size={28} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {user.name}
                                </div>
                                <div style={{ fontSize: '10px', color: '#9999b0', textTransform: 'capitalize' }}>
                                  {user.role.toLowerCase()}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      <textarea
                        ref={inputRef}
                        value={editingMessage ? editContent : input}
                        onChange={e => {
                          if (editingMessage) {
                            setEditContent(e.target.value)
                          } else {
                            handleInputChange(e)
                          }
                          // Auto-grow height
                          e.target.style.height = 'auto'
                          e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Escape') {
                            if (editingMessage) {
                              setEditingMessage(null)
                              setEditContent('')
                            } else {
                              setShowTagSuggestions(false)
                              setShowEmojiPicker(false)
                            }
                          } else if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            if (editingMessage) {
                              editMessage(editingMessage.id, editContent)
                            } else {
                              sendMessage()
                            }
                            // Reset height after send
                            if (e.target instanceof HTMLTextAreaElement) {
                              e.target.style.height = 'auto'
                            }
                          }
                        }}
                        placeholder="Write Here....."
                        disabled={(!editingMessage && !isDM(selectedClass) && selectedClass.isCommunityActive === false && userRole !== 'MANAGER') || uploadingImage}
                        rows={1}
                        style={{
                          width: '100%', padding: '11px 16px', borderRadius: '22px',
                          border: 'none', outline: 'none', resize: 'none',
                          fontFamily: 'inherit', fontSize: '14px',
                          ...neuInset, color: 'var(--text-primary)',
                          opacity: (!editingMessage && !isDM(selectedClass) && selectedClass.isCommunityActive === false && userRole !== 'MANAGER') ? 0.6 : 1,
                          lineHeight: '1.4',
                          maxHeight: '120px',
                          overflowY: 'auto',
                        }}
                      />
                    </div>
                    {/* Emoji picker button */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setShowEmojiPicker(v => !v)}
                        title="Emoji"
                        style={{
                          width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                          cursor: 'pointer', flexShrink: 0,
                          background: showEmojiPicker ? 'var(--primary-light)' : 'var(--surface-2)',
                          boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px',
                          transition: 'all 0.2s',
                        }}
                      >
                        😊
                      </button>
                      {showEmojiPicker && (
                        <>
                          {/* Click-outside overlay to close picker */}
                          <div
                            onClick={() => setShowEmojiPicker(false)}
                            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                          />
                          <div style={{
                            position: 'absolute', bottom: '50px', right: 0,
                            background: 'var(--sidebar-bg)', borderRadius: '16px',
                            border: '1px solid var(--border)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            padding: '12px', width: '280px', zIndex: 50,
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Reactions</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {['😂','😭','😅','🙂','😎','🤔','❤️','🔥','👏','👍','🙏','🎉','🥳','📚','📝','🎓','💯','✅','❌','⏰','💡','😤','🫡','💪','🤝','😴','🤯','👀','😬','🫠'].map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => {
                                    const ta = inputRef.current
                                    if (!ta) return
                                    const start = ta.selectionStart || 0
                                    const end = ta.selectionEnd || 0
                                    const currentVal = editingMessage ? editContent : input
                                    const newVal = currentVal.slice(0, start) + emoji + currentVal.slice(end)
                                    if (editingMessage) {
                                      setEditContent(newVal)
                                    } else {
                                      setInput(newVal)
                                    }
                                    setShowEmojiPicker(false)
                                    setTimeout(() => {
                                      ta.focus()
                                      const pos = start + emoji.length
                                      ta.setSelectionRange(pos, pos)
                                    }, 50)
                                  }}
                                  style={{
                                    width: '36px', height: '36px', fontSize: '20px',
                                    background: 'none', border: 'none', borderRadius: '8px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 0.15s',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(54,54,232,0.08)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={editingMessage ? () => editMessage(editingMessage.id, editContent) : sendMessage}
                      disabled={
                        editingMessage
                          ? !editContent.trim()
                          : ((!input.trim() && !pendingImage) || uploadingImage || (!isDM(selectedClass) && selectedClass.isCommunityActive === false && userRole !== 'MANAGER'))
                      }
                      style={{
                        height: '44px', borderRadius: (pendingImage && !editingMessage) ? '50px' : '50%', border: 'none',
                        width: (pendingImage && !editingMessage) ? 'auto' : '44px',
                        padding: (pendingImage && !editingMessage) ? '0 20px' : '0',
                        cursor: (editingMessage ? editContent.trim() : (input.trim() || pendingImage)) ? 'pointer' : 'default',
                        background: (editingMessage ? editContent.trim() : (input.trim() || pendingImage)) ? selectedClass.color : 'var(--surface-2)',
                        color: (editingMessage ? editContent.trim() : (input.trim() || pendingImage)) ? '#fff' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, gap: '6px',
                        boxShadow: (editingMessage ? editContent.trim() : (input.trim() || pendingImage)) ? `4px 4px 10px ${selectedClass.color}55` : '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                        transition: 'all 0.2s', fontWeight: '700', fontSize: '13px', fontFamily: 'inherit',
                      }}
                      title={editingMessage ? 'Save changes' : 'Send message'}
                    >
                      {pendingImage && !editingMessage && <span>Send</span>}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        {editingMessage ? (
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        ) : (
                          <>
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                );
              })()}
            </div>
            )}
          </>
        )}
      </div>

      {guidelinesOpen && (
        <div className="modal-overlay" onClick={() => setGuidelinesOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', width: '90%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '24px', padding: '24px', background: 'var(--sidebar-bg)', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📜</span>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Community Guidelines</h3>
              </div>
              <button onClick={() => setGuidelinesOpen(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body" style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>1.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Be respectful:</strong> Treat classmates, teachers, mentors, and staff with respect. No personal attacks, insults, harassment, or bullying.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>2.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Keep discussions relevant:</strong> Use the appropriate course/category for questions and discussions. Avoid unnecessary spam or repeated posts.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>3.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>No abusive or offensive content:</strong> Do not post hateful, discriminatory, sexually explicit, violent, or otherwise inappropriate content.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>4.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>No spam or self-promotion:</strong> Don't flood the community with advertisements, referral links, promotions, or unrelated content.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>5.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Don't share personal information:</strong> Never post phone numbers, passwords, addresses, private conversations, or other people's personal information without permission.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>6.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Academic integrity:</strong> Help others learn, but don't encourage cheating, exam misconduct, plagiarism, or sharing restricted exam material.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>7.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Share useful content:</strong> Notes, resources, explanations, study tips, questions, and useful opportunities are welcome when they are relevant to the community.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>8.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Don't impersonate others:</strong> Do not pretend to be another student, teacher, mentor, or GenZ IITIAN staff member.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>9.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Report problems:</strong> If you see inappropriate content or behavior, report it instead of engaging in an argument.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: '800', color: 'var(--primary)' }}>10.</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Use common sense:</strong> The community is meant for learning, collaboration, and connecting with classmates. If something clearly doesn't belong here, don't post it.
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Actions Taken for Violations</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px' }}>
                  <div><strong style={{ color: 'var(--text-primary)' }}>1. Content removal:</strong> Posts or comments that violate the guidelines may be removed.</div>
                  <div><strong style={{ color: 'var(--text-primary)' }}>2. Warning:</strong> For minor or first-time violations, the user may receive a warning.</div>
                  <div><strong style={{ color: 'var(--text-primary)' }}>3. Temporary restriction:</strong> Repeated violations may result in the user temporarily losing the ability to post, comment, or react.</div>
                  <div><strong style={{ color: 'var(--text-primary)' }}>4. Temporary suspension:</strong> Serious or repeated violations can result in temporary suspension from the Community.</div>
                  <div><strong style={{ color: 'var(--text-primary)' }}>5. Permanent removal:</strong> Severe violations or repeated misconduct may result in permanent removal from the Community.</div>
                  <div><strong style={{ color: 'var(--text-primary)' }}>6. Immediate action for serious violations:</strong> Threats, harassment, hate speech, explicit content, scams, impersonation, serious privacy violations, or attempts to compromise the platform may result in immediate suspension or removal without a prior warning.</div>
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '4px' }}>* Actions may vary depending on the severity and frequency of the violation.</div>
                </div>
              </div>

              <blockquote style={{ borderLeft: '4px solid var(--primary)', margin: '12px 0 0 0', padding: '6px 16px', background: 'var(--primary-light)', borderRadius: '0 12px 12px 0', fontStyle: 'italic', fontWeight: '600', color: 'var(--text-primary)' }}>
                Our goal is not to restrict conversation. It's to keep the Community safe, useful, and welcoming for everyone.
              </blockquote>

            </div>
          </div>
        </div>
      )}

      {/* Global Uploading Progress Modal Overlay */}
      {uploadProgress !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '24px',
            border: '1px solid var(--border)', width: '100%', maxWidth: '400px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)', padding: '28px',
            display: 'flex', flexDirection: 'column', gap: '20px',
            alignItems: 'center', textAlign: 'center'
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(54,54,232,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
              marginBottom: '4px'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }}>
                <line x1="12" y1="2" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                <line x1="2" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="22" y2="12"/>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
              </svg>
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
            
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '0 0 6px 0', color: 'var(--text-primary)' }}>Uploading Attachment</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all', margin: 0 }}>{uploadFileName || 'file'}</p>
            </div>

            {/* Progress Bar Container */}
            <div style={{ width: '100%', background: 'var(--surface-2)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress}%`, background: 'var(--primary)', height: '100%', borderRadius: '4px', transition: 'width 0.15s ease-out' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px', fontWeight: '750', color: 'var(--text-secondary)' }}>
              <span>{uploadProgress}% Complete</span>
              <span>20 MB max limit</span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: '600', background: 'rgba(245,158,11,0.06)', padding: '10px 14px', borderRadius: '10px', lineHeight: '1.4' }}>
              ⚠️ Please stay on this page. Navigating away or closing it will cancel the upload process.
            </div>

            <button
              onClick={() => {
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort()
                }
                setUploadProgress(null)
                setUploadFileName('')
                setUploadingImage(false)
                abortControllerRef.current = null
              }}
              style={{
                width: '100%', padding: '12px 0', borderRadius: '12px', border: 'none',
                background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: '800',
                fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--danger-light)'}
            >
              Cancel Upload
            </button>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div
          onClick={() => setRulesOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: '24px',
              border: '1px solid var(--border)', width: '100%', maxWidth: '500px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)', padding: '24px',
              display: 'flex', flexDirection: 'column', gap: '20px',
              color: 'var(--text-primary)', fontFamily: 'inherit'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>System Rules & Limits</h3>
              <button
                onClick={() => setRulesOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13.5px', lineHeight: '1.5' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Here is a summary of all active limits and restrictions applied to student users:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                  <span style={{ fontWeight: '700' }}>Post Daily Limit</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800' }}>15 posts/day</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                  <span style={{ fontWeight: '700' }}>Upload Size Limit</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800' }}>20 MB max</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                  <span style={{ fontWeight: '700' }}>File Limit per Message</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800' }}>1 file/message</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                  <span style={{ fontWeight: '700' }}>Daily File Limit</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800' }}>10 files/day</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                  <span style={{ fontWeight: '700' }}>General Post Length</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800' }}>500 chars max</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                  <span style={{ fontWeight: '700' }}>Comment Reply Length</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800' }}>300 chars max</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                  <span style={{ fontWeight: '700' }}>Course Chat Length</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800' }}>1000 chars max</span>
                </div>
              </div>

              <div style={{ background: 'rgba(54,54,232,0.06)', borderLeft: '3px solid var(--primary)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                <strong>Manager Override:</strong> Manager and Admin roles have completely unrestricted posting frequencies, unlimited file transmissions, and full message editing/deletion capabilities.
              </div>
            </div>
          </div>
        </div>
      )}

      {transcriptOpen && selectedClass && (
        <div className="modal-overlay" onClick={() => setTranscriptOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{selectedClass.name} Transcript</h3>
              <button onClick={() => setTranscriptOpen(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Individual transcript for this community only. Deleted and active messages are both shown here.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['csv', 'json', 'pdf'] as const).map(format => (
                    <button key={format} onClick={() => exportTranscript(format)} className="btn btn-ghost btn-sm">
                      {format === 'pdf' ? 'Export HTML' : `Export ${format.toUpperCase()}`}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {loadingTranscript ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading transcript...</div>
                ) : transcriptMessages.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No transcript messages found for this group.</div>
                ) : (
                  transcriptMessages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: msg.isDeleted ? 'var(--danger-light)' : 'var(--surface)',
                        border: msg.isDeleted ? '1px solid var(--border)' : '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span 
                            onClick={() => openUserIdentity(msg.sender)}
                            style={{ 
                              fontSize: '12px', fontWeight: '700', color: 'var(--primary)',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              textUnderlineOffset: '2px'
                            }}
                          >
                            {msg.sender.name}
                          </span>
                          {getStaffRoleLabel(msg.sender.role) ? (
                            <StaffRoleBadge role={msg.sender.role} />
                          ) : (
                            <span style={{
                              fontSize: '10px',
                              background: 'linear-gradient(135deg, #3636e8, #6366f1)',
                              color: '#fff',
                              padding: '1px 8px',
                              borderRadius: '50px',
                              fontWeight: '800',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              textTransform: 'capitalize'
                            }}>
                              {msg.sender.role.toLowerCase()}
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </span>
                          )}
                          {msg.sender.securityNumber && (
                            <span style={{ fontSize: '10px', background: 'var(--warning-light)', color: 'var(--warning)', padding: '1px 6px', borderRadius: '50px', fontWeight: '700' }}>
                              {msg.sender.securityNumber}
                            </span>
                          )}
                          {msg.isDeleted && (
                            <span style={{ fontSize: '10px', background: 'var(--danger-light)', color: 'var(--danger)', padding: '1px 6px', borderRadius: '50px', fontWeight: '700' }}>
                              Deleted
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {new Date(msg.createdAt).toLocaleString()}
                          {msg.deletedAt ? ` • Deleted ${new Date(msg.deletedAt).toLocaleString()}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {msg.content || '[No visible content]'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedUserDetailsId && (
        <ManagerUserModal 
          userId={selectedUserDetailsId} 
          onClose={() => setSelectedUserDetailsId(null)} 
          onUpdate={() => {
            if (selectedClass?.id) loadMessages(selectedClass.id, { showLoading: false }).catch(console.error)
            if (!selectedClass && sidebarTab === 'general') loadGeneralDiscussionPosts()
            if (transcriptOpen) openTranscript()
          }}
        />
      )}

      {socialCardUserId && (
        <SocialCardModal
          userId={socialCardUserId}
          onClose={() => setSocialCardUserId(null)}
          onChatStarted={async (chatId) => {
            setSocialCardUserId(null)
            await loadClasses(chatId)
          }}
        />
      )}

      {managerProfileChoice && (
        <div className="modal-overlay" onClick={() => setManagerProfileChoice(null)} style={{ zIndex: 1190 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '92%', maxWidth: '390px', padding: '18px', borderRadius: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '2px 2px 15px' }}>
              <UserAvatar user={managerProfileChoice} size={46} style={{ border: '2px solid var(--border)', boxShadow: '0 8px 18px rgba(15,23,42,0.10)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{managerProfileChoice.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'capitalize', marginTop: '2px' }}>{managerProfileChoice.role.toLowerCase()}</div>
              </div>
            </div>
            <div style={{ height: '1px', background: 'var(--border)', marginBottom: '10px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedUserDetailsId(managerProfileChoice.id)
                  setManagerProfileChoice(null)
                }}
                onMouseEnter={() => setHoveredManagerAction('profile')}
                onMouseLeave={() => setHoveredManagerAction(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  border: `1.5px solid ${hoveredManagerAction === 'profile' ? 'var(--primary)' : 'var(--border)'}`,
                  background: hoveredManagerAction === 'profile' ? 'var(--primary-light)' : 'var(--surface)',
                  color: 'var(--text-primary)',
                  borderRadius: '14px',
                  padding: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background 170ms ease, border-color 170ms ease, transform 170ms ease',
                  transform: hoveredManagerAction === 'profile' ? 'translateY(-1px)' : 'none',
                }}
              >
                <span style={{ width: '34px', height: '34px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--primary)', flexShrink: 0 }}>
                  <UserRound size={17} strokeWidth={2.4} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 900, marginBottom: '2px' }}>View Profile</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.35 }}>Manage account and internal user information</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSocialCardUserId(managerProfileChoice.id)
                  setManagerProfileChoice(null)
                }}
                onMouseEnter={() => setHoveredManagerAction('social')}
                onMouseLeave={() => setHoveredManagerAction(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  border: `1.5px solid ${hoveredManagerAction === 'social' ? 'var(--primary)' : 'var(--border)'}`,
                  background: hoveredManagerAction === 'social' ? 'var(--primary-light)' : 'var(--surface)',
                  color: 'var(--text-primary)',
                  borderRadius: '14px',
                  padding: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background 170ms ease, border-color 170ms ease, transform 170ms ease',
                  transform: hoveredManagerAction === 'social' ? 'translateY(-1px)' : 'none',
                }}
              >
                <span style={{ width: '34px', height: '34px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--primary)', flexShrink: 0 }}>
                  <Sparkles size={17} strokeWidth={2.4} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 900, marginBottom: '2px' }}>View Social Card</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.35 }}>View public profile, medals and shared information</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Action Modal */}
      {managerActionMessage && (
        <div
          className="modal-overlay"
          onClick={() => setManagerActionMessage(null)}
          style={{ alignItems: isMobile ? 'flex-end' : 'center' }}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '340px',
              width: isMobile ? '100%' : undefined,
              padding: '16px',
              borderRadius: isMobile ? '22px 22px 0 0' : '24px',
            }}
          >
            <div className="modal-header" style={{ padding: '0 4px 12px 4px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Message Options</h3>
              <button onClick={() => setManagerActionMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0 4px 0' }}>
              {/* Reply option */}
              {canLongPressReplyToChatMessage(managerActionMessage) && (
                <button
                  onClick={() => {
                    const msg = managerActionMessage;
                    setManagerActionMessage(null);
                    setReplyingTo(msg);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', border: 'none', width: '100%',
                    cursor: 'pointer', textAlign: 'left',
                    borderRadius: '12px',
                    background: 'transparent', fontFamily: 'inherit',
                    fontSize: '14px', fontWeight: '700',
                    color: 'var(--text-primary)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 17 4 12 9 7"/>
                    <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                  </svg>
                  Reply
                </button>
              )}

              {/* Edit option */}
              {canLongPressEditChatMessage(managerActionMessage) && (
                <button
                  onClick={() => {
                    const msg = managerActionMessage;
                    setManagerActionMessage(null);
                    setEditingMessage(msg);
                    setEditContent(msg.content);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', border: 'none', width: '100%',
                    cursor: 'pointer', textAlign: 'left',
                    borderRadius: '12px',
                    background: 'transparent', fontFamily: 'inherit',
                    fontSize: '14px', fontWeight: '700',
                    color: '#d97706',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(217, 119, 6, 0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
                  </svg>
                  Edit Message
                </button>
              )}

              {/* Pin / Unpin option */}
              {canLongPressPinChatMessage(managerActionMessage) && (
                <button
                  onClick={async () => {
                    const msg = managerActionMessage;
                    setManagerActionMessage(null);
                    await handlePinToggle(msg.id, !msg.isPinned);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', border: 'none', width: '100%',
                    cursor: 'pointer', textAlign: 'left',
                    borderRadius: '12px',
                    background: 'transparent', fontFamily: 'inherit',
                    fontSize: '14px', fontWeight: '700',
                    color: managerActionMessage.isPinned ? '#d97706' : 'var(--primary)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = managerActionMessage.isPinned ? 'rgba(217, 119, 6, 0.08)' : 'var(--primary-light)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={managerActionMessage.isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)' }}>
                    <line x1="12" y1="17" x2="12" y2="22"/>
                    <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.24l-2.78 3.5a2 2 0 0 0-.44 1.24z"/>
                  </svg>
                  {managerActionMessage.isPinned ? 'Unpin Message' : 'Pin Message'}
                </button>
              )}

              {/* Delete option */}
              {canLongPressDeleteChatMessage(managerActionMessage) && (
                <button
                  onClick={async () => {
                    const msgId = managerActionMessage.id;
                    setManagerActionMessage(null);
                    await deleteMessage(msgId);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', border: 'none', width: '100%',
                    cursor: 'pointer', textAlign: 'left',
                    borderRadius: '12px',
                    background: 'transparent', fontFamily: 'inherit',
                    fontSize: '14px', fontWeight: '700',
                    color: 'var(--danger)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'var(--danger-light)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                  Delete Message
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Direct Chat Modal */}
      {showNewDMModal && (
        <div className="modal-overlay" onClick={() => { setShowNewDMModal(false); setDmSearch(''); setDmResults([]) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Start Direct Chat</h3>
              <button onClick={() => { setShowNewDMModal(false); setDmSearch(''); setDmResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Search for a student or admin to start a private direct chat. They will see your messages in the Community tab.
              </p>
              <input
                className="form-input"
                placeholder="Search by name or email..."
                value={dmSearch}
                autoFocus
                onChange={e => {
                  setDmSearch(e.target.value)
                  searchDMUsers(e.target.value)
                }}
              />
              {dmSearching && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Searching...</div>}
              {dmResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {dmResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => startDM(u.id)}
                      disabled={dmStarting}
                      className="modal-user-btn"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 14px', borderRadius: '14px', border: 'none',
                        cursor: dmStarting ? 'default' : 'pointer', textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s', opacity: dmStarting ? 0.6 : 1,
                      }}
                      onMouseEnter={e => { if (!dmStarting) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; } }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = ''; }}
                    >
                      <UserAvatar user={u} size={36} />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'inherit' }}>{u.name}</div>
                        <div style={{ fontSize: '11px', opacity: 0.6 }}>{u.email} · {u.role.charAt(0) + u.role.slice(1).toLowerCase()}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {dmSearch.length >= 2 && !dmSearching && dmResults.length === 0 && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>No users found matching "{dmSearch}"</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for full-size image viewing */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: '40px',
          }}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              cursor: 'default',
            }}
          />
          <button
            onClick={async (e) => { e.stopPropagation(); try { const res = await fetch(lightboxUrl!); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `chat-image-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch { window.open(lightboxUrl!, '_blank') } }}
            title="Download image"
            style={{
              position: 'absolute', top: '20px', right: '72px',
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: '20px', right: '20px',
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', fontSize: '20px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      )}

      {longPressedClass && (
        <div 
          className="modal-overlay fade-in" 
          onClick={() => setLongPressedClass(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div 
            className="bottom-sheet-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '450px',
              background: 'var(--surface)',
              borderRadius: '32px 32px 0 0',
              padding: '24px 20px 40px',
              boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ width: '36px', height: '4px', background: 'var(--text-muted)', opacity: 0.3, borderRadius: '2px', alignSelf: 'center', marginBottom: '8px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
              <CourseIconBadge
                type={longPressedClass.courseIconType || longPressedClass.icon}
                size={56}
                iconSize={26}
                radius={18}
                style={{ boxShadow: '0 8px 20px rgba(79, 70, 229, 0.18)' }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{longPressedClass.name}</h4>
                {longPressedClass.subject && <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{longPressedClass.subject}</p>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Mute Notifications */}
              <button
                onClick={async () => {
                  const isCurrentlyMuted = longPressedClass.isMuted || false
                  await toggleMuteCourse(longPressedClass.id, isCurrentlyMuted)
                  setLongPressedClass(null)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px', borderRadius: '20px', border: 'none',
                  background: 'var(--surface-2)', color: 'var(--text-primary)',
                  fontWeight: 700, fontSize: '14.5px', cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                }}
              >
                <div style={{ color: longPressedClass.isMuted ? 'var(--success)' : 'var(--danger)', display: 'flex' }}>
                  {longPressedClass.isMuted ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8v7a3 3 0 0 1-3 3h18a3 3 0 0 1-3-3V8z" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
                      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8v7a3 3 0 0 1-3 3h15" />
                      <path d="M18 8a6 6 0 0 0-9.33-5" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </div>
                <span>{longPressedClass.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
              </button>

              {/* Mark all messages as read */}
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/community/${longPressedClass.id}/read`, { method: 'POST' })
                    if (res.ok) {
                      setClasses(prev => prev.map(c => c.id === longPressedClass.id ? { ...c, hasUnread: false } : c))
                    }
                  } catch (e) { console.error(e) }
                  setLongPressedClass(null)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px', borderRadius: '20px', border: 'none',
                  background: 'var(--surface-2)', color: 'var(--text-primary)',
                  fontWeight: 700, fontSize: '14.5px', cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                }}
              >
                <div style={{ color: 'var(--info)', display: 'flex' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                    <polyline points="20 12 13 19 8 14" />
                  </svg>
                </div>
                <span>Mark all messages as read</span>
              </button>

              {/* View course materials */}
              <button
                onClick={() => {
                  setLongPressedClass(null)
                  router.push(`/courses/${longPressedClass.id}`)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px', borderRadius: '20px', border: 'none',
                  background: 'var(--surface-2)', color: 'var(--text-primary)',
                  fontWeight: 700, fontSize: '14.5px', cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                }}
              >
                <div style={{ color: 'var(--accent)', display: 'flex' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <span>View course materials</span>
              </button>
            </div>

            <button
              onClick={() => setLongPressedClass(null)}
              style={{
                marginTop: '8px',
                padding: '16px', borderRadius: '20px', border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text-secondary)',
                fontWeight: 700, fontSize: '14.5px', cursor: 'pointer',
                textAlign: 'center', width: '100%',
              }}
            >
              Cancel
            </button>
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
            width: '320px'
          }}>
            <div className="spinner" style={{
              width: '40px', height: '40px', border: '4px solid #f3f3f3',
              borderTop: '4px solid #6366f1', borderRadius: '50%',
              margin: '0 auto 20px',
              animation: 'spin 1s linear infinite'
            }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Processing...</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>Please wait while we set up your course access.</p>
          </div>
        </div>
      )}

      {/* Course Purchase Modal */}
      {showPurchaseModal && offering && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001,
          padding: '20px', overflow: 'auto'
        }} onClick={() => setShowPurchaseModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '480px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '30px',
            animation: 'modalSlideUp 0.3s ease-out',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            {/* Info / Know Difference Button */}
            <div style={{ position: 'absolute', top: '20px', right: '60px', zIndex: 10 }}>
              <button 
                onClick={() => {
                  setShowPurchaseModal(false)
                  setShowComparisonModal(true)
                }}
                title="Click here to Know difference between Pro and Plus batch"
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
                  const tooltip = document.getElementById('community-purchase-tooltip')
                  if (tooltip) tooltip.style.opacity = '1'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                  const tooltip = document.getElementById('community-purchase-tooltip')
                  if (tooltip) tooltip.style.opacity = '0'
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'serif' }}>i</span>
              </button>

              {/* Tooltip style bubble */}
              <div 
                id="community-purchase-tooltip"
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: '50%',
                  transform: 'translateX(50%)',
                  background: '#6366f1',
                  color: 'white',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                  opacity: 0,
                  pointerEvents: 'none',
                  transition: 'opacity 0.2s ease',
                  zIndex: 20,
                  textAlign: 'center'
                }}
              >
                Click here to see difference between PLUS AND PRO batches
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  marginLeft: '-5px',
                  borderWidth: '5px',
                  borderStyle: 'solid',
                  borderColor: 'transparent transparent #6366f1 transparent'
                }} />
              </div>
            </div>

            <button 
              onClick={() => setShowPurchaseModal(false)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--surface)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.2s', zIndex: 10 }}
            >
              ✕
            </button>

            {/* Course Header Color Band */}
            <div style={{
              background: `linear-gradient(135deg, ${offering.course?.color || '#6366f1'}, ${colorWithOpacity(offering.course?.color || '#6366f1', 'cc')})`,
              margin: '-30px -30px 24px -30px',
              padding: '40px 30px 30px 30px',
              borderTopLeftRadius: '32px',
              borderTopRightRadius: '32px',
              color: '#fff',
              position: 'relative',
              textAlign: 'center'
            }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V5A2.5 2.5 0 0 1 6.5 2.5H20v20H6.5a2.5 2.5 0 0 1-2-2.5z"/></svg>
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#fff', marginBottom: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                {offering.course?.name}
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600', marginBottom: '0' }}>
                {offering.course?.subject}
              </p>
              <button
                onClick={() => {
                  setShowPurchaseModal(false)
                  setShowComparisonModal(true)
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
                  padding: '6px 14px', borderRadius: '20px', color: '#fff',
                  fontSize: '11px', fontWeight: '800', cursor: 'pointer',
                  marginTop: '12px', transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                Click here to Know difference between Pro and Plus batch
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Recorded Batch Option */}
              {offering.hasRecorded && (
                <div style={{
                  padding: '16px', borderRadius: '20px',
                  background: 'var(--surface-2, rgba(99, 102, 241, 0.02))',
                  border: '1.5px solid var(--border)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        📹 Recorded Batch - PLUS
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
                          ₹{Math.max(Number(offering.recordedDiscountPrice || 0), 1)}
                        </span>
                        {Number(offering.recordedOriginalPrice || 0) > Math.max(Number(offering.recordedDiscountPrice || 0), 1) && (
                          <span style={{ fontSize: '14px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                            ₹{offering.recordedOriginalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePurchase(offering.id, 'RECORDED')}
                    disabled={!!purchasing}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '50px',
                      border: '2.5px solid var(--accent)', background: 'transparent',
                      color: 'var(--accent)', fontSize: '14px', fontWeight: '800',
                      cursor: purchasing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {purchasing === `${offering.id}-RECORDED` ? 'Processing...' : 'Buy PLUS Batch'}
                  </button>
                </div>
              )}

              {/* Live Batch Option */}
              {offering.hasLive && (
                <div style={{
                  padding: '16px', borderRadius: '20px',
                  background: 'var(--surface-2, rgba(99, 102, 241, 0.02))',
                  border: '1.5px solid var(--accent)',
                  position: 'relative',
                  boxShadow: '0 8px 24px rgba(99,102,241,0.08)'
                }}>
                  <div style={{
                    position: 'absolute', top: '12px', right: '16px',
                    padding: '3px 10px', borderRadius: '20px',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: '9px', fontWeight: '900', letterSpacing: '0.08em',
                  }}>
                    PRO
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        🔴 Live + Recorded Batch - PRO
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
                          ₹{Math.max(Number(offering.liveDiscountPrice || 0), 1)}
                        </span>
                        {Number(offering.liveOriginalPrice || 0) > Math.max(Number(offering.liveDiscountPrice || 0), 1) && (
                          <span style={{ fontSize: '14px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                            ₹{offering.liveOriginalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePurchase(offering.id, 'LIVE')}
                    disabled={!!purchasing}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '50px',
                      border: 'none', background: 'var(--accent)',
                      color: '#fff', fontSize: '14px', fontWeight: '800',
                      cursor: purchasing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {purchasing === `${offering.id}-LIVE` ? 'Processing...' : '⚡ Buy PLUS + PRO Batch'}
                  </button>
                </div>
              )}

              {/* Champion Option */}
              {offering.championDiscountPrice > 0 && (
                <div style={{
                  padding: '16px', borderRadius: '20px',
                  background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                  border: '1.5px solid #fca5a5',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: '12px', right: '16px',
                    padding: '3px 10px', borderRadius: '20px',
                    background: 'var(--danger)', color: '#fff',
                    fontSize: '9px', fontWeight: '900', letterSpacing: '0.08em',
                  }}>
                    CHAMPION
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        🏆 Champion - {offering.championSubtitle || 'Premium Wrapper'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>
                          ₹{offering.championDiscountPrice}
                        </span>
                        {offering.championOriginalPrice > offering.championDiscountPrice && (
                          <span style={{ fontSize: '14px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                            ₹{offering.championOriginalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePurchase(offering.id, 'CHAMPION')}
                    disabled={!!purchasing}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '50px',
                      border: 'none', background: 'var(--danger)',
                      color: '#fff', fontSize: '14px', fontWeight: '800',
                      cursor: purchasing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {purchasing === `${offering.id}-CHAMPION` ? 'Processing...' : '⚡ Buy PLUS + PRO + CHAMPION Batch'}
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer info */}
            <div style={{
              marginTop: '24px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span>⌛</span> Access Till End Term
              </div>
              <button
                onClick={() => router.push(`/support?openTicket=true&type=GENERAL&classId=${offering?.courseId || ''}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '11.5px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '4px 8px',
                  marginTop: '4px',
                }}
              >
                Need Help? Contact Support
              </button>
            </div>
          </div>
        </div>
      )}

      {successOrderId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001,
          padding: '20px'
        }} onClick={() => { setSuccessOrderId(null); window.location.reload() }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '32px', width: '100%', maxWidth: '440px',
            boxShadow: '0 0 100px var(--neu-glow), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '40px', textAlign: 'center',
            animation: 'modalSlideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Course Unlocked!</h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              Your payment was verified successfully. You now have full access to all lectures, class materials, and student benefits.
            </p>
            <button
              onClick={() => { setSuccessOrderId(null); window.location.reload() }}
              style={{
                width: '100%', padding: '16px', borderRadius: '18px', border: 'none',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)',
                color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              }}
            >
              Got it, let&apos;s go! 🚀
            </button>
          </div>
        </div>
      )}
      {/* Batch Comparison Modal */}
      {showComparisonModal && offering && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002,
          padding: '20px', overflow: 'auto'
        }} onClick={() => {
          setShowComparisonModal(false)
          setShowPurchaseModal(true)
        }}>
          <div style={{
            background: '#1e2230', borderRadius: '24px', width: '100%', maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '30px',
            animation: 'modalSlideUp 0.3s ease-out',
            position: 'relative',
            color: '#ffffff'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => {
                setShowComparisonModal(false)
                setShowPurchaseModal(true)
              }}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.08)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a0aec0', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              ✕
            </button>

            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px', color: '#ffffff' }}>Batch Comparison</h2>
            <p style={{ fontSize: '13px', color: '#a0aec0', marginBottom: '24px', fontWeight: '500' }}>
              Choose the experience that fits your learning style
            </p>

            {/* Comparison Table */}
            <div style={{
              borderRadius: '16px', overflow: 'hidden', border: '1px solid #2d3748',
              background: '#1a1d28', marginBottom: '24px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2d3748', background: '#171923' }}>
                    <th style={{ padding: '14px 16px', fontWeight: '700', color: '#a0aec0', width: '40%' }}>FEATURES</th>
                    <th style={{ padding: '14px 16px', fontWeight: '800', color: '#d69e2e', textAlign: 'center', width: '30%', background: 'rgba(214, 158, 46, 0.05)' }}>PLUS</th>
                    <th style={{ padding: '14px 16px', fontWeight: '800', color: '#6366f1', textAlign: 'center', width: '30%', background: 'rgba(99, 102, 241, 0.05)' }}>PRO</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Lectures', plus: '✅ Full', pro: '✅ Full' },
                    { name: 'Materials', plus: '✅ Full', pro: '✅ Full' },
                    { name: 'Live Classes', plus: '❌ No', pro: '✅ Yes' },
                    { name: 'Q&A w/ Teacher', plus: '❌ No', pro: '✅ Live' },
                    { name: 'Mentorship', plus: '❌ No', pro: '✅ Weekly' },
                    { name: 'Support', plus: '❌ Basic', pro: '✅ Priority' },
                  ].map((row, index) => (
                    <tr key={row.name} style={{ borderBottom: index < 5 ? '1px solid #2d3748' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#e2e8f0' }}>{row.name}</td>
                      <td style={{
                        padding: '12px 16px', textAlign: 'center', fontWeight: '700',
                        color: row.plus.includes('✅') ? '#48bb78' : '#e53e3e',
                        background: 'rgba(214, 158, 46, 0.02)'
                      }}>
                        {row.plus}
                      </td>
                      <td style={{
                        padding: '12px 16px', textAlign: 'center', fontWeight: '700',
                        color: row.pro.includes('✅') ? '#48bb78' : '#e53e3e',
                        background: 'rgba(99, 102, 241, 0.02)'
                      }}>
                        {row.pro}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Got it button */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setShowComparisonModal(false)
                  setShowPurchaseModal(true)
                }}
                style={{
                  padding: '12px 32px', borderRadius: '50px', border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#ffffff',
                  fontSize: '14px', fontWeight: '800', cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    </div>
  )
}
