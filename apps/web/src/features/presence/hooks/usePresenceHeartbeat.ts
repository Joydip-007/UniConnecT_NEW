import { useEffect } from 'react'
import { PRESENCE_EVENTS } from '@uniconnect/shared'
import { socket } from '@/lib/socket'

const HEARTBEAT_MS = 25_000

/** Emit a presence heartbeat while connected so the server keeps us "online". */
export function usePresenceHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const ping = () => {
      if (socket.connected) socket.emit(PRESENCE_EVENTS.PING)
    }
    ping()
    const interval = window.setInterval(ping, HEARTBEAT_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])
}
