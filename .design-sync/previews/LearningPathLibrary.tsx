import { LearningPathLibrary } from 'web';

// The "Learning paths" tab of the admin Learning screen: filter chips derived from
// the data, the two create actions, and the two-column card grid. Pure props — no
// query seeding needed.

const noop = () => {};

const path = (
  id: string,
  title: string,
  category: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  isPublished: boolean,
  extra: Partial<Parameters<typeof LearningPathLibrary>[0]['paths'][number]> = {},
) => ({
  id,
  title,
  description: null,
  department: 'CSE',
  category,
  difficulty,
  estimatedDays: 21,
  isPublished,
  source: 'manual' as const,
  unitCount: 8,
  enrolledCount: 124,
  completedCount: 61,
  completionRate: 0.49,
  // The capture clock is frozen at 2024-05-15T12:00:00Z, so relative times only
  // read sensibly for dates shortly BEFORE that.
  updatedAt: new Date('2024-05-13T10:00:00Z').toISOString(),
  ...extra,
});

const PATHS = [
  path('p1', 'Backend fundamentals with Node.js', 'technical', 'beginner', true, {
    unitCount: 12,
    enrolledCount: 318,
    completedCount: 201,
    completionRate: 0.63,
  }),
  path('p2', 'Technical interview preparation', 'career', 'intermediate', true, {
    unitCount: 9,
    enrolledCount: 246,
    completedCount: 98,
    completionRate: 0.4,
    source: 'ai' as const,
    updatedAt: new Date('2024-05-09T10:00:00Z').toISOString(),
  }),
  path('p3', 'Presenting your final year project', 'communication', 'beginner', true, {
    unitCount: 6,
    enrolledCount: 152,
    completedCount: 121,
    completionRate: 0.8,
    updatedAt: new Date('2024-04-28T10:00:00Z').toISOString(),
  }),
  path('p4', 'Reading research papers', 'research', 'advanced', false, {
    unitCount: 7,
    enrolledCount: 0,
    completedCount: 0,
    completionRate: 0,
  }),
];

export function Library() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 820, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LearningPathLibrary
        paths={PATHS}
        isLoading={false}
        onCreatePath={noop}
        onDraftWithAi={noop}
        onEditPath={noop}
        onManagePath={noop}
      />
    </div>
  );
}

export function Loading() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 820, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LearningPathLibrary
        paths={[]}
        isLoading
        onCreatePath={noop}
        onDraftWithAi={noop}
        onEditPath={noop}
        onManagePath={noop}
      />
    </div>
  );
}

export function NoPathsYet() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 820, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LearningPathLibrary
        paths={[]}
        isLoading={false}
        onCreatePath={noop}
        onDraftWithAi={noop}
        onEditPath={noop}
        onManagePath={noop}
      />
    </div>
  );
}
