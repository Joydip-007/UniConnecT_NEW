import { PostResultCard } from 'web';

const posts = [
  {
    id: 'p1',
    content: 'Excited to share that our team just shipped the new mentorship matching feature — huge thanks to everyone who tested it!',
    createdAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    reactionCount: 48,
    commentCount: 12,
    author: { id: 'u1', fullName: 'Farzana Rahman', avatarUrl: null },
  },
  {
    id: 'p2',
    content: 'Looking for alumni working in data science to speak at our upcoming career fair. DM me if interested!',
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    reactionCount: 6,
    commentCount: 2,
    author: { id: 'u2', fullName: 'Tanvir Ahmed', avatarUrl: null },
  },
];

export function DefaultResult() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 360 }}>
      <PostResultCard post={posts[0]} query="mentorship" />
    </div>
  );
}

export function ResultsList() {
  return (
    <div style={{ background: 'var(--surface-card)', width: 360 }}>
      {posts.map((p) => (
        <PostResultCard key={p.id} post={p} query="alumni" />
      ))}
    </div>
  );
}
