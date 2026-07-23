import { NotificationDropdown, dsQueryClient } from 'web';


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

// Matches NOTIF_QUERY_KEY in src/features/notifications/hooks/useNotificationsSocket.ts
const NOTIF_QUERY_KEY = ['notifications', 'unread'] as const;

const NOW = Date.now();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

const UNREAD_NOTIFS = [
  {
    id: 'notif-1',
    content: 'Priya Sharma accepted your connection request.',
    isRead: false,
    createdAt: minutesAgo(4),
    refUrl: '/profile/priya-sharma',
    actor: { id: 'user-priya', fullName: 'Priya Sharma', avatarUrl: null },
  },
  {
    id: 'notif-2',
    content: 'Tanvir Ahmed commented on your post: "Congrats on the internship!"',
    isRead: false,
    createdAt: minutesAgo(38),
    refUrl: '/feed/post-88',
    actor: { id: 'user-tanvir', fullName: 'Tanvir Ahmed', avatarUrl: null },
  },
  {
    id: 'notif-3',
    content: 'New job posting matches your skills: "Frontend Engineer @ Brain Station 23"',
    isRead: true,
    createdAt: minutesAgo(190),
    refUrl: '/jobs/job-55',
    actor: { id: 'system', fullName: 'UniConnecT', avatarUrl: null },
  },
];

function seed(data: typeof UNREAD_NOTIFS) {
  dsQueryClient.setQueryData(NOTIF_QUERY_KEY, data);
}

export function WithUnread() {
  seed(UNREAD_NOTIFS);
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', position: 'relative', minHeight: 340, minWidth: 360 }}>
      <NotificationDropdown onClose={() => {}} />
    </div>
  );
}

export function Empty() {
  seed([]);
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', position: 'relative', minHeight: 220, minWidth: 360 }}>
      <NotificationDropdown onClose={() => {}} />
    </div>
  );
}
