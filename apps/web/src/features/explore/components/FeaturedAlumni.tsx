import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import type { UserSuggestion } from '../types'

interface Props {
  alumni: UserSuggestion[]
}

function AlumniCard({ person }: { person: UserSuggestion }) {
  const meta = [
    person.department,
    person.batchYear ? `Class of ${person.batchYear}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      to={`/profile/${person.id}`}
      style={{
        flexShrink: 0,
        width: 220,
        scrollSnapAlign: 'start',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '12px 14px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        textDecoration: 'none',
      }}
    >
      <Avatar
        src={person.avatarUrl ?? undefined}
        initials={getInitials(person.fullName)}
        color={avatarColor(person.id)}
        size={40}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {person.fullName}
        </div>
        {person.headline && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 2,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {person.headline}
          </div>
        )}
        {meta && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {meta}
          </div>
        )}
      </div>
    </Link>
  )
}

export function FeaturedAlumni({ alumni }: Props) {
  if (alumni.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No featured alumni yet.</p>
    )
  }
  return (
    <>
      {alumni.map((person) => (
        <AlumniCard key={person.id} person={person} />
      ))}
    </>
  )
}
