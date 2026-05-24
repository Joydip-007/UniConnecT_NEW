import Redis from 'ioredis'
import { env } from './env'

const isTls = env.REDIS_URL.startsWith('rediss://')

/**
 * Factory that creates ioredis clients with settings required for Upstash Redis:
 *  - enableReadyCheck: false  → Upstash doesn't support all CLIENT sub-commands
 *  - maxRetriesPerRequest: null → Bull workers need unlimited retries; avoids
 *    MaxRetriesPerRequestError on startup before the connection is established
 *  - tls: {}  → explicit TLS when URL scheme is rediss://
 */
function createBullRedisClient(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    ...(isTls && { tls: {} }),
  })
}

/**
 * Shared Bull QueueOptions used by every queue in this app.
 * Pass as the second argument to `new Queue(name, bullQueueOptions)`.
 *
 * Bull v4 calls createClient three times per queue (client, subscriber, bclient);
 * each gets its own ioredis instance so they don't share connection state.
 */
export const bullQueueOptions = {
  createClient(_type: 'client' | 'subscriber' | 'bclient'): Redis {
    return createBullRedisClient()
  },
}
