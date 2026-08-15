import { CreatePost, dsQueryClient, useAuthStore } from 'web';

// CreatePost hard-gates on `if (!user) return null`. Seed the store from the
// SHARED 'web' export — that re-export lives inside the synth entry, so it is
// the same store instance the component subscribes to. (An `extraEntries` copy
// is NOT: esbuild realpaths it to a different module record and seeding does
// nothing.) setState, not setAuth() — the latter writes localStorage and opens
// a socket.
useAuthStore.setState({
  isLoading: false,
  accessToken: 'ds-preview-token',
  user: {
    id: 'u-nabila',
    username: 'nabila',
    email: 'nabila@uiu.ac.bd',
    role: 'student',
    universityId: 'uni-uiu',
    isVerified: true,
    themePreference: 'dark',
    profile: {
      fullName: 'Nabila Rahman',
      bio: null,
      avatarUrl: null,
      coverUrl: null,
      headline: 'CSE undergrad, batch 2026',
      department: 'Computer Science & Engineering',
      batchYear: '2026',
      linkedinUrl: null,
      phone: null,
      skills: [],
      isOpenToWork: false,
      isOpenToMentorship: false,
      mentorshipPoints: 0,
      maxMentees: 3,
      location: 'Dhaka',
      websiteUrl: null,
      githubUrl: null,
      portfolioUrl: null,
      isOpenToMsg: true,
    },
  },
});

// CreatePost dedupes a first-post-hint query at ['users','me','progress'].
// Seed it so the composer's collapsed trigger renders without hanging in
// isLoading; hasMadePost:false + the other flags true would show the hint,
// but we keep it dismissed-equivalent here by marking hasMadePost true so the
// plain collapsed trigger (the common state) is what's captured.
dsQueryClient.setQueryData(['users', 'me', 'progress'], {
  hasAvatar: true,
  hasHeadline: true,
  hasBio: true,
  hasMadePost: true,
});

export function CollapsedTrigger() {
  return (
    <div style={{ width: 480, padding: 12, background: 'var(--surface-page)' }}>
      <CreatePost />
    </div>
  );
}

const editPost = {
  id: 'post-edit-1',
  type: 'post' as const,
  content: "Excited to share that our team placed 2nd at the Dhaka regional hackathon this weekend!",
  mediaUrls: [] as string[],
  author: {
    id: 'u-nabila',
    fullName: 'Nabila Rahman',
    role: 'student' as const,
    profile: { avatarUrl: null, headline: 'CSE @ UIU', department: 'CSE', batchYear: '2023' },
  },
  isPinned: false,
  isPublished: true,
  publishAt: null,
  archivedAt: null,
  expiresAt: null,
  viewCount: 120,
  reactionCounts: { like: 40, love: 5, care: 0, haha: 0, wow: 2, sad: 0, angry: 0 },
  myReaction: null,
  commentCount: 6,
  shareCount: 1,
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
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
};

export function EditModeOpen() {
  return (
    <div style={{ width: 620, padding: 12, background: 'var(--surface-page)' }}>
      <CreatePost editPost={editPost as any} onDismissEdit={() => {}} />
    </div>
  );
}
