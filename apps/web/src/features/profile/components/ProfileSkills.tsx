import { Lock, Pencil } from 'lucide-react'

interface Props {
  skills: string[]
  isOwnProfile: boolean
  connectionStatus: string
  onEdit: () => void
}

const PREVIEW_COUNT = 3

export function ProfileSkills({ skills, isOwnProfile, connectionStatus, onEdit }: Props) {
  const isRestricted =
    !isOwnProfile &&
    (connectionStatus === 'none' || connectionStatus === 'pending_sent')

  const visibleSkills =
    isRestricted && skills.length > PREVIEW_COUNT
      ? skills.slice(0, PREVIEW_COUNT)
      : skills

  const hiddenCount = isRestricted ? Math.max(0, skills.length - PREVIEW_COUNT) : 0

  if (skills.length === 0 && !isOwnProfile) return null

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
          Skills
        </span>
        {isOwnProfile && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit skills"
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
            <Pencil size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {skills.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          Add skills to help others find you.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {visibleSkills.map((skill) => (
              <span
                key={skill}
                style={{
                  background: 'var(--uc-indigo-bg)',
                  border: '0.5px solid var(--uc-indigo-bdr)',
                  color: 'var(--uc-indigo-l)',
                  padding: '4px 10px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 12,
                  fontWeight: 400,
                  lineHeight: 1.5,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
          {isRestricted && hiddenCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 2,
              }}
            >
              <Lock size={12} strokeWidth={1.5} color="var(--text-tertiary)" />
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                Connect to see all {skills.length} skills
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
