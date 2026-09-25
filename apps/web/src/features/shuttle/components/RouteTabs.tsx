import type { BusState, ShuttleRoute } from '../types'
import { routeCorridor, routeNumberLabel } from '../lib/schedule'

interface RouteTabsProps {
  routes: ShuttleRoute[]
  busStates: Record<string, BusState>
  selectedRouteId: string | null
  onSelect: (routeId: string) => void
}

/**
 * One tab per route: its colour, "Route N", the corridor underneath, and a cyan Live
 * pill while a real beacon is fresh. On phones the same buttons become a scrolling
 * row of pills (`.shuttle-route-tabs` in index.css).
 */
export function RouteTabs({ routes, busStates, selectedRouteId, onSelect }: RouteTabsProps) {
  return (
    <nav className="shuttle-route-tabs" aria-label="Routes">
      {routes.map((route) => {
        const on = selectedRouteId === route.id
        const live = busStates[route.id]?.source === 'live'
        return (
          <button
            key={route.id}
            type="button"
            aria-pressed={on}
            data-on={on || undefined}
            onClick={() => onSelect(route.id)}
            className="shuttle-route-tab"
          >
            <span className="shuttle-route-dot" style={{ background: route.color }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="shuttle-route-name">{routeNumberLabel(routes, route.id)}</span>
              <span className="shuttle-route-sub">{routeCorridor(route)}</span>
            </span>
            {live && (
              <span className="shuttle-live-pill">
                <span className="shuttle-live-dot" />
                Live
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
