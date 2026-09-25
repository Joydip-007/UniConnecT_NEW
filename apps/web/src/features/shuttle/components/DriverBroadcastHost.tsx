import { useEffect } from 'react'
import { useDriverBroadcastStore } from '@/stores/driverBroadcastStore'
import { useDriverBroadcast } from '../hooks/useDriverBroadcast'

/**
 * Runs the GPS watch for as long as a broadcast is active, whatever page is showing.
 * Renders nothing and costs nothing while no broadcast is on — it is gated on the
 * store, never on the viewer's role.
 */
export function DriverBroadcastHost() {
  const routeId = useDriverBroadcastStore((s) => s.routeId)
  const active = useDriverBroadcastStore((s) => s.active)
  const report = useDriverBroadcastStore((s) => s.report)
  const { status, lastFix } = useDriverBroadcast(routeId, active)

  useEffect(() => {
    report(status, lastFix)
  }, [status, lastFix, report])

  return null
}
