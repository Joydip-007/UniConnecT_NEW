import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, SlidersHorizontal, X } from 'lucide-react'
import { useToastStore } from '@/stores/toastStore'
import { useRequestMentor, useWaitlist } from '../../hooks/useMentorship'
import { deptBatch, firstName, mentorTags, plural, replyText } from '../../format'
import type { AlumniMentor } from '../../types'
import { Btn, CheckRow, Eyebrow, FieldLabel, Meter, PersonAvatar, Popover, RolePill, TextBtn } from '../ui'
import { apiErrorMessage, btnStyle, cardStyle, hairline, textareaStyle, useIsMobile } from '../styles'

/** Filter keys: the two "Show" toggles, plus `topic:<name>` per topic. */
export type MentorFilter = 'accepting' | 'dept' | `topic:${string}`

const MAX_TOPIC_FILTERS = 8

function isFull(m: AlumniMentor) {
  return m.currentMentees >= m.maxMentees
}

interface FindMentorProps {
  mentors: AlumniMentor[]
  isLoading: boolean
  /** Alumni the student has a pending request with — their card reads "Requested". */
  requestedIds: Set<string>
  viewerDepartment: string | null
  filters: MentorFilter[]
  onFiltersChange: (next: MentorFilter[]) => void
}

export function FindMentor({ mentors, isLoading, requestedIds, viewerDepartment, filters, onFiltersChange }: FindMentorProps) {
  const isMobile = useIsMobile()
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Topics come from what mentors actually list, most common first.
  const topicOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of mentors) for (const t of m.topics) counts.set(t, (counts.get(t) ?? 0) + 1)
    const fromMentors = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
    // A selected topic stays listed even if no mentor carries it any more.
    const selected = filters.filter((f) => f.startsWith('topic:')).map((f) => f.slice(6))
    return [...new Set([...fromMentors.slice(0, MAX_TOPIC_FILTERS), ...selected])]
  }, [mentors, filters])

  const filtered = useMemo(() => {
    const topics = filters.filter((f) => f.startsWith('topic:')).map((f) => f.slice(6))
    return mentors.filter((m) => {
      if (filters.includes('accepting') && isFull(m)) return false
      if (filters.includes('dept') && (!viewerDepartment || m.department !== viewerDepartment)) return false
      if (topics.length > 0 && !topics.some((t) => mentorTags(m).includes(t))) return false
      return true
    })
  }, [mentors, filters, viewerDepartment])

  const acceptingCount = mentors.filter((m) => !isFull(m)).length
  const none = filters.length === 0
  const filtersOn = !none || popoverOpen
  const btnH = isMobile ? 44 : 32

  function toggle(key: MentorFilter) {
    onFiltersChange(filters.includes(key) ? filters.filter((f) => f !== key) : [...filters, key])
  }

  const label = (f: MentorFilter) => (f === 'accepting' ? 'Accepting now' : f === 'dept' ? 'Same department' : f.slice(6))

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 14 : 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Find a mentor
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {isMobile ? `${acceptingCount} accepting` : `${acceptingCount} alumni accepting mentees`}
        </span>
      </div>

      <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={() => {
            onFiltersChange([])
            setPopoverOpen(false)
          }}
          aria-pressed={none}
          style={{
            minHeight: btnH,
            padding: '0 13px',
            fontSize: 12,
            borderRadius: 'var(--r-pill)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            border: none ? 'none' : hairline,
            background: none ? 'var(--uc-indigo-bg)' : 'var(--surface-card)',
            color: none ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
            fontWeight: none ? 500 : 400,
          }}
        >
          All mentors
        </button>
        <button
          type="button"
          onClick={() => setPopoverOpen((v) => !v)}
          aria-expanded={popoverOpen}
          style={{
            minHeight: btnH,
            padding: '0 12px',
            fontSize: 12,
            borderRadius: 'var(--r-pill)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: filtersOn ? 'none' : hairline,
            background: filtersOn ? 'var(--uc-indigo-bg)' : 'var(--surface-card)',
            color: filtersOn ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
            fontWeight: filtersOn ? 500 : 400,
          }}
        >
          <SlidersHorizontal size={13} />
          Filters
          {!none && (
            <span
              style={{
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                boxSizing: 'border-box',
                borderRadius: 'var(--r-pill)',
                background: 'var(--uc-indigo)',
                color: 'var(--on-indigo)',
                fontSize: 11,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {filters.length}
            </span>
          )}
        </button>
        {filters.map((f) => (
          <span
            key={f}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              minHeight: btnH,
              padding: '0 5px 0 12px',
              boxSizing: 'border-box',
              fontSize: 12,
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-indigo-bg)',
              border: '0.5px solid var(--uc-indigo-bdr)',
              color: 'var(--uc-indigo-xl)',
            }}
          >
            {label(f)}
            <button
              type="button"
              onClick={() => toggle(f)}
              aria-label={`Remove filter ${label(f)}`}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {!none && (
          <TextBtn onClick={() => onFiltersChange([])} style={{ padding: '4px 6px' }}>
            Clear all
          </TextBtn>
        )}
        <Popover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          top={btnH + 8}
          width={260}
          align={isMobile ? 'stretch' : 'left'}
          ariaLabel="Mentor filters"
        >
          <Eyebrow style={{ padding: '8px 8px 4px' }}>Show</Eyebrow>
          <CheckRow label="Accepting now" checked={filters.includes('accepting')} onToggle={() => toggle('accepting')} />
          {viewerDepartment && (
            <CheckRow label="Same department" checked={filters.includes('dept')} onToggle={() => toggle('dept')} />
          )}
          {topicOptions.length > 0 && (
            <>
              <Eyebrow style={{ padding: '10px 8px 4px', borderTop: hairline, marginTop: 4 }}>Topics</Eyebrow>
              {topicOptions.map((t) => (
                <CheckRow key={t} label={t} checked={filters.includes(`topic:${t}`)} onToggle={() => toggle(`topic:${t}`)} />
              ))}
            </>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 4px 2px',
              marginTop: 4,
              borderTop: hairline,
            }}
          >
            <TextBtn onClick={() => onFiltersChange([])} style={{ padding: 4 }}>
              Clear
            </TextBtn>
            <Btn variant="primary" onClick={() => setPopoverOpen(false)}>
              Done
            </Btn>
          </div>
        </Popover>
      </div>

      {isLoading && (
        <div style={{ ...cardStyle, padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          Loading mentors…
        </div>
      )}
      {!isLoading && filtered.length === 0 && (
        <div style={{ ...cardStyle, padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          {mentors.length === 0 ? 'No alumni are accepting mentees right now.' : 'No mentors match this filter right now.'}
        </div>
      )}
      {filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 10 : 12 }}>
          {filtered.map((m) => (
            <MentorCard key={m.id} mentor={m} requested={requestedIds.has(m.id)} />
          ))}
        </div>
      )}
    </>
  )
}

function MentorCard({ mentor, requested }: { mentor: AlumniMentor; requested: boolean }) {
  const isMobile = useIsMobile()
  const show = useToastStore((s) => s.show)
  const [composing, setComposing] = useState(false)
  const [note, setNote] = useState('')
  const request = useRequestMentor()
  const waitlist = useWaitlist()
  const full = isFull(mentor)
  const pct = mentor.maxMentees > 0 ? (mentor.currentMentees / mentor.maxMentees) * 100 : 100
  const reply = replyText(mentor.avgReplyHours)
  const btnH = isMobile ? 44 : 32

  const capNote = full
    ? `${mentor.currentMentees} of ${mentor.maxMentees} places filled · notify me when a place opens`
    : `${mentor.currentMentees} of ${mentor.maxMentees} mentee places filled${reply ? ` · ${reply}` : ''}`

  const doneChip = (text: string) => (
    <span style={{ ...btnStyle('mint', btnH), cursor: 'default' }}>
      <Check size={12} />
      {text}
    </span>
  )

  return (
    <article
      className="mentorship-mentor-card"
      style={{ ...cardStyle, padding: isMobile ? 14 : 16, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <PersonAvatar id={mentor.id} name={mentor.fullName} src={mentor.avatarUrl} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{mentor.fullName}</span>
            <RolePill role="alumni" />
          </div>
          {mentor.headline && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{mentor.headline}</div>
          )}
          {deptBatch(mentor.department, mentor.batchYear) && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {deptBatch(mentor.department, mentor.batchYear)}
            </div>
          )}
        </div>
      </div>

      {mentorTags(mentor).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {mentorTags(mentor).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                padding: '3px 9px',
                borderRadius: 'var(--r-pill)',
                background: 'var(--surface-raised)',
                border: hairline,
                color: 'var(--text-secondary)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Meter pct={pct} color={full ? 'var(--uc-amber)' : 'var(--uc-mint)'} />
        <span style={{ fontSize: 12, color: full ? 'var(--uc-amber-l)' : 'var(--text-secondary)' }}>{capNote}</span>
      </div>

      {composing && (
        <div
          style={{
            padding: 12,
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <FieldLabel label={`A short note for ${firstName(mentor.fullName)}`}>
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. Looking for help preparing for backend interviews"
              style={textareaStyle}
            />
          </FieldLabel>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn onClick={() => setComposing(false)}>Cancel</Btn>
            <Btn
              variant="primary"
              disabled={!note.trim() || request.isPending}
              onClick={() =>
                request.mutate(
                  { alumniId: mentor.id, message: note.trim() },
                  {
                    onSuccess: () => {
                      setComposing(false)
                      setNote('')
                    },
                    onError: (e) => show({ message: apiErrorMessage(e, 'Could not send the request'), type: 'error' }),
                  },
                )
              }
            >
              Send request
            </Btn>
          </div>
        </div>
      )}

      <div style={{ borderTop: hairline, paddingTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            color: 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {plural(mentor.sessionsCompleted, 'session')} completed
        </span>
        <Link to={`/profile/${mentor.id}`} style={btnStyle('ghost', btnH)}>
          View profile
        </Link>
        {!full && (requested ? doneChip('Requested') : !composing && (
          <Btn variant="primary" height={btnH} onClick={() => setComposing(true)}>
            Request
          </Btn>
        ))}
        {full &&
          (mentor.isWaitlisted ? (
            doneChip("We'll notify you")
          ) : (
            <Btn
              height={btnH}
              disabled={waitlist.isPending}
              onClick={() =>
                waitlist.mutate(
                  { alumniId: mentor.id, join: true },
                  { onError: (e) => show({ message: apiErrorMessage(e, 'Could not save that'), type: 'error' }) },
                )
              }
            >
              <Bell size={12} />
              Notify me
            </Btn>
          ))}
      </div>
    </article>
  )
}
