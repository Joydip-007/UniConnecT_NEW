import { EditProfileModal, useAuthStore } from 'web';


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

// EditProfileModal reads from useAuthStore().user, not props, and returns null
// without one. Seed the store from the SHARED 'web' export, which re-exports it
// from inside the synth entry (src/components/ds-auth-store.tsx) — that is the
// same store instance the component subscribes to.
//
// Seeding via `extraEntries` does NOT work and should not be retried: the synth
// entry reaches every file through the apps/web/node_modules/web symlink and
// `@/`-alias imports resolve against that same prefix, but esbuild realpaths an
// extraEntries path to apps/web/src/... — a textually different path for the
// same file, so zustand's create() runs twice and the exported store is not the
// one components read.
//
// setState, not setAuth(): the latter writes localStorage and opens a socket.
useAuthStore.setState({
  isLoading: false,
  accessToken: 'ds-preview-token',
  user: {
    id: 'u-nabila',
    username: 'nabila',
    email: 'nabila@uiu.ac.bd',
    role: 'student',
    universityId: 'uni-uiu',
    isVerified: true,
    themePreference: 'dark',
    profile: {
      fullName: 'Nabila Rahman',
      bio: 'Final-year CSE student. Interested in design systems and accessible interfaces.',
      avatarUrl: null,
      coverUrl: null,
      headline: 'CSE undergrad, batch 2026',
      department: 'Computer Science & Engineering',
      batchYear: '2026',
      linkedinUrl: 'https://linkedin.com/in/nabila-rahman',
      phone: null,
      skills: ['React', 'TypeScript', 'Figma'],
      isOpenToWork: true,
      isOpenToMentorship: false,
      mentorshipPoints: 0,
      maxMentees: 3,
      location: 'Dhaka, Bangladesh',
      websiteUrl: null,
      githubUrl: 'https://github.com/nabila',
      portfolioUrl: null,
      isOpenToMsg: true,
    },
  },
});

export function Open() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <EditProfileModal onClose={() => {}} />
    </div>
  );
}
