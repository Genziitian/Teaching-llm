'use client'

import React, { useState, useEffect } from 'react'

export interface DeleteConfirmationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  entityType?: string // e.g. "Course", "Discount", "Offering", "Bundle"
  entityName: string // e.g. "OFPED23WE" or "REACT-101"
  confirmationPhrase?: string // e.g. "DELETE MY COURSE" or "DELETE MY DISCOUNT"
  description?: string
  loading?: boolean
}

export default function DeleteConfirmationModal({
  open,
  onClose,
  onConfirm,
  entityType = 'Course',
  entityName,
  confirmationPhrase,
  description,
  loading = false,
}: DeleteConfirmationModalProps) {
  const defaultPhrase = confirmationPhrase || `DELETE MY ${entityType.toUpperCase()}`
  
  const [val1, setVal1] = useState('')
  const [val2, setVal2] = useState('')

  // Reset inputs when modal opens/closes or target changes
  useEffect(() => {
    if (open) {
      setVal1('')
      setVal2('')
    }
  }, [open, entityName])

  if (!open) return null

  // Case-insensitive, trimmed comparison
  const val1Matched = val1.trim().toLowerCase() === entityName.trim().toLowerCase()
  const val2Matched = val2.trim().toLowerCase() === defaultPhrase.trim().toLowerCase()
  const canDelete = val1Matched && val2Matched && !loading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canDelete) return
    await onConfirm()
  }

  const defaultDescription = description || `This will permanently delete the ${entityType.toLowerCase()}. Existing orders or enrollments using this entity will not be affected, but new actions will not be able to use it.`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#ffffff',
          borderRadius: '14px',
          border: '2.5px solid #0f172a',
          boxShadow: '8px 8px 0px #0f172a',
          padding: '28px 30px',
          color: '#0f172a',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Delete {entityType}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Description */}
        <p style={{ fontSize: '14px', lineHeight: '1.55', color: '#475569', margin: 0, fontWeight: '500' }}>
          {defaultDescription}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Field 1: Entity Name / Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>
              TO CONFIRM, TYPE <span style={{ color: '#0f172a' }}>"{entityName}"</span>
            </label>
            <input
              type="text"
              value={val1}
              onChange={e => setVal1(e.target.value)}
              placeholder={entityName}
              style={{
                width: '100%',
                padding: '13px 16px',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: '14px',
                border: '2px solid #0f172a',
                outline: 'none',
                background: '#ffffff',
                color: '#0f172a',
                boxShadow: 'none',
                transition: 'border-color 0.2s ease',
              }}
            />
          </div>

          {/* Field 2: Confirmation Phrase */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>
              TO CONFIRM, TYPE <span style={{ color: '#0f172a' }}>"{defaultPhrase}"</span>
            </label>
            <input
              type="text"
              value={val2}
              onChange={e => setVal2(e.target.value)}
              placeholder={defaultPhrase.toLowerCase()}
              style={{
                width: '100%',
                padding: '13px 16px',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: '14px',
                border: '2px solid #0f172a',
                outline: 'none',
                background: '#ffffff',
                color: '#0f172a',
                transition: 'border-color 0.2s ease',
              }}
            />
          </div>

          {/* Warning Banner */}
          <div
            style={{
              background: '#fff1f2',
              border: '1.5px solid #fecdd3',
              borderRadius: '14px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '4px',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#ef4444',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              !
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#e11d48', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              DELETING {entityName} CANNOT BE UNDONE.
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '14px',
                borderRadius: '14px',
                border: '2px solid #0f172a',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '3px 3px 0px #0f172a',
                transition: 'transform 0.1s ease, box-shadow 0.1s ease',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canDelete}
              style={{
                padding: '14px',
                borderRadius: '14px',
                border: canDelete ? '2px solid #0f172a' : 'none',
                background: canDelete ? '#ef4444' : '#e2e8f0',
                color: canDelete ? '#ffffff' : '#94a3b8',
                fontSize: '15px',
                fontWeight: 600,
                cursor: canDelete ? 'pointer' : 'not-allowed',
                boxShadow: canDelete ? '3px 3px 0px #0f172a' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? 'Deleting...' : `Delete ${entityType}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
