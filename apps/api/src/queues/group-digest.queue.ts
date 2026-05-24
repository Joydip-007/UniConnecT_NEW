import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

// No job data needed — the worker fetches everything from the DB
export const groupDigestQueue = new Queue('group-digest', bullQueueOptions)
