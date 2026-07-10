import { useMyGradeCard } from '../hooks/useGroupExtended'

interface StudentGradeCardProps {
  groupId: string
}

export function StudentGradeCard({ groupId }: StudentGradeCardProps) {
  const { data, isLoading } = useMyGradeCard(groupId)

  if (isLoading || !data) return <div>Loading grade card…</div>

  return (
    <div
      className="rounded-[var(--r-lg)] p-4 flex flex-col gap-2"
      style={{ background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)' }}
    >
      <p>Percentage: {data.calculated.percentage ?? '—'}%</p>
      <p>Letter grade: {data.calculated.letterGrade ?? '—'}</p>
      <p>Grade point: {data.calculated.gradePoint ?? '—'}</p>
    </div>
  )
}
