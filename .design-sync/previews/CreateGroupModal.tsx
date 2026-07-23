import { CreateGroupModal } from 'web';


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

// CreateGroupModal reads useAuthStore().user for role-based field locking, but
// no props depend on it beyond that — the store's dev-auth mock user (a
// non-student role) is enough for the full form to render, including alumni/
// faculty membership options. Uses <Modal isOpen> internally, always visible.

export function Open() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <CreateGroupModal onClose={() => {}} />
    </div>
  );
}
