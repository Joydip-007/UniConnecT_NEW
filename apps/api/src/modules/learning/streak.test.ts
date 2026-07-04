import { describe, expect, it } from 'vitest'
import { addDays, applyCompletion, applySweep, localDateString, localHour, normalizePgDate, type StreakStats } from './streak'

const base: StreakStats = {
  currentStreak: 3, longestStreak: 5, lastActivityDate: '2026-07-03',
  freezesUsedMonth: null, freezesUsedCount: 0,
}

describe('localDateString', () => {
  it('computes the local calendar date across the UTC day boundary', () => {
    // 2026-07-03 19:30 UTC = 2026-07-04 01:30 in Dhaka (UTC+6)
    expect(localDateString(new Date('2026-07-03T19:30:00Z'), 'Asia/Dhaka')).toBe('2026-07-04')
    expect(localDateString(new Date('2026-07-03T19:30:00Z'), 'America/New_York')).toBe('2026-07-03')
  })
})

describe('localHour', () => {
  it('returns the local hour 0-23', () => {
    expect(localHour(new Date('2026-07-03T18:10:00Z'), 'Asia/Dhaka')).toBe(0) // 00:10 local
    expect(localHour(new Date('2026-07-04T14:05:00Z'), 'Asia/Dhaka')).toBe(20)
  })
})

describe('addDays', () => {
  it('adds and subtracts across month boundaries', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('applyCompletion', () => {
  it('is a no-op for a second completion on the same local day', () => {
    const r = applyCompletion({ ...base, lastActivityDate: '2026-07-04' }, '2026-07-04')
    expect(r.changed).toBe(false)
    expect(r.stats.currentStreak).toBe(3)
  })
  it('increments when yesterday was active', () => {
    const r = applyCompletion(base, '2026-07-04')
    expect(r.stats.currentStreak).toBe(4)
    expect(r.stats.lastActivityDate).toBe('2026-07-04')
    expect(r.stats.longestStreak).toBe(5)
  })
  it('updates longestStreak when passed', () => {
    const r = applyCompletion({ ...base, currentStreak: 5 }, '2026-07-04')
    expect(r.stats.longestStreak).toBe(6)
  })
  it('restarts at 1 after a gap', () => {
    const r = applyCompletion(base, '2026-07-06')
    expect(r.stats.currentStreak).toBe(1)
  })
  it('starts at 1 for a first-ever completion', () => {
    const r = applyCompletion({ ...base, currentStreak: 0, lastActivityDate: null }, '2026-07-04')
    expect(r.stats.currentStreak).toBe(1)
  })
})

describe('applySweep', () => {
  it('does nothing when yesterday (or today) was active', () => {
    expect(applySweep(base, '2026-07-04').action).toBe('none')
    expect(applySweep({ ...base, lastActivityDate: '2026-07-04' }, '2026-07-04').action).toBe('none')
  })
  it('does nothing for streakless users', () => {
    expect(applySweep({ ...base, currentStreak: 0 }, '2026-07-06').action).toBe('none')
  })
  it('consumes a freeze for exactly one missed day', () => {
    const r = applySweep(base, '2026-07-05') // missed 07-04
    expect(r.action).toBe('freeze')
    if (r.action === 'freeze') {
      expect(r.stats.lastActivityDate).toBe('2026-07-04')
      expect(r.stats.freezesUsedMonth).toBe('2026-07')
      expect(r.stats.freezesUsedCount).toBe(1)
      expect(r.stats.currentStreak).toBe(3)
    }
  })
  it('resets the monthly freeze counter in a new month', () => {
    const r = applySweep({ ...base, freezesUsedMonth: '2026-06', freezesUsedCount: 2 }, '2026-07-05')
    expect(r.action).toBe('freeze')
    if (r.action === 'freeze') expect(r.stats.freezesUsedCount).toBe(1)
  })
  it('resets the streak when both monthly freezes are spent', () => {
    const r = applySweep({ ...base, freezesUsedMonth: '2026-07', freezesUsedCount: 2 }, '2026-07-05')
    expect(r.action).toBe('reset')
    if (r.action === 'reset') expect(r.stats.currentStreak).toBe(0)
  })
  it('resets on a gap of 2+ missed days — a freeze covers exactly one day', () => {
    const r = applySweep(base, '2026-07-06')
    expect(r.action).toBe('reset')
  })
})

describe('normalizePgDate', () => {
  it('maps a Date at local midnight to the same calendar day (no UTC shift)', () => {
    // pg returns date columns as local-midnight Dates; in a positive-UTC-offset
    // process TZ, toISOString() would roll this back to the previous day.
    expect(normalizePgDate(new Date(2026, 6, 4))).toBe('2026-07-04')
  })
  it('passes strings through unchanged', () => {
    expect(normalizePgDate('2026-07-04')).toBe('2026-07-04')
  })
  it('passes null through unchanged', () => {
    expect(normalizePgDate(null)).toBeNull()
  })
})
