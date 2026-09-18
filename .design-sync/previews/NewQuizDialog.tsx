import { NewQuizDialog } from 'web';

const PATHS = [
  { id: 'p1', title: 'Backend fundamentals with Node.js' },
  { id: 'p2', title: 'Technical interview preparation' },
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

// Staff-written quiz: same chrome as the AI dialog, one blank question to start.
export function Open() {
  return <NewQuizDialog open paths={PATHS} onClose={() => {}} />;
}
