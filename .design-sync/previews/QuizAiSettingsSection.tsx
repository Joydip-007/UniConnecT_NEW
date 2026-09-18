import { QuizAiSettingsSection, dsQueryClient } from 'web';
import { useEffect, useRef } from 'react';

// Daily-quiz AI generation settings. Same fixed config key as the learning
// section, so one story; the seed shows the last AI error banner state.

dsQueryClient.setQueryData(['learning-admin', 'config'], {
  enabled: true,
  topics: [{ category: 'technical' }],
  difficulty: 'intermediate',
  language: 'en',
  estimatedDays: 21,
  customInstructions: null,
  genHour: 3,
  countPerRun: 2,
  quizEnabled: true,
  quizRequireApproval: true,
  quizDifficulty: 'beginner',
  quizLanguage: 'en',
  quizCount: 10,
  quizCustomInstructions: 'One question per lecture topic from the current week.',
  lastAiError: 'Gemini quota exceeded (429) during the 03:00 run.',
  lastAiErrorAt: '2024-05-14T03:02:00Z',
});

// The section owns its disclosure state with no prop to start open, and the
// resting state is a one-line closed header. The preview clicks the disclosure
// once on mount — plain conditional render, no motion gate — so the card shows
// the settings form itself.
function OpenOnMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
  }, []);
  return <div ref={ref}>{children}</div>;
}

export function Settings() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 820 }}>
      <OpenOnMount>
        <QuizAiSettingsSection />
      </OpenOnMount>
    </div>
  );
}
