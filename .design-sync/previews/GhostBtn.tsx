import { GhostBtn } from 'web';

export function Default() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 24, background: 'var(--surface-page)' }}>
      <GhostBtn>Cancel</GhostBtn>
      <GhostBtn>View profile</GhostBtn>
      <GhostBtn disabled>Unavailable</GhostBtn>
    </div>
  );
}
