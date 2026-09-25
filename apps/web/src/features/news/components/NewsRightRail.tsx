import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { BookOpen, Globe, GraduationCap, Stamp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageRailCard, SkeletonLine } from '@/components/rightRail/primitives'
import { useNewsRail } from '../hooks/useNews'
import type { NewsSourceKind } from '../types'

const SOURCE_ICON: Record<NewsSourceKind, LucideIcon> = {
  admin: Stamp,
  website: Globe,
  department: GraduationCap,
}

/** Cycled per row so neighbouring sources never share a tone. */
const SOURCE_TONES = [
  { bg: 'var(--uc-orange-bg)', fg: 'var(--uc-orange-l)' },
  { bg: 'var(--uc-indigo-bg)', fg: 'var(--uc-indigo-xl)' },
  { bg: 'var(--uc-cyan-bg)', fg: 'var(--uc-cyan)' },
  { bg: 'var(--uc-mint-bg)', fg: 'var(--uc-mint)' },
]

/**
 * The news right rail: who publishes, what dates are coming up, and which tags are
 * being written about. Every row addresses something specific — an article or a tag
 * filter — so nothing here repeats a left-rail row.
 */
export function NewsRightRail() {
  const { data, isLoading } = useNewsRail()

  if (isLoading) {
    return (
      <PageRailCard title="Official sources">
        <SkeletonLine width="70%" />
        <SkeletonLine width="55%" />
        <SkeletonLine width="62%" />
      </PageRailCard>
    )
  }

  const sources = data?.sources ?? []
  const keyDates = data?.keyDates ?? []
  const tags = data?.trendingTags ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageRailCard title="Official sources">
        {sources.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Nothing published in the last 90 days.</p>
        ) : (
          sources.map((source, index) => {
            const Icon = SOURCE_ICON[source.kind] ?? BookOpen
            const tone = SOURCE_TONES[index % SOURCE_TONES.length]
            return (
              <div
                key={source.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  paddingTop: index === 0 ? 0 : 12,
                  borderTop: index === 0 ? 'none' : '0.5px solid var(--border-default)',
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: tone.bg, color: tone.fg }}>
                  <Icon size={14} strokeWidth={1.5} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {source.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {source.count} {source.count === 1 ? 'post' : 'posts'}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </PageRailCard>

      {keyDates.length > 0 && (
        <PageRailCard title="Key dates">
          {keyDates.map((entry) => {
            const date = parseISO(entry.date)
            return (
              <Link key={entry.newsId} to={`/news/${entry.newsId}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                <div style={{ width: 42, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', borderRadius: 'var(--r-sm)', background: 'var(--uc-indigo-bg)' }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--uc-indigo-xl)', lineHeight: 1 }}>{format(date, 'd')}</span>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', color: 'var(--uc-indigo-l)' }}>{format(date, 'MMM')}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{entry.title}</span>
              </Link>
            )
          })}
        </PageRailCard>
      )}

      {tags.length > 0 && (
        <PageRailCard title="Trending now">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tags.map((tag) => (
              <Link
                key={tag}
                to={`/news?tag=${encodeURIComponent(tag)}`}
                style={{ padding: '4px 12px', borderRadius: 'var(--r-pill)', fontSize: 12, background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)', color: 'var(--text-secondary)', textDecoration: 'none' }}
              >
                {tag}
              </Link>
            ))}
          </div>
        </PageRailCard>
      )}
    </div>
  )
}
