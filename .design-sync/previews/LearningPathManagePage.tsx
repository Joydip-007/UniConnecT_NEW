import { LearningPathManagePage, dsQueryClient } from 'web';
import { Navigate, Route, Routes } from 'react-router-dom';

// Per-path unit editor at /admin/learning/paths/:pathId. It reads pathId from
// the route, so the preview mounts it under a matching Route inside the shared
// MemoryRouter and seeds the path-detail query for that id.

const PATH = {
  id: 'p1',
  title: 'Backend fundamentals with Node.js',
  description: 'HTTP, Express, Postgres and deployment, from zero to a shipped API.',
  department: 'CSE',
  category: 'technical',
  difficulty: 'beginner',
  estimatedDays: 21,
  isPublished: true,
  source: 'manual',
  unitCount: 4,
  enrolledCount: 318,
  completedCount: 201,
  completionRate: 0.63,
  updatedAt: '2024-05-13T10:00:00Z',
  units: [
    { id: 'u1', displayOrder: 1, title: 'How HTTP actually works', type: 'read', content: { body: 'Requests, responses, status codes.' }, completionRule: null },
    { id: 'u2', displayOrder: 2, title: 'Your first Express server', type: 'video', content: { body: '' }, completionRule: null },
    { id: 'u3', displayOrder: 3, title: 'Build the /students endpoint', type: 'exercise', content: { body: 'Return a paginated list from Postgres.' }, completionRule: null },
    { id: 'u4', displayOrder: 4, title: 'Week 1 checkpoint', type: 'quiz', content: { questions: [] }, completionRule: { passScore: 60 } },
  ],
};
dsQueryClient.setQueryData(['learning-admin', 'path', 'p1'], PATH);

export function ManageUnits() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 820 }}>
      <Routes>
        <Route path="/p/:pathId" element={<LearningPathManagePage />} />
        <Route path="*" element={<Navigate to="/p/p1" replace />} />
      </Routes>
    </div>
  );
}
