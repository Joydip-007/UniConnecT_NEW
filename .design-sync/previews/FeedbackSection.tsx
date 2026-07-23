import { FeedbackSection, dsQueryClient } from 'web';

dsQueryClient.setQueryData(['mentorship', 'feedback', 'req-submitted'], {
  student: { id: 'f1', authorId: 'u1', authorRole: 'student', rating: 5, comment: 'Really helpful sessions, learned a lot about system design.', createdAt: new Date().toISOString() },
  alumni: null,
});
dsQueryClient.setQueryData(['mentorship', 'feedback', 'req-pending'], { student: null, alumni: null });

export function AlreadySubmitted() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <FeedbackSection requestId="req-submitted" authorRole="student" />
    </div>
  );
}

export function PromptToLeaveFeedback() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <FeedbackSection requestId="req-pending" authorRole="alumni" />
    </div>
  );
}
