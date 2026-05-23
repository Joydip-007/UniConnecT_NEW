import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, Hash, AlertCircle } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useTagPosts } from '@/features/explore/hooks/useTagPosts'
import { PATHS } from '@/router/paths'

function SkeletonCard() {
  return (
    <div
      style={{
        height: 88,
        borderRadius: 'var(--r-lg)',
        background: 'var(--surface-raised)',
        marginBottom: 10,
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  )
}

export default function TagPage() {
  const { tag = '' } = useParams<{ tag: string }>()

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTagPosts(tag)

  const allPages = data?.pages ?? []
  const total = allPages[0]?.total ?? 0
  const relatedTags = allPages[0]?.relatedTags ?? []
  const items = allPages.flatMap((p) => p.items)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 80px' }}>
      {/* Back link */}
      <Link
        to={PATHS.EXPLORE}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Explore
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Hash size={20} style={{ color: 'var(--uc-indigo-xl)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          {tag}
        </h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        {isLoading ? '…' : `${total} post${total !== 1 ? 's' : ''}`}
      </p>

      {/* Related tags */}
      {relatedTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {relatedTags.map((rt) => (
            <Link
              key={rt}
              to={PATHS.TAG.replace(':tag', rt)}
              style={{
                padding: '3px 10px',
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--border-default)',
                background: 'var(--surface-raised)',
                color: 'var(--uc-indigo-xl)',
                fontSize: 12,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              #{rt}
            </Link>
          ))}
        </div>
      )}

      {/* Post list */}
      {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

      {isError && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          <AlertCircle size={36} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0 }}>Something went wrong. Try again later.</p>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)' }}>
          <Hash size={40} style={{ marginBottom: 12, color: 'var(--text-tertiary)' }} />
          <p style={{ fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            No posts for #{tag} yet
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>Be the first to use this hashtag!</p>
        </div>
      )}

      {items.map((post) => (
        <div
          key={post.id}
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '14px 16px',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {post.authorName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-primary)',
              lineHeight: 1.6,
              margin: '0 0 8px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {post.content}
          </p>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {post.reactionCount} reactions · {post.commentCount} comments
          </div>
        </div>
      ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 8,
            padding: '10px',
            fontSize: 13,
            color: 'var(--uc-indigo-xl)',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            cursor: isFetchingNextPage ? 'default' : 'pointer',
            fontWeight: 500,
          }}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
