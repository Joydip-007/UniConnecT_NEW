import { useState } from 'react'
import { ChevronRight, Info } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { UserRole } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { RoleBadge } from '@/components/RoleBadge'
import { Avatar } from '@/components/Avatar'
import { GhostBtn } from '@/components/Button'
import { RewardRequestsPanel } from '@/pages/admin/RewardRequestsPanel'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'

// ── Types ──────────────────────────────────────────────────────────────────────

interface MentorSummary {
  id: string
  fullName: string
  role?: UserRole
  avatarUrl: string | null
  department: string | null
  batchYear: string | null
  mentorshipPoints: number
  maxMentees: number
  currentMentees: number
  completedCount: number
  totalSessions: number
}

interface FeedbackEntry {
  id: string
  authorId: string
  authorRole: 'student' | 'alumni'
  rating: number
  comment: string | null
  createdAt: string
}

interface MentorRequest {
  id: string
  status: string
  message: string
  createdAt: string
  updatedAt: string
  sessionCount: number
  student: {
    id: string
    fullName: string
    role?: UserRole
    avatarUrl: string | null
    department: string | null
    batchYear: string | null
  }
  feedback: {
    student: FeedbackEntry | null
    alumni: FeedbackEntry | null
  }
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useAdminMentors(page: number) {
  return useQuery<Paginated<MentorSummary>>({
    queryKey: ['admin', 'mentorship', 'mentors', page],
    queryFn: () =>
      api
        .get<{ data: Paginated<MentorSummary> }>('/admin/mentorship/mentors', {
          params: { page, limit: 20 },
        })
        .then((r) => r.data.data),
  })
}

function useAdminMentorRequests(alumniId: string, enabled: boolean) {
  return useQuery<MentorRequest[]>({
    queryKey: ['admin', 'mentorship', 'mentors', alumniId, 'requests'],
    queryFn: () =>
      api
        .get<{ data: MentorRequest[] }>(`/admin/mentorship/mentors/${alumniId}/requests`)
        .then((r) => r.data.data),
    enabled,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 13, letterSpacing: '-1px', color: 'var(--uc-orange)' }}>
      {'★'.repeat(rating)}
      <span style={{ color: 'var(--border-default)' }}>{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

function statusTone(status: string): { bg: string; color: string } {
  if (status === 'accepted') return { bg: 'var(--uc-mint-bg)', color: 'var(--uc-mint)' }
  if (status === 'completed') return { bg: 'var(--uc-indigo-bg)', color: 'var(--uc-indigo-xl)' }
  if (status === 'declined') return { bg: 'var(--uc-orange-bg)', color: 'var(--uc-orange-l)' }
  return { bg: 'var(--surface-raised)', color: 'var(--text-tertiary)' }
}

// ── Expanded request list ─────────────────────────────────────────────────────

function MentorRequestList({ alumniId }: { alumniId: string }) {
  const { data, isLoading } = useAdminMentorRequests(alumniId, true)

  if (isLoading) {
    return (
      <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          border: '2px solid var(--border-default)',
          borderTopColor: 'var(--uc-indigo)',
          animation: 'spin 0.7s linear infinite',
        }} />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <p style={{ margin: '12px 0', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
        No requests yet
      </p>
    )
  }

  const sorted = [...data].sort((a, b) => {
    const order = ['accepted', 'pending', 'completed', 'declined', 'expired']
    return order.indexOf(a.status) - order.indexOf(b.status)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 8px' }}>
      {sorted.map((req) => {
        const tone = statusTone(req.status)
        return (
          <div
            key={req.id}
            style={{
              background: 'var(--surface-page)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Request header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar src={req.student.avatarUrl} initials={getInitials(req.student.fullName)} color={seedColor(req.student.id)} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle' }}>
                  {req.student.role && <RoleBadge role={req.student.role} size={13} tipPlacement="below" />}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {req.student.fullName}
                  </span>
                </span>
                {req.student.department && (
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                    {req.student.department}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: 'var(--r-pill)',
                background: tone.bg,
                color: tone.color,
              }}>
                {req.status}
              </span>
              {req.sessionCount > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {req.sessionCount} session{req.sessionCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Feedback — completed requests only */}
            {req.status === 'completed' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FeedbackCard label="Student feedback" entry={req.feedback.student} />
                <FeedbackCard label="Alumni feedback" entry={req.feedback.alumni} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FeedbackCard({ label, entry }: { label: string; entry: FeedbackEntry | null }) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-sm)',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{label}</span>
      {entry ? (
        <>
          <StarDisplay rating={entry.rating} />
          {entry.comment && (
            <p style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}>
              "{entry.comment}"
            </p>
          )}
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          No feedback yet
        </span>
      )}
    </div>
  )
}

// ── Mentor row ────────────────────────────────────────────────────────────────

function MentorRow({ mentor }: { mentor: MentorSummary }) {
  const [expanded, setExpanded] = useState(false)
  const capacityPct = mentor.maxMentees > 0 ? mentor.currentMentees / mentor.maxMentees : 0

  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-md)',
      overflow: 'hidden',
    }}>
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
        }}
      >
        {/* Avatar */}
        <Avatar src={mentor.avatarUrl} initials={getInitials(mentor.fullName)} color={seedColor(mentor.id)} size={36} />

        {/* Identity */}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {mentor.role && <RoleBadge role={mentor.role} size={14} tipPlacement="below" />}
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {mentor.fullName}
            </p>
          </div>
          {(mentor.department || mentor.batchYear) && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {[mentor.department, mentor.batchYear ? `Batch ${mentor.batchYear}` : null].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Points */}
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          padding: '3px 10px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
          color: 'var(--uc-indigo-xl)',
          flexShrink: 0,
        }}>
          {mentor.mentorshipPoints} pts
        </span>

        {/* Capacity */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 88 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {mentor.currentMentees} / {mentor.maxMentees} mentees
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: capacityPct >= 1 ? 'var(--uc-orange-l)' : 'var(--uc-mint)',
            }}>
              {capacityPct >= 1 ? 'Full' : 'Open'}
            </span>
          </div>
          <div style={{ height: 3, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: '100%',
              background: capacityPct >= 1 ? 'var(--uc-orange)' : 'var(--uc-mint)',
              borderRadius: 'var(--r-pill)',
              transform: `scaleX(${Math.min(capacityPct, 1)})`,
              transformOrigin: 'left center',
              transition: 'transform 0.4s var(--ease-out-strong)',
            }} />
          </div>
        </div>

        {/* Completed count */}
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {mentor.completedCount} completed
        </span>

        {/* Chevron */}
        <ChevronRight
          size={16}
          color="var(--text-tertiary)"
          style={{ flexShrink: 0, transition: 'transform 200ms', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          borderTop: '0.5px solid var(--border-default)',
          padding: '8px 16px 12px',
          background: 'var(--surface-raised)',
        }}>
          <MentorRequestList alumniId={mentor.id} />
        </div>
      )}
    </div>
  )
}

// ── MentorshipTab ─────────────────────────────────────────────────────────────

function LegendPopover() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="How mentor stats are calculated"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          color: open ? 'var(--uc-indigo-xl)' : 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Info size={14} strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 49,
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              textAlign: 'inherit',
              cursor: 'pointer',
            }}
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setOpen(false)
              }
            }}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 50,
            marginTop: 6,
            width: 280,
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-hover)',
            borderRadius: 'var(--r-md)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              How mentor stats work
            </p>
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Points', 'Earned at 10 pts per completed session. Shown on the mentor\'s profile. No points are deducted.'],
                ['Capacity bar', 'Green = slots available. Orange = at maximum mentees. Set by the mentor in their profile settings (default: 3).'],
                ['Completed', 'Mentorship requests where both parties confirmed the relationship ended. Sessions are counted separately.'],
                ['Sessions', 'Individual meeting logs recorded by either party within an accepted request.'],
              ].map(([term, def]) => (
                <div key={term as string}>
                  <dt style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 2 }}>{term}</dt>
                  <dd style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{def}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </div>
  )
}

type MentorshipView = 'mentors' | 'rewards'

function MentorsPanel() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAdminMentors(page)
  const LIMIT = 20

  if (isLoading || !data) {
    return (
      <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '2px solid var(--border-default)',
          borderTopColor: 'var(--uc-indigo)',
          animation: 'spin 0.7s linear infinite',
        }} />
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(data.total / LIMIT))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', flex: 1 }}>
          {data.total.toLocaleString()} alumni mentor{data.total !== 1 ? 's' : ''}
        </p>
        <LegendPopover />
      </div>

      {data.items.length === 0 && (
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '56px 24px',
          textAlign: 'center',
          fontSize: 14,
          color: 'var(--text-tertiary)',
        }}>
          No mentors yet
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.items.map((mentor) => (
          <MentorRow key={mentor.id} mentor={mentor} />
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
          <GhostBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</GhostBtn>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
            {page} / {totalPages}
          </span>
          <GhostBtn disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</GhostBtn>
        </div>
      )}
    </div>
  )
}

export function MentorshipTab() {
  const [view, setView] = useState<MentorshipView>('mentors')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {(['mentors', 'rewards'] as MentorshipView[]).map((v) => {
          const active = v === view
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={{
                padding: '5px 14px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {v === 'mentors' ? 'Mentors' : 'Reward requests'}
            </button>
          )
        })}
      </div>

      {view === 'mentors' ? <MentorsPanel /> : <RewardRequestsPanel />}
    </div>
  )
}
