import { UpcomingEventsWidget, dsQueryClient } from 'web';

// Seed on the SHARED dsQueryClient export (never the @/ds-query-client source
// path — that resolves to a different bundled instance and the widget stays
// isLoading forever). Query key matches the widget's own: ['events','list',{from:'today'}].

const KEY = ['events', 'list', { from: 'today' }];

const EVENTS = [
  {
    id: 'evt-1',
    title: 'Alumni networking night 2026',
    location: 'UIU Auditorium',
    startsAt: '2026-09-04T12:30:00.000Z',
  },
  {
    id: 'evt-2',
    title: 'CSE thesis defence — Spring batch',
    location: 'Room 512, Academic Block',
    startsAt: '2026-09-11T04:00:00.000Z',
  },
  {
    id: 'evt-3',
    title: 'Career fair: 40+ hiring partners on campus',
    location: null,
    startsAt: '2026-09-18T03:30:00.000Z',
  },
];

// ONE story only, deliberately: the widget's query key is a fixed constant, so
// two cells on the same card would share one cache entry and the last one to
// render would win for both. The variant axis here lives in the data, not props.
export function Default() {
  dsQueryClient.setQueryData(KEY, EVENTS);
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <UpcomingEventsWidget />
    </div>
  );
}
