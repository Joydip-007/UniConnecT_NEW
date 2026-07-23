import { JobResultCard } from 'web';

export function WithDeadline() {
  return (
    <div style={{ background: 'var(--surface-card)' }}>
      <JobResultCard
        job={{
          id: 'job-1',
          title: 'Frontend Engineering Intern',
          company: 'Pathao Bangladesh',
          location: 'Dhaka, Bangladesh',
          type: 'Internship',
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }}
      />
    </div>
  );
}

export function NoDeadline() {
  return (
    <div style={{ background: 'var(--surface-card)' }}>
      <JobResultCard
        job={{
          id: 'job-2',
          title: 'Backend Engineer',
          company: 'Grameenphone',
          location: 'Dhaka, Bangladesh',
          type: 'Full-time',
          deadline: null,
        }}
      />
    </div>
  );
}
