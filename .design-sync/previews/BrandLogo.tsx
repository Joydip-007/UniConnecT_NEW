import { BrandLogo } from 'web';

export function Preview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', background: 'var(--surface-card)', padding: 16 }}>
      <BrandLogo height={32} />
      <BrandLogo height={48} />
    </div>
  );
}
