import { TodayCard } from 'web';

const readUnit = {
  id: 'unit-read-1',
  display_order: 1,
  title: 'Understanding REST API design principles',
  type: 'read' as const,
  completed: false,
  content: { body: 'REST APIs organize resources around nouns, not verbs.\nUse HTTP methods to express intent: GET, POST, PATCH, DELETE.' },
};

const quizUnit = {
  id: 'unit-quiz-1',
  display_order: 2,
  title: 'Quiz: Database indexing basics',
  type: 'quiz' as const,
  completed: false,
  content: { questions: [{ q: 'What does a B-tree index optimize for?', options: ['Range queries', 'Random writes'], answer: 0 }] },
};

export function ReadUnit() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <TodayCard entry={{ pathId: 'path-1', unit: readUnit, completedToday: false }} pathTitle="Backend fundamentals" />
    </div>
  );
}

export function QuizUnit() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <TodayCard entry={{ pathId: 'path-2', unit: quizUnit, completedToday: false }} pathTitle="Data structures & algorithms" onQuizStart={() => {}} />
    </div>
  );
}

export function CompletedToday() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <TodayCard entry={{ pathId: 'path-1', unit: readUnit, completedToday: true }} pathTitle="Backend fundamentals" />
    </div>
  );
}

export function NoPathTitle() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <TodayCard
        entry={{
          pathId: 'path-3',
          unit: { ...readUnit, id: 'unit-video-1', type: 'video', title: 'Watch: How caching layers scale reads' },
          completedToday: false,
        }}
      />
    </div>
  );
}
