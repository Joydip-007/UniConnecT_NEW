import type { AllowedRole, GroupType } from '../types'

const TYPE_COLORS: Record<GroupType, { bg: string; border: string; text: string }> = {
  department: { bg: 'var(--uc-indigo-bg)', border: 'var(--uc-indigo-bdr)', text: 'var(--uc-indigo-xl)' },
  club: { bg: 'var(--uc-orange-bg)', border: 'var(--uc-orange-bdr)', text: 'var(--uc-orange-l)' },
  batch: { bg: 'var(--uc-cyan-bg)', border: 'var(--uc-cyan-bdr)', text: 'var(--uc-cyan)' },
  research: { bg: 'var(--uc-mint-bg)', border: 'var(--uc-mint-bdr)', text: 'var(--uc-mint)' },
  interest: { bg: 'var(--uc-indigo-bg)', border: 'var(--uc-indigo-bdr)', text: 'var(--uc-indigo-xl)' },
  other: { bg: 'var(--surface-raised)', border: 'var(--border-default)', text: 'var(--text-secondary)' },
}

const ROLE_LABELS: Record<AllowedRole, string> = {
  student: 'Students only',
  alumni: 'Alumni only',
  faculty: 'Faculty only',
  admin: 'Admins only',
}

const pillStyle = (bg: string, border: string, text: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 'var(--r-pill)',
  fontSize: 11,
  fontWeight: 500,
  background: bg,
  border: `0.5px solid ${border}`,
  color: text,
  whiteSpace: 'nowrap',
  flexShrink: 0,
})

export function TypeBadge({ type }: { type: GroupType }) {
  const c = TYPE_COLORS[type]
  const label = type.charAt(0).toUpperCase() + type.slice(1)
  return <span style={pillStyle(c.bg, c.border, c.text)}>{label}</span>
}

export function AllowedRoleBadge({ allowedRole }: { allowedRole: AllowedRole | null }) {
  if (!allowedRole) return null
  return (
    <span style={pillStyle('var(--surface-raised)', 'var(--border-default)', 'var(--text-secondary)')}>
      {ROLE_LABELS[allowedRole]}
    </span>
  )
}

export function OfficialBadge({ isSystem }: { isSystem: boolean }) {
  if (!isSystem) return null
  return (
    <span style={pillStyle('var(--uc-indigo-bg)', 'var(--uc-indigo-bdr)', 'var(--uc-indigo-xl)')}>Official</span>
  )
}
