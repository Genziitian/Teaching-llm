'use client'

import Link from 'next/link'
import PageShell from '@/components/storefront/PageShell'

const TOOLS: { href: string; title: string; text: string; soon?: boolean }[] = [
  { href: '/manage/updates', title: 'Updates', text: 'Greetings, updates and user messages.' },
  { href: '/manage/prompts', title: 'User Prompts', text: 'Quick feedback prompts for users.' },
  { href: '/manage/facts', title: 'Loading Facts', text: 'Facts shown on loading screens.' },
  { href: '/manage/mail-assigner', title: 'Mail Assigner', text: 'Assign mail to team members.' },
  { href: '/manage/menus', title: 'Menu Visibility', text: 'Show or hide sidebar items.' },
  { href: '/manage/boxes', title: 'Boxes', text: 'Course boxes on the website.' },
  { href: '/activity-logs', title: 'Activity Log', text: 'Platform activity and user actions.' },
  { href: '/google-sync', title: 'Google Sync', text: 'Sync data with Google.' },
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
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{tool.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{tool.text}</div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
