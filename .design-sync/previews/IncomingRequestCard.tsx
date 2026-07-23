import { IncomingRequestCard } from 'web';

const baseRequest = {
  id: 'req-1',
  message: "Hi, I'm a second-year CSE student interested in backend engineering. Would love guidance on how to prepare for internships.",
  status: 'pending' as const,
  sessionNotes: null,
  conversationId: null,
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  student: { id: 'student-1', fullName: 'Rafiul Karim', avatarUrl: null, headline: null, department: 'CSE', batchYear: '223' },
};

export function Pending() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 480 }}>
      <IncomingRequestCard request={baseRequest} onStatusChange={() => {}} isUpdating={false} addToast={() => {}} />
    </div>
  );
}

export function Accepted() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 480 }}>
      <IncomingRequestCard
        request={{
          ...baseRequest,
          id: 'req-2',
          status: 'accepted',
          sessionNotes: 'Discussed resume review and mock interview scheduling for next week.',
          conversationId: 'conv-1',
        }}
        onStatusChange={() => {}}
        isUpdating={false}
        addToast={() => {}}
      />
    </div>
  );
}

export function Completed() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 480 }}>
      <IncomingRequestCard
        request={{ ...baseRequest, id: 'req-3', status: 'completed', conversationId: 'conv-2' }}
        onStatusChange={() => {}}
        isUpdating={false}
        addToast={() => {}}
      />
    </div>
  );
}
