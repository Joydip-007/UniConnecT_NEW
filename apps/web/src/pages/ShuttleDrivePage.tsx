import { useState } from 'react'
import { MinimalPageFooter } from '@/components/MinimalPageFooter'
import { useQuery } from '@tanstack/react-query'
import { Bus, LogOut, MapPin, Radio } from 'lucide-react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { useDriverBroadcast } from '@/features/shuttle/hooks/useDriverBroadcast'
import type { ShuttleRoute } from '@/features/shuttle'

const STATUS_COPY: Record<string, { label: string; color: string }> = {
  idle: { label: 'Not broadcasting', color: 'var(--text-tertiary)' },
  locating: { label: 'Getting your location…', color: 'var(--uc-indigo)' },
  broadcasting: { label: 'Broadcasting live', color: 'var(--uc-orange-l)' },
  denied: { label: 'Location permission denied', color: 'var(--uc-red)' },
  error: { label: 'Something went wrong', color: 'var(--uc-red)' },
}

export default function ShuttleDrivePage() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [active, setActive] = useState(false)

  const { data: routes = [] } = useQuery<ShuttleRoute[]>({
    queryKey: ['shuttle', 'routes'],
    queryFn: () => api.get<{ data: ShuttleRoute[] }>('/shuttle/routes').then((r) => r.data.data),
  })

  const { status, lastFix } = useDriverBroadcast(selectedRouteId, active)
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null
  const statusInfo = STATUS_COPY[status] ?? STATUS_COPY.idle

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-page)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bus size={20} strokeWidth={1.5} color="var(--uc-orange)" />
            <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Driver mode</span>
          </div>
          <button
            type="button"
            onClick={() => clearAuth()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} strokeWidth={1.5} /> Sign out
          </button>
        </div>

        {user && (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            Signed in as {user.profile?.fullName ?? user.email}
          </p>
        )}

        {/* Route picker */}
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Select your route</span>
          {routes.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>No routes available.</p>
          )}
          {routes.map((route) => {
            const selected = route.id === selectedRouteId
            return (
              <button
                key={route.id}
                type="button"
                disabled={active}
                onClick={() => setSelectedRouteId(route.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  fontSize: 14,
                  fontWeight: selected ? 500 : 400,
                  textAlign: 'left',
                  color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: selected ? 'var(--uc-orange-bg)' : 'var(--surface-raised)',
                  border: `0.5px solid ${selected ? 'var(--uc-orange-bdr)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--r-md)',
                  cursor: active ? 'not-allowed' : 'pointer',
                  opacity: active && !selected ? 0.5 : 1,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: route.color, flexShrink: 0 }} />
                {route.name}
              </button>
            )
          })}
        </div>

        {/* Status */}
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={15} strokeWidth={1.5} color={statusInfo.color} />
            <span style={{ fontSize: 14, fontWeight: 500, color: statusInfo.color }}>{statusInfo.label}</span>
          </div>
          {lastFix && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
              <MapPin size={12} strokeWidth={1.5} />
              {lastFix.lat.toFixed(5)}, {lastFix.lng.toFixed(5)}
            </div>
          )}
        </div>

        {/* Start / Stop */}
        {!active ? (
          <button
            type="button"
            disabled={!selectedRouteId}
            onClick={() => setActive(true)}
            style={{
              padding: '15px',
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--on-accent)',
              background: selectedRouteId ? 'var(--uc-orange)' : 'var(--surface-raised)',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              cursor: selectedRouteId ? 'pointer' : 'not-allowed',
            }}
          >
            Start broadcast{selectedRoute ? ` · ${selectedRoute.name}` : ''}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setActive(false)}
            style={{
              padding: '15px',
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text-primary)',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              cursor: 'pointer',
            }}
          >
            Stop broadcast
          </button>
        )}

        <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          Keep this screen open while driving. Your location is shared with students only while broadcasting.
        </p>
      </div>
      </div>
      <MinimalPageFooter />
    </div>
  )
}
