import { describe, expect, it } from 'vitest'
import { scheduleFlashcardReview } from './spacedRepetition'

const now = new Date('2026-07-05T08:00:00.000Z')

describe('scheduleFlashcardReview', () => {
  it('schedules again in 10 minutes and lowers ease with a floor', () => {
    const next = scheduleFlashcardReview({ easeFactor: 1.35, intervalDays: 5, repetitionCount: 3 }, 'again', now)
    expect(next.easeFactor).toBe(1.3)
    expect(next.intervalDays).toBe(0)
    expect(next.repetitionCount).toBe(0)
    expect(next.dueAt.toISOString()).toBe('2026-07-05T08:10:00.000Z')
  })

  it('uses first good interval of one day for a new card', () => {
    const next = scheduleFlashcardReview(null, 'good', now)
    expect(next.easeFactor).toBe(2.5)
    expect(next.intervalDays).toBe(1)
    expect(next.repetitionCount).toBe(1)
    expect(next.dueAt.toISOString()).toBe('2026-07-06T08:00:00.000Z')
  })

  it('uses second good interval of three days', () => {
    const next = scheduleFlashcardReview({ easeFactor: 2.5, intervalDays: 1, repetitionCount: 1 }, 'good', now)
    expect(next.intervalDays).toBe(3)
    expect(next.repetitionCount).toBe(2)
  })

  it('grows mature good reviews by ease factor', () => {
    const next = scheduleFlashcardReview({ easeFactor: 2.5, intervalDays: 4, repetitionCount: 2 }, 'good', now)
    expect(next.intervalDays).toBe(10)
    expect(next.repetitionCount).toBe(3)
  })

  it('schedules easy with bonus interval and ease cap', () => {
    const next = scheduleFlashcardReview({ easeFactor: 2.95, intervalDays: 7, repetitionCount: 2 }, 'easy', now)
    expect(next.easeFactor).toBe(3)
    expect(next.intervalDays).toBe(23)
    expect(next.repetitionCount).toBe(3)
  })

  it('schedules hard with at least one day and lowers ease', () => {
    const next = scheduleFlashcardReview({ easeFactor: 2, intervalDays: 0, repetitionCount: 0 }, 'hard', now)
    expect(next.easeFactor).toBe(1.85)
    expect(next.intervalDays).toBe(1)
    expect(next.repetitionCount).toBe(1)
  })
})
