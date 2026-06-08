import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import busUrl from '@/assets/shuttle_bus.svg'
import { relativeTime } from '../utils'
import type { BusState, ShuttleRoute } from '../types'

interface BusMarkerProps {
  route: ShuttleRoute
  bus: BusState
}

// Display dimensions for the active bus SVG (portrait 1:2 ratio).
const BUS_W = 24
const BUS_H = 48
// Container must be large enough so the icon never clips at any rotation angle.
const BOX = Math.ceil(Math.sqrt(BUS_W ** 2 + BUS_H ** 2)) + 6 // 60

function busIconHtml(source: BusState['source']): string {
  const dimmed = source === 'estimated' ? 'opacity:0.7;filter:grayscale(25%);' : ''
  return `
    <div style="width:${BOX}px;height:${BOX}px;position:relative;display:flex;align-items:center;justify-content:center;">
      ${source === 'live' ? '<div class="bus-pulse-ring"></div>' : ''}
      <img class="bus-svg-rot"
           src="${busUrl}"
           style="width:${BUS_W}px;height:${BUS_H}px;position:absolute;${dimmed}"
           alt="" draggable="false" />
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
        iconSize: [BOX, BOX],
        iconAnchor: [BOX / 2, BOX / 2],
        popupAnchor: [0, -(BOX / 2 + 4)],
      }),
    [bus.source],
  )

  // Rotate the bus SVG imperatively — avoids recreating the icon on every tick.
  useEffect(() => {
    const el = markerRef.current?.getElement()
    const img = el?.querySelector<HTMLElement>('.bus-svg-rot')
    if (img) img.style.transform = `rotate(${bus.headingDeg}deg)`
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
