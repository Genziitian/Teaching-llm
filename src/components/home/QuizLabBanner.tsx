'use client'

/**
 * Quiz Lab: our separate quiz site. Shared by the sidebar link and the
 * dashboard banner so the URL and logo live in one place.
 */
export const QUIZ_LAB_URL = 'https://quiz.genziitian.in/'
export const QUIZ_LAB_LOGO = '/quiz-lab-logo.webp'

export default function QuizLabBanner({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={QUIZ_LAB_URL}
      className={`quizlab-banner ${compact ? 'is-compact' : ''}`}
      aria-label="Open Quiz Lab"
    >
      <style>{`
        .quizlab-banner {
          position: relative; overflow: hidden; display: flex; align-items: center; gap: 16px;
          padding: 16px 20px; margin-bottom: 20px; border-radius: 22px; text-decoration: none; color: #fff;
          background: radial-gradient(120% 140% at 0% 0%, #1f9d55 0%, #0d5c33 45%, #062a18 100%);
          border: 1px solid rgba(74, 222, 128, 0.35);
          animation: quizlabIn 520ms cubic-bezier(.2,.9,.2,1) backwards, quizlabGlow 3s ease-in-out 600ms infinite;
          transition: transform 220ms ease, filter 220ms ease;
          -webkit-tap-highlight-color: transparent;
        }
        .quizlab-banner:hover { transform: translateY(-2px); filter: brightness(1.07); }
        .quizlab-banner:active { transform: scale(0.99); }
        .quizlab-banner::after {
          content: ''; position: absolute; top: 0; left: -45%; width: 35%; height: 100%; pointer-events: none;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.28), transparent);
          transform: skewX(-20deg); animation: quizlabShine 3.6s ease-in-out 1s infinite;
        }
        .quizlab-banner .ql-logo {
          width: 56px; height: 56px; border-radius: 16px; flex-shrink: 0; display: block;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(74,222,128,0.55);
          animation: quizlabBob 3s ease-in-out infinite;
        }
        .quizlab-banner .ql-text { min-width: 0; flex: 1; position: relative; z-index: 1; }
        .quizlab-banner .ql-title { display: flex; align-items: center; gap: 8px; font-size: 19px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
        .quizlab-banner .ql-new {
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 999px;
          background: #dcfce7; color: #0d5c33;
        }
        .quizlab-banner .ql-sub { margin-top: 4px; font-size: 13.5px; color: rgba(236, 253, 245, 0.85); line-height: 1.4; }
        .quizlab-banner .ql-go {
          position: relative; z-index: 1; flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 18px; border-radius: 999px; background: #fff; color: #0d5c33;
          font-size: 14px; font-weight: 800; white-space: nowrap; transition: gap 220ms ease;
        }
        .quizlab-banner:hover .ql-go { gap: 10px; }
        .quizlab-banner.is-compact { padding: 14px 16px; gap: 12px; border-radius: 20px; }
        .quizlab-banner.is-compact .ql-logo { width: 46px; height: 46px; border-radius: 13px; }
        .quizlab-banner.is-compact .ql-title { font-size: 17px; }
        .quizlab-banner.is-compact .ql-sub { font-size: 12.5px; }
        .quizlab-banner.is-compact .ql-go { padding: 9px 14px; font-size: 13px; }
        @media (max-width: 420px) {
          .quizlab-banner .ql-go span { display: none; }
        }
        @keyframes quizlabIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes quizlabGlow {
          0%, 100% { box-shadow: 0 8px 24px rgba(6, 42, 24, 0.35), 0 0 0 0 rgba(34, 197, 94, 0); }
          50% { box-shadow: 0 8px 24px rgba(6, 42, 24, 0.35), 0 0 26px 2px rgba(34, 197, 94, 0.45); }
        }
        @keyframes quizlabShine { 0% { left: -45%; } 50%, 100% { left: 130%; } }
        @keyframes quizlabBob { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-3px) rotate(-4deg); } }
        @media (prefers-reduced-motion: reduce) {
          .quizlab-banner, .quizlab-banner::after, .quizlab-banner .ql-logo { animation: none !important; }
        }
      `}</style>
      <img className="ql-logo" src={QUIZ_LAB_LOGO} alt="" width={56} height={56} />
      <div className="ql-text">
        <div className="ql-title">Quiz Lab <span className="ql-new">NEW</span></div>
        <div className="ql-sub">Practice quizzes to test what you&apos;ve learned.</div>
      </div>
      <span className="ql-go"><span>Start quiz</span> →</span>
    </a>
  )
}
