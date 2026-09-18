import { PeopleDirectory, dsQueryClient } from 'web';

// The campus people directory behind /groups?section=people. Infinite query
// keyed on the filters object, so two filter sets can be seeded side by side.
// Needs the full useInfiniteQuery envelope, not a bare array.

const person = (id: string, fullName: string, role: 'student' | 'alumni' | 'faculty', department: string, connectionStatus: 'none' | 'connected' | 'pending_sent' | 'pending_received', mutual: number) => ({
  id,
  username: fullName.toLowerCase().replace(/[^a-z]+/g, '.'),
  role,
  isVerified: role !== 'student',
  mutualConnections: mutual,
  connectionStatus,
  profile: { fullName, department, avatarUrl: null, bio: null, headline: null },
});

const ALL = [
  person('u1', 'Nusrat Jahan', 'student', 'CSE', 'none', 4),
  person('u2', 'Tanvir Ahmed', 'alumni', 'CSE', 'connected', 12),
  person('u3', 'Dr. Farhana Rahman', 'faculty', 'CSE', 'none', 2),
  person('u4', 'Sakib Hossain', 'student', 'EEE', 'pending_sent', 1),
  person('u5', 'Maliha Chowdhury', 'alumni', 'BBA', 'pending_received', 6),
  person('u6', 'Rafiul Islam', 'student', 'CSE', 'none', 0),
];
const page = (items: typeof ALL) => ({ pages: [{ items, total: items.length, page: 1, hasMore: false }], pageParams: [1] });

dsQueryClient.setQueryData(['users', 'directory', {}], page(ALL));
dsQueryClient.setQueryData(['users', 'directory', { role: 'alumni' }], page(ALL.filter((p) => p.role === 'alumni')));
dsQueryClient.setQueryData(['users', 'directory', { search: 'zzz-nobody' }], page([]));

const empty = <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: 32 }}>Nobody matches those filters.</p>;
const frame = { padding: 16, background: 'var(--surface-page)', width: 820 };

export function Everyone() {
  return <div style={frame}><PeopleDirectory emptyState={empty} /></div>;
}

export function AlumniOnly() {
  return <div style={frame}><PeopleDirectory role="alumni" emptyState={empty} /></div>;
}

export function NoMatches() {
  return <div style={frame}><PeopleDirectory search="zzz-nobody" emptyState={empty} /></div>;
}
