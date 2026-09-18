import { LearningAiSettingsSection, dsQueryClient } from 'web';
import { useEffect, useRef } from 'react';

// AI learning-path generation settings for the university. Reads one fixed
// config key, so exactly one story.

dsQueryClient.setQueryData(['learning-admin', 'config'], {
  enabled: true,
  topics: [{ category: 'technical', difficulty: 'beginner' }, { category: 'career' }, { category: 'research', difficulty: 'advanced' }],
  difficulty: 'intermediate',
  language: 'en',
  estimatedDays: 21,
  customInstructions: 'Keep examples grounded in the UIU CSE syllabus.',
  genHour: 3,
  countPerRun: 2,
  quizEnabled: true,
  quizRequireApproval: true,
  quizDifficulty: 'beginner',
  quizLanguage: 'en',
  quizCount: 10,
  quizCustomInstructions: null,
  lastAiError: null,
  lastAiErrorAt: null,
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
        <LearningAiSettingsSection />
      </OpenOnMount>
    </div>
  );
}
