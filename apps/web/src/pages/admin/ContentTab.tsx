import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import {
  Pin, PinOff, Eye, EyeOff, Power, PowerOff, Trash2, AlertTriangle,
  FileText, Calendar, Briefcase, Newspaper, type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/axios'
import { Avatar } from '@/components/Avatar'
import { GhostBtn } from '@/components/Button'

// ── Types ──────────────────────────────────────────────────────────────────────

type ContentKind = 'posts' | 'events' | 'jobs' | 'news'

interface AuthorMeta {
  id: string
  fullName: string | null
  avatarUrl: string | null
}

interface AdminPostItem {
  id: string
  content: string
  mediaUrls: string[]
  type: string
  isPinned: boolean
  viewCount: number
  reactionCount: number
  commentCount: number
  createdAt: string
  author: AuthorMeta
}

interface AdminEventItem {
  id: string
  title: string
  description: string
  location: string
  coverUrl: string | null
  startsAt: string
  endsAt: string | null
  isPublished: boolean
  type: string
  rsvpCount: number
  createdAt: string
  organizer: AuthorMeta
}

interface AdminJobItem {
  id: string
  title: string
  company: string
  location: string
  type: string
  salaryRange: string | null
  deadline: string
  isActive: boolean
  viewCount: number
  applicationCount: number
  createdAt: string
  poster: AuthorMeta
}

interface AdminNewsItem {
  id: string
  title: string
  slug: string
  coverUrl: string | null
  category: string
  isPublished: boolean
  isPinned: boolean
  viewCount: number
  publishedAt: string | null
  createdAt: string
  author: AuthorMeta
}

type AdminContentItem = AdminPostItem | AdminEventItem | AdminJobItem | AdminNewsItem

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

type Filter = 'all' | 'pinned' | 'published' | 'unpublished' | 'active' | 'closed'

interface KindConfig {
  label: string
  icon: LucideIcon
  filters: { label: string; value: Filter }[]
  emptyLabel: string
}

const KIND_CONFIG: Record<ContentKind, KindConfig> = {
  posts: {
    label: 'Posts',
    icon: FileText,
    filters: [
      { label: 'All', value: 'all' },
      { label: 'Pinned', value: 'pinned' },
    ],
    emptyLabel: 'No posts yet',
  },
  events: {
    label: 'Events',
    icon: Calendar,
    filters: [
      { label: 'All', value: 'all' },
      { label: 'Published', value: 'published' },
      { label: 'Drafts', value: 'unpublished' },
    ],
    emptyLabel: 'No events yet',
  },
  jobs: {
    label: 'Jobs',
    icon: Briefcase,
    filters: [
      { label: 'All', value: 'all' },
      { label: 'Active', value: 'active' },
      { label: 'Closed', value: 'closed' },
    ],
    emptyLabel: 'No jobs yet',
  },
  news: {
    label: 'News',
    icon: Newspaper,
    filters: [
      { label: 'All', value: 'all' },
      { label: 'Published', value: 'published' },
      { label: 'Drafts', value: 'unpublished' },
      { label: 'Pinned', value: 'pinned' },
    ],
    emptyLabel: 'No news yet',
  },
}

const KINDS: ContentKind[] = ['posts', 'events', 'jobs', 'news']
const LIMIT = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']

function seedColor(id: string) {
  const sum = [...id].reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function getInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()
}

function relativeTime(iso: string) {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── ContentTab ─────────────────────────────────────────────────────────────────

export function ContentTab() {
  const [kind, setKind] = useState<ContentKind>('posts')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)

  function handleKindChange(next: ContentKind) {
    setKind(next)
    setFilter('all')
    setPage(1)
  }

  function handleFilterChange(next: Filter) {
    setFilter(next)
    setPage(1)
  }

  const config = KIND_CONFIG[kind]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Kind sub-tabs */}
      <nav
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '5px 6px',
          display: 'flex',
          gap: 3,
        }}
      >
        {KINDS.map((k) => {
          const Icon = KIND_CONFIG[k].icon
          const active = k === kind
          return (
            <button
              key={k}
              type="button"
              onClick={() => handleKindChange(k)}
              className="admin-pill-btn"
              data-active={active ? 'true' : undefined}
              style={{
                flex: 1,
                justifyContent: 'center',
                padding: '8px 0',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                border: 'none',
              }}
            >
              <Icon size={13} />
              {KIND_CONFIG[k].label}
            </button>
          )
        })}
      </nav>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {config.filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleFilterChange(f.value)}
            className="admin-pill-btn"
            data-active={filter === f.value ? 'true' : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <ContentList kind={kind} filter={filter} page={page} onPageChange={setPage} />
    </div>
  )
}

// ── ContentList ───────────────────────────────────────────────────────────────

interface ContentListProps {
  kind: ContentKind
  filter: Filter
  page: number
  onPageChange: (page: number) => void
}

function ContentList({ kind, filter, page, onPageChange }: ContentListProps) {
  const queryKey: QueryKey = ['admin', 'content', kind, filter, page]

  const { data, isLoading, isFetching } = useQuery<Paginated<AdminContentItem>>({
    queryKey,
    queryFn: () =>
      api
        .get<{ data: Paginated<AdminContentItem> }>(`/admin/content/${kind}`, {
          params: { page, limit: LIMIT, filter },
        })
        .then((r) => ({ ...r.data.data, limit: LIMIT })),
    // Keep previous data only when staying on the same kind (page/filter changes).
    // Crossing kinds would render e.g. posts as events and crash on missing fields.
    placeholderData: (prev, prevQuery) => {
      if (prevQuery && prevQuery.queryKey[2] === kind) return prev
      return undefined
    },
  })

  if (isLoading || !data) return <SkeletonList />

  const totalPages = Math.max(1, Math.ceil(data.total / LIMIT))
  const items = data.items
  const config = KIND_CONFIG[kind]

  if (items.length === 0) {
    return (
      <EmptyState
        label={filter === 'all' ? config.emptyLabel : `No ${filter} ${kind}`}
        kind={kind}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
        {data.total.toLocaleString()} {data.total === 1 ? config.label.slice(0, -1).toLowerCase() : config.label.toLowerCase()}
        {isFetching && !isLoading && ' · refreshing…'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, idx) => (
          <ContentRow key={item.id} kind={kind} item={item} index={idx} queryKey={queryKey} />
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
          <GhostBtn disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</GhostBtn>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
            {page} / {totalPages}
          </span>
          <GhostBtn disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>Next</GhostBtn>
        </div>
      )}
    </div>
  )
}

// ── ContentRow (one card) ─────────────────────────────────────────────────────

interface ContentRowProps {
  kind: ContentKind
  item: AdminContentItem
  index: number
  queryKey: QueryKey
}

function ContentRow({ kind, item, index, queryKey }: ContentRowProps) {
  const qc = useQueryClient()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
  }, [])

  function startConfirmTimer() {
    setConfirmingDelete(true)
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000)
  }

  const pinMutation = useMutation({
    mutationFn: (next: boolean) =>
      api.patch(`/admin/content/${kind}/${item.id}/pin`, { is_pinned: next }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Paginated<AdminContentItem>>(queryKey)
      if (previous) {
        qc.setQueryData<Paginated<AdminContentItem>>(queryKey, {
          ...previous,
          items: previous.items.map((it) =>
            it.id === item.id ? ({ ...it, isPinned: next } as AdminContentItem) : it,
          ),
        })
      }
      return { previous }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['admin', 'content', kind] }) },
  })

  const publishMutation = useMutation({
    mutationFn: (next: boolean) =>
      api.patch(`/admin/content/${kind}/${item.id}/publish`, { is_published: next }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Paginated<AdminContentItem>>(queryKey)
      if (previous) {
        qc.setQueryData<Paginated<AdminContentItem>>(queryKey, {
          ...previous,
          items: previous.items.map((it) =>
            it.id === item.id ? ({ ...it, isPublished: next } as AdminContentItem) : it,
          ),
        })
      }
      return { previous }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['admin', 'content', kind] }) },
  })

  const activeMutation = useMutation({
    mutationFn: (next: boolean) =>
      api.patch(`/admin/content/${kind}/${item.id}/active`, { is_active: next }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Paginated<AdminContentItem>>(queryKey)
      if (previous) {
        qc.setQueryData<Paginated<AdminContentItem>>(queryKey, {
          ...previous,
          items: previous.items.map((it) =>
            it.id === item.id ? ({ ...it, isActive: next } as AdminContentItem) : it,
          ),
        })
      }
      return { previous }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['admin', 'content', kind] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/content/${kind}/${item.id}`),
    onMutate: () => setIsRemoving(true),
    onError: () => setIsRemoving(false),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'content', kind] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  function handleDelete() {
    if (!confirmingDelete) {
      startConfirmTimer()
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirmingDelete(false)
    deleteMutation.mutate()
  }

  const isPending =
    pinMutation.isPending || publishMutation.isPending ||
    activeMutation.isPending || deleteMutation.isPending

  return (
    <article
      className="admin-content-card"
      style={{
        ...({ '--admin-card-index': index } as React.CSSProperties),
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: isRemoving ? 0.4 : undefined,
        pointerEvents: isRemoving ? 'none' : undefined,
      }}
    >
      <CardLeading kind={kind} item={item} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <CardHeader kind={kind} item={item} />
        <CardMeta kind={kind} item={item} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <CardActions
          kind={kind}
          item={item}
          confirmingDelete={confirmingDelete}
          isPending={isPending}
          onTogglePin={(next) => pinMutation.mutate(next)}
          onTogglePublish={(next) => publishMutation.mutate(next)}
          onToggleActive={(next) => activeMutation.mutate(next)}
          onDelete={handleDelete}
        />
      </div>
    </article>
  )
}

// ── Card sub-components (per-kind variants) ───────────────────────────────────

function CardLeading({ kind, item }: { kind: ContentKind; item: AdminContentItem }) {
  if (kind === 'posts') {
    const p = item as AdminPostItem
    const name = p.author.fullName ?? 'Unknown'
    return p.author.avatarUrl ? (
      <img src={p.author.avatarUrl} alt={name}
        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    ) : (
      <Avatar initials={getInitials(name)} color={seedColor(p.author.id)} size={36} />
    )
  }

  if (kind === 'events') {
    const e = item as AdminEventItem
    return e.coverUrl ? (
      <img src={e.coverUrl} alt={e.title}
        style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
    ) : (
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--r-sm)',
        background: 'var(--uc-cyan-bg)', color: 'var(--uc-cyan)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Calendar size={16} />
      </div>
    )
  }

  if (kind === 'jobs') {
    const j = item as AdminJobItem
    return (
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--r-sm)',
        background: 'var(--uc-mint-bg)', color: 'var(--uc-mint)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontSize: 14, fontWeight: 500,
      }}>
        {(j.company[0] ?? '?').toUpperCase()}
      </div>
    )
  }

  const n = item as AdminNewsItem
  return n.coverUrl ? (
    <img src={n.coverUrl} alt={n.title}
      style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{
      width: 36, height: 36, borderRadius: 'var(--r-sm)',
      background: 'var(--uc-orange-bg)', color: 'var(--uc-orange-l)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Newspaper size={16} />
    </div>
  )
}

function CardHeader({ kind, item }: { kind: ContentKind; item: AdminContentItem }) {
  const titleStyle: React.CSSProperties = {
    fontSize: 13.5,
    fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: '1 1 auto',
    minWidth: 0,
  }
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    width: '100%',
  }

  if (kind === 'posts') {
    const p = item as AdminPostItem
    return (
      <div style={rowStyle}>
        <span style={titleStyle}>{p.content || '(empty)'}</span>
        {p.isPinned && <StatusPill tone="indigo">pinned</StatusPill>}
      </div>
    )
  }

  if (kind === 'events') {
    const e = item as AdminEventItem
    return (
      <div style={rowStyle}>
        <span style={titleStyle}>{e.title}</span>
        <StatusPill tone={e.isPublished ? 'mint' : 'neutral'}>
          {e.isPublished ? 'published' : 'draft'}
        </StatusPill>
      </div>
    )
  }

  if (kind === 'jobs') {
    const j = item as AdminJobItem
    return (
      <div style={rowStyle}>
        <span style={titleStyle}>{j.title} · {j.company}</span>
        <StatusPill tone={j.isActive ? 'mint' : 'neutral'}>
          {j.isActive ? 'active' : 'closed'}
        </StatusPill>
      </div>
    )
  }

  const n = item as AdminNewsItem
  return (
    <div style={rowStyle}>
      <span style={titleStyle}>{n.title}</span>
      {n.isPinned && <StatusPill tone="indigo">pinned</StatusPill>}
      <StatusPill tone={n.isPublished ? 'mint' : 'neutral'}>
        {n.isPublished ? 'published' : 'draft'}
      </StatusPill>
    </div>
  )
}

function CardMeta({ kind, item }: { kind: ContentKind; item: AdminContentItem }) {
  const metaStyle: React.CSSProperties = {
    fontSize: 11.5,
    color: 'var(--text-tertiary)',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  }

  if (kind === 'posts') {
    const p = item as AdminPostItem
    const parts = [
      p.author.fullName ?? 'unknown',
      relativeTime(p.createdAt),
      `${p.reactionCount} reactions`,
      `${p.commentCount} comments`,
    ]
    return <div style={metaStyle}>{joinWithDot(parts)}</div>
  }

  if (kind === 'events') {
    const e = item as AdminEventItem
    const parts = [
      e.organizer.fullName ?? 'unknown',
      `starts ${fmtDateTime(e.startsAt)}`,
      `${e.rsvpCount} RSVPs`,
    ]
    return <div style={metaStyle}>{joinWithDot(parts)}</div>
  }

  if (kind === 'jobs') {
    const j = item as AdminJobItem
    const parts = [
      j.poster.fullName ?? 'unknown',
      `deadline ${fmtDateTime(j.deadline)}`,
      `${j.applicationCount} applications`,
    ]
    return <div style={metaStyle}>{joinWithDot(parts)}</div>
  }

  const n = item as AdminNewsItem
  const parts = [
    n.author.fullName ?? 'unknown',
    n.publishedAt ? `published ${relativeTime(n.publishedAt)}` : `created ${relativeTime(n.createdAt)}`,
    `${n.viewCount} views`,
  ]
  return <div style={metaStyle}>{joinWithDot(parts)}</div>
}

function joinWithDot(parts: string[]) {
  return parts.map((p, i) => (
    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {p}
      {i < parts.length - 1 && <span style={{ opacity: 0.4 }}>·</span>}
    </span>
  ))
}

// ── CardActions (icon button row) ─────────────────────────────────────────────

interface CardActionsProps {
  kind: ContentKind
  item: AdminContentItem
  confirmingDelete: boolean
  isPending: boolean
  onTogglePin: (next: boolean) => void
  onTogglePublish: (next: boolean) => void
  onToggleActive: (next: boolean) => void
  onDelete: () => void
}

function CardActions({
  kind, item, confirmingDelete, isPending,
  onTogglePin, onTogglePublish, onToggleActive, onDelete,
}: CardActionsProps) {
  const buttons: React.ReactNode[] = []

  if (kind === 'posts' || kind === 'news') {
    const isPinned = (item as AdminPostItem | AdminNewsItem).isPinned
    buttons.push(
      <button
        key="pin"
        type="button"
        className="admin-icon-btn"
        data-active={isPinned ? 'true' : undefined}
        title={isPinned ? 'Unpin' : 'Pin'}
        aria-label={isPinned ? 'Unpin' : 'Pin'}
        disabled={isPending}
        onClick={() => onTogglePin(!isPinned)}
      >
        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>,
    )
  }

  if (kind === 'events' || kind === 'news') {
    const isPublished = (item as AdminEventItem | AdminNewsItem).isPublished
    buttons.push(
      <button
        key="publish"
        type="button"
        className="admin-icon-btn"
        data-active={isPublished ? 'true' : undefined}
        title={isPublished ? 'Unpublish' : 'Publish'}
        aria-label={isPublished ? 'Unpublish' : 'Publish'}
        disabled={isPending}
        onClick={() => onTogglePublish(!isPublished)}
      >
        {isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>,
    )
  }

  if (kind === 'jobs') {
    const isActive = (item as AdminJobItem).isActive
    buttons.push(
      <button
        key="active"
        type="button"
        className="admin-icon-btn"
        data-active={isActive ? 'true' : undefined}
        title={isActive ? 'Close job' : 'Reopen job'}
        aria-label={isActive ? 'Close job' : 'Reopen job'}
        disabled={isPending}
        onClick={() => onToggleActive(!isActive)}
      >
        {isActive ? <Power size={14} /> : <PowerOff size={14} />}
      </button>,
    )
  }

  buttons.push(
    <button
      key="delete"
      type="button"
      className="admin-icon-btn"
      data-danger={confirmingDelete ? 'true' : undefined}
      title={confirmingDelete ? 'Click again to confirm' : 'Delete'}
      aria-label={confirmingDelete ? 'Click again to confirm delete' : 'Delete'}
      disabled={isPending}
      onClick={onDelete}
    >
      {confirmingDelete ? <AlertTriangle size={14} /> : <Trash2 size={14} />}
    </button>,
  )

  return <>{buttons}</>
}

// ── StatusPill ────────────────────────────────────────────────────────────────

type StatusTone = 'indigo' | 'mint' | 'orange' | 'neutral'

function StatusPill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const styles: Record<StatusTone, React.CSSProperties> = {
    indigo: {
      background: 'var(--uc-indigo-bg)',
      borderColor: 'var(--uc-indigo-bdr)',
      color: 'var(--uc-indigo-xl)',
    },
    mint: {
      background: 'var(--uc-mint-bg)',
      borderColor: 'var(--uc-mint-bdr)',
      color: 'var(--uc-mint)',
    },
    orange: {
      background: 'var(--uc-orange-bg)',
      borderColor: 'var(--uc-orange-bdr)',
      color: 'var(--uc-orange-l)',
    },
    neutral: {
      background: 'var(--surface-raised)',
      borderColor: 'var(--border-default)',
      color: 'var(--text-tertiary)',
    },
  }

  return <span className="admin-status-pill" style={styles[tone]}>{children}</span>
}

// ── SkeletonList & EmptyState ─────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="admin-skeleton-card" />
      ))}
    </div>
  )
}

function EmptyState({ label, kind }: { label: string; kind: ContentKind }) {
  const Icon = KIND_CONFIG[kind].icon
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '56px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--r-md)',
          background: 'var(--surface-raised)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <Icon size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 320 }}>
        Nothing matches this filter. Try a different filter, or check back later.
      </div>
    </div>
  )
}
