import { StatGrid } from 'web';

// The four-up stat header on the admin Learning screen: 12px label, 24px value,
// 12px sub. Four equal tracks on a card surface each.

export function LearningOverview() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 720 }}>
      <StatGrid
        stats={[
          { label: 'Learning paths', value: '14', sub: '9 published' },
          { label: 'Enrolled learners', value: '1,248', sub: '+86 this week' },
          { label: 'Completion rate', value: '62%', sub: 'Across published paths' },
          { label: 'Quizzes', value: '37', sub: '4 need review' },
        ]}
      />
    </div>
  );
}

export function EarlyDays() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 720 }}>
      <StatGrid
        stats={[
          { label: 'Learning paths', value: '2', sub: 'Both drafts' },
          { label: 'Enrolled learners', value: '0', sub: 'Publish to enrol' },
          { label: 'Completion rate', value: '—', sub: 'No attempts yet' },
          { label: 'Quizzes', value: '1', sub: 'AI draft, unreviewed' },
        ]}
      />
    </div>
  );
}
