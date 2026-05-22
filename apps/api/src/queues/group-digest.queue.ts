import Queue from 'bull'
import { env } from '../config/env'

// No job data needed — the worker fetches everything from the DB
export const groupDigestQueue = new Queue('group-digest', env.REDIS_URL)
