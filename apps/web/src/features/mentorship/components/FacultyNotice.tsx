import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { PATHS } from '@/router/paths'
import { btnStyle, cardStyle } from './styles'

/** Faculty has no mentorship surface; the notice gives the role a way back instead of a wall. */
export function FacultyNotice() {
  return (
    <div
      style={{
        ...cardStyle,
        padding: 48,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <BookOpen size={32} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
        Mentorship is available for students and alumni.
      </p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 360 }}>
        Students browse and request alumni mentors. Alumni manage requests, log sessions and earn redeemable points.
      </p>
      <Link to={PATHS.NEWS} style={{ ...btnStyle('ghost', 36), marginTop: 4, padding: '0 16px' }}>
        Back to announcements
      </Link>
    </div>
  )
}
