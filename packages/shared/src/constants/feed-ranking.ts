// Feed ranking — single source of truth for sort modes and the scoring weights.
// "recent" is the default chronological feed; "top" ranks by engagement × recency
// decay plus viewer affinity. No ML — fully explainable and tunable here.

export const FEED_SORTS = ['recent', 'top'] as const
export type FeedSort = (typeof FEED_SORTS)[number]

export const FEED_RANKING = {
  /** Weight per reaction in the engagement score. */
  REACTION_WEIGHT: 1,
  /** Comments signal more investment than reactions. */
  COMMENT_WEIGHT: 2,
  /** Gravity exponent for the time-decay denominator. */
  GRAVITY: 1.5,
  /** Additive affinity bonuses (scaled to the typical base-score range). */
  CONNECTION_BONUS: 0.6,
  DEPARTMENT_BONUS: 0.25,
  BATCH_BONUS: 0.15,
  /** "Top" only considers posts newer than this many days. */
  WINDOW_DAYS: 14,
} as const
