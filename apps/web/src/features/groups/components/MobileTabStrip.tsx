import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { defaultTabFor, groupTabsFor } from './GroupLeftRail'
import type { GroupTab } from './GroupLeftRail'
import type { Group } from '../types'

/**
 * The horizontal chip strip that replaces `GroupLeftRail`'s tab list under
 * 767px — `FeedLayout` hides the left rail there, so the page renders this
 * instead. Renders `null` on desktop.
 */
export function MobileTabStrip({
  group,
  activeTab,
  pendingCount,
}: {
  group: Group
  activeTab: string
  pendingCount: number
}) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabs = groupTabsFor(group, { pendingCount })

  if (!isMobile) return null

  function go(tab: GroupTab) {
    const params = new URLSearchParams(searchParams)
    if (tab === defaultTabFor(group)) params.delete('tab')
    else params.set('tab', tab)
    navigate({ search: params.toString() })
  }

  return (
    <nav
      role="tablist"
      aria-label="Group sections"
      className="show-bar"
      style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 2px 4px' }}
    >
      {tabs.map((t) => {
        const on = t.value === activeTab
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => go(t.value)}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              fontSize: 13,
              fontWeight: on ? 500 : 400,
              fontFamily: 'inherit',
              color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: on ? 'var(--surface-hover)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span
                style={{
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--uc-orange-bg)',
                  color: 'var(--uc-orange-l)',
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
