'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getDefaultAvatar } from '@/lib/avatar'
import UserAvatar from '@/components/UserAvatar'
import SocialCardModal from '@/components/SocialCardModal'
import Cropper from 'react-easy-crop'
import { ABOUT_ME_MAX_WORDS, countWords } from '@/lib/profile-limits'
import { useLoadingFact } from '@/hooks/useLoadingFact'
import LoadingFactCard from '@/components/ui/LoadingFactCard'

// Helper to extract cropped image blob
async function getCroppedImg(imageSrc: string, pixelCrop: any, fileType: string): Promise<Blob> {
  const image = new Image()
  image.src = imageSrc
  await new Promise(resolve => { image.onload = resolve })

  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('No 2d context')

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas is empty')); return }
      resolve(blob)
    }, fileType, 0.9)
  })
}

interface UserProfile {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
  mobileNumber?: string | null
  email: string
  role: string
  avatar: string | null
  gender?: string | null
  genderChangedAt?: string | null
  age?: number | null
  state?: string | null
  aboutMe?: string | null
  cgpa?: number | null
  showStateOnSocialCard?: boolean
  showAgeOnSocialCard?: boolean
  showGenderOnSocialCard?: boolean
  showIitmLevelOnSocialCard?: boolean
  showCgpaOnSocialCard?: boolean
  isIdentityUpdated?: boolean
  iitmJoinYear?: string | null
  iitmJoinMonth?: string | null
  iitmLevel?: string | null
  iitmUserType?: string | null
  securityNumber: string | null
  createdAt: string
  instagramUrl?: string | null
  linkedinUrl?: string | null
}

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

export default function ProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingFact = useLoadingFact(loading)

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editAge, setEditAge] = useState('')
  const [editState, setEditState] = useState('')
  const [editAboutMe, setEditAboutMe] = useState('')
  const [editCgpa, setEditCgpa] = useState('')
  const [cgpaError, setCgpaError] = useState('')
  const [editInstagramUrl, setEditInstagramUrl] = useState('')
  const [editLinkedinUrl, setEditLinkedinUrl] = useState('')
  const [instagramError, setInstagramError] = useState('')
  const [linkedinError, setLinkedinError] = useState('')

  const validateInstagram = (url: string) => {
    if (!url.trim()) return ''
    const cleanUrl = url.trim()
    const pattern = /^https:\/\/(www\.)?instagram\.com\/.+/i
    if (!pattern.test(cleanUrl)) {
      return 'Please paste a valid Instagram profile link, not just your username.'
    }
    return ''
  }

  const validateLinkedIn = (url: string) => {
    if (!url.trim()) return ''
    const cleanUrl = url.trim()
    const pattern = /^https:\/\/(www\.)?linkedin\.com\/in\/.+/i
    if (!pattern.test(cleanUrl)) {
      return 'Please paste a valid LinkedIn profile link, not just your username.'
    }
    return ''
  }

  const [socialVisibility, setSocialVisibility] = useState({
    showStateOnSocialCard: false,
    showAgeOnSocialCard: false,
    showGenderOnSocialCard: false,
    showIitmLevelOnSocialCard: false,
    showCgpaOnSocialCard: false,
  })
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })
  const aboutMeWordCount = countWords(editAboutMe)
  const isAboutMeOverLimit = aboutMeWordCount > ABOUT_ME_MAX_WORDS

  const [showSecurityNumber, setShowSecurityNumber] = useState(false)
  const [fullAvatarOpen, setFullAvatarOpen] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [previewSocialCardOpen, setPreviewSocialCardOpen] = useState(false)

  // Cropper State
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [selectedFileType, setSelectedFileType] = useState('image/png')
  const [selectedFileName, setSelectedFileName] = useState('avatar.png')

  useEffect(() => { loadProfile() }, [])

  function getCgpaValidationMessage(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return ''
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
      return 'CGPA must be between 0 and 10.'
    }
    return ''
  }

  function getSocialCardPreviewFields() {
    if (!user) return []
    const fields: { key: string; label: string; value: string | number }[] = []
    const parsedAge = Number(editAge)
    const parsedCgpa = Number(editCgpa)

    if (socialVisibility.showStateOnSocialCard && editState.trim()) {
      fields.push({ key: 'state', label: 'State', value: editState.trim() })
    }
    if (socialVisibility.showAgeOnSocialCard && editAge.trim() && Number.isFinite(parsedAge)) {
      fields.push({ key: 'age', label: 'Age', value: Math.trunc(parsedAge) })
    }
    if (socialVisibility.showGenderOnSocialCard && editGender) {
      fields.push({ key: 'gender', label: 'Gender', value: editGender.charAt(0) + editGender.slice(1).toLowerCase() })
    }
    if (socialVisibility.showIitmLevelOnSocialCard && user.iitmLevel) {
      fields.push({ key: 'iitmLevel', label: 'IITM Level', value: user.iitmLevel })
    }
    if (socialVisibility.showCgpaOnSocialCard && editCgpa.trim() && Number.isFinite(parsedCgpa) && parsedCgpa >= 0 && parsedCgpa <= 10) {
      fields.push({ key: 'cgpa', label: 'CGPA', value: Number(parsedCgpa.toFixed(2)) })
    }

    return fields
  }

  async function loadProfile() {
    try {
      const res = await fetch('/api/profile')
      const data = await res.json()
      if (data.user) {
        setUser(data.user)
        setEditFirstName(data.user.firstName || data.user.name.split(' ')[0] || '')
        setEditLastName(data.user.lastName || data.user.name.split(' ').slice(1).join(' ') || '')
        setEditMobile(data.user.mobileNumber || '')
        setEditGender(data.user.gender || 'MALE')
        setEditAge(data.user.age?.toString() || '')
        setEditState(data.user.state || '')
        setEditAboutMe(data.user.aboutMe || '')
        setEditCgpa(data.user.cgpa?.toString() || '')
        setCgpaError('')
        setEditInstagramUrl(data.user.instagramUrl || '')
        setEditLinkedinUrl(data.user.linkedinUrl || '')
        setInstagramError('')
        setLinkedinError('')
        setSocialVisibility({
          showStateOnSocialCard: Boolean(data.user.showStateOnSocialCard),
          showAgeOnSocialCard: Boolean(data.user.showAgeOnSocialCard),
          showGenderOnSocialCard: Boolean(data.user.showGenderOnSocialCard),
          showIitmLevelOnSocialCard: Boolean(data.user.showIitmLevelOnSocialCard),
          showCgpaOnSocialCard: Boolean(data.user.showCgpaOnSocialCard),
        })
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSaveProfile() {
    if (!editFirstName.trim()) { setProfileMsg({ type: 'error', text: 'First name cannot be empty' }); return }
    if (isAboutMeOverLimit) {
      setProfileMsg({ type: 'error', text: `About Me must be ${ABOUT_ME_MAX_WORDS} words or fewer. Please shorten it before saving.` })
      return
    }
    const nextCgpaError = getCgpaValidationMessage(editCgpa)
    if (nextCgpaError) {
      setCgpaError(nextCgpaError)
      setProfileMsg({ type: 'error', text: nextCgpaError })
      return
    }
    const instErr = validateInstagram(editInstagramUrl)
    const linkErr = validateLinkedIn(editLinkedinUrl)
    if (instErr || linkErr) {
      setInstagramError(instErr)
      setLinkedinError(linkErr)
      setProfileMsg({ type: 'error', text: instErr || linkErr })
      return
    }
    setSaving(true)
    setProfileMsg({ type: '', text: '' })
    try {
      const payload: any = { 
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        mobileNumber: editMobile.trim(),
        age: editAge ? parseInt(editAge, 10) : null,
        state: editState.trim(),
        aboutMe: editAboutMe.trim(),
        cgpa: editCgpa.trim() ? Number(editCgpa) : null,
        instagramUrl: editInstagramUrl.trim() || null,
        linkedinUrl: editLinkedinUrl.trim() || null,
        ...socialVisibility,
      }
      
      // Include gender if it hasn't been changed yet
      if (!user?.genderChangedAt) {
        payload.gender = editGender
      }
      
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        setProfileMsg({ type: 'success', text: 'Profile updated successfully' })
      } else {
        setProfileMsg({ type: 'error', text: data.error || 'Failed to update' })
      }
    } catch { setProfileMsg({ type: 'error', text: 'Something went wrong' }) }
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('Please upload a JPEG, PNG, GIF, or WebP image'); return
    }
    if (file.size > 10 * 1024 * 1024) { alert('File too large. Maximum 10MB'); return }
    
    setSelectedFileType(file.type)
    setSelectedFileName(file.name)

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setImageSrc(reader.result?.toString() || null)
    })
    reader.readAsDataURL(file)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  async function uploadCroppedImage() {
    if (!imageSrc || !croppedAreaPixels) return

    setUploadingAvatar(true)
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, selectedFileType)
      const file = new File([croppedBlob], selectedFileName, { type: selectedFileType })
      
      const formData = new FormData()
      formData.append('avatar', file)
      
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setUser(prev => prev ? { ...prev, avatar: data.avatar } : prev)
        setImageSrc(null)
      } else {
        alert(data.error || 'Failed to upload avatar')
      }
    } catch {
      alert('Upload failed')
    }
    setUploadingAvatar(false)
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true)
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' })
      if (res.ok) {
        setUser(prev => prev ? { ...prev, avatar: null } : prev)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to remove avatar')
      }
    } catch {
      alert('Remove failed')
    }
    setUploadingAvatar(false)
  }

  function handleDiscard() {
    if (user) {
      setEditFirstName(user.firstName || user.name.split(' ')[0] || '')
      setEditLastName(user.lastName || user.name.split(' ').slice(1).join(' ') || '')
      setEditMobile(user.mobileNumber || '')
      setEditGender(user.gender || 'MALE')
      setEditAge(user.age?.toString() || '')
      setEditState(user.state || '')
      setEditAboutMe(user.aboutMe || '')
      setEditCgpa(user.cgpa?.toString() || '')
      setCgpaError('')
      setEditInstagramUrl(user.instagramUrl || '')
      setEditLinkedinUrl(user.linkedinUrl || '')
      setInstagramError('')
      setLinkedinError('')
      setSocialVisibility({
        showStateOnSocialCard: Boolean(user.showStateOnSocialCard),
        showAgeOnSocialCard: Boolean(user.showAgeOnSocialCard),
        showGenderOnSocialCard: Boolean(user.showGenderOnSocialCard),
        showIitmLevelOnSocialCard: Boolean(user.showIitmLevelOnSocialCard),
        showCgpaOnSocialCard: Boolean(user.showCgpaOnSocialCard),
      })
    }
    setProfileMsg({ type: '', text: '' })
  }

  const initials = (user?.firstName?.[0] || user?.name?.[0] || '?') + (user?.lastName?.[0] || user?.name?.split(' ')[1]?.[0] || '')
  const roleLabel = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : ''
  const resolvedAvatar = user?.avatar || getDefaultAvatar(user?.gender)

  const insetRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: isMobile ? '10px 14px' : '14px 18px', borderRadius: '14px', background: 'var(--surface-2)',
    boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
    gap: '16px',
  }

  if (loading) {
    return (
      <div className="page-container fade-in" style={{ padding: '24px 16px' }}>
        {loadingFact && (
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingFactCard fact={loadingFact} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
          Loading profile...
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-container fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', color: 'var(--text-muted)' }}>
          Unable to load profile
        </div>
      </div>
    )
  }

  return (
    <div className="page-container fade-in mobile-profile-page" style={{ padding: isMobile ? '12px' : '20px', paddingBottom: '24px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Back & Settings ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '50px',
              background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
              boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
              fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>

          <button
            onClick={() => router.push('/settings')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '50px',
              background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
              boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
              fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
        </div>

        {/* ── Profile Card ── */}
        <div className="card" style={{ padding: isMobile ? '20px' : '32px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '20px' : '28px', textAlign: isMobile ? 'center' : 'left' }}>
          {/* Avatar card with upload/remove actions */}
          <div style={{ position: 'relative', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <UserAvatar
              user={user}
              size={100}
              onClick={() => setFullAvatarOpen(true)}
              style={{ boxShadow: '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)' }}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-sm btn-ghost"
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '50px' }}
                disabled={uploadingAvatar}
              >
                Change
              </button>
              {user.avatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="btn btn-sm btn-ghost"
                  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '50px', color: 'var(--danger)' }}
                  disabled={uploadingAvatar}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* User info */}
          <div style={{ flex: 1, minWidth: '180px', width: isMobile ? '100%' : 'auto' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{user.name}</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '6px' }}>{user.email}</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
              <span className="badge" style={{
                background: user.role === 'MANAGER' ? 'var(--primary-light)' : (user.role === 'ADMIN' || user.role === 'MODERATOR') ? 'var(--info-light)' : 'var(--success-light)',
                color: user.role === 'MANAGER' ? 'var(--accent)' : (user.role === 'ADMIN' || user.role === 'MODERATOR') ? 'var(--info)' : 'var(--success)',
                padding: '4px 12px', fontSize: '12px',
              }}>
                {roleLabel}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Profile-pic change disabled — predefined avatars only */}
        </div>


        {/* ── Personal Information + Account Details (side by side) ── */}
        <div className="responsive-two-column-grid">

          {/* ── Personal Information ── */}
          <div className="card" style={{ padding: isMobile ? '16px' : '28px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3636e8" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Personal Information
            </h3>

            {profileMsg.text && (
              <div style={{
                padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '14px',
                background: profileMsg.type === 'success' ? 'var(--success-light)' : profileMsg.type === 'error' ? 'var(--danger-light)' : 'var(--info-light)',
                color: profileMsg.type === 'success' ? '#065f46' : profileMsg.type === 'error' ? 'var(--danger)' : 'var(--info)',
              }}>
                {profileMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              {/* Name — editable */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '10px' : '16px' }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="form-input" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} placeholder="First Name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-input" value={editLastName} onChange={e => setEditLastName(e.target.value)} placeholder="Last Name" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">About Me</label>
                <textarea
                  className="form-input"
                  value={editAboutMe}
                  onChange={e => setEditAboutMe(e.target.value)}
                  placeholder="Write a short intro for your Social Card"
                  rows={4}
                  aria-invalid={isAboutMeOverLimit}
                  style={{
                    resize: 'vertical',
                    lineHeight: 1.5,
                    borderColor: isAboutMeOverLimit ? 'var(--danger)' : undefined,
                  }}
                />
                <div style={{ fontSize: '11px', color: isAboutMeOverLimit ? 'var(--danger)' : 'var(--text-muted)', textAlign: 'right', marginTop: '4px', fontWeight: isAboutMeOverLimit ? 800 : 600 }}>
                  {aboutMeWordCount} / {ABOUT_ME_MAX_WORDS} words
                </div>
                {isAboutMeOverLimit && (
                  <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', fontWeight: 700 }}>
                    Please shorten About Me before saving.
                  </div>
                )}
              </div>

              {/* Gender + Age — side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '10px' : '12px' }}>
                {/* Gender */}
                <div style={{ ...insetRow, flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Gender</span>
                  {user.role === 'MANAGER' ? (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {['MALE', 'FEMALE', 'OTHER'].map(g => (
                        <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          <input type="radio" name="gender" value={g} checked={editGender === g} onChange={e => setEditGender(e.target.value)} style={{ cursor: 'pointer' }} />
                          {g.charAt(0) + g.slice(1).toLowerCase()}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {user.gender ? (user.gender.charAt(0) + user.gender.slice(1).toLowerCase()) : '—'}
                    </span>
                  )}
                </div>

                {/* Age */}
                <div style={{ ...insetRow, flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Age</span>
                  {user.role === 'MANAGER' ? (
                    <input
                      type="number"
                      className="form-input"
                      value={editAge}
                      onChange={e => setEditAge(e.target.value)}
                      placeholder="Age"
                      style={{ background: 'transparent', padding: '0', border: 'none', borderBottom: '2px solid rgba(0,0,0,0.1)', borderRadius: 0, width: '60px', fontSize: '14px', fontWeight: '600' }}
                    />
                  ) : (
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>{user.age ?? '—'}</span>
                  )}
                </div>
              </div>

              {/* State — read-only for students */}
              <div style={insetRow}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>State / Territory</span>
                {user.role === 'MANAGER' ? (
                  <input
                    type="text"
                    className="form-input"
                    value={editState}
                    onChange={e => setEditState(e.target.value)}
                    placeholder="State"
                    style={{ background: 'transparent', padding: '4px 0', border: 'none', borderBottom: '2px solid rgba(0,0,0,0.1)', borderRadius: 0, width: '140px', fontSize: '14px', fontWeight: '600', textAlign: 'right' }}
                  />
                ) : (
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{user.state || '—'}</span>
                )}
              </div>

              <div style={insetRow}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>CGPA</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  className="form-input"
                  value={editCgpa}
                  onChange={e => {
                    setEditCgpa(e.target.value)
                    setCgpaError(getCgpaValidationMessage(e.target.value))
                  }}
                  placeholder="0.00"
                  aria-invalid={Boolean(cgpaError)}
                  style={{ background: 'transparent', padding: '4px 0', border: 'none', borderBottom: '2px solid rgba(0,0,0,0.1)', borderRadius: 0, width: '90px', fontSize: '14px', fontWeight: '600', textAlign: 'right' }}
                />
              </div>
              {cgpaError && (
                <div style={{ marginTop: '-8px', fontSize: '11.5px', color: 'var(--danger)', fontWeight: 700, textAlign: 'right' }}>
                  {cgpaError}
                </div>
              )}

              {/* IITM identity fields — Only visible to managers */}
              {user.role === 'MANAGER' && (
                <>
                  <div style={insetRow}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>IITM Join Cohort</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {user.iitmJoinYear && user.iitmJoinMonth ? `${user.iitmJoinMonth} ${user.iitmJoinYear}` : '—'}
                    </span>
                  </div>

                  <div style={insetRow}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>IITM Level</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{user.iitmLevel || '—'}</span>
                  </div>

                  <div style={insetRow}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>IITM Category</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{user.iitmUserType || '—'}</span>
                  </div>
                </>
              )}

              {/* Notice for non-managers */}
              {user.role !== 'MANAGER' && (
                <div style={{
                  padding: '12px 16px', borderRadius: '12px',
                  background: 'var(--primary-light)', border: '1px solid #d4d4ff',
                  display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '4px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p style={{ fontSize: '12px', color: '#4b4bcc', lineHeight: 1.5, margin: 0 }}>
                    To edit any personal information, please <strong>raise a ticket in Support</strong> with your reason and our team will update it for you.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Account Details ── */}
          <div className="card" style={{ padding: isMobile ? '16px' : '28px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3636e8" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              Account Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>

              {/* Email */}
              <div style={insetRow}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Email Address</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', maxWidth: isMobile ? '120px' : '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
              </div>

              {/* Mobile */}
              <div style={insetRow}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Mobile Number</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{user.mobileNumber || '—'}</span>
              </div>

              {/* Security Number */}
              <div style={insetRow}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Security Number</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600',
                    fontFamily: 'monospace', letterSpacing: showSecurityNumber ? '0.5px' : '3px',
                  }}>
                    {user.securityNumber
                      ? (showSecurityNumber ? user.securityNumber : '••••••••')
                      : 'N/A'
                    }
                  </span>
                  {user.securityNumber && (
                    <button
                      type="button"
                      onClick={() => setShowSecurityNumber(v => !v)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }}
                    >
                      {showSecurityNumber ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  )}
                </div>
              </div>

              {/* Role */}
              <div style={insetRow}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Role</span>
                <span className="badge" style={{
                  background: user.role === 'MANAGER' ? 'var(--primary-light)' : (user.role === 'ADMIN' || user.role === 'MODERATOR') ? 'var(--info-light)' : 'var(--success-light)',
                  color: user.role === 'MANAGER' ? 'var(--accent)' : (user.role === 'ADMIN' || user.role === 'MODERATOR') ? 'var(--info)' : 'var(--success)',
                  fontSize: '12px',
                }}>
                  {roleLabel}
                </span>
              </div>

              {/* Member Since */}
              <div style={insetRow}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Member Since</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>
                  {new Date(user.createdAt).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

            </div>
          </div>

        </div> {/* close grid container */}

        <div className="card" style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Social Card</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, minmax(120px, 1fr))', gap: '10px' }}>
            {[
              ['showStateOnSocialCard', 'Show State'],
              ['showAgeOnSocialCard', 'Show Age'],
              ['showGenderOnSocialCard', 'Show Gender'],
              ['showIitmLevelOnSocialCard', 'Show IITM Level'],
              ['showCgpaOnSocialCard', 'Show CGPA'],
            ].map(([key, label]) => (
              <label key={key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '14px',
                background: 'var(--surface-2)',
                boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={socialVisibility[key as keyof typeof socialVisibility]}
                  onChange={e => setSocialVisibility(prev => ({ ...prev, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginTop: '8px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>Instagram Profile Link</span>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>Paste full profile URL, not just username</span>
              </label>
              <input
                className="form-input"
                value={editInstagramUrl}
                onChange={e => {
                  setEditInstagramUrl(e.target.value)
                  setInstagramError(validateInstagram(e.target.value))
                }}
                placeholder="https://www.instagram.com/username/"
                style={{ borderColor: instagramError ? 'var(--danger)' : undefined }}
              />
              {instagramError && (
                <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', fontWeight: 700 }}>
                  {instagramError}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>LinkedIn Profile Link</span>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>Paste full profile URL, not just username</span>
              </label>
              <input
                className="form-input"
                value={editLinkedinUrl}
                onChange={e => {
                  setEditLinkedinUrl(e.target.value)
                  setLinkedinError(validateLinkedIn(e.target.value))
                }}
                placeholder="https://www.linkedin.com/in/username/"
                style={{ borderColor: linkedinError ? 'var(--danger)' : undefined }}
              />
              {linkedinError && (
                <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', fontWeight: 700 }}>
                  {linkedinError}
                </div>
              )}
            </div>
          </div>

          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: '16px',
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'flex-end',
            justifyContent: 'space-between',
            gap: '14px',
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Your Social Card is what other users see when they tap your name or profile picture across the platform.
              </p>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                You control which information is visible using the options above.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewSocialCardOpen(true)}
              className="btn btn-ghost"
              style={{
                borderRadius: '14px',
                padding: '10px 14px',
                flexShrink: 0,
                width: isMobile ? '100%' : 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              Preview Social Card
            </button>
          </div>
        </div>

        {/* ── Bottom Action Bar ── */}
        <div style={{
          display: 'flex',
          justifyContent: isMobile ? 'stretch' : 'flex-end',
          alignItems: 'center',
          gap: '10px',
          padding: isMobile ? '16px 12px' : '20px 24px',
          borderRadius: '24px',
          background: 'var(--surface-2)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.04), 6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)',
          flexDirection: 'row',
          position: 'sticky',
          bottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : '20px',
          zIndex: 90,
          marginTop: '24px',
          border: '1px solid rgba(255, 255, 255, 0.6)',
        }}>
          <button
            onClick={handleDiscard}
            className="btn btn-ghost"
            style={{
              flex: isMobile ? 1 : 'unset',
              padding: isMobile ? '11px 10px' : undefined,
              fontSize: isMobile ? '13px' : undefined,
              fontWeight: isMobile ? '600' : undefined,
              borderRadius: isMobile ? '50px' : undefined,
              border: isMobile ? '1.5px solid rgba(99,102,241,0.25)' : undefined,
              color: isMobile ? 'var(--accent)' : undefined,
              background: isMobile ? 'rgba(99,102,241,0.06)' : undefined,
            }}
          >
            Discard
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={saving || isAboutMeOverLimit}
            className="btn btn-primary"
            style={{
              flex: isMobile ? 1 : 'unset',
              padding: isMobile ? '11px 10px' : undefined,
              fontSize: isMobile ? '13px' : undefined,
              fontWeight: isMobile ? '700' : undefined,
              borderRadius: isMobile ? '50px' : undefined,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>

      {/* ── Image Crop Modal ── */}
      {imageSrc && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ width: '95%', maxWidth: '500px', padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Adjust Profile Picture</h3>
              <button 
                onClick={() => setImageSrc(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div style={{ position: 'relative', width: '100%', height: isMobile ? '280px' : '350px', background: '#333' }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  onClick={() => setImageSrc(null)} 
                  className="btn btn-ghost"
                  disabled={uploadingAvatar}
                >
                  Cancel
                </button>
                <button 
                  onClick={uploadCroppedImage} 
                  className="btn btn-primary"
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? 'Uploading...' : 'Save Picture'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewSocialCardOpen && user && (
        <SocialCardModal
          userId={user.id}
          onClose={() => setPreviewSocialCardOpen(false)}
          previewOverride={{
            aboutMe: editAboutMe.trim(),
            publicFields: getSocialCardPreviewFields(),
            instagramUrl: editInstagramUrl.trim() || null,
            linkedinUrl: editLinkedinUrl.trim() || null,
            viewer: {
              isSelf: false,
              isStaff: false,
              canReport: false,
              canTalkToManager: false,
              canViewFullAvatar: false,
              canOpenManagerProfile: false,
            },
          }}
        />
      )}

      {fullAvatarOpen && (
        <div className="modal-overlay" onClick={() => setFullAvatarOpen(false)} style={{ zIndex: 9998 }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ width: '92%', maxWidth: '520px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Profile Picture</h3>
              <button onClick={() => setFullAvatarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <img
              src={resolvedAvatar}
              alt={`${user.name} profile picture`}
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '18px', background: 'var(--surface-2)' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
