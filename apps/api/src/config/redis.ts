import Redis from 'ioredis'
import { env } from './env'

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null
    return 500
  },
})

export async function pingRedis() {
  if (redis.status === 'wait') {
    await redis.connect()
  }

  await redis.ping()
}
