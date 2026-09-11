import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import type { UserRole } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { Avatar } from '@/components/Avatar'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { ROLE_LABEL } from '@/components/RoleBadge.constants'

// ── Types (mirror admin/service.ts listReportedContentGroups + getReportedTarget) ──

export interface ReportLocation {
  label: string
  path: string | null
}

export interface ReportGroup {
  targetId: string
  targetType: string
  title: string
  location: ReportLocation
  severity: 'high' | 'medium' | 'low'
  reason: string
  reportCount: number
  lastReportedAt: string
  removable: boolean
}

interface ReportEntry {
  id: string
  reason: string
  description: string | null
  createdAt: string
  reporter: { id: string; fullName: string; role: UserRole; avatarUrl: string | null }
}

interface ReportedTarget extends Omit<ReportGroup, 'severity' | 'reason' | 'reportCount' | 'lastReportedAt'> {
  reports: ReportEntry[]
}

const SEVERITY_STYLE: Record<ReportGroup['severity'], { bg: string; bdr: string; text: string; label: string }> = {
  high: { bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)', text: 'var(--uc-red)', label: 'High' },
  medium: { bg: 'var(--uc-amber-bg)', bdr: 'var(--uc-amber-bdr)', text: 'var(--uc-amber-l)', label: 'Medium' },
  low: { bg: 'var(--surface-raised)', bdr: 'var(--border-default)', text: 'var(--text-tertiary)', label: 'Low' },
}

/** `reports.reason` is a snake_case enum; admins read it as a phrase. */
const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate speech',
  violence: 'Violence',
  nudity: 'Nudity',
  misinformation: 'Misinformation',
  impersonation: 'Impersonation',
  self_harm: 'Self-harm',
  other: 'Other',
}

function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

/**
 * Row actions are tone-filled pills, not ghost buttons: Remove is destructive and has
 * to look it from across the row, Dismiss is its equal-weight neutral, and Review is
 * the interactive (indigo) one — it opens something rather than deciding anything.
 */
function reportActionStyle(kind: 'review' | 'remove' | 'dismiss'): React.CSSProperties {
  const tone =
    kind === 'remove'
      ? { color: 'var(--uc-red)', bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)' }
      : kind === 'review'
        ? { color: 'var(--uc-indigo-xl)', bg: 'var(--uc-indigo-bg)', bdr: 'var(--uc-indigo-bdr)' }
        : { color: 'var(--text-secondary)', bg: 'var(--surface-raised)', bdr: 'var(--border-default)' }
  return {
    fontSize: 12,
    fontWeight: 500,
    color: tone.color,
    background: tone.bg,
    border: `0.5px solid ${tone.bdr}`,
    borderRadius: 'var(--r-pill)',
    padding: '5px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const REPORTS_KEY = ['admin', 'reports', 'grouped'] as const

// ── Review drawer: every report on one target ─────────────────────────────────

function ReportReviewPanel({ targetType, targetId }: { targetType: string; targetId: string }) {
  const { data, isLoading, isError } = useQuery<ReportedTarget>({
    queryKey: ['admin', 'reports', 'target', { targetType, targetId }],
    queryFn: () =>
      api.get<{ data: ReportedTarget }>(`/admin/reports/target/${targetType}/${targetId}`).then((r) => r.data.data),
  })

  if (isLoading) return <p style={{ margin: 0, padding: '8px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>Loading reports…</p>
  if (isError || !data) {
    return <p style={{ margin: 0, padding: '8px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>Could not load these reports.</p>
  }

  return (
    <div
      data-testid="report-review"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, padding: 12, borderRadius: 'var(--r-md)', background: 'var(--surface-raised)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-label)' }}>
          {data.reports.length} report{data.reports.length === 1 ? '' : 's'} · {data.location.label}
        </span>
        {data.location.path && (
          <Link
            to={data.location.path}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--uc-indigo-l)', textDecoration: 'none' }}
          >
            Open in context <ExternalLink size={12} strokeWidth={1.75} />
          </Link>
        )}
      </div>
      {data.reports.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Avatar initials={getInitials(r.reporter.fullName)} color={seedColor(r.reporter.id)} src={r.reporter.avatarUrl} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
              <Link to={`/profile/${r.reporter.id}`} style={{ fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}>
                {r.reporter.fullName}
              </Link>
              <span style={{ color: 'var(--text-tertiary)' }}>{ROLE_LABEL[r.reporter.role]}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>· {relativeTime(r.createdAt)}</span>
            </div>
            <div style={{ marginTop: 3, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{reasonLabel(r.reason)}</span>
              {r.description ? <> — {r.description}</> : <span style={{ color: 'var(--text-tertiary)' }}> — no details given</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Reported content list ─────────────────────────────────────────────────────

export function ReportedContentPanel() {
  const qc = useQueryClient()
  const [openKey, setOpenKey] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ items: ReportGroup[]; total: number }>({
    queryKey: REPORTS_KEY,
    queryFn: () => api.get<{ data: { items: ReportGroup[]; total: number } }>('/admin/reports/grouped?limit=50').then((r) => r.data.data),
  })

  const actionMutation = useMutation({
    mutationFn: ({ targetType, targetId, action }: { targetType: string; targetId: string; action: 'remove' | 'dismiss' }) =>
      api.patch(`/admin/reports/target/${targetType}/${targetId}`, { action }),
    onSuccess: () => {
      setOpenKey(null)
      void qc.invalidateQueries({ queryKey: REPORTS_KEY })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  const items = data?.items ?? []

  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <h2 style={{ margin: 0, padding: '14px 16px', borderBottom: '0.5px solid var(--border-default)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
        Reported content
      </h2>
      {isLoading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Nothing reported right now</div>
      ) : (
        items.map((item) => {
          const sev = SEVERITY_STYLE[item.severity]
          const key = `${item.targetType}:${item.targetId}`
          const isOpen = openKey === key
          return (
            <div key={key} style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* The glyph carries the severity, so the row reads as urgent before
                    the pill is read at all. */}
                <span style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: sev.bg,
                  color: sev.text,
                }}>
                  <AlertTriangle size={15} strokeWidth={1.5} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <span style={{ background: sev.bg, border: `0.5px solid ${sev.bdr}`, color: sev.text, borderRadius: 'var(--r-pill)', padding: '1px 8px', fontSize: 11, fontWeight: 500 }}>
                      {sev.label}
                    </span>
                    <span>{reasonLabel(item.reason)}</span>
                    <span>· {item.reportCount} report{item.reportCount === 1 ? '' : 's'}</span>
                    <span>· {relativeTime(item.lastReportedAt)}</span>
                    {/* Where: the one thing the row must say before the admin decides anything. */}
                    <span>
                      ·{' '}
                      {item.location.path ? (
                        <Link to={item.location.path} style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}>
                          {item.location.label}
                        </Link>
                      ) : (
                        item.location.label
                      )}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="press-feedback"
                    aria-expanded={isOpen}
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    style={reportActionStyle('review')}
                  >
                    {isOpen ? 'Close' : 'Review'}
                  </button>
                  {item.removable && (
                    <button
                      type="button"
                      className="press-feedback"
                      onClick={() => actionMutation.mutate({ targetType: item.targetType, targetId: item.targetId, action: 'remove' })}
                      disabled={actionMutation.isPending}
                      style={reportActionStyle('remove')}
                    >
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    className="press-feedback"
                    onClick={() => actionMutation.mutate({ targetType: item.targetType, targetId: item.targetId, action: 'dismiss' })}
                    disabled={actionMutation.isPending}
                    style={reportActionStyle('dismiss')}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              {isOpen && <ReportReviewPanel targetType={item.targetType} targetId={item.targetId} />}
            </div>
          )
        })
      )}
    </div>
  )
}
