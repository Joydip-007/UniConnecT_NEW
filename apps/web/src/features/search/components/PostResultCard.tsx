import { Avatar } from '@/components/Avatar'
import { highlightMatch } from '@/utils/highlightMatch'
import type { PostSearchResult } from '../types'

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']

function seedColor(id: string): string {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]!
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface Props {
  post: PostSearchResult
  query: string
}

export function PostResultCard({ post, query }: Props) {
  const color = seedColor(post.author.id)
  const initials = getInitials(post.author.fullName)

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '0.5px solid var(--border-default)',
        display: 'flex',
        gap: 10,
      }}
    >
      <Avatar initials={initials} color={color} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'baseline',
            marginBottom: 2,
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>
            {post.author.fullName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{timeAgo(post.createdAt)}</span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {highlightMatch(post.content, query)}
        </div>
        <div style={{ marginTop: 4, display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>{post.reactionCount} reactions</span>
          <span>{post.commentCount} comments</span>
        </div>
      </div>
    </div>
  )
}
