import {
  useAiSettings,
  useApprovePendingAiContent,
  useCourseOutline,
  useDiscardPendingAiContent,
  usePendingAiContent,
  useUpdateAiSettings,
} from '../hooks/useGroupExtended'

interface AISettingsPanelProps {
  groupId: string
}

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
