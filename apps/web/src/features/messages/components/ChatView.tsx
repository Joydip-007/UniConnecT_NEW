import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { Loader2, RotateCcw } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { usePendingMsgsStore, type PendingMsg } from '@/stores/pendingMsgsStore'
import { seedColor, initials } from '../utils'
import { MessageMiniReactionBar } from '@/components/emoji/ReactionBar'
import { MessageReactionGroup } from '@/components/emoji/ReactionChip'
import { StickerMessage } from '@/components/emoji/StickerDrawer'
import type { MessageReactionKey } from '@/components/emoji/reactionConfig'
import { useUpsertMessageReaction, useRemoveMessageReaction, useMessageReactions } from '../hooks/useMessageReactions'

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
  contentType?: 'text' | 'sticker'
  stickerUrl?: string | null
}

export interface MessagesPage {
  items: Message[]
  nextCursor: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safe wrapper around date-fns parseISO.
 * Returns epoch (Jan 1 1970) instead of throwing when the input is null,
 * undefined, or an unrecognised format — keeps the render phase crash-free
 * even if a DB row has a malformed/missing timestamp.
 */
function safeParse(iso: string | null | undefined): Date {
  if (!iso) return new Date(0)
  const d = parseISO(String(iso))
  return isNaN(d.getTime()) ? new Date(0) : d
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

// ── DateDivider ───────────────────────────────────────────────────────────────

function dateLabel(iso: string | null | undefined): string {
  const d = safeParse(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE, d MMM')
}

function DateDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: '6px 0',
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
    </div>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  convId,
  myUserId,
  status,
  onRetry,
  showAvatar = true,
  showName = true,
}: {
  message: Message
  isOwn: boolean
  convId: string
  myUserId?: string
  status?: 'sending' | 'error'
  onRetry?: () => void
  showAvatar?: boolean
  showName?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const timeLabel = format(safeParse(message.sentAt), 'HH:mm')
  const isPending = !message.id || message.id.startsWith('pending-')

  const { data: reactions } = useMessageReactions(convId, message.id)
  const upsertReaction = useUpsertMessageReaction(convId, message.id)
  const removeReaction = useRemoveMessageReaction(convId, message.id)

  const myReaction = myUserId && reactions
    ? (Object.entries(reactions).find(([, users]) =>
        users.some((u) => u.userId === myUserId),
      )?.[0] as MessageReactionKey | undefined) ?? null
    : null

  function handleReactionSelect(key: MessageReactionKey) {
    if (myReaction === key) {
      removeReaction.mutate()
    } else {
      upsertReaction.mutate(key)
    }
  }

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
      onMouseEnter={() => !isPending && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        padding: '2px 0',
        opacity: status === 'sending' ? 0.6 : 1,
        transition: 'opacity 150ms',
        position: 'relative',
      }}
    >
      {/* Mini reaction bar — appears on hover */}
      {hovered && !isPending && (
        <div
          style={{
            position: 'absolute',
            top: -38,
            ...(isOwn ? { right: 36 } : { left: 36 }),
            zIndex: 40,
          }}
        >
          <MessageMiniReactionBar
            onSelect={handleReactionSelect}
            myReaction={myReaction}
          />
        </div>
      )}
      {/* Avatar — only for others; spacer when suppressed to keep bubble alignment */}
      {!isOwn && (
        showAvatar
          ? (
            <Avatar
              src={message.sender.profile.avatarUrl}
              initials={initials(message.sender.fullName)}
              color={seedColor(message.sender.id)}
              size={28}
            />
          )
          : <div style={{ width: 28, flexShrink: 0 }} />
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
        {/* Sender name — first message of a run only */}
        {!isOwn && showName && (
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
        {message.contentType === 'sticker' && message.stickerUrl ? (
          <StickerMessage url={message.stickerUrl} />
        ) : (
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
              fontFamily: `inherit, var(--font-emoji)`,
            }}
          >
            {message.body}
          </div>
        )}

        {/* Reaction chips below bubble */}
        {reactions && myUserId && (
          <MessageReactionGroup
            reactions={reactions}
            myUserId={myUserId}
            onReactionClick={handleReactionSelect}
          />
        )}

        {/* Timestamp + sending spinner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            paddingInline: 2,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
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
        </div>

        {/* Retry pill — shown below the bubble on send failure */}
        {status === 'error' && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '9px 14px',
              marginTop: 2,
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-red-bg)',
              border: '0.5px solid var(--uc-red-bdr)',
              color: 'var(--uc-red)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={11} strokeWidth={1.5} />
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

// ── ChatView ──────────────────────────────────────────────────────────────────

export function ChatView({ convId }: { convId: string }) {
  const myUserId = useAuthStore((s) => s.user?.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Select the raw msgs array (stable reference between store updates), then
  // filter in useMemo. Using .filter() directly inside the Zustand selector
  // returns a new array reference on every call — React 18's useSyncExternalStore
  // tearing-detection re-invokes the selector after every commit, sees a new
  // reference, and schedules another render, looping until error #185.
  const allPendingMsgs = usePendingMsgsStore((s) => s.msgs)
  const pendingMsgs = useMemo(
    () => allPendingMsgs.filter((m) => m.convId === convId),
    [allPendingMsgs, convId],
  )
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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
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

  // Flatten pages chronologically (oldest at top) — memoized to avoid allocations on every render
  const confirmedMessages = useMemo(
    () => (data ? [...data.pages].reverse().flatMap((p) => p.items) : []),
    [data],
  )
  const allMessages = useMemo(
    () => [...confirmedMessages, ...pendingMsgs.map(pendingToMessage)],
    [confirmedMessages, pendingMsgs],
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading messages"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <Loader2 size={20} strokeWidth={1.5} className="spin" aria-hidden="true" />
      </div>
    )
  }

  if (isError) {
    return (
      <div
        role="alert"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          Couldn't load messages.
        </p>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          Check your connection and try again.
        </p>
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
          role="status"
          aria-label="Loading older messages"
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '4px 0 8px',
            color: 'var(--text-tertiary)',
          }}
        >
          <Loader2 size={14} strokeWidth={1.5} className="spin" aria-hidden="true" />
        </div>
      )}

      {/* Confirmed messages — with date dividers on day boundaries and run-collapsing */}
      {confirmedMessages.map((msg, i) => {
        const prevMsg = confirmedMessages[i - 1]

        const msgDate = safeParse(msg.sentAt)
        const msgDay = format(msgDate, 'yyyy-MM-dd')
        const newDay = !prevMsg || msgDay !== format(safeParse(prevMsg.sentAt), 'yyyy-MM-dd')

        // Collapse consecutive same-sender messages within a 2-minute window
        const RUN_WINDOW_MS = 2 * 60 * 1000
        const isContinuation =
          !newDay &&
          !!prevMsg &&
          msg.senderId === prevMsg.senderId &&
          msgDate.getTime() - safeParse(prevMsg.sentAt).getTime() < RUN_WINDOW_MS

        return (
          <React.Fragment key={msg.id}>
            {newDay && <DateDivider label={dateLabel(msg.sentAt)} />}
            <MessageBubble
              message={msg}
              isOwn={msg.senderId === myUserId}
              convId={convId}
              myUserId={myUserId}
              showAvatar={!isContinuation}
              showName={!isContinuation}
            />
          </React.Fragment>
        )
      })}

      {/* Pending (optimistic) messages */}
      {pendingMsgs.map((p) => (
        <MessageBubble
          key={p.tempId}
          message={pendingToMessage(p)}
          isOwn
          convId={convId}
          myUserId={myUserId}
          status={p.status}
          onRetry={p.status === 'error' ? () => retryPending(p.tempId) : undefined}
        />
      ))}
    </div>
  )
}
