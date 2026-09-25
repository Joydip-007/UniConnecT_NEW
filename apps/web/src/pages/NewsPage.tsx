import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Newspaper, Pencil, X } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { PATHS } from '@/router/paths'
import { useAuthStore } from '@/stores/authStore'
import { usePageRails } from '@/stores/pageRailStore'
import { AnnouncementStrip, NewsCard, NewsCategoryTabs, NewsRightRail, useNewsList } from '@/features/news'

/** Faculty and admins write for the board; everyone reads it. */
const WRITER_ROLES = new Set(['faculty', 'admin'])

export default function NewsPage() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? 'all'
  const tag = params.get('tag') ?? undefined
  const role = useAuthStore((s) => s.user?.role)
  const canCreate = Boolean(role && WRITER_ROLES.has(role))
  const isMobile = useMediaQuery('(max-width: 767px)')

  const rightRail = useMemo(() => <NewsRightRail />, [])
  usePageRails(null, rightRail)

  const { data, isLoading } = useNewsList({ category, tag })
  const news = data ?? []
  // Only All and notice feature the latest notice; every other category is the plain list.
  const announcement = !tag && (category === 'all' || category === 'notice') ? news.find((item) => item.isAnnouncement) : undefined
  const listed = announcement ? news.filter((item) => item.id !== announcement.id) : news

  function setCategory(next: string) {
    const nextParams = new URLSearchParams(params)
    if (next === 'all') nextParams.delete('category')
    else nextParams.set('category', next)
    setParams(nextParams, { replace: true })
  }

  function clearTag() {
    const nextParams = new URLSearchParams(params)
    nextParams.delete('tag')
    setParams(nextParams, { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12, paddingBottom: canCreate && isMobile ? 72 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <NewsCategoryTabs active={category} onChange={setCategory} scroll={isMobile} />
        {canCreate && !isMobile && (
          <Link to={PATHS.NEWS_NEW} style={writeButtonStyle}>
            <Pencil size={15} strokeWidth={1.5} />
            Write article
          </Link>
        )}
      </div>

      {tag && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Tagged</span>
          <button
            type="button"
            onClick={clearTag}
            aria-label={`Clear tag ${tag}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 12px', borderRadius: 'var(--r-pill)', background: 'var(--uc-indigo-bg)', border: '0.5px solid var(--uc-indigo-bdr)', color: 'var(--uc-indigo-xl)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {tag}
            <X size={12} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {announcement && <AnnouncementStrip item={announcement} />}

      {isLoading ? (
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>Loading news…</p>
      ) : listed.length === 0 && !announcement ? (
        <EmptyState
          icon={Newspaper}
          title="No news yet"
          description={tag ? `Nothing is tagged ${tag} yet.` : 'Official university updates will appear here.'}
        />
      ) : (
        <div style={{ display: 'grid', gap: isMobile ? 10 : 12 }}>
          {listed.map((item) => (
            <NewsCard key={item.id} item={item} stacked={isMobile} />
          ))}
        </div>
      )}

      {/* On a phone the create action floats above the bottom nav so it never covers a slot. */}
      {canCreate && isMobile && (
        <Link to={PATHS.NEWS_NEW} style={{ ...writeButtonStyle, position: 'fixed', bottom: 80, right: 16, zIndex: 50, minHeight: 48, padding: '0 20px' }}>
          <Pencil size={15} strokeWidth={1.5} />
          Write article
        </Link>
      )}
    </div>
  )
}

const writeButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 40,
  padding: '0 18px',
  borderRadius: 'var(--r-pill)',
  background: 'var(--uc-orange)',
  color: 'var(--on-accent)',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}
