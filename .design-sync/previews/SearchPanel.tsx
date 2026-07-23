import { SearchPanel, dsQueryClient } from 'web';

// Force framer-motion's useReducedMotion() to true so the panel renders in its
// final (opacity:1) state immediately — otherwise the capture can land mid
// enter-animation (initial opacity:0) and screenshot a blank frame.
if (typeof window !== 'undefined') {
  const mql = {
    matches: true,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  window.matchMedia = (() => mql) as typeof window.matchMedia;
}

const people = [
  { id: 'u1', fullName: 'Farzana Rahman', headline: 'Software Engineer at Therap', department: 'CSE', batchYear: '2019', avatarUrl: null, role: 'alumni', connectionStatus: 'none', connectionId: null },
  { id: 'u2', fullName: 'Tanvir Ahmed', headline: null, department: 'EEE', batchYear: '2023', avatarUrl: null, role: 'student', connectionStatus: 'pending_sent', connectionId: 'c1' },
];

const posts = [
  { id: 'p1', content: 'Excited to share our new mentorship matching feature!', createdAt: new Date(Date.now() - 25 * 60_000).toISOString(), reactionCount: 48, commentCount: 12, author: { id: 'u1', fullName: 'Farzana Rahman', avatarUrl: null } },
];

const jobs = [
  { id: 'j1', title: 'Frontend Engineer', company: 'Pathao', type: 'full-time', location: 'Dhaka', deadline: null },
];

const events = [
  { id: 'e1', title: 'Alumni Homecoming 2026', startsAt: new Date(Date.now() + 7 * 86400_000).toISOString(), location: 'UIU Auditorium', coverUrl: null, myRsvp: null },
];

const groups = [
  { id: 'g1', name: 'CSE Alumni Network', type: 'alumni', avatarUrl: null, memberCount: 842, isMember: true },
];

const allResult = { people, posts, jobs, events, groups };
const paged = <T,>(items: T[]) => ({ pages: [{ items, total: items.length, page: 1, hasMore: false }], pageParams: [1] });

dsQueryClient.setQueryData(['search', 'all', { q: 'alumni' }], allResult);
dsQueryClient.setQueryData(['search', 'people', { q: 'alumni' }], paged(people));
dsQueryClient.setQueryData(['search', 'posts', { q: 'alumni' }], paged(posts));
dsQueryClient.setQueryData(['search', 'jobs', { q: 'alumni' }], paged(jobs));
dsQueryClient.setQueryData(['search', 'events', { q: 'alumni' }], paged(events));
dsQueryClient.setQueryData(['search', 'groups', { q: 'alumni' }], paged(groups));

dsQueryClient.setQueryData(['search', 'all', { q: 'zzz' }], { people: [], posts: [], jobs: [], events: [], groups: [] });

export function WithResults() {
  return (
    <div style={{ position: 'relative', height: 560, background: 'var(--surface-page)', transform: 'translateZ(0)', overflow: 'hidden' }}>
      <SearchPanel query="alumni" onClose={() => {}} />
    </div>
  );
}

export function NoResults() {
  return (
    <div style={{ position: 'relative', height: 560, background: 'var(--surface-page)', transform: 'translateZ(0)', overflow: 'hidden' }}>
      <SearchPanel query="zzz" onClose={() => {}} />
    </div>
  );
}
