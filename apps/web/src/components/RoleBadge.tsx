import type { UserRole } from '@uniconnect/shared'
import { BookOpen, Bus, GraduationCap, Medal, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ROLE_LABEL } from './RoleBadge.constants'

export { ROLE_LABEL }

const ROLE_ICON: Record<UserRole, LucideIcon> = {
  student: GraduationCap,
  alumni: Medal,
  faculty: BookOpen,
  admin: Shield,
  driver: Bus,
}

interface RoleBadgeProps {
  role: UserRole
  /** Glyph box in px — spec §6 says 14–16. */
  size?: number
  showTooltip?: boolean
  /**
   * Which side the tooltip opens on. Default `above`; pass `below` when the badge
   * sits near the top edge of a paint-contained box (`.feed-post-card` carries
   * `content-visibility: auto`, which clips anything crossing the card edge no
   * matter its z-index).
   */
  tipPlacement?: 'above' | 'below'
}

export function RoleBadge({
  role,
  size = 15,
  showTooltip = true,
  tipPlacement = 'above',
}: RoleBadgeProps) {
  const Icon = ROLE_ICON[role]
  return (
    <span
      className={`role-badge role-badge--${role}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ROLE_LABEL[role]}
    >
      <Icon size={size} strokeWidth={1.75} className="role-badge__glyph" aria-hidden />
      {showTooltip && (
        <span
          className={`role-badge__tip${tipPlacement === 'below' ? ' role-badge__tip--below' : ''}`}
          aria-hidden="true"
        >
          {ROLE_LABEL[role]}
        </span>
      )}
    </span>
  )
}
