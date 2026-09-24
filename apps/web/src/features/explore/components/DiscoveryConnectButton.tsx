import { useConnectionAction } from '@/features/connections'
import type { UserSuggestion } from '../types'

type Person = Pick<UserSuggestion, 'id' | 'fullName' | 'connectionStatus' | 'connectionId'>

/**
 * The Explore design's one-tap connect pill: Connect → Pending (tap to withdraw) →
 * Connected. A received request shows Accept. Filled only when it starts an action.
 */
export function DiscoveryConnectButton({ person }: { person: Person }) {
  const { send, withdraw, accept } = useConnectionAction(person.id)
  const status = person.connectionStatus ?? 'none'
  const busy = send.isPending || withdraw.isPending || accept.isPending
  const primary = status === 'none' || status === 'pending_received'

  const label =
    status === 'connected' ? 'Connected'
    : status === 'pending_sent' ? 'Pending'
    : status === 'pending_received' ? 'Accept'
    : 'Connect'

  const aria =
    status === 'connected' ? `Connected with ${person.fullName}`
    : status === 'pending_sent' ? `Withdraw request to ${person.fullName}`
    : status === 'pending_received' ? `Accept ${person.fullName}'s request`
    : `Connect with ${person.fullName}`

  function onClick() {
    if (status === 'none') send.mutate(undefined)
    else if (status === 'pending_sent') withdraw.mutate()
    else if (status === 'pending_received' && person.connectionId) accept.mutate(person.connectionId)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || status === 'connected'}
      aria-label={aria}
      style={{
        flexShrink: 0,
        minHeight: 32,
        padding: '0 14px',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 'var(--r-pill)',
        cursor: busy || status === 'connected' ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
        opacity: busy ? 0.6 : 1,
        background: primary ? 'var(--uc-indigo)' : 'transparent',
        color: primary ? 'var(--on-accent)' : 'var(--text-secondary)',
        border: primary ? 'none' : '0.5px solid var(--border-default)',
      }}
    >
      {label}
    </button>
  )
}
