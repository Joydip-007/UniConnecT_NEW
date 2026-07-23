import { ListSkeleton } from 'web';

// ListSkeleton lives among the groups study-tools primitives
// (StudyToolsPrimitives.tsx) — used while StudyDecksPanel/StudyNotesPanel load.
export function ThreeRows() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <ListSkeleton rows={3} />
    </div>
  );
}

export function TwoRows() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <ListSkeleton rows={2} />
    </div>
  );
}
