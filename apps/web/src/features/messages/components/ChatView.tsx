import { useEffect, useLayoutEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Loader2, RotateCcw } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { usePendingMsgsStore, type PendingMsg } from '@/stores/pendingMsgsStore'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MessageSender {
  id: string
  fullName: string
  profile: { avatarUrl: string | null }
}

export interface ReplyContext {
  id: string
  body: string
  senderName: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  sender: MessageSender
  body: string
  sentAt: string
  isDeleted: boolean
  replyTo: ReplyContext | null
}

export interface MessagesPage {
  items: Message[]
  nextCursor: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'var(--uc-indigo)',
  'var(--uc-orange)',
  'var(--uc-cyan)',
  'var(--uc-mint)',
  'var(--uc-navy)',
]

function seedColor(seed: string): string {
  const sum = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function pendingToMessage(p: PendingMsg): Message {
  return {
    id: p.tempId,
    conversationId: p.convId,
    senderId: p.senderId,
    sender: p.sender,
    body: p.body,
    sentAt: p.sentAt,
    isDeleted: false,
    replyTo: null,
  }
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  status,
  onRetry,
}: {
  message: Message
  isOwn: boolean
  status?: 'sending' | 'error'
  onRetry?: () => void
}) {
  const timeLabel = format(parseISO(message.sentAt), 'HH:mm')

  if (message.isDeleted) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: isOwn ? 'flex-end' : 'flex-start',
          padding: '2px 0',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontStyle: 'italic',
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            padding: '5px 12px',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
          }}
        >
          Message deleted
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        padding: '2px 0',
        opacity: status === 'sending' ? 0.6 : 1,
        transition: 'opacity 150ms',
      }}
    >
      {/* Avatar — only for others */}
      {!isOwn && (
        <Avatar
          initials={initials(message.sender.fullName)}
          color={seedColor(message.sender.id)}
          size={28}
        />
      )}

      {/* Bubble column */}
      <div
        style={{
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOwn ? 'flex-end' : 'flex-start',
          gap: 3,
        }}
      >
        {/* Sender name (others only) */}
        {!isOwn && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-tertiary)',
              paddingLeft: 10,
            }}
          >
            {message.sender.fullName}
          </span>
        )}

        {/* Reply indicator */}
        {message.replyTo && (
          <div
            style={{
              maxWidth: '100%',
              padding: '4px 10px',
              borderRadius: 'var(--r-sm)',
              background: 'var(--uc-indigo-bg)',
              border: '0.5px solid var(--uc-indigo-bdr)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--uc-indigo-xl)',
                marginBottom: 1,
              }}
            >
              {message.replyTo.senderName}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {message.replyTo.body}
            </div>
          </div>
        )}

        {/* Bubble body */}
        <div
          style={{
            padding: '8px 12px',
            borderRadius: isOwn
              ? 'var(--r-lg) var(--r-lg) var(--r-sm) var(--r-lg)'
              : 'var(--r-lg) var(--r-lg) var(--r-lg) var(--r-sm)',
            background: isOwn ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
            border: `0.5px solid ${
              status === 'error'
                ? 'var(--uc-red-bdr)'
                : isOwn
                  ? 'var(--uc-indigo-bdr)'
                  : 'var(--border-default)'
            }`,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-primary)',
            lineHeight: 1.55,
            wordBreak: 'break-word',
          }}
        >
          {message.body}
        </div>

        {/* Timestamp + status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            paddingInline: 2,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            {timeLabel}
          </span>

          {status === 'sending' && (
            <Loader2
              size={10}
              strokeWidth={1.5}
              className="spin"
              style={{ color: 'var(--text-tertiary)' }}
            />
          )}

          {status === 'error' && (
            <button
              onClick={onRetry}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--uc-red)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <RotateCcw size={10} strokeWidth={1.5} />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ChatView ──────────────────────────────────────────────────────────────────

export function ChatView({ convId }: { convId: string }) {
  const myUserId = useAuthStore((s) => s.user?.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const pendingMsgs = usePendingMsgsStore((s) => s.msgs.filter((m) => m.convId === convId))
  const retryPending = usePendingMsgsStore((s) => s.retry)

  // Stable refs to avoid recreating IntersectionObserver on state changes
  const fetchStateRef = useRef({ hasNextPage: false, isFetchingNextPage: false })
  const fetchNextPageRef = useRef<() => void>(() => {})
  const scrollAnchorRef = useRef<{ scrollHeight: number } | null>(null)
  const prevPageCountRef = useRef(0)
  const prevNewestIdRef = useRef<string | null>(null)
  const prevPendingCountRef = useRef(0)

  // Reset scroll tracking when conversation changes
  useEffect(() => {
    prevPageCountRef.current = 0
    prevNewestIdRef.current = null
    scrollAnchorRef.current = null
    prevPendingCountRef.current = 0
  }, [convId])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['messages', convId],
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: { items: Message[] } }>(`/conversations/${convId}/messages`, {
            params: pageParam ? { before: pageParam, limit: 20 } : { limit: 20 },
          })
          .then((r) => ({
            items: r.data.data.items,
            nextCursor: r.data.data.items.length === 20 ? (r.data.data.items[0]?.id ?? null) : null,
          })),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })

  // Keep fetch state in sync via ref so the observer closure never goes stale
  fetchStateRef.current = { hasNextPage: !!hasNextPage, isFetchingNextPage }
  fetchNextPageRef.current = fetchNextPage

  // Scroll management: initial load → bottom; older pages → preserve position; own new msg → bottom
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || !data) return

    const currentPageCount = data.pages.length
    const prevPageCount = prevPageCountRef.current

    if (prevPageCount === 0) {
      container.scrollTop = container.scrollHeight
      const firstPage = data.pages[0]
      const newestMsg = firstPage ? firstPage.items[firstPage.items.length - 1] : undefined
      if (newestMsg) prevNewestIdRef.current = newestMsg.id
    } else if (currentPageCount > prevPageCount) {
      if (scrollAnchorRef.current) {
        const delta = container.scrollHeight - scrollAnchorRef.current.scrollHeight
        container.scrollTop += delta
        scrollAnchorRef.current = null
      }
    } else {
      const p0 = data.pages[0]
      const newestMsg = p0 ? p0.items[p0.items.length - 1] : undefined
      if (newestMsg && newestMsg.id !== prevNewestIdRef.current) {
        prevNewestIdRef.current = newestMsg.id
        if (newestMsg.senderId === myUserId) {
          container.scrollTop = container.scrollHeight
        }
      }
    }

    prevPageCountRef.current = currentPageCount
  }, [data, myUserId])

  // Scroll to bottom when a new pending (own) message is appended
  useLayoutEffect(() => {
    if (pendingMsgs.length > prevPendingCountRef.current) {
      const container = scrollRef.current
      if (container) container.scrollTop = container.scrollHeight
    }
    prevPendingCountRef.current = pendingMsgs.length
  }, [pendingMsgs.length])

  // IntersectionObserver on top sentinel — loads older messages
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          fetchStateRef.current.hasNextPage &&
          !fetchStateRef.current.isFetchingNextPage
        ) {
          const container = scrollRef.current
          if (container) scrollAnchorRef.current = { scrollHeight: container.scrollHeight }
          fetchNextPageRef.current()
        }
      },
      { threshold: 0 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, []) // stable — reads live values from refs

  // Flatten pages chronologically (oldest at top), then append pending
  const confirmedMessages = data
    ? [...data.pages].reverse().flatMap((p) => p.items)
    : []
  const allMessages = [...confirmedMessages, ...pendingMsgs.map(pendingToMessage)]

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <Loader2 size={20} strokeWidth={1.5} className="spin" />
      </div>
    )
  }

  if (allMessages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
          }}
        >
          No messages yet. Say hello!
        </p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 16px',
        gap: 8,
      }}
    >
      {/* Top sentinel — triggers older page load when scrolled into view */}
      <div ref={sentinelRef} style={{ height: 1, flexShrink: 0 }} />

      {/* Fetching older messages indicator */}
      {isFetchingNextPage && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '4px 0 8px',
            color: 'var(--text-tertiary)',
          }}
        >
          <Loader2 size={14} strokeWidth={1.5} className="spin" />
        </div>
      )}

      {/* Confirmed messages */}
      {confirmedMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === myUserId} />
      ))}

      {/* Pending (optimistic) messages */}
      {pendingMsgs.map((p) => (
        <MessageBubble
          key={p.tempId}
          message={pendingToMessage(p)}
          isOwn
          status={p.status}
          onRetry={p.status === 'error' ? () => retryPending(p.tempId) : undefined}
        />
      ))}
    </div>
  )
}
