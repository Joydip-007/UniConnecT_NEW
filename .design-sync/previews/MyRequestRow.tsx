import { MyRequestRow } from 'web';

const baseRequest = {
  id: 'my-req-1',
  message: "Hi, I'm looking for mentorship in frontend engineering, especially React and design systems.",
  status: 'pending' as const,
  sessionNotes: null,
  conversationId: null,
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  alumni: { id: 'alum-1', fullName: 'Nadia Islam', avatarUrl: null, headline: 'Senior Software Engineer at Brain Station 23', department: 'CSE', batchYear: '181' },
};

export function Pending() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 480 }}>
      <MyRequestRow request={baseRequest} />
    </div>
  );
}

export function AcceptedWithNotes() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 480 }}>
      <MyRequestRow
        request={{
          ...baseRequest,
          id: 'my-req-2',
          status: 'accepted',
          sessionNotes: 'First session scheduled for Thursday at 5pm to review portfolio.',
          conversationId: 'conv-3',
        }}
      />
    </div>
  );
}

export function Expired() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 480 }}>
      <MyRequestRow request={{ ...baseRequest, id: 'my-req-3', status: 'expired' }} />
    </div>
  );
}
