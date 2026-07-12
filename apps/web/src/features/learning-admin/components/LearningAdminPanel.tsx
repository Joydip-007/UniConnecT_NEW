import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Check, AlertTriangle, Play } from 'lucide-react'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import type { LearningTopic } from '@uniconnect/shared'
import {
  useLearningAdminConfig,
  useUpdateLearningAdminConfig,
  useTriggerLearningGenerate,
  usePendingPaths,
  useApprovePath,
  useDiscardPath,
  usePendingQuizBatches,
  useApproveQuizBatch,
  useDiscardQuizBatch,
  useUpcomingQuizzes,
  useLearningAnalytics,
} from '../hooks/useLearningAdmin'
import { PendingPathPreviewModal } from './PendingPathPreviewModal'
import { PendingQuizPreviewModal } from './PendingQuizPreviewModal'
import { formatDistanceToNow } from 'date-fns'

const card: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-page)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  padding: '9px 12px',
  color: 'var(--text-primary)',
  fontSize: 14,
}

export function LearningAdminPanel() {
  const { data: config, isLoading } = useLearningAdminConfig()
  const updateConfig = useUpdateLearningAdminConfig()
  const triggerGenerate = useTriggerLearningGenerate()
  
  const { data: pendingPaths } = usePendingPaths()
  const approvePath = useApprovePath()
  const discardPath = useDiscardPath()

  const { data: pendingQuizBatches } = usePendingQuizBatches(config?.quizRequireApproval ?? false)
  const approveQuizBatch = useApproveQuizBatch()
  const discardQuizBatch = useDiscardQuizBatch()

  const { data: upcomingQuizzes } = useUpcomingQuizzes()
  const [analyticsDays, setAnalyticsDays] = useState(14)
  const { data: analytics, isLoading: analyticsLoading } = useLearningAnalytics(analyticsDays)

  const [draft, setDraft] = useState({
    enabled: false,
    topics: [] as LearningTopic[],
    difficulty: '',
    language: '',
    estimatedDays: 0,
    customInstructions: '',
    genHour: 0,
    countPerRun: 0,
    quizEnabled: false,
    quizRequireApproval: false,
    quizDifficulty: '',
    quizLanguage: '',
    quizCount: 0,
    quizCustomInstructions: '',
  })

  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewPathId, setPreviewPathId] = useState<string | null>(null)
  const [previewQuizBatchId, setPreviewQuizBatchId] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      setDraft({
        enabled: config.enabled ?? false,
        topics: config.topics ?? [],
        difficulty: config.difficulty ?? '',
        language: config.language ?? '',
        estimatedDays: config.estimatedDays ?? 7,
        customInstructions: config.customInstructions ?? '',
        genHour: config.genHour ?? 0,
        countPerRun: config.countPerRun ?? 1,
        quizEnabled: config.quizEnabled ?? false,
        quizRequireApproval: config.quizRequireApproval ?? false,
        quizDifficulty: config.quizDifficulty ?? '',
        quizLanguage: config.quizLanguage ?? '',
        quizCount: config.quizCount ?? 5,
        quizCustomInstructions: config.quizCustomInstructions ?? '',
      })
    }
  }, [config])

  function save() {
    setError(null)
    updateConfig.mutate(
      {
        enabled: draft.enabled,
        topics: draft.topics,
        difficulty: draft.difficulty,
        language: draft.language,
        estimatedDays: draft.estimatedDays,
        customInstructions: draft.customInstructions || null,
        genHour: draft.genHour,
        countPerRun: draft.countPerRun,
        quizEnabled: draft.quizEnabled,
        quizRequireApproval: draft.quizRequireApproval,
        quizDifficulty: draft.quizDifficulty,
        quizLanguage: draft.quizLanguage,
        quizCount: draft.quizCount,
        quizCustomInstructions: draft.quizCustomInstructions || null,
      },
      {
        onSuccess: () => {
          setSavedMsg('Settings saved.')
          setTimeout(() => setSavedMsg(null), 4000)
        },
        onError: (e) => setError(extractError(e, 'Could not save settings.')),
      }
    )
  }

  async function generate() {
    setError(null)
    try {
      await updateConfig.mutateAsync({
        enabled: draft.enabled,
        topics: draft.topics,
        difficulty: draft.difficulty,
        language: draft.language,
        estimatedDays: draft.estimatedDays,
        customInstructions: draft.customInstructions || null,
        genHour: draft.genHour,
        countPerRun: draft.countPerRun,
        quizEnabled: draft.quizEnabled,
        quizRequireApproval: draft.quizRequireApproval,
        quizDifficulty: draft.quizDifficulty,
        quizLanguage: draft.quizLanguage,
        quizCount: draft.quizCount,
        quizCustomInstructions: draft.quizCustomInstructions || null,
      })
    } catch (e) {
      setError(extractError(e, 'Could not save settings.'))
      return
    }
    triggerGenerate.mutate(undefined, {
      onError: (e) => setError(extractError(e, 'Could not start generation.')),
    })
  }

  if (isLoading) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>

  const hasTopics = draft.topics.length > 0
  const canGenerate = (draft.enabled && hasTopics) || draft.quizEnabled

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {config?.lastAiError && (
        <div
          style={{
            ...card,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            border: '0.5px solid var(--uc-red-bdr)',
            background: 'var(--uc-red-bg)',
          }}
        >
          <AlertTriangle size={16} style={{ color: 'var(--uc-red)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--uc-red)' }}>
              {config.lastAiError.toLowerCase().includes('quota') ? 'AI quota reached' : 'AI generation error'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              {config.lastAiError}
              {config.lastAiErrorAt &&
                ` — ${formatDistanceToNow(new Date(config.lastAiErrorAt), { addSuffix: true })}`}
            </p>
          </div>
        </div>
      )}

      <div style={card}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Learning AI preferences</h3>
          <p style={{ ...labelStyle, marginTop: 4 }}>
            Configure topics and parameters for AI-generated learning paths and quizzes.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Topics</span>
          {draft.topics.map((topic, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Category (e.g. React, Physics)"
                value={topic.category}
                onChange={(e) => {
                  const newTopics = [...draft.topics]
                  newTopics[i].category = e.target.value
                  setDraft({ ...draft, topics: newTopics })
                }}
              />
              <select
                style={{ ...inputStyle, width: 140 }}
                value={topic.difficulty ?? ''}
                onChange={(e) => {
                  const newTopics = [...draft.topics]
                  newTopics[i].difficulty = (e.target.value || undefined) as 'beginner' | 'intermediate' | 'advanced' | undefined
                  setDraft({ ...draft, topics: newTopics })
                }}
              >
                <option value="">Any difficulty</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const newTopics = draft.topics.filter((_, idx) => idx !== i)
                  setDraft({ ...draft, topics: newTopics })
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--uc-red)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setDraft({ ...draft, topics: [...draft.topics, { category: '', difficulty: 'beginner' }] })
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--uc-indigo)',
              cursor: 'pointer',
              fontSize: 14,
              textAlign: 'left',
              marginTop: 4,
            }}
          >
            + Add topic
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>General difficulty</span>
          <select
            style={inputStyle}
            value={draft.difficulty}
            onChange={(e) => setDraft((d) => ({ ...d, difficulty: e.target.value }))}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Language</span>
          <select
            style={inputStyle}
            value={draft.language}
            onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))}
          >
            <option value="en">English (en)</option>
            <option value="bn">Bengali (bn)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Estimated days per path</span>
          <input
            style={inputStyle}
            type="number"
            value={draft.estimatedDays}
            onChange={(e) => setDraft((d) => ({ ...d, estimatedDays: Number(e.target.value) }))}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Generation hour (0-23)</span>
          <input
            style={inputStyle}
            type="number"
            min={0}
            max={23}
            value={draft.genHour}
            onChange={(e) => setDraft((d) => ({ ...d, genHour: Number(e.target.value) }))}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Count per run</span>
          <input
            style={inputStyle}
            type="number"
            min={1}
            value={draft.countPerRun}
            onChange={(e) => setDraft((d) => ({ ...d, countPerRun: Number(e.target.value) }))}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Custom instructions</span>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            value={draft.customInstructions}
            onChange={(e) => setDraft((d) => ({ ...d, customInstructions: e.target.value }))}
            placeholder="Additional context for the AI"
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.quizRequireApproval}
            onChange={(e) => setDraft((d) => ({ ...d, quizRequireApproval: e.target.checked }))}
          />
          <span style={{ fontSize: 14 }}>Require approval for AI-generated quizzes</span>
        </label>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          <h4 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>Quiz Settings</h4>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.quizEnabled}
            onChange={(e) => setDraft((d) => ({ ...d, quizEnabled: e.target.checked }))}
          />
          <span style={{ fontSize: 14 }}>Enable quiz generation</span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Quiz difficulty</span>
          <select
            style={inputStyle}
            value={draft.quizDifficulty}
            onChange={(e) => setDraft((d) => ({ ...d, quizDifficulty: e.target.value }))}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Quiz language</span>
          <select
            style={inputStyle}
            value={draft.quizLanguage}
            onChange={(e) => setDraft((d) => ({ ...d, quizLanguage: e.target.value }))}
          >
            <option value="en">English (en)</option>
            <option value="bn">Bengali (bn)</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Questions per department run</span>
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={20}
            value={draft.quizCount}
            onChange={(e) => setDraft((d) => ({ ...d, quizCount: Number(e.target.value) }))}
          />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Quiz custom instructions (to prevent repetition)</span>
          <textarea
            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            value={draft.quizCustomInstructions}
            onChange={(e) => setDraft((d) => ({ ...d, quizCustomInstructions: e.target.value }))}
            placeholder="e.g. Ensure the quiz asks about varied sub-topics to avoid repeating yesterday's questions."
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
          />
          <span style={{ fontSize: 14 }}>Enable Learning AI generation</span>
        </label>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <PrimaryBtn onClick={save} disabled={updateConfig.isPending}>
            {updateConfig.isPending ? 'Saving…' : 'Save settings'}
          </PrimaryBtn>
          <GhostBtn
            onClick={() => void generate()}
            disabled={!canGenerate || triggerGenerate.isPending || updateConfig.isPending}
          >
            <Play size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
            Generate now
          </GhostBtn>
          {savedMsg && (
            <span style={{ fontSize: 13, color: 'var(--uc-mint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={14} /> {savedMsg}
            </span>
          )}
          {error && (
            <span style={{ fontSize: 13, color: 'var(--uc-red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={14} /> {error}
            </span>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Pending paths</h3>
            <p style={{ ...labelStyle, marginTop: 4 }}>
              Review AI-generated learning paths before they are published to students.
            </p>
          </div>
        </div>

        {(!pendingPaths || pendingPaths.length === 0) ? (
          <p style={labelStyle}>No pending AI-generated paths.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingPaths.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  background: 'var(--surface-page)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </p>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {item.category} • {item.difficulty} • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setPreviewPathId(item.id)}
                    className="rounded-[var(--r-pill)] border-[0.5px] px-4 py-1"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => approvePath.mutate(item.id)}
                    disabled={approvePath.isPending}
                    className="rounded-[var(--r-pill)] px-4 py-1"
                    style={{ background: 'var(--uc-indigo)', color: 'var(--on-accent)' }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => discardPath.mutate(item.id)}
                    disabled={discardPath.isPending}
                    className="rounded-[var(--r-pill)] border-[0.5px] px-4 py-1"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {draft.quizRequireApproval && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Pending quiz batches</h3>
              <p style={{ ...labelStyle, marginTop: 4 }}>
                Review AI-generated quiz batches before publishing.
              </p>
            </div>
          </div>

          {(!pendingQuizBatches || pendingQuizBatches.length === 0) ? (
            <p style={labelStyle}>No pending quiz batches.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingQuizBatches.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    background: 'var(--surface-page)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Batch: {item.id.slice(0, 8)}
                    </p>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {item.department} • {formatDistanceToNow(new Date(item.generated_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setPreviewQuizBatchId(item.id)}
                      className="rounded-[var(--r-pill)] border-[0.5px] px-4 py-1"
                      style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => approveQuizBatch.mutate(item.id)}
                      disabled={approveQuizBatch.isPending}
                      className="rounded-[var(--r-pill)] px-4 py-1"
                      style={{ background: 'var(--uc-indigo)', color: 'var(--on-accent)' }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => discardQuizBatch.mutate(item.id)}
                      disabled={discardQuizBatch.isPending}
                      className="rounded-[var(--r-pill)] border-[0.5px] px-4 py-1"
                      style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Upcoming quizzes</h3>
          <p style={{ ...labelStyle, marginTop: 4 }}>
            Quiz slots generate one day at a time, so there's no future-dated schedule to show — this is
            today's generated slots plus the AI question pool queued per department for the days ahead.
          </p>
        </div>

        <div>
          <p style={{ ...labelStyle, marginBottom: 8, fontWeight: 500 }}>Today</p>
          {!upcomingQuizzes || upcomingQuizzes.today.length === 0 ? (
            <p style={labelStyle}>No quiz slots generated today yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingQuizzes.today.map((slot) => (
                <div
                  key={`${slot.department}-${slot.date}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--r-md)',
                    border: '0.5px solid var(--border-default)',
                    background: 'var(--surface-page)',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{slot.department}</span>
                  <span style={labelStyle}>{slot.attemptCount} attempt{slot.attemptCount === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p style={{ ...labelStyle, marginBottom: 8, fontWeight: 500 }}>Queued for upcoming days</p>
          {!upcomingQuizzes || upcomingQuizzes.queuedByDepartment.length === 0 ? (
            <p style={labelStyle}>No approved questions queued.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingQuizzes.queuedByDepartment.map((row) => (
                <div
                  key={row.department}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--r-md)',
                    border: '0.5px solid var(--border-default)',
                    background: 'var(--surface-page)',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{row.department}</span>
                  <span style={labelStyle}>{row.queuedBatches} batch{row.queuedBatches === 1 ? '' : 'es'} queued</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>Participation &amp; outcomes</h3>
            <p style={{ ...labelStyle, marginTop: 4 }}>
              Learning path completion and quiz performance across students.
            </p>
          </div>
          <select
            value={analyticsDays}
            onChange={(e) => setAnalyticsDays(Number(e.target.value))}
            style={{ ...inputStyle, width: 'auto' }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {analyticsLoading || !analytics ? (
          <p style={labelStyle}>Loading…</p>
        ) : (
          <>
            <div>
              <p style={{ ...labelStyle, marginBottom: 8, fontWeight: 500 }}>Learning paths</p>
              {analytics.paths.length === 0 ? (
                <p style={labelStyle}>No published paths yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {analytics.paths.map((p) => (
                    <div
                      key={p.pathId}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        padding: '10px 12px',
                        borderRadius: 'var(--r-md)',
                        border: '0.5px solid var(--border-default)',
                        background: 'var(--surface-page)',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.title}</span>
                      <span style={labelStyle}>
                        {p.enrolledCount} enrolled · {p.completedCount} completed (
                        {Math.round(p.completionRate * 100)}%)
                        {p.avgUnitScore !== null ? ` · avg unit score ${Math.round(p.avgUnitScore)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p style={{ ...labelStyle, marginBottom: 8, fontWeight: 500 }}>Daily quizzes</p>
              {analytics.quizzes.length === 0 ? (
                <p style={labelStyle}>No quiz attempts in this window.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {analytics.quizzes.map((q) => (
                    <div
                      key={q.department}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        padding: '10px 12px',
                        borderRadius: 'var(--r-md)',
                        border: '0.5px solid var(--border-default)',
                        background: 'var(--surface-page)',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {q.department}
                      </span>
                      <span style={labelStyle}>
                        {q.attemptCount} attempt{q.attemptCount === 1 ? '' : 's'} · avg score{' '}
                        {Math.round(q.avgScore)} · {Math.round(q.passRate * 100)}% pass rate
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <PendingPathPreviewModal
        pathId={previewPathId}
        open={previewPathId !== null}
        onClose={() => setPreviewPathId(null)}
      />
      <PendingQuizPreviewModal
        batchId={previewQuizBatchId}
        open={previewQuizBatchId !== null}
        onClose={() => setPreviewQuizBatchId(null)}
      />
    </div>
  )
}

function extractError(error: unknown, fallback: string): string {
  if (isAxiosError(error)) return (error.response?.data as { error?: string })?.error ?? fallback
  return fallback
}
