import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { ContentAttachment } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { ImageLightbox } from '@/components/ImageLightbox'
import { AttachmentList } from '@/features/content-sync'
import { CreateNewsForm } from '@/features/news/components/CreateNewsForm'

interface NewsDetail {
  id: string
  title: string
  body: string
  coverUrl: string | null
  category: string
  isPublished: boolean
  isImported: boolean
  authorId: string
  publishedAt: string | null
  createdAt: string
  author: { fullName: string | null }
  attachments?: ContentAttachment[]
}

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['news', 'detail', id],
    queryFn: () => api.get<{ data: NewsDetail }>(`/news/${id}`).then((r) => r.data.data),
    enabled: Boolean(id),
  })

  const publishMutation = useMutation({
    mutationFn: (next: boolean) => api.patch(`/news/${id}`, { is_published: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] })
      queryClient.invalidateQueries({ queryKey: ['news', 'detail', id] })
      queryClient.invalidateQueries({ queryKey: ['content-sync', 'pending'] })
    },
  })

  if (isLoading) return <p style={mutedStyle}>Loading news…</p>
  if (!data) return <p style={mutedStyle}>News not found.</p>

  // Authors can edit their own article; admins can edit any news item.
  const canEdit = Boolean(user && (user.id === data.authorId || user.role === 'admin'))

  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link to="/news" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13 }}>
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to news
      </Link>

      {data.coverUrl && (
        <img
          src={data.coverUrl}
          alt={data.title}
          role="button"
          tabIndex={0}
          onClick={() => setLightboxOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxOpen(true) } }}
          style={{ width: '100%', maxHeight: 340, objectFit: 'cover', borderRadius: 'var(--r-lg)', cursor: 'zoom-in' }}
        />
      )}

      <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 20 }}>
        {/* Editor toolbar — only for the author or an admin reviewing an imported draft */}
        {canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {!data.isPublished && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--uc-orange-l)',
                  background: 'var(--uc-orange-bg)',
                  borderRadius: 'var(--r-pill)',
                  padding: '2px 10px',
                }}
              >
                Draft
              </span>
            )}
            <GhostBtn onClick={() => setEditing(true)}>
              <Pencil size={13} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
              Edit
            </GhostBtn>
            {data.isPublished ? (
              <GhostBtn onClick={() => publishMutation.mutate(false)} disabled={publishMutation.isPending}>
                Unpublish
              </GhostBtn>
            ) : (
              <OrangeBtn onClick={() => publishMutation.mutate(true)} disabled={publishMutation.isPending}>
                {publishMutation.isPending ? 'Publishing…' : 'Publish'}
              </OrangeBtn>
            )}
          </div>
        )}

        <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-orange-l)' }}>{data.category}</p>
        <h1 style={{ margin: '6px 0 8px', fontSize: 26, fontWeight: 500, color: 'var(--text-primary)' }}>{data.title}</h1>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-tertiary)' }}>
          {format(parseISO(data.publishedAt ?? data.createdAt), 'MMM d, yyyy')} · {data.author.fullName ?? 'UniConnecT'}
        </p>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.75, color: 'var(--text-secondary)' }}>{data.body}</div>
        <AttachmentList attachments={data.attachments} />
      </div>

      {editing && (
        <CreateNewsForm
          onClose={() => setEditing(false)}
          initial={{
            id: data.id,
            title: data.title,
            body: data.body,
            category: data.category,
            coverUrl: data.coverUrl,
            isPublished: data.isPublished,
            attachments: data.attachments,
          }}
        />
      )}

      {lightboxOpen && data.coverUrl && (
        <ImageLightbox images={[data.coverUrl]} onClose={() => setLightboxOpen(false)} />
      )}
    </article>
  )
}

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 13,
}
