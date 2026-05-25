import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getMyViewers } from '@/lib/api/users'
import type { ProfileViewer } from '@uniconnect/shared'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'

function timeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ViewerRow({ viewer }: { viewer: ProfileViewer }) {
  if (viewer.anonymous || !viewer.id) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <UserRound size={16} strokeWidth={1.5} color="var(--text-tertiary)" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Anonymous viewer
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {timeAgo(viewer.viewedAt)}
        </span>
      </div>
    )
  }

  const color = avatarColor(viewer.id)
  const initials = getInitials(viewer.fullName ?? '')

  return (
    <Link
      to={`/profile/${viewer.id}`}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', textDecoration: 'none' }}
    >
      <Avatar src={viewer.avatarUrl ?? undefined} initials={initials} color={color} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {viewer.fullName}
        </p>
        {(viewer.headline || viewer.department) && (
          <p
            style={{
              margin: 0, fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {viewer.headline ?? viewer.department}
          </p>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}>
        {timeAgo(viewer.viewedAt)}
      </span>
    </Link>
  )
}

export function ProfileViewers() {
  const [page, setPage] = useState(1)
  // Wrap in try/catch — viewer data is non-critical; failures should be silent
  const { data, isLoading } = useQuery({
    queryKey: ['profile', 'viewers', page],
    queryFn: async () => {
      try {
        return await getMyViewers(page)
      } catch {
        return null
      }
    },
    staleTime: 2 * 60 * 1000,
  })

  const viewers: ProfileViewer[] = data?.items ?? []
  const total = data?.total ?? 0
  const hasMore = data != null && viewers.length < total

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Eye size={14} strokeWidth={1.5} color="var(--text-tertiary)" />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Who viewed your profile
          </span>
        </div>
        {total > 0 && (
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            {total.toLocaleString()} view{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-raised)', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ height: 12, width: '40%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
                <div style={{ height: 10, width: '60%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : viewers.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          {data == null
            ? 'Complete your profile to get the full experience.'
            : 'No one has viewed your profile yet. Share it to get discovered.'}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {viewers.map((v, idx) => (
              <div key={idx} style={{ borderBottom: idx < viewers.length - 1 ? '0.5px solid var(--border-default)' : 'none' }}>
                <ViewerRow viewer={v} />
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              style={{
                alignSelf: 'center',
                marginTop: 4,
                padding: '6px 14px',
                background: 'transparent',
                border: '0.5px solid var(--border-hover)',
                borderRadius: 'var(--r-pill)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Show more
            </button>
          )}
        </>
      )}

      <p style={{ margin: 0, fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
        Only you can see who viewed your profile.
      </p>
    </div>
  )
}
