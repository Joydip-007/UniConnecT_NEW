import type { MemberRole } from '../types'

const STYLES: Record<MemberRole, { bg: string; border: string; text: string; label: string }> = {
  owner: { bg: 'var(--uc-orange-bg)', border: 'var(--uc-orange-bdr)', text: 'var(--uc-orange-l)', label: 'Creator' },
  admin: { bg: 'var(--uc-indigo-bg)', border: 'var(--uc-indigo-bdr)', text: 'var(--uc-indigo-xl)', label: 'Admin' },
  moderator: { bg: 'var(--surface-raised)', border: 'var(--border-default)', text: 'var(--text-secondary)', label: 'Mod' },
  member: { bg: 'transparent', border: 'var(--border-default)', text: 'var(--text-tertiary)', label: '' },
}

export function MemberRoleTag({
  role,
  hideOwner = false,
}: {
  role: MemberRole
  hideOwner?: boolean
}) {
  if (role === 'member') return null
  if (role === 'owner' && hideOwner) return null
  const s = STYLES[role]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        fontSize: 11,
        fontWeight: 500,
        background: s.bg,
        border: `0.5px solid ${s.border}`,
        color: s.text,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  )
}
