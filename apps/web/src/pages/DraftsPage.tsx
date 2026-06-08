import { useNavigate } from 'react-router-dom'
import { Archive, Clock, FileText } from 'lucide-react'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { useMyDrafts, usePublishDraft, type DraftItem, type DraftKind } from '@/features/drafts'
import { useArchivedPosts } from '@/features/feed/hooks/useArchivedPosts'
import { useUnarchivePost } from '@/features/feed/hooks/useArchivePost'

function isScheduled(item: DraftItem): boolean {
  return Boolean(item.publishAt) && new Date(item.publishAt as string).getTime() > Date.now()
}

const KIND_LABEL: Record<DraftKind, string> = {
  post: 'Post',
  job: 'Job',
  news: 'News',
  event: 'Event',
}

const KIND_COLOR: Record<DraftKind, { fg: string; bg: string }> = {
  post: { fg: 'var(--uc-indigo-xl)', bg: 'var(--uc-indigo-bg)' },
  job: { fg: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)' },
  news: { fg: 'var(--uc-orange-l)', bg: 'var(--uc-orange-bg)' },
  event: { fg: 'var(--uc-orange-l)', bg: 'var(--uc-orange-bg)' },
}

function detailPath(item: DraftItem): string | null {
  switch (item.kind) {
    case 'job':
      return `/jobs/${item.id}`
    case 'news':
      return `/news/${item.id}`
    case 'event':
      return `/events/${item.id}`
    case 'post':
      return `/feed/${item.id}` // permalink shows the author their draft/scheduled post
    default:
      return null
  }
}

export default function DraftsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useMyDrafts()
  const publish = usePublishDraft()
  const archived = useArchivedPosts()
  const unarchive = useUnarchivePost()
  const items = data?.items ?? []
  const archivedItems = archived.data?.items ?? []

  return (
    <div style={{ padding: '20px 0 0' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Drafts</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>
          Your unpublished posts, jobs, news and events. Only you can see these.
        </p>
      </header>

      {isLoading ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : isError ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '48px 16px',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            color: 'var(--text-tertiary)',
          }}
        >
          <FileText size={24} strokeWidth={1.5} />
          <p style={{ margin: 0, fontSize: 14 }}>Could not load your drafts. Please try again.</p>
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '48px 16px',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            color: 'var(--text-tertiary)',
          }}
        >
          <FileText size={24} strokeWidth={1.5} />
          <p style={{ margin: 0, fontSize: 14 }}>No drafts yet. Save anything as a draft to find it here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => {
            const color = KIND_COLOR[item.kind]
            const to = detailPath(item)
            return (
              <div
                key={`${item.kind}-${item.id}`}
                style={{
                  background: 'var(--surface-card)',
                  border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-lg)',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: color.fg,
                      background: color.bg,
                      borderRadius: 'var(--r-pill)',
                      padding: '2px 10px',
                    }}
                  >
                    {KIND_LABEL[item.kind]}
                  </span>
                  {isScheduled(item) ? (
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 500, color: 'var(--uc-indigo-xl)', background: 'var(--uc-indigo-bg)',
                        borderRadius: 'var(--r-pill)', padding: '2px 10px',
                      }}
                    >
                      <Clock size={11} strokeWidth={1.5} />
                      Scheduled · {new Date(item.publishAt as string).toLocaleString()}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Updated {new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {item.title}
                </p>
                {item.excerpt && (
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 13,
                      fontWeight: 400,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.excerpt}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <PrimaryBtn
                    onClick={() => publish.mutate({ kind: item.kind, id: item.id })}
                    disabled={publish.isPending}
                  >
                    Publish
                  </PrimaryBtn>
                  {to && <GhostBtn onClick={() => navigate(to)}>Open</GhostBtn>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {archivedItems.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              margin: '0 0 4px', fontSize: 16, fontWeight: 500, color: 'var(--text-primary)',
            }}
          >
            <Archive size={16} strokeWidth={1.5} /> Archived
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Hidden from your feed. Restore one to make it public again.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {archivedItems.map((post) => (
              <div
                key={post.id}
                style={{
                  background: 'var(--surface-card)',
                  border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-lg)',
                  padding: 16,
                }}
              >
                <p
                  style={{
                    margin: 0, fontSize: 14, fontWeight: 400, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}
                >
                  {post.content || '(no text)'}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <GhostBtn onClick={() => unarchive.mutate(post.id)} disabled={unarchive.isPending}>
                    Restore
                  </GhostBtn>
                  <GhostBtn onClick={() => navigate(`/feed/${post.id}`)}>Open</GhostBtn>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
