import { useGradebook, useUpsertGradebookEntries } from '../hooks/useGroupExtended'

interface GradebookPanelProps {
  groupId: string
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error
    if (message) return message
  }
  return 'Failed to load gradebook'
}

export function GradebookPanel({ groupId }: GradebookPanelProps) {
  const { data: gradebook, isLoading, isError, error } = useGradebook(groupId)
  const upsert = useUpsertGradebookEntries(groupId)

  if (isLoading) return <div>Loading gradebook…</div>
  if (isError) return <div>{getErrorMessage(error)}</div>
  if (!gradebook) return <div>No gradebook data available.</div>

  async function commitCell(studentId: string, assessmentId: string, value: string) {
    const marksObtained = value === '' ? null : Number(value)
    await upsert.mutateAsync([{ studentId, assessmentId, instanceNumber: 1, marksObtained }])
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th
              className="sticky left-0 text-left px-3 py-2"
              style={{ background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border-default)' }}
            >
              Student
            </th>
            {gradebook.columns.map((col) => (
              <th
                key={col.assessmentId}
                className="px-3 py-2"
                style={{ background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border-default)' }}
              >
                {col.label}
              </th>
            ))}
            <th
              className="px-3 py-2"
              style={{ background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border-default)' }}
            >
              Grade
            </th>
          </tr>
        </thead>
        <tbody>
          {gradebook.rows.map((row) => (
            <tr key={row.student.id}>
              <td
                className="sticky left-0 px-3 py-2"
                style={{ background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border-default)' }}
              >
                {row.student.fullName}
              </td>
              {gradebook.columns.map((col) => {
                const cellKey = `${col.assessmentId}_1`
                const cell = row.cells[cellKey]
                return (
                  <td
                    key={col.assessmentId}
                    className="px-3 py-2"
                    style={{ borderBottom: '0.5px solid var(--border-default)' }}
                  >
                    <input
                      aria-label={`${col.label} for ${row.student.fullName}`}
                      type="number"
                      defaultValue={cell?.marksObtained ?? ''}
                      onBlur={(e) => void commitCell(row.student.id, col.assessmentId ?? '', e.target.value)}
                      className="w-20 rounded-[var(--r-md)] border-[0.5px] px-2 py-1"
                      style={{ borderColor: 'var(--border-default)', background: 'var(--surface-page)' }}
                    />
                  </td>
                )
              })}
              <td className="px-3 py-2" style={{ borderBottom: '0.5px solid var(--border-default)' }}>
                {row.calculated.letterGrade ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
