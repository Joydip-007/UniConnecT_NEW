import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, MoreVertical, Search, ShieldCheck, X } from 'lucide-react'
import { ImageLightbox } from '@/components/ImageLightbox'
import { RoleBadge } from '@/components/RoleBadge'
import { usePresence } from '@/features/presence'
import { ReportModal } from '@/features/moderation/components/ReportModal'
import { useUserModeration } from '@/features/moderation/hooks/useModeration'
import { PATHS } from '@/router/paths'
import { usePendingMsgsStore, type PendingMsg } from '@/stores/pendingMsgsStore'
import { usePresenceStore } from '@/stores/presenceStore'
import type { Conversation, Message } from '../types'
import {
  buildThreadRows,
  chatTheme,
  conversationAvatar,
  conversationIntro,
  conversationTitle,
  isOneToOne,
  memberCount,
} from '../threadModel'
import { initials, seedColor } from '../utils'
import { useConversationSocket } from '../hooks/useConversationSocket'
import { useLeaveConversation, useMessageActions, useThreadMessages } from '../hooks/useMessagesData'
import { ForwardModal } from './ForwardModal'
import { eyebrowStyle } from '../msgStyles'
import { MsgAvatar, OnlineDot, TypingDots } from './MsgPrimitives'
import { ThreadComposer } from './ThreadComposer'
import { ThreadMessage } from './ThreadMessage'

type Variant = 'desktop' | 'mobile'

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
    contentType: 'text',
  }
}

function lastSeenLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'Active just now'
  if (mins < 60) return `Active ${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Active ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `Active ${days} day${days === 1 ? '' : 's'} ago`
}

interface ThreadPaneProps {
  conv: Conversation
  variant: Variant
  myUserId: string | undefined
  onToggleDetails: () => void
  onBack: () => void
  /** Opens the report flow for the whole conversation (shared with the details rail). */
  onReportConversation: (() => void) | null
}

export function ThreadPane({ conv, variant, myUserId, onToggleDetails, onBack, onReportConversation }: ThreadPaneProps) {
  const mobile = variant === 'mobile'
  const convId = conv.id
  const navigate = useNavigate()
  const oneToOne = isOneToOne(conv)
  const title = conversationTitle(conv)
  const avatar = conversationAvatar(conv)
  const theme = chatTheme(conv.chatTheme)
  const other = conv.otherParticipant

  // ── Inline toast (the design's pill above the composer) ─────────────────────
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const notify = useCallback((text: string) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    if (text) toastTimer.current = setTimeout(() => setToast(''), 2400)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const { typingUserIds } = useConversationSocket(convId)
  const thread = useThreadMessages(convId)
  const actions = useMessageActions(convId, notify)
  const leave = useLeaveConversation(convId)
  const moderation = useUserModeration(other?.id ?? '')

  const allPending = usePendingMsgsStore((s) => s.msgs)
  const retryPending = usePendingMsgsStore((s) => s.retry)
  const pending = useMemo(() => allPending.filter((p) => p.convId === convId), [allPending, convId])

  // ── Presence ────────────────────────────────────────────────────────────────
  const memberIds = useMemo(
    () => (conv.participants ?? []).map((p) => p.userId).filter((id) => id !== myUserId),
    [conv.participants, myUserId],
  )
  usePresence(oneToOne ? (other ? [other.id] : []) : memberIds)
  const byUser = usePresenceStore((s) => s.byUser)
  const otherPresence = other ? byUser[other.id] : undefined
  const online = oneToOne && otherPresence?.status === 'online'
  const presenceLine = oneToOne
    ? online
      ? 'Active now'
      : otherPresence?.lastSeenAt
        ? lastSeenLabel(otherPresence.lastSeenAt)
        : ''
    : (() => {
        const n = memberCount(conv)
        const active = memberIds.filter((id) => byUser[id]?.status === 'online').length
        return `${n} member${n === 1 ? '' : 's'}${active ? `, ${active} active now` : ''}`
      })()

  // ── Rows ────────────────────────────────────────────────────────────────────
  const pendingById = useMemo(() => new Map(pending.map((p) => [p.tempId, p])), [pending])
  const allMessages = useMemo(
    () => [...thread.messages, ...pending.map(pendingToMessage)],
    [thread.messages, pending],
  )
  const others = useMemo(
    () => (conv.participants ?? []).filter((p) => p.userId !== myUserId),
    [conv.participants, myUserId],
  )
  const rows = useMemo(
    () => buildThreadRows(allMessages, myUserId, { isGroup: !oneToOne, others }),
    [allMessages, myUserId, oneToOne, others],
  )
  const bubbleKeys = rows.filter((r) => r.kind === 'msg').map((r) => r.key)
  const menuUpFrom = bubbleKeys.length - 3

  // ── Per-message popovers ────────────────────────────────────────────────────
  const [open, setOpen] = useState<{ id: string; kind: 'react' | 'menu' | 'hot' } | null>(null)
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  const [forwarding, setForwarding] = useState<Message | null>(null)
  const [reportingMessage, setReportingMessage] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [tsOpen, setTsOpen] = useState(false)
  const [tsQuery, setTsQuery] = useState('')
  const [tsIdx, setTsIdx] = useState(0)

  useEffect(() => {
    setOpen(null)
    setEditing(null)
    setSafetyOpen(false)
    setTsOpen(false)
    setTsQuery('')
    setTsIdx(0)
  }, [convId])

  // ── In-thread search ────────────────────────────────────────────────────────
  const hits = useMemo(() => {
    const q = tsOpen ? tsQuery.trim().toLowerCase() : ''
    if (!q) return [] as string[]
    return rows
      .filter((r) => r.kind === 'msg' && !r.message.isDeleted && r.message.body.toLowerCase().includes(q))
      .map((r) => r.key)
  }, [rows, tsOpen, tsQuery])
  const current = hits.length ? hits[((tsIdx % hits.length) + hits.length) % hits.length] : undefined
  const hitSet = useMemo(() => new Set(hits), [hits])

  // ── Scrolling ───────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const pageCountRef = useRef(0)
  const newestRef = useRef<string | null>(null)
  const anchorRef = useRef<number | null>(null)
  const pageCount = thread.data?.pages.length ?? 0
  const newest = allMessages[allMessages.length - 1]

  useEffect(() => {
    pageCountRef.current = 0
    newestRef.current = null
    anchorRef.current = null
  }, [convId])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || pageCount === 0) return
    if (pageCountRef.current === 0) {
      el.scrollTop = el.scrollHeight
    } else if (pageCount > pageCountRef.current && anchorRef.current !== null) {
      el.scrollTop += el.scrollHeight - anchorRef.current
      anchorRef.current = null
    } else if (newest && newest.id !== newestRef.current) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
      if (newest.senderId === myUserId || nearBottom) el.scrollTop = el.scrollHeight
    }
    pageCountRef.current = pageCount
    newestRef.current = newest?.id ?? null
  }, [pageCount, newest, myUserId])

  const fetchState = useRef({ hasNextPage: false, isFetchingNextPage: false, fetchNextPage: () => {} })
  fetchState.current = {
    hasNextPage: !!thread.hasNextPage,
    isFetchingNextPage: thread.isFetchingNextPage,
    fetchNextPage: () => void thread.fetchNextPage(),
  }
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver((entries) => {
      const s = fetchState.current
      if (entries[0]?.isIntersecting && s.hasNextPage && !s.isFetchingNextPage) {
        anchorRef.current = scrollRef.current?.scrollHeight ?? null
        s.fetchNextPage()
      }
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [convId])

  useEffect(() => {
    if (!current) return
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-msg-key="${current}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current])

  // ── Typing ──────────────────────────────────────────────────────────────────
  const typist = typingUserIds[0]
    ? conv.participants?.find((p) => p.userId === typingUserIds[0])?.user
    : undefined

  // ── Render ──────────────────────────────────────────────────────────────────
  const iconBtn = (size: number): React.CSSProperties => ({
    width: size,
    height: size,
    borderRadius: 'var(--r-pill)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  })

  const nameLine = (
    <span style={{ display: 'flex', alignItems: 'center', gap: mobile ? 6 : 8, minWidth: 0 }}>
      <span
        style={{
          minWidth: 0,
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>
      {oneToOne && other?.role && <RoleBadge role={other.role} size={15} tipPlacement="below" />}
    </span>
  )

  const safetyItems = oneToOne
    ? [
        { label: `Report ${other?.fullName.split(' ')[0] ?? 'this person'}`, danger: false, onPress: () => onReportConversation?.() },
        {
          label: `Block ${other?.fullName.split(' ')[0] ?? 'this person'}`,
          danger: true,
          onPress: () => {
            if (other && window.confirm(`Block ${other.fullName}? They won’t be able to message you.`)) moderation.block.mutate()
          },
        },
      ]
    : [
        ...(onReportConversation ? [{ label: 'Report group', danger: false, onPress: onReportConversation }] : []),
        ...(!conv.group
          ? [
              {
                label: 'Leave chat',
                danger: true,
                onPress: () => {
                  if (window.confirm(`Leave “${title}”?`)) leave.mutate(undefined, { onSuccess: () => navigate(PATHS.MESSAGES) })
                },
              },
            ]
          : []),
      ]

  return (
    <>
      {mobile ? (
        <header
          style={{
            flexShrink: 0,
            height: 60,
            padding: '0 12px',
            background: 'var(--nav-bg)',
            borderBottom: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button type="button" onClick={onBack} aria-label="Back to messages" style={iconBtn(40)}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <MsgAvatar size={36} fontSize={13} initials={avatar.initials} color={avatar.color} src={avatar.src} />
            {online && <OnlineDot size={11} ring="var(--surface-card)" offset={-1} />}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {nameLine}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{presenceLine}</span>
          </div>
          <button type="button" onClick={onToggleDetails} aria-label="Conversation details" style={iconBtn(40)}>
            <MoreVertical size={18} />
          </button>
        </header>
      ) : (
        <header
          style={{
            height: 64,
            flexShrink: 0,
            padding: '0 16px',
            borderBottom: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <MsgAvatar size={38} fontSize={13} initials={avatar.initials} color={avatar.color} src={avatar.src} />
            {online && <OnlineDot size={11} ring="var(--surface-card)" offset={-1} />}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {nameLine}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{presenceLine}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                setTsOpen((v) => !v)
                setTsQuery('')
                setTsIdx(0)
              }}
              aria-label="Search in conversation"
              aria-pressed={tsOpen}
              className="msgx-hover"
              style={iconBtn(36)}
            >
              <Search size={16} />
            </button>
            <button
              type="button"
              onClick={() => setSafetyOpen((v) => !v)}
              aria-label="Safety"
              aria-expanded={safetyOpen}
              disabled={safetyItems.length === 0}
              className="msgx-hover"
              style={iconBtn(36)}
            >
              <ShieldCheck size={16} />
            </button>
            <button type="button" onClick={onToggleDetails} aria-label="Conversation details" className="msgx-hover" style={iconBtn(36)}>
              <MoreVertical size={16} />
            </button>
            {safetyOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 40,
                  zIndex: 70,
                  minWidth: 170,
                  padding: 6,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-hover)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {safetyItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSafetyOpen(false)
                      item.onPress()
                    }}
                    className="msgx-hover"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      color: item.danger ? 'var(--uc-red)' : 'var(--text-secondary)',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
      )}

      {tsOpen && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderBottom: '0.5px solid var(--border-default)',
            background: 'var(--surface-card)',
          }}
        >
          <span style={{ color: 'var(--text-tertiary)', display: 'flex' }}>
            <Search size={14} />
          </span>
          <input
            autoFocus
            value={tsQuery}
            onChange={(e) => {
              setTsQuery(e.target.value)
              setTsIdx(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setTsIdx((i) => i + (e.shiftKey ? -1 : 1))
              if (e.key === 'Escape') {
                setTsOpen(false)
                setTsQuery('')
              }
            }}
            placeholder="Search in this conversation"
            aria-label="Search in this conversation"
            style={{
              flex: 1,
              minWidth: 0,
              height: 32,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
            }}
          />
          <span aria-live="polite" style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {tsQuery.trim() ? (hits.length ? `${hits.indexOf(current ?? '') + 1} of ${hits.length}` : 'No matches') : ''}
          </span>
          {[
            { icon: ChevronUp, label: 'Previous match', onPress: () => setTsIdx((i) => i - 1) },
            { icon: ChevronDown, label: 'Next match', onPress: () => setTsIdx((i) => i + 1) },
            {
              icon: X,
              label: 'Close search',
              onPress: () => {
                setTsOpen(false)
                setTsQuery('')
                setTsIdx(0)
              },
            },
          ].map(({ icon: Icon, label, onPress }) => (
            <button key={label} type="button" onClick={onPress} aria-label={label} className="msgx-hover" style={iconBtn(30)}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        className={mobile ? 'msgx-hide-bar' : 'msgx-scroll'}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: mobile ? '14px 14px 6px' : '18px 20px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div ref={sentinelRef} style={{ height: 1, flexShrink: 0 }} />
        {thread.isFetchingNextPage && (
          <div role="status" aria-label="Loading older messages" style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px', color: 'var(--text-tertiary)' }}>
            <Loader2 size={14} className="spin" aria-hidden="true" />
          </div>
        )}

        {!mobile && !thread.hasNextPage && !thread.isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0 20px' }}>
            <MsgAvatar size={64} fontSize={20} initials={avatar.initials} color={avatar.color} src={avatar.src} />
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 320 }}>
              {conversationIntro(conv)}
            </div>
          </div>
        )}

        {thread.isLoading && (
          <div role="status" aria-label="Loading messages" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            <Loader2 size={20} className="spin" aria-hidden="true" />
          </div>
        )}

        {thread.isError && (
          <div role="alert" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>Couldn’t load messages.</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Check your connection and try again.</p>
          </div>
        )}

        {rows.map((row) => {
          if (row.kind === 'day') {
            return (
              <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: mobile ? 10 : 12, padding: mobile ? '10px 0 8px' : '14px 0 10px' }}>
                <span style={{ flex: 1, height: 0.5, background: 'var(--border-default)' }} />
                <span style={eyebrowStyle}>{row.label}</span>
                <span style={{ flex: 1, height: 0.5, background: 'var(--border-default)' }} />
              </div>
            )
          }
          const m = row.message
          const p = pendingById.get(m.id)
          const openKind = open?.id === m.id ? open.kind : null
          return (
            <div key={row.key} data-msg-key={row.key}>
              <ThreadMessage
                row={row}
                variant={variant}
                themeColor={theme.color}
                myUserId={myUserId}
                open={openKind === 'hot' ? null : openKind}
                menuUp={bubbleKeys.indexOf(row.key) >= menuUpFrom}
                highlight={current === row.key ? 'current' : hitSet.has(row.key) ? 'match' : 'none'}
                pending={p ? { status: p.status, onRetry: () => retryPending(p.tempId) } : undefined}
                onToggleReact={() => setOpen(openKind === 'react' ? null : { id: m.id, kind: 'react' })}
                onToggleMenu={() => setOpen(openKind === 'menu' ? null : { id: m.id, kind: 'menu' })}
                onTouchHot={() => setOpen(openKind ? null : { id: m.id, kind: 'hot' })}
                onReact={(key) => {
                  setOpen(null)
                  actions.react.mutate({ id: m.id, key })
                }}
                onForward={() => {
                  setOpen(null)
                  setForwarding(m)
                }}
                onEdit={() => {
                  setOpen(null)
                  setEditing({ id: m.id, body: m.body })
                  notify('Editing in the composer')
                }}
                onRemove={() => {
                  setOpen(null)
                  actions.remove.mutate(m.id)
                }}
                onReport={() => {
                  setOpen(null)
                  setReportingMessage(m.id)
                }}
                onHideForMe={() => {
                  setOpen(null)
                  actions.hide.mutate(m.id)
                }}
                onOpenImage={(urls, index) => setLightbox({ urls, index })}
                onOpenOnce={() =>
                  actions.openOnce.mutate(m.id, {
                    onSuccess: ({ attachment }) => {
                      setLightbox({ urls: [attachment.url], index: 0 })
                      notify('Photo viewed. It can’t be opened again')
                    },
                  })
                }
              />
            </div>
          )
        })}

        {typingUserIds.length > 0 && (
          <div style={{ display: 'flex', gap: mobile ? 8 : 10, alignItems: 'flex-end', paddingBottom: mobile ? 0 : 6 }}>
            <MsgAvatar
              size={mobile ? 26 : 28}
              fontSize={10}
              initials={typist ? initials(typist.fullName) : avatar.initials}
              color={typist ? seedColor(typist.id) : avatar.color}
              src={typist?.avatarUrl ?? (oneToOne ? avatar.src : null)}
            />
            <div
              aria-label="Typing"
              style={{
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                padding: mobile ? '11px 15px' : '12px 16px',
                borderRadius: 'var(--r-lg)',
                borderBottomLeftRadius: 'var(--r-sm)',
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-default)',
              }}
            >
              <TypingDots size={5} color="var(--text-secondary)" />
            </div>
          </div>
        )}
      </div>

      <ThreadComposer
        convId={convId}
        variant={variant}
        themeColor={theme.color}
        quickEmoji={conv.quickEmoji ?? '👍'}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        toast={toast}
        notify={notify}
        send={{
          text: actions.sendText,
          attachments: (attachments, viewOnce) => actions.send.mutateAsync({ attachments, viewOnce }),
          sticker: (url) => actions.send.mutate({ stickerUrl: url }),
          edit: (id, body) => actions.edit.mutate({ id, body }),
        }}
      />

      {(open?.kind === 'react' || open?.kind === 'menu' || safetyOpen) && (
        <div
          aria-hidden="true"
          onClick={() => {
            setOpen(null)
            setSafetyOpen(false)
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 60 }}
        />
      )}

      {forwarding && <ForwardModal fromConvId={convId} message={forwarding} onClose={() => setForwarding(null)} />}
      {reportingMessage && (
        <ReportModal
          isOpen
          onClose={() => setReportingMessage(null)}
          targetType="message"
          targetId={reportingMessage}
          targetLabel="this message"
        />
      )}
      {lightbox && <ImageLightbox images={lightbox.urls} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
    </>
  )
}
