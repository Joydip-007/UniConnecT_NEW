import type { LucideIcon } from 'lucide-react'
import { Bus, House, ShieldCheck } from 'lucide-react'
import type { UserRole } from '@uniconnect/shared'
import { ROLE_SHELL } from './roleShell'
import { PATHS } from '@/router/paths'

export interface RoleHome {
  path: string
  /** Lower-case noun for copy: "Back to {name}", "brought you to your {name}". */
  name: string
  icon: LucideIcon
}

// Keyed by the home path, not the role, so a role whose home changes in ROLE_SHELL
// picks up the matching name without a second edit here.
const HOME_META: Record<string, Omit<RoleHome, 'path'>> = {
  [PATHS.FEED]: { name: 'feed', icon: House },
  [PATHS.ADMIN]: { name: 'dashboard', icon: ShieldCheck },
  [PATHS.SHUTTLE_DRIVE]: { name: 'duty board', icon: Bus },
}

/** Where the error screens send a viewer home. Signed out (no role) resolves to the landing page. */
export function roleHome(role: UserRole | null | undefined): RoleHome {
  if (!role) return { path: '/', name: 'home', icon: House }
  const path = ROLE_SHELL[role].home
  return { path, ...(HOME_META[path] ?? { name: 'home', icon: House }) }
}
