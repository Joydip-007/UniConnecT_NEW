import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

// No job data — the worker recomputes hot_score for the recent window from the DB.
export const feedRankingQueue = new Queue('feed-ranking', bullQueueOptions)
