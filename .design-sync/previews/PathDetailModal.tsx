import { PathDetailModal, dsQueryClient } from 'web';


// Force framer-motion's useReducedMotion() to true so animated enter/exit
// transitions render already-settled — otherwise capture can land mid-animation
// (e.g. Modal.tsx's opacity:0 initial state) and screenshot a blank frame.
if (typeof window !== 'undefined') {
  const mql = {
    matches: true,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  window.matchMedia = (() => mql) as typeof window.matchMedia;
}

// PathDetailModal fetches via usePath(pathId), keyed ['learning', 'path', { pathId }].
const activePathId = 'path-data-structures';
dsQueryClient.setQueryData(['learning', 'path', { pathId: activePathId }], {
  id: activePathId,
  title: 'Data Structures & Algorithms',
  description: 'Master the core data structures and algorithms asked in technical interviews.',
  category: 'programming',
  difficulty: 'intermediate',
  estimated_days: 30,
  badge_name: 'Algorithm Ace',
  badge_icon: null,
  unitCount: 4,
  enrolledCount: 512,
  enrollment: { status: 'active' },
  units: [
    { id: 'u1', display_order: 1, title: 'Arrays and strings', type: 'read', completed: true },
    { id: 'u2', display_order: 2, title: 'Linked lists', type: 'read', completed: true },
    { id: 'u3', display_order: 3, title: 'Stacks and queues quiz', type: 'quiz', completed: false },
    { id: 'u4', display_order: 4, title: 'Trees and graphs', type: 'read', completed: false },
  ],
});

const completedPathId = 'path-git-github';
dsQueryClient.setQueryData(['learning', 'path', { pathId: completedPathId }], {
  id: completedPathId,
  title: 'Git & GitHub Essentials',
  description: 'Version control workflows every developer needs to know.',
  category: 'programming',
  difficulty: 'beginner',
  estimated_days: 7,
  badge_name: 'Git Master',
  badge_icon: null,
  unitCount: 3,
  enrolledCount: 890,
  enrollment: { status: 'completed' },
  units: [
    { id: 'g1', display_order: 1, title: 'Git basics', type: 'read', completed: true },
    { id: 'g2', display_order: 2, title: 'Branching and merging', type: 'read', completed: true },
    { id: 'g3', display_order: 3, title: 'GitHub collaboration quiz', type: 'quiz', completed: true },
  ],
});

const notEnrolledPathId = 'path-advanced-sql';
dsQueryClient.setQueryData(['learning', 'path', { pathId: notEnrolledPathId }], {
  id: notEnrolledPathId,
  title: 'Advanced SQL',
  description: 'Window functions, query optimization, and database design patterns.',
  category: 'databases',
  difficulty: 'advanced',
  estimated_days: 14,
  badge_name: null,
  badge_icon: null,
  unitCount: 2,
  enrolledCount: 210,
  enrollment: null,
  units: [
    { id: 's1', display_order: 1, title: 'Window functions', type: 'read', completed: false },
    { id: 's2', display_order: 2, title: 'Query optimization', type: 'read', completed: false },
  ],
});

export function InProgressWithNextUnit() {
  return (
    <div style={{ padding: 40, background: 'var(--surface-page)', minHeight: 500 }}>
      <PathDetailModal pathId={activePathId} open onClose={() => {}} />
    </div>
  );
}

export function CompletedWithBadge() {
  return (
    <div style={{ padding: 40, background: 'var(--surface-page)', minHeight: 500 }}>
      <PathDetailModal pathId={completedPathId} open onClose={() => {}} />
    </div>
  );
}

export function NotEnrolledYet() {
  return (
    <div style={{ padding: 40, background: 'var(--surface-page)', minHeight: 500 }}>
      <PathDetailModal pathId={notEnrolledPathId} open onClose={() => {}} />
    </div>
  );
}
