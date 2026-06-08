import { StrictMode } from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ShuttleMap } from './ShuttleMap'
import type { BusState, ShuttleRoute } from '../types'

// Regression test for the react-leaflet v5/React-19 peer mismatch that crashed
// the shuttle page: mounting the map under React 18 + StrictMode (double-mount)
// must not throw and must produce a Leaflet container.
const route: ShuttleRoute = {
  id: 'r1',
  name: 'Notun Bazar ↔ UIU',
  color: '#3B82F6',
  isActive: true,
  stops: [
    { id: 's0', name: 'Notun Bazar', orderIndex: 0, lat: 23.7958, lng: 90.4255 },
    { id: 's1', name: 'UIU', orderIndex: 1, lat: 23.8128, lng: 90.4501 },
  ],
}

const busStates: Record<string, BusState> = {
  r1: { routeId: 'r1', lat: 23.804, lng: 90.438, headingDeg: 45, direction: 'outbound', speedKmh: null, source: 'estimated', updatedAt: null },
}

describe('ShuttleMap', () => {
  it('mounts under StrictMode without crashing and renders a Leaflet container', () => {
    const { container, unmount } = render(
      <StrictMode>
        <ShuttleMap
          routes={[route]}
          busStates={busStates}
          selectedRouteId="r1"
          focusMode={false}
          liveOnly={false}
          userLocation={null}
          onSelectRoute={() => {}}
        />
      </StrictMode>,
    )
    expect(container.querySelector('.leaflet-container')).not.toBeNull()
    unmount()
  })
})
