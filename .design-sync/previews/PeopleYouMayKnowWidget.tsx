import { PeopleYouMayKnowWidget, dsQueryClient } from 'web';

// Seed on the SHARED dsQueryClient export (never @/ds-query-client — a different
// bundled instance, and the widget would stay in its skeleton state).
// One story only: the query key is a fixed constant, so two cells on one card
// would share a single cache entry and the last render would win for both.

export function Default() {
  dsQueryClient.setQueryData(
    ['users', 'suggestions'],
    [
      {
        id: 'u-1',
        role: 'alumni',
        profile: { fullName: 'Nabila Rahman', department: 'CSE', batchYear: '2019' },
        connectionStatus: 'none',
        connectionId: null,
      },
      {
        id: 'u-2',
        role: 'student',
        profile: {
          fullName: 'Tanvir Ahmed',
          department: 'Computer Science & Engineering',
          batchYear: '2026',
        },
        connectionStatus: 'pending_sent',
        connectionId: 'conn-9',
      },
      {
        id: 'u-3',
        role: 'faculty',
        profile: { fullName: 'Dr. Shuvo Islam', department: 'EEE', batchYear: null },
        connectionStatus: 'none',
        connectionId: null,
      },
    ],
  );
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <PeopleYouMayKnowWidget />
    </div>
  );
}
