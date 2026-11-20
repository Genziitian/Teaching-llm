'use client'

import Link from 'next/link'
import { Megaphone, ThumbsUp, Lightbulb, Mail, Eye, Package, ClipboardCheck, RefreshCw, PhoneCall, Gift, ScrollText, HelpCircle, Star, Settings, Network, Database, type LucideIcon } from 'lucide-react'
import PageShell from '@/components/storefront/PageShell'

const TOOLS: { href: string; icon: LucideIcon; title: string; text: string }[] = [
  { href: '/manage/site-data', icon: Database, title: 'Website data', text: 'Import the old website data into the platform.' },
  { href: '/manage/queries', icon: HelpCircle, title: 'Queries', text: 'Platform rules and answers for managers.' },
  { href: '/manage/genie', icon: Network, title: 'Genie Map', text: 'The GenZie chat answer map.' },
  { href: '/manage/genie/learning', icon: Lightbulb, title: 'GenZie learning', text: 'Approve answers GenZie learned from community chats.' },
  { href: '/manage/updates', icon: Megaphone, title: 'Updates', text: 'Greetings, updates and user messages.' },
  { href: '/manage/prompts', icon: ThumbsUp, title: 'User Prompts', text: 'Quick feedback prompts for users.' },
  { href: '/manage/facts', icon: Lightbulb, title: 'Loading Facts', text: 'Facts shown on loading screens.' },
  { href: '/manage/mail-assigner', icon: Mail, title: 'Mail Assigner', text: 'Assign mail to team members.' },
  { href: '/manage/menus', icon: Eye, title: 'Menu Visibility', text: 'Show or hide sidebar items.' },
  { href: '/manage/boxes', icon: Package, title: 'Boxes', text: 'Course boxes on the website.' },
  { href: '/activity-logs', icon: ClipboardCheck, title: 'Activity Log', text: 'Platform activity and user actions.' },
  { href: '/google-sync', icon: RefreshCw, title: 'Google Sync', text: 'Sync data with Google.' },
  { href: '/manage/follow-ups', icon: PhoneCall, title: 'Follow-ups', text: 'Call back people who abandoned checkout.' },
  { href: '/manage/referrals', icon: Gift, title: 'Referrals', text: 'Referral purchases and rewards.' },
  { href: '/manage/blogs', icon: ScrollText, title: 'Blogs', text: 'Write and publish website blogs.' },
  { href: '/manage/faqs', icon: HelpCircle, title: 'FAQs', text: 'Course questions and answers.' },
  { href: '/feedback', icon: Star, title: 'Reviews', text: 'Choose which feedback shows on the website.' },
  { href: '/manage/store-settings', icon: Settings, title: 'Store settings', text: 'Homepage and course intro videos.' },
]

export default function StorefrontToolsPage() {
  return (
    <PageShell title="Storefront tools" description="Manage the genziitian.in website from here.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {TOOLS.map(tool => (
          <Link key={tool.href} href={tool.href} style={{ textDecoration: 'none' }}>
            <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, padding: '28px 24px', minHeight: 132, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', marginBottom: 6 }}>
                <tool.icon size={19} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{tool.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{tool.text}</div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
