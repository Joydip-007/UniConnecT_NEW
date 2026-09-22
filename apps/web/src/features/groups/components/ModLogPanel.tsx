import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, Settings, ShieldCheck, Trash2, UserX, VolumeX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GroupPanel } from './GroupPanel'
import { useModerationLog } from '../hooks/useGroupExtended'
import type { ModLogEntry, ModLogKind } from '../hooks/useGroupExtended'

type Filter = ModLogKind | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'post', label: 'Posts' },
  { value: 'member', label: 'Members' },
  { value: 'settings', label: 'Settings' },
]

/** Icon + tone per entry kind; the action text picks the glyph within a kind. */
function lookFor(entry: ModLogEntry): { icon: LucideIcon; bg: string; fg: string } {
  const a = entry.action.toLowerCase()
  if (entry.kind === 'post') {
    return /remov|delet|declin/.test(a)
      ? { icon: Trash2, bg: 'var(--uc-orange-bg)', fg: 'var(--uc-orange-l)' }
      : { icon: CheckCircle2, bg: 'var(--uc-orange-bg)', fg: 'var(--uc-orange-l)' }
  }
  if (entry.kind === 'member') {
    if (/mute/.test(a)) return { icon: VolumeX, bg: 'var(--uc-amber-bg)', fg: 'var(--uc-amber-l)' }
    if (/remov|ban|kick/.test(a)) return { icon: UserX, bg: 'var(--uc-amber-bg)', fg: 'var(--uc-amber-l)' }
    return { icon: ShieldCheck, bg: 'var(--uc-indigo-bg)', fg: 'var(--uc-indigo-l)' }
  }
  return { icon: Settings, bg: 'var(--uc-indigo-bg)', fg: 'var(--uc-indigo-l)' }
}

export function ModLogPanel({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const { data, isLoading } = useModerationLog(groupId, filter)
  const entries = data?.items ?? []

  return (
    <GroupPanel
      icon={ShieldCheck}
      title="Moderation log"
      onClose={onClose}
      footer={
        <>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            Entries are kept for 12 months
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              borderRadius: 'var(--r-pill)',
              border: '0.5px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </>
      }
    >
      <div role="tablist" aria-label="Filter log" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const on = f.value === filter
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.value)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'inherit',
                borderRadius: 'var(--r-pill)',
                border: `0.5px solid ${on ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                background: on ? 'var(--uc-indigo-bg)' : 'transparent',
                color: on ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No entries for this filter.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map((e) => {
            const look = lookFor(e)
            const Icon = look.icon
            return (
              <li key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  aria-hidden
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: look.bg,
                    color: look.fg,
                  }}
                >
                  <Icon size={14} strokeWidth={1.5} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {e.action}
                    {e.target && (
                      <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {e.target}</span>
                    )}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                    by {e.actor?.fullName ?? 'System'} · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </GroupPanel>
  )
}
