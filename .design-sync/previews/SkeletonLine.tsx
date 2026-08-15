import { SkeletonLine } from 'web';

// The right rail's loading primitive: a --surface-raised bar on --r-sm corners
// running the shared `shimmer` keyframe. Widgets compose these into row shapes
// that match the real content they are standing in for.

export function Widths() {
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
      <SkeletonLine />
      <SkeletonLine width="60%" />
      <SkeletonLine width="40%" height={10} />
      <SkeletonLine width={14} height={14} />
    </div>
  );
}

export function AsALoadingRow() {
  return (
    <div style={{ padding: 16, background: 'var(--surface-page)', width: 320 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--surface-raised)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonLine width="60%" />
            <SkeletonLine width="40%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
