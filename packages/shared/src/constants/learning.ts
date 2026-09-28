export const LEARNING = {
  STREAK_FREEZES_PER_MONTH: 2,
  STREAK_MILESTONES: [7, 30, 100] as const,
  REMINDER_LOCAL_HOUR: 20,
  RARITY_EPIC_MAX_HOLDERS: 10,
  RARITY_RARE_MAX_HOLDERS: 100,
  /** Badges a learner can pin to their profile at once; a further pin replaces the oldest. */
  MAX_PINNED_BADGES: 3,
  /** Pass mark for a checkpoint quiz whose unit sets no `completion_rule.passScore`. */
  DEFAULT_QUIZ_PASS_SCORE: 70,
} as const

export const LEARNING_EVENTS = {
  UNIT_COMPLETED: 'learning:unit_completed',
} as const
