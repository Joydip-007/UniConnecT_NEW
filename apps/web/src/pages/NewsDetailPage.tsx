import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Newspaper, Pencil, Send, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { ImageLightbox } from '@/components/ImageLightbox'
import { ShareMenu } from '@/components/ShareMenu'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuthStore } from '@/stores/authStore'
import { usePageRails } from '@/stores/pageRailStore'
import { AttachmentList } from '@/features/content-sync'
import {
  NewsRightRail,
  authorInitials,
  newsDate,
  newsSource,
  readMinutes,
  useNewsDetail,
  useNewsList,
  useSetNewsPublished,
} from '@/features/news'

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const rightRail = useMemo(() => <NewsRightRail />, [])
  usePageRails(null, rightRail)

  const { data, isLoading } = useNewsDetail(id)
  const { data: latest } = useNewsList({ limit: 4 })
  const publish = useSetNewsPublished(id ?? '')

  if (isLoading) return <p style={mutedStyle}>Loading news…</p>
  if (!data) return <p style={mutedStyle}>News not found.</p>

  // The author edits their own article; an admin can edit any.
  const canEdit = Boolean(user && (user.id === data.authorId || user.role === 'admin'))
  const related = (latest ?? []).filter((item) => item.id !== data.id).slice(0, 3)
  const byline = [
    !isMobile && newsSource(data.author, data.isImported),
    newsDate(data),
    `${readMinutes(data.body)} minute read`,
  ].filter(Boolean).join(' · ')

  function togglePublished() {
    if (!data) return
    if (data.isPublished && !window.confirm('Unpublish this article? It moves back to your drafts.')) return
    publish.mutate(!data.isPublished, {
      onSuccess: () => toast.success(data.isPublished ? 'Moved back to drafts' : 'Published to the news feed'),
      onError: () => toast.error('Could not update the article'),
    })
  }

  const actionPill: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: isMobile ? 38 : 34,
    width: isMobile ? 38 : undefined,
    padding: isMobile ? 0 : '0 14px',
    borderRadius: 'var(--r-pill)',
    border: `0.5px solid ${isMobile ? 'var(--border-default)' : 'var(--border-hover)'}`,
    background: isMobile ? 'var(--surface-raised)' : 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'none',
    fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!isMobile && (
        <button
          type="button"
          onClick={() => navigate('/news')}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: 'var(--r-sm)', fontFamily: 'inherit' }}
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Back to news
        </button>
      )}

      <article style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {data.coverUrl && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label={`Open image for ${data.title}`}
            style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}
          >
            <img src={data.coverUrl} alt={data.title} style={{ width: '100%', height: isMobile ? 170 : 260, objectFit: 'cover', display: 'block' }} />
          </button>
        )}

        <div style={{ padding: isMobile ? 14 : 20, display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ padding: '2px 10px', borderRadius: 'var(--r-pill)', background: 'var(--uc-orange-bg)', border: '0.5px solid var(--uc-orange-bdr)', color: 'var(--uc-orange-l)', fontSize: 12, fontWeight: 500 }}>
                {data.category}
              </span>
              {!data.isPublished && (
                <span style={{ padding: '2px 10px', borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: 12 }}>
                  Draft
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexShrink: 0 }}>
              {canEdit && isMobile && (
                <Link to={`/news/${data.id}/edit`} aria-label="Edit article" title="Edit" style={actionPill}>
                  <Pencil size={15} strokeWidth={1.5} />
                </Link>
              )}
              {data.isPublished && (
                <ShareMenu entityType="news" entityId={data.id} title={data.title}>
                  {({ toggle }) => (
                    <button type="button" onClick={toggle} aria-label="Share article" title="Share" style={actionPill}>
                      <Share2 size={isMobile ? 15 : 14} strokeWidth={1.5} />
                      {!isMobile && 'Share'}
                    </button>
                  )}
                </ShareMenu>
              )}
              {canEdit && !isMobile && (
                <Link to={`/news/${data.id}/edit`} style={{ ...actionPill, color: 'var(--text-primary)' }}>
                  <Pencil size={14} strokeWidth={1.5} />
                  Edit
                </Link>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={togglePublished}
                  disabled={publish.isPending}
                  title={data.isPublished ? 'Unpublish' : 'Publish to the news feed'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: isMobile ? 5 : 6,
                    minHeight: isMobile ? 38 : 34,
                    padding: isMobile ? '0 12px' : '0 16px',
                    borderRadius: 'var(--r-pill)',
                    border: data.isPublished ? '0.5px solid var(--uc-mint-bdr)' : 'none',
                    background: data.isPublished ? 'var(--uc-mint-bg)' : 'var(--uc-orange)',
                    color: data.isPublished ? 'var(--uc-mint)' : 'var(--on-accent)',
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: 500,
                    cursor: publish.isPending ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {data.isPublished ? <CheckCircle2 size={14} strokeWidth={1.5} /> : <Send size={14} strokeWidth={1.5} />}
                  {publish.isPending ? 'Saving…' : data.isPublished ? 'Published' : 'Publish'}
                </button>
              )}
            </div>
          </div>

          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3, textWrap: 'pretty' }}>
            {data.title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: isMobile ? 10 : 14, borderBottom: '0.5px solid var(--border-default)' }}>
            <Avatar src={data.author.avatarUrl} initials={authorInitials(data.author.fullName)} color={`var(--role-${data.author.role}, var(--uc-indigo))`} size={isMobile ? 32 : 34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{data.author.fullName ?? 'UniConnecT'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{byline}</div>
            </div>
          </div>

          <div style={{ margin: 0, fontSize: isMobile ? 14 : 15, lineHeight: isMobile ? 1.7 : 1.72, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>
            {data.body}
          </div>

          <AttachmentList attachments={data.attachments} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 14, borderTop: '0.5px solid var(--border-default)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Filed under</span>
            <Link to={`/news?category=${encodeURIComponent(data.category)}`} style={chipStyle}>{data.category}</Link>
            {data.tags.map((tag) => (
              <Link key={tag} to={`/news?tag=${encodeURIComponent(tag)}`} style={chipStyle}>{tag}</Link>
            ))}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)' }}>More from news</h2>
          {related.map((item, index) => (
            <Link
              key={item.id}
              to={`/news/${item.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: index < related.length - 1 ? '0.5px solid var(--border-default)' : 'none', textDecoration: 'none' }}
            >
              <span style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: 'var(--uc-orange-bg)', color: 'var(--uc-orange-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Newspaper size={15} strokeWidth={1.5} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{newsDate(item)} · {item.author.fullName ?? 'UniConnecT'}</div>
              </div>
            </Link>
          ))}
        </section>
      )}

      {lightboxOpen && data.coverUrl && <ImageLightbox images={[data.coverUrl]} onClose={() => setLightboxOpen(false)} />}
    </div>
  )
}

const chipStyle: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 'var(--r-pill)',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  fontSize: 12,
  color: 'var(--text-secondary)',
  textDecoration: 'none',
}

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 13,
}
