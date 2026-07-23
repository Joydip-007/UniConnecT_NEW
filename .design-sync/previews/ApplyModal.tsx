import { ApplyModal } from 'web';


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

export function ReadyToUpload() {
  return (
    <div style={{ padding: 40, background: 'var(--surface-page)', minHeight: 500 }}>
      <ApplyModal
        jobId="job-pathao-fe"
        jobTitle="Frontend Engineering Intern"
        company="Pathao Bangladesh"
        onSuccess={() => {}}
        onClose={() => {}}
      />
    </div>
  );
}
