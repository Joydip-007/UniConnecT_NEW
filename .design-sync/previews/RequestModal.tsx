import { RequestModal } from 'web';


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

const alumni = {
  id: 'alum-1',
  universityId: 'uni-1',
  fullName: 'Nadia Islam',
  headline: 'Senior Software Engineer at Brain Station 23',
  department: 'CSE',
  batchYear: '181',
  skills: ['React', 'Node.js'],
  avatarUrl: null,
  maxMentees: 3,
  currentMentees: 1,
};

export function Default() {
  return <RequestModal alumni={alumni} onClose={() => {}} onSuccess={() => {}} />;
}

export function NoHeadline() {
  return <RequestModal alumni={{ ...alumni, id: 'alum-2', headline: null }} onClose={() => {}} onSuccess={() => {}} />;
}
