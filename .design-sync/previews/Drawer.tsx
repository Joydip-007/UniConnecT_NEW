import { Drawer } from 'web';


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

export function Default() {
  return (
    <Drawer isOpen onClose={() => {}} title="Filter jobs">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Filter jobs
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Choose the criteria below to narrow down the job listings shown in your feed.
        </p>
        <button
          type="button"
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: 'var(--uc-orange)',
            color: 'var(--uc-orange-l)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Apply filters
        </button>
      </div>
    </Drawer>
  );
}
