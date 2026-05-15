import type { UserRole } from '@uniconnect/shared'

export interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}
