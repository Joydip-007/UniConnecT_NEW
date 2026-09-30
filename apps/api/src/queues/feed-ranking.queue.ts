import { createQueue } from '../config/bull'

// No job data — the worker recomputes hot_score for the recent window from the DB.
export const feedRankingQueue = createQueue('feed-ranking')
