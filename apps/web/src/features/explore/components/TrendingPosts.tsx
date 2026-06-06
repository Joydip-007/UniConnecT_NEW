import { Link } from 'react-router-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import type { TrendingPost } from '../types'

interface Props {
  posts: TrendingPost[]
}

export function TrendingPosts({ posts }: Props) {
  if (posts.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No trending posts yet.</p>
    )
  }

  return (
    <>
      {posts.map((post) => (
        <Link
          key={post.id}
          to={`/feed/${post.id}`}
          style={{
            flexShrink: 0,
            width: 220,
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
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {post.authorName} ·{' '}
            {formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {post.reactionCount} reactions · {post.commentCount} comments
          </div>
        </Link>
      ))}
    </>
  )
}
