import { ChatView, dsQueryClient } from 'web';

// Two things are needed to get this off a blank card:
//  1. Seed ['messages', convId] on the SHARED dsQueryClient export (never
//     @/ds-query-client — a different bundled instance). It is a useInfiniteQuery,
//     so the entry needs the full {pages, pageParams} envelope.
//  2. Give it a parent with a real height: ChatView's root is `flex: 1`, so in a
//     plain auto-height container it collapses to zero and paints nothing.
//
// Message alignment (own vs. other) reads useAuthStore, which a preview cannot
// seed — every bubble therefore renders in the "other participant" style.

const sender = (id: string, fullName: string) => ({
  id,
  fullName,
  profile: { avatarUrl: null },
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 460,
        height: 380,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-page)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

export function Conversation() {
  dsQueryClient.setQueryData(['messages', 'conv-1'], {
    pageParams: [null],
    pages: [
      {
        nextCursor: null,
        items: [
          {
            id: 'm-1',
            conversationId: 'conv-1',
            senderId: 'u-2',
            sender: sender('u-2', 'Nabila Rahman'),
            body: 'Hey! Are you going to the alumni networking night on the 4th?',
            sentAt: '2026-08-14T10:02:00.000Z',
            isDeleted: false,
            replyTo: null,
            contentType: 'text' as const,
          },
          {
            id: 'm-2',
            conversationId: 'conv-1',
            senderId: 'u-2',
            sender: sender('u-2', 'Nabila Rahman'),
            body: 'They said a few Pathao and bKash folks are coming.',
            sentAt: '2026-08-14T10:02:40.000Z',
            isDeleted: false,
            replyTo: null,
            contentType: 'text' as const,
          },
          {
            id: 'm-3',
            conversationId: 'conv-1',
            senderId: 'u-3',
            sender: sender('u-3', 'Tanvir Ahmed'),
            body: 'Planning to, yes — I still need to finish my resume though.',
            sentAt: '2026-08-14T10:05:12.000Z',
            isDeleted: false,
            replyTo: {
              id: 'm-1',
              body: 'Hey! Are you going to the alumni networking night on the 4th?',
              senderName: 'Nabila Rahman',
            },
            contentType: 'text' as const,
          },
          {
            id: 'm-4',
            conversationId: 'conv-1',
            senderId: 'u-2',
            sender: sender('u-2', 'Nabila Rahman'),
            body: 'Send it over when you do, happy to look.',
            sentAt: '2026-08-14T10:07:00.000Z',
            isDeleted: false,
            replyTo: null,
            contentType: 'text' as const,
          },
        ],
      },
    ],
  });
  return (
    <Shell>
      <ChatView convId="conv-1" />
    </Shell>
  );
}

export function EmptyThread() {
  dsQueryClient.setQueryData(['messages', 'conv-empty'], {
    pageParams: [null],
    pages: [{ nextCursor: null, items: [] }],
  });
  return (
    <Shell>
      <ChatView convId="conv-empty" />
    </Shell>
  );
}
