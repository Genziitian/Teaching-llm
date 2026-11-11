'use client'

import React, { useRef, useEffect, useState } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export default function RichTextEditor({ value, onChange, placeholder = 'Write something...', minHeight = '300px' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChange = useRef(false)

  // Initialize value once, or update if external change happens
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML && !isInternalChange.current) {
      editorRef.current.innerHTML = value || ''
    }
    isInternalChange.current = false
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true
      onChange(editorRef.current.innerHTML)
    }
  }

  const format = (command: string, arg?: string) => {
    document.execCommand(command, false, arg)
    if (editorRef.current) {
      editorRef.current.focus()
    }
    handleInput()
  }

  const ToolbarButton = ({
    icon,
    onClick,
    isActive = false,
    title
  }: {
    icon: React.ReactNode
    onClick: () => void
    isActive?: boolean
    title: string
  }) => (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
      style={{
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isActive ? 'var(--primary)' : 'transparent',
        color: isActive ? '#ffffff' : 'var(--text-secondary)',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
    </button>
  )

  return (
    <div style={{
      border: '2px solid var(--border)',
      borderRadius: '16px',
      overflow: 'hidden',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 14px',
        background: 'var(--surface-2)',
        borderBottom: '2px solid var(--border)',
        flexWrap: 'wrap'
      }}>
        <ToolbarButton title="Bold"
          onClick={() => format('bold')}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
            </svg>
          } />
        <ToolbarButton title="Italic"
          onClick={() => format('italic')}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>
            </svg>
          } />
        <ToolbarButton title="Underline"
          onClick={() => format('underline')}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/>
            </svg>
          } />
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />

        <ToolbarButton title="Heading 1"
          onClick={() => format('formatBlock', 'H1')}
          icon={<span style={{ fontWeight: 800, fontSize: '15px' }}>H1</span>} />
        <ToolbarButton title="Heading 2"
          onClick={() => format('formatBlock', 'H2')}
          icon={<span style={{ fontWeight: 800, fontSize: '15px' }}>H2</span>} />
        
        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />

        <ToolbarButton title="Bullet List"
          onClick={() => format('insertUnorderedList')}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          } />
        <ToolbarButton title="Numbered List"
          onClick={() => format('insertOrderedList')}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
            </svg>
          } />
      </div>

      {/* Editor Content */}
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        style={{
          padding: '20px',
          minHeight,
          outline: 'none',
          color: 'var(--text-primary)',
          fontSize: '15px',
          lineHeight: '1.6',
          wordBreak: 'break-word',
          overflowY: 'auto'
        }}
        data-placeholder={placeholder}
      />
      <style dangerouslySetInnerHTML={{__html: `
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9999b0;
          pointer-events: none;
          display: block; // For Firefox
        }
        [contenteditable] h1 { font-size: 2em; margin-bottom: 0.5em; font-weight: 800; }
        [contenteditable] h2 { font-size: 1.5em; margin-bottom: 0.5em; font-weight: 700; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 2em; margin-bottom: 1em; }
        [contenteditable] li { margin-bottom: 0.5em; }
        [contenteditable] a { color: var(--primary); text-decoration: underline; }
      `}} />
    </div>
  )
}
