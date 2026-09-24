import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { MessageCircle, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { api } from '@/lib/axios'
import { SkeletonConvRow } from '@/components/skeletons/SkeletonConvRow'
import { PATHS } from '@/router/paths'
import { popoverIn } from '@/lib/motion'
import { NewConversationModal } from './NewConversationModal'
import type { Conversation } from '../types'
import { seedColor, initials, relativeTime } from '../utils'

// ── MessagesPopup ─────────────────────────────────────────────────────────────

interface MessagesPopupProps {
  onClose: () => void
}

export function MessagesPopup({ onClose }: MessagesPopupProps) {
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const [newOpen, setNewOpen] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['conversations'],
    queryFn: () =>
      api.get<{ data: Conversation[] }>('/conversations').then((r) => r.data.data),
  })

  // Sort newest-last-message first, take top 6
  const sorted = data
    ? [...data]
        .sort((a, b) => {
          const at = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt).getTime() : 0
          const bt = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt).getTime() : 0
          return bt - at
        })
        .slice(0, 6)
    : []

  function handleConv(convId: string) {
    navigate(`/messages/${convId}`)
    onClose()
  }

  function handleOpenAll() {
    navigate(PATHS.MESSAGES)
    onClose()
  }

  return (
    <>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Messages"
        initial={reduced ? false : popoverIn.initial}
        animate={popoverIn.animate}
        exit={reduced ? undefined : popoverIn.exit}
        transition={popoverIn.transition}
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 336,
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-hover)',
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          zIndex: 100,
          transformOrigin: 'top right',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px 10px',
            borderBottom: '0.5px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <MessageCircle size={14} strokeWidth={1.5} style={{ color: 'var(--uc-indigo-l)' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Messages</span>
          </div>

          <button
            type="button"
            onClick={() => setNewOpen(true)}
            aria-label="New conversation"
            className="row-hover-bg"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 12px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-orange-bg)',
              border: '0.5px solid var(--uc-orange-bdr)',
              color: 'var(--uc-orange-l)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <Plus size={11} strokeWidth={2} />
            New
          </button>
        </div>

        {/* Conversation list */}
        <div style={{ padding: '6px 8px', maxHeight: 380, overflowY: 'auto' }} className="rail-scroll">
          {isLoading && (
            <>
              <SkeletonConvRow />
              <SkeletonConvRow />
              <SkeletonConvRow />
            </>
          )}

          {!isLoading && isError && (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                Couldn't load conversations.
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                Check your connection and try again.
              </p>
            </div>
          )}

          {!isLoading && !isError && sorted.length === 0 && (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
              }}
            >
              <MessageCircle
                size={28}
                strokeWidth={1}
                style={{ color: 'var(--text-tertiary)', margin: '0 auto 8px', display: 'block' }}
              />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                No conversations yet
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                Message a classmate or alumni to get started.
              </p>
            </div>
          )}

          {!isLoading && !isError &&
            sorted.map((conv) => {
              const isMentorship = conv.type === 'mentorship'
              const displayName =
                conv.type === 'direct' || isMentorship
                  ? (conv.otherParticipant?.fullName ?? 'Unknown')
                  : (conv.name ?? 'Group')
              const avatarInitials = initials(displayName)
              const avatarSrc =
                conv.type === 'direct' || isMentorship
                  ? conv.otherParticipant?.profile.avatarUrl
                  : conv.avatarUrl
              const color = seedColor(conv.id)
              const preview = conv.lastMessage?.body || 'No messages yet'
              const time = conv.lastMessage?.sentAt
                ? relativeTime(conv.lastMessage.sentAt)
                : null
              const hasUnread = conv.unreadCount > 0

              return (
                <button
                  type="button"
                  key={conv.id}
                  onClick={() => handleConv(conv.id)}
                  className="row-hover-bg"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 10px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--r-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 150ms',
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar src={avatarSrc} initials={avatarInitials} color={color} size={36} />
                    {hasUnread && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--uc-indigo)',
                          border: '1.5px solid var(--surface-raised)',
                        }}
                      />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {(conv.type === 'direct' || isMentorship) && conv.otherParticipant?.role && (
                        <RoleBadge role={conv.otherParticipant.role} size={13} tipPlacement="below" />
                      )}
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 13,
                          fontWeight: hasUnread ? 500 : 400,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {displayName}
                      </span>
                      {isMentorship && (
                        <span
                          style={{
                            flexShrink: 0,
                            padding: '1px 5px',
                            borderRadius: 'var(--r-pill)',
                            fontSize: 12,
                            fontWeight: 500,
                            background: 'var(--uc-orange-bg)',
                            border: '0.5px solid var(--uc-orange-bdr)',
                            color: 'var(--uc-orange-l)',
                            lineHeight: 1.6,
                          }}
                        >
                          mentorship
                        </span>
                      )}
                      {time && (
                        <span
                          style={{ flexShrink: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}
                        >
                          {time}
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 12,
                        fontWeight: 400,
                        color: hasUnread ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                        marginTop: 1,
                      }}
                    >
                      {preview}
                    </span>
                  </div>
                </button>
              )
            })}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 10px 10px', borderTop: '0.5px solid var(--border-default)' }}>
          <button
            type="button"
            onClick={handleOpenAll}
            style={{
              width: '100%',
              padding: '8px 0',
              background: 'var(--uc-indigo-bg)',
              border: '0.5px solid var(--uc-indigo-bdr)',
              borderRadius: 'var(--r-pill)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--uc-indigo-xl)',
              transition: 'background 150ms',
            }}
            className="row-hover-bg"
          >
            Open messages
          </button>
        </div>
      </motion.div>

      {newOpen && <NewConversationModal onClose={() => setNewOpen(false)} />}
    </>
  )
}
