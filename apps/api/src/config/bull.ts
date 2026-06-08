import Redis from 'ioredis'
import { env } from './env'

const isTls = env.REDIS_URL.startsWith('rediss://')

const BASE_OPTS = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(isTls && { tls: {} }),
}

function makeBullClient(): Redis {
  return new Redis(env.REDIS_URL, BASE_OPTS)
}

// One shared client for regular commands (LPUSH, ZADD, GET …) — ioredis
// queues commands internally so sharing across all queues/workers is safe.
const sharedClient = makeBullClient()

// One shared subscriber — each queue subscribes to its own channel pattern
// (bull:{name}:*), so a single ioredis connection handles all of them correctly.
const sharedSubscriber = makeBullClient()

/**
 * Shared Bull QueueOptions used by every queue and worker in this app.
 *
 * Bull v4 calls createClient with 'client', 'subscriber', and 'bclient' per
 * instance. We share client + subscriber across all 10 queues and 10 workers
 * to stay well within Redis Cloud's connection limit.
 *
 * 'bclient' must stay unique per worker — it issues BRPOPLPUSH which blocks
 * the entire connection until a job arrives.
 *
 * Connection count: was ~60 (3 × 20 instances), now 12 (1 + 1 + 10 bclient).
 */
export const bullQueueOptions = {
  createClient(type: 'client' | 'subscriber' | 'bclient'): Redis {
    switch (type) {
      case 'client':     return sharedClient
      case 'subscriber': return sharedSubscriber
      case 'bclient':    return makeBullClient()
    }
  },
}
