import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Archive, Clock, MapPin, Pencil } from 'lucide-react'
import { PageRailCard, SkeletonLine } from '@/components/rightRail/primitives'
import { useAuthStore } from '@/stores/authStore'
import { blurBorder, focusBorder } from '../constants'
import { useLostFoundStats, useUpdateLostFoundDesk } from '../hooks/useLostFoundActions'
import type { LostFoundDesk } from '../types'

/**
 * The lost & found right rail: proof the board works (items reunited this month), where
 * things go missing, and the physical desk to walk to. An admin maintains the desk
 * details in place; for everyone else the card only appears once they exist.
 */
export function LostFoundRightRail() {
  const { data, isLoading } = useLostFoundStats()
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')

  if (isLoading || !data) {
    return (
      <PageRailCard title="Reunited this month">
        <SkeletonLine width="40%" height={24} />
        <SkeletonLine width="70%" />
      </PageRailCard>
    )
  }

  const topCount = data.hotspots[0]?.count ?? 0
  const pills = [
    data.resolvedPct !== null && `${data.resolvedPct}% resolved`,
    data.avgResolveDays !== null && `avg ${data.avgResolveDays} ${data.avgResolveDays === 1 ? 'day' : 'days'}`,
  ].filter((pill): pill is string => Boolean(pill))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageRailCard title="Reunited this month" gap={10}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--uc-mint)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {data.reunitedThisMonth}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {data.reunitedThisMonth === 1 ? 'item returned' : 'items returned'}
          </span>
        </div>
        {pills.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pills.map((pill) => (
              <span key={pill} style={{ padding: '3px 10px', borderRadius: 'var(--r-pill)', fontSize: 12, background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                {pill}
              </span>
            ))}
          </div>
        )}
      </PageRailCard>

      {data.hotspots.length > 0 && (
        <PageRailCard title="Where things go missing">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.hotspots.map((spot) => (
              <div key={spot.place} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spot.place}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{spot.count}</span>
                </div>
                <div
                  role="meter"
                  aria-label={`${spot.place}: ${spot.count} reports`}
                  aria-valuemin={0}
                  aria-valuemax={topCount}
                  aria-valuenow={spot.count}
                  style={{ height: 4, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}
                >
                  <div style={{ height: '100%', width: `${topCount ? Math.round((spot.count / topCount) * 100) : 0}%`, background: 'var(--uc-indigo)' }} />
                </div>
              </div>
            ))}
          </div>
        </PageRailCard>
      )}

      {(data.desk || isAdmin) && <DeskCard desk={data.desk} canEdit={isAdmin} />}
    </div>
  )
}

const deskInput: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: 12,
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
}

function DeskCard({ desk, canEdit }: { desk: LostFoundDesk | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<LostFoundDesk>(desk ?? { location: '', hours: '', holdPolicy: '' })
  const update = useUpdateLostFoundDesk()

  function startEditing() {
    setDraft(desk ?? { location: '', hours: '', holdPolicy: '' })
    setEditing(true)
  }

  function save() {
    const next = { location: draft.location.trim(), hours: draft.hours.trim(), holdPolicy: draft.holdPolicy.trim() }
    update.mutate(next.location ? next : null, { onSuccess: () => setEditing(false) })
  }

  if (editing) {
    return (
      <PageRailCard title="Lost & found desk" gap={8}>
        <input aria-label="Desk location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} onFocus={focusBorder} onBlur={blurBorder} placeholder="Where the desk is, e.g. Gate 2 security office" maxLength={120} style={deskInput} />
        <input aria-label="Opening hours" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} onFocus={focusBorder} onBlur={blurBorder} placeholder="Opening hours" maxLength={120} style={deskInput} />
        <input aria-label="Holding policy" value={draft.holdPolicy} onChange={(e) => setDraft({ ...draft, holdPolicy: e.target.value })} onFocus={focusBorder} onBlur={blurBorder} placeholder="How long unclaimed items are held" maxLength={120} style={deskInput} />
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>Leave the location empty to hide this card.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button type="button" onClick={() => setEditing(false)} style={{ minHeight: 32, padding: '0 12px', borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={update.isPending} style={{ minHeight: 32, padding: '0 14px', borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-indigo)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </PageRailCard>
    )
  }

  const editButton = canEdit ? (
    <button
      type="button"
      onClick={startEditing}
      aria-label="Edit desk details"
      title="Edit desk details"
      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }}
    >
      <Pencil size={13} strokeWidth={1.5} />
    </button>
  ) : null

  if (!desk) {
    // Admin only: nothing is set yet, so offer to add it.
    return (
      <PageRailCard gap={8}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--uc-cyan-bg)', color: 'var(--uc-cyan)', flexShrink: 0 }}>
            <MapPin size={15} strokeWidth={1.5} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Lost &amp; found desk</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Not set — members will not see this card</div>
          </div>
          {editButton}
        </div>
      </PageRailCard>
    )
  }

  return (
    <PageRailCard gap={10}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--uc-cyan-bg)', color: 'var(--uc-cyan)', flexShrink: 0 }}>
          <MapPin size={15} strokeWidth={1.5} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Lost &amp; found desk</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{desk.location}</div>
        </div>
        {editButton}
      </div>
      {(desk.hours || desk.holdPolicy) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '0.5px solid var(--border-default)', paddingTop: 10 }}>
          {desk.hours && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={12} strokeWidth={1.5} color="var(--text-tertiary)" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{desk.hours}</span>
            </div>
          )}
          {desk.holdPolicy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Archive size={12} strokeWidth={1.5} color="var(--text-tertiary)" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{desk.holdPolicy}</span>
            </div>
          )}
        </div>
      )}
    </PageRailCard>
  )
}
