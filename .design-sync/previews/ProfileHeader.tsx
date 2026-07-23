import { ProfileHeader } from 'web';

const BASE = {
  id: 'user-1',
  username: 'sadia.rahman',
  email: 'sadia.rahman@uiu.ac.bd',
  role: 'student' as const,
  universityId: 'uni-1',
  isVerified: true,
  themePreference: 'dark' as const,
  createdAt: '2023-01-12T00:00:00.000Z',
  connectionStatus: 'connected' as const,
  connectionId: 'conn-1',
  mutualConnections: 6,
  isMutedByViewer: false,
  stats: { connections: 128, pendingReceived: 0, posts: 34 },
  profile: {
    fullName: 'Sadia Rahman',
    bio: null,
    avatarUrl: null,
    coverUrl: null,
    headline: 'CSE undergrad @ UIU · Building course-scheduling tools',
    department: 'Computer Science & Engineering',
    batchYear: '2022',
    linkedinUrl: 'https://linkedin.com/in/sadia-rahman',
    phone: null,
    skills: ['TypeScript', 'React', 'PostgreSQL'],
    isOpenToWork: true,
    isOpenToMentorship: false,
    mentorshipPoints: 0,
    location: 'Dhaka, Bangladesh',
    websiteUrl: null,
    githubUrl: 'https://github.com/sadia-rahman',
    portfolioUrl: null,
    isOpenToMsg: true,
  },
};

export function OwnProfile() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 480 }}>
      <ProfileHeader user={BASE} isOwnProfile onEdit={() => {}} />
    </div>
  );
}

export function OtherProfileConnected() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 480 }}>
      <ProfileHeader user={BASE} isOwnProfile={false} onEdit={() => {}} />
    </div>
  );
}

export function AlumniWithFullDetails() {
  const alumni = {
    ...BASE,
    id: 'user-2',
    username: 'rafiq.chowdhury',
    role: 'alumni' as const,
    isVerified: true,
    mutualConnections: 2,
    connectionStatus: 'pending_sent' as const,
    connectionId: null,
    stats: { connections: 341, pendingReceived: 0, posts: 89 },
    profile: {
      ...BASE.profile,
      fullName: 'Rafiq Chowdhury',
      headline: 'Senior Software Engineer at Therap Services · UIU CSE alum',
      department: 'Computer Science & Engineering',
      batchYear: '2019',
      location: 'Dhaka, Bangladesh',
      isOpenToWork: false,
    },
  };
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 480 }}>
      <ProfileHeader user={alumni} isOwnProfile={false} onEdit={() => {}} />
    </div>
  );
}

export function MinimalNewProfile() {
  const minimal = {
    ...BASE,
    id: 'user-3',
    username: 'imran.kabir',
    isVerified: false,
    mutualConnections: 0,
    connectionStatus: 'none' as const,
    connectionId: null,
    stats: { connections: 3, pendingReceived: 0, posts: 0 },
    profile: {
      ...BASE.profile,
      fullName: 'Imran Kabir',
      headline: null,
      department: null,
      batchYear: null,
      location: null,
      isOpenToWork: false,
    },
  };
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 480 }}>
      <ProfileHeader user={minimal} isOwnProfile={false} onEdit={() => {}} />
    </div>
  );
}
