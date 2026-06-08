import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { BusMarker } from './BusMarker'
import { bearingDeg } from '../lib/estimatePosition'
import { useRouteGeometry } from '../hooks/useRouteGeometry'
import type { BusState, ShuttleRoute, ShuttleStop } from '../types'
import logoUrl from '@/assets/logo.svg'

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

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

const TILE_LAYERS = {
  street: {
    url: `https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/{z}/{x}/{y}?access_token=${TOKEN}`,
    label: 'Satellite',
  },
  satellite: {
    url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${TOKEN}`,
    label: 'Street',
  },
} as const

type TileMode = keyof typeof TILE_LAYERS

// 9 small lat/lng offsets that fan idle buses across the depot like Uber's car cluster.
// Spacing ≈ 15–30 m at Dhaka's latitude — large enough to see individually at zoom 15+.
const FAN_OFFSETS: [number, number][] = [
  [0, 0],
  [0.0002, 0],
  [-0.0002, 0],
  [0, 0.0003],
  [0, -0.0003],
  [0.00015, 0.00022],
  [0.00015, -0.00022],
  [-0.00015, 0.00022],
  [-0.00015, -0.00022],
]

/**
 * Shows 9 idle bus icons at the UIU terminal (the stop whose name matches /uiu/i,
 * or the last stop as fallback). Each icon faces the outbound departure direction.
 */
function IdleBuses({ route }: { route: ShuttleRoute }) {
  const stops = geoStops(route)
  if (stops.length < 2) return null

  const terminalIdx = (() => {
    const i = stops.findIndex((s) => /uiu/i.test(s.name))
    return i >= 0 ? i : stops.length - 1
  })()
  const terminal = stops[terminalIdx]
  const neighbor = terminalIdx === stops.length - 1 ? stops[terminalIdx - 1] : stops[terminalIdx + 1]
  const heading = bearingDeg(terminal.lat, terminal.lng, neighbor.lat, neighbor.lng)

  const icon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `
          <div class="bus-badge bus-badge--idle">
            <img class="bus-logo bus-logo--idle" src="${logoUrl}" alt="" draggable="false" />
            <span class="bus-arrow-rot" style="transform:rotate(${heading}deg)">
              <span class="bus-arrow bus-arrow--idle"></span>
            </span>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    [heading],
  )

  return (
    <>
      {FAN_OFFSETS.map(([dLat, dLng], i) => (
        <Marker
          key={`idle-${route.id}-${i}`}
          position={[terminal.lat + dLat, terminal.lng + dLng]}
          icon={icon}
          zIndexOffset={500}
        />
      ))}
    </>
  )
}

interface RouteLayerProps {
  route: ShuttleRoute
  isFocused: boolean
  onSelect: (id: string) => void
  bus: BusState | undefined
  showBus: boolean
}

function RouteLayer({ route, isFocused, onSelect, bus, showBus }: RouteLayerProps) {
  const stops = geoStops(route)
  const reversedStops = [...stops].reverse()

  // Fetch road geometry for both directions — ORS respects one-way streets and
  // road dividers, so the return path may differ from the outbound path.
  const { data: outboundPositions } = useRouteGeometry(stops)
  const { data: inboundPositions } = useRouteGeometry(reversedStops)

  const dir = bus?.direction ?? 'outbound'
  const routedPositions = dir === 'outbound' ? outboundPositions : inboundPositions

  // Fall back to straight lines while the ORS response is loading
  const positions: [number, number][] = routedPositions ?? stops.map((s) => [s.lat, s.lng])

  if (positions.length < 2) return null

  return (
    <Fragment>
      <Polyline
        positions={positions}
        pathOptions={{
          color: route.color,
          weight: isFocused ? 5 : 3,
          opacity: isFocused ? 0.9 : 0.2,
        }}
        eventHandlers={{ click: () => onSelect(route.id) }}
      />
      <IdleBuses route={route} />
      {isFocused &&
        stops.map((stop) => (
          <CircleMarker
            key={stop.id}
            center={[stop.lat, stop.lng]}
            radius={4}
            pathOptions={{ color: route.color, fillColor: route.color, fillOpacity: 1, weight: 1 }}
          >
            <Tooltip>{stop.name}</Tooltip>
          </CircleMarker>
        ))}
      {showBus && bus && <BusMarker route={route} bus={bus} />}
    </Fragment>
  )
}

export function ShuttleMap({
  routes,
  busStates,
  selectedRouteId,
  focusMode,
  liveOnly,
  userLocation,
  onSelectRoute,
}: ShuttleMapProps) {
  const [tileMode, setTileMode] = useState<TileMode>('street')
  const tile = TILE_LAYERS[tileMode]

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Tile toggle */}
      <button
        type="button"
        onClick={() => setTileMode((m) => (m === 'street' ? 'satellite' : 'street'))}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-pill)',
          padding: '5px 12px',
          fontSize: 12, fontWeight: 500,
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        {tile.label} view
      </button>

      <MapContainer
        center={DHAKA}
        zoom={13}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', borderRadius: 'var(--r-lg)' }}
      >
        <TileLayer
          key={tileMode}
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={tile.url}
          tileSize={512}
          zoomOffset={-1}
        />
        <FitBounds routes={routes} />

        {routes.map((route) => {
          const isFocused = !focusMode || route.id === selectedRouteId
          const bus = busStates[route.id]
          const showBus = Boolean(bus && isFocused && (!liveOnly || bus.source === 'live'))
          return (
            <RouteLayer
              key={route.id}
              route={route}
              isFocused={isFocused}
              onSelect={onSelectRoute}
              bus={bus}
              showBus={showBus}
            />
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
        .bus-badge--idle {
          width: 26px; height: 26px;
          background: var(--surface-raised);
          border: 1.5px solid var(--uc-orange);
          opacity: 0.72;
        }
        .bus-logo--idle { width: 15px; height: 15px; }
        .bus-arrow--idle {
          transform: translate(-50%, -20px);
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 6px solid var(--uc-orange);
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
