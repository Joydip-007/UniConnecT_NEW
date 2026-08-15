import { Widget } from 'web';

// The right rail's card chrome: --surface-card on a 0.5px --border-default,
// --r-lg corners, 16px padding. Everything a widget renders sits inside one.

export function Default() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <Widget>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
          Your progress
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Four steps left before your profile is complete.
        </div>
      </Widget>
    </div>
  );
}

export function WithStackedRows() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 320 }}>
      <Widget>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
          Study group
        </div>
        {['Nabila Rahman', 'Tanvir Ahmed', 'Shuvo Islam'].map((name, i, arr) => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: i === arr.length - 1 ? 'none' : '0.5px solid var(--border-default)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--surface-raised)',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
          </div>
        ))}
      </Widget>
    </div>
  );
}
