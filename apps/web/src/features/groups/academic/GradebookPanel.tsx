import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useGradebook, useSaveCourseOutline, useUpsertGradebookEntries } from '../hooks/useGroupExtended'
import type { Gradebook, GradebookColumn, GradebookEntryInput, GradebookRow } from '../types'

interface GradebookPanelProps {
  groupId: string
}

const SAVE_DEBOUNCE_MS = 600

const card = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
} as const

const eyebrow = { fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-label)' } as const

const ghost = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 12px',
  fontSize: 12,
  borderRadius: 'var(--r-pill)',
  border: '0.5px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error
    if (message) return message
  }
  return 'Failed to load gradebook'
}

/** One grid column per assessment *instance* — `CT-1`, `CT-2`, … */
interface InstanceColumn {
  key: string
  assessmentId: string
  categoryName: string
  instance: number
  label: string
  fullMarks: number
}

function instanceColumns(columns: GradebookColumn[]): InstanceColumn[] {
  return columns.flatMap((col) =>
    Array.from({ length: Math.max(col.totalGiven, 1) }, (_, i) => {
      const instance = i + 1
      return {
        key: `${col.assessmentId}_${instance}`,
        assessmentId: col.assessmentId ?? '',
        categoryName: col.categoryName,
        instance,
        label: col.totalGiven > 1 ? `${col.categoryName}-${instance}` : col.categoryName,
        fullMarks: col.fullMarks,
      }
    }),
  )
}

function columnStats(col: InstanceColumn, rows: GradebookRow[]) {
  const marks = rows.map((r) => r.cells[col.key]?.marksObtained).filter((m): m is number => typeof m === 'number')
  const graded = marks.length
  const average = graded > 0 ? marks.reduce((a, b) => a + b, 0) / graded : null
  const status: 'released' | 'marking' | 'idle' = rows.length > 0 && graded === rows.length ? 'released' : graded > 0 ? 'marking' : 'idle'
  return { graded, average, status }
}

/** Design names the class-test category `CT`; fall back to the first category. */
function pickCtCategory(gradebook: Gradebook) {
  const a = gradebook.outline.assessments
  return a.find((x) => /^ct$|class test/i.test(x.categoryName)) ?? a[0]
}

export function GradebookPanel({ groupId }: GradebookPanelProps) {
  const { data: gradebook, isLoading, isError, error } = useGradebook(groupId)
  const upsert = useUpsertGradebookEntries(groupId)
  const saveOutline = useSaveCourseOutline(groupId, 'replace')

  // Debounced cell saves: keyed by cell so a burst of keystrokes collapses to one PUT.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pending = useRef(new Map<string, GradebookEntryInput>())
  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  const flush = (key: string) => {
    const t = timers.current.get(key)
    if (t) clearTimeout(t)
    timers.current.delete(key)
    const entry = pending.current.get(key)
    if (!entry) return
    pending.current.delete(key)
    void upsert.mutateAsync([entry])
  }

  const queueSave = (studentId: string, col: InstanceColumn, value: string) => {
    const key = `${studentId}:${col.key}`
    pending.current.set(key, {
      studentId,
      assessmentId: col.assessmentId,
      instanceNumber: col.instance,
      marksObtained: value === '' ? null : Number(value),
    })
    const existing = timers.current.get(key)
    if (existing) clearTimeout(existing)
    timers.current.set(key, setTimeout(() => flush(key), SAVE_DEBOUNCE_MS))
  }

  const cols = useMemo(() => (gradebook ? instanceColumns(gradebook.columns) : []), [gradebook])

  if (isLoading) return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading gradebook…</div>
  if (isError) return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{getErrorMessage(error)}</div>
  if (!gradebook) return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No gradebook data available.</div>

  const addCt = () => {
    const ct = pickCtCategory(gradebook)
    if (!ct || saveOutline.isPending) return
    const { outline } = gradebook
    saveOutline.mutate({
      courseCode: outline.courseCode ?? undefined,
      courseTitle: outline.courseTitle,
      creditHours: outline.creditHours ?? null,
      trimester: outline.trimester ?? undefined,
      description: outline.description ?? undefined,
      gradingScale: outline.gradingScale,
      customScaleJson: outline.customScaleJson,
      topics: outline.topics,
      assessments: outline.assessments.map((a) => (a === ct ? { ...a, totalGiven: a.totalGiven + 1 } : a)),
    })
  }

  const multiInstance = gradebook.columns.filter((c) => c.totalGiven > 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Assessments card ─────────────────────────────────────────────── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, 1fr) 80px 80px 80px 100px',
            gap: 8,
            padding: '10px 16px',
            borderBottom: '0.5px solid var(--border-subtle)',
          }}
        >
          <span style={eyebrow}>Assessment</span>
          <span style={eyebrow}>Out of</span>
          <span style={eyebrow}>Average</span>
          <span style={eyebrow}>Graded</span>
          <span style={eyebrow}>Status</span>
        </div>
        {cols.map((col) => {
          const s = columnStats(col, gradebook.rows)
          const status =
            s.status === 'released'
              ? { label: 'Released', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)', color: 'var(--uc-mint)' }
              : s.status === 'marking'
                ? { label: 'Marking', bg: 'var(--uc-orange-bg)', bdr: 'var(--uc-orange-bdr)', color: 'var(--uc-orange-l)' }
                : { label: 'Not started', bg: 'var(--surface-raised)', bdr: 'var(--border-default)', color: 'var(--text-tertiary)' }
          return (
            <div
              key={col.key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(120px, 1fr) 80px 80px 80px 100px',
                gap: 8,
                alignItems: 'center',
                padding: '8px 16px',
                borderBottom: '0.5px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{col.label}</span>
              <input className="fld" readOnly aria-label={`${col.label} out of`} value={col.fullMarks} style={{ padding: '4px 8px', fontSize: 12 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.average === null ? '—' : s.average.toFixed(1)}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {s.graded}/{gradebook.rows.length}
              </span>
              <span style={{ justifySelf: 'start', fontSize: 11, padding: '1px 8px', borderRadius: 'var(--r-pill)', background: status.bg, border: `0.5px solid ${status.bdr}`, color: status.color }}>
                {status.label}
              </span>
            </div>
          )
        })}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {cols.length} {cols.length === 1 ? 'assessment' : 'assessments'} from the outline · marks save as you type
          </span>
          <button type="button" style={ghost} onClick={addCt} disabled={saveOutline.isPending || gradebook.outline.assessments.length === 0}>
            <Plus size={12} strokeWidth={1.5} />
            Add CT
          </button>
        </div>
      </div>

      {/* ── Student grid ─────────────────────────────────────────────────── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...eyebrow, position: 'sticky', left: 0, zIndex: 1, textAlign: 'left', fontWeight: 400, padding: '10px 16px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border-subtle)', minWidth: 200 }}>
                  Student
                </th>
                {multiInstance.map((c) => (
                  <th key={`${c.assessmentId}-avg`} style={{ ...eyebrow, fontWeight: 400, padding: '10px 8px', width: 72, textAlign: 'left', borderBottom: '0.5px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>
                    {c.categoryName} avg
                  </th>
                ))}
                {cols.map((col) => (
                  <th key={col.key} style={{ ...eyebrow, fontWeight: 400, padding: '10px 8px', width: 72, textAlign: 'left', borderBottom: '0.5px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>
                    {col.label}
                  </th>
                ))}
                <th style={{ ...eyebrow, fontWeight: 400, padding: '10px 16px 10px 8px', textAlign: 'left', borderBottom: '0.5px solid var(--border-subtle)' }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {gradebook.rows.map((row) => {
                const name = row.student.fullName
                return (
                  <tr key={row.student.id}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, padding: '8px 16px', background: 'var(--surface-card)', borderBottom: '0.5px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar initials={getInitials(name)} color={avatarColor(row.student.id)} size={26} src={row.student.avatarUrl} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{name}</div>
                          {row.student.department && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{row.student.department}</div>}
                        </div>
                      </div>
                    </td>
                    {multiInstance.map((c) => {
                      const avg = row.calculated[`${c.categoryName}_avg`]
                      return (
                        <td key={`${c.assessmentId}-avg`} style={{ padding: '8px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border-subtle)' }}>
                          {typeof avg === 'number' ? avg.toFixed(1) : '—'}
                        </td>
                      )
                    })}
                    {cols.map((col) => {
                      const cell = row.cells[col.key]
                      const blank = cell?.marksObtained === null || cell?.marksObtained === undefined
                      return (
                        <td key={col.key} style={{ padding: '6px 8px', borderBottom: '0.5px solid var(--border-subtle)' }}>
                          <CellInput
                            label={`${col.label} for ${name}`}
                            initial={cell?.marksObtained ?? null}
                            blank={blank}
                            max={col.fullMarks}
                            onChange={(v) => queueSave(row.student.id, col, v)}
                            onBlur={() => flush(`${row.student.id}:${col.key}`)}
                          />
                        </td>
                      )
                    })}
                    <td style={{ padding: '8px 16px 8px 8px', borderBottom: '0.5px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 12, padding: '1px 8px', borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)', color: 'var(--text-primary)' }}>
                        {row.calculated.letterGrade ?? '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {gradebook.rows.length} {gradebook.rows.length === 1 ? 'student' : 'students'} · marks save as you type
          </span>
          <button type="button" style={ghost} onClick={addCt} disabled={saveOutline.isPending || gradebook.outline.assessments.length === 0}>
            <Plus size={12} strokeWidth={1.5} />
            Add CT column
          </button>
        </div>
      </div>
    </div>
  )
}

function CellInput({ label, initial, blank, max, onChange, onBlur }: { label: string; initial: number | null; blank: boolean; max: number; onChange: (v: string) => void; onBlur: () => void }) {
  const [value, setValue] = useState(initial === null ? '' : String(initial))
  // Server refetch after a save must not clobber what the user is typing.
  useEffect(() => {
    setValue(initial === null ? '' : String(initial))
  }, [initial])
  const isBlank = blank && value === ''
  return (
    <input
      aria-label={label}
      type="number"
      min={0}
      max={max}
      className={`fld${isBlank ? ' fld-need' : ''}`}
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        onChange(e.target.value)
      }}
      onBlur={onBlur}
      style={{ width: 64, padding: '4px 8px', fontSize: 12 }}
    />
  )
}
