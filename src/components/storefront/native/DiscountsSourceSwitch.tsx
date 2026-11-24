'use client'

/** Pill switch used to flip a class page between class data and storefront data (managers only). */
export default function DiscountsSourceSwitch<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: ReadonlyArray<readonly [T, string]>
}) {
  return (
    <div role="tablist" style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {options.map(([k, label]) => (
        <button
          key={k}
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          style={{
            padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: value === k ? 'var(--primary)' : 'transparent', color: value === k ? '#fff' : 'var(--text-primary)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
