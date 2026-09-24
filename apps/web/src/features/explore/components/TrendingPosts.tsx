import { Link } from 'react-router-dom'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import type { TrendingPost } from '../types'
import { useExploreLinkState } from '../hooks/useExploreLinkState'
import { RoleBadge } from '@/components/RoleBadge'

interface Props {
  posts: TrendingPost[]
}

export function TrendingPosts({ posts }: Props) {
  const linkState = useExploreLinkState()
  if (posts.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No trending posts yet.</p>
    )
  }

  return (
    <>
      {posts.map((post) => (
        <Link
          state={linkState}
          key={post.id}
          to={`/feed/${post.id}`}
          style={{
            flexShrink: 0,
            // The design sizes this card content-box: 220 + 2×14 padding + 2×0.5 border.
            width: 249,
            scrollSnapAlign: 'start',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '12px 14px',
            textDecoration: 'none',
            display: 'block',
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-primary)',
              margin: '0 0 8px',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {post.content}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
            <RoleBadge role={post.authorRole} size={12} />
            {post.authorName} ·{' '}
            {formatDistanceToNowStrict(parseISO(post.createdAt), { addSuffix: true })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {post.reactionCount} reactions · {post.commentCount} comments
          </div>
        </Link>
      ))}
    </>
  )
}
