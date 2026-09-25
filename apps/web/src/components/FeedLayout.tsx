import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { TopNav } from '@/components/TopNav'
import { LeftSidebar } from '@/components/LeftSidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { ToastHost } from '@/components/ToastHost'
import { OfflineBanner } from '@/components/OfflineBanner'
import { DriverBroadcastHost } from '@/features/shuttle/components/DriverBroadcastHost'
import { useAuthStore } from '@/stores/authStore'
import { useSocketStore } from '@/stores/socketStore'
import { useShellStore } from '@/stores/shellStore'
import { useNotificationsSocket } from '@/features/notifications'
import { usePresenceHeartbeat } from '@/features/presence'
import { useAchievementSocket } from '@/features/learning'
import { useSidebarRailPreference } from '@/hooks/useSidebarRailPreference'
import { ROLE_SHELL } from '@/config/roleShell'
import { DUR, EASE_OUT_EXPO } from '@/lib/motion'

const statusCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  padding: '24px 32px',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-hover)',
  borderRadius: 'var(--r-xl)',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 'var(--z-banner)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export function FeedLayout() {
  const userId = useAuthStore((s) => s.user?.id)
  const role = useAuthStore((s) => s.user?.role)
  const { connected, hasConnected } = useSocketStore()
  const { isCollapsed, toggleCollapsed } = useSidebarRailPreference()
  const reduced = useReducedMotion()
  useNotificationsSocket(userId)
  usePresenceHeartbeat(Boolean(userId))
  useAchievementSocket()

  const [justReconnected, setJustReconnected] = useState(false)
  const wasConnectedRef = useRef(connected)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!wasConnectedRef.current && connected) {
      setJustReconnected(true)
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
      flashTimeoutRef.current = setTimeout(() => setJustReconnected(false), 1500)
    }
    wasConnectedRef.current = connected
  }, [connected])

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
    }
  }, [])

  const showReconnecting = hasConnected && !connected

  // Every role runs on the same grid, never a forked layout — only the payload differs.
  // A role whose manifest lists no widgets (driver) drops the third column rather than
  // holding an empty one, and the centre gets that width instead.
  const wide = ROLE_SHELL[role ?? 'student'].rightRail.length === 0
  // An error or not-found surface is showing: top nav and one 560px centre column only.
  const bare = useShellStore((s) => s.bareCount > 0)

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Only after a first successful connect, so a cold load never flashes it. */}
      <AnimatePresence>
        {showReconnecting && (
          <motion.div
            key="reconnecting"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
            style={{ ...overlayStyle, background: 'var(--overlay-bg-strong)' }}
          >
            <motion.div
              role="alert"
              aria-live="polite"
              initial={reduced ? false : { opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
              style={statusCardStyle}
            >
              <span
                aria-hidden="true"
                style={{
                  animation: 'spin 800ms linear infinite',
                  width: 28,
                  height: 28,
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  border: '2px solid var(--border-hover)',
                  borderTopColor: 'var(--uc-indigo-l)',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Reconnecting…</span>
            </motion.div>
          </motion.div>
        )}
        {!showReconnecting && justReconnected && (
          <motion.div
            key="connected"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
            style={{ ...overlayStyle, pointerEvents: 'none' }}
          >
            <div role="status" aria-live="polite" style={statusCardStyle}>
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--uc-mint-bg)',
                  color: 'var(--uc-mint)',
                }}
              >
                <Check size={16} strokeWidth={2} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--uc-mint)' }}>Connected</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <TopNav />
      <OfflineBanner />
      <MobileBottomNav />
      <ToastHost />
      <DriverBroadcastHost />
      <div
        className="feed-layout-grid"
        data-left-sidebar={isCollapsed ? 'collapsed' : 'expanded'}
        data-wide={wide || undefined}
        data-bare={bare || undefined}
      >
        {!bare && (
          <div className="feed-layout-left">
            <LeftSidebar collapsed={isCollapsed} onToggleCollapsed={toggleCollapsed} />
          </div>
        )}
        <main className="feed-layout-main" style={{ minWidth: 0, paddingTop: 18 }}>
          <Outlet />
        </main>
        {!wide && !bare && (
          <div className="feed-layout-right">
            <RightSidebar />
          </div>
        )}
      </div>
    </div>
  )
}
