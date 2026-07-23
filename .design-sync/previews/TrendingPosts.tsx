import { TrendingPosts } from 'web';

const posts = [
  {
    id: 'post-101',
    content:
      'Just wrapped up our capstone demo for the Smart Campus Shuttle tracker — huge thanks to everyone who tested the beta with us this week!',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    authorId: 'u-nabila',
    authorName: 'Nabila Rahman',
    authorAvatarUrl: null,
    authorRole: 'student',
    reactionCount: 214,
    commentCount: 38,
  },
  {
    id: 'post-102',
    content:
      "Alumni panel on breaking into product management is happening next Thursday — I'll be moderating. Drop your questions below!",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    authorId: 'u-farhan',
    authorName: 'Farhan Kabir',
    authorAvatarUrl: null,
    authorRole: 'alumni',
    reactionCount: 96,
    commentCount: 12,
  },
  {
    id: 'post-103',
    content: 'Midterm study group for CSE 3711 forming in the library, 2nd floor, every evening this week.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    authorId: 'u-tanvir',
    authorName: 'Tanvir Ahmed',
    authorAvatarUrl: null,
    authorRole: 'student',
    reactionCount: 41,
    commentCount: 9,
  },
];

export function Populated() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', display: 'flex', gap: 12, overflowX: 'auto' }}>
      <TrendingPosts posts={posts} />
    </div>
  );
}

export function Empty() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)' }}>
      <TrendingPosts posts={[]} />
    </div>
  );
}
