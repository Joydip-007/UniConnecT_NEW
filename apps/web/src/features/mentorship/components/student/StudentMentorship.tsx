import { useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useMentorDirectory, useMyMentorshipRequests, useRequestSessions } from '../../hooks/useMentorship'
import { firstName, mentorTags, shortDate } from '../../format'
import type { MyRequest } from '../../types'
import { Eyebrow } from '../ui'
import { cardStyle, hairline } from '../styles'
import { FindMentor } from './FindMentor'
import type { MentorFilter } from './FindMentor'
import { MentorshipHub } from './MentorshipHub'
import { PastMentors } from './PastMentors'
import { RequestOutcomeNotice } from './RequestOutcomeNotice'

const UNDO_WINDOW_MS = 15 * 60 * 1000
const OUTCOME_NOTICE_DAYS = 30

function endedJustNowByMe(r: MyRequest, viewerId: string) {
  return (
    r.status === 'completed' &&
    r.endedBy === viewerId &&
    !!r.endedAt &&
    Date.now() - new Date(r.endedAt).getTime() < UNDO_WINDOW_MS
  )
}

/** The mentorships that belong in the hub: active ones, plus one the student just ended (undo). */
function hubRequests(requests: MyRequest[], viewerId: string) {
  return requests.filter((r) => r.status === 'accepted' || endedJustNowByMe(r, viewerId))
}

/** Student centre column: your mentorship, past mentors, the directory, then any declined request. */
export function StudentMentorship() {
  const user = useAuthStore((s) => s.user)
  const viewerId = user?.id ?? ''
  const requestsQuery = useMyMentorshipRequests()
  const directoryQuery = useMentorDirectory()
  const [filters, setFilters] = useState<MentorFilter[]>([])

  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data])
  const hub = hubRequests(requests, viewerId)
  const past = requests.filter((r) => r.status === 'completed')
  const activeAlumni = new Set(requests.filter((r) => r.status === 'accepted').map((r) => r.alumni.id))
  const requestedIds = new Set(requests.filter((r) => r.status === 'pending').map((r) => r.alumni.id))
  const mentors = (directoryQuery.data?.items ?? []).filter((m) => !activeAlumni.has(m.id))

  // The newest declined or expired request, unless the student has since asked that mentor again.
  const outcome = useMemo(() => {
    const cutoff = Date.now() - OUTCOME_NOTICE_DAYS * 24 * 60 * 60 * 1000
    return requests.find((r) => {
      if (r.status !== 'declined' && r.status !== 'expired') return false
      if (new Date(r.updatedAt).getTime() < cutoff) return false
      return !requests.some(
        (o) => o.alumni.id === r.alumni.id && o.id !== r.id && new Date(o.createdAt) > new Date(r.createdAt),
      )
    })
  }, [requests])

  function findSimilar(r: MyRequest) {
    const declinedMentor = directoryQuery.data?.items.find((m) => m.id === r.alumni.id)
    const topics = declinedMentor ? mentorTags(declinedMentor) : []
    setFilters(topics.length > 0 ? ['accepting', ...topics.map((t) => `topic:${t}` as const)] : ['accepting'])
    document.getElementById('find-a-mentor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {requestsQuery.isLoading && (
        <div style={{ ...cardStyle, padding: 24, fontSize: 13, color: 'var(--text-secondary)' }}>Loading your mentorship…</div>
      )}
      {hub.map((r) => (
        <MentorshipHub key={r.id} request={r} viewerId={viewerId} />
      ))}
      <PastMentors requests={past} />
      <div id="find-a-mentor" style={{ scrollMarginTop: 80, display: 'contents' }} />
      <FindMentor
        mentors={mentors}
        isLoading={directoryQuery.isLoading}
        requestedIds={requestedIds}
        viewerDepartment={user?.profile?.department ?? null}
        filters={filters}
        onFiltersChange={setFilters}
      />
      {outcome && <RequestOutcomeNotice request={outcome} onFindSimilar={() => findSimilar(outcome)} />}
    </>
  )
}

const HOW_IT_WORKS = [
  'Request a mentor with a short note about what you need.',
  'If they accept, a conversation opens in Messages.',
  'Sessions are logged by your mentor. Requests expire after 7 days without a reply.',
]

/** Student right rail: how mentorship works, and your upcoming and recent sessions. */
export function StudentMentorshipRail() {
  const viewerId = useAuthStore((s) => s.user?.id ?? '')
  const { data } = useMyMentorshipRequests()
  const active = (data ?? []).filter((r) => r.status === 'accepted')
  const primary = active[0] ?? null
  const { data: sessions } = useRequestSessions(primary?.id ?? null)

  const upcoming = active
    .filter((r) => r.openSessionRequest)
    .map((r) => {
      const sr = r.openSessionRequest!
      const who = sr.requestedBy === viewerId ? 'Requested' : 'Scheduled'
      return {
        key: sr.id,
        title: sr.topic || `Session with ${firstName(r.alumni.fullName)}`,
        meta: `${sr.slotLabel ?? 'Time to be agreed'} · ${sr.status === 'scheduled' ? 'Scheduled' : who} · ${r.alumni.fullName}`,
      }
    })
  const recent = (sessions ?? []).slice(0, 2).map((s) => ({
    key: s.id,
    title: s.topic,
    meta: `${shortDate(s.sessionDate)} · ${s.durationMinutes} min · ${primary?.alumni.fullName ?? ''}`,
  }))
  const rows = [...upcoming, ...recent]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section style={{ ...cardStyle, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Eyebrow>How mentorship works</Eyebrow>
        {HOW_IT_WORKS.map((text, i) => (
          <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--uc-indigo-l)', width: 14, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</span>
          </div>
        ))}
      </section>

      {rows.length > 0 && (
        <section style={{ ...cardStyle, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Eyebrow>Your sessions</Eyebrow>
          {rows.map((row, i) => (
            <div key={row.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {i > 0 && <div style={{ height: 0, borderTop: hairline }} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{row.title}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.meta}</span>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
