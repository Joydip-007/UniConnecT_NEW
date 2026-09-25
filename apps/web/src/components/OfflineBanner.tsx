import { WifiOff } from 'lucide-react'
import { queryClient } from '@/lib/queryClient'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/** Full-width amber strip under the top nav while the browser has no connection. */
export function OfflineBanner() {
  const online = useOnlineStatus()

  if (online) return null

  function retry() {
    // TanStack pauses queries and mutations while offline; nudge them in case the
    // connection is back before the browser has fired its `online` event.
    void queryClient.resumePausedMutations()
    void queryClient.refetchQueries({ type: 'active' })
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 60,
        zIndex: 'var(--z-nav)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        background: 'linear-gradient(var(--uc-amber-bg), var(--uc-amber-bg)), var(--surface-page)',
        borderBottom: '0.5px solid var(--uc-amber-bdr)',
      }}
    >
      <WifiOff size={15} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--uc-amber-l)', flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)' }}>
        You're offline. Posts and messages will send when you reconnect.
      </span>
      <button
        type="button"
        onClick={retry}
        style={{
          flexShrink: 0,
          padding: 0,
          background: 'none',
          border: 'none',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--uc-amber-l)',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  )
}
