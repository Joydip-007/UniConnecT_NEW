import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { UserRole } from '@uniconnect/shared/types'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { ConnectButton } from '@/features/connections'
import { api } from '@/lib/axios'
import { DUR, EASE_OUT_EXPO } from '@/lib/motion'
import { PATHS } from '@/router/paths'
import { useToastStore } from '@/stores/toastStore'
import { avatarColor, getInitials } from '@/utils/avatar'
import { RailSlot, SectionHeader, SkeletonLine, WidgetShell } from './primitives'

interface SuggestedUser {
  id: string
  role: UserRole
  profile: {
    fullName: string
    department: string | null
    batchYear: string | null
  }
  connectionStatus?: 'none' | 'pending_sent' | 'pending_received' | 'connected'
  connectionId?: string | null
}

function PersonRow({
  user,
  isLast = false,
  onDismiss,
}: {
  user: SuggestedUser
  isLast?: boolean
  onDismiss: (id: string) => void
}) {
  const navigate = useNavigate()
  const initials = getInitials(user.profile.fullName)
  const color = avatarColor(user.id)

  return (
    <motion.div
      layout
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
      style={{ overflow: 'hidden' }}
      className="person-row"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 0',
          borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)',
        }}
      >
        <button
          onClick={() => navigate(PATHS.PROFILE.replace(':id', user.id))}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
          aria-label={`View ${user.profile.fullName}'s profile`}
        >
          <Avatar initials={initials} color={color} size={36} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            onClick={() => navigate(PATHS.PROFILE.replace(':id', user.id))}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              width: '100%',
              textAlign: 'left',
            }}
          >
            <RoleBadge role={user.role} size={13} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.profile.fullName}
            </span>
          </button>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ConnectButton
            targetUserId={user.id}
            targetName={user.profile.fullName}
            connectionStatus={user.connectionStatus ?? 'none'}
            connectionId={user.connectionId ?? null}
            size="sm"
          />
          <button
            type="button"
            onClick={() => onDismiss(user.id)}
            aria-label={`Hide suggestion for ${user.profile.fullName}`}
            className="person-row-dismiss"
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/** Hides entirely once every suggestion is dismissed or the endpoint returns none. */
export function PeopleYouMayKnowWidget() {
  const showToast = useToastStore((s) => s.show)

  // Dismissals are client-side only — there is no server-side "hide this suggestion".
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['users', 'suggestions'],
    queryFn: () =>
      api
        .get<{ data: SuggestedUser[] }>('/users/suggestions', { params: { limit: 3 } })
        .then((r) => r.data.data),
  })

  const visible = (suggestions ?? []).filter((u) => !dismissed.has(u.id))

  function handleDismiss(userId: string) {
    setDismissed((prev) => new Set(prev).add(userId))
    showToast({
      message: 'Suggestion hidden',
      onUndo: () =>
        setDismissed((prev) => {
          const next = new Set(prev)
          next.delete(userId)
          return next
        }),
    })
  }

  if (!isLoading && visible.length === 0) return null

  return (
    <WidgetShell>
      <RailSlot>
        <SectionHeader title="People you may know" />

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--surface-raised)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SkeletonLine width="60%" />
                  <SkeletonLine width="40%" height={10} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <AnimatePresence initial={false}>
              {visible.slice(0, 3).map((user, i, arr) => (
                <PersonRow
                  key={user.id}
                  user={user}
                  isLast={i === arr.length - 1}
                  onDismiss={handleDismiss}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </RailSlot>
    </WidgetShell>
  )
}
