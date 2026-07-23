import { ExperienceModal } from 'web';


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

export function AddNew() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <ExperienceModal userId="user-1" onClose={() => {}} />
    </div>
  );
}

export function EditExisting() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <ExperienceModal
        userId="user-1"
        onClose={() => {}}
        entry={{
          id: 'exp-1',
          userId: 'user-1',
          title: 'Software Engineering Intern',
          company: 'Brain Station 23',
          location: 'Dhaka, Bangladesh',
          startDate: '2024-05-01T00:00:00.000Z',
          endDate: null,
          description: 'Building internal tooling for the QA automation team using TypeScript and Playwright.',
          createdAt: '2024-05-01T00:00:00.000Z',
          updatedAt: '2024-05-01T00:00:00.000Z',
        }}
      />
    </div>
  );
}
