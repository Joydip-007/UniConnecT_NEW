import { EyebrowLabel } from 'web';

// The 11px / 0.04em eyebrow tier. Per the design system it is --text-label,
// never --text-tertiary (that token is for 12px meta, timestamps, placeholders).

export function Default() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 320 }}>
      <EyebrowLabel>Trending now</EyebrowLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {['placement2026 · 42', 'thesis · 18', 'uiudays · 11'].map((t) => (
          <span
            key={t}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--uc-indigo-l)',
              background: 'var(--uc-indigo-bg)',
              border: '0.5px solid var(--uc-indigo-bdr)',
              borderRadius: 'var(--r-pill)',
              padding: '3px 9px',
            }}
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AboveAList() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 320 }}>
      <EyebrowLabel>On duty now</EyebrowLabel>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
        Route 3 · Uttara → Campus
        <br />
        Departs 8:15 AM
      </div>
    </div>
  );
}
