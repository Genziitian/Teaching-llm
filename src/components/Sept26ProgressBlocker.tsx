'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { FullSession } from '@/lib/auth'
import { getDefaultAvatar } from '@/lib/avatar'
import { triggerPartyPips } from '@/components/PartyPips'
import SpringLeavesBackground from '@/components/SpringLeavesBackground'

interface Sept26ProgressBlockerProps {
  user: FullSession
}

export default function Sept26ProgressBlocker({ user }: { user: any }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Verify if existing mobile number satisfies Indian standard (10 digits starting with 6,7,8,9)
  const isInitialMobileValid = Boolean(user.mobileNumber && /^[6789]\d{9}$/.test(user.mobileNumber))

  const [formData, setFormData] = useState({
    iitmLevel: '',
    iitmUserType: '',
    mobileNumber: isInitialMobileValid ? user.mobileNumber : '',
    instagramUrl: user.instagramUrl || '',
    linkedinUrl: user.linkedinUrl || '',
  })

  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar || null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  const [completedFields, setCompletedFields] = useState<Record<string, boolean>>({
    photo: Boolean(user.avatar),
    level: false,
    category: false,
    mobile: isInitialMobileValid,
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enteringDashboard, setEnteringDashboard] = useState(false)
  const [showCelebrationModal, setShowCelebrationModal] = useState(false)

  // Trigger celebration on a field
  const markFieldCompleted = (fieldKey: string, e?: React.MouseEvent | HTMLElement | null) => {
    setCompletedFields(prev => ({ ...prev, [fieldKey]: true }))
    triggerPartyPips(e)
  }

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setAvatarError('Please select a valid image (JPEG, PNG, GIF, WebP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('Image must be under 10MB.')
      return
    }
    setAvatarError('')
    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload photo')
      }
      setAvatarUrl(data.avatar)
      markFieldCompleted('photo')
    } catch (err: any) {
      setAvatarError(err.message || 'Failed to upload photo')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setUploadingAvatar(true)
    try {
      await fetch('/api/profile/avatar', { method: 'DELETE' })
      setAvatarUrl(null)
    } catch {}
    setUploadingAvatar(false)
  }

  // Level Selection
  const handleLevelSelect = (level: string, e: React.MouseEvent) => {
    setFormData(prev => ({ ...prev, iitmLevel: level }))
    if (error) setError('')
    markFieldCompleted('level', e)
  }

  // Category Selection
  const handleCategorySelect = (category: string, e: React.MouseEvent) => {
    setFormData(prev => ({ ...prev, iitmUserType: category }))
    if (error) setError('')
    markFieldCompleted('category', e)
  }

  // Mobile Change — enforces Indian mobile rule: 10 digits starting with 6, 7, 8, or 9
  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)

    // Reject first digit if not 6, 7, 8, or 9
    if (raw.length > 0 && !/^[6789]/.test(raw)) {
      setError('Mobile number must start with 6, 7, 8, or 9.')
      return
    }

    if (error) setError('')
    setFormData(prev => ({ ...prev, mobileNumber: raw }))

    if (/^[6789]\d{9}$/.test(raw)) {
      markFieldCompleted('mobile', e.target as any)
    } else {
      setCompletedFields(prev => ({ ...prev, mobile: false }))
    }
  }

  // Social Links
  const handleSocialBlur = (field: 'instagramUrl' | 'linkedinUrl', e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value.trim().length > 5) {
      triggerPartyPips(e.target as any)
    }
  }

  const isMobileValid = /^[6789]\d{9}$/.test(formData.mobileNumber)

  // Calculate Progress
  const totalRequired = 3 // Level, Category, Mobile
  const currentDoneCount =
    (formData.iitmLevel ? 1 : 0) +
    (formData.iitmUserType ? 1 : 0) +
    (isMobileValid ? 1 : 0)
  const progressPercent = Math.round((currentDoneCount / totalRequired) * 100)

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.iitmLevel) {
      return setError('Please select your current IITM Level.')
    }
    if (!formData.iitmUserType) {
      return setError('Please select your IITM Category.')
    }
    if (!formData.mobileNumber || formData.mobileNumber.length !== 10) {
      return setError('Please provide a valid 10-digit mobile number.')
    }
    if (!/^[6789]/.test(formData.mobileNumber)) {
      return setError('Mobile number must start with 6, 7, 8, or 9.')
    }

    setLoading(true)
    try {
      const res = await fetch('/api/profile/sept26-progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save progress update.')
      }

      // Celebratory burst
      triggerPartyPips({ x: window.innerWidth * 0.3, y: window.innerHeight * 0.4 })
      setTimeout(() => {
        triggerPartyPips({ x: window.innerWidth * 0.7, y: window.innerHeight * 0.4 })
      }, 150)
      setTimeout(() => {
        triggerPartyPips({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.3 })
      }, 300)

      setShowCelebrationModal(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleProceedToDashboard = () => {
    setEnteringDashboard(true)
    sessionStorage.setItem('sept26ProgressUpdated', 'true')
    // Fast client-side refresh & instant transition
    router.refresh()
    setTimeout(() => {
      window.location.replace('/dashboard')
    }, 100)
  }

  const isMobileChanged = isInitialMobileValid && user.mobileNumber !== formData.mobileNumber

  return (
    <div className="blocker-overlay">
      {/* ── Spring Falling Leaves Ambient Background ── */}
      <SpringLeavesBackground />

      {/* ── Main Blocker Card ── */}
      <div className="fade-in blocker-card">

        {/* ── Center Loading Overlay (Shown while saving) ── */}
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            padding: '24px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              border: '3px solid #e0e7ff',
              borderTop: '3px solid #4f46e5',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginBottom: '16px',
            }} />
            <h3 style={{
              fontSize: '18px',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 6px 0',
            }}>
              Saving Your Progress...
            </h3>
            <p style={{
              fontSize: '13px',
              color: '#64748b',
              margin: 0,
              maxWidth: '320px',
            }}>
              Updating your academic profile for the Sept &apos;26 Term. Just a moment!
            </p>
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* ── GenZ IITian Logo & Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <img
            src="/mobile-login-logo.png"
            alt="GenZ IITian Logo"
            style={{
              height: '32px',
              width: 'auto',
              margin: '0 auto 10px auto',
              display: 'block',
              objectFit: 'contain',
            }}
          />

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 14px',
            borderRadius: '50px',
            background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
            color: '#4f46e5',
            fontSize: '11.5px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '8px',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)'
          }}>
            Welcome to Sept &apos;26 Term
          </div>

          <h1 style={{
            fontSize: '21px',
            fontWeight: 900,
            color: 'var(--text-primary, #0f172a)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Let&apos;s Update Your Progress!
          </h1>
        </div>

        {/* ── Progress Bar ── */}
        <div style={{
          background: '#f1f5f9',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '5px' }}>
              <span>TERM REFRESH PROGRESS</span>
              <span style={{ color: progressPercent === 100 ? '#10b981' : '#6366f1' }}>{progressPercent}% Completed</span>
            </div>
            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: progressPercent === 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                borderRadius: '4px',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </div>
          </div>
          {progressPercent === 100 && (
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: '#d1fae5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              flexShrink: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>

        {/* ── Error message ── */}
        {error && (
          <div style={{
            background: 'var(--danger-light, #fee2e2)',
            color: 'var(--danger, #ef4444)',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* ── Photo Section ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '12px 16px',
            borderRadius: '16px',
            background: 'var(--surface-2, #f8fafc)',
            border: '1px solid #e2e8f0',
          }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
            />

            <div
              onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              style={{
                position: 'relative',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                cursor: 'pointer',
                border: '2.5px solid #6366f1',
                overflow: 'hidden',
                background: '#e0e7ff',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              }}
              title="Click to change photo"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="User Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={getDefaultAvatar(user.gender)} alt="Default Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {uploadingAvatar && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '10px', fontWeight: 800,
                }}>
                  ...
                </div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                  Profile Photo
                </span>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#6366f1', background: '#eff0fe', padding: '1px 7px', borderRadius: '12px' }}>
                  Optional
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '2px 0 6px 0' }}>
                Optional — Keep your existing photo or upload a fresh one for the new term.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    background: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {uploadingAvatar ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={uploadingAvatar}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      background: 'transparent',
                      color: 'var(--danger, #ef4444)',
                      border: '1px solid #fee2e2',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {avatarError && (
                <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', fontWeight: 600 }}>
                  {avatarError}
                </div>
              )}
            </div>
          </div>

          {/* ── Field 1: Current IITM Level ── */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary, #0f172a)' }}>
                1. Which IITM Level are You in Now?
              </label>
              {formData.iitmLevel && (
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1' }}>
                  {formData.iitmLevel} ✓
                </span>
              )}
            </div>

            <div className="level-grid">
              {['Qualifier', 'Foundation', 'Diploma', 'Degree'].map(level => {
                const isSelected = formData.iitmLevel === level
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={(e) => handleLevelSelect(level, e)}
                    style={{
                      padding: '11px 4px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #6366f1' : '2px solid #e2e8f0',
                      background: isSelected ? '#eff0fe' : 'var(--surface, #ffffff)',
                      color: isSelected ? '#4f46e5' : 'var(--text-secondary, #475569)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                      textAlign: 'center',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none',
                    }}
                  >
                    {level}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Field 2: IITM Category ── */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary, #0f172a)' }}>
                2. Are You Currently:
              </label>
              {formData.iitmUserType && (
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1' }}>
                  Selected ✓
                </span>
              )}
            </div>

            <div className="category-grid">
              {[
                { key: 'STANDALONE', label: 'Standalone' },
                { key: 'DUAL DEGREE', label: 'Dual Degree' },
                { key: 'WORKING PROFESSIONAL', label: 'Working Professional' },
              ].map(type => {
                const isSelected = formData.iitmUserType === type.key
                const isWorkingProf = type.key === 'WORKING PROFESSIONAL'
                return (
                  <button
                    key={type.key}
                    type="button"
                    className={isWorkingProf ? 'category-item-wide' : ''}
                    onClick={(e) => handleCategorySelect(type.key, e)}
                    style={{
                      padding: '11px 6px',
                      minHeight: '44px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #6366f1' : '2px solid #e2e8f0',
                      background: isSelected ? '#eff0fe' : 'var(--surface, #ffffff)',
                      color: isSelected ? '#4f46e5' : 'var(--text-secondary, #475569)',
                      fontSize: '11.5px',
                      lineHeight: 1.25,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none',
                      wordBreak: 'normal',
                    }}
                  >
                    {type.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Field 3: Mobile Number ── */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary, #0f172a)' }}>
                3. Mobile Number (Update if Changed)
              </label>
              {isMobileValid ? (
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981' }}>
                  Verified ✓
                </span>
              ) : formData.mobileNumber.length > 0 ? (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1' }}>
                  {formData.mobileNumber.length}/10 digits
                </span>
              ) : null}
            </div>

            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '14px',
                fontWeight: 700,
                color: '#64748b',
              }}>
                +91
              </span>
              <input
                type="tel"
                value={formData.mobileNumber}
                onChange={handleMobileChange}
                placeholder="Enter 10-digit number (starts with 6-9)"
                maxLength={10}
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 50px',
                  borderRadius: '12px',
                  border: isMobileValid ? '2px solid #10b981' : '2px solid #e2e8f0',
                  background: 'var(--surface, #ffffff)',
                  fontSize: '14px',
                  fontWeight: 700,
                  outline: 'none',
                  color: 'var(--text-primary, #0f172a)',
                  transition: 'border 0.2s ease',
                  letterSpacing: '0.04em',
                }}
              />
            </div>

            {isMobileChanged && (
              <p style={{
                fontSize: '11px',
                color: '#d97706',
                marginTop: '6px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Notice: Changing mobile number. Old number will be securely archived for audit.
              </p>
            )}
          </div>

          {/* ── Field 4: Optional Social Links ── */}
          <div style={{
            background: 'var(--surface-2, #f8fafc)',
            padding: '12px 14px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                4. Social Card Links (Optional)
              </span>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#6366f1', background: '#eff0fe', padding: '1px 7px', borderRadius: '12px' }}>
                Optional
              </span>
            </div>

            <div className="social-grid">
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #475569)', marginBottom: '4px', display: 'block' }}>
                  Instagram Profile Link
                </label>
                <input
                  type="url"
                  value={formData.instagramUrl}
                  onChange={e => setFormData({ ...formData, instagramUrl: e.target.value })}
                  onBlur={(e) => handleSocialBlur('instagramUrl', e)}
                  placeholder="https://instagram.com/..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary, #475569)', marginBottom: '4px', display: 'block' }}>
                  LinkedIn Profile Link
                </label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={e => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  onBlur={(e) => handleSocialBlur('linkedinUrl', e)}
                  placeholder="https://linkedin.com/in/..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: '14px',
              fontSize: '15px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading ? (
              <span>Saving Progress...</span>
            ) : (
              <span>Save Progress & Enter Dashboard</span>
            )}
          </button>
        </form>
      </div>

      {/* ── Celebration Success Modal ── */}
      {showCelebrationModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{
            background: 'var(--surface, #ffffff)',
            borderRadius: '24px',
            padding: '26px 20px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.8)',
            animation: 'celebratePopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            margin: 'auto',
          }}>
            {/* Animated Celebration Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
              color: '#ffffff',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 style={{
              fontSize: '20px',
              fontWeight: 900,
              color: 'var(--text-primary, #0f172a)',
              marginBottom: '10px',
              letterSpacing: '-0.02em',
            }}>
              You&apos;re All Set for Sept &apos;26!
            </h2>

            {/* Line 1: Updated Status */}
            <p style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary, #64748b)',
              lineHeight: 1.5,
              margin: '0 0 10px 0',
            }}>
              Your current IITM Level has been updated to <strong style={{ color: '#4f46e5' }}>{formData.iitmLevel}</strong>.
            </p>

            {/* Line 2: Distinct highlighted text and color on next line */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#059669',
              fontWeight: 700,
              fontSize: '13px',
              marginBottom: '20px',
              letterSpacing: '0.01em',
            }}>
              Best of luck for an incredible new term with GenZ IITian!
            </div>

            <button
              onClick={handleProceedToDashboard}
              disabled={enteringDashboard}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: enteringDashboard ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 18px rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: enteringDashboard ? 0.75 : 1,
              }}
            >
              {enteringDashboard ? (
                <>
                  <span style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  <span>Entering Dashboard...</span>
                </>
              ) : (
                <span>Continue to Dashboard →</span>
              )}
            </button>
          </div>
          <style jsx>{`
            @keyframes celebratePopIn {
              0% { opacity: 0; transform: scale(0.85) translateY(16px); }
              100% { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      <style jsx>{`
        .blocker-overlay {
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at top right, #1e1b4b 0%, #0f172a 100%);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          z-index: 9998;
          padding: max(14px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .blocker-card {
          position: relative;
          z-index: 2;
          background: var(--surface, #ffffff);
          width: 100%;
          max-width: 640px;
          padding: 18px 14px;
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1);
          margin: auto;
          box-sizing: border-box;
        }
        @media (min-width: 600px) {
          .blocker-card {
            padding: 22px 26px;
            border-radius: 24px;
          }
        }
        .level-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        @media (min-width: 520px) {
          .level-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .category-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        @media (min-width: 520px) {
          .category-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .category-item-wide {
          grid-column: span 2;
        }
        @media (min-width: 520px) {
          .category-item-wide {
            grid-column: span 1;
          }
        }
        .social-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 520px) {
          .social-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  )
}
