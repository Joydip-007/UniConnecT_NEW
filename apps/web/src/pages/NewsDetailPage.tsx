import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { api } from '@/lib/axios'

interface NewsDetail {
  id: string
  title: string
  body: string
  coverUrl: string | null
  category: string
  publishedAt: string | null
  createdAt: string
  author: { fullName: string | null }
}

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['news', 'detail', id],
    queryFn: () => api.get<{ data: NewsDetail }>(`/news/${id}`).then((r) => r.data.data),
    enabled: Boolean(id),
  })

  if (isLoading) return <p style={mutedStyle}>Loading news…</p>
  if (!data) return <p style={mutedStyle}>News not found.</p>

  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link to="/news" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13 }}>
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to news
      </Link>
      {data.coverUrl && <img src={data.coverUrl} alt={data.title} style={{ width: '100%', maxHeight: 340, objectFit: 'cover', borderRadius: 'var(--r-lg)' }} />}
      <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 20 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-orange-l)' }}>{data.category}</p>
        <h1 style={{ margin: '6px 0 8px', fontSize: 26, fontWeight: 500, color: 'var(--text-primary)' }}>{data.title}</h1>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-tertiary)' }}>
          {format(parseISO(data.publishedAt ?? data.createdAt), 'MMM d, yyyy')} · {data.author.fullName ?? 'UniConnecT'}
        </p>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.75, color: 'var(--text-secondary)' }}>{data.body}</div>
      </div>
    </article>
  )
}

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 13,
}
