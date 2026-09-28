/**
 * DEV-ONLY Learn page data for the `?dev-auth=1` screenshot flow. Mirrors the sample content
 * in `Learn Page.dc.html` so captures show the designed states: two active paths with work
 * left today, a finished path, three not started, checkpoint quizzes in every state, and a
 * badge shelf with tiers and pins.
 */

type Kind = 'read' | 'video' | 'quiz'
type UnitSeed = [title: string, kind: Kind, minutes: number, summary: string]

interface PathSeed {
  id: string
  title: string
  description: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  days: number
  badge: string | null
  status: 'active' | 'completed' | null
  completed: number
  units: UnitSeed[]
}

const QUIZ: Record<string, { q: string; options: string[]; answer: number }[]> = {
  'Checkpoint: complexity classes': [
    { q: 'Average-case cost of a single push onto a doubling dynamic array?', options: ['O(1) amortised', 'O(n) always', 'O(log n)', 'O(n log n)'], answer: 0 },
    { q: 'Which sort is stable and O(n log n) in the worst case?', options: ['Quicksort', 'Merge sort', 'Heapsort', 'Selection sort'], answer: 1 },
  ],
  'Checkpoint: recovering a repo': [
    { q: 'Which command finds a commit you lost after a bad reset?', options: ['git log', 'git reflog', 'git status', 'git blame'], answer: 1 },
    { q: 'Before force-pushing a shared branch, use…', options: ['--force', '--force-with-lease', '--no-verify', '--all'], answer: 1 },
  ],
}

const SEEDS: PathSeed[] = [
  {
    id: 'dev-lp1', title: 'Algorithms, properly', category: 'technical', difficulty: 'intermediate', days: 24, badge: 'Algorithmist', status: 'active', completed: 5,
    description: 'Sorting, greedy proofs, dynamic programming and the analysis habits that make interviews boring.',
    units: [
      ['Big-O without the hand-waving', 'video', 8, 'Read growth rates straight off loops and recursion, without memorising a table.'],
      ['Sorting: what actually gets used', 'video', 10, 'Why standard libraries ship Timsort and introsort, and when that choice matters to you.'],
      ['Amortised analysis in plain words', 'read', 7, 'Total cost over a sequence of operations, worked through with a doubling dynamic array.'],
      ['Divide and conquer patterns', 'video', 12, 'Split, solve, merge: the master theorem applied to three problems you will meet in interviews.'],
      ['Checkpoint: complexity classes', 'quiz', 0, 'Two questions on amortised cost and stable sorting.'],
      ['Greedy proofs', 'video', 11, 'The exchange argument: how to show a greedy choice never does worse than the optimum.'],
      ['Dynamic programming: tables', 'read', 14, 'Turn a recursive definition into a table, then shrink the table to a single row.'],
      ['Checkpoint: greedy vs DP', 'quiz', 0, 'Decide which technique fits each problem.'],
    ],
  },
  {
    id: 'dev-lp2', title: 'Interview readiness', category: 'career', difficulty: 'beginner', days: 14, badge: 'Ready to hire', status: 'active', completed: 2,
    description: 'CV, portfolio, behavioural answers and a mock loop with an alum reviewer.',
    units: [
      ['A CV summary in two lines', 'read', 6, 'What a recruiter reads in the first six seconds, and how to make those two lines count.'],
      ['Portfolio projects that get read', 'video', 9, 'Pick three projects, lead with the problem, and show the result before the stack.'],
      ['Behavioural answers with STAR', 'video', 8, 'Situation, task, action, result: a structure that keeps answers under two minutes.'],
      ['Checkpoint: behavioural answers', 'quiz', 0, 'Two questions on structuring and pacing an answer.'],
      ['Running a mock loop', 'video', 12, 'Book an alum reviewer, run three rounds, and turn their notes into a practice list.'],
      ['Following up after an interview', 'read', 5, 'A short thank-you that adds one thing you forgot to say.'],
    ],
  },
  {
    id: 'dev-lp3', title: 'Git for group projects', category: 'technical', difficulty: 'beginner', days: 9, badge: 'Merge master', status: 'completed', completed: 5,
    description: 'Branches, rebases and the four commands that recover a broken final-year repo.',
    units: [
      ['Branches without fear', 'read', 7, 'One branch per feature, and how to keep it close to main.'],
      ['Rebase vs merge', 'video', 9, "When a clean history helps your group, and when it rewrites someone else's work."],
      ['Resolving conflicts in a shared repo', 'video', 10, 'Read conflict markers, decide which side wins, and test before you commit.'],
      ['Recovering with reflog', 'read', 6, 'Every commit you had is still there for a while. Here is how to find it.'],
      ['Checkpoint: recovering a repo', 'quiz', 0, 'Two questions on reflog and safe force-pushing.'],
    ],
  },
  {
    id: 'dev-lp4', title: 'Applied machine learning', category: 'technical', difficulty: 'advanced', days: 30, badge: 'Model builder', status: null, completed: 0,
    description: 'From pandas to a deployed model, with the maths kept to what you actually use.',
    units: [
      ['pandas for real datasets', 'video', 12, 'Load, clean and reshape a messy CSV without writing loops.'],
      ["Train/test splits that don't leak", 'read', 9, 'Why preprocessing belongs inside the split, and how leakage inflates your score.'],
      ['Baselines before models', 'read', 8, 'Beat the dumbest possible predictor first, then earn the complexity.'],
      ['Checkpoint: model evaluation', 'quiz', 0, 'Two questions on leakage and imbalanced metrics.'],
      ['Shipping a model behind an API', 'video', 14, 'Serialise the model, wrap it in a small endpoint, and log what it predicts.'],
    ],
  },
  {
    id: 'dev-lp5', title: 'Technical writing', category: 'communication', difficulty: 'beginner', days: 12, badge: null, status: null, completed: 0,
    description: 'Documentation, thesis chapters and commit messages a reviewer can follow.',
    units: [
      ['Writing for a reviewer', 'read', 7, 'Start with the claim, then the evidence. Your reviewer has twenty other documents.'],
      ['Structuring a thesis chapter', 'read', 11, 'An outline that survives supervisor comments.'],
      ['Commit messages that explain why', 'read', 5, 'The diff shows what changed. The message should say why.'],
      ['READMEs someone can follow', 'read', 8, 'Install, run, and the one thing that always breaks.'],
    ],
  },
  {
    id: 'dev-lp6', title: 'Public speaking on campus', category: 'communication', difficulty: 'beginner', days: 10, badge: 'Podium', status: null, completed: 0,
    description: 'Structure a five-minute talk, handle questions, present a demo without notes.',
    units: [
      ['Five-minute talk structure', 'video', 8, 'One message, three points, and an ending people remember.'],
      ['Handling questions', 'read', 6, "Repeat the question, answer briefly, and say so when you don't know."],
      ['Demo without notes', 'video', 9, 'Rehearse the path through the demo, and have a recorded fallback.'],
      ['Checkpoint: talk structure', 'quiz', 0, 'Two questions on structure and Q&A.'],
    ],
  },
]

const unitId = (pathId: string, i: number) => `${pathId}-u${i + 1}`

function listRow(p: PathSeed) {
  return {
    id: p.id, title: p.title, description: p.description, category: p.category, difficulty: p.difficulty,
    estimated_days: p.days, badge_name: p.badge, badge_icon: null, unitCount: p.units.length, enrolledCount: 18,
    myEnrollmentStatus: p.status, completedUnitCount: p.completed,
    nextUnitTitle: p.status === 'active' ? p.units[p.completed]?.[0] ?? null : null,
  }
}

function unit(p: PathSeed, i: number) {
  const [title, type, minutes, summary] = p.units[i]
  const completed = i < p.completed
  const unlocked = completed || (p.status === 'active' && i === p.completed)
  const questions = QUIZ[title] ?? [
    { q: `Which idea from "${p.title}" matters most here?`, options: ['The first', 'The second'], answer: 0 },
    { q: 'Ready for the next unit?', options: ['Yes', 'Not yet'], answer: 0 },
  ]
  return {
    id: unitId(p.id, i), display_order: i + 1, title, type, completed, summary,
    minutes: type === 'quiz' ? null : minutes,
    questionCount: type === 'quiz' ? questions.length : 0,
    hasVideo: false,
    content: unlocked ? (type === 'quiz' ? { questions } : { body: `${summary} Work through it at your own pace, then mark it complete.` }) : null,
    completion_rule: type === 'quiz' ? { passScore: 70 } : {},
  }
}

function detail(p: PathSeed) {
  return {
    id: p.id, title: p.title, description: p.description, category: p.category, difficulty: p.difficulty,
    estimated_days: p.days, badge_name: p.badge, badge_icon: null, unitCount: p.units.length, enrolledCount: 18,
    units: p.units.map((_, i) => unit(p, i)),
    enrollment: p.status ? { status: p.status } : null,
  }
}

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA')
}

function attemptsFor(uid: string) {
  const bank = uid === unitId('dev-lp1', 4) ? QUIZ['Checkpoint: complexity classes'] : uid === unitId('dev-lp3', 4) ? QUIZ['Checkpoint: recovering a repo'] : null
  if (!bank) return []
  const runs: [string, number[]][] = uid === unitId('dev-lp1', 4)
    ? [['2026-09-18T15:12:00Z', [0, 1]], ['2026-09-11T14:40:00Z', [1, 1]]]
    : [['2026-09-02T13:05:00Z', [1, 1]]]
  return runs.map(([createdAt, picks], k) => {
    const review = bank.map((q, i) => ({ question: q.q, options: q.options, selectedIndex: picks[i], correctIndex: q.answer, isCorrect: picks[i] === q.answer }))
    const correct = review.filter((r) => r.isCorrect).length
    const score = Math.round((100 * correct) / bank.length)
    return { id: `${uid}-a${k}`, createdAt, score, correctCount: correct, totalQuestions: bank.length, passed: score >= 70, review }
  })
}

function quizzes() {
  return SEEDS.flatMap((p) =>
    p.units.flatMap(([title, type, , summary], i) => {
      if (type !== 'quiz') return []
      const uid = unitId(p.id, i)
      const attempts = attemptsFor(uid)
      const completed = i < p.completed
      const next = p.status === 'active' && i === p.completed
      const best = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null
      return [{
        unitId: uid, pathId: p.id, pathTitle: p.title, title, summary, questionCount: 2, passScore: 70,
        state: completed ? 'completed' : next ? 'next' : 'locked',
        pathStarted: p.status !== null,
        blockedByTitle: !completed && !next && p.status === 'active' ? p.units[p.completed][0] : null,
        attemptCount: attempts.length, bestScore: best, lastScore: attempts[0]?.score ?? null,
        passed: completed || (best !== null && best >= 70),
      }]
    }),
  )
}

function badge(id: string, name: string, triggerType: string, target: number, current: number, earned: boolean, extra: Record<string, unknown> = {}) {
  return {
    id, name, description: null, iconUrl: null, triggerType, skillPathId: null, pathTitle: null, current, target, earned,
    awardedAt: earned ? '2026-09-01T00:00:00Z' : null, pinned: false, pinnedAt: null, heldByPct: 20, ...extra,
  }
}

const BADGES = [
  badge('dev-b-s7', 'Week one', 'streak_milestone', 7, 21, true, { description: 'Kept a 7-day learning streak', pinned: true, heldByPct: 34 }),
  badge('dev-b-s30', 'Scholar', 'streak_milestone', 30, 21, false, { description: 'Kept a 30-day learning streak' }),
  badge('dev-b-s100', 'Centurion', 'streak_milestone', 100, 21, false, { description: 'Kept a 100-day learning streak' }),
  badge('dev-b-u10', 'Curious mind', 'unit_completed', 10, 12, true, { description: 'Completed 10 learning units', heldByPct: 58 }),
  badge('dev-b-u50', 'Deep diver', 'unit_completed', 50, 12, false, { description: 'Completed 50 learning units' }),
  badge('dev-b-q1', 'First answer', 'quiz_win', 1, 3, true, { description: 'Scored 70%+ on a daily campus quiz', heldByPct: 41 }),
  badge('dev-b-q5', 'Quiz streak', 'quiz_win', 5, 3, false, { description: 'Won 5 daily campus quizzes' }),
  badge('dev-b-q20', 'Quiz master', 'quiz_win', 20, 3, false, { description: 'Won 20 daily campus quizzes' }),
  ...SEEDS.filter((p) => p.badge).map((p) =>
    badge(`dev-b-${p.id}`, p.badge as string, 'path_completed', p.units.length, p.completed, p.status === 'completed', {
      skillPathId: p.id, pathTitle: p.title, pinned: p.status === 'completed', heldByPct: 19,
    })),
]

/** Returns the HTTP body to fake for a Learn GET, or null when the URL is not a Learn read. */
export function resolveLearningMock(url: string): unknown | null {
  if (url === '/learning/paths') return { data: SEEDS.map(listRow) }
  const pathMatch = url.match(/^\/learning\/paths\/([^/]+)$/)
  if (pathMatch) {
    const seed = SEEDS.find((p) => p.id === pathMatch[1])
    return seed ? { data: detail(seed) } : null
  }
  if (url === '/learning/me/today') {
    return {
      data: SEEDS.filter((p) => p.status === 'active').map((p) => ({
        pathId: p.id, unit: unit(p, p.completed), completedToday: false,
      })),
    }
  }
  if (url === '/learning/me/stats') {
    return { data: { currentStreak: 12, longestStreak: 21, lastActivityDate: yesterday(), freezesRemaining: 2 } }
  }
  if (url === '/learning/me/quizzes') return { data: quizzes() }
  const attemptsMatch = url.match(/^\/learning\/units\/([^/]+)\/attempts$/)
  if (attemptsMatch) return { data: attemptsFor(attemptsMatch[1]) }
  if (url === '/learning/me/badges/progress') return { data: BADGES }
  return null
}
