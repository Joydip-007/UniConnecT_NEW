import { http, HttpResponse } from 'msw';

export const learningFixtures = {
  paths: [
    {
      id: 'path-1',
      title: 'Git basics',
      description: 'Learn version control',
      category: 'engineering',
      difficulty: 'beginner' as const,
      estimated_days: 5,
      badge_name: 'Git novice',
      badge_icon: 'git',
      unitCount: 3,
      enrolledCount: 12,
      myEnrollmentStatus: null,
      completedUnitCount: 0,
      nextUnitTitle: null,
    },
  ],
  pathDetail: {
    id: 'path-1',
    title: 'Git basics',
    description: 'Learn version control',
    category: 'engineering',
    difficulty: 'beginner' as const,
    estimated_days: 5,
    badge_name: 'Git novice',
    badge_icon: 'git',
    unitCount: 3,
    enrolledCount: 12,
    units: [
      { id: 'unit-1', display_order: 1, title: 'Intro', type: 'read' as const, completed: false },
    ],
    enrollment: null,
  },
  today: [
    {
      pathId: 'path-1',
      unit: { id: 'unit-1', display_order: 1, title: 'Intro', type: 'read' as const, completed: false },
      completedToday: false,
    },
  ],
  stats: {
    currentStreak: 3,
    longestStreak: 7,
    lastActivityDate: '2026-07-03',
    freezesRemaining: 2,
  },
  badges: [
    {
      id: 'badge-1',
      name: 'Git novice',
      description: 'Completed Git basics',
      iconUrl: null,
      category: 'path' as const,
      points: 10,
      rarity: 'common' as const,
      isShowcased: false,
      awardedAt: '2026-07-01T00:00:00.000Z',
      skillPathId: 'path-1',
    },
  ],
  completeUnitResult: {
    completed: true,
    pathCompleted: false,
    streak: { currentStreak: 4, longestStreak: 7 },
  },
  quizzes: [
    {
      unitId: 'unit-q', pathId: 'path-1', pathTitle: 'Git basics', title: 'Checkpoint: recovering a repo',
      summary: 'Two questions on reflog.', questionCount: 2, passScore: 70, state: 'locked' as const,
      pathStarted: false, blockedByTitle: null, attemptCount: 0, bestScore: null, lastScore: null, passed: false,
    },
  ],
  attempts: [] as unknown[],
  badgeProgress: [] as unknown[],
};

export const handlers = [
  http.get('*/learning/paths', () => HttpResponse.json({ data: learningFixtures.paths })),
  http.get('*/learning/paths/:pathId', () => HttpResponse.json({ data: learningFixtures.pathDetail })),
  http.post('*/learning/paths/:pathId/enroll', () => HttpResponse.json({ data: {} })),
  http.post('*/learning/paths/:pathId/abandon', () => HttpResponse.json({ data: {} })),
  http.get('*/learning/me/today', () => HttpResponse.json({ data: learningFixtures.today })),
  http.get('*/learning/me/stats', () => HttpResponse.json({ data: learningFixtures.stats })),
  http.get('*/learning/me/badges', () => HttpResponse.json({ data: learningFixtures.badges })),
  http.put('*/learning/me/badges/showcase', () => HttpResponse.json({ data: {} })),
  http.get('*/learning/users/:userId/badges', () => HttpResponse.json({ data: learningFixtures.badges })),
  http.post('*/learning/units/:unitId/complete', () => HttpResponse.json({ data: learningFixtures.completeUnitResult })),
  http.get('*/learning/me/quizzes', () => HttpResponse.json({ data: learningFixtures.quizzes })),
  http.get('*/learning/units/:unitId/attempts', () => HttpResponse.json({ data: learningFixtures.attempts })),
  http.get('*/learning/me/badges/progress', () => HttpResponse.json({ data: learningFixtures.badgeProgress })),
  http.put('*/learning/me/badges/:badgeId/pin', () => HttpResponse.json({ data: { success: true } })),
];
