import { ProgressBar } from 'web';

// Track + fill on a pill radius. `height` and `pct` are required; `color` defaults
// to --uc-indigo. Own-activity progress is the one place --uc-orange applies.

const frame = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 14,
  padding: 16,
  width: 320,
  background: 'var(--surface-page)',
};

const label = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 };

export function CompletionSteps() {
  return (
    <div style={frame}>
      <div>
        <div style={label}>Intro to data structures · 18%</div>
        <ProgressBar pct={18} height={6} />
      </div>
      <div>
        <div style={label}>Operating systems · 62%</div>
        <ProgressBar pct={62} height={6} />
      </div>
      <div>
        <div style={label}>Career skills for alumni · 100%</div>
        <ProgressBar pct={100} height={6} />
      </div>
    </div>
  );
}

export function OwnActivityTone() {
  return (
    <div style={frame}>
      <div>
        <div style={label}>Your quiz streak this week · 4 of 7 days</div>
        <ProgressBar pct={57} height={6} color="var(--uc-orange)" />
      </div>
      <div>
        <div style={label}>Your profile completeness · 80%</div>
        <ProgressBar pct={80} height={6} color="var(--uc-orange)" />
      </div>
    </div>
  );
}

export function Heights() {
  return (
    <div style={frame}>
      <div>
        <div style={label}>4px — inside a compact row</div>
        <ProgressBar pct={45} height={4} />
      </div>
      <div>
        <div style={label}>6px — the shipped path card</div>
        <ProgressBar pct={45} height={6} />
      </div>
      <div>
        <div style={label}>10px — section header</div>
        <ProgressBar pct={45} height={10} />
      </div>
    </div>
  );
}
