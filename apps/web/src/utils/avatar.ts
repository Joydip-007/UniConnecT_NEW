export const AVATAR_COLORS = [
  'var(--uc-indigo)',
  'var(--uc-orange)',
  'var(--uc-cyan)',
  'var(--uc-mint)',
  'var(--uc-navy)',
]

export function avatarColor(id: string): string {
  let sum = 0
  for (const ch of id) sum += ch.charCodeAt(0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
