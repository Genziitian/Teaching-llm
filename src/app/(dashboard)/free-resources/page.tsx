'use client'

import Link from 'next/link'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function FreeResourcesPage() {
  const { data: courses } = useSWR<any[]>('/api/free-resources/courses', fetcher)
  const { data: materials } = useSWR<any[]>('/api/free-resources/materials', fetcher)

  const cards = [
    {
      href: '/free-resources/courses',
      banner: '/images/free-courses-banner.webp',
      title: 'Free Courses',
      description: 'Browse and enroll for free.',
      count: courses?.length ?? 0,
      countLabel: 'courses available',
    },
    {
      href: '/free-resources/materials',
      banner: '/images/free-materials-banner.webp',
      title: 'Free Materials',
      description: 'Notes, summaries and formula sheets.',
      count: materials?.length ?? 0,
      countLabel: 'materials available',
    },
  ]

  return (
    <div className="gz-page fade-in">
      <div className="gz-banner-grid">
        {cards.map((card, idx) => (
          <Link key={card.href} href={card.href} className="gz-banner" aria-label={`${card.title}. ${card.description}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.banner} alt="" width={1200} height={400} loading={idx === 0 ? 'eager' : 'lazy'} decoding="async" className="gz-banner__img" />
            <div className="gz-banner__foot">
              <div>
                <div className="gz-banner__title">{card.title}</div>
                <div className="gz-banner__sub">{card.description}</div>
              </div>
              <div className="gz-banner__meta">
                <span className="gz-pill">{card.count} {card.countLabel}</span>
                <span className="gz-link">Explore →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
