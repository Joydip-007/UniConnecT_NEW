import { Link } from 'react-router-dom'
import { Megaphone, Newspaper, Share2 } from 'lucide-react'
import { ShareMenu } from '@/components/ShareMenu'
import type { NewsItem } from '../types'
import { newsDate, newsExcerpt } from '../utils'

/** The cover, or a quiet placeholder tile so every card keeps the same rhythm. */
export function NewsCover({ url, alt, width, height, radius }: { url: string | null; alt: string; width: number | string; height: number; radius?: string }) {
  if (url) {
    return <img src={url} alt={alt} style={{ width, height, objectFit: 'cover', borderRadius: radius, display: 'block', flexShrink: 0 }} />
  }
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        flexShrink: 0,
        background: 'var(--surface-raised)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-tertiary)',
      }}
    >
      <Newspaper size={22} strokeWidth={1.5} />
    </div>
  )
}

/** Stops the share control inside a card-wide link from also navigating. */
function ShareSlot({ item }: { item: NewsItem }) {
  return (
    <span
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      style={{ display: 'inline-flex', flexShrink: 0 }}
    >
      <ShareMenu entityType="news" entityId={item.id} title={item.title}>
        {({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-label={`Share ${item.title}`}
            style={{ display: 'inline-flex', padding: 4, margin: -4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: 'var(--r-pill)' }}
          >
            <Share2 size={14} strokeWidth={1.5} />
          </button>
        )}
      </ShareMenu>
    </span>
  )
}

export function NewsCard({ item, stacked = false }: { item: NewsItem; stacked?: boolean }) {
  const meta = `${newsDate(item)} · ${item.author.fullName ?? 'UniConnecT'}`

  if (stacked) {
    return (
      <Link
        to={`/news/${item.id}`}
        style={{ display: 'block', textDecoration: 'none', background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}
      >
        <NewsCover url={item.coverUrl} alt={item.title} width="100%" height={150} />
        <div style={{ padding: '12px 14px 14px' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-orange-l)' }}>{item.category}</p>
          <h2 style={{ margin: '4px 0 6px', fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>{item.title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{newsExcerpt(item)}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{meta}</p>
            <ShareSlot item={item} />
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/news/${item.id}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: 14,
        padding: 14,
        textDecoration: 'none',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      <NewsCover url={item.coverUrl} alt={item.title} width={140} height={96} radius="var(--r-md)" />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-orange-l)' }}>{item.category}</p>
        <h2 style={{ margin: '4px 0 6px', fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>{item.title}</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{newsExcerpt(item)}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{meta}</p>
          <ShareSlot item={item} />
        </div>
      </div>
    </Link>
  )
}

/**
 * The featured notice. A tinted block with a full hairline in `--uc-orange-l` — never a
 * side stripe — and it only shows under All and notice (the page decides).
 */
export function AnnouncementStrip({ item }: { item: NewsItem }) {
  return (
    <Link
      to={`/news/${item.id}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        padding: 14,
        background: 'var(--uc-orange-bg)',
        border: '0.5px solid var(--uc-orange-l)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-orange-l)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Megaphone size={13} strokeWidth={1.5} /> Announcement
      </p>
      <h2 style={{ margin: '6px 0 4px', fontSize: 16, fontWeight: 500, color: 'var(--uc-orange-l)', lineHeight: 1.35 }}>{item.title}</h2>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--uc-orange-l)', opacity: 0.85, lineHeight: 1.5 }}>{newsExcerpt(item)}</p>
    </Link>
  )
}
