// Profile privacy model — single source of truth shared by the API (enforcement)
// and the web settings UI. Audience tiers gate who can see each profile section
// and who can contact / discover a user.

/** Profile sections gated by an audience tier. */
export const PRIVACY_SECTIONS = [
  'contact_info',
  'experience',
  'education',
  'connections_list',
  'activity',
] as const

export type PrivacySection = (typeof PRIVACY_SECTIONS)[number]

/** Audience tiers. `everyone` = any authenticated user in the same university. */
export const AUDIENCE_TIERS = ['everyone', 'connections', 'only_me'] as const
export type AudienceTier = (typeof AUDIENCE_TIERS)[number]

/** Who may initiate contact. */
export const CONNECTION_REQUEST_TIERS = ['everyone', 'only_me'] as const
export type ConnectionRequestTier = (typeof CONNECTION_REQUEST_TIERS)[number]

export const MESSAGE_TIERS = ['everyone', 'connections', 'only_me'] as const
export type MessageTier = (typeof MESSAGE_TIERS)[number]

/** Who may see online/last-seen status (consumed by the presence feature). */
export const ONLINE_VISIBILITY_TIERS = ['everyone', 'connections', 'only_me'] as const
export type OnlineVisibilityTier = (typeof ONLINE_VISIBILITY_TIERS)[number]

export interface PrivacyPreferences {
  sections: Record<PrivacySection, AudienceTier>
  connection_requests: ConnectionRequestTier
  messages: MessageTier
  discoverable: boolean
  online_visibility: OnlineVisibilityTier
}

/** Open by default to preserve current behaviour; contact info defaults to connections-only. */
export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  sections: {
    contact_info: 'connections',
    experience: 'everyone',
    education: 'everyone',
    connections_list: 'everyone',
    activity: 'everyone',
  },
  connection_requests: 'everyone',
  messages: 'connections',
  discoverable: true,
  online_visibility: 'connections',
}

/** Visibility hint returned to the client per gated section so it can render private states. */
export type SectionVisibility = Record<PrivacySection, 'visible' | 'hidden'>

/** Display metadata for the settings UI (sentence case, per design rules). */
export const PRIVACY_SECTION_META: Record<PrivacySection, { label: string; description: string }> = {
  contact_info: { label: 'Contact info', description: 'Email, phone, location and links' },
  experience: { label: 'Experience', description: 'Your work history' },
  education: { label: 'Education', description: 'Your education history' },
  connections_list: { label: 'Connections', description: 'The list of people you are connected to' },
  activity: { label: 'Activity', description: 'Your recent posts and reactions' },
}
