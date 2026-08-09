import {
  useAiSettings,
  useApprovePendingAiContent,
  useCourseOutline,
  useDiscardPendingAiContent,
  usePendingAiContent,
  useUpdateAiSettings,
  type GroupAISettings,
} from '../hooks/useGroupExtended'

interface AISettingsPanelProps {
  groupId: string
}

const inputStyle = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-primary)',
  padding: '7px 10px',
  fontSize: 13,
  fontWeight: 400,
} as const

export function AISettingsPanel({ groupId }: AISettingsPanelProps) {
  const { data: settings, isLoading } = useAiSettings(groupId)
  const update = useUpdateAiSettings(groupId)
  const { data: outline } = useCourseOutline(groupId)
  const { data: pending } = usePendingAiContent(groupId)
  const approve = useApprovePendingAiContent(groupId)
  const discard = useDiscardPendingAiContent(groupId)

  if (isLoading || !settings) return <div>Loading AI settings…</div>

  const anyEnabled = settings.ai_flashcards_enabled || settings.ai_quiz_enabled

  return (
    <div className="flex flex-col gap-4">
      {anyEnabled && !outline && (
        <div
          className="rounded-[var(--r-md)] px-3 py-3"
          style={{ background: 'var(--uc-orange-bg)', color: 'var(--uc-orange-l)', border: '0.5px solid var(--uc-orange-bdr)' }}
        >
          Set up your Course Outline for better AI topic targeting
        </div>
      )}

      <div
        className="flex flex-col gap-3 rounded-[var(--r-md)] p-4"
        style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)' }}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-label="Daily quiz"
            checked={settings.ai_quiz_enabled}
            onChange={(e) => update.mutate({ ai_quiz_enabled: e.target.checked })}
          />
          <span>Daily quiz</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-label="AI flashcards"
            checked={settings.ai_flashcards_enabled}
            onChange={(e) => update.mutate({ ai_flashcards_enabled: e.target.checked })}
          />
          <span>AI flashcards</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-label="Require approval before posting"
            checked={settings.require_approval}
            onChange={(e) => update.mutate({ require_approval: e.target.checked })}
          />
          <span>Require approval before posting</span>
        </label>
      </div>

      <div
        className="flex flex-col gap-3 rounded-[var(--r-md)] p-4"
        style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)' }}
      >
        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subject</span>
          <input
            aria-label="Subject"
            defaultValue={settings.subject ?? ''}
            onBlur={(e) => update.mutate({ subject: e.target.value })}
            placeholder="Falls back to your course outline, then the group name"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Difficulty</span>
          <select
            aria-label="Difficulty"
            value={settings.difficulty ?? 'intermediate'}
            onChange={(e) => update.mutate({ difficulty: e.target.value as GroupAISettings['difficulty'] })}
            style={inputStyle}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Question style</span>
          <select
            aria-label="Question style"
            value={settings.question_style ?? 'mcq'}
            onChange={(e) => update.mutate({ question_style: e.target.value as GroupAISettings['question_style'] })}
            style={inputStyle}
          >
            <option value="mcq">Multiple choice</option>
            <option value="true_false">True or false</option>
            <option value="short_answer">Short answer</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Language</span>
          <select
            aria-label="Language"
            value={settings.language}
            onChange={(e) => update.mutate({ language: e.target.value as 'en' | 'bn' })}
            style={inputStyle}
          >
            <option value="en">English</option>
            <option value="bn">Bangla</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Items per run</span>
          <input
            aria-label="Items per run"
            type="number"
            min={1}
            max={20}
            defaultValue={settings.items_per_run}
            onBlur={(e) => update.mutate({ items_per_run: Number(e.target.value) })}
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Frequency</span>
          <select
            aria-label="Frequency"
            value={settings.frequency}
            onChange={(e) => update.mutate({ frequency: e.target.value as 'daily' | 'weekly' })}
            style={inputStyle}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>

        {settings.frequency === 'weekly' && (
          <label className="flex flex-col gap-1">
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Run weekday</span>
            <select
              aria-label="Run weekday"
              value={settings.run_weekday ?? 0}
              onChange={(e) => update.mutate({ run_weekday: Number(e.target.value) })}
              style={inputStyle}
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Run hour (UTC)</span>
          <input
            aria-label="Run hour"
            type="number"
            min={0}
            max={23}
            defaultValue={settings.run_hour}
            onBlur={(e) => update.mutate({ run_hour: Number(e.target.value) })}
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Custom instructions</span>
          <textarea
            aria-label="Custom instructions"
            rows={3}
            maxLength={1000}
            defaultValue={settings.custom_instructions ?? ''}
            onBlur={(e) => update.mutate({ custom_instructions: e.target.value })}
            style={inputStyle}
          />
        </label>
      </div>

      {settings.require_approval && pending && pending.length > 0 && (
        <div
          className="flex flex-col gap-2 rounded-[var(--r-md)] p-4"
          style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)' }}
        >
          <h3>Pending content</h3>
          <ul className="flex flex-col gap-2">
            {pending.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span>{item.title ?? item.type}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => approve.mutate(item.id)}
                    className="rounded-[var(--r-pill)] px-4 py-1"
                    style={{ background: 'var(--uc-indigo)', color: 'var(--on-accent)' }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => discard.mutate(item.id)}
                    className="rounded-[var(--r-pill)] border-[0.5px] px-4 py-1"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
