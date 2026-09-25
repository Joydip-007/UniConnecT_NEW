import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { NoticeRow } from '../rider/ShuttleRightRail'
import { useNoticeMutations, useShuttleNotices } from '../../hooks/useRiderStop'
import { routeNumberLabel } from '../../lib/schedule'
import type { ShuttleNotice, ShuttleRoute } from '../../types'

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 38,
  padding: '0 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
}

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)' }

/**
 * Diversions and timetable changes shown on every rider's shuttle rail and in the
 * driver's News tab. A notice with an end date drops off by itself once it passes.
 */
export function ServiceNoticesPanel() {
  const { data: notices = [] } = useShuttleNotices()
  const { data: routes = [] } = useQuery<ShuttleRoute[]>({
    queryKey: ['shuttle', 'routes'],
    queryFn: () => api.get<{ data: ShuttleRoute[] }>('/shuttle/routes').then((r) => r.data.data),
  })
  const { create, remove } = useNoticeMutations()

  const [tone, setTone] = useState<ShuttleNotice['tone']>('disruption')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [routeId, setRouteId] = useState('')
  const [until, setUntil] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    create.mutate(
      {
        tone,
        title: title.trim(),
        detail: detail.trim() || null,
        route_id: routeId || null,
        // End of the chosen day, local time.
        expires_at: until ? new Date(`${until}T23:59:59`).toISOString() : null,
      },
      {
        onSuccess: () => {
          setTitle('')
          setDetail('')
          setUntil('')
        },
      },
    )
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Service notices</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          Shown on the rider shuttle page and in the driver's News tab.
        </p>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Kind">
          {(
            [
              { v: 'disruption', label: 'Disruption' },
              { v: 'info', label: 'Timetable news' },
            ] as const
          ).map(({ v, label }) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={tone === v}
              onClick={() => setTone(v)}
              className="shuttle-pill"
              style={
                tone === v
                  ? v === 'disruption'
                    ? { background: 'var(--uc-amber-bg)', borderColor: 'var(--uc-amber-bdr)', color: 'var(--uc-amber-l)' }
                    : { background: 'var(--uc-indigo-bg)', borderColor: 'var(--uc-indigo-bdr)', color: 'var(--uc-indigo-xl)' }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Headline</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            placeholder="Route 2 diverted via Hatirjheel"
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Detail (optional)</span>
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={240}
            placeholder="Road works until 30 Sep"
            style={fieldStyle}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Route</span>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} style={fieldStyle}>
              <option value="">All routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {routeNumberLabel(routes, r.id)}, {r.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Show until (optional)</span>
            <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} style={fieldStyle} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <PrimaryBtn type="submit" disabled={!title.trim() || create.isPending}>
            Post notice
          </PrimaryBtn>
        </div>
      </form>

      {notices.length > 0 && (
        <div style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: 6 }}>
          {notices.map((n, i) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <NoticeRow notice={n} divider={i < notices.length - 1} />
              </div>
              <GhostBtn
                type="button"
                aria-label={`Remove ${n.title}`}
                onClick={() => remove.mutate(n.id)}
                disabled={remove.isPending}
              >
                <Trash2 size={13} />
              </GhostBtn>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
