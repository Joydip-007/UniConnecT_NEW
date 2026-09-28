import { useState } from 'react'
import { isAxiosError } from 'axios'
import { ArrowLeft, Check, Sparkles, Plus, GripVertical, Trash2, X, AlertTriangle } from 'lucide-react'
import type { AiPathDraft } from '@uniconnect/shared'
import { useCreateLearningPath, useSetPathPublished } from '../hooks/useLearningAdmin'
import { Chip, ChipRow, Field, SmallBtn } from './learningAdminUi'
import { cardStyle, capitalise, DIFFICULTIES, inputStyle, type Difficulty } from './learningAdminUi.styles'

export const BUILDER_DEPARTMENTS = ['CSE', 'EEE', 'BBA', 'English', 'All departments'] as const
export const BUILDER_CATEGORIES = ['Technical', 'Career', 'Communication', 'Research'] as const

type UnitKind = 'read' | 'video' | 'exercise' | 'quiz'
const KIND_LABEL: Record<UnitKind, string> = { read: 'Reading', video: 'Video', exercise: 'Exercise', quiz: 'Quiz' }

export interface BuilderUnit {
  key: number
  title: string
  type: UnitKind
  minutes: number
  content: Record<string, unknown>
  completionRule?: { passScore?: number }
}

export interface BuilderSeed {
  draft: AiPathDraft
  department: string | null
}

interface Props {
  /** Present when the builder was opened from "Generate draft" — pre-fills every field. */
  seed: BuilderSeed | null
  onExit: () => void
  onDraftWithAi: () => void
}

let nextKey = 1
const unitFromDraft = (u: AiPathDraft['units'][number]): BuilderUnit => ({
  key: nextKey++,
  title: u.title,
  type: u.type,
  minutes: u.estimatedMinutes,
  content: u.content,
  completionRule: u.completionRule,
})

function seedDepartment(dept: string | null): (typeof BUILDER_DEPARTMENTS)[number] {
  const match = BUILDER_DEPARTMENTS.find((d) => d.toLowerCase() === (dept ?? '').toLowerCase())
  return match ?? 'All departments'
}

/**
 * Full-column builder that replaces the Learning list while a new path is being authored.
 * "Save draft" creates the path unpublished; "Publish path" creates it and flips it live.
 */
export function LearningPathBuilder({ seed, onExit, onDraftWithAi }: Props) {
  const createPath = useCreateLearningPath()
  const setPublished = useSetPathPublished()

  const [title, setTitle] = useState(seed?.draft.title ?? '')
  const [description, setDescription] = useState(seed?.draft.description ?? '')
  const [department, setDepartment] = useState<(typeof BUILDER_DEPARTMENTS)[number]>(seedDepartment(seed?.department ?? null))
  const [category, setCategory] = useState<(typeof BUILDER_CATEGORIES)[number]>('Technical')
  const [difficulty, setDifficulty] = useState<Difficulty>(seed?.draft.difficulty ?? 'beginner')
  const [units, setUnits] = useState<BuilderUnit[]>(() => (seed ? seed.draft.units.map(unitFromDraft) : []))
  const [aiNote, setAiNote] = useState(!!seed)
  const [editing, setEditing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalMinutes = units.reduce((a, u) => a + u.minutes, 0)
  const pending = createPath.isPending || setPublished.isPending
  const canSave = title.trim().length > 0 && units.length > 0 && units.every((u) => u.title.trim().length > 0)

  function addUnit() {
    setUnits((list) => [...list, { key: nextKey++, title: 'Untitled unit', type: 'read', minutes: 10, content: { body: '' } }])
  }

  function patchUnit(key: number, patch: Partial<BuilderUnit>) {
    setUnits((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)))
  }

  async function submit(publish: boolean) {
    setError(null)
    try {
      const created = await createPath.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        department: department === 'All departments' ? null : department,
        category: category.toLowerCase(),
        difficulty,
        // The design has no "estimated days" field: roughly one study session per unit pair.
        estimatedDays: Math.min(90, Math.max(1, Math.ceil(units.length / 2))),
        units: units.map((u) => ({
          title: u.title.trim(),
          type: u.type,
          content: { ...u.content, estimatedMinutes: u.minutes },
          completionRule: u.completionRule,
        })),
      })
      if (publish) await setPublished.mutateAsync({ pathId: created.id, isPublished: true })
      onExit()
    } catch (e) {
      setError(isAxiosError(e) ? ((e.response?.data as { error?: string })?.error ?? 'Could not save the path.') : 'Could not save the path.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onExit}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: '6px 14px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={14} />
          Back to Learning
        </button>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <SmallBtn tone="ghost" size="bar" onClick={() => void submit(false)} disabled={!canSave || pending}>
            Save draft
          </SmallBtn>
          <SmallBtn tone="solid" size="bar" onClick={() => void submit(true)} disabled={!canSave || pending} icon={<Check size={14} />}>
            Publish path
          </SmallBtn>
        </div>
      </div>

      {aiNote && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--uc-indigo-bg)', border: '0.5px solid var(--uc-indigo-bdr)', borderRadius: 'var(--r-lg)' }}
        >
          <span style={{ flexShrink: 0, lineHeight: 0, color: 'var(--uc-indigo-xl)' }}>
            <Sparkles size={15} />
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            AI drafted {seed?.draft.units.length ?? 0} units below. Review each one before publishing.
          </span>
          <button
            type="button"
            onClick={() => setAiNote(false)}
            aria-label="Dismiss"
            style={{ flexShrink: 0, lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--uc-red-bg)', border: '0.5px solid var(--uc-red-bdr)', borderRadius: 'var(--r-lg)', fontSize: 12, color: 'var(--uc-red)' }}
        >
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div style={{ ...cardStyle, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Path title">
          <input type="text" aria-label="Path title" placeholder="e.g. Algorithms, properly" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Description">
          <textarea
            rows={3}
            aria-label="Description"
            placeholder="What will a student be able to do after finishing this path?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
          />
        </Field>
        <div className="learn-builder-two" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <Field label="Department">
            <ChipRow>
              {BUILDER_DEPARTMENTS.map((d) => (
                <Chip key={d} label={d} active={department === d} onClick={() => setDepartment(d)} />
              ))}
            </ChipRow>
          </Field>
          <Field label="Category">
            <ChipRow>
              {BUILDER_CATEGORIES.map((c) => (
                <Chip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
              ))}
            </ChipRow>
          </Field>
        </div>
        <Field label="Difficulty">
          <ChipRow>
            {DIFFICULTIES.map((d) => (
              <Chip key={d} label={capitalise(d)} active={difficulty === d} onClick={() => setDifficulty(d)} />
            ))}
          </ChipRow>
        </Field>
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: '0.5px solid var(--border-default)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Units</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {units.length} units · {totalMinutes} min total
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <SmallBtn tone="tint" onClick={onDraftWithAi} icon={<Sparkles size={14} />}>
              Draft with AI
            </SmallBtn>
            <SmallBtn tone="ghost" onClick={addUnit} icon={<Plus size={14} />}>
              Add unit
            </SmallBtn>
          </div>
        </div>
        {units.map((u, i) => (
          <div
            key={u.key}
            className="learn-unit-row"
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '0.5px solid var(--border-default)' }}
          >
            <span style={{ flexShrink: 0, color: 'var(--text-tertiary)', lineHeight: 0 }}>
              <GripVertical size={15} />
            </span>
            <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            {editing === u.key ? (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  autoFocus
                  aria-label={`Unit ${i + 1} title`}
                  value={u.title}
                  onChange={(e) => patchUnit(u.key, { title: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setEditing(null)
                  }}
                  style={{ ...inputStyle, flex: 1, minWidth: 160, padding: '7px 10px', fontSize: 13 }}
                />
                <select
                  aria-label={`Unit ${i + 1} kind`}
                  value={u.type}
                  onChange={(e) => patchUnit(u.key, { type: e.target.value as UnitKind })}
                  style={{ ...inputStyle, width: 'auto', padding: '7px 10px', fontSize: 13 }}
                >
                  {(Object.keys(KIND_LABEL) as UnitKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  aria-label={`Unit ${i + 1} minutes`}
                  value={u.minutes}
                  onChange={(e) => patchUnit(u.key, { minutes: Math.max(1, Number(e.target.value) || 1) })}
                  style={{ ...inputStyle, width: 72, padding: '7px 10px', fontSize: 13 }}
                />
                {u.type === 'video' && (
                  // The learner's player gates "Mark complete" on watching to the end, so a
                  // video unit without a URL falls back to its reading text.
                  <input
                    type="url"
                    aria-label={`Unit ${i + 1} video URL`}
                    placeholder="Video URL (mp4 or webm)"
                    value={typeof u.content.video_url === 'string' ? u.content.video_url : ''}
                    onChange={(e) => patchUnit(u.key, { content: { ...u.content, video_url: e.target.value.trim() } })}
                    style={{ ...inputStyle, flexBasis: '100%', padding: '7px 10px', fontSize: 13 }}
                  />
                )}
                <SmallBtn tone="tint" onClick={() => setEditing(null)}>
                  Done
                </SmallBtn>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {KIND_LABEL[u.type]} · {u.minutes} min
                  </div>
                </div>
                <SmallBtn tone="ghost" onClick={() => setEditing(u.key)} ariaLabel={`Edit unit ${i + 1}`}>
                  Edit
                </SmallBtn>
              </>
            )}
            <button
              type="button"
              onClick={() => setUnits((list) => list.filter((x) => x.key !== u.key))}
              aria-label={`Remove unit ${i + 1}`}
              className="learn-unit-remove"
              style={{ flexShrink: 0, lineHeight: 0, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 5 }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
