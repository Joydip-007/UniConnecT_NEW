import { Modal } from '@/components/Modal'
import { useDriverBroadcastStore } from '@/stores/driverBroadcastStore'
import { useShiftMutations } from '../hooks/useShuttleDuty'

interface DriverSignOutDialogProps {
  onCancel: () => void
  /** Called once the broadcast is stopped and the shift closed (or the close failed). */
  onSignedOut: () => void
}

/**
 * Asked before signing out mid-broadcast: signing out stops the GPS watch, and riders
 * lose the bus on the map. A bottom sheet on phones, a small dialog on desktop. Mounted
 * only while open, so the nav that hosts it pays for no mutation until then.
 */
export function DriverSignOutDialog({ onCancel, onSignedOut }: DriverSignOutDialogProps) {
  const stopBroadcast = useDriverBroadcastStore((s) => s.stop)
  const { stop: stopShift } = useShiftMutations()

  function confirm() {
    stopShift.mutate(undefined, {
      onSettled: () => {
        stopBroadcast()
        onSignedOut()
      },
    })
  }

  return (
    <Modal isOpen onClose={onCancel} title="Sign out of driver mode?" frame="panel" panelWidth={400} sheet>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Sign out of driver mode?</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          You are broadcasting live. Signing out stops the broadcast, and students lose the bus on the map.
        </span>
        <div className="driver-signout-actions">
          <button type="button" onClick={onCancel} className="driver-btn driver-btn--ghost">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={stopShift.isPending} className="driver-btn driver-btn--primary">
            Stop broadcast and sign out
          </button>
        </div>
      </div>
    </Modal>
  )
}
