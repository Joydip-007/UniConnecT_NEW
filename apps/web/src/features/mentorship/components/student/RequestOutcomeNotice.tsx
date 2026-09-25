import { X, Clock } from 'lucide-react'
import { shortDate } from '../../format'
import type { MyRequest } from '../../types'
import { cardStyle, useIsMobile } from '../styles'

/** A declined or expired request, with the reason given and a next step. */
export function RequestOutcomeNotice({ request, onFindSimilar }: { request: MyRequest; onFindSimilar: () => void }) {
  const isMobile = useIsMobile()
  const declined = request.status === 'declined'
  const name = request.alumni.fullName
  const when = shortDate(request.respondedAt ?? request.updatedAt)

  return (
    <div
      style={{
        ...cardStyle,
        padding: '14px 16px',
        display: 'flex',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: declined ? 'var(--uc-red-bg)' : 'var(--uc-amber-bg)',
          border: declined ? '0.5px solid var(--uc-red-bdr)' : '0.5px solid var(--uc-amber-bdr)',
          color: declined ? 'var(--uc-red)' : 'var(--uc-amber-l)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {declined ? <X size={15} /> : <Clock size={15} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
          {declined ? `${name} declined your request on ${when}` : `Your request to ${name} expired on ${shortDate(request.updatedAt)}`}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {declined
            ? request.declineReason
              ? `Reason given: ${request.declineReason.charAt(0).toLowerCase()}${request.declineReason.slice(1)}. You can request again later.`
              : 'No reason was given. You can request again later.'
            : 'They did not reply within 7 days. You can send a new request.'}
        </div>
      </div>
      <button
        type="button"
        onClick={onFindSimilar}
        style={{
          fontSize: 12,
          padding: '7px 13px',
          minHeight: isMobile ? 44 : 36,
          borderRadius: 'var(--r-pill)',
          border: '0.5px solid var(--border-hover)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          width: isMobile ? '100%' : undefined,
        }}
      >
        Find similar mentors
      </button>
    </div>
  )
}
