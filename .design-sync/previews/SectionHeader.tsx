import { SectionHeader } from 'web';

// NOTE (batch2 learning): SectionHeader lives at
// apps/web/src/features/settings/components/NotificationsSection.tsx — outside
// the feed/groups/explore domains this batch was told to expect. It's the only
// export named `SectionHeader` anywhere in apps/web/src, so it's the canonical
// component the shared bundle resolves under this name.
export function Default() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <SectionHeader
        title="Notifications"
        description="Choose what you hear about and how you hear about it."
      />
    </div>
  );
}

export function LongerDescription() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <SectionHeader
        title="Privacy"
        description="Control who can see your profile, message you, and find you in search across UniConnecT."
      />
    </div>
  );
}
