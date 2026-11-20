'use client'

/**
 * Quiz Lab: our separate quiz site. Shared by the sidebar link and the
 * dashboard card so the URL and logo live in one place.
 */
export const QUIZ_LAB_URL = 'https://quiz.genziitian.in/'
export const QUIZ_LAB_LOGO = '/quiz-lab-logo.webp'

export default function QuizLabBanner({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={QUIZ_LAB_URL}
      className={`gz-card-link gz-quizlab ${compact ? 'is-compact' : ''}`}
      aria-label="Open Quiz Lab"
    >
      <img className="gz-card-link__logo" src={QUIZ_LAB_LOGO} alt="" width={40} height={40} />
      <span className="gz-card-link__text">
        <span className="gz-card-link__title">
          Quiz Lab <span className="gz-badge gz-badge--green gz-badge--line">NEW</span>
        </span>
        <span className="gz-card-link__sub">Practice quizzes to test what you&apos;ve learned.</span>
      </span>
      <span className="gz-card-link__go">Start quiz →</span>
    </a>
  )
}
