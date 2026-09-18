import { AdminQuizList } from 'web';

// The "Quizzes" tab: filter chips, the two create actions, and one row per quiz
// with status pill, source label and the primary/secondary actions that depend
// on whether the quiz is live.

const noop = () => {};
const q = (id: string, title: string, pathTitle: string, status: 'published' | 'draft' | 'needs_review' | 'scheduled', extra = {}) => ({
  id,
  kind: 'path_unit' as const,
  title,
  pathId: 'p1',
  pathTitle,
  questionCount: 10,
  passMark: 60,
  attempts: 0,
  avgScore: null as number | null,
  status,
  source: 'staff' as const,
  updatedAt: '2024-05-13T10:00:00Z',
  ...extra,
});

const QUIZZES = [
  q('q1', 'Sorting and complexity checkpoint', 'Backend fundamentals with Node.js', 'published', { attempts: 412, avgScore: 71 }),
  q('q2', 'Process scheduling and memory', 'Operating systems', 'needs_review', { kind: 'ai_batch' as const, source: 'ai' as const, questionCount: 8 }),
  q('q3', 'Behavioural interview warm-up', 'Technical interview preparation', 'draft', { questionCount: 6 }),
  q('q4', 'CSE weekly daily quiz', 'CSE', 'scheduled', { kind: 'daily_slot' as const, pathId: null, source: 'ai' as const }),
];

const frame = { padding: 16, background: 'var(--surface-page)', width: 820, display: 'flex', flexDirection: 'column' as const, gap: 14 };

export function Quizzes() {
  return (
    <div style={frame}>
      <AdminQuizList quizzes={QUIZZES} isLoading={false} onGenerateWithAi={noop} onNewQuiz={noop} onSecondary={noop} onPrimary={noop} />
    </div>
  );
}

export function Empty() {
  return (
    <div style={frame}>
      <AdminQuizList quizzes={[]} isLoading={false} onGenerateWithAi={noop} onNewQuiz={noop} onSecondary={noop} onPrimary={noop} />
    </div>
  );
}
