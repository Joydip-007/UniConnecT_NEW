import { Skel } from 'web';

// The landing page's inline placeholder bar — a --border-strong block on 4px
// corners. It is a single primitive, so the story is the size range it is used
// at plus the composed shape it stands in for.

export function Sizes() {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--surface-page)',
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Skel w="100%" />
      <Skel w={180} />
      <Skel w={90} h={6} />
      <Skel w={220} h={14} />
    </div>
  );
}

export function AsAPlaceholderCard() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 320 }}>
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          display: 'flex',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--border-strong)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          <Skel w="70%" h={10} />
          <Skel w="45%" />
          <Skel w="90%" h={6} />
        </div>
      </div>
    </div>
  );
}
