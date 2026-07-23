import { PeopleSuggestions } from 'web';

export function Populated() {
  return (
    <div style={{ padding: 12, width: 300, background: 'var(--surface-card)' }}>
      <PeopleSuggestions
        people={[
          { id: 'p1', fullName: 'Nabila Rahman', avatarUrl: null, headline: 'Product Designer at Pathao', department: 'CSE', connectionStatus: 'none', connectionId: null },
          { id: 'p2', fullName: 'Tanvir Ahmed', avatarUrl: null, headline: null, department: 'Computer Science & Engineering', connectionStatus: 'pending_sent', connectionId: 'conn-9' },
          { id: 'p3', fullName: 'Shuvo Islam', avatarUrl: null, headline: 'EEE undergrad', department: 'Electrical & Electronic Engineering', connectionStatus: 'none', connectionId: null },
        ]}
      />
    </div>
  );
}

export function Empty() {
  return (
    <div style={{ padding: 12 }}>
      <PeopleSuggestions people={[]} />
    </div>
  );
}
