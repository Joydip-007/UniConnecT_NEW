import type { LearningStats } from './types'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

export type DayState = 'done' | 'today' | 'empty'

export interface WeekDot {
  key: string
  label: string
  state: DayState
}

function toDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/**
 * The seven dots of the current week, Sunday first.
 *
 * The API gives a streak length and the date it last ran to, not a per-day log, so a day
 * counts as done when it falls inside `[lastActivityDate - (currentStreak - 1), lastActivityDate]`.
 * Today is only `'today'` (the dashed target) while it sits outside that window — once it is
 * claimed it reads as a filled day like any other, which is the whole point of the row.
 */
export function weekDots(stats: LearningStats, now: Date = new Date()): WeekDot[] {
  const todayKey = toDateKey(now)
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())

  const streakDays = new Set<string>()
  if (stats.lastActivityDate && stats.currentStreak > 0) {
    // `lastActivityDate` arrives as a plain `YYYY-MM-DD`; parse the parts rather than
    // `new Date(string)`, which reads a bare date as UTC and shifts the whole week west of GMT.
    const [y, m, d] = stats.lastActivityDate.slice(0, 10).split('-').map(Number)
    for (let i = 0; i < stats.currentStreak; i += 1) {
      streakDays.add(toDateKey(new Date(y, m - 1, d - i)))
    }
  }

  return DAY_LABELS.map((label, i) => {
    const key = toDateKey(new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i))
    const state: DayState = streakDays.has(key) ? 'done' : key === todayKey ? 'today' : 'empty'
    return { key, label, state }
  })
}
