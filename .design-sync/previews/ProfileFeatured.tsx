import { ProfileFeatured, dsQueryClient } from 'web';

const ITEMS = [
  {
    id: 'feat-1',
    userId: 'user-1',
    type: 'link' as const,
    postId: null,
    linkUrl: 'https://sadia-rahman.dev',
    linkTitle: 'My portfolio website',
    linkDescription: 'A collection of projects from my undergrad years, including a course-scheduling tool for UIU.',
    displayOrder: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'feat-2',
    userId: 'user-1',
    type: 'post' as const,
    postId: 'post-77',
    linkUrl: null,
    linkTitle: null,
    linkDescription: null,
    displayOrder: 1,
    createdAt: '2024-02-01T00:00:00.000Z',
  },
];

function seed(userId: string, items: typeof ITEMS) {
  dsQueryClient.setQueryData(['profile', 'featured', userId], items);
}

export function WithItems() {
  seed('user-1', ITEMS);
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 480 }}>
      <ProfileFeatured
        userId="user-1"
        isOwnProfile
        connectionStatus="connected"
        onAdd={() => {}}
        onDelete={() => {}}
      />
    </div>
  );
}

export function Restricted() {
  seed('user-2', ITEMS);
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 480 }}>
      <ProfileFeatured
        userId="user-2"
        isOwnProfile={false}
        connectionStatus="none"
        onAdd={() => {}}
        onDelete={() => {}}
      />
    </div>
  );
}

export function OwnEmpty() {
  seed('user-3', []);
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 480 }}>
      <ProfileFeatured
        userId="user-3"
        isOwnProfile
        connectionStatus="connected"
        onAdd={() => {}}
        onDelete={() => {}}
      />
    </div>
  );
}
