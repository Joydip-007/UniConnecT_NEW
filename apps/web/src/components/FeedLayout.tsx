import { Outlet } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { LeftSidebar } from '@/components/LeftSidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsSocket } from '@/features/notifications'

export function FeedLayout() {
  const userId = useAuthStore((s) => s.user?.id)
  useNotificationsSocket(userId)

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh' }}>
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
