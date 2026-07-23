import { JobCard } from 'web';
import type { Job } from 'web';

const baseJob: Job = {
  id: 'job-pathao-fe',
  title: 'Frontend Engineering Intern',
  company: 'Pathao Bangladesh',
  location: 'Dhaka, Bangladesh',
  type: 'internship',
  description: 'Work with our web team building rider and driver-facing products.',
  requirements: ['React', 'TypeScript', 'Tailwind'],
  salaryRange: '15,000–20,000 BDT/mo',
  applicationUrl: null,
  deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
  postedBy: {
    id: 'u-recruiter',
    fullName: 'Fahim Ahmed',
    profile: { avatarUrl: null, headline: 'Talent Acquisition', department: null },
  },
  applicationCount: 24,
  myApplication: null,
  isSaved: false,
  viewCount: 340,
};

export function Default() {
  return (
    <div style={{ width: 380 }}>
      <JobCard job={baseJob} queryKey={['jobs', 'list']} />
    </div>
  );
}

export function AlreadyApplied() {
  return (
    <div style={{ width: 380 }}>
      <JobCard
        job={{ ...baseJob, id: 'job-brac-swe', title: 'Software Engineer', company: 'BRAC IT Services', myApplication: { id: 'app-1' }, applicationCount: 61 }}
        queryKey={['jobs', 'list']}
      />
    </div>
  );
}

export function DeadlineExpiringSoon() {
  return (
    <div style={{ width: 380 }}>
      <JobCard
        job={{
          ...baseJob,
          id: 'job-grameenphone-data',
          title: 'Data Analyst',
          company: 'Grameenphone',
          requirements: ['SQL', 'Power BI', 'Python'],
          deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(),
          applicationCount: 8,
        }}
        queryKey={['jobs', 'list']}
      />
    </div>
  );
}

export function SavedFullTimeExternalApply() {
  return (
    <div style={{ width: 380 }}>
      <JobCard
        job={{
          ...baseJob,
          id: 'job-brainstation23-be',
          title: 'Backend Engineer',
          company: 'Brain Station 23',
          type: 'full_time',
          requirements: ['Node.js', 'PostgreSQL'],
          salaryRange: null,
          applicationUrl: 'https://brainstation-23.com/careers/backend-engineer',
          isSaved: true,
          deadline: null,
        }}
        queryKey={['jobs', 'list']}
      />
    </div>
  );
}
