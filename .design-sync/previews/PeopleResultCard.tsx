import { PeopleResultCard } from 'web';

const people = [
  {
    id: 'u1',
    fullName: 'Farzana Rahman',
    headline: 'Software Engineer at Therap',
    department: 'CSE',
    batchYear: '2019',
    avatarUrl: null,
    role: 'alumni',
    connectionStatus: 'none' as const,
    connectionId: null,
  },
  {
    id: 'u2',
    fullName: 'Tanvir Ahmed',
    headline: null,
    department: 'EEE',
    batchYear: '2023',
    avatarUrl: null,
    role: 'student',
    connectionStatus: 'pending_sent' as const,
    connectionId: 'c1',
  },
  {
    id: 'u3',
    fullName: 'Nusrat Jahan',
    headline: 'Product Designer',
    department: 'CSE',
    batchYear: '2020',
    avatarUrl: null,
    role: 'alumni',
    connectionStatus: 'connected' as const,
    connectionId: 'c2',
  },
];

export function DefaultResult() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 340 }}>
      <PeopleResultCard person={people[0]} query="Farzana" />
    </div>
  );
}

export function PendingRequest() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 340 }}>
      <PeopleResultCard person={people[1]} query="Tanvir" />
    </div>
  );
}

export function ResultsList() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 340 }}>
      {people.map((p) => (
        <PeopleResultCard key={p.id} person={p} query="a" />
      ))}
    </div>
  );
}
