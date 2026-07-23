import { StreakBanner } from 'web';

export function ActiveStreak() {
  return (
    <div style={{ width: 360 }}>
      <StreakBanner stats={{ currentStreak: 12, longestStreak: 21, lastActivityDate: new Date().toISOString(), freezesRemaining: 2 }} />
    </div>
  );
}

export function NoStreakYet() {
  return (
    <div style={{ width: 360 }}>
      <StreakBanner stats={{ currentStreak: 0, longestStreak: 5, lastActivityDate: null, freezesRemaining: 3 }} />
    </div>
  );
}
