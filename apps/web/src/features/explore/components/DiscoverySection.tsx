import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  label: string
  seeAllTo?: string
  seeAllLabel?: string
  children: ReactNode
}

export function DiscoverySection({ label, seeAllTo, seeAllLabel = 'See all', children }: Props) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </p>
        {seeAllTo && (
          <Link
            to={seeAllTo}
            style={{ fontSize: 12, color: 'var(--uc-indigo-xl)', fontWeight: 500, textDecoration: 'none' }}
          >
            {seeAllLabel}
          </Link>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: 4,
          scrollbarWidth: 'none',
        }}
      >
        {children}
      </div>
    </section>
  )
}
