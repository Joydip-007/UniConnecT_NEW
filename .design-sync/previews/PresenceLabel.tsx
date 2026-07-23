import { PresenceLabel } from 'web';
import { usePresenceStore } from '@/stores/presenceStore';

usePresenceStore.setState({
  byUser: {
    online: { status: 'online', lastSeenAt: null },
    recentlyOffline: { status: 'offline', lastSeenAt: new Date(Date.now() - 5 * 60_000).toISOString() },
    longOffline: { status: 'offline', lastSeenAt: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString() },
  },
});

export function ActiveNow() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <PresenceLabel userId="online" />
    </div>
  );
}

export function ActiveMinutesAgo() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <PresenceLabel userId="recentlyOffline" />
    </div>
  );
}

export function ActiveDaysAgo() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <PresenceLabel userId="longOffline" />
    </div>
  );
}
