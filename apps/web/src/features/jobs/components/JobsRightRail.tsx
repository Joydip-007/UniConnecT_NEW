import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { SkeletonLine } from '@/components/rightRail/primitives'
import { useAuthStore } from '@/stores/authStore'
import { daysLeftLabel, daysUntil, statusTone } from '../jobMeta'
import { useClosingThisWeek, useMyApplications, useWithdrawApplication, type MyApplication } from '../hooks/useJobs'

const card: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
}

const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)' }

/** The board is ordered closing-soonest first, so this is its head within the next 7 days. */
function ClosingThisWeek() {
  const { items, isLoading } = useClosingThisWeek()
  return (
    <section aria-label="Closing this week" style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 style={{ ...eyebrow, margin: 0 }}>Closing this week</h2>
      {isLoading && (
        <>
          <SkeletonLine width="80%" />
          <SkeletonLine width="40%" />
        </>
      )}
      {!isLoading && items.length === 0 && (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Nothing closes in the next 7 days.</span>
      )}
      {items.map((job, i) => {
        const urgent = daysUntil(job.deadline!) < 3
        return (
          <Fragment key={job.id}>
            {i > 0 && <div style={{ height: 0.5, background: 'var(--border-default)' }} />}
            <Link to={`/jobs/${job.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 3, textDecoration: 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{job.title}</span>
              <span style={{ fontSize: 12, color: urgent ? 'var(--uc-red)' : 'var(--uc-orange-l)' }}>{daysLeftLabel(job.deadline!)}</span>
            </Link>
          </Fragment>
        )
      })}
    </section>
  )
}

function ApplicationRow({ app }: { app: MyApplication }) {
  const [confirming, setConfirming] = useState(false)
  const withdraw = useWithdrawApplication()
  const withdrawn = app.status === 'withdrawn'
  const tone = statusTone(app.status)
  const meta = confirming
    ? `Withdraw? ${app.job.company} is notified and you can't reapply.`
    : `${app.job.company} · ${withdrawn ? 'You withdrew' : `Applied ${format(parseISO(app.createdAt), 'MMM d')}`}`

  const small: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    padding: '5px 12px',
    borderRadius: 'var(--r-pill)',
    fontFamily: 'inherit',
    cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderTop: '0.5px solid var(--border-default)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Link
          to={`/jobs/${app.jobId}`}
          style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, textDecoration: 'none', color: withdrawn ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
        >
          {app.job.title}
        </Link>
        <span style={{ fontSize: 12, lineHeight: 1.5, color: confirming ? 'var(--uc-red)' : 'var(--text-tertiary)' }}>{meta}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap', background: tone.bg, color: tone.fg, border: `0.5px solid ${tone.bdr}` }}>
            {tone.label}
          </span>
        </span>
        {!withdrawn && !confirming && (
          <button type="button" className="jobs-withdraw-btn" onClick={() => setConfirming(true)} style={{ ...small, border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)' }}>
            Withdraw
          </button>
        )}
        {confirming && (
          <>
            <button type="button" onClick={() => setConfirming(false)} style={{ ...small, border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)' }}>
              Keep
            </button>
            <button
              type="button"
              disabled={withdraw.isPending}
              onClick={() => withdraw.mutate(app.jobId, { onSuccess: () => setConfirming(false) })}
              style={{ ...small, border: 'none', background: 'var(--uc-red)', color: 'var(--on-red)', opacity: withdraw.isPending ? 0.6 : 1 }}
            >
              Withdraw
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** A student's own applications and where each one sits — they cannot post, so this is their half of the page. */
function MyApplications() {
  const { data, isLoading } = useMyApplications(true)
  const items = data?.items ?? []
  const active = items.filter((a) => a.status !== 'withdrawn').length

  return (
    <section aria-label="My applications" style={{ ...card, padding: '14px 0 4px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 14px 8px' }}>
        <h2 style={{ ...eyebrow, margin: 0 }}>My applications</h2>
        {!isLoading && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{active} active</span>}
      </div>
      {isLoading && (
        <div style={{ padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonLine width="85%" />
          <SkeletonLine width="50%" />
        </div>
      )}
      {!isLoading && items.length === 0 && (
        <div style={{ padding: '16px 14px 18px', fontSize: 13, color: 'var(--text-tertiary)' }}>You haven't applied to anything yet.</div>
      )}
      {items.map((app) => (
        <ApplicationRow key={app.id} app={app} />
      ))}
    </section>
  )
}

export function JobsRightRail() {
  const role = useAuthStore((s) => s.user?.role)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ClosingThisWeek />
      {role === 'student' && <MyApplications />}
    </div>
  )
}
