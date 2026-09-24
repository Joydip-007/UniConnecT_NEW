import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MessageCircle, Plus } from 'lucide-react'
import type { ReportTargetType } from '@uniconnect/shared'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { TopNav } from '@/components/TopNav'
import { ReportModal } from '@/features/moderation/components/ReportModal'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { PATHS } from '@/router/paths'
import { useAuthStore } from '@/stores/authStore'
import { useConversation } from '../hooks/useConversation'
import { useConversationListSocket } from '../hooks/useConversationListSocket'
import { useConversations } from '../hooks/useMessagesData'
import type { Conversation } from '../types'
import { isOneToOne } from '../threadModel'
import { ConversationList } from './ConversationList'
import { DetailsRail } from './DetailsRail'
import { MessagesIconRail } from './MessagesIconRail'
import { NewConversationModal } from './NewConversationModal'
import { ThreadPane } from './ThreadPane'

function reportTarget(conv: Conversation): { type: ReportTargetType; id: string; label: string } | null {
  if (isOneToOne(conv) && conv.otherParticipant) {
    return { type: 'user', id: conv.otherParticipant.id, label: conv.otherParticipant.fullName }
  }
  if (conv.group) return { type: 'group', id: conv.group.id, label: conv.group.name }
  return null
}

/**
 * The whole Messages surface (Messages Page.dc.html): on desktop an icon rail, the
 * conversation list, the open thread and a details rail; on a phone the list
 * (`/messages`) and the thread (`/messages/:id`) are separate screens.
 */
export function MessagesWorkspace() {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const myUserId = useAuthStore((s) => s.user?.id)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isWide = useMediaQuery('(min-width: 1280px)')
  const variant = isMobile ? 'mobile' : 'desktop'

  const conversations = useConversations()
  const typingIds = useConversationListSocket()
  const single = useConversation(routeId ?? '')
  const active = useMemo(
    () => (routeId ? (conversations.data?.find((c) => c.id === routeId) ?? single.data) : undefined),
    [conversations.data, routeId, single.data],
  )

  const [detailsPref, setDetailsPref] = useState<boolean | null>(null)
  const [newMode, setNewMode] = useState<'direct' | 'group' | null>(null)
  const [reporting, setReporting] = useState(false)

  // The details rail defaults open only where it has room to sit beside the thread;
  // on a phone it is a sheet the user opens, and it closes when the thread changes.
  const detailsOpen = detailsPref ?? (isWide && !isMobile)
  useEffect(() => {
    if (isMobile) setDetailsPref(null)
  }, [routeId, isMobile])

  // Desktop always shows a thread: land /messages on the most relevant conversation.
  useEffect(() => {
    if (routeId || isMobile || !conversations.data?.length) return
    const list = conversations.data.filter((c) => !c.isRequest)
    const first = list.find((c) => c.isPinned) ?? list[0] ?? conversations.data[0]
    if (first) navigate(`${PATHS.MESSAGES}/${first.id}`, { replace: true })
  }, [routeId, isMobile, conversations.data, navigate])

  const target = active ? reportTarget(active) : null
  const openReport = target ? () => setReporting(true) : null

  return (
    <div className="msgx-page" data-screen={routeId ? 'thread' : 'list'}>
      <div className="msgx-topnav">
        <TopNav />
      </div>

      <div className="msgx-body">
        <div className="msgx-rail">
          <MessagesIconRail />
        </div>

        <section className="msgx-list" aria-label="Conversations">
          <ConversationList
            variant={variant}
            conversations={conversations.data}
            isLoading={conversations.isLoading}
            isError={conversations.isError}
            onRetry={() => void conversations.refetch()}
            activeId={routeId}
            typingIds={typingIds}
            myUserId={myUserId}
            onSelect={(id) => navigate(`${PATHS.MESSAGES}/${id}`)}
            onNewMessage={() => setNewMode('direct')}
            onNewGroup={() => setNewMode('group')}
          />
        </section>

        <section className="msgx-thread" aria-label="Conversation">
          {active ? (
            <ThreadPane
              key={active.id}
              conv={active}
              variant={variant}
              myUserId={myUserId}
              onToggleDetails={() => setDetailsPref(!detailsOpen)}
              onBack={() => navigate(PATHS.MESSAGES)}
              onReportConversation={openReport}
            />
          ) : (
            <EmptyThread
              loading={!!routeId && (conversations.isLoading || single.isLoading)}
              missing={!!routeId && !conversations.isLoading && !single.isLoading}
              onStart={() => setNewMode('direct')}
            />
          )}
        </section>

        {active && detailsOpen && (
          <DetailsRail
            key={active.id}
            conv={active}
            variant={isMobile ? 'sheet' : 'rail'}
            onClose={() => setDetailsPref(false)}
            onReport={openReport}
          />
        )}
      </div>

      {!routeId && <MobileBottomNav />}

      {newMode && <NewConversationModal mode={newMode} onClose={() => setNewMode(null)} />}
      {reporting && target && (
        <ReportModal
          isOpen
          onClose={() => setReporting(false)}
          targetType={target.type}
          targetId={target.id}
          targetLabel={target.label}
        />
      )}
    </div>
  )
}

function EmptyThread({ loading, missing, onStart }: { loading: boolean; missing: boolean; onStart: () => void }) {
  if (loading) return <div style={{ flex: 1 }} />
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--r-pill)',
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--uc-indigo-l)',
        }}
      >
        <MessageCircle size={22} strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 300 }}>
        <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          {missing ? 'Conversation not found' : 'Connect with your campus'}
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
          {missing
            ? 'It may have been removed, or you are no longer part of it.'
            : 'Message alumni for career advice, find study partners, or follow up with your mentor between sessions.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="msgx-dim"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '9px 20px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--uc-indigo)',
          border: 'none',
          color: 'var(--on-indigo)',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <Plus size={14} strokeWidth={2} />
        Start a conversation
      </button>
    </div>
  )
}
