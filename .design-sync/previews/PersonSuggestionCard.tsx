import { PersonSuggestionCard } from 'web';

const wrap = { padding: 12, width: 280, background: 'var(--surface-card)' };

export function NoneConnection() {
  return (
    <div style={wrap}>
      <PersonSuggestionCard
        person={{ id: 'p1', fullName: 'Nabila Rahman', avatarUrl: null, headline: 'Product Designer at Pathao', department: 'CSE', connectionStatus: 'none', connectionId: null }}
        isLast
      />
    </div>
  );
}

export function PendingConnection() {
  return (
    <div style={wrap}>
      <PersonSuggestionCard
        person={{ id: 'p2', fullName: 'Tanvir Ahmed', avatarUrl: null, headline: null, department: 'Computer Science & Engineering', connectionStatus: 'pending_sent', connectionId: 'conn-9' }}
        isLast
      />
    </div>
  );
}
