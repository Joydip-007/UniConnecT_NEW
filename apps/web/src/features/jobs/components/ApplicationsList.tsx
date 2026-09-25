import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { FileText } from 'lucide-react'
import { api } from '@/lib/axios'
import { Avatar } from '@/components/Avatar'
import { queryClient } from '@/lib/queryClient'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { POSTER_APPLICATION_STATUSES, type ApplicationStatus } from '@uniconnect/shared'
import { statusTone } from '../jobMeta'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApplicantProfile {
  avatarUrl: string | null
  headline: string | null
  department: string | null
}

interface Applicant {
  id: string
  fullName: string
  profile: ApplicantProfile
}

interface JobApplication {
  id: string
  applicant: Applicant
  resumeUrl: string
  coverLetter: string | null
  status: ApplicationStatus
  notes: string | null
  appliedAt: string
}

interface ApplicationsResponse {
  items: JobApplication[]
  total: number
}

// ── Config ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'var(--uc-indigo)',
  'var(--uc-orange)',
  'var(--uc-mint)',
  'var(--uc-cyan)',
]

function avatarColor(name: string): string {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ── ApplicationRow ────────────────────────────────────────────────────────────

interface RowProps {
  application: JobApplication
  jobId: string
  queryKey: unknown[]
}

function ApplicationRow({ application, jobId, queryKey }: RowProps) {
  const { id, applicant, status, notes, appliedAt, resumeUrl } = application
  const [localStatus, setLocalStatus] = useState<ApplicationStatus>(status)

  const statusMutation = useMutation({
    mutationFn: (newStatus: ApplicationStatus) =>
      api
        .patch(`/jobs/${jobId}/applications/${id}`, { status: newStatus })
        .then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => setLocalStatus(status),
  })

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as ApplicationStatus
    setLocalStatus(newStatus)
    statusMutation.mutate(newStatus)
  }

  const localCfg = statusTone(localStatus)
  const name = applicant.fullName
  // The applicant withdrew — the poster reads it, but cannot move it back into the funnel.
  const withdrawn = localStatus === 'withdrawn'
  const isMobile = useMediaQuery('(max-width: 767px)')

  const statusPill = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 12,
        fontWeight: 500,
        padding: '2px 9px',
        borderRadius: 'var(--r-pill)',
        background: localCfg.bg,
        color: localCfg.fg,
        border: `0.5px solid ${localCfg.bdr}`,
        whiteSpace: 'nowrap',
      }}
    >
      {localCfg.label}
    </span>
  )

  const resumeLink = resumeUrl && (
    <a
      href={resumeUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--uc-indigo-l)', textDecoration: 'none' }}
    >
      <FileText size={12} strokeWidth={1.5} />
      Resume
    </a>
  )

  const statusSelect = !withdrawn && (
    <select
      value={localStatus}
      onChange={handleStatusChange}
      disabled={statusMutation.isPending}
      aria-label="Application status"
      style={{
        flexShrink: 0,
        fontSize: 12,
        padding: isMobile ? '0 10px' : '5px 10px',
        minHeight: isMobile ? 36 : undefined,
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-pill)',
        color: 'var(--text-primary)',
        cursor: statusMutation.isPending ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        opacity: statusMutation.isPending ? 0.6 : 1,
      }}
    >
      {POSTER_APPLICATION_STATUSES.map((s) => (
        <option key={s} value={s}>
          {statusTone(s).label}
        </option>
      ))}
    </select>
  )

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', borderBottom: '0.5px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar src={applicant.profile.avatarUrl} initials={initials(name)} color={avatarColor(name)} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Applied {format(parseISO(appliedAt), 'MMM d, yyyy')}</div>
          </div>
          {statusPill}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1 }}>{resumeLink}</span>
          {statusSelect}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <Avatar src={applicant.profile.avatarUrl} initials={initials(name)} color={avatarColor(name)} size={36} />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {name}
          </span>
{statusPill}
        </div>

        {applicant.profile.headline && (
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {applicant.profile.headline}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 5,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            Applied {format(parseISO(appliedAt), 'MMM d, yyyy')}
          </span>
          {resumeLink}
        </div>

        {notes && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {notes}
          </p>
        )}
      </div>

      {statusSelect}
    </div>
  )
}

// ── ApplicationsList ──────────────────────────────────────────────────────────

interface Props {
  jobId: string
}

export function ApplicationsList({ jobId }: Props) {
  const queryKey = ['jobs', 'applications', { jobId }]
  const isMobile = useMediaQuery('(max-width: 767px)')

  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: () =>
      api
        .get<{ data: ApplicationsResponse | JobApplication[] }>(`/jobs/${jobId}/applications`)
        .then((r) => {
          const payload = r.data.data
          return Array.isArray(payload) ? { items: payload, total: payload.length } : payload
        }),
  })

  if (isPending) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-tertiary)',
        }}
      >
        Loading applications…
      </div>
    )
  }

  if (isError) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--uc-red)',
        }}
      >
        Failed to load applications. Please try again.
      </div>
    )
  }

  const applications = data?.items ?? []

  if (applications.length === 0) {
    return (
      <div
        style={{
          padding: '40px 16px',
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-tertiary)',
        }}
      >
        No applications yet.
      </div>
    )
  }

  // On a phone the rows sit straight inside the posting card — no second card chrome.
  if (isMobile) {
    return (
      <div>
        {applications.map((app) => (
          <ApplicationRow key={app.id} application={app} jobId={jobId} queryKey={queryKey} />
        ))}
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '0.5px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          Applications
        </span>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {data.total} total
        </span>
      </div>

      <div>
        {applications.map((app) => (
          <ApplicationRow
            key={app.id}
            application={app}
            jobId={jobId}
            queryKey={queryKey}
          />
        ))}
      </div>
    </div>
  )
}
