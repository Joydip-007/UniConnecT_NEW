import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileQuestion } from 'lucide-react'
import { getPostLifecycleState } from '@uniconnect/shared'
import { GhostBtn } from '@/components/Button'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { usePost } from '@/features/feed/hooks/usePost'
import { PATHS } from '@/router/paths'

const STATE_LABEL: Record<string, string> = {
  draft: 'Draft — only you can see this',
  scheduled: 'Scheduled — not yet published',
  archived: 'Archived — hidden from your feed',
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: post, isLoading, isError } = usePost(id)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const lifecycle = post ? getPostLifecycleState(post) : null
  const stateNote = lifecycle && lifecycle !== 'published' ? STATE_LABEL[lifecycle] : null

  return (
    <div style={{ padding: '20px 0 0' }}>
      <button
        type="button"
        onClick={() => navigate(PATHS.FEED)}
        className="row-hover-bg"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: 'var(--r-sm)',
        }}
      >
        <ArrowLeft size={15} strokeWidth={1.5} /> Back to feed
      </button>

      {isLoading ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : isError || !post ? (
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '48px 16px', background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', color: 'var(--text-tertiary)',
          }}
        >
          <FileQuestion size={24} strokeWidth={1.5} />
          <p style={{ margin: 0, fontSize: 14 }}>This post isn't available.</p>
          <GhostBtn onClick={() => navigate(PATHS.FEED)}>Go to feed</GhostBtn>
        </div>
      ) : (
        <>
          {stateNote && (
            <p
              style={{
                margin: '0 0 10px', fontSize: 12, fontWeight: 500,
                color: 'var(--uc-orange-l)', background: 'var(--uc-orange-bg)',
                border: '0.5px solid var(--uc-orange-bdr)', borderRadius: 'var(--r-pill)', padding: '4px 12px',
                display: 'inline-block',
              }}
            >
              {stateNote}
            </p>
          )}
          <PostCard
            post={post}
            onCommentClick={() => setDrawerOpen(true)}
            onEditPost={() => navigate(PATHS.FEED)}
          />
          {drawerOpen && <CommentDrawer post={post} onClose={() => setDrawerOpen(false)} />}
        </>
      )}
    </div>
  )
}
