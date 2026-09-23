import { useQuery } from '@tanstack/react-query'
import { Lock, Pencil, Plus } from 'lucide-react'
import type { ProfileExperience } from '@uniconnect/shared'
import { getUserExperience } from '@/lib/api/users'
import type { SectionLock } from '../sectionLock'
import { parseCalendarDate } from '../dates'

interface Props {
  userId: string
  isOwnProfile: boolean
  lock: SectionLock
  onAdd: () => void
  onEdit: (entry: ProfileExperience) => void
}

function formatDateRange(
  startDate: string | Date,
  endDate: string | Date | null,
): string {
  const fmt = (d: string | Date) =>
    parseCalendarDate(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  const start = fmt(startDate)
  const end = endDate ? fmt(endDate) : 'Present'
  return `${start} – ${end}`
}

function LockedCard({ lock }: { lock: Exclude<SectionLock, null> }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Lock size={16} strokeWidth={1.5} color="var(--text-tertiary)" />
      <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
        {lock === 'private' ? 'Work experience is private' : 'Connect to see work experience'}
      </p>
    </div>
  )
}

export function ProfileExperience({ userId, isOwnProfile, lock, onAdd, onEdit }: Props) {
  const isRestricted = lock !== null

  const { data: entries = [], isLoading } = useQuery<ProfileExperience[]>({
    queryKey: ['profile', 'experience', userId],
    queryFn: () => getUserExperience(userId),
    enabled: !isRestricted,
  })

  if (lock) {
    return <LockedCard lock={lock} />
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
          Experience
        </span>
        {isOwnProfile && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add experience"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-tertiary)',
              lineHeight: 0,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 13, width: '50%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
              <div style={{ height: 11, width: '35%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          {isOwnProfile ? (
            <>
              Add your work experience.{' '}
              <button
                type="button"
                onClick={onAdd}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'var(--uc-indigo-xl)',
                  fontSize: 13,
                  fontWeight: 400,
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Add now
              </button>
            </>
          ) : (
            'No work experience listed.'
          )}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                padding: '12px 0',
                borderBottom:
                  idx < entries.length - 1 ? '0.5px solid var(--border-default)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                position: 'relative',
              }}
              className="profile-entry-row"
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {entry.company}
                </span>
                {isOwnProfile && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      aria-label={`Edit ${entry.company} experience`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: 'var(--text-tertiary)',
                        lineHeight: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {entry.title}
              </span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                {formatDateRange(entry.startDate, entry.endDate)}
                {entry.location && ` · ${entry.location}`}
              </span>
              {entry.description && (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    wordBreak: 'break-word',
                  }}
                >
                  {entry.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
