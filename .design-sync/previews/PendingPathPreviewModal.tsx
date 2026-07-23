import { PendingPathPreviewModal, dsQueryClient } from 'web';


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

const pathDetail = {
  id: 'pending-path-1',
  title: 'Intro to distributed systems',
  description: 'A short path covering consensus, replication, and partition tolerance for backend engineers.',
  category: 'Systems',
  difficulty: 'intermediate',
  estimated_days: 5,
  created_at: new Date().toISOString(),
  units: [
    {
      id: 'u1',
      display_order: 1,
      title: 'What is a distributed system?',
      type: 'read' as const,
      content: { body: 'A distributed system is a collection of independent computers that appear to users as a single system.' },
      completion_rule: null,
    },
    {
      id: 'u2',
      display_order: 2,
      title: 'Quiz: CAP theorem',
      type: 'quiz' as const,
      content: {
        questions: [
          { q: 'CAP theorem says you can only pick two of which three?', options: ['Consistency, Availability, Partition tolerance', 'Cost, Accuracy, Performance'], answer: 0 },
        ],
      },
      completion_rule: { passScore: 70 },
    },
  ],
};

dsQueryClient.setQueryData(['learning-admin', 'pending-path', 'pending-path-1'], pathDetail);

export function Default() {
  return <PendingPathPreviewModal pathId="pending-path-1" open onClose={() => {}} />;
}

export function LoadingState() {
  return <PendingPathPreviewModal pathId="pending-path-loading" open onClose={() => {}} />;
}
