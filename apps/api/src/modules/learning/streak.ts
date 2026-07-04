import { LEARNING } from '@uniconnect/shared'

export interface StreakStats {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string | null
  freezesUsedMonth: string | null
  freezesUsedCount: number
}

/** Local calendar date 'YYYY-MM-DD' for an instant in an IANA timezone. */
export function localDateString(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant)
}

export function localHour(instant: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(instant),
  )
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function applyCompletion(stats: StreakStats, todayLocal: string): { stats: StreakStats; changed: boolean } {
  if (stats.lastActivityDate === todayLocal) return { stats, changed: false }
  const continues = stats.lastActivityDate === addDays(todayLocal, -1)
  const currentStreak = continues ? stats.currentStreak + 1 : 1
  return {
    changed: true,
    stats: {
      ...stats,
      currentStreak,
      longestStreak: Math.max(stats.longestStreak, currentStreak),
      lastActivityDate: todayLocal,
    },
  }
}

export function applySweep(
  stats: StreakStats,
  todayLocal: string,
): { action: 'none' } | { action: 'freeze'; stats: StreakStats } | { action: 'reset'; stats: StreakStats } {
  const yesterday = addDays(todayLocal, -1)
  if (stats.currentStreak === 0 || !stats.lastActivityDate || stats.lastActivityDate >= yesterday) {
    return { action: 'none' }
  }
  // A freeze bridges exactly one missed day; larger gaps always reset.
  const missedExactlyOneDay = stats.lastActivityDate === addDays(todayLocal, -2)
  const month = todayLocal.slice(0, 7)
  const used = stats.freezesUsedMonth === month ? stats.freezesUsedCount : 0
  if (missedExactlyOneDay && used < LEARNING.STREAK_FREEZES_PER_MONTH) {
    return {
      action: 'freeze',
      stats: { ...stats, lastActivityDate: yesterday, freezesUsedMonth: month, freezesUsedCount: used + 1 },
    }
  }
  return { action: 'reset', stats: { ...stats, currentStreak: 0 } }
}
