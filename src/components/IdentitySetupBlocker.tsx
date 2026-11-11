'use client'

import React, { useState } from 'react'

export default function IdentitySetupBlocker({ user }: { user: any }) {
  const [formData, setFormData] = useState({
    iitmJoinYear: '',
    iitmJoinMonth: '',
    iitmLevel: '',
    iitmUserType: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  const handleSelect = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Client-side validations
    if (!formData.iitmJoinYear) {
      return setError('Please select your joining year.')
    }
    if (!formData.iitmJoinMonth) {
      return setError('Please select your joining month.')
    }
    if (!formData.iitmLevel) {
      return setError('Please select your current level.')
    }
    if (!formData.iitmUserType) {
      return setError('Please select your category.')
    }

    setLoading(true)
    try {
      const res = await fetch('/api/profile/identity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update identity details.')
      }

      // Success - show welcome modal!
      setShowWelcomeModal(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Something went wrong.')
      setLoading(false)
    }
  }

  const handleProceed = () => {
    window.location.reload()
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'url(/auth-bg.svg) center/cover no-repeat, #f3f4f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9998,
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div className="fade-in" style={{
        background: 'var(--surface)',
        width: '100%',
        maxWidth: '680px',
        padding: '24px 32px',
        borderRadius: '24px',
        boxShadow: '0 20px 45px rgba(0,0,0,0.08)',
        border: '1px solid rgba(255,255,255,0.7)',
        backdropFilter: 'blur(10px)',
        margin: 'auto'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #818cf8, var(--primary))',
            color: '#fff',
            marginBottom: '10px',
            boxShadow: '0 6px 12px color-mix(in srgb, var(--primary) 15%, transparent)'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '21px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0px', letterSpacing: '-0.02em' }}>
            Update Your Profile
          </h1>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'var(--danger-light)',
            color: 'var(--danger)',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '12.5px',
            fontWeight: 600,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Question 1: When you Join IITM BS DEGREE (Horizontal Split) */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
              When did you join IITM BS?
            </label>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
              gap: '16px' 
            }}>
              {/* Year Selector */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>
                  Select Year
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {['2023', '2024', '2025', '2026'].map(year => {
                    const isSelected = formData.iitmJoinYear === year
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => handleSelect('iitmJoinYear', year)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid var(--primary)' : '2px solid #e2e8f0',
                          background: isSelected ? '#eff0fe' : 'var(--surface)',
                          color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          outline: 'none'
                        }}
                      >
                        {year}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Month Selector */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>
                  Select Term
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {['JAN', 'MAY', 'SEPT'].map(month => {
                    const isSelected = formData.iitmJoinMonth === month
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => handleSelect('iitmJoinMonth', month)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid var(--primary)' : '2px solid #e2e8f0',
                          background: isSelected ? '#eff0fe' : 'var(--surface)',
                          color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          outline: 'none'
                        }}
                      >
                        {month}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Questions 2 & 3: Level & Category (Horizontal Split) */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: '20px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            paddingTop: '14px'
          }}>
            {/* Question 2: Which Level are You in */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                Which Level are You in :
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {['Qualifier', 'Foundation', 'Diploma', 'Degree'].map(level => {
                  const isSelected = formData.iitmLevel === level
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handleSelect('iitmLevel', level)}
                      style={{
                        padding: '12px 6px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid var(--primary)' : '2px solid #e2e8f0',
                        background: isSelected ? '#eff0fe' : 'var(--surface)',
                        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'center',
                        outline: 'none'
                      }}
                    >
                      {level}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question 3: Are You */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                Are You :
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { key: 'STANDALONE', label: 'STANDALONE' },
                  { key: 'DUAL DEGREE', label: 'DUAL DEGREE' },
                  { key: 'WORKING PROFESSIONAL', label: 'WORKING PROFESSIONAL' }
                ].map(type => {
                  const isSelected = formData.iitmUserType === type.key
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => handleSelect('iitmUserType', type.key)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid var(--primary)' : '2px solid #e2e8f0',
                        background: isSelected ? '#eff0fe' : 'var(--surface)',
                        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                        outline: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{type.label}</span>
                      {isSelected && (
                        <span style={{
                          width: '15px',
                          height: '15px',
                          borderRadius: '50%',
                          background: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '9px'
                        }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              marginTop: '4px',
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 800,
              boxShadow: '0 6px 16px color-mix(in srgb, var(--primary) 20%, transparent)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: '12px',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
              background: 'linear-gradient(135deg, var(--primary), var(--primary))',
              color: '#ffffff'
            }}
          >
            {loading ? 'Saving...' : 'Submit'}
          </button>
        </form>
      </div>

      {/* Success Modal */}
      {showWelcomeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div className="fade-in" style={{
            background: 'var(--surface)',
            borderRadius: '24px',
            padding: '40px 32px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.8)'
          }}>
            {/* Celebration Icon */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #34d399, #059669)',
              display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 16px rgba(5,150,105,0.2)',
              color: '#fff'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.01em' }}>
              Thank You!
            </h2>
            <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '28px' }}>
              Your identity has been updated. Welcome to <strong style={{ color: 'var(--primary)' }}>GenZ IITian</strong> family!
            </p>

            <button
              onClick={handleProceed}
              className="btn btn-primary"
              style={{
                width: 'auto',
                minWidth: '200px',
                padding: '12px 24px',
                margin: '0 auto',
                display: 'inline-block',
                borderRadius: '12px',
                fontSize: '14.5px',
                fontWeight: 800,
                boxShadow: '0 6px 16px color-mix(in srgb, var(--primary) 20%, transparent)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--primary), var(--primary))',
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
