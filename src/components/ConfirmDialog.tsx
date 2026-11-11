'use client'

import React from 'react'

import DeleteConfirmationModal from './DeleteConfirmationModal'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string | React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  strictDelete?: boolean
  entityType?: string
  entityName?: string
  confirmationPhrase?: string
}

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
  loading = false,
  strictDelete = false,
  entityType,
  entityName,
  confirmationPhrase,
}: ConfirmDialogProps) {
  if (!open) return null

  if (strictDelete || entityName) {
    return (
      <DeleteConfirmationModal
        open={open}
        onClose={onCancel}
        onConfirm={onConfirm}
        entityType={entityType || (title.startsWith('Delete ') ? title.replace('Delete ', '').replace('?', '') : 'Item')}
        entityName={entityName || 'CONFIRM'}
        confirmationPhrase={confirmationPhrase}
        description={typeof message === 'string' ? message : undefined}
        loading={loading}
      />
    )
  }

  const confirmBg = tone === 'danger' ? 'var(--danger)' : 'var(--primary)'
  const confirmShadow = tone === 'danger'
    ? '4px 4px 10px rgba(239,68,68,0.28)'
    : '4px 4px 10px rgba(54,54,232,0.28)'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onCancel}
    >
      <div
        className="modal"
        style={{
          width: '100%',
          maxWidth: '500px',
          padding: '24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
          {title}
        </div>
        <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '22px' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn btn-ghost"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '10px 22px',
              fontFamily: 'inherit',
              fontSize: '13px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#fff',
              background: confirmBg,
              boxShadow: '0 4px 12px ' + (tone === 'danger' ? 'rgba(239,68,68,0.3)' : 'color-mix(in srgb, var(--primary) 30%, transparent)'),
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

