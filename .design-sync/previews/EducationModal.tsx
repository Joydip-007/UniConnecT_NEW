import { EducationModal } from 'web';


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
      <EducationModal userId="user-1" onClose={() => {}} />
    </div>
  );
}

export function EditExisting() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <EducationModal
        userId="user-1"
        onClose={() => {}}
        entry={{
          id: 'edu-1',
          userId: 'user-1',
          institution: 'United International University',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Computer Science and Engineering',
          startYear: 2020,
          endYear: 2024,
          grade: '3.82 / 4.00',
          description: 'Dean’s list for four consecutive semesters. Active member of the ACM student chapter.',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }}
      />
    </div>
  );
}
