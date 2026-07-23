import { GroupResultCard } from 'web';

const groups = [
  { id: 'g1', name: 'CSE Alumni Network', type: 'alumni', avatarUrl: null, memberCount: 842, isMember: true },
  { id: 'g2', name: 'AI & Robotics Club', type: 'club', avatarUrl: null, memberCount: 213, isMember: false },
  { id: 'g3', name: 'Photography Society', type: 'interest', avatarUrl: null, memberCount: 96, isMember: false },
];

export function Joined() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 340 }}>
      <GroupResultCard group={groups[0]} />
    </div>
  );
}

export function NotJoined() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 340 }}>
      <GroupResultCard group={groups[1]} />
    </div>
  );
}

export function ResultsList() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 340 }}>
      {groups.map((g) => (
        <GroupResultCard key={g.id} group={g} />
      ))}
    </div>
  );
}
