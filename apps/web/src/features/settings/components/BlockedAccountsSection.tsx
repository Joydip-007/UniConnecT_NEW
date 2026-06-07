import { Avatar } from '@/components/Avatar'
import { GhostBtn } from '@/components/Button'
import { useBlockedUsers, useUserModeration } from '@/features/moderation'
import { avatarColor, getInitials } from '@/utils/avatar'
import { SectionHeader } from './NotificationsSection'

export default function BlockedAccountsSection() {
  const { data, isLoading } = useBlockedUsers()

  return (
    <div style={{ marginTop: 32 }}>
      <SectionHeader
        title="Blocked accounts"
        description="Blocked people can't message you, send connection requests, or see your profile. They aren't told they've been blocked."
      />

      {isLoading ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', padding: '12px 0' }}>
          You haven't blocked anyone.
        </p>
      ) : (
        <div>
          {data.items.map((u) => (
            <BlockedRow key={u.id} userId={u.id} fullName={u.fullName} headline={u.headline} avatarUrl={u.avatarUrl} />
          ))}
        </div>
      )}
    </div>
  )
}

function BlockedRow({
  userId,
  fullName,
  headline,
  avatarUrl,
}: {
  userId: string
  fullName: string
  headline: string | null
  avatarUrl: string | null
}) {
  const { unblock } = useUserModeration(userId)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 0',
        borderTop: '0.5px solid var(--border-default)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <Avatar src={avatarUrl} initials={getInitials(fullName)} color={avatarColor(userId)} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{fullName}</div>
          {headline && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-tertiary)',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {headline}
            </div>
          )}
        </div>
      </div>
      <GhostBtn onClick={() => unblock.mutate()} disabled={unblock.isPending}>
        Unblock
      </GhostBtn>
    </div>
  )
}
