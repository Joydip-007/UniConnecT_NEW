import { useEffect, useLayoutEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'

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
  '#2E7D8C',
  '#6B4E9B',
  '#1A6B4A',
  '#8C4A2E',
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

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
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
              background: 'var(--surface-card)',
              borderLeft: '2px solid var(--uc-indigo)',
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
            border: `0.5px solid ${isOwn ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-primary)',
            lineHeight: 1.55,
            wordBreak: 'break-word',
          }}
        >
          {message.body}
        </div>

        {/* Timestamp */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            paddingInline: 2,
          }}
        >
          {timeLabel}
        </span>
      </div>
    </div>
  )
}

// ── ChatView ──────────────────────────────────────────────────────────────────

export function ChatView({ convId }: { convId: string }) {
  const myUserId = useAuthStore((s) => s.user?.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Stable refs to avoid recreating IntersectionObserver on state changes
  const fetchStateRef = useRef({ hasNextPage: false, isFetchingNextPage: false })
  const fetchNextPageRef = useRef<() => void>(() => {})
  const scrollAnchorRef = useRef<{ scrollHeight: number } | null>(null)
  const prevPageCountRef = useRef(0)
  const prevNewestIdRef = useRef<string | null>(null)

  // Reset scroll tracking when conversation changes
  useEffect(() => {
    prevPageCountRef.current = 0
    prevNewestIdRef.current = null
    scrollAnchorRef.current = null
  }, [convId])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['messages', convId],
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: MessagesPage }>(`/conversations/${convId}/messages`, {
            params: pageParam ? { before: pageParam } : {},
          })
          .then((r) => r.data.data),
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
      // Initial load: jump to bottom
      container.scrollTop = container.scrollHeight
      const firstPage = data.pages[0]
      const newestMsg = firstPage ? firstPage.items[firstPage.items.length - 1] : undefined
      if (newestMsg) prevNewestIdRef.current = newestMsg.id
    } else if (currentPageCount > prevPageCount) {
      // Older pages were prepended: restore reading position
      if (scrollAnchorRef.current) {
        const delta = container.scrollHeight - scrollAnchorRef.current.scrollHeight
        container.scrollTop += delta
        scrollAnchorRef.current = null
      }
    } else {
      // Same page count: check for a new inbound/outbound message
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

  // Flatten pages chronologically (oldest at top)
  const allMessages = data
    ? [...data.pages].reverse().flatMap((p) => p.items)
    : []

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
        <Loader2 size={20} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
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
          <Loader2 size={14} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {/* Message list */}
      {allMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === myUserId} />
      ))}
    </div>
  )
}
