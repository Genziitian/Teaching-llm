'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'

const load = (fn: () => Promise<any>) => dynamic(fn, { ssr: false })

const SECTIONS = [
  { id: 'users', label: 'Users', C: load(() => import('./UsersManager')) },
  { id: 'courses', label: 'Courses', C: load(() => import('./CoursesStorefrontManager')) },
  { id: 'boxes', label: 'Boxes', C: load(() => import('./BoxesManager')) },
  { id: 'booklets', label: 'Booklets', C: load(() => import('./BookletsManager')) },
  { id: 'payments', label: 'Payments', C: load(() => import('./PaymentsStorefrontPanel')) },
  { id: 'follow-ups', label: 'Follow-ups', C: load(() => import('./FollowUpsManager')) },
  { id: 'referrals', label: 'Referrals', C: load(() => import('./ReferralsManager')) },
  { id: 'blogs', label: 'Blogs', C: load(() => import('./BlogsManager')) },
  { id: 'faqs', label: 'FAQs', C: load(() => import('./FaqsManager')) },
  { id: 'reviews', label: 'Reviews', C: load(() => import('./ReviewsManager')) },
  { id: 'settings', label: 'Settings', C: load(() => import('./StoreSettingsManager')) },
]

/** All website (storefront) management in one place, opened from the Store page. */
export default function StorefrontHub() {
  const router = useRouter()
  const params = useSearchParams()
  const active = SECTIONS.find(s => s.id === params?.get('section')) || SECTIONS[0]
  const go = (id: string) => router.push(`/courses/explore?view=listings&section=${id}`)

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 16 }}>
        {SECTIONS.map(s => {
          const on = s.id === active.id
          return (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              style={{
                padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                border: '1px solid var(--border)', boxShadow: 'none',
                background: on ? 'var(--gz-ink, var(--primary))' : 'transparent',
                color: on ? 'var(--gz-ink-inv, #000)' : 'var(--text-secondary)',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>
      <active.C key={active.id} />
    </div>
  )
}
