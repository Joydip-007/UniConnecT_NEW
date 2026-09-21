import { motion, useReducedMotion } from 'framer-motion'
import { RIGHT_RAIL_WIDGETS } from '@/components/rightRail'
import { ROLE_SHELL } from '@/config/roleShell'
import { listStagger } from '@/lib/motion'
import { useAuthStore } from '@/stores/authStore'
import { usePageRailStore } from '@/stores/pageRailStore'

/**
 * The right rail owns layout and nothing else. Which widgets a role gets is a manifest
 * decision (`ROLE_SHELL[role].rightRail`), and each widget owns its own query and hides
 * itself when it has no data — so there is no role branch and no empty-state to manage
 * here. A role with an empty list renders no rail at all, which is the correct resting
 * state rather than a gap to fill.
 *
 * Widget chrome is positional (`.right-rail` / `.right-rail-slot` in index.css) rather
 * than baked into each widget: the manifest orders the column differently per role, so
 * the card surface belongs to whichever widget lands first, not to one named widget.
 */
export function RightSidebar() {
  const prefersReducedMotion = useReducedMotion()
  const role = useAuthStore((s) => s.user?.role)
  const widgetKeys = ROLE_SHELL[role ?? 'student'].rightRail
  const rightOverride = usePageRailStore((s) => s.rightOverride)

  if (rightOverride) {
    return (
      <aside
        aria-label="Suggestions and activity"
        style={{
          width: 272,
          flexShrink: 0,
          position: 'sticky',
          top: 78,
          height: 'calc(100vh - 78px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingBottom: 20,
        }}
        className="right-rail rail-scroll"
      >
        {rightOverride}
      </aside>
    )
  }

  if (widgetKeys.length === 0) return null

  return (
    <motion.aside
      variants={listStagger(40)}
      initial={prefersReducedMotion ? false : 'initial'}
      animate="animate"
      aria-label="Suggestions and activity"
      style={{
        width: 272,
        flexShrink: 0,
        position: 'sticky',
        top: 78,
        height: 'calc(100vh - 78px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingBottom: 20,
      }}
      className="right-rail rail-scroll"
    >
      {widgetKeys.map((key) => {
        const WidgetComponent = RIGHT_RAIL_WIDGETS[key]
        return <WidgetComponent key={key} />
      })}
    </motion.aside>
  )
}
