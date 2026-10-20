'use client'

export const CHAMPION_ELIGIBILITY = [
  'Attend at least 80% of live classes.',
  'Score the minimum required marks in the weekly tests based on topics taught in class.',
  'Regularly share your GA marks and progress with the team, and be eligible to give the Qualifier exam offline.',
]
export const CHAMPION_PROVIDES = [
  'Complete academic support',
  'Live classes and study resources',
  'Weekly practice and evaluation',
  'Premium guidance and mentorship',
  '1-to-1 mentorship to choose the best strategy and action plan',
]

export default function ChampionPolicy() {
  const li = (t: string, i: number) => (
    <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.45, color: 'var(--text-primary)' }}><span>•</span><span>{t}</span></li>
  )
  const ul: React.CSSProperties = { listStyle: 'none', margin: '6px 0 12px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }
  return (
    <div style={{ padding: '16px 18px', borderRadius: 16, background: 'var(--danger-light)', border: '1px solid var(--border)', marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--danger)' }}>Qualifier Champion Batch: Terms &amp; Conditions</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 10px' }}>Everything in Live Pro, plus a full refund or free reattempt support when all the conditions below are fulfilled.</div>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Eligibility criteria</div>
      <ul style={ul}>{CHAMPION_ELIGIBILITY.map(li)}</ul>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>What we provide</div>
      <ul style={ul}>{CHAMPION_PROVIDES.map(li)}</ul>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>We provide everything from our side. In return we expect dedication, discipline and focus: 80% attendance, weekly test qualification and active participation.</div>
    </div>
  )
}
