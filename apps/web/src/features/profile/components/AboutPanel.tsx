import { ExternalLink } from 'lucide-react'
import type { PublicUserProfile, UserRole } from '@uniconnect/shared'

interface Props {
  user: PublicUserProfile
  isOwnProfile: boolean
}

interface Row {
  label: string
  value: React.ReactNode
}

const ROLE_HEADLINE: Record<UserRole, string> = {
  student: 'About this student',
  alumni: 'About this alumnus',
  faculty: 'About this faculty member',
  admin: 'About this admin',
}

function formatJoined(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function batchLabel(role: UserRole): string {
  return role === 'alumni' ? 'Graduating class' : 'Batch'
}

function buildRows(user: PublicUserProfile, isOwnProfile: boolean): Row[] {
  const p = user.profile
  const rows: Row[] = []

  if (p.department) {
    rows.push({ label: 'Department', value: p.department })
  }

  if (p.batchYear && user.role !== 'admin') {
    rows.push({ label: batchLabel(user.role), value: p.batchYear })
  }

  if (p.skills && p.skills.length > 0 && user.role !== 'admin') {
    rows.push({
      label: user.role === 'faculty' ? 'Research interests' : 'Skills',
      value: <SkillChips skills={p.skills} />,
    })
  }

  if (p.linkedinUrl) {
    rows.push({
      label: 'LinkedIn',
      value: (
        <a
          href={p.linkedinUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--uc-indigo-xl)',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 400,
          }}
        >
          {p.linkedinUrl.replace(/^https?:\/\//, '')}
          <ExternalLink size={11} strokeWidth={1.5} />
        </a>
      ),
    })
  }

  if (isOwnProfile && p.phone) {
    rows.push({ label: 'Phone', value: p.phone })
  }

  const joined = formatJoined(user.createdAt)
  if (joined) rows.push({ label: 'Joined', value: joined })

  return rows
}

function SkillChips({ skills }: { skills: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {skills.map((skill) => (
        <span
          key={skill}
          style={{
            padding: '3px 10px',
            background: 'var(--uc-indigo-bg)',
            border: '0.5px solid var(--uc-indigo-bdr)',
            borderRadius: 'var(--r-pill)',
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--uc-indigo-xl)',
            lineHeight: 1.5,
          }}
        >
          {skill}
        </span>
      ))}
    </div>
  )
}

export function AboutPanel({ user, isOwnProfile }: Props) {
  const bio = user.profile.bio?.trim()
  const rows = buildRows(user, isOwnProfile)
  const hasBio = !!bio
  const hasRows = rows.length > 0

  if (!hasBio && !hasRows) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '40px 20px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {isOwnProfile
            ? 'You haven’t added any details yet. Tap edit profile to get started.'
            : 'No details yet.'}
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-tertiary)',
          letterSpacing: 0.2,
        }}
      >
        {ROLE_HEADLINE[user.role]}
      </h3>

      {hasBio && (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 400,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {bio}
        </p>
      )}

      {hasRows && (
        <dl
          style={{
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            columnGap: 16,
            rowGap: 10,
          }}
        >
          {rows.map((row) => (
            <div key={row.label} style={{ display: 'contents' }}>
              <dt
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--text-tertiary)',
                  paddingTop: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                  minWidth: 0,
                  wordBreak: 'break-word',
                }}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
