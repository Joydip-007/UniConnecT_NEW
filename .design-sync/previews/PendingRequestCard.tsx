import { PendingRequestCard } from 'web';

const base = { padding: 12 };

export function Default() {
  return (
    <div style={base}>
      <PendingRequestCard
        request={{
          id: 'req-1',
          requesterId: 'user-nabila',
          status: 'pending',
          requester: {
            id: 'user-nabila',
            fullName: 'Nabila Rahman',
            headline: 'Product Designer at Pathao',
            avatarUrl: null,
            mutualConnections: 4,
          },
        }}
      />
    </div>
  );
}

export function NoMutuals() {
  return (
    <div style={base}>
      <PendingRequestCard
        request={{
          id: 'req-2',
          requesterId: 'user-tanvir',
          status: 'pending',
          requester: {
            id: 'user-tanvir',
            fullName: 'Tanvir Ahmed',
            department: 'Computer Science & Engineering',
            avatarUrl: null,
            mutualConnections: 0,
          },
        }}
      />
    </div>
  );
}

export function WithDepartmentAndMutual() {
  return (
    <div style={base}>
      <PendingRequestCard
        request={{
          id: 'req-3',
          requesterId: 'user-shuvo',
          status: 'pending',
          requester: {
            id: 'user-shuvo',
            fullName: 'Shuvo Islam',
            department: 'Electrical & Electronic Engineering',
            avatarUrl: null,
            mutualConnections: 1,
          },
        }}
      />
    </div>
  );
}
