import { usePresenceStore } from '@/stores/presenceStore'

interface PresenceDotProps {
  userId: string | undefined
  size?: number
  /** Render as an absolutely-positioned badge over an avatar. */
  overlay?: boolean
}

/**
 * Small green dot shown only when the user is online and visible to the viewer.
 * Pure store reader — a parent must seed presence via `usePresence(ids)`.
 */
export function PresenceDot({ userId, size = 10, overlay = false }: PresenceDotProps) {
  const presence = usePresenceStore((s) => (userId ? s.byUser[userId] : undefined))
  if (!presence || presence.status !== 'online') return null

  return (
    <span
      aria-label="Online"
      title="Active now"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--uc-success, #34d399)',
        border: '2px solid var(--surface-card)',
        ...(overlay
          ? { position: 'absolute', right: 0, bottom: 0 }
          : { marginLeft: 6, verticalAlign: 'middle' }),
      }}
    />
  )
}

/** "Active now" / "Active 5m ago" / null, honouring visibility. */
export function PresenceLabel({ userId }: { userId: string | undefined }) {
  const presence = usePresenceStore((s) => (userId ? s.byUser[userId] : undefined))
  if (!presence) return null
  if (presence.status === 'online') {
    return <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Active now</span>
  }
  if (!presence.lastSeenAt) return null
  return (
    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
      Active {relativeTime(presence.lastSeenAt)}
    </span>
  )
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
