import { useMemo, useState } from 'react'
import { Pencil, Search, Users } from 'lucide-react'
import { RoleBadge } from '@/components/RoleBadge'
import { SkeletonConvRow } from '@/components/skeletons/SkeletonConvRow'
import { usePresence } from '@/features/presence'
import type { Conversation } from '../types'
import { conversationAvatar, conversationTitle, isOneToOne, listTime, snippet } from '../threadModel'
import { eyebrowStyle, useIsOnline } from '../msgStyles'
import { MsgAvatar, OnlineDot, TypingDots } from './MsgPrimitives'

export const LIST_FILTERS = ['All', 'Unread', 'Groups', 'Requests'] as const
export type ListFilter = (typeof LIST_FILTERS)[number]

type Variant = 'desktop' | 'mobile'

function matchesFilter(conv: Conversation, filter: ListFilter): boolean {
  // Requests live only under their own chip, the way the other filters exclude them.
  if (filter === 'Requests') return !!conv.isRequest
  if (conv.isRequest) return false
  if (filter === 'Unread') return conv.unreadCount > 0
  if (filter === 'Groups') return !isOneToOne(conv)
  return true
}

interface ConversationListProps {
  variant: Variant
  conversations: Conversation[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  activeId: string | undefined
  typingIds: ReadonlySet<string>
  myUserId: string | undefined
  onSelect: (id: string) => void
  onNewMessage: () => void
  onNewGroup: () => void
}

export function ConversationList({
  variant,
  conversations,
  isLoading,
  isError,
  onRetry,
  activeId,
  typingIds,
  myUserId,
  onSelect,
  onNewMessage,
  onNewGroup,
}: ConversationListProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ListFilter>('All')
  const mobile = variant === 'mobile'

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (conversations ?? []).filter((c) => {
      if (!matchesFilter(c, filter)) return false
      if (!q) return true
      return conversationTitle(c).toLowerCase().includes(q) || snippet(c, myUserId).toLowerCase().includes(q)
    })
  }, [conversations, filter, query, myUserId])

  const pinned = visible.filter((c) => c.isPinned)
  const rest = visible.filter((c) => !c.isPinned)

  usePresence(
    useMemo(
      () =>
        (conversations ?? [])
          .filter(isOneToOne)
          .map((c) => c.otherParticipant?.id)
          .filter((id): id is string => !!id),
      [conversations],
    ),
  )

  const chip = (on: boolean): React.CSSProperties => ({
    padding: mobile ? '6px 13px' : '5px 12px',
    fontSize: 12,
    whiteSpace: 'nowrap',
    borderRadius: 'var(--r-pill)',
    cursor: 'pointer',
    border: `0.5px solid ${on ? 'var(--uc-indigo)' : 'var(--border-default)'}`,
    background: on ? 'var(--uc-indigo)' : 'var(--surface-card)',
    color: on ? 'var(--on-indigo)' : 'var(--text-secondary)',
    fontWeight: 500,
    fontFamily: 'inherit',
  })

  const header = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>Messages</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onNewGroup}
            aria-label="New group chat"
            title="New group chat"
            className="msgx-hover"
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--r-pill)',
              border: '0.5px solid var(--border-default)',
              background: 'var(--surface-card)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={15} />
          </button>
          <button
            type="button"
            onClick={onNewMessage}
            aria-label="New message"
            title="New message"
            className="msgx-dim"
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--r-pill)',
              border: 'none',
              background: 'var(--uc-indigo)',
              color: 'var(--on-indigo)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pencil size={15} />
          </button>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
            display: 'flex',
          }}
        >
          <Search size={14} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages"
          aria-label="Search messages"
          className="msgx-search"
          style={{
            width: '100%',
            height: mobile ? 38 : 36,
            boxSizing: 'border-box',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: '0 14px 0 34px',
            fontSize: 13,
            fontFamily: 'inherit',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>
      <div className="msgx-hide-bar" role="tablist" aria-label="Filter conversations" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {LIST_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            style={chip(filter === f)}
          >
            {f}
          </button>
        ))}
      </div>
    </>
  )

  const emptyText = query.trim()
    ? 'No conversations match that search.'
    : filter === 'Requests'
      ? 'No message requests.'
      : filter === 'Unread'
        ? 'You are all caught up.'
        : filter === 'Groups'
          ? 'No group conversations yet.'
          : 'No conversations yet. Start one with the pencil button.'

  const renderRow = (c: Conversation) => (
    <ConversationRow
      key={c.id}
      conv={c}
      variant={variant}
      active={c.id === activeId}
      typing={typingIds.has(c.id) && c.id !== activeId}
      myUserId={myUserId}
      onSelect={() => onSelect(c.id)}
    />
  )

  return (
    <>
      {mobile ? (
        <header
          style={{
            flexShrink: 0,
            padding: '14px 16px 10px',
            background: 'var(--nav-bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {header}
        </header>
      ) : (
        <div style={{ padding: '16px 16px 10px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
          {header}
        </div>
      )}

      <div
        className={mobile ? 'msgx-hide-bar' : 'msgx-scroll'}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: mobile ? '8px 10px 12px' : '0 8px 16px' }}
      >
        {isLoading && (
          <>
            <SkeletonConvRow />
            <SkeletonConvRow />
            <SkeletonConvRow />
            <SkeletonConvRow />
          </>
        )}

        {!isLoading && isError && (
          <div role="alert" style={{ padding: '32px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.72, color: 'var(--text-tertiary)' }}>
              Couldn’t load conversations.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="msgx-hover"
              style={{
                padding: '5px 14px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {mobile ? (
              [...pinned, ...rest].map(renderRow)
            ) : (
              <>
                {pinned.length > 0 && <div style={{ ...eyebrowStyle, padding: '8px 8px 4px' }}>Pinned</div>}
                {pinned.map(renderRow)}
                <div style={{ ...eyebrowStyle, padding: '12px 8px 4px' }}>
                  {filter === 'All' ? 'all conversations' : filter.toLowerCase()}
                </div>
                {rest.map(renderRow)}
              </>
            )}
            {visible.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, lineHeight: 1.72, color: 'var(--text-tertiary)' }}>
                {emptyText}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ConversationRow({
  conv,
  variant,
  active,
  typing,
  myUserId,
  onSelect,
}: {
  conv: Conversation
  variant: Variant
  active: boolean
  typing: boolean
  myUserId: string | undefined
  onSelect: () => void
}) {
  const mobile = variant === 'mobile'
  const title = conversationTitle(conv)
  const avatar = conversationAvatar(conv)
  const online = useIsOnline(isOneToOne(conv) ? conv.otherParticipant?.id : undefined)
  const unread = conv.unreadCount > 0 ? (conv.unreadCount > 99 ? '99+' : String(conv.unreadCount)) : ''
  const role = isOneToOne(conv) ? conv.otherParticipant?.role : undefined
  const time = listTime(conv.lastMessage?.sentAt ?? conv.createdAt)
  const text = snippet(conv, myUserId)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      aria-label={`${title}${unread ? `, ${unread} unread` : ''}${active ? ', currently open' : ''}`}
      className="msgx-hover"
      style={{
        display: 'flex',
        gap: mobile ? 12 : 10,
        width: '100%',
        padding: mobile ? '11px 10px' : 10,
        border: 'none',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        background: active ? 'var(--uc-indigo-bg)' : 'transparent',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <MsgAvatar
          size={mobile ? 48 : 44}
          fontSize={mobile ? 15 : 14}
          initials={avatar.initials}
          color={avatar.color}
          src={avatar.src}
        />
        {online && <OnlineDot size={mobile ? 13 : 12} ring="var(--surface-page)" />}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: mobile ? 3 : 2,
          justifyContent: mobile ? 'center' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: mobile ? 'center' : 'baseline', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                minWidth: 0,
                fontSize: mobile ? 15 : 14,
                fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
            {mobile && role && <RoleBadge role={role} size={14} tipPlacement="below" />}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{time}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {typing ? (
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--uc-indigo-l)' }}>
              Typing
              <span style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                <TypingDots size={3} color="var(--uc-indigo-l)" />
              </span>
            </span>
          ) : (
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: mobile ? 13 : 12,
                lineHeight: 1.45,
                color: unread ? 'var(--text-primary)' : 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </span>
          )}
          {unread && (
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                minWidth: mobile ? 20 : 18,
                height: mobile ? 20 : 18,
                padding: mobile ? '0 6px' : '0 5px',
                boxSizing: 'border-box',
                borderRadius: 'var(--r-pill)',
                background: 'var(--uc-indigo)',
                color: 'var(--on-indigo)',
                fontSize: mobile ? 11 : 10,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
