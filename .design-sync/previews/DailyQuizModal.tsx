import { DailyQuizModal } from 'web';


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

const SLOT = {
  id: 'quiz-slot-1',
  department: 'Computer Science & Engineering',
  date: '2026-07-17',
  questions: [
    {
      q: 'Which data structure uses LIFO (Last In, First Out) ordering?',
      options: ['Queue', 'Stack', 'Linked list', 'Heap'],
    },
    {
      q: 'What does SQL stand for?',
      options: [
        'Structured Query Language',
        'Sequential Query Logic',
        'Simple Query Language',
        'System Query Layer',
      ],
    },
    {
      q: 'Big-O notation for binary search on a sorted array is:',
      options: ['O(n)', 'O(n log n)', 'O(log n)', 'O(1)'],
    },
  ],
  myAttempt: null,
};

export function InProgress() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <DailyQuizModal slot={SLOT} open onClose={() => {}} />
    </div>
  );
}
