import { Bus } from 'lucide-react'
import type { ShuttleRoute } from '../types'

interface RouteTabsProps {
  routes: ShuttleRoute[]
  selectedRouteId: string | null
  onSelect: (routeId: string) => void
}

export function RouteTabs({ routes, selectedRouteId, onSelect }: RouteTabsProps) {
  return (
    <nav
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '4px 6px',
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
      }}
    >
      {routes.map((route) => {
        const active = selectedRouteId === route.id
        return (
          <button
            key={route.id}
            type="button"
            onClick={() => onSelect(route.id)}
            style={{
              flex: '1 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              borderRadius: 'var(--r-pill)',
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--uc-indigo-bg)' : 'transparent',
              color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
              transition: 'background 150ms, color 150ms',
              whiteSpace: 'nowrap',
            }}
          >
            <Bus size={13} strokeWidth={1.5} />
            {route.name}
          </button>
        )
      })}
    </nav>
  )
}
