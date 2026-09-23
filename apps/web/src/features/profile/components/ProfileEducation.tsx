import { useQuery } from '@tanstack/react-query'
import { Lock, Pencil, Plus } from 'lucide-react'
import type { ProfileEducation } from '@uniconnect/shared'
import { getUserEducation } from '@/lib/api/users'
import type { SectionLock } from '../sectionLock'

interface Props {
  userId: string
  isOwnProfile: boolean
  lock: SectionLock
  onAdd: () => void
  onEdit: (entry: ProfileEducation) => void
}

function formatYearRange(startYear: number, endYear: number | null): string {
  if (endYear === startYear) return String(startYear)
  return endYear ? `${startYear} – ${endYear}` : `${startYear} – Present`
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
        {lock === 'private' ? 'Education history is private' : 'Connect to see education history'}
      </p>
    </div>
  )
}

export function ProfileEducation({ userId, isOwnProfile, lock, onAdd, onEdit }: Props) {
  const isRestricted = lock !== null

  const { data: entries = [], isLoading } = useQuery<ProfileEducation[]>({
    queryKey: ['profile', 'education', userId],
    queryFn: () => getUserEducation(userId),
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
          Education
        </span>
        {isOwnProfile && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add education"
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
              <div style={{ height: 13, width: '55%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
              <div style={{ height: 11, width: '40%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          {isOwnProfile ? (
            <>
              Add your education history.{' '}
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
            'No education listed.'
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
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {entry.institution}
                </span>
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => onEdit(entry)}
                    aria-label={`Edit ${entry.institution} education`}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      color: 'var(--text-tertiary)',
                      lineHeight: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Pencil size={13} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              {(entry.degree || entry.fieldOfStudy) && (
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {[entry.degree, entry.fieldOfStudy].filter(Boolean).join(', ')}
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                {formatYearRange(entry.startYear, entry.endYear)}
                {entry.grade && ` · Grade: ${entry.grade}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
