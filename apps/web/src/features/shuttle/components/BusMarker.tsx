import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import logoUrl from '@/assets/logo.svg'
import { relativeTime } from '../utils'
import type { BusState, ShuttleRoute } from '../types'

interface BusMarkerProps {
  route: ShuttleRoute
  bus: BusState
}

// A UIU-orange, logo-stamped bus that glides between position updates and points
// in its heading direction. Live buses are solid + pulsing; estimated buses are
// hollow/dashed. The icon is memoised on `source` only so the marker DOM element
// is reused across ticks — that's what lets the CSS transform-transition glide.
function busIconHtml(source: BusState['source']): string {
  return `
    <div class="bus-badge bus-badge--${source}">
      <img class="bus-logo" src="${logoUrl}" alt="" draggable="false" />
      <span class="bus-arrow-rot"><span class="bus-arrow"></span></span>
    </div>
  `
}

export function BusMarker({ route, bus }: BusMarkerProps) {
  const markerRef = useRef<L.Marker>(null)

  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'bus-glide',
        html: busIconHtml(bus.source),
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      }),
    [bus.source],
  )

  // Rotate the arrow imperatively so the icon itself never has to be recreated.
  useEffect(() => {
    const el = markerRef.current?.getElement()
    const rot = el?.querySelector<HTMLElement>('.bus-arrow-rot')
    if (rot) rot.style.transform = `rotate(${bus.headingDeg}deg)`
  }, [bus.headingDeg, bus.source])

  return (
    <Marker ref={markerRef} position={[bus.lat, bus.lng]} icon={icon} zIndexOffset={1000}>
      <Popup>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{route.name}</div>
        <div style={{ fontSize: 12, color: '#666' }}>
          {bus.source === 'live'
            ? `Live${bus.updatedAt ? ` · updated ${relativeTime(bus.updatedAt)}` : ''}`
            : 'Estimated from schedule'}
        </div>
      </Popup>
    </Marker>
  )
}
