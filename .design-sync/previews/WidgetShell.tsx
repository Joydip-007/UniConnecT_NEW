import { Widget, WidgetShell } from 'web';

// The motion wrapper every right-rail widget enters on. It carries the rail's
// shared `listItem` stagger variants and nothing else — visually it is a
// pass-through, so a preview shows it doing its job around real widget chrome.

export function AroundAWidget() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <WidgetShell>
        <Widget>
          <div
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}
          >
            Your progress
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Two steps left before your profile is complete.
          </div>
        </Widget>
      </WidgetShell>
    </div>
  );
}

export function StackedRail() {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--surface-page)',
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {['Your progress', 'People you may know', 'Upcoming events'].map((title) => (
        <WidgetShell key={title}>
          <Widget>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
          </Widget>
        </WidgetShell>
      ))}
    </div>
  );
}
