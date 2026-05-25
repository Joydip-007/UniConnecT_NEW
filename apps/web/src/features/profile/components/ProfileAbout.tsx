import { Pencil } from 'lucide-react'

interface Props {
  bio: string | null
  isOwnProfile: boolean
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected'
  onEdit: () => void
}

const TRUNCATE_LENGTH = 150

export function ProfileAbout({ bio, isOwnProfile, connectionStatus, onEdit }: Props) {
  const isRestricted =
    !isOwnProfile &&
    (connectionStatus === 'none' || connectionStatus === 'pending_sent')

  const cleanBio = bio?.trim() ?? null

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
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          About
        </span>
        {isOwnProfile && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit about"
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

      {!cleanBio ? (
        isOwnProfile ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              lineHeight: 1.6,
            }}
          >
            Add a bio to tell people about yourself.{' '}
            <button
              type="button"
              onClick={onEdit}
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
              Add bio
            </button>
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              lineHeight: 1.6,
            }}
          >
            No bio added yet.
          </p>
        )
      ) : isRestricted ? (
        <div>
          <div style={{ position: 'relative' }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                overflow: 'hidden',
                maxHeight: '4.8em',
              }}
            >
              {cleanBio.length > TRUNCATE_LENGTH
                ? cleanBio.slice(0, TRUNCATE_LENGTH) + '…'
                : cleanBio}
            </p>
            {cleanBio.length > TRUNCATE_LENGTH && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 32,
                  background:
                    'linear-gradient(to bottom, transparent, var(--surface-card))',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              lineHeight: 1.5,
            }}
          >
            Connect to see more
          </p>
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {cleanBio}
        </p>
      )}
    </div>
  )
}
