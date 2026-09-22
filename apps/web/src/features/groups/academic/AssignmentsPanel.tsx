import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ClipboardCheck, FileCheck, Unlock, Upload, X } from 'lucide-react'
import {
  useAssignments,
  useCreateAssignment,
  useGradeSubmission,
  useSubmissions,
  useSubmitAssignment,
} from '../hooks/useGroupExtended'
import type { Assignment } from '../types'

interface AssignmentsPanelProps {
  groupId: string
  isAdmin: boolean
}

function SubmissionsList({ groupId, assignment }: { groupId: string; assignment: Assignment }) {
  const { data: submissions, isLoading } = useSubmissions(groupId, assignment.id)
  const grade = useGradeSubmission(groupId, assignment.id)

  async function commitGrade(submissionId: string, score: string, feedback: string) {
    if (score === '') return
    await grade.mutateAsync({ submissionId, score: Number(score), feedback: feedback || undefined })
  }

  if (isLoading || !submissions) return <div>Loading submissions…</div>
  if (submissions.length === 0) return <p style={{ color: 'var(--text-secondary)' }}>No submissions yet.</p>

  return (
    <ul className="flex flex-col gap-2">
      {submissions.map((s) => (
        <li
          key={s.id}
          className="flex flex-col gap-2 rounded-[var(--r-md)] p-3"
          style={{ background: 'var(--surface-page)', border: '0.5px solid var(--border-default)' }}
        >
          <span>{s.textContent || '(file submission)'}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {s.isLate ? 'Submitted late' : 'Submitted on time'} · {s.gradedAt ? 'Graded' : 'Ungraded'}
          </span>
          <div className="flex items-center gap-2">
            <input
              aria-label={`Score for submission ${s.id}`}
              type="number"
              max={assignment.maxScore}
              defaultValue={s.score ?? ''}
              onBlur={(e) => void commitGrade(s.id, e.target.value, s.feedback ?? '')}
              className="w-20 rounded-[var(--r-md)] border-[0.5px] px-2 py-1"
              style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>/ {assignment.maxScore}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function CreateAssignmentForm({ groupId }: { groupId: string }) {
  const createAssignment = useCreateAssignment(groupId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [maxScore, setMaxScore] = useState('100')
  const [deadline, setDeadline] = useState('')

  async function handleSubmit() {
    if (!title.trim()) return
    await createAssignment.mutateAsync({
      title,
      description: description || undefined,
      maxScore: Number(maxScore) || 100,
      deadline: deadline || undefined,
    })
    setTitle('')
    setDescription('')
    setMaxScore('100')
    setDeadline('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
      className="flex flex-col gap-2 rounded-[var(--r-lg)] p-4"
      style={{ background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)' }}
    >
      <label className="flex flex-col gap-1">
        <span>Assignment title</span>
        <input
          aria-label="Assignment title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
          style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Description</span>
        <textarea
          aria-label="Assignment description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
          style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
        />
      </label>
      <div className="flex gap-2">
        <label className="flex flex-col gap-1">
          <span>Max score</span>
          <input
            aria-label="Max score"
            type="number"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
            style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Deadline</span>
          <input
            aria-label="Deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
            style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={!title.trim()}
        className="self-start rounded-[var(--r-pill)] px-4 py-2"
        style={{ background: 'var(--uc-indigo)', color: 'var(--on-accent)' }}
      >
        Create assignment
      </button>
    </form>
  )
}

const pill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 12px',
  fontSize: 12,
  borderRadius: 'var(--r-pill)',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const
const indigoPill = { ...pill, border: '0.5px solid var(--uc-indigo-bdr)', background: 'var(--uc-indigo-bg)', color: 'var(--uc-indigo-l)' } as const
const ghostPill = { ...pill, border: '0.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' } as const

function formatDue(iso: string | null | undefined) {
  if (!iso) return null
  const d = parseISO(iso)
  return isNaN(d.getTime()) ? null : format(d, 'd MMM, HH:mm')
}

function AdminAssignmentRow({ groupId, assignment, last }: { groupId: string; assignment: Assignment; last: boolean }) {
  const [showSubmissions, setShowSubmissions] = useState(false)
  const { data: submissions } = useSubmissions(groupId, assignment.id)
  const count = submissions?.length ?? 0
  const due = formatDue(assignment.deadline)

  return (
    <li style={{ padding: '12px 16px', borderBottom: last ? 'none' : '0.5px solid var(--border-subtle)', listStyle: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{assignment.title}</div>
          {assignment.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Topic · {assignment.description}</div>}
          {due && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Due {due}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{assignment.isPublished ? `${count} submitted` : 'Not open'}</span>
          <button type="button" onClick={() => setShowSubmissions((v) => !v)} style={indigoPill}>
            {assignment.isPublished ? (
              <>
                <ClipboardCheck size={12} strokeWidth={1.5} />
                {showSubmissions ? 'Hide submissions' : `Review ${count} ${count === 1 ? 'submission' : 'submissions'}`}
              </>
            ) : (
              <>
                <Unlock size={12} strokeWidth={1.5} />
                Open submissions
              </>
            )}
          </button>
        </div>
      </div>
      {showSubmissions && (
        <div style={{ marginTop: 10 }}>
          <SubmissionsList groupId={groupId} assignment={assignment} />
        </div>
      )}
    </li>
  )
}

function StudentAssignmentRow({ groupId, assignment, last }: { groupId: string; assignment: Assignment; last: boolean }) {
  const [submitting, setSubmitting] = useState(false)
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const submit = useSubmitAssignment(groupId, assignment.id)
  const due = formatDue(assignment.deadline)

  async function handleConfirm() {
    await submit.mutateAsync({ textContent: text })
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <li style={{ padding: '12px 16px', borderBottom: last ? 'none' : '0.5px solid var(--border-subtle)', listStyle: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{assignment.title}</div>
          {assignment.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Topic · {assignment.description}</div>}
          {due && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Due {due}</div>}
        </div>
        {!assignment.isPublished ? (
          <span style={{ ...ghostPill, cursor: 'default' }}>Not open yet</span>
        ) : submitting ? null : (
          <button type="button" onClick={() => setSubmitting(true)} style={indigoPill}>
            <Upload size={12} strokeWidth={1.5} />
            {submitted ? 'Replace file' : 'Submit work'}
          </button>
        )}
      </div>

      {submitted && !submitting && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--uc-mint)' }}>
          <FileCheck size={12} strokeWidth={1.5} />
          Submitted just now
          <button type="button" aria-label="Dismiss" onClick={() => setSubmitted(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'inline-flex' }}>
            <X size={12} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {submitting && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>Your answer</span>
            <textarea aria-label="Your answer" className="fld" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setSubmitting(false)} style={ghostPill}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleConfirm()} style={{ ...pill, border: 'none', background: 'var(--uc-indigo)', color: 'var(--on-accent)' }}>
              Confirm submit
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export function AssignmentsPanel({ groupId, isAdmin }: AssignmentsPanelProps) {
  const { data: assignments, isLoading } = useAssignments(groupId)
  if (isLoading || !assignments) return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading assignments…</div>

  return (
    <div className="flex flex-col gap-4">
      <ul style={{ margin: 0, padding: 0, background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {assignments.length === 0 && (
          <li style={{ padding: 16, fontSize: 13, color: 'var(--text-tertiary)', listStyle: 'none' }}>No assignments yet.</li>
        )}
        {assignments.map((a, i) =>
          isAdmin ? (
            <AdminAssignmentRow key={a.id} groupId={groupId} assignment={a} last={i === assignments.length - 1} />
          ) : (
            <StudentAssignmentRow key={a.id} groupId={groupId} assignment={a} last={i === assignments.length - 1} />
          ),
        )}
      </ul>
      {isAdmin && <CreateAssignmentForm groupId={groupId} />}
    </div>
  )
}
