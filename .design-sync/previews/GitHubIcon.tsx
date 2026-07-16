import { GitHubIcon } from 'web';

export function Preview() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <div style={{ background: 'var(--surface-raised)', padding: 16, borderRadius: 8, display: 'inline-flex', color: 'var(--text-primary)' }}>
        <GitHubIcon size={32} />
      </div>
      <div style={{ background: 'var(--surface-raised)', padding: 12, borderRadius: 8, display: 'inline-flex', color: 'var(--text-primary)' }}>
        <GitHubIcon size={18} />
      </div>
    </div>
  );
}
