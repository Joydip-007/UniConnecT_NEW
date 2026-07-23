import { InviteMemberModal, dsQueryClient } from 'web';


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

const group = {
  id: 'grp-cs-club',
  name: 'CS Club — UIU',
  type: 'club' as const,
  description: 'Weekly workshops, hackathons, and a community for anyone into building things.',
  avatarUrl: null,
  coverUrl: null,
  isPrivate: false,
  memberCount: 482,
  isMember: true,
  userRole: 'owner' as const,
  allowedRole: null,
  isSystem: false,
  department: null,
  createdBy: 'user-1',
};

// Modal composes its own search-results useQuery — seed the exact key/shape the
// component fetches (queryKey includes group.id, the debounced search string, and allowedRole).
dsQueryClient.setQueryData(['groups', 'invite-search', group.id, 'ta', null], {
  items: [
    {
      id: 'u-tahmid',
      email: 'tahmid.rahman@uiu.ac.bd',
      role: 'student',
      profile: { fullName: 'Tahmid Rahman', avatarUrl: null, department: 'CSE', headline: 'CS undergrad' },
    },
    {
      id: 'u-tania',
      email: 'tania.islam@uiu.ac.bd',
      role: 'faculty',
      profile: { fullName: 'Tania Islam', avatarUrl: null, department: 'CSE', headline: 'Assistant Professor' },
    },
  ],
  total: 2,
  page: 1,
  limit: 10,
});

export function SearchResults() {
  return (
    <div style={{ padding: 40, background: 'var(--surface-page)', minHeight: 500 }}>
      <InviteMemberModal group={group} onClose={() => {}} />
    </div>
  );
}
