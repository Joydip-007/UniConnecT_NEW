import { MessagesPopup, dsQueryClient } from 'web';

// Force framer-motion's useReducedMotion() to true so the popover renders in its
// final (opacity:1) state immediately — otherwise capture can land mid enter-animation
// (initial opacity:0) and screenshot a blank frame. See SearchPanel.tsx for the same fix.
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

const conversations = [
  {
    id: 'conv-1',
    type: 'direct' as const,
    name: null,
    otherParticipant: { id: 'u1', fullName: 'Nadia Islam', role: 'alumni' as const, profile: { avatarUrl: null, headline: 'Senior SWE' } },
    lastMessage: { body: 'Sounds good, see you Thursday!', sentAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), senderId: 'u1' },
    unreadCount: 2,
  },
  {
    id: 'conv-2',
    type: 'mentorship' as const,
    name: null,
    otherParticipant: { id: 'u2', fullName: 'Rafiul Karim', role: 'student' as const, profile: { avatarUrl: null, headline: null } },
    lastMessage: { body: 'Thanks for accepting my request!', sentAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), senderId: 'u2' },
    unreadCount: 0,
  },
  {
    id: 'conv-3',
    type: 'group' as const,
    name: 'CSE Batch 22 Study Group',
    otherParticipant: null,
    lastMessage: { body: 'Anyone free to review the assignment tonight?', sentAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), senderId: 'u3' },
    unreadCount: 5,
  },
];

dsQueryClient.setQueryData(['conversations'], conversations);

export function Populated() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 404, height: 440 }}>
      {/* MessagesPopup positions itself at `top: calc(100% + 8px)` of its nearest
          positioned ancestor. Nesting it in a zero-height relative div makes that
          offset resolve to ~8px from this wrapper's top, so the popover renders
          inside the visible capture frame instead of below a tall fixed-height box. */}
      <div style={{ position: 'relative', height: 0 }}>
        <MessagesPopup onClose={() => {}} />
      </div>
    </div>
  );
}
