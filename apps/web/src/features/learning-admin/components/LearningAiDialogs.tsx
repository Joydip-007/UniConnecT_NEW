import { useState } from 'react'
import { isAxiosError } from 'axios'
import { Sparkles, WandSparkles, ListChecks, Plus, Trash2 } from 'lucide-react'
import type { AdminLearningPath, AiPathDraft, PendingQuizQuestion } from '@uniconnect/shared'
import { useCreatePathUnit, useDraftPathWithAi, useGenerateQuizWithAi } from '../hooks/useLearningAdmin'
import { Chip, ChipRow, DialogBtn, DialogFrame, Field } from './learningAdminUi'
import { LearningAiSettingsSection, QuizAiSettingsSection } from './AiScheduleSettings'
import { capitalise, DIFFICULTIES, modalInputStyle, modalTextareaStyle, type Difficulty } from './learningAdminUi.styles'

const errorText = (e: unknown, fallback: string) =>
  isAxiosError(e) ? ((e.response?.data as { error?: string })?.error ?? fallback) : fallback

const ErrorLine = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--uc-red)' }}>
      {text}
    </p>
  ) : null

/* ── Generate a learning path ─────────────────────────────────────────────── */

interface AiPathProps {
  open: boolean
  onClose: () => void
  /** Fires with the AI draft; the caller opens the builder pre-filled with it. */
  onGenerated: (draft: AiPathDraft, department: string | null) => void
}

export function AiPathDialog({ open, onClose, onGenerated }: AiPathProps) {
  const draftPath = useDraftPathWithAi()
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [unitCount, setUnitCount] = useState('8')
  const [department, setDepartment] = useState('')
  const [includeQuiz, setIncludeQuiz] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const count = Number(unitCount)
  const canGenerate = topic.trim().length >= 3 && Number.isInteger(count) && count >= 2 && count <= 30

  function generate() {
    setError(null)
    draftPath.mutate(
      { topic: topic.trim(), difficulty, unitCount: count, department: department.trim() || null, includeCheckpointQuizzes: includeQuiz },
      {
        onSuccess: (draft) => onGenerated(draft, department.trim() || null),
        onError: (e) => setError(errorText(e, 'Could not generate a draft. Try again.')),
      },
    )
  }

  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      icon={<Sparkles size={18} />}
      title="Generate a learning path"
      subtitle="AI drafts the units, you review and publish."
      maxWidth={560}
      footer={
        <>
          <DialogBtn tone="ghost" onClick={onClose}>
            Cancel
          </DialogBtn>
          <DialogBtn tone="solid" onClick={generate} disabled={!canGenerate || draftPath.isPending} icon={<Sparkles size={14} />}>
            {draftPath.isPending ? 'Generating…' : 'Generate draft'}
          </DialogBtn>
        </>
      }
    >
      <Field label="Topic or goal">
        <textarea
          aria-label="Topic or goal"
          placeholder="e.g. Data structures for second-year CSE, up to interview level"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={modalTextareaStyle}
        />
      </Field>
      <Field label="Difficulty">
        <ChipRow>
          {DIFFICULTIES.map((d) => (
            <Chip key={d} label={capitalise(d)} active={difficulty === d} onClick={() => setDifficulty(d)} />
          ))}
        </ChipRow>
      </Field>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Field label="Number of units">
            <input type="number" min={2} max={30} aria-label="Number of units" value={unitCount} onChange={(e) => setUnitCount(e.target.value)} style={modalInputStyle} />
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Field label="Department">
            <input type="text" aria-label="Department" placeholder="CSE" value={department} onChange={(e) => setDepartment(e.target.value)} style={modalInputStyle} />
          </Field>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={includeQuiz} onChange={(e) => setIncludeQuiz(e.target.checked)} style={{ accentColor: 'var(--uc-indigo)' }} />
        Include a checkpoint quiz per section
      </label>
      <LearningAiSettingsSection />
      <ErrorLine text={error} />
    </DialogFrame>
  )
}

/* ── Generate a quiz ──────────────────────────────────────────────────────── */

const STYLES = [
  { key: 'mcq', label: 'Multiple choice' },
  { key: 'true_false', label: 'True or false' },
  { key: 'mixed', label: 'Mixed' },
] as const

interface AiQuizProps {
  open: boolean
  paths: AdminLearningPath[]
  onClose: () => void
}

export function AiQuizDialog({ open, paths, onClose }: AiQuizProps) {
  const generateQuiz = useGenerateQuizWithAi()
  const [pathId, setPathId] = useState<string | null>(null)
  const [count, setCount] = useState('10')
  const [style, setStyle] = useState<(typeof STYLES)[number]['key']>('mcq')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [error, setError] = useState<string | null>(null)

  const selected = pathId ?? paths[0]?.id ?? null
  const n = Number(count)
  const canGenerate = !!selected && Number.isInteger(n) && n >= 1 && n <= 30

  function generate() {
    if (!selected) return
    setError(null)
    generateQuiz.mutate(
      { pathId: selected, count: n, style, difficulty },
      { onSuccess: onClose, onError: (e) => setError(errorText(e, 'Could not generate a quiz. Try again.')) },
    )
  }

  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      icon={<WandSparkles size={18} />}
      title="Generate a quiz"
      subtitle="Draw questions from an existing path's units."
      maxWidth={560}
      footer={
        <>
          <DialogBtn tone="ghost" onClick={onClose}>
            Cancel
          </DialogBtn>
          <DialogBtn tone="solid" onClick={generate} disabled={!canGenerate || generateQuiz.isPending} icon={<WandSparkles size={14} />}>
            {generateQuiz.isPending ? 'Generating…' : 'Generate quiz'}
          </DialogBtn>
        </>
      }
    >
      <Field label="Source path">
        {paths.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Create a learning path first.</p>
        ) : (
          <ChipRow>
            {paths.map((p) => (
              <Chip key={p.id} label={p.title} active={selected === p.id} onClick={() => setPathId(p.id)} />
            ))}
          </ChipRow>
        )}
      </Field>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Field label="Questions">
            <input type="number" min={1} max={30} aria-label="Questions" value={count} onChange={(e) => setCount(e.target.value)} style={modalInputStyle} />
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Field label="Question type">
            <select aria-label="Question type" value={style} onChange={(e) => setStyle(e.target.value as typeof style)} style={modalInputStyle}>
              {STYLES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <Field label="Difficulty">
        <ChipRow>
          {DIFFICULTIES.map((d) => (
            <Chip key={d} label={capitalise(d)} active={difficulty === d} onClick={() => setDifficulty(d)} />
          ))}
        </ChipRow>
      </Field>
      <QuizAiSettingsSection />
      <ErrorLine text={error} />
    </DialogFrame>
  )
}

/* ── New quiz (written by staff) ──────────────────────────────────────────── */

interface NewQuizProps {
  open: boolean
  paths: AdminLearningPath[]
  onClose: () => void
}

const blankQuestion = (): PendingQuizQuestion => ({ q: '', options: ['', '', '', ''], answer: 0 })

/** Same dialog chrome as the AI one, but the admin writes the questions — becomes a quiz unit on the chosen path. */
export function NewQuizDialog({ open, paths, onClose }: NewQuizProps) {
  const [pathId, setPathId] = useState<string | null>(null)
  const selected = pathId ?? paths[0]?.id ?? null
  const createUnit = useCreatePathUnit(selected ?? '')
  const [title, setTitle] = useState('')
  const [passMark, setPassMark] = useState('60')
  const [questions, setQuestions] = useState<PendingQuizQuestion[]>([blankQuestion()])
  const [error, setError] = useState<string | null>(null)

  const pass = Number(passMark)
  const complete = questions.every((qq) => qq.q.trim() && qq.options.every((o) => o.trim()))
  const canCreate = !!selected && title.trim().length > 0 && questions.length > 0 && complete && pass >= 0 && pass <= 100

  function patchQ(i: number, patch: Partial<PendingQuizQuestion>) {
    setQuestions((list) => list.map((qq, j) => (j === i ? { ...qq, ...patch } : qq)))
  }

  function create() {
    setError(null)
    createUnit.mutate(
      { title: title.trim(), type: 'quiz', content: { questions }, completionRule: { passScore: pass } },
      {
        onSuccess: () => {
          setTitle('')
          setQuestions([blankQuestion()])
          onClose()
        },
        onError: (e) => setError(errorText(e, 'Could not create the quiz.')),
      },
    )
  }

  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      icon={<ListChecks size={18} />}
      title="New quiz"
      subtitle="Write a checkpoint quiz for one of your paths."
      maxWidth={600}
      footer={
        <>
          <DialogBtn tone="ghost" onClick={onClose}>
            Cancel
          </DialogBtn>
          <DialogBtn tone="solid" onClick={create} disabled={!canCreate || createUnit.isPending} icon={<Plus size={14} />}>
            {createUnit.isPending ? 'Creating…' : 'Create quiz'}
          </DialogBtn>
        </>
      }
    >
      <Field label="Source path">
        {paths.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Create a learning path first.</p>
        ) : (
          <ChipRow>
            {paths.map((p) => (
              <Chip key={p.id} label={p.title} active={selected === p.id} onClick={() => setPathId(p.id)} />
            ))}
          </ChipRow>
        )}
      </Field>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 180 }}>
          <Field label="Quiz title">
            <input type="text" aria-label="Quiz title" placeholder="e.g. Sorting and complexity checkpoint" value={title} onChange={(e) => setTitle(e.target.value)} style={modalInputStyle} />
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 110 }}>
          <Field label="Pass mark %">
            <input type="number" min={0} max={100} aria-label="Pass mark" value={passMark} onChange={(e) => setPassMark(e.target.value)} style={modalInputStyle} />
          </Field>
        </div>
      </div>
      {questions.map((qq, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              aria-label={`Question ${i + 1}`}
              placeholder={`Question ${i + 1}`}
              value={qq.q}
              onChange={(e) => patchQ(i, { q: e.target.value })}
              style={{ ...modalInputStyle, flex: 1 }}
            />
            <button
              type="button"
              aria-label={`Remove question ${i + 1}`}
              disabled={questions.length === 1}
              onClick={() => setQuestions((list) => list.filter((_, j) => j !== i))}
              style={{ lineHeight: 0, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 5, opacity: questions.length === 1 ? 0.4 : 1 }}
            >
              <Trash2 size={15} />
            </button>
          </div>
          {qq.options.map((opt, oi) => (
            <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <input
                type="radio"
                name={`answer-${i}`}
                aria-label={`Question ${i + 1} correct option ${oi + 1}`}
                checked={qq.answer === oi}
                onChange={() => patchQ(i, { answer: oi })}
                style={{ accentColor: 'var(--uc-indigo)' }}
              />
              <input
                type="text"
                aria-label={`Question ${i + 1} option ${oi + 1}`}
                placeholder={`Option ${oi + 1}`}
                value={opt}
                onChange={(e) => patchQ(i, { options: qq.options.map((o, k) => (k === oi ? e.target.value : o)) })}
                style={{ ...modalInputStyle, height: 34, flex: 1 }}
              />
            </label>
          ))}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setQuestions((list) => [...list, blankQuestion()])}
        style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--uc-indigo-xl)', background: 'var(--uc-indigo-bg)', border: '0.5px solid var(--uc-indigo-bdr)', borderRadius: 'var(--r-pill)', padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <Plus size={14} /> Add question
      </button>
      <ErrorLine text={error} />
    </DialogFrame>
  )
}
