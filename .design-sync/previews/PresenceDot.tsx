import { PresenceDot } from 'web';
import { usePresenceStore } from '@/stores/presenceStore';

usePresenceStore.setState({
  byUser: {
    online: { status: 'online', lastSeenAt: null },
    away: { status: 'offline', lastSeenAt: new Date(Date.now() - 5 * 60_000).toISOString() },
  },
});

export function OnlineOverAvatar() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <div style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)' }}>
        <PresenceDot userId="online" overlay />
      </div>
    </div>
  );
}

export function OnlineInline() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <span style={{ color: 'var(--text-primary)' }}>
        Jane Doe
        <PresenceDot userId="online" />
      </span>
    </div>
  );
}

export function OfflineRendersNothing() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <div style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
        no dot
        <PresenceDot userId="away" overlay />
      </div>
    </div>
  );
}
