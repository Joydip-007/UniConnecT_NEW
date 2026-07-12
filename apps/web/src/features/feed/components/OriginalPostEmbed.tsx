import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { avatarColor, getInitials } from '@/utils/avatar'
import type { FeedPost } from '@uniconnect/shared'
import { PATHS } from '@/router/paths'

type EmbeddedPost = NonNullable<FeedPost['originalPost']>

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
  const authorProfileUrl = PATHS.PROFILE.replace(':id', post.author.id)

  return (
    <div
      style={{
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        marginTop: 8,
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to={authorProfileUrl} style={{ flexShrink: 0, lineHeight: 0 }} aria-label={`View ${post.author.fullName}'s profile`}>
          <Avatar
            src={post.author.profile.avatarUrl}
            initials={getInitials(post.author.fullName)}
            color={avatarColor(post.author.id)}
            size={28}
          />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <RoleBadge role={post.author.role} size={13} />
            <Link
              to={authorProfileUrl}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}
            >
              {post.author.fullName}
            </Link>
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
        <div
          style={{
            maxHeight: 200,
            overflow: 'hidden',
            borderBottomLeftRadius: 'var(--r-md)',
            borderBottomRightRadius: 'var(--r-md)',
          }}
        >
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
