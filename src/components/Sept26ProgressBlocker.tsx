'use client'

import React, { useState, useRef } from 'react'
import type { FullSession } from '@/lib/auth'
import { getDefaultAvatar } from '@/lib/avatar'
import { triggerPartyPips } from '@/components/PartyPips'

interface Sept26ProgressBlockerProps {
  user: FullSession
}

export default function Sept26ProgressBlocker({ user }: { user: any }) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    iitmLevel: '',
    iitmUserType: '',
    mobileNumber: user.mobileNumber || '',
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
    mobile: Boolean(user.mobileNumber && user.mobileNumber.length >= 10),
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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

  // Mobile Change
  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
    setFormData(prev => ({ ...prev, mobileNumber: val }))
    if (error) setError('')
    if (val.length === 10) {
      markFieldCompleted('mobile', e.target as any)
    }
  }

  // Social Links
  const handleSocialBlur = (field: 'instagramUrl' | 'linkedinUrl', e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value.trim().length > 5) {
      triggerPartyPips(e.target as any)
    }
  }

  // Calculate Progress
  const totalRequired = 3 // Level, Category, Mobile
  const currentDoneCount =
    (formData.iitmLevel ? 1 : 0) +
    (formData.iitmUserType ? 1 : 0) +
    (formData.mobileNumber.length === 10 ? 1 : 0)
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

      // Trigger grand celebratory confetti
      triggerPartyPips({ x: window.innerWidth * 0.3, y: window.innerHeight * 0.4 })
      setTimeout(() => {
        triggerPartyPips({ x: window.innerWidth * 0.7, y: window.innerHeight * 0.4 })
      }, 200)
      setTimeout(() => {
        triggerPartyPips({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.3 })
      }, 400)

      setShowCelebrationModal(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleProceedToDashboard = () => {
    sessionStorage.setItem('sept26ProgressUpdated', 'true')
    window.location.reload()
  }

  const isMobileChanged = user.mobileNumber && user.mobileNumber !== formData.mobileNumber

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'radial-gradient(circle at top right, #312e81 0%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9998,
      padding: '16px',
      overflowY: 'auto',
    }}>
      <div className="fade-in" style={{
        background: 'var(--surface, #ffffff)',
        width: '100%',
        maxWidth: '640px',
        padding: '22px 26px',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        margin: 'auto',
      }}>

        {/* Term Badge & Header */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 14px',
            borderRadius: '50px',
            background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
            color: '#4f46e5',
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '10px',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)'
          }}>
            <span>✨</span> Welcome to Sept &apos;26 Term
          </div>

          <h1 style={{
            fontSize: '22px',
            fontWeight: 900,
            color: 'var(--text-primary, #0f172a)',
            marginBottom: '0',
            letterSpacing: '-0.02em',
          }}>
            Let&apos;s Update Your Progress!
          </h1>
        </div>

        {/* Gamified Progress Bar */}
        <div style={{
          background: '#f1f5f9',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '12px',
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
          <div style={{
            fontSize: '20px',
            background: progressPercent === 100 ? '#d1fae5' : '#eff6ff',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {progressPercent === 100 ? '🎉' : '🎯'}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: 'var(--danger-light, #fee2e2)',
            color: 'var(--danger, #ef4444)',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '16px',
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
            gap: '16px',
            padding: '14px 18px',
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
                width: '64px',
                height: '64px',
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {['Qualifier', 'Foundation', 'Diploma', 'Degree'].map(level => {
                const isSelected = formData.iitmLevel === level
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={(e) => handleLevelSelect(level, e)}
                    style={{
                      padding: '12px 6px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #6366f1' : '2px solid #e2e8f0',
                      background: isSelected ? '#eff0fe' : 'var(--surface, #ffffff)',
                      color: isSelected ? '#4f46e5' : 'var(--text-secondary, #475569)',
                      fontSize: '13px',
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { key: 'STANDALONE', label: 'Standalone' },
                { key: 'DUAL DEGREE', label: 'Dual Degree' },
                { key: 'WORKING PROFESSIONAL', label: 'Working Pro' },
              ].map(type => {
                const isSelected = formData.iitmUserType === type.key
                return (
                  <button
                    key={type.key}
                    type="button"
                    onClick={(e) => handleCategorySelect(type.key, e)}
                    style={{
                      padding: '12px 8px',
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
              {formData.mobileNumber.length === 10 && (
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981' }}>
                  10 Digits ✓
                </span>
              )}
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
                placeholder="Enter 10-digit number"
                maxLength={10}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 50px',
                  borderRadius: '12px',
                  border: formData.mobileNumber.length === 10 ? '2px solid #10b981' : '2px solid #e2e8f0',
                  background: 'var(--surface, #ffffff)',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  outline: 'none',
                  color: 'var(--text-primary, #0f172a)',
                  transition: 'border 0.2s ease',
                  letterSpacing: '0.04em',
                }}
              />
            </div>

            {isMobileChanged && (
              <p style={{ fontSize: '11px', color: '#d97706', marginTop: '6px', fontWeight: 600 }}>
                ⚠️ Notice: Changing mobile number. Old number ({user.mobileNumber}) will be safely kept in audit records for security verification.
              </p>
            )}
          </div>

          {/* ── Field 4: Optional Social Links ── */}
          <div style={{
            background: 'var(--surface-2, #f8fafc)',
            padding: '14px 16px',
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
              fontSize: '15.5px',
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
              <span>Saving Sept &apos;26 Update...</span>
            ) : (
              <>
                <span>Save Progress & Enter Dashboard</span>
                <span>🚀</span>
              </>
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
          padding: '20px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div className="fade-in" style={{
            background: 'var(--surface, #ffffff)',
            borderRadius: '24px',
            padding: '40px 32px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.8)',
          }}>
            {/* Celebration Icon */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)',
              fontSize: '32px',
            }}>
              🎉
            </div>

            <h2 style={{
              fontSize: '23px',
              fontWeight: 900,
              color: 'var(--text-primary, #0f172a)',
              marginBottom: '10px',
              letterSpacing: '-0.02em',
            }}>
              You&apos;re All Set for Sept &apos;26!
            </h2>
            <p style={{
              fontSize: '14.5px',
              color: 'var(--text-secondary, #64748b)',
              lineHeight: 1.6,
              marginBottom: '28px',
            }}>
              Your current IITM Level has been updated to <strong style={{ color: '#4f46e5' }}>{formData.iitmLevel}</strong>. Best of luck for an incredible new term with GenZ IITian!
            </p>

            <button
              onClick={handleProceedToDashboard}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(99, 102, 241, 0.3)',
              }}
            >
              Continue to Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
