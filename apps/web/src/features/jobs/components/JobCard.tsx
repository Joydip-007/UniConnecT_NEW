import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { differenceInDays, format, parseISO } from 'date-fns'
import { Bookmark, CheckCircle2, Clock, MapPin, Users } from 'lucide-react'
import { api } from '@/lib/axios'
import { Badge } from '@/components/Badge'
import { GhostBtn, MintBtn } from '@/components/Button'
import { queryClient } from '@/lib/queryClient'
import { ApplyModal } from './ApplyModal'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobPoster {
  id: string
  fullName: string
  profile: {
    avatarUrl: string | null
    headline: string | null
    department: string | null
  }
}

export interface Job {
  id: string
  title: string
  company: string
  location: string
  type: 'full_time' | 'part_time' | 'internship' | 'remote' | 'contract'
  description: string
  requirements: string[]
  salaryRange: string | null
  applicationUrl: string | null
  deadline: string | null
  postedBy: JobPoster
  applicationCount: number
  myApplication: unknown
  isSaved: boolean
  viewCount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<Job['type'], string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  remote: 'Remote',
  contract: 'Contract',
}

const LOGO_PALETTE = [
  { bg: 'var(--uc-indigo-bg)', border: 'var(--uc-indigo-bdr)', color: 'var(--uc-indigo-l)' },
  { bg: 'var(--uc-orange-bg)', border: 'var(--uc-orange-bdr)', color: 'var(--uc-orange-l)' },
  { bg: 'var(--uc-mint-bg)',   border: 'rgba(16,185,129,0.28)', color: 'var(--uc-mint)' },
  { bg: 'var(--uc-cyan-bg)',   border: 'rgba(6,182,212,0.28)',  color: 'var(--uc-cyan)' },
]

function seedLogoStyle(company: string) {
  const sum = [...company].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return LOGO_PALETTE[sum % LOGO_PALETTE.length]
}

function DeadlineChip({ deadline }: { deadline: string }) {
  const daysLeft = differenceInDays(parseISO(deadline), new Date())
  const label = format(parseISO(deadline), 'MMM d')

  let color = 'var(--text-tertiary)'
  let bg = 'transparent'
  let border: string | undefined

  if (daysLeft < 0) {
    color = 'var(--text-tertiary)'
  } else if (daysLeft < 3) {
    color = 'var(--uc-red)'
    bg = 'rgba(225,29,72,0.08)'
    border = 'rgba(225,29,72,0.25)'
  } else if (daysLeft < 7) {
    color = 'var(--uc-orange-l)'
    bg = 'var(--uc-orange-bg)'
    border = 'var(--uc-orange-bdr)'
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 400,
        color,
        background: bg,
        border: border ? `0.5px solid ${border}` : undefined,
        borderRadius: 'var(--r-pill)',
        padding: border ? '2px 8px 2px 6px' : undefined,
      }}
    >
      <Clock size={11} strokeWidth={1.5} />
      {daysLeft < 0 ? 'Expired' : `Closes ${label}`}
    </span>
  )
}

// ── JobCard ───────────────────────────────────────────────────────────────────

export function JobCard({ job, queryKey }: { job: Job; queryKey: unknown[] }) {
  const navigate = useNavigate()
  const [localSaved, setLocalSaved] = useState(job.isSaved)
  const [localApplied, setLocalApplied] = useState(!!job.myApplication)
  const [applyOpen, setApplyOpen] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (wasSaved: boolean) =>
      wasSaved ? api.delete(`/jobs/${job.id}/save`) : api.post(`/jobs/${job.id}/save`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (_err, wasSaved) => setLocalSaved(wasSaved),
  })

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    const wasSaved = localSaved
    setLocalSaved(!wasSaved)
    saveMutation.mutate(wasSaved)
  }

  function handleApplyClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (job.applicationUrl) {
      window.open(job.applicationUrl, '_blank', 'noopener,noreferrer')
    } else {
      setApplyOpen(true)
    }
  }

  const logoStyle = seedLogoStyle(job.company)
  const companyInitial = job.company.charAt(0).toUpperCase()

  return (
    <>
      <article
        onClick={() => navigate(`/jobs/${job.id}`)}
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '16px',
          cursor: 'pointer',
          transition: 'border-color 200ms',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-default)'
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Company logo */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--r-md)',
              background: logoStyle.bg,
              border: `0.5px solid ${logoStyle.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 18,
              fontWeight: 500,
              color: logoStyle.color,
            }}
          >
            {companyInitial}
          </div>

          {/* Title + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <h3
                style={{
                  margin: 0,
                  flex: 1,
                  minWidth: 0,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  lineHeight: 1.4,
                }}
              >
                {job.title}
              </h3>
              {localApplied && (
                <Badge variant="alumni" className="shrink-0 mt-px">
                  <CheckCircle2 size={10} strokeWidth={2} style={{ marginRight: 3 }} />
                  Applied
                </Badge>
              )}
            </div>

            <p
              style={{
                margin: '3px 0 5px',
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-secondary)',
              }}
            >
              {job.company}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                }}
              >
                <MapPin size={11} strokeWidth={1.5} />
                {job.location}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '1px 8px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--uc-indigo-bg)',
                  color: 'var(--uc-indigo-xl)',
                }}
              >
                {TYPE_LABELS[job.type]}
              </span>
            </div>
          </div>
        </div>

        {/* ── Skill badges ────────────────────────────────────────────────── */}
        {job.requirements.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {job.requirements.map((req) => (
              <Badge key={req} variant="alumni">
                {req}
              </Badge>
            ))}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div
          style={{
            borderTop: '0.5px solid var(--border-default)',
            paddingTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Stats */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
              }}
            >
              <Users size={11} strokeWidth={1.5} />
              {job.applicationCount} applied
            </span>
            {job.deadline && <DeadlineChip deadline={job.deadline} />}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <GhostBtn onClick={handleSave} style={{ fontSize: 12, padding: '5px 12px' }}>
              <Bookmark
                size={13}
                strokeWidth={1.5}
                fill={localSaved ? 'currentColor' : 'none'}
                color={localSaved ? 'var(--uc-indigo-l)' : undefined}
              />
              {localSaved ? 'Saved' : 'Save'}
            </GhostBtn>

            <MintBtn
              disabled={localApplied}
              onClick={handleApplyClick}
              style={{ fontSize: 12, padding: '5px 14px' }}
            >
              {localApplied ? (
                <>
                  <CheckCircle2 size={13} strokeWidth={2} />
                  Applied
                </>
              ) : (
                'Apply'
              )}
            </MintBtn>
          </div>
        </div>
      </article>

      {applyOpen && (
        <ApplyModal
          jobId={job.id}
          jobTitle={job.title}
          company={job.company}
          onSuccess={() => setLocalApplied(true)}
          onClose={() => setApplyOpen(false)}
        />
      )}
    </>
  )
}
