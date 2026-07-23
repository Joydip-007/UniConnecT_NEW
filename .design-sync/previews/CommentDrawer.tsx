import { CommentDrawer, dsQueryClient } from 'web';

const post = {
  id: 'post-501',
  type: 'post' as const,
  content: 'Midterm study group for CSE 3711 forming in the library, 2nd floor, every evening this week.',
  mediaUrls: [] as string[],
  author: {
    id: 'u-tanvir',
    fullName: 'Tanvir Ahmed',
    role: 'student' as const,
    profile: { avatarUrl: null, headline: 'CSE, Batch 213', department: 'CSE', batchYear: '2021' },
  },
  isPinned: false,
  isPublished: true,
  publishAt: null,
  archivedAt: null,
  expiresAt: null,
  viewCount: 90,
  reactionCounts: { like: 41, love: 2, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  myReaction: null,
  commentCount: 3,
  shareCount: 0,
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
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
};

const comments = [
  {
    id: 'c-1',
    postId: post.id,
    authorId: 'u-nusrat',
    parentId: null,
    content: 'Count me in! What time works best for everyone?',
    mediaUrls: [] as string[],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    author: { id: 'u-nusrat', fullName: 'Nusrat Jahan', avatarUrl: null, headline: 'CSE, Batch 213', role: 'student' as const },
    reactionCounts: { like: 2, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
    ownReaction: null,
    replies: [
      {
        id: 'c-1-1',
        postId: post.id,
        authorId: 'u-tanvir',
        parentId: 'c-1',
        content: 'Let\'s say 7pm, right after the CSE building closes to public?',
        mediaUrls: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 17).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 17).toISOString(),
        author: { id: 'u-tanvir', fullName: 'Tanvir Ahmed', avatarUrl: null, headline: 'CSE, Batch 213', role: 'student' as const },
        reactionCounts: { like: 1, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
        ownReaction: 'like' as const,
        replies: [],
      },
    ],
  },
  {
    id: 'c-2',
    postId: post.id,
    authorId: 'u-mahin',
    parentId: null,
    content: "Is this open to other batches too?",
    mediaUrls: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    author: { id: 'u-mahin', fullName: 'Mahin Chowdhury', avatarUrl: null, headline: 'CSE, Batch 211', role: 'student' as const },
    reactionCounts: { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
    ownReaction: null,
    replies: [],
  },
];

// useComments(postId, true) → queryKey commentsQueryKey(postId) = ['posts', 'comments', { postId }]
dsQueryClient.setQueryData(['posts', 'comments', { postId: post.id }], {
  pages: [{ items: comments, total: comments.length, page: 1, hasMore: false }],
  pageParams: [1],
});

export function Open() {
  return (
    <div style={{ minHeight: 500, background: 'var(--surface-page)' }}>
      <CommentDrawer post={post as any} onClose={() => {}} />
    </div>
  );
}
