import {
  DEFAULT_PRIVACY_PREFERENCES,
  PRIVACY_SECTIONS,
  type AudienceTier,
  type PrivacyPreferences,
  type PrivacyPreferencesInput,
  type SectionVisibility,
} from '@uniconnect/shared'
import { db } from '../../config/db'

// ── Persistence ──────────────────────────────────────────────────────────────

interface PrivacyRow {
  privacy_preferences: Partial<PrivacyPreferences> | null
}

/** Deep-merge a stored partial over the defaults so callers always get the full object. */
export function mergePrivacy(partial?: Partial<PrivacyPreferences> | null): PrivacyPreferences {
  return {
    sections: { ...DEFAULT_PRIVACY_PREFERENCES.sections, ...(partial?.sections ?? {}) },
    connection_requests: partial?.connection_requests ?? DEFAULT_PRIVACY_PREFERENCES.connection_requests,
    messages: partial?.messages ?? DEFAULT_PRIVACY_PREFERENCES.messages,
    discoverable: partial?.discoverable ?? DEFAULT_PRIVACY_PREFERENCES.discoverable,
    online_visibility: partial?.online_visibility ?? DEFAULT_PRIVACY_PREFERENCES.online_visibility,
  }
}

export async function loadPrivacy(userId: string): Promise<PrivacyPreferences> {
  const row = await db('user_settings')
    .where({ user_id: userId })
    .select<PrivacyRow[]>('privacy_preferences')
    .first()
  return mergePrivacy(row?.privacy_preferences)
}

export async function updatePrivacy(
  userId: string,
  universityId: string,
  input: PrivacyPreferencesInput,
): Promise<PrivacyPreferences> {
  const current = await loadPrivacy(userId)
  const merged: PrivacyPreferences = mergePrivacy({
    sections: { ...current.sections, ...(input.sections ?? {}) },
    connection_requests: input.connection_requests ?? current.connection_requests,
    messages: input.messages ?? current.messages,
    discoverable: input.discoverable ?? current.discoverable,
    online_visibility: input.online_visibility ?? current.online_visibility,
  })

  await db('user_settings')
    .insert({ user_id: userId, university_id: universityId, privacy_preferences: merged })
    .onConflict('user_id')
    .merge({ privacy_preferences: merged, updated_at: db.fn.now() })

  return merged
}

// ── Evaluation ───────────────────────────────────────────────────────────────

/** Pure tier check given precomputed relationship facts. */
export function evaluateTier(
  tier: AudienceTier,
  facts: { isOwner: boolean; isConnected: boolean },
): boolean {
  if (facts.isOwner) return true
  switch (tier) {
    case 'everyone':
      return true
    case 'connections':
      return facts.isConnected
    case 'only_me':
      return false
    default:
      return false
  }
}

/** Build the per-section visibility map the client uses to render private states. */
export function buildSectionVisibility(
  prefs: PrivacyPreferences,
  facts: { isOwner: boolean; isConnected: boolean },
): SectionVisibility {
  const visibility = {} as SectionVisibility
  for (const section of PRIVACY_SECTIONS) {
    visibility[section] = evaluateTier(prefs.sections[section], facts) ? 'visible' : 'hidden'
  }
  return visibility
}

/**
 * Accepted-connection check (connection row or accepted mentorship). Shared by privacy
 * gating and presence. Returns false for self (callers handle `isOwner` separately).
 */
export async function isAcceptedConnection(
  userA: string,
  userB: string,
  universityId: string,
): Promise<boolean> {
  if (userA === userB) return false

  const connection = await db('connections')
    .where(function () {
      this.where({ requester_id: userA, addressee_id: userB }).orWhere({
        requester_id: userB,
        addressee_id: userA,
      })
    })
    .andWhere('status', 'accepted')
    .andWhere('university_id', universityId)
    .first()
  if (connection) return true

  const mentorship = await db('mentorship_requests')
    .where(function () {
      this.where({ student_id: userA, alumni_id: userB }).orWhere({
        student_id: userB,
        alumni_id: userA,
      })
    })
    .andWhere('status', 'accepted')
    .andWhere('university_id', universityId)
    .andWhere('is_deleted', false)
    .first()
  return !!mentorship
}

/** Convenience: can the viewer see a single section of the target's profile? */
export async function canViewSection(
  viewerId: string,
  targetUserId: string,
  section: (typeof PRIVACY_SECTIONS)[number],
  universityId: string,
): Promise<boolean> {
  const isOwner = viewerId === targetUserId
  const prefs = await loadPrivacy(targetUserId)
  const isConnected = isOwner ? false : await isAcceptedConnection(viewerId, targetUserId, universityId)
  return evaluateTier(prefs.sections[section], { isOwner, isConnected })
}
