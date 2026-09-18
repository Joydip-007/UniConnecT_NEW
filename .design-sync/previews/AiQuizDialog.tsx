import { AiQuizDialog } from 'web';

const PATHS = [
  { id: 'p1', title: 'Backend fundamentals with Node.js' },
  { id: 'p2', title: 'Technical interview preparation' },
  { id: 'p3', title: 'Reading research papers' },
].map((p) => ({
  ...p,
  description: null,
  department: 'CSE',
  category: 'technical',
  difficulty: 'beginner' as const,
  estimatedDays: 21,
  isPublished: true,
  source: 'manual' as const,
  unitCount: 8,
  enrolledCount: 120,
  completedCount: 40,
  completionRate: 0.33,
  updatedAt: '2024-05-13T10:00:00Z',
}));

// "Generate quiz with AI": picks a path, question count, style and difficulty.
export function Open() {
  return <AiQuizDialog open paths={PATHS} onClose={() => {}} />;
}
