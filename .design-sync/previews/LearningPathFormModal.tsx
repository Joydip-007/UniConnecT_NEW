import { LearningPathFormModal } from 'web';

// Create/edit dialog for path metadata. Rendered open in single-card mode.

export function Edit() {
  return (
    <LearningPathFormModal
      mode="edit"
      open
      onClose={() => {}}
      path={{
        id: 'p1',
        title: 'Backend fundamentals with Node.js',
        description: 'HTTP, Express, Postgres and deployment, from zero to a shipped API.',
        department: 'CSE',
        category: 'technical',
        difficulty: 'beginner',
        estimatedDays: 21,
        isPublished: true,
        source: 'manual',
        unitCount: 12,
        enrolledCount: 318,
        completedCount: 201,
        completionRate: 0.63,
        updatedAt: '2024-05-13T10:00:00Z',
      }}
    />
  );
}

export function Create() {
  return <LearningPathFormModal mode="create" open path={null} onClose={() => {}} />;
}
