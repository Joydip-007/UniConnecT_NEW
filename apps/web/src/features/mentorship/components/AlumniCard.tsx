import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { avatarColor, getInitials } from '@/utils/avatar'
import type { AlumniMentor } from '../types'

interface AlumniCardProps {
  alumnus: AlumniMentor
  alreadySent: boolean
  onAsk: () => void
}

export function AlumniCard({ alumnus, alreadySent, onAsk }: AlumniCardProps) {
  const isFull = alumnus.currentMentees >= alumnus.maxMentees

  return (
    <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
        }}
      >
        <Avatar initials={getInitials(alumnus.fullName)} color={avatarColor(alumnus.id)} size={44} />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {alumnus.fullName}
          </p>
          {alumnus.headline && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {alumnus.headline}
            </p>
          )}

          {/* Capacity pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span
              title={isFull ? 'This mentor is currently full' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: 'var(--r-pill)',
                border: `0.5px solid ${isFull ? 'var(--uc-orange-bdr, var(--border-default))' : 'var(--border-default)'}`,
                background: isFull ? 'var(--uc-orange-bg)' : 'var(--surface-raised)',
                color: isFull ? 'var(--uc-orange-l)' : 'var(--text-tertiary)',
                transition: 'background 200ms, color 200ms, border-color 200ms',
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: isFull ? 'var(--uc-orange-l)' : 'var(--text-tertiary)',
                  flexShrink: 0,
                }}
              />
              {alumnus.currentMentees} / {alumnus.maxMentees} mentees
            </span>
          </div>

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
            {alumnus.department && <Badge variant="dept">{alumnus.department}</Badge>}
            {alumnus.batchYear && <Badge variant="neutral">Batch {alumnus.batchYear}</Badge>}
          </div>
          {alumnus.skills.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {alumnus.skills.slice(0, 5).map((skill) => (
                <span
                  key={skill}
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: 'var(--text-tertiary)',
                    background: 'var(--surface-raised)',
                    padding: '2px 8px',
                    borderRadius: 'var(--r-pill)',
                    border: '0.5px solid var(--border-default)',
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0 }}>
          {alreadySent ? (
            <GhostBtn disabled>Request sent</GhostBtn>
          ) : isFull ? (
            <span title="This mentor is currently full">
              <GhostBtn disabled>Mentor full</GhostBtn>
            </span>
          ) : (
            <PrimaryBtn onClick={onAsk}>Ask for guidance</PrimaryBtn>
          )}
        </div>
      </div>
    )
}
