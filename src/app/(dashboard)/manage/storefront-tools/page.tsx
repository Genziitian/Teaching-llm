'use client'

import Link from 'next/link'
import PageShell from '@/components/storefront/PageShell'

const TOOLS: { href: string; title: string; text: string; soon?: boolean }[] = [
  { href: '/manage/follow-ups', title: 'Follow-ups', text: 'Call back people who abandoned checkout.' },
  { href: '/manage/referrals', title: 'Referrals', text: 'Referral purchases and rewards.' },
  { href: '/manage/blogs', title: 'Blogs', text: 'Write and publish website blogs.' },
  { href: '/manage/faqs', title: 'FAQs', text: 'Course questions and answers.' },
  { href: '/feedback', title: 'Reviews', text: 'Choose which feedback shows on the website.' },
  { href: '/manage/store-settings', title: 'Store settings', text: 'Homepage and course intro videos.' },
]

export default function StorefrontToolsPage() {
  return (
    <PageShell title="Storefront tools" description="Manage the genziitian.in website from here.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {TOOLS.map(tool => (
          <Link key={tool.href} href={tool.href} style={{ textDecoration: 'none' }}>
            <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, padding: '28px 24px', minHeight: 132, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{tool.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{tool.text}</div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
