import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { useMyDrafts, usePublishDraft, type DraftItem, type DraftKind } from '@/features/drafts'

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
    default:
      return null // posts have no standalone page
  }
}

export default function DraftsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useMyDrafts()
  const publish = usePublishDraft()
  const items = data?.items ?? []

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Drafts</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>
          Your unpublished posts, jobs, news and events. Only you can see these.
        </p>
      </header>

      {isLoading ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</p>
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
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Updated {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
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
    </div>
  )
}
