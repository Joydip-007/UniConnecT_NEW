import { EventSummaryCard } from 'web';

const wrap = { padding: 12, display: 'flex' as const };

export function NotGoing() {
  return (
    <div style={wrap}>
      <EventSummaryCard
        event={{
          id: 'event-1',
          title: 'Spring 2026 career fair',
          coverUrl: 'https://picsum.photos/seed/career-fair/400/150',
          startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          rsvpCount: 128,
          myRsvp: null,
        }}
      />
    </div>
  );
}

export function Going() {
  return (
    <div style={wrap}>
      <EventSummaryCard
        event={{
          id: 'event-2',
          title: 'Intro to React workshop for freshers',
          coverUrl: null,
          startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          rsvpCount: 42,
          myRsvp: 'going',
        }}
      />
    </div>
  );
}
