import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { BusMarker } from './BusMarker'
import { bearingDeg } from '../lib/estimatePosition'
import { useRouteGeometry } from '../hooks/useRouteGeometry'
import type { BusState, ShuttleRoute, ShuttleStop } from '../types'
import busUrl from '@/assets/shuttle_bus.svg'

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

// Idle bus SVG dimensions — smaller than the active bus to read as "parked".
const IDLE_W = 16
const IDLE_H = 32
const IDLE_BOX = Math.ceil(Math.sqrt(IDLE_W ** 2 + IDLE_H ** 2)) + 4 // 40

/**
 * Shows 9 idle bus icons at the stop whose name contains "UIU" (case-insensitive).
 * Renders nothing if no such stop exists on the route.
 */
function IdleBuses({ route }: { route: ShuttleRoute }) {
  const stops = geoStops(route)
  const terminalIdx = stops.findIndex((s) => /uiu/i.test(s.name))
  if (terminalIdx < 0 || stops.length < 2) return null

  const terminal = stops[terminalIdx]
  const neighbor = terminalIdx === stops.length - 1 ? stops[terminalIdx - 1] : stops[terminalIdx + 1]
  const heading = bearingDeg(terminal.lat, terminal.lng, neighbor.lat, neighbor.lng)

  const icon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `
          <div style="width:${IDLE_BOX}px;height:${IDLE_BOX}px;position:relative;display:flex;align-items:center;justify-content:center;">
            <img src="${busUrl}"
                 style="width:${IDLE_W}px;height:${IDLE_H}px;position:absolute;opacity:0.55;transform:rotate(${heading}deg);"
                 alt="" draggable="false" />
          </div>
        `,
        iconSize: [IDLE_BOX, IDLE_BOX],
        iconAnchor: [IDLE_BOX / 2, IDLE_BOX / 2],
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
      {!bus && <IdleBuses route={route} />}
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
        .bus-pulse-ring {
          position: absolute;
          width: 36px; height: 36px;
          border-radius: 50%;
          border: 2px solid var(--uc-orange);
          animation: busPulse 1.8s ease-out infinite;
          pointer-events: none;
        }
        @keyframes busPulse {
          0%   { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
