import { useEffect } from 'react';
import { NewConversationModal, dsQueryClient } from 'web';


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

const searchResults = [
  { id: 'u1', fullName: 'Nadia Islam', role: 'alumni', profile: { fullName: 'Nadia Islam', avatarUrl: null, headline: 'Senior Software Engineer', department: null } },
  { id: 'u2', fullName: 'Rafiul Karim', role: 'student', profile: { fullName: 'Rafiul Karim', avatarUrl: null, headline: null, department: 'CSE' } },
  { id: 'u3', fullName: 'Dr. Shamim Reza', role: 'faculty', profile: { fullName: 'Dr. Shamim Reza', avatarUrl: null, headline: null, department: 'CSE' } },
];

// Pre-seed a couple of plausible debounced search-query keys since the modal only
// fires the /users search once the (internal, debounced) query state reaches 2+ chars —
// seeding the cache lets a canvas-typed query resolve instantly instead of showing empty state.
dsQueryClient.setQueryData(['users', 'search', 'na'], searchResults);
dsQueryClient.setQueryData(['users', 'search', 'nad'], searchResults);

function AutoType({ text }: { text: string }) {
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Search people"]');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function Default() {
  return <NewConversationModal onClose={() => {}} />;
}

export function SearchResults() {
  return (
    <>
      <AutoType text="na" />
      <NewConversationModal onClose={() => {}} />
    </>
  );
}
