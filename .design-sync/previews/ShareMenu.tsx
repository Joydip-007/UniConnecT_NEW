import { useEffect } from 'react';
import { ShareMenu } from 'web';

// ShareMenu owns its open/closed state internally (no isOpen prop) — the popover
// only mounts after the trigger is clicked. To capture the actual popover UI
// (the interesting surface) rather than the closed 16px trigger icon, this
// auto-clicks the render-prop's `toggle()` once on mount.
function AutoOpenTrigger({ open, toggle }: { open: boolean; toggle: () => void }) {
  useEffect(() => {
    if (!open) toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button
      type="button"
      aria-label="Share"
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-hover)',
        borderRadius: 'var(--r-sm)',
        padding: 6,
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
      }}
    >
      Share
    </button>
  );
}

export function Default() {
  return (
    <div style={{ padding: 60, background: 'var(--surface-page)', minHeight: 220 }}>
      <ShareMenu entityType="post" entityId="demo-post-1" title="Check this out">
        {({ open, toggle }) => <AutoOpenTrigger open={open} toggle={toggle} />}
      </ShareMenu>
    </div>
  );
}

export function WithProfileShare() {
  return (
    <div style={{ padding: 60, background: 'var(--surface-page)', minHeight: 220 }}>
      <ShareMenu
        entityType="post"
        entityId="demo-post-2"
        title="Check this out"
        onShareToProfile={() => {}}
      >
        {({ open, toggle }) => <AutoOpenTrigger open={open} toggle={toggle} />}
      </ShareMenu>
    </div>
  );
}
