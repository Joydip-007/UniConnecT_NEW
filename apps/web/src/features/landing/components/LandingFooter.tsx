import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'

const NAV_LINKS = [
  { label: 'Features',     href: '#features' },
  { label: 'Universities', href: '#universities' },
  { label: 'About',        href: '#about' },
  { label: 'Privacy',      href: '#privacy' },
  { label: 'Terms',        href: '#terms' },
]

export function LandingFooter() {
  return (
    <footer style={{ borderTop: '0.5px solid var(--border-default)' }}>
      <div
        className="uc-footer-inner"
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '40px 52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* Left — logo mark + wordmark */}
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
        >
          <BrandLogo height={30} />
        </Link>

        {/* Center — nav links */}
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Right — copyright */}
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--text-tertiary)',
            flexShrink: 0,
          }}
        >
          © 2026 Team Mavericks · UIU · Bangladesh
        </p>
      </div>
    </footer>
  )
}
