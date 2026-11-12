const QUIZ_URL = 'https://quiz.genziitian.in/';

const CSS = `
.qlnp{display:inline-flex;align-items:center;gap:8px;padding:4px 14px 4px 5px;border-radius:999px;
  background:#0b1120;border:2px solid #0b1120;box-shadow:2px 2px 0 #10b981;
  color:#fff;font-weight:800;font-size:14px;white-space:nowrap;text-decoration:none;
  transition:transform .15s ease,box-shadow .15s ease}
.qlnp:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #10b981}
.qlnp:focus-visible{outline:3px solid #10b981;outline-offset:3px}
.qlnp-logo{width:26px;height:26px;border-radius:50%;object-fit:cover;flex:none}
.qlnp-text b{color:#34d399;font-weight:800}
.qlnp-dot{width:7px;height:7px;border-radius:50%;background:#34d399;flex:none}
@media (prefers-reduced-motion:reduce){.qlnp{transition:none}}
`;

/** Oval "Quiz-LAB" pill for the navbar. Opens the Quiz Lab site in the same tab. */
export default function QuizLabNavPill({ onClick, className = '' }: { onClick?: () => void; className?: string }) {
  return (
    <>
      <style>{CSS}</style>
      <a href={QUIZ_URL} onClick={onClick} className={`qlnp ${className}`} aria-label="Quiz Lab (opens quiz.genziitian.in)">
        <img className="qlnp-logo" src="/landing-assets/quiz-lab-logo.webp" alt="" width={26} height={26} />
        <span className="qlnp-text">Quiz-<b>LAB</b></span>
        <span className="qlnp-dot" aria-hidden="true" />
      </a>
    </>
  );
}
