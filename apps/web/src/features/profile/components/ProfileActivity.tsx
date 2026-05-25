import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedPost } from '@uniconnect/shared'

interface Props {
  userId: string
}

function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncateContent(text: string, max = 140): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

export function ProfileActivity({ userId }: Props) {
  const { data, isLoading } = useQuery<{ items: FeedPost[] }>({
    queryKey: ['profile', 'activity', userId],
    queryFn: () =>
      api
        .get<{ data: { items: FeedPost[] } }>('/feed', {
          params: { authorId: userId, limit: 3 },
        })
        .then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  })

  const posts = data?.items ?? []

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
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}
      >
        Activity
      </span>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                padding: '12px 0',
                borderBottom: i < 2 ? '0.5px solid var(--border-default)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div
                style={{
                  height: 13,
                  width: '80%',
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--r-sm)',
                }}
              />
              <div
                style={{
                  height: 11,
                  width: '30%',
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--r-sm)',
                }}
              />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            lineHeight: 1.6,
          }}
        >
          No recent activity.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {posts.map((post, idx) => (
            <div
              key={post.id}
              style={{
                padding: '12px 0',
                borderBottom:
                  idx < posts.length - 1 ? '0.5px solid var(--border-default)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                {truncateContent(post.content)}
              </p>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--text-tertiary)',
                }}
              >
                {formatDate(post.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
