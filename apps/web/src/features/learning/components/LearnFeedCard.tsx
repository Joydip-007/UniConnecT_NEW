import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { PATHS } from '@/router/paths'
import { useToday } from '../hooks/useLearning'

const DISMISS_KEY = 'uc:learn-card-dismissed'

/** Feed widget nudging the user toward today's unfinished learning unit.
    Self-fetches via useToday — mirrors how RightSidebar widgets (people you
    may know, upcoming events, your progress) each own their data fetch so
    the page that hosts them stays a thin orchestrator. */
export function LearnFeedCard() {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1')
  const { data: entries } = useToday()

  if (dismissed) return null

  const entry = entries?.find((e) => !e.completedToday)
  if (!entry) return null

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      className="learn-feed-card"
      style={{
        position: 'relative',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss learning reminder"
        className="learn-feed-card-dismiss"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={13} />
      </button>

      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
        Today's unit
      </span>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
        {entry.unit.title}
      </span>
      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
        Part of your learning path
      </span>

      <Link
        to={PATHS.LEARN}
        style={{
          alignSelf: 'flex-start',
          marginTop: 4,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--uc-indigo-l)',
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
          borderRadius: 'var(--r-pill)',
          padding: '5px 12px',
          textDecoration: 'none',
        }}
      >
        Continue learning
      </Link>
    </div>
  )
}
