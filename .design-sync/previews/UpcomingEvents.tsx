import { UpcomingEvents } from 'web';

const events = [
  {
    id: 'evt-201',
    title: 'UIU Tech Fest 2026 — Opening Ceremony',
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    location: 'Auditorium 2, Dhaka Campus',
    coverUrl: null,
    rsvpCount: 312,
    myRsvp: null as const,
  },
  {
    id: 'evt-202',
    title: 'Alumni Homecoming Mixer',
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
    location: 'Rooftop Terrace, Building B',
    coverUrl: null,
    rsvpCount: 87,
    myRsvp: 'going' as const,
  },
];

export function Populated() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', display: 'flex', gap: 12, overflowX: 'auto' }}>
      <UpcomingEvents events={events} />
    </div>
  );
}

export function Empty() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <UpcomingEvents events={[]} />
    </div>
  );
}
