import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart2, Settings, ShieldCheck, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useReviewSummary } from '../hooks/useGroupExtended'
import { defaultTabFor } from './GroupLeftRail'
import type { GroupTab } from './GroupLeftRail'
import { AnalyticsPanel } from './AnalyticsPanel'
import { InvitePanel } from './InvitePanel'
import { ModLogPanel } from './ModLogPanel'
import type { Group } from '../types'

type Overlay = 'invite' | 'analytics' | 'modlog' | null

function QueueRow({ title, meta, onReview }: { title: string; meta: string; onReview: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--surface-raised)',
        borderRadius: 'var(--r-md)',
        padding: '10px 12px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
        <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{meta}</p>
      </div>
      <button
        type="button"
        onClick={onReview}
        style={{
          flexShrink: 0,
          padding: '3px 10px',
          fontSize: 12,
          fontWeight: 400,
          fontFamily: 'inherit',
          borderRadius: 'var(--r-pill)',
          border: '0.5px solid var(--border-default)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        Review
      </button>
    </div>
  )
}

const chipStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  height: 28,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 400,
  fontFamily: 'inherit',
  color: 'var(--text-secondary)',
  background: 'transparent',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-pill)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/**
 * The admin manage card rendered above the tab strip under 767px — `GroupRightRail`
 * (which owns the desktop `ManageCard`) is hidden there by `FeedLayout`. Renders
 * `null` on desktop or for a non-admin viewer.
 */
export function MobileManageCard({ group, onToggleSettings }: { group: Group; onToggleSettings: () => void }) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isAdmin = group.userRole === 'owner' || group.userRole === 'admin'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const { data: summary } = useReviewSummary(group.id, isMobile && isAdmin)

  if (!isMobile || !isAdmin) return null

  function go(tab: GroupTab) {
    const params = new URLSearchParams(searchParams)
    if (tab === defaultTabFor(group)) params.delete('tab')
    else params.set('tab', tab)
    navigate({ search: params.toString() })
  }

  const joins = summary?.pendingJoinRequests ?? 0
  const queued = (summary?.pendingPosts ?? 0) + (summary?.pendingEvents ?? 0)

  const actions: { icon: LucideIcon; label: string; onClick: () => void }[] = [
    { icon: UserPlus, label: 'Invite members', onClick: () => setOverlay('invite') },
    ...(group.isSystem ? [] : [{ icon: Settings, label: 'Group settings', onClick: onToggleSettings }]),
    { icon: BarChart2, label: 'Analytics', onClick: () => setOverlay('analytics') },
    { icon: ShieldCheck, label: 'Moderation log', onClick: () => setOverlay('modlog') },
  ]

  return (
    <section
      aria-label="Manage this group"
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: 'var(--uc-orange-l)',
        }}
      >
        <ShieldCheck size={13} strokeWidth={1.5} aria-hidden />
        Manage this group
      </div>

      <QueueRow
        title="Join requests"
        meta={joins > 0 ? `${joins} ${joins === 1 ? 'request' : 'requests'} waiting` : 'No requests waiting'}
        onReview={() => go('join-requests')}
      />
      <QueueRow
        title="Queued posts"
        meta={queued > 0 ? `${queued} waiting` : 'All caught up'}
        onReview={() => go('feed')}
      />

      <div className="hide-bar" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} style={chipStyle}>
            <a.icon size={13} strokeWidth={1.5} aria-hidden />
            {a.label}
          </button>
        ))}
      </div>

      {overlay === 'invite' && <InvitePanel group={group} onClose={() => setOverlay(null)} />}
      {overlay === 'analytics' && <AnalyticsPanel groupId={group.id} onClose={() => setOverlay(null)} />}
      {overlay === 'modlog' && <ModLogPanel groupId={group.id} onClose={() => setOverlay(null)} />}
    </section>
  )
}
