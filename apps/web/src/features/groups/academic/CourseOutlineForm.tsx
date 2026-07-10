import { useState } from 'react'
import { useCourseOutline, useSaveCourseOutline } from '../hooks/useGroupExtended'
import type { CourseOutlineAssessment, CourseOutlineTopic } from '../types'

interface CourseOutlineFormProps {
  groupId: string
}

export function CourseOutlineForm({ groupId }: CourseOutlineFormProps) {
  const { data: outline } = useCourseOutline(groupId)
  const save = useSaveCourseOutline(groupId, outline ? 'replace' : 'create')

  const [courseTitle, setCourseTitle] = useState(outline?.courseTitle ?? '')
  const [gradingScale, setGradingScale] = useState<'uiu' | 'ugc' | 'custom'>(outline?.gradingScale ?? 'uiu')
  const [assessments, setAssessments] = useState<CourseOutlineAssessment[]>(outline?.assessments ?? [])
  const [topics, setTopics] = useState<CourseOutlineTopic[]>(outline?.topics ?? [])

  const weightSum = assessments.reduce((sum, a) => sum + (a.weightPercent || 0), 0)
  const weightValid = Math.abs(weightSum - 100) < 0.01

  function addAssessment() {
    setAssessments((prev) => [
      ...prev,
      { categoryName: '', fullMarks: 0, weightPercent: 0, totalGiven: 1, bestNCounted: 1, displayOrder: prev.length + 1 },
    ])
  }

  function updateAssessment(index: number, patch: Partial<CourseOutlineAssessment>) {
    setAssessments((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function removeAssessment(index: number) {
    setAssessments((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    await save.mutateAsync({ courseTitle, gradingScale, assessments, topics })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1">
        <span>Course title</span>
        <input
          aria-label="Course title"
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
          className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
          style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span>Grading scale</span>
        <select
          aria-label="Grading scale"
          value={gradingScale}
          onChange={(e) => setGradingScale(e.target.value as 'uiu' | 'ugc' | 'custom')}
        >
          <option value="uiu">UIU</option>
          <option value="ugc">UGC</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      <div className="flex flex-col gap-2">
        {assessments.map((a, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              aria-label="Category name"
              value={a.categoryName}
              onChange={(e) => updateAssessment(i, { categoryName: e.target.value })}
            />
            <input
              aria-label="Weight percent"
              type="number"
              value={a.weightPercent}
              onChange={(e) => updateAssessment(i, { weightPercent: Number(e.target.value) })}
            />
            <span>
              Count best {a.bestNCounted} of {a.totalGiven} given
            </span>
            <button type="button" onClick={() => removeAssessment(i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addAssessment}>
          Add assessment
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {topics.map((t, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              aria-label="Week number"
              type="number"
              value={t.weekNumber}
              onChange={(e) =>
                setTopics((prev) => prev.map((p, idx) => (idx === i ? { ...p, weekNumber: Number(e.target.value) } : p)))
              }
            />
            <input
              aria-label="Topic title"
              value={t.title}
              onChange={(e) =>
                setTopics((prev) => prev.map((p, idx) => (idx === i ? { ...p, title: e.target.value } : p)))
              }
            />
            <button type="button" onClick={() => setTopics((prev) => prev.filter((_, idx) => idx !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setTopics((prev) => [...prev, { weekNumber: prev.length + 1, title: '' }])}
        >
          Add topic
        </button>
      </div>

      <div
        data-testid="weight-sum-indicator"
        data-valid={weightValid}
        style={{ color: weightValid ? 'var(--uc-mint)' : 'var(--uc-red)' }}
      >
        Total weight: {weightSum}%
      </div>

      <button type="submit" disabled={!weightValid || !courseTitle} className="rounded-[var(--r-pill)] px-4 py-2">
        Save course outline
      </button>
    </form>
  )
}
