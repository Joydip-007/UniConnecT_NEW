import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { avatarColor, getInitials } from '@/utils/avatar'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { useConnectionAction } from '../hooks/useConnectionAction'
import { usePeopleDirectory, type DirectoryPerson, type PeopleDirectoryFilters } from '../hooks/usePeopleDirectory'

/** Second line under the name: what they study or do, and when. */
function metaLine(person: DirectoryPerson) {
  const { department, batchYear, headline } = person.profile
  return [department, batchYear, headline].filter(Boolean).join(' · ')
}

/** Third line: the reason this row is worth looking at. */
function mutualLine(person: DirectoryPerson) {
  const { mutualConnections } = person
  if (mutualConnections > 0) {
    return `${mutualConnections} mutual ${mutualConnections === 1 ? 'connection' : 'connections'}`
  }
  return person.profile.department ? `Also in ${person.profile.department}` : ''
}

function PersonRow({ person, first }: { person: DirectoryPerson; first: boolean }) {
  const navigate = useNavigate()
  const { send, withdraw } = useConnectionAction(person.id)
  const [opening, setOpening] = useState(false)

  /**
   * Same contract as ConnectButton: `POST /conversations` is an upsert, so this opens
   * the existing thread when there is one and creates it when there is not. Landing on
   * the bare message list would make the button a dead end.
   */
  async function openConversation() {
    setOpening(true)
    try {
      const res = await api.post<{ data: { id: string } }>('/conversations', { participantId: person.id })
      navigate(PATHS.CONVERSATION.replace(':id', res.data.data.id))
    } catch {
      navigate(PATHS.MESSAGES)
    } finally {
      setOpening(false)
    }
  }

  // `pending_received` is deliberately not actionable here — accepting belongs on
  // /connections where the request's note and the accept/decline pair live together.
  const status = person.connectionStatus
  const busy = send.isPending || withdraw.isPending

  const cta =
    status === 'connected'
      ? { label: 'Connected', bg: 'transparent', fg: 'var(--text-secondary)', bdr: 'var(--border-hover)', onClick: null }
      : status === 'pending_sent'
      ? {
          label: 'Requested',
          bg: 'transparent',
          fg: 'var(--text-secondary)',
          bdr: 'var(--border-hover)',
          onClick: () => withdraw.mutate(),
        }
      : status === 'pending_received'
      ? {
          label: 'Respond',
          bg: 'var(--uc-orange-bg)',
          fg: 'var(--uc-orange-l)',
          bdr: 'var(--uc-orange-bdr)',
          onClick: () => navigate('/connections'),
        }
      : {
          label: 'Connect',
          bg: 'var(--uc-indigo)',
          fg: 'var(--on-indigo)',
          bdr: 'var(--uc-indigo)',
          onClick: () => send.mutate(undefined),
        }

  const meta = metaLine(person)
  const mutual = mutualLine(person)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderTop: first ? 'none' : '0.5px solid var(--border-default)',
      }}
    >
      <Avatar
        src={person.profile.avatarUrl}
        initials={getInitials(person.profile.fullName)}
        color={avatarColor(person.id)}
        size={44}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <RoleBadge role={person.role} />
          <button
            type="button"
            onClick={() => navigate(PATHS.PROFILE.replace(':id', person.username || person.id))}
            style={{
              padding: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            {person.profile.fullName}
          </button>
        </div>
        {meta && (
          <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>{meta}</p>
        )}
        {mutual && (
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{mutual}</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          aria-label={`Message ${person.profile.fullName}`}
          title={`Message ${person.profile.fullName}`}
          disabled={opening}
          onClick={openConversation}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: '0.5px solid var(--border-default)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            opacity: opening ? 0.6 : 1,
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <MessageSquare size={15} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          disabled={!cta.onClick || busy}
          onClick={() => cta.onClick?.()}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'inherit',
            borderRadius: 'var(--r-pill)',
            border: `0.5px solid ${cta.bdr}`,
            background: cta.bg,
            color: cta.fg,
            cursor: cta.onClick ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {cta.label}
        </button>
      </div>
    </div>
  )
}

function SkeletonRow({ first }: { first: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderTop: first ? 'none' : '0.5px solid var(--border-default)',
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-raised)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ height: 13, width: '35%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        <div style={{ height: 11, width: '55%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
      </div>
      <div style={{ width: 84, height: 30, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', flexShrink: 0 }} />
    </div>
  )
}

interface Props extends PeopleDirectoryFilters {
  /** Rendered when the filters match nobody, so the page can offer its own "clear filters". */
  emptyState: React.ReactNode
}

export function PeopleDirectory({ emptyState, ...filters }: Props) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePeopleDirectory(filters)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const people = data?.pages.flatMap((p) => p.items) ?? []

  if (isLoading) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} first={i === 0} />
        ))}
      </div>
    )
  }

  if (people.length === 0) return <>{emptyState}</>

  return (
    <>
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        {people.map((person, i) => (
          <PersonRow key={person.id} person={person} first={i === 0} />
        ))}
      </div>
      <div ref={sentinelRef} style={{ height: 1 }} />
    </>
  )
}
