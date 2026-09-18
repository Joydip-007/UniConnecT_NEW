import { AdminQuizPreviewDialog, dsQueryClient } from 'web';

// "Results" / "Preview" for a Quizzes-tab row. Reads its questions through a
// parameterised query key, so two rows can be seeded side by side.

const QUESTIONS = {
  questions: [
    { q: 'Which scheduler favours the shortest remaining job?', options: ['FCFS', 'SRTF', 'Round robin', 'Priority'], answer: 1 },
    { q: 'A page fault happens when…', options: ['the TLB is full', 'a page is not in RAM', 'the disk is busy', 'a process forks'], answer: 1 },
    { q: 'Which is NOT a deadlock condition?', options: ['Mutual exclusion', 'Hold and wait', 'Preemption', 'Circular wait'], answer: 2 },
  ],
};
dsQueryClient.setQueryData(['learning-admin', 'quiz-questions', { kind: 'ai_batch', id: 'q1' }], QUESTIONS);
dsQueryClient.setQueryData(['learning-admin', 'quiz-questions', { kind: 'path_unit', id: 'q2' }], QUESTIONS);

const base = { pathId: 'p1', pathTitle: 'Operating systems', questionCount: 3, passMark: 60, updatedAt: '2024-05-13T10:00:00Z' };

export function NeedsReview() {
  return (
    <AdminQuizPreviewDialog
      quiz={{ ...base, id: 'q1', kind: 'ai_batch', title: 'Process scheduling and memory', attempts: 0, avgScore: null, status: 'needs_review', source: 'ai' }}
      onClose={() => {}}
    />
  );
}

export function LiveResults() {
  return (
    <AdminQuizPreviewDialog
      quiz={{ ...base, id: 'q2', kind: 'path_unit', title: 'Process scheduling and memory', attempts: 412, avgScore: 71, status: 'published', source: 'staff' }}
      onClose={() => {}}
    />
  );
}
