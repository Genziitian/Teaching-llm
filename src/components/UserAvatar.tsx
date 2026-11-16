'use client'

import React, { useState, useEffect } from 'react'
import { getDefaultAvatar } from '@/lib/avatar'

export interface UserAvatarUser {
  name?: string | null
  avatar?: string | null
  gender?: string | null
  role?: string | null
}

export interface UserAvatarProps {
  user?: UserAvatarUser | null
  name?: string | null
  avatar?: string | null
  gender?: string | null
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  style?: React.CSSProperties
  alt?: string
  crossOrigin?: 'anonymous' | 'use-credentials'
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}

function getPixelSize(size: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md'): number {
  if (typeof size === 'number') return size
  switch (size) {
    case 'xs': return 24
    case 'sm': return 32
    case 'md': return 40
    case 'lg': return 48
    case 'xl': return 64
    default: return 40
  }
}

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export default function UserAvatar({
  user,
  name: directName,
  avatar: directAvatar,
  gender: directGender,
  size = 'md',
  className = '',
  style = {},
  alt,
  crossOrigin,
  onClick,
}: UserAvatarProps) {
  const name = user?.name ?? directName ?? ''
  const customAvatar = user?.avatar ?? directAvatar ?? null
  const gender = user?.gender ?? directGender ?? null

  const defaultAvatar = getDefaultAvatar(gender)
  const initialStage = customAvatar ? 'custom' : 'default'

  const [imgStage, setImgStage] = useState<'custom' | 'default' | 'initials'>(initialStage)

  // Reset stage if inputs change
  useEffect(() => {
    setImgStage(customAvatar ? 'custom' : 'default')
  }, [customAvatar, gender])

  const handleImageError = () => {
    if (imgStage === 'custom') {
      setImgStage('default')
    } else if (imgStage === 'default') {
      setImgStage('initials')
    }
  }

  const pxSize = getPixelSize(size)
  const initials = getInitials(name)
  const accessibleAlt = alt || name || 'User avatar'

  const containerStyle: React.CSSProperties = {
    width: `${pxSize}px`,
    height: `${pxSize}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    userSelect: 'none',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  }

  if (imgStage === 'custom' && customAvatar) {
    return (
      <div className={`user-avatar ${className}`} style={containerStyle} onClick={onClick}>
        <img
          src={customAvatar}
          alt={accessibleAlt}
          crossOrigin={crossOrigin}
          onError={handleImageError}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  if (imgStage === 'default') {
    return (
      <div className={`user-avatar ${className}`} style={containerStyle} onClick={onClick}>
        <img
          src={defaultAvatar}
          alt={accessibleAlt}
          crossOrigin={crossOrigin}
          onError={handleImageError}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  // Emergency fallback: Initials
  const fontSize = Math.max(10, Math.floor(pxSize * 0.4))
  return (
    <div
      className={`user-avatar user-avatar-initials ${className}`}
      style={{
        ...containerStyle,
        background: 'var(--surface-2, #e2e8f0)',
        color: 'var(--text-primary, #1e293b)',
        fontSize: `${fontSize}px`,
        fontWeight: 600,
        border: '1px solid var(--border, rgba(0,0,0,0.1))',
      }}
      onClick={onClick}
      title={name}
    >
      {initials}
    </div>
  )
}
