import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Newspaper, Plus, Megaphone } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { api } from '@/lib/axios'
import { EmptyState } from '@/components/EmptyState'
import { OrangeBtn } from '@/components/Button'
import { ShareMenu } from '@/components/ShareMenu'
import { useAuthStore } from '@/stores/authStore'
import { CreateNewsForm } from '@/features/news/components/CreateNewsForm'

interface NewsItem {
  id: string
  title: string
  slug: string
  body: string
  coverUrl: string | null
  category: string
  isAnnouncement?: boolean
  publishedAt: string | null
  createdAt: string
  author: { fullName: string | null }
}

interface NewsPageData {
  items: NewsItem[]
}

const CATEGORIES = ['all', 'notice', 'academic', 'events', 'campus'] as const

export default function NewsPage() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? 'all'
  const role = useAuthStore((s) => s.user?.role)
  const canCreate = role === 'faculty' || role === 'admin'
  const [showCreate, setShowCreate] = useState(false)

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
  const announcement = (category === 'all' || category === 'notice')
    ? news.find((item) => item.isAnnouncement)
    : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: canCreate ? 80 : 0 }}>
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

      {announcement && (
        <Link
          to={`/news/${announcement.id}`}
          style={{
            display: 'block',
            textDecoration: 'none',
            padding: 16,
            background: 'var(--uc-orange-bg)',
            border: '0.5px solid var(--uc-orange-l)',
            borderRadius: 'var(--r-lg)',
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-orange-l)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Megaphone size={13} /> Announcement
          </p>
          <h2 style={{ margin: '6px 0 4px', fontSize: 17, fontWeight: 500, color: 'var(--uc-orange-l)' }}>{announcement.title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--uc-orange-l)', opacity: 0.85, lineHeight: 1.5 }}>
            {announcement.body.slice(0, 160)}{announcement.body.length > 160 ? '…' : ''}
          </p>
        </Link>
      )}

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
                <img src={item.coverUrl} alt={item.title} style={{ width: 140, height: 96, objectFit: 'cover', borderRadius: 'var(--r-md)' }} />
              )}
              <div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-orange-l)' }}>{item.category}</p>
                <h2 style={{ margin: '4px 0 6px', fontSize: 17, fontWeight: 500, color: 'var(--text-primary)' }}>{item.title}</h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {item.body.slice(0, 160)}{item.body.length > 160 ? '…' : ''}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {format(parseISO(item.publishedAt ?? item.createdAt), 'MMM d, yyyy')} · {item.author.fullName ?? 'UniConnecT'}
                  </p>
                  {/* The card is a Link; stop the share control from triggering navigation. */}
                  <span onClick={(e) => { e.preventDefault(); e.stopPropagation() }} style={{ display: 'inline-flex' }}>
                    <ShareMenu entityType="news" entityId={item.id} title={item.title} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {/* Floating create button — faculty / admin only */}
      {canCreate && (
        <OrangeBtn
          onClick={() => setShowCreate(true)}
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            zIndex: 50,
          }}
        >
          <Plus size={15} strokeWidth={2} />
          Write article
        </OrangeBtn>
      )}

      {showCreate && <CreateNewsForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 13,
}
