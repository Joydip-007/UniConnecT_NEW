import { Link } from 'react-router-dom'

/** `compact` is the phone layout: tighter padding and no uniconnect.app link. */
export function MinimalPageFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      style={{
        padding: compact ? '14px 16px' : '16px 24px',
        borderTop: '0.5px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 14 : 20,
        flexWrap: 'wrap',
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
        © 2026 Team Mavericks · UIU
      </p>
      <div style={{ display: 'flex', gap: compact ? 14 : 16 }}>
        {[
          { label: 'Privacy', href: '#privacy' },
          { label: 'Terms',   href: '#terms' },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            {label}
          </a>
        ))}
      </div>
      {!compact && (
        <Link
          to="/"
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--uc-indigo-l)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          uniconnect.app
        </Link>
      )}
    </footer>
  )
}
