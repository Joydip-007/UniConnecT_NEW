import { RightSidebar } from 'web';

// RightSidebar fetches suggested users / events / trending tags via useQuery
// (axios) — no backend here, so widgets render their loading/empty states.
export function Default() {
  return (
    <div style={{ display: 'flex', height: 700, background: 'var(--surface-page)' }}>
      <RightSidebar />
    </div>
  );
}
