'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import UserAvatar from '@/components/UserAvatar'
import {
  Award,
  BarChart3,
  Calculator,
  CircleHelp,
  Download,
  Flag,
  GraduationCap,
  HeartHandshake,
  MapPin,
  Medal,
  MessageCircle,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  X,
} from 'lucide-react'
import { getSocialCardAboutMe } from '@/lib/social-card-defaults'

interface SocialBadge {
  id: string
  badgeId: string
  label: string
  category: string
  system?: boolean
}

interface BadgeDefinition {
  id: string
  label: string
  category: string
}

interface SocialCardData {
  user: {
    id: string
    name: string
    role: string
    avatar?: string | null
    gender?: string | null
    aboutMe: string
    publicFields: { key: string; label: string; value: string | number }[]
    badges: SocialBadge[]
    instagramUrl?: string | null
    linkedinUrl?: string | null
  }
  viewer: {
    isSelf: boolean
    isStaff: boolean
    canReport: boolean
    canTalkToManager: boolean
    canViewFullAvatar: boolean
    canOpenManagerProfile: boolean
    whatsappUrl?: string | null
    whatsappError?: string | null
  }
}

interface SocialCardPreviewOverride {
  aboutMe?: string
  publicFields?: SocialCardData['user']['publicFields']
  instagramUrl?: string | null
  linkedinUrl?: string | null
  viewer?: Partial<SocialCardData['viewer']>
}

type FlipStage = 'idle' | 'out' | 'preIn' | 'in' | 'settle' | 'spinning'

const REPORT_REASONS = [
  {
    id: 'SPAM',
    label: 'Spam',
    description: 'Repeated, promotional, or suspicious activity',
    subReasons: [
      'Repeated unwanted messages',
      'Advertising / promotion',
      'Irrelevant repeated content',
      'Suspicious links',
      'Mass messaging',
      'Other spam',
    ],
  },
  {
    id: 'HARASSMENT_BULLYING',
    label: 'Harassment / Bullying',
    description: 'Targeted, threatening, or humiliating behavior',
    subReasons: [
      'Personal attacks',
      'Threatening behavior',
      'Repeated targeting',
      'Humiliation / mocking',
      'Other',
    ],
  },
  {
    id: 'ABUSIVE_LANGUAGE',
    label: 'Abusive Language',
    description: 'Insults, hateful, obscene, or repeated abusive language',
    subReasons: [
      'Insults',
      'Hate/derogatory language',
      'Sexual/obscene language',
      'Repeated abusive messages',
      'Other',
    ],
  },
  {
    id: 'INAPPROPRIATE_CONTENT',
    label: 'Inappropriate Content',
    description: 'Sexual, graphic, offensive, or NSFW material',
    subReasons: [
      'Sexual content',
      'Graphic/disturbing content',
      'Offensive material',
      'NSFW content',
      'Other',
    ],
  },
  {
    id: 'IMPERSONATION',
    label: 'Impersonation',
    description: 'Pretending to be someone else or using a fake profile',
    subReasons: [
      'Pretending to be another student',
      'Pretending to be Manager/Admin',
      'Fake identity/profile',
      'Other',
    ],
  },
  {
    id: 'SCAM_FRAUD',
    label: 'Scam / Fraud',
    description: 'Money requests, fake offers, or suspicious payment claims',
    subReasons: [
      'Asking for money',
      'Fake course/payment claim',
      'Suspicious link',
      'Fake offer',
      'Other',
    ],
  },
  {
    id: 'UNWANTED_MESSAGES',
    label: 'Unwanted Messages',
    description: 'Unwanted DMs, personal messages, or excessive mentions',
    subReasons: [
      'Repeated DMs',
      'Unwanted personal messages',
      'Excessive mentions',
      'Other',
    ],
  },
  {
    id: 'ACADEMIC_MISCONDUCT',
    label: 'Academic Misconduct',
    description: 'Cheating, answer sharing, or restricted material',
    subReasons: [
      'Sharing answers',
      'Cheating-related content',
      'Selling/sharing restricted material',
      'Other',
    ],
  },
  {
    id: 'OTHER',
    label: 'Other',
    description: 'Something else that needs review',
    subReasons: [],
  },
]

interface SocialCardModalProps {
  userId: string
  onClose: () => void
  onChatStarted?: (chatId: string) => void | Promise<void>
  previewOverride?: SocialCardPreviewOverride
}

async function fetchSocialCardData(userId: string): Promise<SocialCardData> {
  const res = await fetch(`/api/social-card/${userId}`, { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Failed to load Social Card')
  return json
}

async function fetchViewerUserId() {
  const res = await fetch('/api/auth/me', { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.user?.id) throw new Error(json.error || 'Failed to load viewer')
  return String(json.user.id)
}

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase()
}

const InstagramIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

const LinkedInIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
)

const WhatsAppIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.705 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
  </svg>
)

function getFirstName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] || 'Card'
}

function getMedalIcon(badge: SocialBadge) {
  const text = `${badge.badgeId} ${badge.label}`.toLowerCase()
  if (badge.system || text.includes('genz iitian')) return GraduationCap
  if (text.includes('math')) return Calculator
  if (text.includes('stat')) return BarChart3
  if (text.includes('talk')) return MessageCircle
  if (text.includes('question')) return CircleHelp
  if (text.includes('star')) return Star
  if (text.includes('focus')) return Target
  if (text.includes('comment')) return MessageSquareText
  if (text.includes('help') || text.includes('doubt')) return HeartHandshake
  if (text.includes('topper') || text.includes('quiz') || text.includes('term') || text.includes('ct')) return Trophy
  return Medal
}

function getPublicInfoIcon(key: string) {
  if (key === 'state') return MapPin
  if (key === 'iitmLevel') return GraduationCap
  if (key === 'cgpa') return Award
  return UserRound
}

function waitForNextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function waitForSocialCardAssets(node: HTMLElement) {
  await document.fonts?.ready.catch(() => undefined)
  const images = Array.from(node.querySelectorAll('img'))
  await Promise.all(images.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve()
    return new Promise<void>(resolve => {
      img.addEventListener('load', () => resolve(), { once: true })
      img.addEventListener('error', () => resolve(), { once: true })
    })
  }))
}

function getSocialCardFileName(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'profile'}-genz-iitian-social-card.png`
}

function triggerWebPngDownload(dataUrl: string, fileName: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function SocialCardModal({ userId, onClose, onChatStarted, previewOverride }: SocialCardModalProps) {
  const router = useRouter()
  const socialCardRef = useRef<HTMLDivElement | null>(null)
  const [activeUserId, setActiveUserId] = useState(userId)
  const [viewerUserId, setViewerUserId] = useState('')
  const [returnCardTarget, setReturnCardTarget] = useState<{ userId: string; name: string } | null>(null)
  const [data, setData] = useState<SocialCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [downloadingCard, setDownloadingCard] = useState(false)
  const [exportingCard, setExportingCard] = useState(false)
  const [switchingCard, setSwitchingCard] = useState(false)
  const [flipStage, setFlipStage] = useState<FlipStage>('idle')
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [showAllBadges, setShowAllBadges] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportStep, setReportStep] = useState<1 | 2>(1)
  const [reportReason, setReportReason] = useState('')
  const [reportSubReason, setReportSubReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [reportMessage, setReportMessage] = useState('')
  const [startingChat, setStartingChat] = useState(false)
  const [fullAvatarOpen, setFullAvatarOpen] = useState(false)
  const [showManageMedals, setShowManageMedals] = useState(false)
  const [badgeDefs, setBadgeDefs] = useState<BadgeDefinition[]>([])
  const [selectedBadgeId, setSelectedBadgeId] = useState('')
  const [savingBadge, setSavingBadge] = useState(false)
  const [medalManageError, setMedalManageError] = useState('')
  const [sharingCard, setSharingCard] = useState(false)
  const [isMobilePlatform, setIsMobilePlatform] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareImageUri, setShareImageUri] = useState<string | null>(null)
  const [copiedShareText, setCopiedShareText] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const { Capacitor } = (window as any).Capacitor ? window as any : { Capacitor: null }
      if (Capacitor?.isNativePlatform()) return true
      const ua = window.navigator.userAgent
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      return isMobileUA || (isTouchDevice && window.innerWidth <= 1024)
    }
    setIsMobilePlatform(checkMobile())
  }, [])

  function resetTransientCardState() {
    setShowAllBadges(false)
    setShowReport(false)
    setReportStep(1)
    setReportReason('')
    setReportSubReason('')
    setReportDetails('')
    setReportMessage('')
    setDownloadError('')
    setFullAvatarOpen(false)
    setShowManageMedals(false)
    setSelectedBadgeId('')
    setMedalManageError('')
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    setDownloadError('')
    setActiveUserId(userId)
    setReturnCardTarget(null)
    setFlipStage('idle')
    setSwitchingCard(false)
    setShowManageMedals(false)
    setShowAllBadges(false)
    setSelectedBadgeId('')
    setMedalManageError('')
    fetchSocialCardData(userId)
      .then(json => {
        if (alive) setData(json)
      })
      .catch(err => {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load Social Card')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [userId])

  useEffect(() => {
    let alive = true
    fetchViewerUserId()
      .then(id => {
        if (alive) setViewerUserId(id)
      })
      .catch(() => {
        if (alive) setViewerUserId('')
      })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(media.matches)
    updatePreference()
    media.addEventListener?.('change', updatePreference)
    return () => media.removeEventListener?.('change', updatePreference)
  }, [])

  async function refreshSocialCard() {
    const nextData = await fetchSocialCardData(activeUserId)
    setData(nextData)
  }

  async function openMedalManager() {
    setShowManageMedals(true)
    setMedalManageError('')
    if (badgeDefs.length > 0) return
    try {
      const res = await fetch(`/api/social-card/${activeUserId}/badges`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to load medals')
      setBadgeDefs(Array.isArray(json.badges) ? json.badges : [])
    } catch (err) {
      setMedalManageError(err instanceof Error ? err.message : 'Failed to load medals')
    }
  }

  async function assignBadge() {
    if (!selectedBadgeId || savingBadge) return
    setSavingBadge(true)
    setMedalManageError('')
    try {
      const res = await fetch(`/api/social-card/${activeUserId}/badges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId: selectedBadgeId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to add medal')
      setSelectedBadgeId('')
      await refreshSocialCard()
    } catch (err) {
      setMedalManageError(err instanceof Error ? err.message : 'Failed to add medal')
    } finally {
      setSavingBadge(false)
    }
  }

  async function removeBadge(badgeId: string) {
    if (savingBadge) return
    setSavingBadge(true)
    setMedalManageError('')
    try {
      const res = await fetch(`/api/social-card/${activeUserId}/badges`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to remove medal')
      await refreshSocialCard()
    } catch (err) {
      setMedalManageError(err instanceof Error ? err.message : 'Failed to remove medal')
    } finally {
      setSavingBadge(false)
    }
  }

  async function submitReport() {
    const selectedReason = REPORT_REASONS.find(reason => reason.id === reportReason)
    const needsSubReason = Boolean(selectedReason && selectedReason.subReasons.length > 0)
    const needsDetails = reportReason === 'OTHER'
    if (!selectedReason || submittingReport || (needsSubReason && !reportSubReason) || (needsDetails && !reportDetails.trim())) return
    setSubmittingReport(true)
    setReportMessage('')
    try {
      const res = await fetch(`/api/social-card/${activeUserId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reportReason,
          subReason: reportSubReason,
          details: reportDetails,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to submit report')
      setReportMessage('Report submitted')
      setShowReport(false)
      setReportStep(1)
      setReportReason('')
      setReportSubReason('')
      setReportDetails('')
    } catch (err) {
      setReportMessage(err instanceof Error ? err.message : 'Failed to submit report')
    } finally {
      setSubmittingReport(false)
    }
  }

  const handleSocialLinkClick = async (e: React.MouseEvent, url: string) => {
    e.preventDefault()
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url })
        return
      }
    } catch (err) {
      console.error('Failed to open link with Capacitor Browser, falling back to window.open', err)
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function startManagerChat() {
    if (!data || startingChat) return
    setStartingChat(true)
    try {
      const res = await fetch('/api/community/direct/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId: data.user.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to start chat')
      await onChatStarted?.(json.chatId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start chat')
    } finally {
      setStartingChat(false)
    }
  }

  async function transitionToSocialCard(nextUserId: string, options?: { rememberCurrent?: boolean; clearReturnTarget?: boolean }) {
    if (!data || switchingCard || nextUserId === activeUserId) return
    const currentTarget = { userId: data.user.id, name: data.user.name }
    setSwitchingCard(true)
    setError('')
    setDownloadError('')

    try {
      const nextData = await fetchSocialCardData(nextUserId)

      if (prefersReducedMotion) {
        setFlipStage('out')
        await delay(120)
        setData(nextData)
        setActiveUserId(nextUserId)
        resetTransientCardState()
        if (options?.clearReturnTarget) {
          setReturnCardTarget(null)
        } else if (options?.rememberCurrent !== false) {
          setReturnCardTarget(currentTarget)
        }
        setFlipStage('preIn')
        await waitForNextFrame()
        setFlipStage('in')
        await delay(120)
      } else {
        // 1. Trigger the single continuous Y-axis spin animation
        setFlipStage('spinning')
        
        // 2. Wait exactly for the 50% midpoint (340ms) to swap card content invisible to the eye
        await delay(340)

        setData(nextData)
        setActiveUserId(nextUserId)
        resetTransientCardState()
        if (options?.clearReturnTarget) {
          setReturnCardTarget(null)
        } else if (options?.rememberCurrent !== false) {
          setReturnCardTarget(currentTarget)
        }

        // 3. Wait for the second half of keyframe animation to complete and settle (340ms)
        await delay(340)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Social Card')
    } finally {
      setFlipStage('idle')
      setSwitchingCard(false)
    }
  }

  function switchToMyCard() {
    if (!viewerUserId || switchingCard) return
    transitionToSocialCard(viewerUserId, { rememberCurrent: true })
  }

  function switchBackToViewedCard() {
    if (!returnCardTarget || switchingCard) return
    transitionToSocialCard(returnCardTarget.userId, { rememberCurrent: false, clearReturnTarget: true })
  }

  async function downloadSocialCard() {
    if (!data?.viewer.isSelf || !socialCardRef.current || downloadingCard || switchingCard) return
    const cardNode = socialCardRef.current
    const fileName = getSocialCardFileName(data.user.name)

    setDownloadingCard(true)
    setDownloadError('')
    setExportingCard(true)

    try {
      await waitForNextFrame()
      await waitForSocialCardAssets(cardNode)
      const { toPng } = await import('html-to-image')
      const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 2, 2), 3)
      const dataUrl = await toPng(cardNode, {
        cacheBust: true,
        pixelRatio,
        backgroundColor: getComputedStyle(cardNode).backgroundColor,
        style: {
          maxHeight: 'none',
          overflow: 'visible',
        },
      })

      try {
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform()) {
          const { Filesystem, Directory } = await import('@capacitor/filesystem')
          const { Share } = await import('@capacitor/share')
          const base64Data = dataUrl.split(',')[1]
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          })
          await Share.share({
            title: 'Download Social Card',
            text: 'My GenZ IITIAN Social Card',
            url: savedFile.uri,
            dialogTitle: 'Save or share Social Card',
          })
          return
        }
      } catch (nativeError) {
        console.warn('Native Social Card share failed, falling back to browser download:', nativeError)
      }

      triggerWebPngDownload(dataUrl, fileName)
    } catch (err) {
      console.error('Social Card export failed:', err)
      setDownloadError(err instanceof Error ? err.message : 'Failed to download Social Card')
    } finally {
      setExportingCard(false)
      setDownloadingCard(false)
    }
  }

  async function shareSocialCard() {
    if (!data?.viewer.isSelf || !socialCardRef.current || sharingCard || switchingCard) return
    const cardNode = socialCardRef.current
    const fileName = getSocialCardFileName(data.user.name)

    setSharingCard(true)
    setDownloadError('')
    setExportingCard(true)

    try {
      await waitForNextFrame()
      await waitForSocialCardAssets(cardNode)
      const { toPng } = await import('html-to-image')
      const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 2, 2), 3)
      const dataUrl = await toPng(cardNode, {
        cacheBust: true,
        pixelRatio,
        backgroundColor: getComputedStyle(cardNode).backgroundColor,
        style: {
          maxHeight: 'none',
          overflow: 'visible',
        },
      })

      const shareText = 'I just created my GenZ IITian Social Card! Create yours at class.genziitian.in'
      const shareTitle = 'My GenZ IITian Social Card'

      // 1. Capacitor Native platform sharing
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform()) {
          const { Filesystem, Directory } = await import('@capacitor/filesystem')
          const { Share } = await import('@capacitor/share')
          const base64Data = dataUrl.split(',')[1]
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          })
          await Share.share({
            title: shareTitle,
            text: shareText,
            url: savedFile.uri,
            files: [savedFile.uri],
            dialogTitle: 'Share Social Card',
          })
          return
        }
      } catch (nativeError) {
        console.warn('Native Social Card share failed, trying Web Share fallback:', nativeError)
      }

      // Helper to convert dataUrl to File
      const dataURLtoFile = (dataurl: string, filename: string): File => {
        const arr = dataurl.split(',')
        const mime = arr[0].match(/:(.*?);/)![1]
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n)
        }
        return new File([u8arr], filename, { type: mime })
      }

      // 2. Web Share API with File sharing
      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          const file = dataURLtoFile(dataUrl, fileName)
          const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] })
          
          if (canShareFiles) {
            await navigator.share({
              files: [file],
              text: shareText,
              title: shareTitle,
            })
            return
          }
        }
      } catch (webShareError) {
        console.warn('Web share failed, opening custom share modal:', webShareError)
      }

      // 3. Fallback: Open custom share modal in UI
      setShareImageUri(dataUrl)
      setShowShareModal(true)

    } catch (err) {
      console.error('Social Card sharing failed:', err)
      setDownloadError(err instanceof Error ? err.message : 'Failed to share Social Card')
    } finally {
      setExportingCard(false)
      setSharingCard(false)
    }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const cardData = data
    ? {
        ...data,
        user: {
          ...data.user,
          aboutMe: getSocialCardAboutMe(previewOverride?.aboutMe ?? data.user.aboutMe, data.user.role),
          publicFields: previewOverride?.publicFields ?? data.user.publicFields,
          instagramUrl: previewOverride?.instagramUrl !== undefined ? previewOverride.instagramUrl : data.user.instagramUrl,
          linkedinUrl: previewOverride?.linkedinUrl !== undefined ? previewOverride.linkedinUrl : data.user.linkedinUrl,
        },
        viewer: {
          ...data.viewer,
          ...previewOverride?.viewer,
        },
      }
    : null
  const visibleBadges = cardData?.user.badges
    ? (showAllBadges ? cardData.user.badges : cardData.user.badges.slice(0, 2))
    : []
  const hiddenBadgeCount = cardData?.user.badges ? Math.max(0, cardData.user.badges.length - visibleBadges.length) : 0
  const canManageMedals = Boolean(cardData?.viewer.isStaff && !cardData.viewer.isSelf)
  const managedBadges = data?.user.badges.filter(badge => !badge.system) || []
  const availableBadges = badgeDefs.filter(def => !managedBadges.some(badge => badge.badgeId === def.id))
  const selectedReportReason = REPORT_REASONS.find(reason => reason.id === reportReason)
  const reportNeedsSubReason = Boolean(selectedReportReason && selectedReportReason.subReasons.length > 0)
  const reportNeedsDetails = reportReason === 'OTHER'
  const canSubmitReport = Boolean(selectedReportReason && !submittingReport && (!reportNeedsSubReason || reportSubReason) && (!reportNeedsDetails || reportDetails.trim()))
  const canSwitchToMyCard = Boolean(!previewOverride && cardData && viewerUserId && activeUserId !== viewerUserId && !cardData.viewer.isSelf)
  const canSwitchBackToViewedCard = Boolean(!previewOverride && cardData?.viewer.isSelf && returnCardTarget)
  const modalMotionStyle = prefersReducedMotion
    ? {
        opacity: flipStage === 'idle' ? 1 : 0.2,
        transition: 'opacity 150ms ease',
      }
    : {
        animation: flipStage === 'spinning'
          ? 'card-flip-spin 680ms cubic-bezier(0.23, 1, 0.32, 1) forwards'
          : 'none',
        transformStyle: 'preserve-3d' as const,
        willChange: flipStage === 'spinning' ? 'transform, opacity, box-shadow' : undefined,
      }

  function closeReportFlow() {
    setShowReport(false)
    setReportStep(1)
    setReportReason('')
    setReportSubReason('')
    setReportDetails('')
  }

  function selectReportReason(reasonId: string) {
    setReportReason(reasonId)
    setReportSubReason('')
    setReportDetails('')
    setReportStep(2)
  }

  const roleThemeStyle = cardData?.user.role === 'MANAGER'
    ? {
        '--surface': '#130f26',
        '--border': 'rgba(99, 102, 241, 0.24)',
        '--border-light': 'rgba(99, 102, 241, 0.16)',
        '--social-card-border': '#4f46e5',
        '--social-card-shadow': '0 15px 35px rgba(19, 15, 38, 0.4), 0 5px 15px rgba(0, 0, 0, 0.2)',
        '--text-primary': '#ffffff',
        '--text-secondary': '#c7d2fe',
        '--text-muted': '#818cf8',
        '--surface-2': '#211c3d',
        '--primary': '#818cf8',
        '--accent': '#6366f1',
      }
    : (cardData?.user.role === 'ADMIN' || cardData?.user.role === 'MODERATOR')
    ? {
        '--surface': '#1a0a0d',
        '--border': 'rgba(239, 68, 68, 0.24)',
        '--border-light': 'rgba(239, 68, 68, 0.16)',
        '--social-card-border': '#b91c1c',
        '--social-card-shadow': '0 15px 35px rgba(26, 10, 13, 0.4), 0 5px 15px rgba(0, 0, 0, 0.2)',
        '--text-primary': '#ffffff',
        '--text-secondary': '#fecdd3',
        '--text-muted': '#fb7185',
        '--surface-2': '#2b1419',
        '--primary': '#fb7185',
        '--accent': '#ef4444',
      }
    : {};

  return (
    <div
      className="modal-overlay"
      onClick={() => { if (!switchingCard) onClose() }}
      style={{
        alignItems: isMobile ? 'flex-end' : 'center',
        zIndex: 1200,
        padding: isMobile ? '0' : '18px',
        perspective: prefersReducedMotion ? undefined : '1200px',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        ref={socialCardRef}
        className="modal no-scrollbar"
        onClick={e => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : '92%',
          maxWidth: isMobile ? '100%' : '680px',
          maxHeight: isMobile ? '92vh' : '86vh',
          overflowY: 'auto',
          borderRadius: isMobile ? '24px 24px 0 0' : '22px',
          padding: isMobile ? '18px 18px max(18px, env(safe-area-inset-bottom))' : '24px',
          background: 'var(--surface)',
          border: '1.5px solid var(--social-card-border)',
          boxShadow: 'var(--social-card-shadow)',
          position: 'relative',
          ...modalMotionStyle,
          ...roleThemeStyle,
        } as React.CSSProperties}
      >
        <div style={{ position: 'absolute', top: isMobile ? '16px' : '18px', right: isMobile ? '16px' : '18px', zIndex: 2, display: (exportingCard || switchingCard) ? 'none' : 'block' }}>
          <button onClick={() => { if (!switchingCard) onClose() }} aria-label="Close" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '16px', minHeight: '260px' }}>
            {/* Header skeleton */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingBottom: '6px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div className="skeleton" style={{ width: '80px', height: '11px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ width: '50px', height: '8px', borderRadius: '3px' }} />
              </div>
              <div className="skeleton" style={{ width: '6px', height: '6px', borderRadius: '50%' }} />
            </div>

            {/* Main content grid skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(160px, 0.8fr) minmax(0, 1.2fr)', gap: isMobile ? '14px' : '20px', alignItems: 'start', minWidth: 0, padding: isMobile ? '4px 40px 2px 0' : '0 44px 0 0' }}>
              {/* Left Column: Avatar + Name */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start', gap: '10px', minWidth: 0 }}>
                <div className="skeleton" style={{ width: isMobile ? '98px' : '104px', height: isMobile ? '98px' : '104px', borderRadius: '50%' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start', gap: '6px', width: '100%', maxWidth: '140px' }}>
                  <div className="skeleton" style={{ width: '100%', height: '18px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ width: '60%', height: '12px', borderRadius: '6px' }} />
                </div>
              </div>

              {/* Right Column: Medals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', width: '100%' }}>
                <div className="skeleton" style={{ width: '70px', height: '12px', borderRadius: '4px' }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                  <div className="skeleton" style={{ width: '90px', height: '26px', borderRadius: '12px' }} />
                  <div className="skeleton" style={{ width: '80px', height: '26px', borderRadius: '12px' }} />
                </div>
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border)', width: '100%' }} />

            {/* About section skeleton */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div className="skeleton" style={{ width: '50px', height: '12px', borderRadius: '4px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skeleton" style={{ width: '100%', height: '14px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ width: '90%', height: '14px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ width: '40%', height: '14px', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        ) : error && !data ? (
          <div style={{ minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', textAlign: 'center' }}>{error}</div>
        ) : cardData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '16px' }}>
            {/* Card Identity Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingBottom: '6px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  GenZ IITian
                </span>
                <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Social Card
                </span>
              </div>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)', opacity: 0.5 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(160px, 0.8fr) minmax(0, 1.2fr)', gap: isMobile ? '14px' : '20px', alignItems: 'start', minWidth: 0, padding: isMobile ? '4px 40px 2px 0' : '0 44px 0 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start', gap: '10px', minWidth: 0 }}>
                <div style={{ padding: '5px', borderRadius: '50%', border: '1px solid rgba(99,102,241,0.24)', background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08))', boxShadow: '0 14px 32px rgba(15,23,42,0.10)' }}>
                  <UserAvatar
                    user={cardData.user}
                    size={isMobile ? 98 : 104}
                    crossOrigin="anonymous"
                    onClick={cardData.viewer.canViewFullAvatar && cardData.user.avatar ? () => setFullAvatarOpen(true) : undefined}
                    style={{ border: '3px solid var(--surface)', boxShadow: '0 10px 22px rgba(15,23,42,0.14)' }}
                  />
                </div>
                <div style={{ textAlign: isMobile ? 'center' : 'left', minWidth: 0, maxWidth: '100%' }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, lineHeight: 1.15, overflowWrap: 'break-word' }}>{cardData.user.name}</h2>
                  <span style={{ marginTop: '7px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '999px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800 }}>
                    {cardData.user.role === 'STUDENT' ? <GraduationCap size={12} /> : <ShieldCheck size={12} />}
                    {formatRole(cardData.user.role)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignSelf: 'stretch', minWidth: 0 }}>
                {(cardData.user.badges.length > 0 || canManageMedals) && (
                  <section style={{ display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0, alignSelf: 'stretch' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                        <Medal size={15} color="var(--primary)" />
                        Medals
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {cardData.user.badges.length > 2 && (
                          <button onClick={() => setShowAllBadges(v => !v)} style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: '2px 0' }}>
                            {showAllBadges ? 'Show less' : 'View all'}
                          </button>
                        )}
                        {canManageMedals && (
                          <button onClick={openMedalManager} style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: '11px', fontWeight: 900, cursor: 'pointer', padding: '2px 0' }}>
                            Manage Medals
                          </button>
                        )}
                      </div>
                    </div>
                    {cardData.user.badges.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '9px 11px', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        No medals assigned yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                        {visibleBadges.map((badge, index) => {
                          const Icon = getMedalIcon(badge)
                          const accent = badge.category === 'SYSTEM' ? '#6366f1' : badge.category === 'ACADEMIC' ? '#f59e0b' : '#10b981'
                          const background = badge.category === 'SYSTEM'
                            ? 'rgba(99,102,241,0.10)'
                            : index % 2 === 0 ? 'rgba(245,158,11,0.10)' : 'rgba(16,185,129,0.10)'
                          return (
                            <div key={badge.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', maxWidth: '100%', padding: '7px 10px', borderRadius: '12px', background, border: `1px solid ${accent}33`, color: 'var(--text-primary)' }}>
                              <Icon size={14} color={accent} strokeWidth={2.4} />
                              <span style={{ fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{badge.label}</span>
                            </div>
                          )
                        })}
                        {hiddenBadgeCount > 0 && (
                          <button onClick={() => setShowAllBadges(true)} style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface-2)', color: 'var(--text-secondary)', padding: '7px 10px', fontSize: '12px', fontWeight: 900, cursor: 'pointer' }}>
                            +{hiddenBadgeCount}
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {(cardData.user.instagramUrl || cardData.user.linkedinUrl) && (
                  <section style={{ display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0, alignSelf: 'stretch' }}>
                    <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Social Links
                    </h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {cardData.user.instagramUrl && (
                        <a
                          href={cardData.user.instagramUrl}
                          onClick={(e) => handleSocialLinkClick(e, cardData.user.instagramUrl!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#e1306c'
                            e.currentTarget.style.borderColor = 'rgba(225,48,108,0.4)'
                            e.currentTarget.style.background = 'rgba(225,48,108,0.06)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-secondary)'
                            e.currentTarget.style.borderColor = 'var(--border)'
                            e.currentTarget.style.background = 'var(--surface-2)'
                          }}
                          title="Instagram Profile"
                          aria-label="Instagram Profile"
                        >
                          <InstagramIcon size={18} />
                        </a>
                      )}
                      {cardData.user.linkedinUrl && (
                        <a
                          href={cardData.user.linkedinUrl}
                          onClick={(e) => handleSocialLinkClick(e, cardData.user.linkedinUrl!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#0a66c2'
                            e.currentTarget.style.borderColor = 'rgba(10,102,194,0.4)'
                            e.currentTarget.style.background = 'rgba(10,102,194,0.06)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-secondary)'
                            e.currentTarget.style.borderColor = 'var(--border)'
                            e.currentTarget.style.background = 'var(--surface-2)'
                          }}
                          title="LinkedIn Profile"
                          aria-label="LinkedIn Profile"
                        >
                          <LinkedInIcon size={18} />
                        </a>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border)', width: '100%' }} />

            <section style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>About</h3>
              <div style={{
                fontSize: '14px',
                color: cardData.user.aboutMe ? 'var(--text-primary)' : 'var(--text-muted)',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                padding: '12px 14px',
                borderRadius: '14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                maxHeight: isMobile ? '220px' : '190px',
                overflowY: 'auto',
                overflowWrap: 'break-word',
              }}>
                {cardData.user.aboutMe || 'No About Me yet.'}
              </div>
            </section>

            {cardData.user.publicFields.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Public Info</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {cardData.user.publicFields.map(field => {
                    const Icon = getPublicInfoIcon(field.key)
                    return (
                      <div key={field.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 10px', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)', maxWidth: '100%', minWidth: 0 }}>
                        <Icon size={14} color="var(--primary)" strokeWidth={2.3} />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800 }}>{field.label === 'CGPA' ? 'CGPA' : field.label}</span>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{field.value}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {exportingCard && (
              <div style={{
                borderTop: '1px solid var(--border-light)',
                width: '100%',
                paddingTop: '12px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '11.5px',
                fontWeight: 800,
                letterSpacing: '0.02em',
              }}>
                Visit <span style={{ color: 'var(--primary)' }}>class.genziitian.in</span> to create yours
              </div>
            )}

            {!exportingCard && (
              <>
                {error && <div style={{ width: '100%', color: 'var(--danger)', fontSize: '12px', textAlign: 'center' }}>{error}</div>}
                {downloadError && <div style={{ width: '100%', color: 'var(--danger)', fontSize: '12px', textAlign: 'center' }}>{downloadError}</div>}
                {reportMessage && <div style={{ width: '100%', color: reportMessage === 'Report submitted' ? 'var(--success)' : 'var(--danger)', fontSize: '12px', textAlign: 'center' }}>{reportMessage}</div>}

                <div style={{ borderTop: '1px solid var(--border)', width: '100%', paddingTop: isMobile ? '12px' : '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', gap: '10px', flexWrap: 'wrap' }}>
                    {canSwitchToMyCard && (
                      <button
                        onClick={switchToMyCard}
                        disabled={switchingCard || !viewerUserId}
                        className="btn btn-primary"
                        style={{
                          borderRadius: '12px',
                          minHeight: '42px',
                          padding: '10px 17px',
                          flex: isMobile ? '1 1 190px' : '0 1 220px',
                          display: 'inline-flex',
                          justifyContent: 'center',
                          gap: '8px',
                          alignItems: 'center',
                          boxShadow: '0 12px 26px rgba(99,102,241,0.22)',
                        }}
                      >
                        <UserRound size={15} />
                        {switchingCard ? 'Switching...' : 'Switch to My Card'}
                      </button>
                    )}
                    {canSwitchBackToViewedCard && returnCardTarget && (
                      <button
                        onClick={switchBackToViewedCard}
                        disabled={switchingCard}
                        className="btn btn-ghost"
                        style={{ borderRadius: '12px', minHeight: '40px', padding: '9px 14px', flex: isMobile ? '1 1 160px' : '0 1 180px', display: 'inline-flex', justifyContent: 'center', gap: '7px', alignItems: 'center', fontSize: '12px', fontWeight: 900 }}
                      >
                        <UserRound size={14} />
                        {switchingCard ? 'Switching...' : `Back to ${getFirstName(returnCardTarget.name)}`}
                      </button>
                    )}
                    {data?.viewer.isSelf && (
                      isMobilePlatform ? (
                        <button
                          onClick={shareSocialCard}
                          disabled={sharingCard}
                          className="btn btn-ghost"
                          style={{ borderRadius: '12px', minHeight: '40px', padding: '9px 16px', flex: isMobile ? '1 1 180px' : '0 1 210px', display: 'inline-flex', justifyContent: 'center', gap: '7px', alignItems: 'center' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                          </svg>
                          {sharingCard ? 'Preparing...' : 'Share Social Card'}
                        </button>
                      ) : (
                        <button
                          onClick={downloadSocialCard}
                          disabled={downloadingCard}
                          className="btn btn-ghost"
                          style={{ borderRadius: '12px', minHeight: '40px', padding: '9px 16px', flex: isMobile ? '1 1 180px' : '0 1 210px', display: 'inline-flex', justifyContent: 'center', gap: '7px', alignItems: 'center' }}
                        >
                          <Download size={15} />
                          {downloadingCard ? 'Preparing...' : 'Download Social Card'}
                        </button>
                      )
                    )}
                    {cardData.viewer.isSelf && (
                      <button
                        onClick={() => {
                          onClose()
                          router.push('/profile')
                        }}
                        className="btn btn-primary"
                        style={{ borderRadius: '12px', minHeight: '40px', padding: '9px 16px', flex: isMobile ? '1 1 150px' : '0 1 190px', display: 'inline-flex', justifyContent: 'center', gap: '7px', alignItems: 'center', boxShadow: 'none' }}
                      >
                        <Sparkles size={15} />
                        Edit Profile
                      </button>
                    )}
                    {cardData.viewer.canTalkToManager && (
                      <button onClick={startManagerChat} disabled={startingChat} className="btn btn-primary" style={{ borderRadius: '12px', minHeight: '40px', padding: '9px 16px', flex: isMobile ? '1 1 170px' : '0 1 210px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: 'none' }}>
                        <Send size={15} />
                        {startingChat ? 'Opening...' : 'Talk to Manager'}
                      </button>
                    )}
                    {cardData.viewer.whatsappUrl && (
                      <button
                        onClick={(e) => handleSocialLinkClick(e, cardData.viewer.whatsappUrl!)}
                        className="btn"
                        style={{
                          borderRadius: '12px',
                          minHeight: '40px',
                          padding: '9px 16px',
                          flex: isMobile ? '1 1 170px' : '0 1 210px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: 'none',
                          backgroundColor: '#25D366',
                          borderColor: '#25D366',
                          color: '#ffffff',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <WhatsAppIcon size={16} />
                        Talk on WhatsApp
                      </button>
                    )}
                    {cardData.viewer.whatsappError && (
                      <button
                        disabled
                        className="btn"
                        style={{
                          borderRadius: '12px',
                          minHeight: '40px',
                          padding: '9px 16px',
                          flex: isMobile ? '1 1 170px' : '0 1 210px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: 'none',
                          cursor: 'not-allowed',
                          opacity: 0.5,
                          backgroundColor: 'var(--surface-3)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-muted)',
                          fontWeight: 700,
                        }}
                      >
                        <WhatsAppIcon size={16} />
                        WhatsApp number unavailable
                      </button>
                    )}
                    {cardData.viewer.canReport && (
                      <button
                        onClick={() => {
                          setReportMessage('')
                          setShowReport(true)
                        }}
                        style={{ border: '1px solid rgba(239,68,68,0.24)', borderRadius: '12px', minHeight: '42px', padding: '10px 15px', flex: isMobile ? '1 1 140px' : '0 1 auto', cursor: 'pointer', color: 'var(--danger)', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))', fontSize: '12px', fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)' }}
                      >
                        <Flag size={14} />
                        Report User
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showReport && data && (
        <div className="modal-overlay" onClick={closeReportFlow} style={{ zIndex: 1300, alignItems: isMobile ? 'flex-end' : 'center', padding: isMobile ? '0' : '18px' }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: isMobile ? '100%' : '94%',
              maxWidth: '560px',
              maxHeight: isMobile ? '88vh' : '82vh',
              overflowY: 'auto',
              padding: isMobile ? '20px 18px max(20px, env(safe-area-inset-bottom))' : '24px',
              borderRadius: isMobile ? '24px 24px 0 0' : '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                  {reportStep === 1 ? 'Report User' : `Report ${selectedReportReason?.label || 'User'}`}
                </h3>
                {reportStep === 2 && selectedReportReason && (
                  <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: '999px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 800 }}>
                    {selectedReportReason.label}
                  </div>
                )}
              </div>
              <button onClick={closeReportFlow} aria-label="Close report" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {reportStep === 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                {REPORT_REASONS.map(reason => (
                  <button
                    key={reason.id}
                    onClick={() => selectReportReason(reason.id)}
                    style={{
                      width: '100%',
                      minHeight: '76px',
                      border: '1px solid var(--border)',
                      borderRadius: '16px',
                      background: 'var(--surface-2)',
                      color: 'var(--text-primary)',
                      padding: '13px 14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--primary)'
                      e.currentTarget.style.background = 'var(--surface)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'var(--surface-2)'
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 900 }}>{reason.label}</span>
                    <span style={{ fontSize: '12px', lineHeight: 1.35, color: 'var(--text-muted)', fontWeight: 600 }}>{reason.description}</span>
                  </button>
                ))}
              </div>
            ) : selectedReportReason && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {selectedReportReason.subReasons.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '9px' }}>
                    {selectedReportReason.subReasons.map(subReason => {
                      const selected = reportSubReason === subReason
                      return (
                        <button
                          key={subReason}
                          onClick={() => setReportSubReason(subReason)}
                          style={{
                            border: selected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                            borderRadius: '14px',
                            background: selected ? 'rgba(99, 102, 241, 0.10)' : 'var(--surface-2)',
                            color: selected ? 'var(--primary)' : 'var(--text-primary)',
                            padding: '11px 12px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'inherit',
                            fontSize: '13px',
                            fontWeight: 850,
                            lineHeight: 1.35,
                            minHeight: '48px',
                          }}
                        >
                          {subReason}
                        </button>
                      )
                    })}
                  </div>
                )}

                <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Additional details{reportNeedsDetails ? ' required' : ''}
                  </span>
                  <textarea
                    className="form-input"
                    value={reportDetails}
                    onChange={e => setReportDetails(e.target.value.slice(0, 2000))}
                    placeholder={reportNeedsDetails ? 'Please explain the issue.' : 'Add any extra context.'}
                    rows={isMobile ? 4 : 5}
                    maxLength={2000}
                    style={{ resize: 'vertical', minHeight: isMobile ? '112px' : '124px' }}
                  />
                </label>

                {reportMessage && reportMessage !== 'Report submitted' && (
                  <div style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 700 }}>{reportMessage}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                  <button
                    onClick={() => {
                      setReportStep(1)
                      setReportSubReason('')
                    }}
                    className="btn btn-ghost"
                    style={{ borderRadius: '12px', flex: isMobile ? undefined : 1 }}
                    disabled={submittingReport}
                  >
                    Back
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={!canSubmitReport}
                    className="btn btn-primary"
                    style={{ borderRadius: '12px', flex: isMobile ? undefined : 1 }}
                  >
                    {submittingReport ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showManageMedals && data && canManageMedals && (
        <div className="modal-overlay" onClick={() => setShowManageMedals(false)} style={{ zIndex: 1300, alignItems: isMobile ? 'flex-end' : 'center' }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: isMobile ? '100%' : '92%',
              maxWidth: '420px',
              maxHeight: isMobile ? '82vh' : '76vh',
              overflowY: 'auto',
              padding: '20px',
              borderRadius: isMobile ? '22px 22px 0 0' : '22px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 900, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Medal size={17} color="var(--primary)" />
                  Manage Medals
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{data.user.name}</div>
              </div>
              <button onClick={() => setShowManageMedals(false)} aria-label="Close medal manager" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '14px', borderRadius: '16px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Currently assigned</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>{managedBadges.length}</span>
                </div>
                {managedBadges.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No medals assigned yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {managedBadges.map(badge => {
                      const Icon = getMedalIcon(badge)
                      const accent = badge.category === 'SYSTEM' ? '#6366f1' : badge.category === 'ACADEMIC' ? '#f59e0b' : '#10b981'
                      return (
                        <div key={badge.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 10px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <Icon size={15} color={accent} strokeWidth={2.4} />
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{badge.label}</span>
                          </div>
                          <button
                            onClick={() => removeBadge(badge.badgeId)}
                            disabled={savingBadge}
                            style={{ border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: '11px', fontWeight: 900, cursor: savingBadge ? 'not-allowed' : 'pointer', padding: '4px' }}
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <select
                  value={selectedBadgeId}
                  onChange={e => setSelectedBadgeId(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, minWidth: 0, fontSize: '13px' }}
                >
                  <option value="">{availableBadges.length === 0 ? 'No medals available' : 'Select medal'}</option>
                  {availableBadges.map(def => (
                    <option key={def.id} value={def.id}>{def.label}</option>
                  ))}
                </select>
                <button
                  onClick={assignBadge}
                  disabled={!selectedBadgeId || savingBadge}
                  className="btn btn-primary"
                  style={{ borderRadius: '12px', padding: '0 16px', flexShrink: 0 }}
                >
                  Add
                </button>
              </div>
              {medalManageError && (
                <div style={{ fontSize: '12px', color: 'var(--danger)', textAlign: 'center' }}>{medalManageError}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {fullAvatarOpen && cardData?.viewer.canViewFullAvatar && cardData.user.avatar && (
        <div className="modal-overlay" onClick={() => setFullAvatarOpen(false)} style={{ zIndex: 1300 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '92%', maxWidth: '520px', padding: '18px' }}>
            <img src={cardData.user.avatar} alt={`${cardData.user.name} profile picture`} style={{ width: '100%', maxHeight: '76vh', objectFit: 'contain', borderRadius: '18px' }} />
          </div>
        </div>
      )}

      {showShareModal && shareImageUri && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowShareModal(false)} 
          style={{ 
            zIndex: 1300, 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div 
            className="modal" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              width: '90%', 
              maxWidth: '440px', 
              padding: '24px', 
              borderRadius: '24px', 
              background: 'var(--surface)', 
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>Share Social Card</h3>
              <button 
                onClick={() => setShowShareModal(false)} 
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px 0', lineHeight: '1.4' }}>
              Your device does not support direct image sharing. Save the image below or copy the share link to share manually!
            </p>

            {/* Generated Image Preview */}
            <div style={{ position: 'relative', width: '100%', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)', padding: '6px' }}>
              <img 
                src={shareImageUri} 
                alt="Social Card Preview" 
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '10px' }} 
              />
              <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.75)', color: '#fff', padding: '4px 10px', borderRadius: '50px', fontSize: '10px', fontWeight: '800', backdropFilter: 'blur(4px)' }}>
                Long press image to save
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText("I just created my GenZ IITian Social Card! Create yours at class.genziitian.in")
                    setCopiedShareText(true)
                    setTimeout(() => setCopiedShareText(false), 2000)
                  } catch (err) {
                    console.error('Clipboard copy failed:', err)
                  }
                }}
                className="btn btn-primary"
                style={{ width: '100%', borderRadius: '12px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: 'none' }}
              >
                {copiedShareText ? '✅ Copied!' : 'Copy Share Text & Link'}
              </button>

              <button
                onClick={() => {
                  const fileName = getSocialCardFileName(data?.user.name || 'profile')
                  triggerWebPngDownload(shareImageUri, fileName)
                }}
                className="btn btn-ghost"
                style={{ width: '100%', borderRadius: '12px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border)' }}
              >
                <Download size={15} />
                Save Card Image
              </button>

              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.share({
                        title: 'My GenZ IITian Social Card',
                        text: 'I just created my GenZ IITian Social Card! Create yours at class.genziitian.in',
                        url: 'https://class.genziitian.in'
                      })
                    } catch (err) {
                      console.error('Text-only share failed:', err)
                    }
                  }}
                  className="btn btn-ghost"
                  style={{ width: '100%', borderRadius: '12px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border)' }}
                >
                  <Send size={14} />
                  Share Text & Link
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
