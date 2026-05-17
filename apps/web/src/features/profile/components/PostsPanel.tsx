import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, FileText } from 'lucide-react'
import type { FeedPost } from '@uniconnect/shared'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { CreatePost } from '@/features/feed/components/CreatePost'
import { useProfilePosts } from '@/features/feed/hooks/useProfilePosts'
import { SkeletonPost } from '@/components/skeletons/SkeletonPost'
import { EmptyState } from '@/components/EmptyState'

interface Props {
  userId: string
  isOwnProfile: boolean
}

export function PostsPanel({ userId, isOwnProfile }: Props) {
  const navigate = useNavigate()
  const [openPost, setOpenPost] = useState<FeedPost | null>(null)
  const [editPost, setEditPost] = useState<FeedPost | null>(null)

  const { data, isLoading, isError, refetch, isRefetching } = useProfilePosts(userId)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonPost />
        <SkeletonPost />
      </div>
    )
  }

  if (isError) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '24px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <AlertCircle size={18} strokeWidth={1.5} color="var(--uc-red)" />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            Couldn't load posts
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
            }}
          >
            Check your connection and try again.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: '0.5px solid var(--border-hover)',
            borderRadius: 'var(--r-pill)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 400,
            cursor: isRefetching ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {isRefetching ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    )
  }

  const posts = data?.items ?? []

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={isOwnProfile ? "You haven't posted yet" : 'No posts yet'}
        description={
          isOwnProfile
            ? 'Share an update, ask a question, or post a poll. Your posts will appear here.'
            : "When this person shares something, you'll see it here."
        }
        action={
          isOwnProfile
            ? { label: 'Write a post', onClick: () => navigate('/feed') }
            : undefined
        }
      />
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onCommentClick={(postId) => {
              const p = posts.find((x) => x.id === postId) ?? null
              setOpenPost(p)
            }}
            onEditPost={(p) => setEditPost(p)}
          />
        ))}
      </div>

      {openPost && <CommentDrawer post={openPost} onClose={() => setOpenPost(null)} />}

      {/* Edit modal — renders above the page */}
      <CreatePost editPost={editPost} onDismissEdit={() => setEditPost(null)} />
    </>
  )
}
