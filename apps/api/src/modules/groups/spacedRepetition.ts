export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewScheduleInput {
  easeFactor: number
  intervalDays: number
  repetitionCount: number
}

export interface ReviewSchedule {
  easeFactor: number
  intervalDays: number
  repetitionCount: number
  dueAt: Date
}

const MIN_EASE = 1.3
const MAX_EASE = 3
const DAY_MS = 24 * 60 * 60 * 1000
const TEN_MINUTES_MS = 10 * 60 * 1000

function clampEase(value: number) {
  return Number(Math.min(MAX_EASE, Math.max(MIN_EASE, value)).toFixed(2))
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

export function scheduleFlashcardReview(
  previous: ReviewScheduleInput | null,
  rating: ReviewRating,
  reviewedAt = new Date(),
): ReviewSchedule {
  const base = previous ?? { easeFactor: 2.5, intervalDays: 0, repetitionCount: 0 }

  if (rating === 'again') {
    return {
      easeFactor: clampEase(base.easeFactor - 0.2),
      intervalDays: 0,
      repetitionCount: 0,
      dueAt: new Date(reviewedAt.getTime() + TEN_MINUTES_MS),
    }
  }

  if (rating === 'hard') {
    const intervalDays = Math.max(1, Math.ceil(base.intervalDays * 1.2))
    return {
      easeFactor: clampEase(base.easeFactor - 0.15),
      intervalDays,
      repetitionCount: Math.max(1, base.repetitionCount),
      dueAt: addDays(reviewedAt, intervalDays),
    }
  }

  const repetitionCount = base.repetitionCount + 1

  if (rating === 'easy') {
    const intervalDays =
      repetitionCount === 1
        ? 3
        : repetitionCount === 2
          ? 7
          : Math.ceil(base.intervalDays * (base.easeFactor + 0.3))

    return {
      easeFactor: clampEase(base.easeFactor + 0.15),
      intervalDays,
      repetitionCount,
      dueAt: addDays(reviewedAt, intervalDays),
    }
  }

  const intervalDays =
    repetitionCount === 1
      ? 1
      : repetitionCount === 2
        ? 3
        : Math.ceil(base.intervalDays * base.easeFactor)

  return {
    easeFactor: clampEase(base.easeFactor),
    intervalDays,
    repetitionCount,
    dueAt: addDays(reviewedAt, intervalDays),
  }
}
