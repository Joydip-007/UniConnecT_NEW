import { Fragment, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Plus, Trash2, X, MapPin } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { useRouteGeometry } from '@/features/shuttle/hooks/useRouteGeometry'
import { ServiceNoticesPanel } from '@/features/shuttle/components/admin/ServiceNoticesPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShuttleStop {
  id: string
  name: string
  orderIndex: number
  lat: number
  lng: number
}

interface ShuttleSchedule {
  type?: 'fixed' | 'continuous'
  departures?: { outbound?: string[]; inbound?: string[] }
  operatingHours?: { start?: string; end?: string }
}

interface ShuttleRoute {
  id: string
  name: string
  color: string
  isActive: boolean
  stops: ShuttleStop[]
  schedule?: ShuttleSchedule
  estDurationMin?: number | null
  cycleMinutes?: number | null
}

interface StopDraft {
  id: string
  name: string
  lat: string
  lng: string
}

interface EditorState {
  routeId: string | null
  name: string
  color: string
  isActive: boolean
  scheduleType: 'fixed' | 'continuous'
  outboundTimes: string
  inboundTimes: string
  opStart: string
  opEnd: string
  estDurationMin: string
  cycleMinutes: string
  stops: StopDraft[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function blankEditor(): EditorState {
  return {
    routeId: null,
    name: '',
    color: 'var(--uc-indigo)',
    isActive: true,
    scheduleType: 'fixed',
    outboundTimes: '',
    inboundTimes: '',
    opStart: '07:30',
    opEnd: '17:00',
    estDurationMin: '',
    cycleMinutes: '',
    stops: [],
  }
}

function routeToEditor(r: ShuttleRoute): EditorState {
  const schedule = r.schedule ?? {}
  const isFixed = schedule.type !== 'continuous'
  const stops = [...(r.stops ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)
  return {
    routeId: r.id,
    name: r.name,
    color: r.color,
    isActive: r.isActive,
    scheduleType: isFixed ? 'fixed' : 'continuous',
    outboundTimes: (schedule.departures?.outbound ?? []).join('\n'),
    inboundTimes: (schedule.departures?.inbound ?? []).join('\n'),
    opStart: schedule.operatingHours?.start ?? '07:30',
    opEnd: schedule.operatingHours?.end ?? '17:00',
    estDurationMin: r.estDurationMin != null ? String(r.estDurationMin) : '',
    cycleMinutes: r.cycleMinutes != null ? String(r.cycleMinutes) : '',
    stops: stops.map((s) => ({ id: s.id, name: s.name, lat: String(s.lat), lng: String(s.lng) })),
  }
}

function parseTimeLines(text: string): string[] {
  return text
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
}

function editorToPayload(e: EditorState) {
  const stops = e.stops
    .filter((s) => s.name.trim() && s.lat.trim() && s.lng.trim())
    .map((s, i) => ({
      id: s.id,
      name: s.name.trim(),
      orderIndex: i,
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lng),
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))

  const schedule: ShuttleSchedule =
    e.scheduleType === 'fixed'
      ? { type: 'fixed', departures: { outbound: parseTimeLines(e.outboundTimes), inbound: parseTimeLines(e.inboundTimes) } }
      : { type: 'continuous', operatingHours: { start: e.opStart, end: e.opEnd } }

  return {
    name: e.name.trim(),
    color: e.color,
    is_active: e.isActive,
    stops,
    schedule,
    est_duration_min: e.scheduleType === 'fixed' && e.estDurationMin ? parseInt(e.estDurationMin, 10) : null,
    cycle_minutes: e.scheduleType === 'continuous' && e.cycleMinutes ? parseInt(e.cycleMinutes, 10) : null,
  }
}

function editorValid(e: EditorState): boolean {
  if (!e.name.trim()) return false
  if (!/^#[0-9a-fA-F]{6}$/.test(e.color)) return false
  const validStops = e.stops.filter(
    (s) => s.name.trim() && Number.isFinite(parseFloat(s.lat)) && Number.isFinite(parseFloat(s.lng)),
  )
  if (validStops.length < 2) return false
  return true
}

function mapStops(stops: StopDraft[]): { lat: number; lng: number; name: string; id: string }[] {
  return stops
    .filter((s) => s.name.trim() && Number.isFinite(parseFloat(s.lat)) && Number.isFinite(parseFloat(s.lng)))
    .map((s) => ({ id: s.id, name: s.name, lat: parseFloat(s.lat), lng: parseFloat(s.lng) }))
}

// ── Map preview ───────────────────────────────────────────────────────────────

function FitPreview({ points }: { points: [number, number][] }) {
  const map = useMap()
  const prev = useRef<string>('')
  // Reset prev on unmount so Strict Mode's simulated remount doesn't skip fitBounds
  useEffect(() => () => { prev.current = '' }, [])
  useEffect(() => {
    const key = JSON.stringify(points)
    if (key === prev.current || points.length < 1) return
    prev.current = key
    if (points.length === 1) {
      map.setView(points[0], 14)
    } else {
      map.fitBounds(L.latLngBounds(points as L.LatLngExpression[]).pad(0.25))
    }
  }, [points, map])
  return null
}

const DHAKA: [number, number] = [23.8103, 90.4125]

function RouteMapPreview({ stops, color }: { stops: StopDraft[]; color: string }) {
  const valid = mapStops(stops)
  const stopKey = valid.map((s) => `${s.lat},${s.lng}`).join('|')

  // Debounce the OSRM fetch so it doesn't fire on every keystroke
  const [debouncedStops, setDebouncedStops] = useState(valid)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedStops(mapStops(stops)), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopKey])

  const { data: routedPositions } = useRouteGeometry(debouncedStops)
  const straightPositions = valid.map((s) => [s.lat, s.lng] as [number, number])
  // Use road-following geometry when available, straight lines while loading
  const positions: [number, number][] = routedPositions ?? straightPositions

  return (
    <MapContainer center={DHAKA} zoom={13} scrollWheelZoom={false} style={{ height: 280, width: '100%', borderRadius: 'var(--r-md)' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={`https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
        tileSize={512}
        zoomOffset={-1}
      />
      <FitPreview points={straightPositions} />
      {positions.length >= 2 && (
        <Polyline positions={positions} pathOptions={{ color, weight: 4, opacity: 0.85 }} />
      )}
      {valid.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          radius={5}
          pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 1 }}
        >
          <Tooltip>{s.name}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}

// ── Location picker modal ─────────────────────────────────────────────────────

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function InvalidateSizeOnMount() {
  const map = useMap()
  useEffect(() => { map.invalidateSize() }, [map])
  return null
}

function LocationPickerModal({
  initial,
  onConfirm,
  onClose,
}: {
  initial?: { lat: number; lng: number }
  onConfirm: (lat: number, lng: number) => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(initial ?? null)
  const [satellite, setSatellite] = useState(false)
  const center: [number, number] = picked
    ? [picked.lat, picked.lng]
    : initial
      ? [initial.lat, initial.lng]
      : DHAKA
  const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string
  const tileUrl = satellite
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${TOKEN}`
    : `https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/{z}/{x}/{y}?access_token=${TOKEN}`

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        width: 560, maxWidth: '95vw',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '0.5px solid var(--border-default)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Pick stop location
          </span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Hint + tile toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 4px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Click anywhere on the map to place the stop marker
          </span>
          <button
            type="button"
            onClick={() => setSatellite((s) => !s)}
            style={{
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: '3px 10px',
              fontSize: 12, fontWeight: 500,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            {satellite ? 'Street view' : 'Satellite view'}
          </button>
        </div>

        {/* Map */}
        <div style={{ position: 'relative' }}>
          <style>{`.leaflet-picker .leaflet-container { cursor: crosshair !important; }`}</style>
          <div className="leaflet-picker">
            <MapContainer
              center={center}
              zoom={picked ? 16 : 14}
              scrollWheelZoom
              style={{ height: 360, width: '100%' }}
            >
              <TileLayer
                key={String(satellite)}
                attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url={tileUrl}
                tileSize={512}
                zoomOffset={-1}
              />
              <InvalidateSizeOnMount />
              <MapClickHandler onPick={(lat, lng) => setPicked({ lat, lng })} />
              {picked && (
                <CircleMarker
                  center={[picked.lat, picked.lng]}
                  radius={9}
                  pathOptions={{ color: 'var(--uc-orange)', fillColor: 'var(--uc-orange)', fillOpacity: 1, weight: 2 }}
                >
                  <Tooltip permanent direction="top" offset={[0, -12]}>
                    {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
                  </Tooltip>
                </CircleMarker>
              )}
            </MapContainer>
          </div>
        </div>

        {/* Coordinate readout */}
        <div style={{
          padding: '9px 18px',
          fontSize: 12, fontFamily: 'monospace',
          color: picked ? 'var(--text-primary)' : 'var(--text-tertiary)',
          background: 'var(--surface-raised)',
          borderTop: '0.5px solid var(--border-default)',
        }}>
          {picked ? `${picked.lat.toFixed(6)},  ${picked.lng.toFixed(6)}` : 'No location selected — click the map'}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: '0.5px solid var(--border-default)' }}>
          <PrimaryBtn disabled={!picked} onClick={() => picked && onConfirm(picked.lat, picked.lng)}>
            Use this location
          </PrimaryBtn>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        </div>
      </div>
    </div>
  )
}

// ── Shared input style ────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box' as const,
  outline: 'none',
}

// ── Route editor ──────────────────────────────────────────────────────────────

interface RouteEditorProps {
  initial: EditorState
  onSaved: () => void
  onCancel: () => void
}

/**
 * The editor is four separate jobs — identity, timetable, geography, and a check of the
 * result — that used to run together as one undivided stack of fields. A heading and a
 * rule per group is the whole fix: nothing moves, but the eye gets somewhere to rest.
 */
function EditorSection({ title, first, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <section style={{
      paddingTop: first ? 0 : 16,
      borderTop: first ? undefined : '0.5px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</h3>
      {children}
    </section>
  )
}

function RouteEditor({ initial, onSaved, onCancel }: RouteEditorProps) {
  const qc = useQueryClient()
  const [e, setE] = useState<EditorState>(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pickingStopIdx, setPickingStopIdx] = useState<number | null>(null)

  // Keep editor in sync when a different route is selected
  useEffect(() => { setE(initial); setConfirmDelete(false); setSaveError(null); setDeleteError(null); setPickingStopIdx(null) }, [initial])

  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) =>
    setE((prev) => ({ ...prev, [key]: value }))

  const saveMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof editorToPayload>) =>
      e.routeId
        ? api.patch(`/shuttle/routes/${e.routeId}`, payload)
        : api.post('/shuttle/routes', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'shuttle', 'routes'] })
      onSaved()
    },
    onError: () => setSaveError('Failed to save. Please try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/shuttle/routes/${e.routeId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'shuttle', 'routes'] })
      onSaved()
    },
    onError: () => setDeleteError('Failed to delete. Please try again.'),
  })

  function addStop() {
    setE((prev) => ({
      ...prev,
      stops: [...prev.stops, { id: crypto.randomUUID(), name: '', lat: '', lng: '' }],
    }))
  }

  function updateStop(idx: number, field: keyof StopDraft, value: string) {
    setE((prev) => {
      const stops = [...prev.stops]
      stops[idx] = { ...stops[idx], [field]: value }
      return { ...prev, stops }
    })
  }

  function removeStop(idx: number) {
    setE((prev) => ({ ...prev, stops: prev.stops.filter((_, i) => i !== idx) }))
  }

  const valid = editorValid(e)
  const isNew = e.routeId === null

  const labelSt: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em', marginBottom: 4 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <EditorSection title="Route" first>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '3 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={labelSt}>Route name</div>
          <input
            style={inputSt}
            placeholder="e.g. Notun Bazar ↔ UIU"
            value={e.name}
            onChange={(ev) => set('name', ev.target.value)}
          />
        </div>

        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={labelSt}>Color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              aria-label="Route color picker"
              value={e.color}
              onChange={(ev) => set('color', ev.target.value)}
              style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
            <input
              style={{ ...inputSt, width: 90, fontFamily: 'monospace' }}
              aria-label="Route color hex value"
              value={e.color}
              onChange={(ev) => set('color', ev.target.value)}
              maxLength={7}
            />
          </div>
        </div>

        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={labelSt}>Active</div>
          <button
            type="button"
            onClick={() => set('isActive', !e.isActive)}
            role="switch"
            aria-checked={e.isActive}
            aria-label="Route active"
            style={{
              width: 44,
              height: 24,
              borderRadius: 'var(--r-pill)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              background: e.isActive ? 'var(--uc-indigo)' : 'var(--surface-raised)',
              transition: 'background 200ms',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 2,
              left: e.isActive ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--on-accent)',
              transition: 'left 200ms',
            }} />
          </button>
        </div>
      </div>

      </EditorSection>

      <EditorSection title="Schedule">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={labelSt}>Schedule type</div>
            <select
              value={e.scheduleType}
              aria-label="Schedule type"
              onChange={(ev) => set('scheduleType', ev.target.value as 'fixed' | 'continuous')}
              style={{ ...inputSt, width: 'auto', cursor: 'pointer' }}
            >
              <option value="fixed">Fixed departures</option>
              <option value="continuous">Continuous (loop)</option>
            </select>
          </div>

          {e.scheduleType === 'fixed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={labelSt}>Est. duration (min)</div>
              <input
                style={{ ...inputSt, width: 120 }}
                type="number"
                min={1}
                placeholder="e.g. 35"
                value={e.estDurationMin}
                onChange={(ev) => set('estDurationMin', ev.target.value)}
              />
            </div>
          )}

          {e.scheduleType === 'continuous' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={labelSt}>Cycle (min)</div>
                <input
                  style={{ ...inputSt, width: 100 }}
                  type="number"
                  min={1}
                  placeholder="e.g. 50"
                  value={e.cycleMinutes}
                  onChange={(ev) => set('cycleMinutes', ev.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={labelSt}>Start</div>
                <input style={{ ...inputSt, width: 100 }} type="time" aria-label="Operating start time" value={e.opStart} onChange={(ev) => set('opStart', ev.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={labelSt}>End</div>
                <input style={{ ...inputSt, width: 100 }} type="time" aria-label="Operating end time" value={e.opEnd} onChange={(ev) => set('opEnd', ev.target.value)} />
              </div>
            </>
          )}
        </div>

        {e.scheduleType === 'fixed' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={labelSt}>Outbound departures (one HH:MM per line)</div>
              <textarea
                style={{ ...inputSt, resize: 'vertical', minHeight: 90, lineHeight: 1.6 }}
                placeholder={'07:30\n09:25\n10:45'}
                value={e.outboundTimes}
                onChange={(ev) => set('outboundTimes', ev.target.value)}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={labelSt}>Inbound departures (one HH:MM per line)</div>
              <textarea
                style={{ ...inputSt, resize: 'vertical', minHeight: 90, lineHeight: 1.6 }}
                placeholder={'10:05\n11:25\n12:45'}
                value={e.inboundTimes}
                onChange={(ev) => set('inboundTimes', ev.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      </EditorSection>

      <EditorSection title={`Stops (${e.stops.length})`}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8 }}>
          <button
            type="button"
            onClick={addStop}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--uc-indigo-bg)',
              border: '0.5px solid var(--uc-indigo-bdr)',
              borderRadius: 'var(--r-pill)',
              padding: '4px 12px',
              fontSize: 12,
              color: 'var(--uc-indigo-xl)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Plus size={12} /> Add stop
          </button>
        </div>

        {e.stops.length === 0 ? (
          <div style={{
            padding: '24px 0',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--text-tertiary)',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-md)',
            border: '0.5px solid var(--border-default)',
          }}>
            No stops yet — add at least 2 to draw the route
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Header row */}
            {/* Hidden on narrow screens, where the row stacks and each field is
                identifiable by its own placeholder instead. */}
            <div className="shuttle-stop-row shuttle-stop-head" style={{ padding: '0 4px' }}>
              <div style={{ ...labelSt, marginBottom: 0, gridArea: 'num' }}>#</div>
              <div style={{ ...labelSt, marginBottom: 0, gridArea: 'name' }}>Stop name</div>
              <div style={{ ...labelSt, marginBottom: 0, gridArea: 'lat' }}>Latitude</div>
              <div style={{ ...labelSt, marginBottom: 0, gridArea: 'lng' }}>Longitude</div>
            </div>

            {e.stops.map((stop, idx) => (
              <div key={stop.id} className="shuttle-stop-row">
                <span style={{ gridArea: 'num', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>{idx + 1}</span>
                <input
                  style={{ ...inputSt, gridArea: 'name' }}
                  placeholder="Stop name"
                  aria-label={`Stop ${idx + 1} name`}
                  value={stop.name}
                  onChange={(ev) => updateStop(idx, 'name', ev.target.value)}
                />
                <input
                  style={{ ...inputSt, gridArea: 'lat', fontFamily: 'monospace' }}
                  placeholder="Latitude"
                  aria-label={`Stop ${idx + 1} latitude`}
                  value={stop.lat}
                  onChange={(ev) => updateStop(idx, 'lat', ev.target.value)}
                />
                <input
                  style={{ ...inputSt, gridArea: 'lng', fontFamily: 'monospace' }}
                  placeholder="Longitude"
                  aria-label={`Stop ${idx + 1} longitude`}
                  value={stop.lng}
                  onChange={(ev) => updateStop(idx, 'lng', ev.target.value)}
                />
                <button
                  type="button"
                  title="Pick on map"
                  aria-label="Pick on map"
                  onClick={() => setPickingStopIdx(idx)}
                  style={{
                    gridArea: 'pin',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--uc-indigo-xl)',
                  }}
                >
                  <MapPin size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeStop(idx)}
                  aria-label="Remove stop"
                  style={{
                    gridArea: 'del',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!valid && e.stops.length > 0 && e.stops.length < 2 && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--uc-orange-l)' }}>
            At least 2 valid stops are required.
          </p>
        )}
      </div>
      </EditorSection>

      {mapStops(e.stops).length >= 1 && (
        <EditorSection title="Route preview">
          <RouteMapPreview stops={e.stops} color={e.color} />
        </EditorSection>
      )}

      {/* Footer actions — pinned below the last section's rule so Save is always the
          last thing read, whether or not the preview rendered. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, borderTop: '0.5px solid var(--border-default)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PrimaryBtn
            disabled={!valid || saveMutation.isPending}
            onClick={() => { setSaveError(null); saveMutation.mutate(editorToPayload(e)) }}
          >
            {saveMutation.isPending ? 'Saving…' : isNew ? 'Create route' : 'Save changes'}
          </PrimaryBtn>
          <GhostBtn onClick={onCancel}>Cancel</GhostBtn>

          {!isNew && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: '0.5px solid var(--uc-red-bdr)',
                borderRadius: 'var(--r-pill)',
                padding: '7px 14px',
                fontSize: 13,
                color: 'var(--uc-red)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Trash2 size={13} /> Delete route
            </button>
          )}
        </div>

        {!isNew && confirmDelete && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--uc-red-bg)',
            border: '0.5px solid var(--uc-red-bdr)',
            borderRadius: 'var(--r-md)',
            padding: '10px 14px',
          }}>
            <span style={{ fontSize: 13, color: 'var(--uc-red)', flex: 1 }}>
              Delete this route? This cannot be undone.
            </span>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => { setDeleteError(null); deleteMutation.mutate() }}
              style={{
                background: 'var(--uc-red-bg)',
                border: '0.5px solid var(--uc-red-bdr)',
                borderRadius: 'var(--r-pill)',
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--uc-red)',
                cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
            </button>
            <GhostBtn onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, padding: '5px 12px' }}>
              Cancel
            </GhostBtn>
          </div>
        )}

        {saveError && <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{saveError}</span>}
        {deleteError && <span style={{ fontSize: 12, color: 'var(--uc-red)' }}>{deleteError}</span>}
      </div>

      {pickingStopIdx !== null && (
        <LocationPickerModal
          initial={(() => {
            const s = e.stops[pickingStopIdx]
            const lat = parseFloat(s?.lat ?? '')
            const lng = parseFloat(s?.lng ?? '')
            return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined
          })()}
          onConfirm={(lat, lng) => {
            updateStop(pickingStopIdx, 'lat', lat.toFixed(6))
            updateStop(pickingStopIdx, 'lng', lng.toFixed(6))
            setPickingStopIdx(null)
          }}
          onClose={() => setPickingStopIdx(null)}
        />
      )}
    </div>
  )
}

// ── ShuttleTab ────────────────────────────────────────────────────────────────

interface ShuttleStats {
  busesLive: number
  activeRoutes: number
  onDutyDrivers: number
  onTimeRatePct: number | null
  routes: { routeId: string; isLive: boolean }[]
}

interface ShuttleOpsSettings {
  liveGpsEnabled: boolean
  riderEtaEnabled: boolean
  autoAssignEnabled: boolean
  serviceAlertsEnabled: boolean
}

export function ShuttleTab() {
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null)

  const { data: routes = [], isLoading } = useQuery<ShuttleRoute[]>({
    queryKey: ['admin', 'shuttle', 'routes'],
    queryFn: () =>
      api.get<{ data: ShuttleRoute[] }>('/shuttle/routes?includeInactive=true').then((r) => r.data.data),
  })

  const { data: stats } = useQuery<ShuttleStats>({
    queryKey: ['admin', 'shuttle', 'stats'],
    queryFn: () => api.get<{ data: ShuttleStats }>('/admin/shuttle/stats').then((r) => r.data.data),
    refetchInterval: 30_000,
  })

  const liveRouteIds = new Set((stats?.routes ?? []).filter((r) => r.isLive).map((r) => r.routeId))

  const qc = useQueryClient()

  const { data: settings } = useQuery<ShuttleOpsSettings>({
    queryKey: ['admin', 'shuttle', 'settings'],
    queryFn: () => api.get<{ data: ShuttleOpsSettings }>('/admin/shuttle/settings').then((r) => r.data.data),
  })

  const settingsMutation = useMutation({
    mutationFn: (patch: Partial<ShuttleOpsSettings>) => api.patch('/admin/shuttle/settings', patch),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'shuttle', 'settings'] }) },
  })

  function selectRoute(id: string) {
    setSelectedId(id)
  }

  function openNew() {
    setSelectedId('new')
  }

  function closeEditor() {
    setSelectedId(null)
  }

  const selectedRoute = selectedId && selectedId !== 'new' ? routes.find((r) => r.id === selectedId) ?? null : null
  const editorInitial =
    selectedId === 'new'
      ? blankEditor()
      : selectedRoute
        ? routeToEditor(selectedRoute)
        : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <ShuttleStatTile label="Buses live" value={stats ? String(stats.busesLive) : '—'} sub="broadcasting now" />
        <ShuttleStatTile label="Active routes" value={stats ? String(stats.activeRoutes) : '—'} sub="in service today" />
        <ShuttleStatTile label="On-duty drivers" value={stats ? String(stats.onDutyDrivers) : '—'} sub="across all routes" />
        <ShuttleStatTile
          label="On-time rate"
          value={stats ? (stats.onTimeRatePct === null ? '—' : `${stats.onTimeRatePct}%`) : '—'}
          sub={stats?.onTimeRatePct === null ? 'Not enough data yet' : 'today so far'}
        />
      </div>

      {/* The editor is a dialog, not a neighbour. Beside a 268px list it had roughly
          330px to render a two-column timetable, a four-column stop table and a map —
          the stop-name field collapsed to about 20px, narrower than the word it held.
          Given the full width of a dialog every group fits at its intended size, and
          the list underneath stays readable as a list. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        width: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <button
          type="button"
          onClick={openNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            width: '100%',
            padding: '9px 0',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--uc-indigo-xl)',
            background: 'var(--uc-indigo-bg)',
            border: '0.5px solid var(--uc-indigo-bdr)',
            borderRadius: 'var(--r-pill)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={14} /> New route
        </button>

        {isLoading ? (
          <RouteListSkeleton />
        ) : routes.length === 0 ? (
          <div style={{
            padding: '32px 0',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--text-tertiary)',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
          }}>
            No routes yet
          </div>
        ) : (
          routes.map((r) => {
            const active = selectedId === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRoute(r.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  background: active ? 'var(--uc-indigo-bg)' : 'var(--surface-card)',
                  border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 150ms, border-color 150ms',
                }}
              >
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: r.color,
                  flexShrink: 0,
                  opacity: r.isActive ? 1 : 0.4,
                }} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    color: active ? 'var(--uc-indigo-xl)' : r.isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {r.name}
                  </span>
                  {/* Full width gives the row room for what it is, not just what it is
                      called — the cramped 268px column could only ever hold the name. */}
                  <span style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {routeSummary(r)}
                  </span>
                </span>
                {!r.isActive && (
                  <span style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-tertiary)',
                    background: 'var(--surface-raised)',
                    borderRadius: 'var(--r-pill)',
                    padding: '2px 7px',
                    flexShrink: 0,
                  }}>
                    off
                  </span>
                )}
                {r.isActive && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 'var(--r-pill)',
                    padding: '2px 8px',
                    flexShrink: 0,
                    color: liveRouteIds.has(r.id) ? 'var(--uc-mint)' : 'var(--text-tertiary)',
                    background: liveRouteIds.has(r.id) ? 'var(--uc-mint-bg)' : 'var(--surface-raised)',
                    border: `0.5px solid ${liveRouteIds.has(r.id) ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
                  }}>
                    {liveRouteIds.has(r.id) ? 'Live' : 'Idle'}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      </div>

      <Modal
        isOpen={editorInitial !== null}
        onClose={closeEditor}
        title={selectedId === 'new' ? 'New route' : editorInitial?.name || 'Edit route'}
        maxWidth={720}
      >
        {editorInitial && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {selectedId === 'new'
                ? 'Fill in the details and add at least 2 stops to create the route.'
                : 'Edit the route details, stops, and schedule below.'}
            </p>
            <RouteEditor
              key={selectedId}
              initial={editorInitial}
              onSaved={closeEditor}
              onCancel={closeEditor}
            />
          </div>
        )}
      </Modal>

      <div style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '20px 24px',
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Ops settings</p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <OpsSettingToggle
            label="Live GPS broadcast"
            description="Drivers share location while on duty"
            checked={settings?.liveGpsEnabled ?? true}
            onChange={(v) => settingsMutation.mutate({ liveGpsEnabled: v })}
          />
          <OpsSettingToggle
            label="Show rider ETA"
            description="Estimate arrival times on the rider map"
            checked={settings?.riderEtaEnabled ?? true}
            onChange={(v) => settingsMutation.mutate({ riderEtaEnabled: v })}
          />
          {/* Auto-assign drivers: persisted preference only — there is no driver-to-route
              assignment feature in the schema today. Flipping this has no runtime effect. */}
          <OpsSettingToggle
            label="Auto-assign drivers"
            description="Match on-duty drivers to open routes"
            checked={settings?.autoAssignEnabled ?? false}
            onChange={(v) => settingsMutation.mutate({ autoAssignEnabled: v })}
          />
          {/* Service alerts: persisted preference only — there is no delay/route-change
              notification pipeline in the codebase today. Flipping this has no runtime effect. */}
          <OpsSettingToggle
            label="Service alerts"
            description="Notify riders of delays and route changes"
            checked={settings?.serviceAlertsEnabled ?? true}
            onChange={(v) => settingsMutation.mutate({ serviceAlertsEnabled: v })}
            last
          />
        </div>
      </div>

      <ServiceNoticesPanel />
    </div>
  )
}

function OpsSettingToggle({
  label,
  description,
  checked,
  onChange,
  last,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  last?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '14px 0',
      borderBottom: last ? 'none' : '0.5px solid var(--border-default)',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0,
          width: 36,
          height: 20,
          borderRadius: 'var(--r-pill)',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          background: checked ? 'var(--uc-indigo)' : 'var(--surface-raised)',
          transition: 'background 150ms',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--on-accent)',
          transition: 'left 150ms',
        }} />
      </button>
    </div>
  )
}

function ShuttleStatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: '16px 18px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

/**
 * The one-line summary under a route's name. Every part is optional because the shape
 * genuinely varies — a continuous route has a cycle rather than a run time, and a route
 * mid-setup may have neither — so the line is assembled from what exists rather than
 * printing a dash for what does not. Stop count always lands, since a route without
 * stops cannot be saved.
 */
function routeSummary(r: ShuttleRoute): string {
  const parts: string[] = []
  if (r.schedule?.type === 'continuous' && r.cycleMinutes) parts.push(`Every ${r.cycleMinutes} min`)
  else if (r.estDurationMin) parts.push(`${r.estDurationMin} min run`)

  const hours = r.schedule?.operatingHours
  if (hours?.start && hours.end) parts.push(`${hours.start}–${hours.end}`)

  const departures = (r.schedule?.departures?.outbound?.length ?? 0) + (r.schedule?.departures?.inbound?.length ?? 0)
  if (departures > 0) parts.push(`${departures} departures`)

  parts.push(`${r.stops.length} stop${r.stops.length === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

function RouteListSkeleton() {
  return (
    <Fragment>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 46,
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            opacity: 0.5,
          }}
        />
      ))}
    </Fragment>
  )
}
