import { OnboardingChecklist, dsQueryClient } from 'web';

function seedProgress(progress: {
  hasAvatar: boolean;
  hasHeadline: boolean;
  hasBio: boolean;
  hasMadePost: boolean;
  connectionCount: number;
}) {
  dsQueryClient.setQueryData(['users', 'me', 'progress'], progress);
  dsQueryClient.setQueryData(['users', 'suggestions'], [
    {
      id: 'user-nadia',
      role: 'student',
      profile: { fullName: 'Nadia Islam', department: 'BBA', batchYear: '2024' },
      connectionStatus: 'none',
      connectionId: null,
    },
    {
      id: 'user-rafiq',
      role: 'alumni',
      profile: { fullName: 'Rafiq Chowdhury', department: 'CSE', batchYear: '2019' },
      connectionStatus: 'none',
      connectionId: null,
    },
  ]);
}

export function JustStarted() {
  seedProgress({ hasAvatar: false, hasHeadline: false, hasBio: false, hasMadePost: false, connectionCount: 0 });
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 420 }}>
      <OnboardingChecklist />
    </div>
  );
}

export function MostlyDone() {
  seedProgress({ hasAvatar: true, hasHeadline: true, hasBio: true, hasMadePost: false, connectionCount: 1 });
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 420 }}>
      <OnboardingChecklist />
    </div>
  );
}
