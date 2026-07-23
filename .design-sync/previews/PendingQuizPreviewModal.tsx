import { PendingQuizPreviewModal, dsQueryClient } from 'web';


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

const batchDetail = {
  id: 'batch-1',
  department: 'Computer Science',
  generated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  questions: [
    { q: 'Which data structure uses LIFO ordering?', options: ['Stack', 'Queue', 'Linked list', 'Tree'], answer: 0 },
    { q: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], answer: 1 },
  ],
};

dsQueryClient.setQueryData(['learning-admin', 'pending-quiz-batch', 'batch-1'], batchDetail);

export function Default() {
  return <PendingQuizPreviewModal batchId="batch-1" open onClose={() => {}} />;
}

export function LoadingState() {
  return <PendingQuizPreviewModal batchId="batch-loading" open onClose={() => {}} />;
}
