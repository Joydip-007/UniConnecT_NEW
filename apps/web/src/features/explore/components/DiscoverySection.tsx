import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  label: string
  seeAllTo?: string
  seeAllLabel?: string
  /** Hide the whole section (header included) instead of rendering an empty-state sentence. */
  isEmpty?: boolean
  /** 'scroll' (default) is a horizontal card carousel; 'list' is a dense vertical stack. */
  layout?: 'scroll' | 'list'
  children: ReactNode
}

export function DiscoverySection({ label, seeAllTo, seeAllLabel = 'See all', isEmpty = false, layout = 'scroll', children }: Props) {
  if (isEmpty) return null

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
        <h2
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          {label}
        </h2>
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
        style={
          layout === 'list'
            ? { display: 'flex', flexDirection: 'column' }
            : {
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                paddingBottom: 4,
                scrollbarWidth: 'none',
                maskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent 100%)',
              }
        }
      >
        {children}
      </div>
    </section>
  )
}
