import { PathCard } from 'web';

const basePath = {
  id: 'path-web-fundamentals',
  title: 'Web Development Fundamentals',
  description: 'Learn the building blocks of the modern web — HTML, CSS, and JavaScript from scratch.',
  category: 'programming',
  difficulty: 'beginner' as const,
  estimated_days: 21,
  badge_name: 'Web Foundations',
  badge_icon: null,
  unitCount: 12,
  enrolledCount: 640,
  myEnrollmentStatus: null,
};

export function NotEnrolled() {
  return (
    <div style={{ width: 320 }}>
      <PathCard path={basePath} onOpen={() => {}} />
    </div>
  );
}

export function InProgress() {
  return (
    <div style={{ width: 320 }}>
      <PathCard
        path={{
          ...basePath,
          id: 'path-data-structures',
          title: 'Data Structures & Algorithms',
          description: 'Master the core data structures and algorithms asked in technical interviews.',
          difficulty: 'intermediate',
          estimated_days: 30,
          unitCount: 18,
          myEnrollmentStatus: 'active',
        }}
        onOpen={() => {}}
      />
    </div>
  );
}

export function Completed() {
  return (
    <div style={{ width: 320 }}>
      <PathCard
        path={{
          ...basePath,
          id: 'path-git-github',
          title: 'Git & GitHub Essentials',
          description: 'Version control workflows every developer needs to know.',
          difficulty: 'beginner',
          estimated_days: 7,
          unitCount: 6,
          badge_name: 'Git Master',
          myEnrollmentStatus: 'completed',
        }}
        onOpen={() => {}}
      />
    </div>
  );
}

export function NoBadgeNoDescription() {
  return (
    <div style={{ width: 320 }}>
      <PathCard
        path={{
          ...basePath,
          id: 'path-advanced-sql',
          title: 'Advanced SQL',
          description: null,
          difficulty: 'advanced',
          estimated_days: 14,
          unitCount: 9,
          badge_name: null,
          myEnrollmentStatus: null,
        }}
        onOpen={() => {}}
      />
    </div>
  );
}
