import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Lock, Plus, Trash2 } from 'lucide-react'
import type { ProfileFeatured } from '@uniconnect/shared'
import { getUserFeatured } from '@/lib/api/users'

interface Props {
  userId: string
  isOwnProfile: boolean
  connectionStatus: string
  onAdd: () => void
  onDelete: (id: string) => void
}

function LockedCard() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Lock size={16} strokeWidth={1.5} color="var(--text-tertiary)" />
      <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
        Connect to see featured items
      </p>
    </div>
  )
}

function FeaturedCard({
  item,
  isOwnProfile,
  onDelete,
}: {
  item: ProfileFeatured
  isOwnProfile: boolean
  onDelete: (id: string) => void
}) {
  if (item.type === 'link') {
    return (
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-md)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minWidth: 180,
          maxWidth: 240,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>
            {item.linkTitle ?? item.linkUrl ?? 'Link'}
          </span>
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              aria-label="Remove featured item"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                color: 'var(--text-tertiary)',
                lineHeight: 0,
                display: 'inline-flex',
                flexShrink: 0,
              }}
            >
              <Trash2 size={13} strokeWidth={1.5} />
            </button>
          )}
        </div>
        {item.linkDescription && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.linkDescription}
          </p>
        )}
        {item.linkUrl && (
          <a
            href={item.linkUrl}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--uc-indigo-xl)',
              textDecoration: 'none',
              fontSize: 11,
              fontWeight: 400,
            }}
          >
            View link
            <ExternalLink size={10} strokeWidth={1.5} />
          </a>
        )}
      </div>
    )
  }

  // type === 'post'
  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 180,
        maxWidth: 240,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Post
        </span>
        {isOwnProfile && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label="Remove featured item"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              color: 'var(--text-tertiary)',
              lineHeight: 0,
              display: 'inline-flex',
              flexShrink: 0,
            }}
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        Featured post
      </span>
    </div>
  )
}

export function ProfileFeatured({ userId, isOwnProfile, connectionStatus, onAdd, onDelete }: Props) {
  const isRestricted =
    !isOwnProfile &&
    (connectionStatus === 'none' || connectionStatus === 'pending_sent')

  const { data: items = [], isLoading } = useQuery<ProfileFeatured[]>({
    queryKey: ['profile', 'featured', userId],
    queryFn: () => getUserFeatured(userId),
    enabled: !isRestricted,
  })

  if (isRestricted) {
    return <LockedCard />
  }

  if (!isOwnProfile && items.length === 0) return null

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
          Featured
        </span>
        {isOwnProfile && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add featured item"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-tertiary)',
              lineHeight: 0,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 80,
                minWidth: 180,
                background: 'var(--surface-raised)',
                borderRadius: 'var(--r-md)',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          {isOwnProfile ? (
            <>
              Highlight your best work.{' '}
              <button
                type="button"
                onClick={onAdd}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'var(--uc-indigo-xl)',
                  fontSize: 13,
                  fontWeight: 400,
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Add featured
              </button>
            </>
          ) : (
            'Nothing featured yet.'
          )}
        </p>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {items.map((item) => (
            <FeaturedCard
              key={item.id}
              item={item}
              isOwnProfile={isOwnProfile}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
