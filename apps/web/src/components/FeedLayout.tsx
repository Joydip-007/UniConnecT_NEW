import { Outlet } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { LeftSidebar } from '@/components/LeftSidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { useAuthStore } from '@/stores/authStore'
import { useSocketStore } from '@/stores/socketStore'
import { useNotificationsSocket } from '@/features/notifications'

export function FeedLayout() {
  const userId = useAuthStore((s) => s.user?.id)
  const { connected, hasConnected } = useSocketStore()
  useNotificationsSocket(userId)

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh' }}>
      {hasConnected && !connected && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--surface-raised)',
            borderBottom: '0.5px solid var(--border-default)',
            padding: '7px 16px',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-secondary)',
          }}
        >
          Reconnecting…
        </div>
      )}
      <TopNav />
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '18px 20px 0',
          display: 'grid',
          gridTemplateColumns: '232px 1fr 272px',
          gap: 18,
        }}
      >
        <LeftSidebar />
        <main style={{ minWidth: 0 }}>
          <Outlet />
        </main>
        <RightSidebar />
      </div>
    </div>
  )
}
