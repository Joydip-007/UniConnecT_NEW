import { PostCard } from 'web';

const basePost = {
  id: 'post-201',
  type: 'post' as const,
  content:
    "Just wrapped up our capstone demo for the Smart Campus Shuttle tracker — huge thanks to everyone who tested the beta with us this week! 🚌",
  mediaUrls: [] as string[],
  author: {
    id: 'u-nabila',
    fullName: 'Nabila Rahman',
    role: 'student' as const,
    profile: { avatarUrl: null, headline: 'CSE @ UIU · Full-stack dev', department: 'CSE', batchYear: '2023' },
  },
  isPinned: false,
  isPublished: true,
  publishAt: null,
  archivedAt: null,
  expiresAt: null,
  viewCount: 480,
  reactionCounts: { like: 168, love: 32, care: 4, haha: 6, wow: 3, sad: 0, angry: 0 },
  myReaction: 'like' as const,
  commentCount: 38,
  shareCount: 5,
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
  createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
};

export function Standard() {
  return (
    <div style={{ width: 520, padding: 12, background: 'var(--surface-page)' }}>
      <PostCard post={basePost as any} onCommentClick={() => {}} onEditPost={() => {}} />
    </div>
  );
}

const announcement = {
  ...basePost,
  id: 'post-202',
  type: 'announcement' as const,
  isPinned: true,
  content: 'Midterm exam schedule for Spring 2026 has been published — check the academic calendar for room assignments.',
  author: {
    id: 'u-faculty',
    fullName: 'Dr. Farida Yasmin',
    role: 'faculty' as const,
    profile: { avatarUrl: null, headline: 'Associate Professor, CSE', department: 'CSE', batchYear: null },
  },
  myReaction: null,
  reactionCounts: { like: 54, love: 2, care: 0, haha: 0, wow: 1, sad: 0, angry: 0 },
  commentCount: 12,
  shareCount: 8,
};

export function Announcement() {
  return (
    <div style={{ width: 520, padding: 12, background: 'var(--surface-page)' }}>
      <PostCard post={announcement as any} onCommentClick={() => {}} onEditPost={() => {}} />
    </div>
  );
}

const withPoll = {
  ...basePost,
  id: 'post-203',
  content: 'Quick poll for the batch — which elective should we push the department to open next semester?',
  mediaUrls: [],
  poll: {
    id: 'poll-1',
    question: 'Which elective would you take?',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    myVote: null,
    totalVotes: 214,
    options: [
      { id: 'opt-1', text: 'Machine Learning', displayOrder: 0, voteCount: 120 },
      { id: 'opt-2', text: 'Computer Graphics', displayOrder: 1, voteCount: 54 },
      { id: 'opt-3', text: 'Distributed Systems', displayOrder: 2, voteCount: 40 },
    ],
  },
};

export function WithPoll() {
  return (
    <div style={{ width: 520, padding: 12, background: 'var(--surface-page)' }}>
      <PostCard post={withPoll as any} onCommentClick={() => {}} onEditPost={() => {}} />
    </div>
  );
}
