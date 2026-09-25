import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileX } from 'lucide-react'
import { getPostLifecycleState } from '@uniconnect/shared'
import { DetailUnavailable } from '@/components/DetailUnavailable'
import { isMissingError } from '@/lib/httpErrors'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { usePost } from '@/features/feed/hooks/usePost'
import { PATHS } from '@/router/paths'
import { useBackLink } from '@/hooks/useBackLink'

const STATE_LABEL: Record<string, string> = {
  draft: 'Draft — only you can see this',
  scheduled: 'Scheduled — not yet published',
  archived: 'Archived — hidden from your feed',
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const back = useBackLink({ path: PATHS.FEED, label: 'Back to feed' })
  const { data: post, isLoading, isError, error, refetch } = usePost(id)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const lifecycle = post ? getPostLifecycleState(post) : null
  const stateNote = lifecycle && lifecycle !== 'published' ? STATE_LABEL[lifecycle] : null

  if (!isLoading && (isError || !post)) {
    return isError && !isMissingError(error) ? (
      <DetailUnavailable
        kind="failed"
        title="We couldn't load this post"
        body="Check your connection and try again. If it keeps happening, the post may be temporarily unavailable."
        onRetry={() => void refetch()}
      />
    ) : (
      <DetailUnavailable
        kind="not-found"
        icon={FileX}
        title="Post not available"
        body="It was deleted, or the author only shares it with their connections."
        backLabel="Back to feed"
        onBack={() => navigate(PATHS.FEED)}
      />
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={back.goBack}
        className="row-hover-bg"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: 'var(--r-sm)',
        }}
      >
        <ArrowLeft size={15} strokeWidth={1.5} /> {back.label}
      </button>

      {isLoading || !post ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</p>
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
