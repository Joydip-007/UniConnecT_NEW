import { useState } from 'react'
import type { ApplicationStatus, ContentAttachment, UserRole } from '@uniconnect/shared'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Bookmark, CheckCircle2, Clock, Lock, MapPin, Undo2, Users, XCircle } from 'lucide-react'
import { api } from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { ShareMenu } from '@/components/ShareMenu'
import { deadlineTone, seedLogoStyle, statusTone, TYPE_LABELS } from '../jobMeta'
import { useJobEligibility, useWithdrawApplication } from '../hooks/useJobs'
import { ApplyModal } from './ApplyModal'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobPoster {
  id: string
  fullName: string
  role?: UserRole
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
  myApplication: { status: ApplicationStatus } | null
  isSaved: boolean
  viewCount: number
  /** "Who can apply" — null on an axis means unrestricted. */
  eligibleDepartments?: string[] | null
  eligibleBatches?: string[] | null
  minCgpa?: number | null
  publishAt?: string | null
  isScheduled?: boolean
  isPublished?: boolean
  /** Present on the job-detail response; absent in list items. */
  attachments?: ContentAttachment[]
}

// ── Pieces ────────────────────────────────────────────────────────────────────

const pillBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 'var(--r-pill)',
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function StatusPill({ status, mobile }: { status: ApplicationStatus; mobile: boolean }) {
  const t = statusTone(status)
  const withdrawn = status === 'withdrawn'
  return (
    <span
      style={{
        ...pillBtn,
        cursor: 'default',
        padding: mobile ? '0 14px' : '5px 14px',
        minHeight: mobile ? 44 : undefined,
        flex: mobile ? 1 : undefined,
        fontSize: mobile ? 13 : 12,
        background: t.bg,
        border: `0.5px solid ${t.bdr}`,
        color: t.fg,
      }}
    >
      {withdrawn ? <Undo2 size={mobile ? 14 : 13} /> : <CheckCircle2 size={mobile ? 14 : 13} />}
      {t.label}
    </span>
  )
}

function WithdrawConfirm({ company, onKeep, onConfirm, pending }: { company: string; onKeep: () => void; onConfirm: () => void; pending: boolean }) {
  return (
    <div
      role="alertdialog"
      aria-label="Withdraw this application?"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
        background: 'var(--uc-red-bg)',
        border: '0.5px solid var(--uc-red-bdr)',
      }}
    >
      <span style={{ flex: '1 1 200px', fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Withdraw this application?</span> {company} will be
        notified and you can't reapply to this posting.
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={onKeep}
          style={{ ...pillBtn, minHeight: 36, padding: '0 14px', border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)' }}
        >
          Keep
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          style={{ ...pillBtn, minHeight: 36, padding: '0 14px', border: 'none', background: 'var(--uc-red)', color: 'var(--on-red)', opacity: pending ? 0.6 : 1 }}
        >
          Withdraw
        </button>
      </div>
    </div>
  )
}

// ── JobCard ───────────────────────────────────────────────────────────────────

export function JobCard({ job, queryKey }: { job: Job; queryKey: readonly unknown[] }) {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [localSaved, setLocalSaved] = useState(job.isSaved)
  const [applyOpen, setApplyOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const withdraw = useWithdrawApplication()
  const { isStudent, verdict } = useJobEligibility(job)

  const status = job.myApplication?.status ?? null
  const withdrawn = status === 'withdrawn'
  const applied = !!status && !withdrawn
  const blocked = isStudent && !status && !verdict.eligible
  const canApply = !status && !blocked

  const saveMutation = useMutation({
    mutationFn: (wasSaved: boolean) =>
      wasSaved ? api.delete(`/jobs/${job.id}/save`) : api.post(`/jobs/${job.id}/save`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (_err, wasSaved) => setLocalSaved(wasSaved),
  })

  function handleSave() {
    const wasSaved = localSaved
    setLocalSaved(!wasSaved)
    saveMutation.mutate(wasSaved)
  }

  function handleApply() {
    if (job.applicationUrl) window.open(job.applicationUrl, '_blank', 'noopener,noreferrer')
    else setApplyOpen(true)
  }

  const logo = seedLogoStyle(job.company)
  const dl = deadlineTone(job.deadline)

  // Eligibility banner — students only, and only before they have acted on the job.
  const showElig = isStudent && !status
  const elig = !verdict.eligible
    ? { fg: 'var(--uc-red)', bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)', Icon: XCircle, title: 'Not eligible', text: verdict.failures.join(' · ') }
    : verdict.missingSkills.length > 0 || verdict.cgpaUnknown
      ? { fg: 'var(--uc-amber-l)', bg: 'var(--uc-amber-bg)', bdr: 'var(--uc-amber-bdr)', Icon: AlertTriangle, title: 'Eligible', text: eligSkillText() }
      : { fg: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)', Icon: CheckCircle2, title: 'Eligible', text: eligSkillText() }

  function eligSkillText() {
    const parts: string[] = []
    if (job.requirements.length > 0) {
      parts.push(`${verdict.matchedSkills.length} of ${job.requirements.length} skills match`)
      if (verdict.missingSkills.length) parts.push(`missing ${verdict.missingSkills.join(', ')}`)
    } else {
      parts.push('You meet every requirement')
    }
    if (verdict.cgpaUnknown) parts.push('add your CGPA to your profile')
    return parts.join(' · ')
  }

  const mine = new Set(verdict.matchedSkills.map((s) => s.toLowerCase()))

  const typeChip = (
    <span
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: '1px 8px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--uc-indigo-bg)',
        color: 'var(--uc-indigo-xl)',
      }}
    >
      {TYPE_LABELS[job.type]}
    </span>
  )

  const appliedBadge = applied && (
    <span
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--role-alumni-bg)',
        border: '0.5px solid var(--role-alumni-bdr)',
        color: 'var(--role-alumni-text)',
      }}
    >
      <CheckCircle2 size={10} strokeWidth={2} />
      Applied
    </span>
  )

  const deadlineChip = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        borderRadius: 'var(--r-pill)',
        color: dl.fg,
        background: dl.bg,
        border: `0.5px solid ${dl.bdr}`,
        padding: dl.boxed ? '2px 8px 2px 6px' : 0,
      }}
    >
      <Clock size={11} strokeWidth={1.5} />
      {dl.label}
    </span>
  )

  const appliedCount = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
      <Users size={11} strokeWidth={1.5} />
      {job.applicationCount} applied
    </span>
  )

  return (
    <>
      <article
        className="card-hover-border"
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          transition: 'border-color 200ms',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(`/jobs/${job.id}`)}
          aria-label={`View job: ${job.title} at ${job.company}`}
          style={{ display: 'contents', background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', textAlign: 'inherit', cursor: 'pointer' }}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--r-md)',
                background: logo.bg,
                border: `0.5px solid ${logo.border}`,
                color: logo.color,
                fontSize: 18,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {job.company.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <h3 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {job.title}
                </h3>
                {!isMobile && appliedBadge}
              </div>
              <p style={{ margin: '3px 0 5px', fontSize: 12, color: 'var(--text-secondary)' }}>{job.company}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
                {!isMobile && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <MapPin size={11} strokeWidth={1.5} />
                    {job.location}
                  </span>
                )}
                {typeChip}
                {isMobile && appliedBadge}
              </div>
            </div>
          </div>

          {/* ── Description ─────────────────────────────────────────────── */}
          {job.description && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {job.description}
            </p>
          )}

          {/* ── Skills — a student sees which ones they already list ────── */}
          {job.requirements.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-label)', marginRight: 2 }}>Skills</span>
              {job.requirements.map((req) => {
                const has = !isStudent || mine.has(req.toLowerCase())
                return (
                  <span
                    key={req}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 'var(--r-pill)',
                      background: has ? 'var(--role-alumni-bg)' : 'transparent',
                      border: `0.5px ${has ? 'solid' : 'dashed'} ${has ? 'var(--role-alumni-bdr)' : 'var(--border-hover)'}`,
                      color: has ? 'var(--role-alumni-text)' : 'var(--text-tertiary)',
                    }}
                  >
                    {req}
                  </span>
                )
              })}
            </div>
          )}
        </button>

        {showElig && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 'var(--r-md)',
              background: elig.bg,
              border: `0.5px solid ${elig.bdr}`,
            }}
          >
            <elig.Icon size={14} color={elig.fg} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 500, color: elig.fg }}>{elig.title}</span> · {elig.text}
            </span>
          </div>
        )}

        {confirming && applied && (
          <WithdrawConfirm
            company={job.company}
            pending={withdraw.isPending}
            onKeep={() => setConfirming(false)}
            onConfirm={() => withdraw.mutate(job.id, { onSuccess: () => setConfirming(false) })}
          />
        )}

        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {appliedCount}
            {deadlineChip}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div
          style={{
            borderTop: '0.5px solid var(--border-default)',
            paddingTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 6 : 8,
          }}
        >
          {!isMobile && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {appliedCount}
              {deadlineChip}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flex: isMobile ? 1 : undefined }}>
            {!isMobile && <ShareMenu entityType="job" entityId={job.id} title={job.title} />}
            <button
              type="button"
              onClick={handleSave}
              aria-label={localSaved ? 'Saved' : 'Save'}
              aria-pressed={localSaved}
              style={{
                ...pillBtn,
                fontWeight: 400,
                border: '0.5px solid var(--border-hover)',
                background: 'transparent',
                color: localSaved ? 'var(--uc-orange-l)' : 'var(--text-secondary)',
                ...(isMobile ? { width: 44, minHeight: 44, flexShrink: 0 } : { padding: '5px 12px' }),
              }}
            >
              <Bookmark size={isMobile ? 15 : 13} strokeWidth={1.5} fill={localSaved ? 'currentColor' : 'none'} />
              {!isMobile && (localSaved ? 'Saved' : 'Save')}
            </button>

            {applied && (
              <>
                {isMobile ? (
                  <>
                    <StatusPill status={status} mobile />
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      style={{ ...pillBtn, fontSize: 13, minHeight: 44, padding: '0 16px', border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)' }}
                    >
                      Withdraw
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="jobs-withdraw-btn"
                      style={{ ...pillBtn, padding: '5px 12px', border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)' }}
                    >
                      Withdraw
                    </button>
                    <StatusPill status={status} mobile={false} />
                  </>
                )}
              </>
            )}

            {withdrawn && <StatusPill status="withdrawn" mobile={isMobile} />}

            {canApply && (
              <button
                type="button"
                onClick={handleApply}
                style={{
                  ...pillBtn,
                  border: 'none',
                  background: 'var(--uc-mint)',
                  color: 'var(--on-accent)',
                  ...(isMobile ? { flex: 1, minHeight: 44, fontSize: 13 } : { padding: '5px 14px' }),
                }}
              >
                Apply
              </button>
            )}

            {blocked && (
              <button
                type="button"
                disabled
                title={verdict.failures.join(' · ')}
                style={{
                  ...pillBtn,
                  cursor: 'not-allowed',
                  border: '0.5px solid var(--border-default)',
                  background: 'var(--surface-raised)',
                  color: 'var(--text-tertiary)',
                  ...(isMobile ? { flex: 1, minHeight: 44, fontSize: 13, gap: 6 } : { padding: '5px 14px' }),
                }}
              >
                <Lock size={isMobile ? 14 : 12} />
                Not eligible
              </button>
            )}
          </div>
        </div>
      </article>

      {applyOpen && <ApplyModal job={job} onClose={() => setApplyOpen(false)} />}
    </>
  )
}
