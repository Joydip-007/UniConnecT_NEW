import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, Briefcase, Calendar, ChevronDown, ChevronUp, Eye, EyeOff, FileText, Flag,
  Layers, MoreVertical, Newspaper, Pin, PinOff, Power, PowerOff, RotateCcw, Rss, Trash2, User,
  type LucideIcon,
} from 'lucide-react'
import type { AdminContentType, FeedPost } from '@uniconnect/shared'
import { useContentSummary } from './useContentSummary'
import { api } from '@/lib/axios'
import { Avatar } from '@/components/Avatar'
import { GhostBtn } from '@/components/Button'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { avatarColor, getInitials } from '@/utils/avatar'
import { PATHS } from '@/router/paths'

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Content moderation is a queue to check, not a feed to read. The tabs are the
 * feed's own post types — News, Events and Jobs here are the feed cards of those
 * kinds, so an expanded row is the real PostCard the members see — and every row
 * opens collapsed to a one-line summary; the admin expands only what they need to
 * read in full instead of scrolling full-height cards to find it.
 */
type ContentType = AdminContentType

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}


const CONTENT_TYPES: { key: ContentType; label: string; icon: LucideIcon; empty: string }[] = [
  { key: 'post', label: 'Posts', icon: FileText, empty: 'No member posts match this filter right now.' },
  { key: 'news', label: 'News', icon: Newspaper, empty: 'No campus news has been published yet.' },
  { key: 'event_promo', label: 'Events', icon: Calendar, empty: 'No events posted to the feed yet.' },
  { key: 'job_promo', label: 'Jobs', icon: Briefcase, empty: 'No job postings shared to the feed yet.' },
]

const LIMIT = 20
const REMOVED_KEY: QueryKey = ['admin', 'content', 'feed', { removed: true }]

function listKey(type: ContentType, page: number): QueryKey {
  return ['admin', 'content', 'feed', { type, page }]
}

function fetchFeed(params: Record<string, string | number | boolean>) {
  return api
    .get<{ data: Paginated<FeedPost> }>('/admin/content/feed', { params: { limit: LIMIT, ...params } })
    .then((r) => r.data.data)
}

/** Everything the list, tray and stat strip read — refetched after any moderation write. */
function invalidateContent(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['admin', 'content'] })
  void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true })
}

/** What the Manage menu heading calls the item: the most specific thing it is. */
function kindLabel(post: FeedPost) {
  if (post.poll) return 'poll'
  if (post.type === 'announcement' || post.isPinned) return 'announcement'
  if (post.type === 'event_promo') return 'event'
  if (post.type === 'job_promo') return 'job'
  if (post.type === 'news') return 'news'
  return 'post'
}

function snippet(post: FeedPost) {
  const text = post.content || post.author.profile.headline || ''
  return text.slice(0, 90)
}

// ── ContentTab ─────────────────────────────────────────────────────────────────

export function ContentTab({ initialType }: { initialType?: string } = {}) {
  const [type, setType] = useState<ContentType>(CONTENT_TYPES.some((t) => t.key === initialType) ? (initialType as ContentType) : 'post')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function handleTypeChange(next: ContentType) {
    setType(next)
    setPage(1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SummaryStrip />

      {/* Type tabs: Posts / News / Events / Jobs */}
      <nav
        aria-label="Content type"
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {CONTENT_TYPES.map((t) => {
          const on = t.key === type
          const Icon = t.icon
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTypeChange(t.key)}
              aria-pressed={on}
              style={{
                flex: '1 1 0',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minWidth: 0,
                padding: '7px 10px',
                fontSize: 13,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: on ? 'var(--uc-indigo-bg)' : 'transparent',
                color: on ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                fontWeight: on ? 500 : 400,
              }}
            >
              <Icon size={14} strokeWidth={1.75} />
              {t.label}
            </button>
          )
        })}
      </nav>

      <ContentList
        type={type}
        page={page}
        onPageChange={setPage}
        expanded={expanded}
        onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
      />

      <RemovedTray />
    </div>
  )
}

// ── SummaryStrip ──────────────────────────────────────────────────────────────

function SummaryStrip() {
  const { data } = useContentSummary()

  const stats: { label: string; value: string; icon: LucideIcon; color: string; bg: string }[] = [
    { label: 'Total items', value: fmt(data?.total), icon: Layers, color: 'var(--uc-indigo-l)', bg: 'var(--uc-indigo-bg)' },
    { label: 'Pinned', value: fmt(data?.pinned), icon: Pin, color: 'var(--uc-orange-l)', bg: 'var(--uc-orange-bg)' },
    { label: 'Removed', value: fmt(data?.removed), icon: Trash2, color: 'var(--uc-red)', bg: 'var(--uc-red-bg)' },
    { label: 'Reports open', value: fmt(data?.reportsOpen), icon: Flag, color: 'var(--uc-amber-l)', bg: 'var(--uc-amber-bg)' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 4 }}>
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <div
            key={s.label}
            style={{
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-lg)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 32, height: 32, borderRadius: 'var(--r-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: s.bg, color: s.color,
              }}
            >
              <Icon size={15} strokeWidth={1.75} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function fmt(n: number | undefined) {
  return n === undefined ? '—' : n.toLocaleString()
}

// ── ContentList ───────────────────────────────────────────────────────────────

interface ContentListProps {
  type: ContentType
  page: number
  onPageChange: (page: number) => void
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
}

function ContentList({ type, page, onPageChange, expanded, onToggle }: ContentListProps) {
  const queryKey = listKey(type, page)
  const { data, isLoading } = useQuery<Paginated<FeedPost>>({
    queryKey,
    queryFn: () => fetchFeed({ type, page }),
    placeholderData: (prev) => prev,
  })

  if (isLoading || !data) return <SkeletonList />

  const config = CONTENT_TYPES.find((t) => t.key === type)!
  const totalPages = Math.max(1, Math.ceil(data.total / LIMIT))

  if (data.items.length === 0) return <EmptyState text={config.empty} />

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.items.map((post) => (
          <ContentRow
            key={post.id}
            post={post}
            queryKey={queryKey}
            expanded={!!expanded[post.id]}
            onToggle={() => onToggle(post.id)}
          />
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
    </>
  )
}

// ── ContentRow: collapsed one-liner ⇄ expanded PostCard ───────────────────────

interface ContentRowProps {
  post: FeedPost
  queryKey: QueryKey
  expanded: boolean
  onToggle: () => void
}

function ContentRow({ post, queryKey, expanded, onToggle }: ContentRowProps) {
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        className="row-hover-bg"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '10px 14px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <Avatar
          src={post.author.profile.avatarUrl}
          initials={getInitials(post.author.fullName)}
          color={avatarColor(post.author.id)}
          size={30}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{post.author.fullName}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>{relativeTime(post.createdAt)}</span>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
            {snippet(post)}
          </div>
        </div>
        {post.isPinned && <Pin size={13} strokeWidth={1.75} style={{ color: 'var(--uc-indigo-xl)', flexShrink: 0 }} />}
        <ChevronDown size={16} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
      </button>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
          background: 'none', border: 'none', padding: 4, cursor: 'pointer',
          fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', fontFamily: 'inherit',
        }}
      >
        <ChevronUp size={14} strokeWidth={1.75} />
        Collapse
      </button>
      <AdminPostCard post={post} queryKey={queryKey} />
    </div>
  )
}

// ── AdminPostCard: the shipped PostCard, review-only, with the Manage menu ────

/**
 * Optimistic flip of one field on the cached page; the server row wins on
 * settle, and a failed write puts the previous page back.
 */
function useFieldFlip<K extends keyof FeedPost>(
  queryKey: QueryKey,
  postId: string,
  field: K,
  request: (next: FeedPost[K]) => Promise<unknown>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: request,
    onMutate: async (next: FeedPost[K]) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Paginated<FeedPost>>(queryKey)
      if (previous) {
        qc.setQueryData<Paginated<FeedPost>>(queryKey, {
          ...previous,
          items: previous.items.map((it) => (it.id === postId ? { ...it, [field]: next } : it)),
        })
      }
      return { previous }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidateContent(qc),
  })
}

function AdminPostCard({ post, queryKey }: { post: FeedPost; queryKey: QueryKey }) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const pin = useFieldFlip(queryKey, post.id, 'isPinned', (next) => api.patch(`/admin/content/posts/${post.id}/pin`, { is_pinned: next }))
  const publish = useFieldFlip(queryKey, post.id, 'isPublished', (next) => api.patch(`/admin/content/posts/${post.id}/publish`, { is_published: next }))
  const comments = useFieldFlip(queryKey, post.id, 'commentsDisabled', (next) => api.patch(`/admin/content/posts/${post.id}/comments`, { comments_disabled: next }))

  const remove = useMutation({
    mutationFn: () => api.patch(`/admin/content/posts/${post.id}/removed`, { is_removed: true }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Paginated<FeedPost>>(queryKey)
      if (previous) {
        qc.setQueryData<Paginated<FeedPost>>(queryKey, {
          ...previous,
          total: Math.max(0, previous.total - 1),
          items: previous.items.filter((it) => it.id !== post.id),
        })
      }
      return { previous }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => invalidateContent(qc),
  })

  const hidden = !post.isPublished
  const closed = post.commentsDisabled
  const [commentsOpen, setCommentsOpen] = useState(false)

  return (
    <>
    {commentsOpen && <CommentDrawer post={post} onClose={() => setCommentsOpen(false)} readOnly />}
    <PostCard
      post={post}
      variant="admin"
      // The count opens the thread read-only; the admin can read (and delete) but not comment.
      onCommentClick={() => setCommentsOpen(true)}
      onEditPost={() => {}}
      headerSlot={
        <>
          {post.isPinned && (
            <HeaderPill icon={Pin} color="var(--uc-indigo-xl)" bg="var(--uc-indigo-bg)" bdr="var(--uc-indigo-bdr)">Pinned</HeaderPill>
          )}
          {hidden && (
            <HeaderPill icon={EyeOff} color="var(--text-secondary)" bg="var(--surface-raised)" bdr="var(--border-default)">Unpublished</HeaderPill>
          )}
          {closed && (
            <HeaderPill icon={PowerOff} color="var(--uc-amber-l)" bg="var(--uc-amber-bg)" bdr="var(--uc-amber-bdr)">Closed</HeaderPill>
          )}
          <ManageMenu
            kind={kindLabel(post)}
            actions={[
              { label: post.isPinned ? 'Unpin' : 'Pin to feed', icon: post.isPinned ? PinOff : Pin, onClick: () => pin.mutate(!post.isPinned) },
              { label: hidden ? 'Publish' : 'Unpublish', icon: hidden ? Eye : EyeOff, hint: hidden ? 'hidden' : '', onClick: () => publish.mutate(hidden) },
              { label: closed ? 'Reopen' : 'Close to replies', icon: closed ? Power : PowerOff, hint: closed ? 'closed' : '', onClick: () => comments.mutate(!closed) },
              { label: 'Open author profile', icon: User, divider: true, onClick: () => navigate(PATHS.PROFILE.replace(':id', post.author.id)) },
            ]}
            onDelete={() => remove.mutate()}
          />
        </>
      }
    />
    </>
  )
}

function HeaderPill({ icon: Icon, color, bg, bdr, children }: { icon: LucideIcon; color: string; bg: string; bdr: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        fontSize: 11, fontWeight: 500, borderRadius: 'var(--r-pill)', padding: '2px 8px',
        color, background: bg, border: `0.5px solid ${bdr}`,
      }}
    >
      <Icon size={11} strokeWidth={1.75} />
      {children}
    </span>
  )
}

// ── ManageMenu: ⋮ → "Manage {kind}" ───────────────────────────────────────────

interface MenuAction {
  label: string
  icon: LucideIcon
  hint?: string
  divider?: boolean
  onClick: () => void
}

const CONFIRM_MS = 3000

function ManageMenu({ kind, actions, onDelete }: { kind: string; actions: MenuAction[]; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // `.feed-post-card` is paint-contained (content-visibility: auto), so a menu
  // positioned inside the card is clipped at its edge. It renders through a portal
  // at a fixed position anchored to the ⋮ button instead.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (r) setAnchor({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  function close() {
    setOpen(false)
    setConfirming(false)
    if (timer.current) clearTimeout(timer.current)
  }

  function run(action: () => void) {
    close()
    action()
  }

  // Delete needs a second click to confirm; the arm expires on its own so a
  // menu left open cannot delete on a stray click a minute later.
  function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setConfirming(false), CONFIRM_MS)
      return
    }
    run(onDelete)
  }

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
    background: 'none', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
    fontSize: 13, textAlign: 'left', fontFamily: 'inherit',
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={`Manage ${kind}`}
        aria-expanded={open}
        className="press-feedback row-hover-bg"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
          borderRadius: 'var(--r-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center',
        }}
      >
        <MoreVertical size={16} strokeWidth={1.5} />
      </button>
      {createPortal(
      <AnimatePresence>
        {open && anchor && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'transparent', border: 'none', padding: 0, cursor: 'default' }}
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: 'tween', duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed', top: anchor.top, right: anchor.right, zIndex: 40, minWidth: 196, padding: 4,
                display: 'flex', flexDirection: 'column',
                background: 'var(--surface-raised)', border: '0.5px solid var(--border-hover)', borderRadius: 'var(--r-md)',
                transformOrigin: 'top right',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)', padding: '6px 10px 4px' }}>
                Manage {kind}
              </div>
              {actions.map((a) => {
                const Icon = a.icon
                return (
                  <button
                    key={a.label}
                    type="button"
                    role="menuitem"
                    onClick={() => run(a.onClick)}
                    className="nav-menu-item"
                    style={{ ...itemStyle, color: 'var(--text-primary)', borderTop: a.divider ? '0.5px solid var(--border-default)' : 'none' }}
                  >
                    <Icon size={15} strokeWidth={1.5} />
                    <span style={{ flex: 1 }}>{a.label}</span>
                    {a.hint && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.hint}</span>}
                  </button>
                )
              })}
              <button
                type="button"
                role="menuitem"
                onClick={handleDelete}
                className="nav-menu-item"
                style={{ ...itemStyle, color: 'var(--uc-red)' }}
              >
                {confirming ? <AlertTriangle size={15} strokeWidth={1.5} /> : <Trash2 size={15} strokeWidth={1.5} />}
                <span style={{ flex: 1 }}>{confirming ? 'Click again to confirm' : 'Delete'}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </div>
  )
}

// ── RemovedTray: "Recently removed (n)" with Restore ─────────────────────────

function RemovedTray() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data } = useQuery<Paginated<FeedPost>>({
    queryKey: REMOVED_KEY,
    queryFn: () => fetchFeed({ removed: true }),
  })

  const restore = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/content/posts/${id}/removed`, { is_removed: false }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: REMOVED_KEY })
      const previous = qc.getQueryData<Paginated<FeedPost>>(REMOVED_KEY)
      if (previous) {
        qc.setQueryData<Paginated<FeedPost>>(REMOVED_KEY, {
          ...previous,
          total: Math.max(0, previous.total - 1),
          items: previous.items.filter((it) => it.id !== id),
        })
      }
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(REMOVED_KEY, ctx.previous)
    },
    onSettled: () => invalidateContent(qc),
  })

  if (!data || data.total === 0) return null

  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--uc-red)' }}>Recently removed ({data.total.toLocaleString()})</span>
        {open ? <ChevronUp size={16} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={16} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />}
      </button>
      {open && data.items.map((post) => (
        <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: '0.5px solid var(--border-default)' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {post.author.fullName} · {post.content ? post.content.slice(0, 60) : post.author.profile.headline}
          </span>
          <button
            type="button"
            onClick={() => restore.mutate(post.id)}
            disabled={restore.isPending}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500,
              color: 'var(--uc-mint)', background: 'var(--uc-mint-bg)', border: '0.5px solid var(--uc-mint-bdr)',
              borderRadius: 'var(--r-pill)', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <RotateCcw size={12} strokeWidth={1.75} />
            Restore
          </button>
        </div>
      ))}
    </div>
  )
}

// ── SkeletonList & EmptyState ─────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="admin-skeleton-card" />
      ))}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <span style={{ color: 'var(--text-tertiary)' }}><Rss size={32} strokeWidth={1.5} /></span>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Nothing here yet</p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 340 }}>{text}</p>
    </div>
  )
}
