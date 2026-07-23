import { EventResultCard } from 'web';

export function Default() {
  return (
    <div style={{ background: 'var(--surface-card)' }}>
      <EventResultCard
        event={{
          id: 'event-1',
          title: 'Spring 2026 career fair',
          location: 'UIU Campus, Madani Ave, Dhaka',
          startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        }}
      />
    </div>
  );
}

export function OnlineEvent() {
  return (
    <div style={{ background: 'var(--surface-card)' }}>
      <EventResultCard
        event={{
          id: 'event-2',
          title: 'AI in Bangladesh: industry panel',
          location: 'Online — Zoom',
          startsAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
        }}
      />
    </div>
  );
}
