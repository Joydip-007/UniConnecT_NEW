import type { PrivacySection, PublicUserProfile } from '@uniconnect/shared'

/**
 * Why a privacy-gated profile section is hidden from this viewer: `connect` when an
 * accepted connection would unlock it, `private` when the owner keeps it to themselves.
 * `null` = visible. The verdict is the server's (`visibility`), so the lock card and
 * the endpoint can never disagree.
 */
export type SectionLock = 'connect' | 'private' | null

export function sectionLock(
  user: PublicUserProfile,
  section: PrivacySection,
  isOwnProfile: boolean,
): SectionLock {
  if (isOwnProfile || user.visibility?.[section] !== 'hidden') return null
  return user.connectionStatus === 'connected' ? 'private' : 'connect'
}
