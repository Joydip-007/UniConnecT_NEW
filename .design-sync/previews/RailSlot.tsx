import { RailSlot } from 'web';

// Every right-rail widget's outer box. The chrome is positional CSS on
// `.right-rail-slot`: the first rendered slot in a `.right-rail` gets the card
// surface, the rest are flat sections with a hairline from the third onward.
// So each story wraps in a real `.right-rail` parent, one child per slot.

const title = { fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 };
const meta = { fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 };

export function FirstSlotIsACard() {
  return (
    <div className="right-rail" style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <div>
        <RailSlot>
          <div style={title}>Your progress</div>
          <div style={meta}>Two steps left before your profile is complete.</div>
        </RailSlot>
      </div>
    </div>
  );
}

export function StackedPositions() {
  return (
    <div className="right-rail" style={{ padding: 12, background: 'var(--surface-page)', width: 320, display: 'flex', flexDirection: 'column' }}>
      {[
        ['Your progress', 'Card surface — first rendered slot'],
        ['People you may know', 'Flat — second slot, no rule'],
        ['Upcoming events', 'Flat — hairline from the third slot'],
        ['Trending tags', 'Flat — hairline'],
      ].map(([t, m]) => (
        <div key={t}>
          <RailSlot>
            <div style={title}>{t}</div>
            <div style={meta}>{m}</div>
          </RailSlot>
        </div>
      ))}
    </div>
  );
}
