import { useState } from 'react'
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

function AssignmentRow({ groupId, assignment, isAdmin }: { groupId: string; assignment: Assignment; isAdmin: boolean }) {
  const [submitting, setSubmitting] = useState(false)
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [showSubmissions, setShowSubmissions] = useState(false)
  const submit = useSubmitAssignment(groupId, assignment.id)

  async function handleConfirm() {
    await submit.mutateAsync({ textContent: text })
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <li
      className="flex flex-col gap-2 rounded-[var(--r-md)] p-3"
      style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)' }}
    >
      <div className="flex items-center justify-between">
        <span>{assignment.title}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Max score: {assignment.maxScore}</span>
      </div>

      {!isAdmin && (
        <>
          {submitted ? (
            <p>Submitted ✓</p>
          ) : submitting ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span>Your answer</span>
                <textarea
                  aria-label="Your answer"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
                  style={{ borderColor: 'var(--border-default)', background: 'var(--surface-page)' }}
                />
              </label>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                className="self-start rounded-[var(--r-pill)] px-4 py-2"
                style={{ background: 'var(--uc-indigo)', color: 'var(--on-accent)' }}
              >
                Confirm submit
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSubmitting(true)}
              className="self-start rounded-[var(--r-pill)] border-[0.5px] px-4 py-2"
              style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
            >
              Submit
            </button>
          )}
        </>
      )}

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowSubmissions((v) => !v)}
            className="self-start rounded-[var(--r-pill)] border-[0.5px] px-4 py-2"
            style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
          >
            {showSubmissions ? 'Hide submissions' : 'View submissions'}
          </button>
          {showSubmissions && <SubmissionsList groupId={groupId} assignment={assignment} />}
        </div>
      )}
    </li>
  )
}

export function AssignmentsPanel({ groupId, isAdmin }: AssignmentsPanelProps) {
  const { data: assignments, isLoading } = useAssignments(groupId)
  if (isLoading || !assignments) return <div>Loading assignments…</div>

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {assignments.map((a) => (
          <AssignmentRow key={a.id} groupId={groupId} assignment={a} isAdmin={isAdmin} />
        ))}
      </ul>
      {isAdmin && <CreateAssignmentForm groupId={groupId} />}
    </div>
  )
}
