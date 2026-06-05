import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { BusMarker } from './BusMarker'
import type { BusState, ShuttleRoute, ShuttleStop } from '../types'

interface ShuttleMapProps {
  routes: ShuttleRoute[]
  busStates: Record<string, BusState>
  selectedRouteId: string | null
  focusMode: boolean
  liveOnly: boolean
  userLocation: { lat: number; lng: number } | null
  onSelectRoute: (routeId: string) => void
}

function geoStops(route: ShuttleRoute): ShuttleStop[] {
  return [...route.stops]
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

function latLngs(route: ShuttleRoute): [number, number][] {
  return geoStops(route).map((s) => [s.lat, s.lng])
}

/** Fits the map to every stop across all routes, once, when data first arrives. */
function FitBounds({ routes }: { routes: ShuttleRoute[] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current) return
    const points = routes.flatMap(latLngs)
    if (points.length === 0) return
    map.fitBounds(L.latLngBounds(points as L.LatLngExpression[]).pad(0.2))
    fitted.current = true
  }, [routes, map])
  return null
}

const DHAKA: [number, number] = [23.8103, 90.4125]

export function ShuttleMap({
  routes,
  busStates,
  selectedRouteId,
  focusMode,
  liveOnly,
  userLocation,
  onSelectRoute,
}: ShuttleMapProps) {
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={DHAKA}
        zoom={13}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', borderRadius: 'var(--r-lg)' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds routes={routes} />

        {routes.map((route) => {
          const isFocused = !focusMode || route.id === selectedRouteId
          const positions = latLngs(route)
          if (positions.length < 2) return null
          const bus = busStates[route.id]
          const showBus = bus && isFocused && (!liveOnly || bus.source === 'live')

          return (
            <div key={route.id}>
              <Polyline
                positions={positions}
                pathOptions={{
                  color: route.color,
                  weight: isFocused ? 5 : 3,
                  opacity: isFocused ? 0.9 : 0.2,
                }}
                eventHandlers={{ click: () => onSelectRoute(route.id) }}
              />
              {isFocused &&
                geoStops(route).map((stop) => (
                  <CircleMarker
                    key={stop.id}
                    center={[stop.lat, stop.lng]}
                    radius={4}
                    pathOptions={{ color: route.color, fillColor: route.color, fillOpacity: 1, weight: 1 }}
                  >
                    <Tooltip>{stop.name}</Tooltip>
                  </CircleMarker>
                ))}
              {showBus && <BusMarker route={route} bus={bus} />}
            </div>
          )
        })}

        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={6}
            pathOptions={{ color: '#1769ff', fillColor: '#1769ff', fillOpacity: 0.9, weight: 2 }}
          >
            <Tooltip>You are here</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      <style>{`
        .bus-glide { transition: transform 1000ms linear; }
        .bus-badge {
          position: relative;
          width: 34px; height: 34px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .bus-badge--live { background: var(--uc-orange); }
        .bus-badge--estimated {
          background: var(--surface-card);
          border: 2px dashed var(--uc-orange);
        }
        .bus-badge--live::before {
          content: ''; position: absolute; inset: -5px;
          border-radius: 50%; border: 2px solid var(--uc-orange);
          opacity: 0.5; animation: busPulse 1.8s ease-out infinite;
        }
        @keyframes busPulse {
          0% { transform: scale(0.7); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .bus-logo { width: 20px; height: 20px; object-fit: contain; pointer-events: none; }
        .bus-arrow-rot { position: absolute; left: 50%; top: 50%; transform: rotate(0deg); }
        .bus-arrow {
          position: absolute; left: 0; top: 0;
          width: 0; height: 0;
          transform: translate(-50%, -26px);
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 8px solid var(--uc-orange);
        }
      `}</style>
    </div>
  )
}
