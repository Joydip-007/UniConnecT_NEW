import { useState } from 'react'
import { MapPin, Globe, NotebookPen, Plus } from 'lucide-react'
import {
  useStudySessions,
  useCreateStudySession,
  useRsvpStudySession,
  type StudySession,
} from '@/features/groups'
import { SessionNotesPanel } from './SessionNotesPanel'

interface Props {
  groupId: string
  currentUserId?: string
  showCreateAction?: boolean
}

export function StudySessionsTab({ groupId, currentUserId, showCreateAction = true }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [activeNotesSessionId, setActiveNotesSessionId] = useState<string | null>(null)
  const { data, isLoading } = useStudySessions(groupId)
  const createMutation = useCreateStudySession(groupId)
  const rsvpMutation = useRsvpStudySession(groupId)

  const now = new Date()
  const upcoming = data?.items.filter((s) => new Date(s.startsAt) > now) ?? []
  const past = data?.items.filter((s) => new Date(s.startsAt) <= now) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showCreateAction && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{ minHeight: 44, padding: '8px 14px', fontSize: 13, fontWeight: 400, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'var(--surface-raised)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Plus size={13} strokeWidth={1.5} />
            New session
          </button>
        </div>
      )}

      {showCreateAction && showCreate && (
        <CreateSessionForm
          onSubmit={(input) => createMutation.mutate(input, { onSuccess: () => setShowCreate(false) })}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <SessionsSkeleton />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Upcoming</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.map((s) => (
                  <SessionCard
                    key={s.id}
                    groupId={groupId}
                    session={s}
                    currentUserId={currentUserId}
                    onRsvp={(status) => rsvpMutation.mutate({ sessionId: s.id, status })}
                    isRsvpPending={rsvpMutation.isPending}
                    notesOpen={activeNotesSessionId === s.id}
                    onToggleNotes={() => setActiveNotesSessionId((current) => (current === s.id ? null : s.id))}
                  />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Past</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {past.map((s) => (
                  <SessionCard
                    key={s.id}
                    groupId={groupId}
                    session={s}
                    currentUserId={currentUserId}
                    onRsvp={(status) => rsvpMutation.mutate({ sessionId: s.id, status })}
                    isRsvpPending={rsvpMutation.isPending}
                    notesOpen={activeNotesSessionId === s.id}
                    onToggleNotes={() => setActiveNotesSessionId((current) => (current === s.id ? null : s.id))}
                  />
                ))}
              </div>
            </section>
          )}
          {!upcoming.length && !past.length && (
            <div style={{ padding: '32px 16px', textAlign: 'center', background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No study sessions yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SessionCard({ groupId, session, currentUserId, onRsvp, isRsvpPending, notesOpen, onToggleNotes }: {
  groupId: string
  session: StudySession
  currentUserId?: string
  onRsvp: (status: 'going' | 'not_going') => void
  isRsvpPending: boolean
  notesOpen: boolean
  onToggleNotes: () => void
}) {
  const isGoing = session.ownRsvp === 'going'
  const d = new Date(session.startsAt)
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const isCreator = !!currentUserId && session.createdBy === currentUserId

  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Date chip */}
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)', padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>{dateStr}</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{timeStr}</p>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{session.title}</p>
          {session.description && (
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{session.description}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
            {session.isOnline ? <Globe size={11} strokeWidth={1.5} /> : <MapPin size={11} strokeWidth={1.5} />}
            <span>{session.isOnline ? (session.onlineLink ?? 'Online') : (session.location ?? 'TBD')}</span>
            {session.capacity != null && (
              <span style={{ marginLeft: 6 }}>{session.rsvpCount}/{session.capacity} going</span>
            )}
            {session.capacity == null && (
              <span style={{ marginLeft: 6 }}>{session.rsvpCount} going</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
          <button
            type="button"
            disabled={isRsvpPending}
            onClick={() => onRsvp(isGoing ? 'not_going' : 'going')}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 400,
              borderRadius: 'var(--r-pill)',
              border: isGoing ? 'none' : '0.5px solid var(--border-default)',
              background: isGoing ? 'var(--uc-indigo)' : 'none',
              color: isGoing ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
              cursor: isRsvpPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isGoing ? 'Going ✓' : 'RSVP'}
          </button>
          <button
            type="button"
            onClick={onToggleNotes}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 400,
              borderRadius: 'var(--r-pill)',
              border: '0.5px solid var(--border-default)',
              background: notesOpen ? 'var(--surface-raised)' : 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <NotebookPen size={12} strokeWidth={1.5} />
            Notes
          </button>
        </div>
      </div>

      {notesOpen && (
        <div style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: 10 }}>
          <SessionNotesPanel groupId={groupId} sessionId={session.id} isCreator={isCreator} />
        </div>
      )}
    </div>
  )
}

function CreateSessionForm({ onSubmit, onCancel, isPending }: {
  onSubmit: (input: { title: string; is_online: boolean; starts_at: string; location?: string; online_link?: string; capacity?: number }) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [title, setTitle] = useState('')
  const [isOnline, setIsOnline] = useState(false)
  const [location, setLocation] = useState('')
  const [onlineLink, setOnlineLink] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [capacity, setCapacity] = useState('')

  const inputStyle = { width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-sm)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' as const, fontWeight: 400 }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          title,
          is_online: isOnline,
          starts_at: new Date(startsAt).toISOString(),
          location: !isOnline && location ? location : undefined,
          online_link: isOnline && onlineLink ? onlineLink : undefined,
          capacity: capacity ? parseInt(capacity, 10) : undefined,
        })
      }}
      style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <input placeholder="Session title" value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" id="is-online" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
        <label htmlFor="is-online" style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 }}>Online session</label>
      </div>
      {isOnline
        ? <input placeholder="Online link" type="url" value={onlineLink} onChange={(e) => setOnlineLink(e.target.value)} style={inputStyle} />
        : <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
      }
      <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required style={inputStyle} aria-label="Session start date and time" />
      <input placeholder="Capacity (optional)" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} style={inputStyle} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '6px 14px', fontSize: 13, fontWeight: 400, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
        <button type="submit" disabled={isPending} style={{ padding: '6px 14px', fontSize: 13, fontWeight: 400, borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-accent)', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
          {isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function SessionsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: '12px 16px', display: 'flex', gap: 12 }}>
          <div style={{ width: 56, height: 44, background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ height: 14, width: '50%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
            <div style={{ height: 12, width: '30%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
