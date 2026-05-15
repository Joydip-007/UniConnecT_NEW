import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Newspaper } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { api } from '@/lib/axios'
import { EmptyState } from '@/components/EmptyState'

interface NewsItem {
  id: string
  title: string
  slug: string
  body: string
  coverUrl: string | null
  category: string
  publishedAt: string | null
  createdAt: string
  author: { fullName: string | null }
}

interface NewsPageData {
  items: NewsItem[]
}

const CATEGORIES = ['all', 'academic', 'events', 'campus'] as const

export default function NewsPage() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? 'all'

  const { data, isLoading } = useQuery({
    queryKey: ['news', 'list', { category }],
    queryFn: () =>
      api
        .get<{ data: NewsPageData }>('/news', {
          params: category === 'all' ? undefined : { category },
        })
        .then((r) => r.data.data.items),
  })

  const news = data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <nav style={{ display: 'flex', gap: 6, background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 6 }}>
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setParams(item === 'all' ? {} : { category: item }, { replace: true })}
            style={{
              border: 'none',
              borderRadius: 'var(--r-pill)',
              padding: '7px 12px',
              cursor: 'pointer',
              background: category === item ? 'var(--uc-indigo-bg)' : 'transparent',
              color: category === item ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: category === item ? 500 : 400,
            }}
          >
            {item === 'all' ? 'All' : item}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <p style={mutedStyle}>Loading news…</p>
      ) : news.length === 0 ? (
        <EmptyState icon={Newspaper} title="No news yet" description="Official university updates will appear here." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {news.map((item) => (
            <Link
              key={item.id}
              to={`/news/${item.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: item.coverUrl ? '140px 1fr' : '1fr',
                gap: 14,
                padding: 14,
                textDecoration: 'none',
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              {item.coverUrl && (
                <img src={item.coverUrl} alt="" style={{ width: 140, height: 96, objectFit: 'cover', borderRadius: 'var(--r-md)' }} />
              )}
              <div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-orange-l)' }}>{item.category}</p>
                <h2 style={{ margin: '4px 0 6px', fontSize: 17, fontWeight: 500, color: 'var(--text-primary)' }}>{item.title}</h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {item.body.slice(0, 160)}{item.body.length > 160 ? '…' : ''}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {format(parseISO(item.publishedAt ?? item.createdAt), 'MMM d, yyyy')} · {item.author.fullName ?? 'UniConnecT'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 13,
}
