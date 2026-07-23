import { AboutPanel } from 'web';

const STUDENT_USER = {
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
  mutualConnections: 4,
  stats: { connections: 128, pendingReceived: 0, posts: 34 },
  profile: {
    fullName: 'Sadia Rahman',
    bio: 'Final-year CSE student passionate about distributed systems and open source. Currently building a course-scheduling tool for UIU students.',
    avatarUrl: null,
    coverUrl: null,
    headline: 'CSE undergrad @ UIU',
    department: 'Computer Science & Engineering',
    batchYear: '2022',
    linkedinUrl: 'https://linkedin.com/in/sadia-rahman',
    phone: '+880 1711 223344',
    skills: ['TypeScript', 'React', 'PostgreSQL', 'System design'],
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

const EMPTY_USER = {
  ...STUDENT_USER,
  id: 'user-2',
  username: 'newuser22',
  mutualConnections: 0,
  connectionStatus: 'none' as const,
  connectionId: null,
  profile: {
    ...STUDENT_USER.profile,
    fullName: 'Imran Kabir',
    bio: null,
    headline: null,
    department: null,
    batchYear: null,
    linkedinUrl: null,
    skills: [],
    isOpenToWork: false,
  },
};

export function Filled() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 420 }}>
      <AboutPanel user={STUDENT_USER} isOwnProfile={false} />
    </div>
  );
}

export function OwnProfileWithPhone() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 420 }}>
      <AboutPanel user={STUDENT_USER} isOwnProfile />
    </div>
  );
}

export function Empty() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', maxWidth: 420 }}>
      <AboutPanel user={EMPTY_USER} isOwnProfile={false} />
    </div>
  );
}
