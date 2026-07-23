import { QuizModal } from 'web';


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

const quizUnit = {
  id: 'unit-stacks-quiz',
  display_order: 3,
  title: 'Stacks and queues quiz',
  type: 'quiz' as const,
  completed: false,
  content: {
    questions: [
      {
        q: 'Which structure follows Last-In-First-Out (LIFO) ordering?',
        options: ['Queue', 'Stack', 'Linked list', 'Binary tree'],
        answer: 1,
      },
      {
        q: 'What is the time complexity of enqueue in a well-implemented queue?',
        options: ['O(n)', 'O(log n)', 'O(1)', 'O(n^2)'],
        answer: 2,
      },
    ],
  },
  completion_rule: { passScore: 70 },
};

export function QuestionsUnanswered() {
  return (
    <div style={{ padding: 40, background: 'var(--surface-page)', minHeight: 500 }}>
      <QuizModal unit={quizUnit} open onClose={() => {}} />
    </div>
  );
}
