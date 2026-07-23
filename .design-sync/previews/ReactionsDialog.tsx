import { ReactionsDialog, dsQueryClient } from 'web';


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

const postId = 'post-301';
const counts = { like: 5, love: 2, care: 0, haha: 1, wow: 0, sad: 0, angry: 0 };

const reactionUsers = [
  { userId: 'u-1', fullName: 'Tanvir Ahmed', avatarUrl: null, reactionType: 'like', connectionStatus: 'connected', connectionId: 'c-1' },
  { userId: 'u-2', fullName: 'Farhan Kabir', avatarUrl: null, reactionType: 'love', connectionStatus: 'none', connectionId: null },
  { userId: 'u-3', fullName: 'Nusrat Jahan', avatarUrl: null, reactionType: 'like', connectionStatus: 'pending_sent', connectionId: null },
  { userId: 'u-4', fullName: 'Mahin Chowdhury', avatarUrl: null, reactionType: 'haha', connectionStatus: 'pending_received', connectionId: 'c-4' },
  { userId: 'u-5', fullName: 'Rafiul Islam', avatarUrl: null, reactionType: 'like', connectionStatus: 'connected', connectionId: 'c-5' },
  { userId: 'u-6', fullName: 'Nabila Rahman', avatarUrl: null, reactionType: 'like', connectionStatus: 'none', connectionId: null },
  { userId: 'u-7', fullName: 'Anika Tabassum', avatarUrl: null, reactionType: 'love', connectionStatus: 'connected', connectionId: 'c-7' },
];

// usePostReactions(postId, type) → queryKey ['posts', 'reactions', postId, type]
dsQueryClient.setQueryData(['posts', 'reactions', postId, 'all'], {
  pages: [{ items: reactionUsers, nextCursor: null }],
  pageParams: [undefined],
});
dsQueryClient.setQueryData(['posts', 'reactions', postId, 'like'], {
  pages: [{ items: reactionUsers.filter((u) => u.reactionType === 'like'), nextCursor: null }],
  pageParams: [undefined],
});
dsQueryClient.setQueryData(['posts', 'reactions', postId, 'love'], {
  pages: [{ items: reactionUsers.filter((u) => u.reactionType === 'love'), nextCursor: null }],
  pageParams: [undefined],
});
dsQueryClient.setQueryData(['posts', 'reactions', postId, 'haha'], {
  pages: [{ items: reactionUsers.filter((u) => u.reactionType === 'haha'), nextCursor: null }],
  pageParams: [undefined],
});

export function Populated() {
  return (
    <div style={{ minHeight: 420, background: 'var(--surface-page)' }}>
      <ReactionsDialog postId={postId} counts={counts} onClose={() => {}} />
    </div>
  );
}
