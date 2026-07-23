import { CreateNewsForm } from 'web';


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

export function Create() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <CreateNewsForm onClose={() => {}} />
    </div>
  );
}

export function EditExisting() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <CreateNewsForm
        onClose={() => {}}
        initial={{
          id: 'news-104',
          title: 'University hosts annual career fair this Thursday',
          body: 'Over 40 companies will be on campus for this year’s career fair, including regional employers in tech, finance, and NGOs. Students are encouraged to bring printed resumes and dress in business casual attire.',
          category: 'events',
          coverUrl: null,
          isPublished: true,
          attachments: [],
        }}
      />
    </div>
  );
}
