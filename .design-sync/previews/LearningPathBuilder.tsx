import { LearningPathBuilder } from 'web';

// Full-screen manual path editor. Opened blank from "New learning path", or
// pre-filled with an AI draft (the `seed`) from "Generate draft".

const frame = { padding: 16, background: 'var(--surface-page)', width: 820 };

export function Blank() {
  return (
    <div style={frame}>
      <LearningPathBuilder seed={null} onExit={() => {}} onDraftWithAi={() => {}} />
    </div>
  );
}

export function SeededFromAiDraft() {
  return (
    <div style={frame}>
      <LearningPathBuilder
        seed={{
          department: 'CSE',
          draft: {
            title: 'Operating systems for CSE 3rd year',
            description: 'Processes, scheduling, memory and file systems, paced for one term.',
            difficulty: 'intermediate',
            units: [
              { title: 'Processes and threads', type: 'read', content: { body: 'What a process is, and how threads share it.' }, estimatedMinutes: 25 },
              { title: 'CPU scheduling walkthrough', type: 'video', content: { url: 'https://example.invalid/sched' }, estimatedMinutes: 18 },
              { title: 'Implement round robin', type: 'exercise', content: { body: 'Write a simulator for a 4-process queue.' }, estimatedMinutes: 40 },
              { title: 'Scheduling checkpoint', type: 'quiz', content: { questions: [] }, estimatedMinutes: 10 },
            ],
          },
        }}
        onExit={() => {}}
        onDraftWithAi={() => {}}
      />
    </div>
  );
}
