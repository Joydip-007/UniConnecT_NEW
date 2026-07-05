import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { TopNav } from '@/components/TopNav'
import { LeftSidebar } from '@/components/LeftSidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { ToastHost } from '@/components/ToastHost'
import { useAuthStore } from '@/stores/authStore'
import { useSocketStore } from '@/stores/socketStore'
import { useNotificationsSocket } from '@/features/notifications'
import { usePresenceHeartbeat } from '@/features/presence'
import { useAchievementSocket } from '@/features/learning'
import { DUR, EASE_OUT_EXPO } from '@/lib/motion'

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 'var(--z-banner)',
  background: 'var(--surface-raised)',
  borderBottom: '0.5px solid var(--border-default)',
  padding: '7px 16px',
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 400,
  color: 'var(--text-secondary)',
}

export function FeedLayout() {
  const userId = useAuthStore((s) => s.user?.id)
  const { connected, hasConnected } = useSocketStore()
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

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence>
        {showReconnecting && (
          <motion.div
            key="reconnecting"
            role="alert"
            aria-live="polite"
            initial={reduced ? false : { y: '-100%' }}
            animate={{ y: 0 }}
            exit={reduced ? undefined : { y: '-100%' }}
            transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
            style={bannerStyle}
          >
            Reconnecting…
          </motion.div>
        )}
        {!showReconnecting && justReconnected && (
          <motion.div
            key="connected"
            role="status"
            aria-live="polite"
            initial={reduced ? false : { y: '-100%' }}
            animate={{ y: 0 }}
            exit={reduced ? undefined : { y: '-100%' }}
            transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
            style={{ ...bannerStyle, color: 'var(--uc-mint)' }}
          >
            Connected
          </motion.div>
        )}
      </AnimatePresence>
      <TopNav />
      <MobileBottomNav />
      <ToastHost />
      <div className="feed-layout-grid">
        <div className="feed-layout-left">
          <LeftSidebar />
        </div>
        <main className="feed-layout-main" style={{ minWidth: 0, paddingTop: 18 }}>
          <Outlet />
        </main>
        <div className="feed-layout-right">
          <RightSidebar />
        </div>
      </div>
    </div>
  )
}
