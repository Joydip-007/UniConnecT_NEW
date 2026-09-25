import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart2, BookOpen, Calendar, Clock, GraduationCap, Rss, UserPlus } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { getInitials } from '@/utils/avatar'
import { TYPE_LOOK } from '../groupTypeLook'
import { useMyGroups } from '../hooks/useGroupExtended'
import type { Group } from '../types'
import { defaultTabFor, groupTabsFor, type GroupTab } from '../groupTabs'

const TAB_ICONS: Record<GroupTab, LucideIcon> = {
  feed: Rss,
  resources: BookOpen,
  'study-sessions': Clock,
  academic: GraduationCap,
  events: Calendar,
  stats: BarChart2,
  'join-requests': UserPlus,
}

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.04em',
  color: 'var(--text-label)',
  padding: '0 10px 6px',
}

export function GroupLeftRail({
  group,
  activeTab,
  pendingCount,
}: {
  group: Group
  /** A wider string is accepted so the caller can pass a transitional tab (e.g. `members`,
   * `about`) that this rail doesn't render as a row — it just won't match any `on` check. */
  activeTab: string
  pendingCount: number
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabs = groupTabsFor(group, { pendingCount })
  const { data: myGroups } = useMyGroups()

  function go(tab: GroupTab) {
    const params = new URLSearchParams(searchParams)
    if (tab === defaultTabFor(group)) params.delete('tab')
    else params.set('tab', tab)
    navigate({ search: params.toString() })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0' }}>
      <div style={sectionLabelStyle}>In this group</div>
      <nav role="tablist" aria-label="Group sections" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {tabs.map((t) => {
          const on = t.value === activeTab
          const Icon = TAB_ICONS[t.value]
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => go(t.value)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                width: '100%',
                minHeight: 44,
                padding: '8px 10px',
                fontSize: 13,
                fontWeight: on ? 500 : 400,
                fontFamily: 'inherit',
                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: on ? 'var(--surface-hover)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {on && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 6,
                    bottom: 6,
                    width: 2,
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--uc-orange)',
                  }}
                />
              )}
              <Icon size={16} strokeWidth={1.5} aria-hidden />
              <span style={{ flex: 1, minWidth: 0 }}>{t.label}</span>
              {t.badge != null && t.badge > 0 && (
                <span
                  style={{
                    padding: '1px 6px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--uc-orange-bg)',
                    color: 'var(--uc-orange-l)',
                    flexShrink: 0,
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {myGroups && myGroups.items.length > 0 && (
        <>
          <div
            aria-hidden
            style={{ height: '0.5px', background: 'var(--border-default)', margin: '8px 10px' }}
          />
          <div style={sectionLabelStyle}>Your groups</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {myGroups.items.map((g) => {
              const look = TYPE_LOOK[g.type] ?? TYPE_LOOK.other
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => navigate(`/groups/${g.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    minHeight: 40,
                    padding: '4px 10px',
                    fontFamily: 'inherit',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      borderRadius: 'var(--r-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 500,
                      background: look.bg,
                      color: look.fg,
                      backgroundImage: g.avatarUrl ? `url(${g.avatarUrl})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {g.avatarUrl ? '' : getInitials(g.name)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.name}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
