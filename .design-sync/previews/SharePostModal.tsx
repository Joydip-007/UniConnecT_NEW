import { SharePostModal } from 'web';


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

const post = {
  id: 'post-401',
  type: 'post' as const,
  content: 'Alumni panel on breaking into product management is happening next Thursday — moderating this one, drop your questions below!',
  mediaUrls: [] as string[],
  author: {
    id: 'u-farhan',
    fullName: 'Farhan Kabir',
    role: 'alumni' as const,
    profile: { avatarUrl: null, headline: 'PM @ Pathao · UIU 2019', department: 'CSE', batchYear: '2019' },
  },
  isPinned: false,
  isPublished: true,
  publishAt: null,
  archivedAt: null,
  expiresAt: null,
  viewCount: 300,
  reactionCounts: { like: 96, love: 8, care: 0, haha: 0, wow: 1, sad: 0, angry: 0 },
  myReaction: null,
  commentCount: 12,
  shareCount: 4,
  isSaved: false,
  reactionCountsHidden: false,
  commentsDisabled: false,
  sharesDisabled: false,
  originalPost: null,
  myShare: null,
  poll: null,
  jobEmbed: null,
  eventEmbed: null,
  lostFoundEmbed: null,
  attachments: [],
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
};

export function Open() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <SharePostModal post={post as any} onClose={() => {}} onShared={() => {}} />
    </div>
  );
}
