import { Link } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { Newspaper, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useNewsList } from '@/features/news/hooks/useNews'
import { useShuttleNotices } from '../../hooks/useRiderStop'

/** How many campus news items follow the shuttle notices. */
const NEWS_SHOWN = 5

interface Row {
  key: string
  icon: LucideIcon
  bg: string
  fg: string
  title: string
  meta: string
  to?: string
}

function ago(iso: string) {
  return `${formatDistanceToNowStrict(new Date(iso))} ago`
}

/**
 * The driver's news: shuttle service notices first (the ones that change a shift),
 * then the latest campus news. News rows open the full article.
 */
export function DriverNewsTab() {
  const notices = useShuttleNotices()
  const news = useNewsList({ limit: NEWS_SHOWN })

  const rows: Row[] = [
    ...(notices.data ?? []).map((n) => ({
      key: `notice-${n.id}`,
      icon: n.tone === 'disruption' ? TriangleAlert : Newspaper,
      bg: n.tone === 'disruption' ? 'var(--uc-amber-bg)' : 'var(--uc-indigo-bg)',
      fg: n.tone === 'disruption' ? 'var(--uc-amber-l)' : 'var(--uc-indigo-l)',
      title: n.title,
      meta: n.detail ?? `Transport office · ${ago(n.createdAt)}`,
    })),
    ...(news.data ?? []).slice(0, NEWS_SHOWN).map((item) => ({
      key: `news-${item.id}`,
      icon: Newspaper,
      bg: 'var(--uc-indigo-bg)',
      fg: 'var(--uc-indigo-l)',
      title: item.title,
      meta: `${item.author?.fullName ?? 'Campus news'} · ${ago(item.publishedAt ?? item.createdAt)}`,
      to: `/news/${item.id}`,
    })),
  ]

  const loading = notices.isLoading || news.isLoading

  return (
    <>
      <h1 className="driver-h1">News</h1>
      <section className="driver-card driver-rows-card">
        {loading && <p style={{ margin: '12px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</p>}
        {!loading && rows.length === 0 && (
          <p style={{ margin: '12px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>No notices or news right now.</p>
        )}
        {rows.map((row, i) => {
          const Icon = row.icon
          const body = (
            <>
              <span
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--r-sm)',
                  background: row.bg,
                  color: row.fg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={15} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="driver-row-title" style={{ lineHeight: 1.4 }}>{row.title}</span>
                <span className="driver-row-meta" style={{ marginTop: 3 }}>{row.meta}</span>
              </span>
            </>
          )
          const style = {
            display: 'flex',
            gap: 12,
            padding: '13px 0',
            borderBottom: i < rows.length - 1 ? '0.5px solid var(--border-default)' : 'none',
            textDecoration: 'none',
            color: 'inherit',
          } as const
          return row.to ? (
            <Link key={row.key} to={row.to} style={style} className="driver-link-row">
              {body}
            </Link>
          ) : (
            <div key={row.key} style={style}>
              {body}
            </div>
          )
        })}
      </section>
    </>
  )
}
