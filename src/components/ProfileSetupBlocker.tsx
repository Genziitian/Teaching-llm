'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { FullSession } from '@/lib/auth'
import { getDefaultAvatar } from '@/lib/avatar'

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
  "Other"
];

export default function ProfileSetupBlocker({ user }: { user: FullSession }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Split existing name into first and last guess if needed, though they was nullish in standard flow
  const nameParts = (user.name || '').split(' ')
  const initialFirst = nameParts[0] || ''
  const initialLast = nameParts.slice(1).join(' ') || ''

  const [formData, setFormData] = useState({
    firstName: initialFirst,
    lastName: initialLast,
    mobileNumber: '',
    age: '',
    gender: '',
    state: ''
  })
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar || null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    if (error) setError('')
  }
  
  const handleGenderSelect = (val: string) => {
    setFormData({ ...formData, gender: val })
    if (error) setError('')
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch (err: any) {
      setAvatarError(err.message || 'Failed to upload photo')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true)
    try {
      await fetch('/api/profile/avatar', { method: 'DELETE' })
      setAvatarUrl(null)
    } catch {}
    setUploadingAvatar(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Client-side validations
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      return setError('Please enter both your first and last name.')
    }
    if (!formData.mobileNumber.match(/^\d{10}$/)) {
      return setError('Mobile number must be exactly 10 digits.')
    }
    if (!formData.mobileNumber.match(/^[6789]/)) {
      return setError('Please enter a valid mobile number.')
    }
    if (!formData.gender) {
      return setError('Please select a gender option.')
    }
    const ageNum = parseInt(formData.age, 10)
    if (!ageNum || isNaN(ageNum) || ageNum < 15 || ageNum > 120) {
      return setError('Age must be at least 15.')
    }
    if (!formData.state) {
      return setError('Please choose your state from the dropdown.')
    }

    // All valid — show confirmation modal
    setShowConfirmModal(true)
  }

  const doSubmit = async () => {
    setShowConfirmModal(false)
    setLoading(true)
    try {
      const res = await fetch('/api/profile/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          avatar: avatarUrl || undefined,
        })
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete profile setup.')
      }

      // Force a hard reload to clear Next.js layout cache and unblock the user immediately
      sessionStorage.setItem('profileJustCompleted', 'true')
      window.location.reload()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'url(/auth-bg.svg) center/cover no-repeat, #f3f4f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div className="fade-in" style={{
        background: 'var(--surface)',
        width: '100%',
        maxWidth: '540px',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Welcome back to GenZ IITian!
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Please update your details so we can serve you better.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-light)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Optional Profile Photo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '4px' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
            />
            <div
              onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              style={{
                position: 'relative',
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(99,102,241,0.2)',
                border: '3px solid #6366f1',
                overflow: 'hidden',
                background: '#eff0fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.15s ease',
              }}
              title="Click to choose a photo"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <img
                  src={getDefaultAvatar(formData.gender)}
                  alt="Default Profile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}

              {/* Camera Overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: uploadingAvatar ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.2s',
              }}>
                {uploadingAvatar ? (
                  <span style={{ color: '#fff', fontSize: '11px', fontWeight: 800 }}>...</span>
                ) : (
                  <div style={{
                    background: 'rgba(255,255,255,0.92)',
                    borderRadius: '50%',
                    width: '26px',
                    height: '26px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4f46e5',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4f46e5',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                {uploadingAvatar ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Add Photo (Optional)'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger, #ef4444)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  Remove
                </button>
              )}
            </div>

            {avatarError && (
              <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', fontWeight: 600 }}>
                {avatarError}
              </span>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>First Name</label>
              <input
                type="text"
                name="firstName"
                placeholder="John"
                className="form-input"
                style={{ background: 'var(--surface)' }}
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Last Name</label>
              <input
                type="text"
                name="lastName"
                placeholder="Doe"
                className="form-input"
                style={{ background: 'var(--surface)' }}
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
             <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Mobile Number</label>
              <input
                type="text"
                name="mobileNumber"
                placeholder="10 digit number"
                className="form-input"
                style={{ background: 'var(--surface)' }}
                value={formData.mobileNumber}
                onChange={handleChange}
                maxLength={10}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Age</label>
              <input
                type="number"
                name="age"
                placeholder="e.g. 21"
                className="form-input"
                style={{ background: 'var(--surface)' }}
                value={formData.age}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>State / Territory</label>
            <select
              name="state"
              className="form-input"
              style={{ background: 'var(--surface)', cursor: 'pointer', appearance: 'auto' }}
              value={formData.state}
              onChange={handleChange}
            >
              <option value="" disabled>Select your state</option>
              {INDIAN_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Gender</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['MALE', 'FEMALE', 'OTHER'].map(g => (
                <div
                  key={g}
                  onClick={() => handleGenderSelect(g)}
                  style={{
                    flex: 1,
                    textTransform: 'capitalize',
                    padding: '12px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: formData.gender === g ? '2px solid #6366f1' : '2px solid #e0e3ea',
                    background: formData.gender === g ? '#eff0fe' : 'var(--surface)',
                    color: formData.gender === g ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  {g.toLowerCase()}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              marginTop: '10px',
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              fontWeight: 800,
              boxShadow: '0 8px 20px rgba(99,102,241,0.3)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Saving...' : 'Submit'}
          </button>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="fade-in" style={{
            background: 'var(--surface)',
            borderRadius: '20px',
            padding: '36px 32px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
            textAlign: 'center'
          }}>
            {/* Warning icon */}
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: '#fff8e1', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Please check all details carefully
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '28px' }}>
              These details <strong style={{ color: 'var(--danger)' }}>cannot be changed</strong> once submitted. Make sure everything is correct before continuing.
            </p>

            {/* Summary of entered details */}
            <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              {[
                { label: 'Profile Photo', value: avatarUrl ? 'Uploaded Photo ✓' : 'Default Avatar' },
                { label: 'Name', value: `${formData.firstName} ${formData.lastName}` },
                { label: 'Mobile', value: formData.mobileNumber },
                { label: 'Age', value: formData.age },
                { label: 'Gender', value: formData.gender.charAt(0) + formData.gender.slice(1).toLowerCase() },
                { label: 'State', value: formData.state },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #eee', fontSize: '13.5px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1, padding: '13px', borderRadius: '12px',
                  border: '2px solid #e0e3ea', background: 'var(--surface)',
                  color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit'
                }}
              >
                Go Back
              </button>
              <button
                onClick={doSubmit}
                className="btn btn-primary"
                style={{
                  flex: 1, padding: '13px', borderRadius: '12px',
                  fontSize: '14px', fontWeight: 800,
                  boxShadow: '0 6px 16px rgba(99,102,241,0.3)'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
