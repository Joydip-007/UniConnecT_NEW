import { createQueue } from '../config/bull'

// No job data needed — the worker fetches everything from the DB
export const groupDigestQueue = createQueue('group-digest')
