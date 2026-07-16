import { Link } from 'react-router-dom'
import type { JobSearchResult } from '@/features/search'

interface Props {
  job: JobSearchResult
}

export function JobResultCard({ job }: Props) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      style={{
        display: 'block',
        padding: '10px 14px',
        borderBottom: '0.5px solid var(--border-default)',
        fontSize: 14,
        textDecoration: 'none',
      }}
    >
      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{job.title}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
        {job.company} · {job.location} · {job.type}
      </div>
      {job.deadline && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
          Deadline: {new Date(job.deadline).toLocaleDateString()}
        </div>
      )}
    </Link>
  )
}
