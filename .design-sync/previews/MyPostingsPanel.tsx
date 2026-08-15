import { MyPostingsPanel, dsQueryClient } from 'web';

// Seed on the SHARED dsQueryClient export (never @/ds-query-client — a different
// bundled instance, and the panel would render its skeleton forever).
// The panel uses useInfiniteQuery, so the cache entry must carry the full
// {pages, pageParams} envelope, not a bare array.
// One story only: ['jobs','my'] is a fixed key, so two cells on one card would
// share a single cache entry.

const poster = {
  id: 'me',
  fullName: 'Nabila Rahman',
  profile: { avatarUrl: null, headline: 'Engineering manager at Pathao', department: 'CSE' },
};

const job = (over: Record<string, unknown>) => ({
  id: 'job-x',
  title: 'Junior frontend engineer',
  company: 'Pathao',
  location: 'Dhaka',
  type: 'full_time' as const,
  description: 'Build and ship product surfaces with React and TypeScript.',
  requirements: ['React', 'TypeScript'],
  salaryRange: null,
  applicationUrl: null,
  deadline: null,
  postedBy: poster,
  applicationCount: 0,
  myApplication: null,
  isSaved: false,
  viewCount: 0,
  ...over,
});

export function Default() {
  dsQueryClient.setQueryData(['jobs', 'my'], {
    pageParams: [1],
    pages: [
      {
        page: 1,
        total: 3,
        hasMore: false,
        items: [
          job({
            id: 'job-1',
            title: 'Junior frontend engineer',
            company: 'Pathao',
            location: 'Dhaka',
            deadline: '2026-10-30T00:00:00.000Z',
            applicationCount: 14,
            viewCount: 236,
          }),
          job({
            id: 'job-2',
            title: 'Summer internship — data platform',
            company: 'bKash',
            location: 'Remote',
            type: 'internship',
            deadline: '2026-09-01T00:00:00.000Z',
            applicationCount: 41,
            viewCount: 892,
          }),
          // Deadline-less on purpose. The `Closed <date>` state can't be shown
          // here: package-capture.mjs freezes the page clock, so a past deadline
          // still reads as "Open until …" and the cell would just look like a
          // duplicate of the two above it.
          job({
            id: 'job-3',
            title: 'Backend engineer (Node.js)',
            company: 'ShopUp',
            location: 'Banani, Dhaka',
            deadline: null,
            applicationCount: 7,
            viewCount: 154,
          }),
        ],
      },
    ],
  });
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 560 }}>
      <MyPostingsPanel />
    </div>
  );
}
