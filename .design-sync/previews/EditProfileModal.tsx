import { EditProfileModal } from 'web';


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

// EditProfileModal reads from useAuthStore().user, not props. An attempt to
// seed it via a `useAuthStore` extraEntries export (mirroring dsQueryClient)
// was tried and reverted — esbuild bundles extraEntries as a separate module
// graph from the component synth-entry, so the two `useAuthStore` references
// are different zustand store instances (confirmed: the built bundle contains
// two separate `create(...)` calls, one renamed `useAuthStore2`). Unlike
// TanStack Query, zustand has no context/provider layer to unify them, so this
// needs a real build-system fix (single shared esbuild module graph across all
// entries), not a preview-authoring workaround — see NOTES.md systemic issue #5.

export function Open() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <EditProfileModal onClose={() => {}} />
    </div>
  );
}
