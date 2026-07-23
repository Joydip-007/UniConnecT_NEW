import { ResumeExportButton, dsQueryClient } from 'web';

const USER = {
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
    bio: 'Final-year CSE student passionate about distributed systems and open source.',
    avatarUrl: null,
    coverUrl: null,
    headline: 'CSE undergrad @ UIU',
    department: 'Computer Science & Engineering',
    batchYear: '2022',
    linkedinUrl: 'https://linkedin.com/in/sadia-rahman',
    phone: '+880 1711 223344',
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

dsQueryClient.setQueryData(['profile', 'experience', USER.id], [
  {
    id: 'exp-1',
    userId: USER.id,
    title: 'Software Engineering Intern',
    company: 'Brain Station 23',
    location: 'Dhaka, Bangladesh',
    startDate: '2024-05-01T00:00:00.000Z',
    endDate: null,
    description: 'Building internal QA automation tooling in TypeScript.',
    createdAt: '2024-05-01T00:00:00.000Z',
    updatedAt: '2024-05-01T00:00:00.000Z',
  },
]);

dsQueryClient.setQueryData(['profile', 'education', USER.id], [
  {
    id: 'edu-1',
    userId: USER.id,
    institution: 'United International University',
    degree: 'Bachelor of Science',
    fieldOfStudy: 'Computer Science and Engineering',
    startYear: 2020,
    endYear: 2024,
    grade: '3.82 / 4.00',
    description: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
]);

export function Default() {
  return (
    <div style={{ padding: 24, background: 'var(--surface-page)', display: 'flex', alignItems: 'center' }}>
      <ResumeExportButton user={USER} />
    </div>
  );
}
