import { FooterBackgroundGradient } from 'web';

export function Default() {
  return (
    <div
      style={{
        position: 'relative',
        height: 220,
        background: 'var(--surface-page)',
        overflow: 'hidden',
      }}
    >
      <FooterBackgroundGradient />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 24,
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}
      >
        Footer content sits above the radial background gradient.
      </div>
    </div>
  );
}
