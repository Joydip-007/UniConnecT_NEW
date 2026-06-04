import Redis from 'ioredis'
import { env } from './env'

const isTls = env.REDIS_URL.startsWith('rediss://')

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null
    return 500
  },
  ...(isTls && { tls: {} }),
})

/**
 * Presence key TTL (seconds). The client heartbeats at ~half this interval so a
 * crashed client's online state expires within one TTL window.
 */
export const PRESENCE_TTL_SECONDS = 60

export async function pingRedis() {
  if (redis.status === 'wait') {
    await redis.connect()
  }

  await redis.ping()
}
