import { EventCard } from 'web';

const qk = ['events', 'list'] as const;
const wrap = { padding: 12, width: 320 };

export function CareerFairUpcoming() {
  return (
    <div style={wrap}>
      <EventCard
        queryKey={qk}
        event={{
          id: 'event-1',
          title: 'Spring 2026 career fair',
          type: 'career_fair',
          startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
          location: 'UIU Campus, Madani Ave, Dhaka',
          description: 'Meet recruiters from 40+ companies.',
          coverUrl: 'https://picsum.photos/seed/career-fair/400/200',
          rsvpCounts: { going: 128, maybe: 34 },
          capacity: 500,
          myRsvp: null,
          previewAttendees: [
            { id: 'u1', fullName: 'Nabila Rahman', avatarUrl: null },
            { id: 'u2', fullName: 'Tanvir Ahmed', avatarUrl: null },
            { id: 'u3', fullName: 'Shuvo Islam', avatarUrl: null },
          ],
          totalAttendees: 128,
          organizer: { id: 'org-1', fullName: 'Career Services Office' },
        }}
      />
    </div>
  );
}

export function WorkshopGoing() {
  return (
    <div style={wrap}>
      <EventCard
        queryKey={qk}
        event={{
          id: 'event-2',
          title: 'Intro to React workshop for freshers',
          type: 'workshop',
          startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          location: 'Lab 402, CSE Building',
          description: 'Hands-on workshop covering React fundamentals.',
          coverUrl: null,
          rsvpCounts: { going: 42, maybe: 8 },
          capacity: 60,
          myRsvp: 'going',
          previewAttendees: [
            { id: 'u4', fullName: 'Farhan Kabir', avatarUrl: null },
            { id: 'u5', fullName: 'Ishrat Jahan', avatarUrl: null },
          ],
          totalAttendees: 42,
          organizer: { id: 'org-2', fullName: 'CSE Club' },
        }}
      />
    </div>
  );
}

export function EndedNoRsvp() {
  return (
    <div style={wrap}>
      <EventCard
        queryKey={qk}
        event={{
          id: 'event-3',
          title: 'Alumni networking mixer',
          type: 'alumni_meetup',
          startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          location: 'UIU Auditorium',
          description: 'An evening of networking with alumni across industries.',
          coverUrl: 'https://picsum.photos/seed/mixer/400/200',
          rsvpCounts: { going: 0, maybe: 0 },
          capacity: null,
          myRsvp: null,
          previewAttendees: [],
          totalAttendees: 0,
          organizer: { id: 'org-3', fullName: 'Alumni Relations' },
        }}
      />
    </div>
  );
}
