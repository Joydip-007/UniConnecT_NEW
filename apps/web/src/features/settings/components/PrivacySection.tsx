import type { CSSProperties } from 'react'
import {
  PRIVACY_SECTION_META,
  PRIVACY_SECTIONS,
  type AudienceTier,
  type PrivacySection as PrivacySectionKey,
} from '@uniconnect/shared'
import { usePrivacyPreferences, useUpdatePrivacyPreferences } from '../hooks/usePrivacyPreferences'
import { Toggle } from './Toggle'
import { SectionHeader } from './NotificationsSection'
import BlockedAccountsSection from './BlockedAccountsSection'

const TIER_LABEL: Record<AudienceTier, string> = {
  everyone: 'Everyone',
  connections: 'Connections',
  only_me: 'Only me',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '12px 0',
  borderTop: '0.5px solid var(--border-default)',
}

function Select<T extends string>({
  value,
  options,
  disabled,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  disabled?: boolean
  onChange: (next: T) => void
  ariaLabel: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        appearance: 'none',
        background: 'var(--surface-raised)',
        color: 'var(--text-primary)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-pill)',
        padding: '6px 14px',
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

const ALL_TIERS: { value: AudienceTier; label: string }[] = [
  { value: 'everyone', label: TIER_LABEL.everyone },
  { value: 'connections', label: TIER_LABEL.connections },
  { value: 'only_me', label: TIER_LABEL.only_me },
]

export default function PrivacySection() {
  const { data: prefs, isLoading } = usePrivacyPreferences()
  const update = useUpdatePrivacyPreferences()
  const busy = update.isPending

  function setSectionTier(section: PrivacySectionKey, tier: AudienceTier) {
    update.mutate({ sections: { [section]: tier } })
  }

  return (
    <div>
      <SectionHeader
        title="Privacy"
        description="Control who can see each part of your profile, who can reach you, and whether you appear in search."
      />

      {isLoading || !prefs ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : (
        <div>
          {/* Section visibility */}
          {PRIVACY_SECTIONS.map((section) => {
            const meta = PRIVACY_SECTION_META[section]
            return (
              <div key={section} style={rowStyle}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {meta.description}
                  </div>
                </div>
                <Select
                  ariaLabel={`Who can see ${meta.label}`}
                  value={prefs.sections[section]}
                  options={ALL_TIERS}
                  disabled={busy}
                  onChange={(tier) => setSectionTier(section, tier)}
                />
              </div>
            )
          })}

          {/* Contact + discovery */}
          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                Connection requests
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Who can send you a connection request
              </div>
            </div>
            <Select
              ariaLabel="Who can send connection requests"
              value={prefs.connection_requests}
              options={[
                { value: 'everyone', label: TIER_LABEL.everyone },
                { value: 'only_me', label: 'No one' },
              ]}
              disabled={busy}
              onChange={(v) => update.mutate({ connection_requests: v })}
            />
          </div>

          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Messages</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Who can start a new conversation with you
              </div>
            </div>
            <Select
              ariaLabel="Who can message you"
              value={prefs.messages}
              options={ALL_TIERS.map((t) => (t.value === 'only_me' ? { value: t.value, label: 'No one' } : t))}
              disabled={busy}
              onChange={(v) => update.mutate({ messages: v })}
            />
          </div>

          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                Online status
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Who can see when you are active
              </div>
            </div>
            <Select
              ariaLabel="Who can see your online status"
              value={prefs.online_visibility}
              options={ALL_TIERS.map((t) => (t.value === 'only_me' ? { value: t.value, label: 'No one' } : t))}
              disabled={busy}
              onChange={(v) => update.mutate({ online_visibility: v })}
            />
          </div>

          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                Discoverable in search
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Show your profile in people search and suggestions
              </div>
            </div>
            <Toggle
              label="Discoverable in search"
              checked={prefs.discoverable}
              disabled={busy}
              onChange={(next) => update.mutate({ discoverable: next })}
            />
          </div>
        </div>
      )}

      <BlockedAccountsSection />
    </div>
  )
}
