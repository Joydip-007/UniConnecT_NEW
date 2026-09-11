import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Play, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { LearningAdminConfig, LearningAdminConfigInput, LearningTopic } from '@uniconnect/shared'
import { useLearningAdminConfig, useTriggerLearningGenerate, useUpdateLearningAdminConfig } from '../hooks/useLearningAdmin'
import { Chip, ChipRow, Field, SmallBtn } from './learningAdminUi'
import { capitalise, DIFFICULTIES, modalInputStyle, modalTextareaStyle, type Difficulty } from './learningAdminUi.styles'

/**
 * The scheduled-generation preferences, split by what each dialog is about: the
 * learning-path half lives inside "Draft with AI", the quiz half inside "Generate
 * with AI". Both save a partial PATCH to the same config row.
 */

const errorText = (e: unknown, fallback: string) =>
  isAxiosError(e) ? ((e.response?.data as { error?: string })?.error ?? fallback) : fallback

function Disclosure({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 12px',
          background: 'var(--surface-raised)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>
        </div>
        <span style={{ color: 'var(--text-tertiary)', lineHeight: 0 }}>{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
      </button>
      {open && <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>}
    </div>
  )
}

function AiErrorNote({ config }: { config: LearningAdminConfig }) {
  if (!config.lastAiError) return null
  return (
    <div
      role="alert"
      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'var(--uc-red-bg)', border: '0.5px solid var(--uc-red-bdr)', borderRadius: 'var(--r-md)' }}
    >
      <AlertTriangle size={14} style={{ color: 'var(--uc-red)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0, fontSize: 12 }}>
        <div style={{ color: 'var(--uc-red)' }}>{config.lastAiError.toLowerCase().includes('quota') ? 'AI quota reached' : 'AI generation error'}</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
          {config.lastAiError}
          {config.lastAiErrorAt && ` — ${formatDistanceToNow(new Date(config.lastAiErrorAt), { addSuffix: true })}`}
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: 'var(--uc-indigo)' }} />
      {label}
    </label>
  )
}

function SaveRow({
  pending,
  canGenerate,
  generatePending,
  onSave,
  onGenerate,
  savedMsg,
  error,
}: {
  pending: boolean
  canGenerate: boolean
  generatePending: boolean
  onSave: () => void
  onGenerate: () => void
  savedMsg: string | null
  error: string | null
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <SmallBtn tone="tint" onClick={onSave} disabled={pending}>
        {pending ? 'Saving…' : 'Save schedule'}
      </SmallBtn>
      <SmallBtn tone="ghost" onClick={onGenerate} disabled={!canGenerate || pending || generatePending} icon={<Play size={13} />}>
        Run now
      </SmallBtn>
      {savedMsg && (
        <span style={{ fontSize: 12, color: 'var(--uc-mint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Check size={13} /> {savedMsg}
        </span>
      )}
      {error && (
        <span role="alert" style={{ fontSize: 12, color: 'var(--uc-red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={13} /> {error}
        </span>
      )}
    </div>
  )
}

function useSaveFlow(task: 'learning' | 'quiz') {
  const updateConfig = useUpdateLearningAdminConfig()
  const trigger = useTriggerLearningGenerate()
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function save(patch: LearningAdminConfigInput, then?: () => void) {
    setError(null)
    updateConfig.mutate(patch, {
      onSuccess: () => {
        setSavedMsg('Saved.')
        setTimeout(() => setSavedMsg(null), 4000)
        then?.()
      },
      onError: (e) => setError(errorText(e, 'Could not save settings.')),
    })
  }

  function generate(patch: LearningAdminConfigInput) {
    save(patch, () => trigger.mutate(task, { onError: (e) => setError(errorText(e, 'Could not start generation.')) }))
  }

  return { save, generate, pending: updateConfig.isPending, generatePending: trigger.isPending, savedMsg, error }
}

/* ── Learning paths ───────────────────────────────────────────────────────── */

export function LearningAiSettingsSection() {
  const { data: config } = useLearningAdminConfig()
  const flow = useSaveFlow('learning')
  const [d, setD] = useState({
    enabled: false,
    topics: [] as LearningTopic[],
    difficulty: 'beginner' as Difficulty,
    language: 'en' as 'en' | 'bn',
    estimatedDays: 7,
    genHour: 0,
    countPerRun: 1,
    customInstructions: '',
  })

  useEffect(() => {
    if (!config) return
    setD({
      enabled: config.enabled ?? false,
      topics: config.topics ?? [],
      difficulty: (config.difficulty as Difficulty) || 'beginner',
      language: (config.language as 'en' | 'bn') || 'en',
      estimatedDays: config.estimatedDays ?? 7,
      genHour: config.genHour ?? 0,
      countPerRun: config.countPerRun ?? 1,
      customInstructions: config.customInstructions ?? '',
    })
  }, [config])

  const patch = (): LearningAdminConfigInput => ({
    enabled: d.enabled,
    topics: d.topics.filter((t) => t.category.trim()),
    difficulty: d.difficulty,
    language: d.language,
    estimatedDays: d.estimatedDays,
    genHour: d.genHour,
    countPerRun: d.countPerRun,
    customInstructions: d.customInstructions || null,
  })
  const canGenerate = d.enabled && d.topics.some((t) => t.category.trim())

  return (
    <Disclosure title="Scheduled generation" sub="Let the nightly job draft paths from a topic list, ready for review under Drafts.">
      {config && <AiErrorNote config={config} />}
      <Toggle label="Enable scheduled learning-path generation" checked={d.enabled} onChange={(v) => setD({ ...d, enabled: v })} />
      <Field label="Topics">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {d.topics.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                aria-label={`Topic ${i + 1}`}
                placeholder="e.g. React, Physics"
                value={t.category}
                onChange={(e) => setD({ ...d, topics: d.topics.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)) })}
                style={{ ...modalInputStyle, height: 34, flex: 1 }}
              />
              <select
                aria-label={`Topic ${i + 1} difficulty`}
                value={t.difficulty ?? ''}
                onChange={(e) =>
                  setD({
                    ...d,
                    topics: d.topics.map((x, j) => (j === i ? { ...x, difficulty: (e.target.value || undefined) as Difficulty | undefined } : x)),
                  })
                }
                style={{ ...modalInputStyle, height: 34, width: 130 }}
              >
                <option value="">Any difficulty</option>
                {DIFFICULTIES.map((k) => (
                  <option key={k} value={k}>
                    {capitalise(k)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`Remove topic ${i + 1}`}
                onClick={() => setD({ ...d, topics: d.topics.filter((_, j) => j !== i) })}
                style={{ lineHeight: 0, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 5 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div>
            <SmallBtn tone="ghost" onClick={() => setD({ ...d, topics: [...d.topics, { category: '', difficulty: 'beginner' }] })}>
              Add topic
            </SmallBtn>
          </div>
        </div>
      </Field>
      <Field label="Default difficulty">
        <ChipRow>
          {DIFFICULTIES.map((k) => (
            <Chip key={k} label={capitalise(k)} active={d.difficulty === k} onClick={() => setD({ ...d, difficulty: k })} />
          ))}
        </ChipRow>
      </Field>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 110 }}>
          <Field label="Language">
            <select aria-label="Language" value={d.language} onChange={(e) => setD({ ...d, language: e.target.value as 'en' | 'bn' })} style={modalInputStyle}>
              <option value="en">English</option>
              <option value="bn">Bengali</option>
            </select>
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 110 }}>
          <Field label="Days per path">
            <input type="number" min={1} max={90} aria-label="Estimated days per path" value={d.estimatedDays} onChange={(e) => setD({ ...d, estimatedDays: Number(e.target.value) })} style={modalInputStyle} />
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 110 }}>
          <Field label="Run hour (UTC)">
            <input type="number" min={0} max={23} aria-label="Generation hour" value={d.genHour} onChange={(e) => setD({ ...d, genHour: Number(e.target.value) })} style={modalInputStyle} />
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 110 }}>
          <Field label="Paths per run">
            <input type="number" min={1} max={5} aria-label="Count per run" value={d.countPerRun} onChange={(e) => setD({ ...d, countPerRun: Number(e.target.value) })} style={modalInputStyle} />
          </Field>
        </div>
      </div>
      <Field label="Custom instructions">
        <textarea aria-label="Custom instructions" placeholder="Additional context for the AI" value={d.customInstructions} onChange={(e) => setD({ ...d, customInstructions: e.target.value })} style={{ ...modalTextareaStyle, minHeight: 56 }} />
      </Field>
      <SaveRow
        pending={flow.pending}
        generatePending={flow.generatePending}
        canGenerate={canGenerate}
        onSave={() => flow.save(patch())}
        onGenerate={() => flow.generate(patch())}
        savedMsg={flow.savedMsg}
        error={flow.error}
      />
    </Disclosure>
  )
}

/* ── Quizzes ──────────────────────────────────────────────────────────────── */

export function QuizAiSettingsSection() {
  const { data: config } = useLearningAdminConfig()
  const flow = useSaveFlow('quiz')
  const [d, setD] = useState({
    quizEnabled: false,
    quizRequireApproval: false,
    quizDifficulty: 'beginner' as Difficulty,
    quizLanguage: 'en' as 'en' | 'bn',
    quizCount: 5,
    quizCustomInstructions: '',
  })

  useEffect(() => {
    if (!config) return
    setD({
      quizEnabled: config.quizEnabled ?? false,
      quizRequireApproval: config.quizRequireApproval ?? false,
      quizDifficulty: (config.quizDifficulty as Difficulty) || 'beginner',
      quizLanguage: (config.quizLanguage as 'en' | 'bn') || 'en',
      quizCount: config.quizCount ?? 5,
      quizCustomInstructions: config.quizCustomInstructions ?? '',
    })
  }, [config])

  const patch = (): LearningAdminConfigInput => ({
    quizEnabled: d.quizEnabled,
    quizRequireApproval: d.quizRequireApproval,
    quizDifficulty: d.quizDifficulty,
    quizLanguage: d.quizLanguage,
    quizCount: d.quizCount,
    quizCustomInstructions: d.quizCustomInstructions || null,
  })

  return (
    <Disclosure title="Daily quiz generation" sub="Per-department question batches for the daily quiz; reviewed ones show under Needs review.">
      {config && <AiErrorNote config={config} />}
      <Toggle label="Enable daily quiz generation" checked={d.quizEnabled} onChange={(v) => setD({ ...d, quizEnabled: v })} />
      <Toggle label="Require approval before a batch goes live" checked={d.quizRequireApproval} onChange={(v) => setD({ ...d, quizRequireApproval: v })} />
      <Field label="Difficulty">
        <ChipRow>
          {DIFFICULTIES.map((k) => (
            <Chip key={k} label={capitalise(k)} active={d.quizDifficulty === k} onClick={() => setD({ ...d, quizDifficulty: k })} />
          ))}
        </ChipRow>
      </Field>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Field label="Language">
            <select aria-label="Quiz language" value={d.quizLanguage} onChange={(e) => setD({ ...d, quizLanguage: e.target.value as 'en' | 'bn' })} style={modalInputStyle}>
              <option value="en">English</option>
              <option value="bn">Bengali</option>
            </select>
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Field label="Questions per department">
            <input type="number" min={1} max={20} aria-label="Questions per department run" value={d.quizCount} onChange={(e) => setD({ ...d, quizCount: Number(e.target.value) })} style={modalInputStyle} />
          </Field>
        </div>
      </div>
      <Field label="Custom instructions">
        <textarea
          aria-label="Quiz custom instructions"
          placeholder="e.g. Vary the sub-topics so questions don't repeat yesterday's."
          value={d.quizCustomInstructions}
          onChange={(e) => setD({ ...d, quizCustomInstructions: e.target.value })}
          style={{ ...modalTextareaStyle, minHeight: 56 }}
        />
      </Field>
      <SaveRow
        pending={flow.pending}
        generatePending={flow.generatePending}
        canGenerate={d.quizEnabled}
        onSave={() => flow.save(patch())}
        onGenerate={() => flow.generate(patch())}
        savedMsg={flow.savedMsg}
        error={flow.error}
      />
    </Disclosure>
  )
}
