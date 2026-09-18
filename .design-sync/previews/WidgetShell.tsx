import { RailSlot, WidgetShell } from 'web';

// The motion wrapper every right-rail widget enters on. It carries the rail's
// shared `listItem` stagger variants and nothing else — visually it is a
// pass-through, so a preview shows it doing its job around real widget chrome.
//
// RailSlot's chrome is positional and lives in `.right-rail-slot` CSS: the first
// rendered slot inside `.right-rail` gets the card surface, later ones are flat
// sections. So every story wraps in a real `.right-rail` parent.

export function AroundAWidget() {
  return (
    <div className="right-rail" style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <WidgetShell>
        <RailSlot>
          <div
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}
          >
            Your progress
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Two steps left before your profile is complete.
          </div>
        </RailSlot>
      </WidgetShell>
    </div>
  );
}

export function StackedRail() {
  return (
    <div
      className="right-rail"
      style={{
        padding: 12,
        background: 'var(--surface-page)',
        width: 320,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {['Your progress', 'People you may know', 'Upcoming events'].map((title) => (
        <WidgetShell key={title}>
          <RailSlot>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
          </RailSlot>
        </WidgetShell>
      ))}
    </div>
  );
}
