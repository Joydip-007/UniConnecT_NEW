import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MessageSquare, XCircle } from 'lucide-react'
import { useToastStore } from '@/stores/toastStore'
import { useDecideRequest } from '../../hooks/useMentorship'
import { deptBatch, expiresIn, firstName, timeAgo } from '../../format'
import type { IncomingRequest, MentorSettings } from '../../types'
import { Btn, PersonAvatar, RolePill, StatusStrip } from '../ui'
import { apiErrorMessage, btnStyle, cardStyle, useIsMobile } from '../styles'

type Outcome = 'accepted' | 'declined'

interface Decided {
  request: IncomingRequest
  outcome: Outcome
  conversationId: string | null
}

/**
 * Pending requests. A decided card stays put with its outcome and an Undo — the refetch
 * drops it from the pending list, so the outcome is kept here rather than in the cache.
 */
export function RequestsTab({ pending, settings, isLoading }: { pending: IncomingRequest[]; settings: MentorSettings | undefined; isLoading: boolean }) {
  const [decided, setDecided] = useState<Record<string, Decided>>({})

  const cards = [
    ...pending.filter((r) => !decided[r.id]).map((r) => ({ request: r, decided: null as Decided | null })),
    ...Object.values(decided).map((d) => ({ request: d.request, decided: d })),
  // Oldest first: it expires soonest.
  ].sort((a, b) => new Date(a.request.createdAt).getTime() - new Date(b.request.createdAt).getTime())

  if (isLoading) {
    return <div style={{ ...cardStyle, padding: 24, fontSize: 13, color: 'var(--text-secondary)' }}>Loading requests…</div>
  }
  if (cards.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
        No pending requests. New requests from students show up here.
      </div>
    )
  }

  return (
    <>
      {cards.map(({ request, decided: d }) => (
        <RequestCard
          key={request.id}
          request={request}
          settings={settings}
          decided={d}
          onDecided={(outcome, conversationId) =>
            setDecided((s) => ({ ...s, [request.id]: { request, outcome, conversationId } }))
          }
          onUndone={() =>
            setDecided((s) => {
              const next = { ...s }
              delete next[request.id]
              return next
            })
          }
        />
      ))}
    </>
  )
}

function RequestCard({
  request,
  settings,
  decided,
  onDecided,
  onUndone,
}: {
  request: IncomingRequest
  settings: MentorSettings | undefined
  decided: Decided | null
  onDecided: (outcome: Outcome, conversationId: string | null) => void
  onUndone: () => void
}) {
  const isMobile = useIsMobile()
  const show = useToastStore((s) => s.show)
  const decide = useDecideRequest()
  const [confirming, setConfirming] = useState(false)
  const student = request.student
  const name = firstName(student.fullName)

  const filled = settings?.currentMentees ?? 0
  const max = settings?.maxMentees ?? 0
  const full = !!settings && filled >= max
  const capText = full ? `All ${max} mentee places are filled` : `${filled + 1} of ${max} mentee places filled after accepting`

  function run(status: 'accepted' | 'declined' | 'pending') {
    decide.mutate(
      { requestId: request.id, status },
      {
        onSuccess: (data) => {
          setConfirming(false)
          if (status === 'pending') onUndone()
          else onDecided(status, data?.conversation_id ?? request.conversationId)
        },
        onError: (e) => show({ message: apiErrorMessage(e, 'Could not update the request'), type: 'error' }),
      },
    )
  }

  const btnH = isMobile ? 44 : 36
  const pill = { fontSize: isMobile ? 13 : 12, minHeight: btnH, padding: '0 14px' }

  return (
    <article style={{ ...cardStyle, padding: isMobile ? 14 : 16, display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 10 : 12 }}>
        <PersonAvatar id={student.id} name={student.fullName} src={student.avatarUrl} size={isMobile ? 40 : 44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link to={`/profile/${student.id}`} style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}>
              {student.fullName}
            </Link>
            <RolePill role={student.role ?? 'student'} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {[deptBatch(student.department, student.batchYear), `requested ${timeAgo(request.createdAt)}`].filter(Boolean).join(' · ')}
          </div>
        </div>
        {!decided && !isMobile && (
          <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--uc-amber-l)' }}>{expiresIn(request.createdAt)}</span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{request.message}</p>

      {!decided && !confirming && (
        isMobile ? (
          <>
            <span style={{ fontSize: 12, color: full ? 'var(--uc-amber-l)' : 'var(--text-tertiary)' }}>{capText}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn height={44} style={{ flex: 1, fontSize: 13 }} onClick={() => setConfirming(true)}>
                Decline
              </Btn>
              <Btn variant="primary" height={44} style={{ flex: 1, fontSize: 13 }} disabled={full || decide.isPending} onClick={() => run('accepted')}>
                Accept
              </Btn>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 12, color: full ? 'var(--uc-amber-l)' : 'var(--text-tertiary)' }}>{capText}</span>
            <Btn className="mentorship-decline-btn" height={btnH} style={pill} onClick={() => setConfirming(true)}>
              Decline
            </Btn>
            <Btn variant="primary" height={btnH} style={{ ...pill, padding: '0 16px' }} disabled={full || decide.isPending} onClick={() => run('accepted')}>
              Accept
            </Btn>
          </div>
        )
      )}

      {!decided && confirming && (
        <div role="alertdialog" style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r-md)' }}>
          <span style={{ flex: 1, minWidth: isMobile ? '100%' : 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Decline {name}'s request?</span> They are notified and
            can ask another mentor.
          </span>
          <Btn height={btnH} style={{ ...pill, fontWeight: 500 }} onClick={() => setConfirming(false)}>
            Keep
          </Btn>
          <Btn variant="danger" height={btnH} style={pill} disabled={decide.isPending} onClick={() => run('declined')}>
            Decline
          </Btn>
        </div>
      )}

      {decided?.outcome === 'accepted' && (
        <StatusStrip
          tone="plain"
          inset={false}
          icon={<CheckCircle2 size={15} color="var(--uc-mint)" />}
          lead="Accepted."
          action={
            <div style={{ display: 'flex', gap: 4 }}>
              <Btn variant="quiet" height={btnH} style={{ color: 'var(--text-secondary)' }} disabled={decide.isPending} onClick={() => run('pending')}>
                Undo
              </Btn>
              {decided.conversationId && (
                <Link to={`/messages/${decided.conversationId}`} style={{ ...btnStyle('primary', btnH), padding: '0 14px' }}>
                  <MessageSquare size={13} />
                  Message
                </Link>
              )}
            </div>
          }
        >
          {name} is now in your Mentees · {settings ? `${settings.currentMentees} of ${settings.maxMentees} places filled` : ''}
        </StatusStrip>
      )}
      {decided?.outcome === 'declined' && (
        <StatusStrip
          tone="plain"
          inset={false}
          icon={<XCircle size={15} color="var(--uc-red)" />}
          action={
            <Btn variant="quiet" height={btnH} style={{ color: 'var(--text-secondary)' }} disabled={decide.isPending} onClick={() => run('pending')}>
              Undo
            </Btn>
          }
        >
          Declined · {name} was notified.
        </StatusStrip>
      )}
    </article>
  )
}
