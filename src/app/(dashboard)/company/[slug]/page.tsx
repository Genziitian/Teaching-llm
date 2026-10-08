'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { getDefaultCompanyContent } from '@/lib/companyPagesDefault'

export default function CompanyPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const isAboutUs = slug === 'about-us'
  const isPrivacyPolicy = slug === 'privacy-policy'
  const isTermsAndConditions = slug === 'terms-and-conditions'
  const titleText = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  const { data: userData } = useSWR('/api/auth/me', (url: string) => fetch(url).then(r => r.json()))
  const isManager = userData?.user?.role === 'MANAGER' || userData?.role === 'MANAGER'

  const { data: pageData, mutate } = useSWR(`/api/company-pages/${slug}`, (url: string) => fetch(url).then(r => r.json()))

  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (pageData && !isEditing) {
      // Use DB content if a manager has saved one, otherwise fall back to bundled default.
      setContent(pageData.content || getDefaultCompanyContent(slug))
    }
  }, [pageData, isEditing, slug])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/company-pages/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      if (res.ok) {
        setIsEditing(false)
        mutate()
      } else {
        alert('Failed to save page.')
      }
    } catch {
      alert('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const neuCard: React.CSSProperties = {
    borderRadius: '20px', background: 'var(--surface-2)',
    boxShadow: '6px 6px 14px var(--neu-dark), -6px -6px 14px var(--neu-light)',
    padding: 'clamp(20px, 5vw, 40px)',
    minHeight: '300px'
  }
  
  const neuButton: React.CSSProperties = {
    padding: '10px 24px', borderRadius: '50px', border: 'none',
    background: 'var(--primary)', color: '#fff', fontSize: '14px', fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer',
    boxShadow: '4px 4px 10px rgba(54,54,232,0.35), -2px -2px 6px var(--neu-glow)',
    transition: 'all 0.2s ease',
  }

  const neuButtonSecondary: React.CSSProperties = {
    padding: '10px 24px', borderRadius: '50px', border: 'none',
    background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer',
    boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
    transition: 'all 0.2s ease',
  }

  // If the page-data fetch is still in flight, show a soft loader.
  // We still proceed to render with the default content as a safety net if the API ever fails.
  if (!pageData && !getDefaultCompanyContent(slug)) {
     return <div className="dashboard-inner-page" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Loading {titleText}...</div>
  }

  // If pageData hasn't arrived yet but we have a default for this slug, render the default immediately.
  const displayContent = isPrivacyPolicy || isTermsAndConditions
    ? getDefaultCompanyContent(slug)
    : content || pageData?.content || getDefaultCompanyContent(slug)

  return (
    <div className="dashboard-inner-page" style={{ padding: 'clamp(16px, 4vw, 24px) clamp(16px, 4vw, 32px) 48px', maxWidth: '1000px', margin: '0 auto' }}>
      <style>{`
        .mobile-back-header {
          display: none !important;
        }
        @media (max-width: 767px) {
          .mobile-back-header {
            display: flex !important;
          }
        }
      `}</style>
      <div className="mobile-back-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 200px' }}>
          <button
            onClick={() => router.back()}
            style={{
              ...neuButtonSecondary,
              padding: '10px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              flexShrink: 0,
            }}
            title="Go Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <h1 style={{ fontSize: 'clamp(20px, 5.5vw, 32px)', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px', wordBreak: 'normal', overflowWrap: 'break-word' }}>
            {titleText}
          </h1>
        </div>

        {isManager && !isEditing && !isPrivacyPolicy && !isTermsAndConditions && (
          <button 
            onClick={() => { setContent(pageData.content || ''); setIsEditing(true); }} 
            style={{ ...neuButton, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Page
          </button>
        )}
        
        {isManager && isEditing && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setIsEditing(false)} style={neuButtonSecondary}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{ ...neuButton, opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              {saving ? 'Saving...' : 'Save Page'}
            </button>
          </div>
        )}
      </div>

      <div style={neuCard}>
        {isEditing ? (
          <div>
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Use the toolbar below to format your content. Feel free to use bold, italics, or lists.
            </div>
            <RichTextEditor 
              value={content} 
              onChange={setContent} 
              placeholder={`Write your ${titleText} here...`} 
              minHeight="400px" 
            />
          </div>
        ) : (
          <div
            className="custom-page-content"
            style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: 'clamp(14px, 3.6vw, 16px)' }}
            dangerouslySetInnerHTML={{ __html: displayContent || `<p style="color: #9999b0; font-style: italic; text-align: center; padding: 40px;">No content available for ${titleText}. ${isManager ? 'Click Edit to add something.' : ''}</p>` }}
          />
        )}
      </div>

      {!isEditing && isAboutUs && (
        <div style={{ 
          marginTop: '40px', 
          display: 'flex', 
          flexDirection: 'column',
          gap: '16px',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Manage Policies</h3>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { href: '/company/privacy-policy', label: 'Privacy Policy' },
              { href: '/company/return-policy', label: 'Return / Refund Policy' },
              { href: '/company/copyright-policy', label: 'Copyright Policy' },
            ].map(link => (
              <Link 
                key={link.href}
                href={link.href} 
                style={{ 
                  padding: '16px 24px', 
                  background: 'var(--surface-2)', 
                  borderRadius: '16px',
                  color: 'var(--primary)',
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                  boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Global styles for the rich text editor viewing mode */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-page-content { word-wrap: break-word; overflow-wrap: break-word; }
        .custom-page-content h1 { font-size: clamp(1.4em, 5vw, 2em); margin-bottom: 0.5em; font-weight: 800; color: #1e1e3a; line-height: 1.25; }
        .custom-page-content h2 { font-size: clamp(1.15em, 4vw, 1.5em); margin-bottom: 0.5em; font-weight: 700; color: #2e2e4a; margin-top: 1.4em; line-height: 1.3; }
        .custom-page-content h3 { font-size: clamp(1.05em, 3.6vw, 1.25em); margin-bottom: 0.4em; font-weight: 700; color: #2e2e4a; margin-top: 1.2em; }
        .custom-page-content p { margin-bottom: 1em; }
        .custom-page-content ul, .custom-page-content ol { padding-left: 1.5em; margin-bottom: 1em; }
        .custom-page-content li { margin-bottom: 0.4em; }
        .custom-page-content a { color: #3636e8; text-decoration: underline; font-weight: 600; word-break: break-all; }
        .custom-page-content strong, .custom-page-content b { font-weight: 700; color: #1e1e3a; }
        .custom-page-content img, .custom-page-content video, .custom-page-content iframe { max-width: 100%; height: auto; border-radius: 12px; }
        .custom-page-content table { display: block; overflow-x: auto; max-width: 100%; }
      `}} />
    </div>
  )
}
