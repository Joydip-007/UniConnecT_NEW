import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { avatarColor, getInitials } from '@/utils/avatar'
import type { FeedPost } from '@uniconnect/shared'

type EmbeddedPost = NonNullable<FeedPost['originalPost']>

function roleBadgeVariant(role: EmbeddedPost['author']['role']): 'dept' | 'alumni' | 'neutral' {
  if (role === 'student') return 'dept'
  if (role === 'alumni') return 'alumni'
  return 'neutral'
}

interface Props {
  post: EmbeddedPost | null
}

export function OriginalPostEmbed({ post }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!post) {
    return (
      <div
        style={{
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-md)',
          padding: '12px 14px',
          color: 'var(--text-tertiary)',
          fontSize: 13,
          fontWeight: 400,
        }}
      >
        Original post is no longer available.
      </div>
    )
  }

  const TRUNCATE_LIMIT = 200
  const shouldTruncate = post.content.length > TRUNCATE_LIMIT && !expanded
  const displayContent = shouldTruncate ? post.content.slice(0, TRUNCATE_LIMIT) + '…' : post.content

  return (
    <div
      style={{
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        marginTop: 8,
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar
          src={post.author.profile.avatarUrl}
          initials={getInitials(post.author.fullName)}
          color={avatarColor(post.author.id)}
          size={28}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {post.author.fullName}
            </span>
            <Badge variant={roleBadgeVariant(post.author.role)}>
              {post.author.role.charAt(0).toUpperCase() + post.author.role.slice(1)}
            </Badge>
          </div>
          {post.createdAt && (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
              {formatDistanceToNow(
                typeof post.createdAt === 'string' ? parseISO(post.createdAt) : new Date(post.createdAt as unknown as string),
                { addSuffix: true },
              )}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div style={{ padding: '0 12px 10px' }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-primary)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {displayContent}
          </p>
          {post.content.length > TRUNCATE_LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                marginTop: 2,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--uc-indigo-xl)',
              }}
            >
              {expanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      )}

      {/* First media thumbnail */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div style={{ maxHeight: 200, overflow: 'hidden' }}>
          <img
            src={post.mediaUrls[0]}
            alt=""
            style={{ width: '100%', objectFit: 'cover', display: 'block', maxHeight: 200 }}
          />
        </div>
      )}
    </div>
  )
}
