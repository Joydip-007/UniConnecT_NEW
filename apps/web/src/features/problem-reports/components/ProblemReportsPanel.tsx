import { useState } from 'react'
import { Bug } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { useAdminProblemReports, useSetProblemReportStatus } from '../hooks/useProblemReports'

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Path only: the origin is always this deployment, so it is noise in a queue row. */
function pathOf(url: string) {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}`
  } catch {
    return url
  }
}

const pill: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-pill)',
  padding: '5px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

/**
 * Admin queue of crashes members reported from the "This page didn't load" card.
 * Same card grammar as the Deletion requests queue beside it.
 */
export function ProblemReportsPanel() {
  const [page, setPage] = useState(1)
  const limit = 20
  const { data, isLoading } = useAdminProblemReports(page, limit)
  const setStatus = useSetProblemReportStatus()

  if (isLoading || !data) return null

  const totalPages = Math.max(1, Math.ceil(data.total / limit))
  const open = data.items.filter((r) => r.status === 'open').length

  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: '0.5px solid var(--border-default)' }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Problem reports</h2>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {data.total.toLocaleString()} report{data.total === 1 ? '' : 's'}
          {open > 0 ? ` · ${open} open on this page` : ''} · pages that crashed for members
        </span>
      </div>

      {data.items.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No problem reports</div>
      )}

      {data.items.map((r) => {
        const isOpen = r.status === 'open'
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderBottom: '0.5px solid var(--border-default)' }}>
            <span
              aria-hidden="true"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: isOpen ? 'var(--uc-red-bg)' : 'var(--surface-raised)',
                color: isOpen ? 'var(--uc-red)' : 'var(--text-tertiary)',
              }}
            >
              <Bug size={15} strokeWidth={1.5} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                  {r.reporterName ?? r.reporterEmail ?? 'Unknown user'}
                </span>
                <Badge variant={isOpen ? 'dept' : 'neutral'}>{r.status}</Badge>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{r.errorId}</span>
              </div>
              <code
                style={{
                  display: 'block',
                  marginTop: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  wordBreak: 'break-word',
                }}
              >
                {r.errorMessage}
              </code>
              {r.description && (
                <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{r.description}</p>
              )}
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)', wordBreak: 'break-all' }}>
                {pathOf(r.pageUrl)} · {fmtDateTime(String(r.createdAt))}
              </div>
            </div>
            <button
              type="button"
              className="press-feedback"
              onClick={() => setStatus.mutate({ id: r.id, status: isOpen ? 'resolved' : 'open' })}
              disabled={setStatus.isPending}
              style={{ ...pill, flexShrink: 0 }}
            >
              {isOpen ? 'Mark resolved' : 'Reopen'}
            </button>
          </div>
        )
      })}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
          <button type="button" style={pill} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {page} of {totalPages}
          </span>
          <button type="button" style={pill} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}
