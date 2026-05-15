import type { RequestHandler } from 'express'
import { redis } from '../config/redis'
import { env } from '../config/env'
import { asyncHandler } from '../utils/asyncHandler'
import { tooManyRequests } from '../utils/errors'

const noop: RequestHandler = (_req, _res, next) => next()

interface RateLimiterOptions {
  windowMs?: number
  max?: number
}

export function createRateLimiter(maxRequests: number, windowSeconds: number, keyPrefix: string): RequestHandler {
  if (env.NODE_ENV === 'test') return noop
  return asyncHandler(async (req, _res, next) => {
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const key = `rl:${keyPrefix}:${ipAddress}`
    const count = await redis.incr(key)

    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }

    if (count > maxRequests) {
      throw tooManyRequests()
    }

    next()
  })
}

export function rateLimiter(options: RateLimiterOptions = {}) {
  if (env.NODE_ENV === 'test') return noop
  const maxRequests = options.max ?? 120
  const windowSeconds = Math.ceil((options.windowMs ?? 60_000) / 1000)
  return createRateLimiter(maxRequests, windowSeconds, 'custom')
}

export const loginLimiter = createRateLimiter(10, 900, 'login')
export const otpLimiter = createRateLimiter(5, 300, 'otp')
export const generalLimiter = createRateLimiter(300, 60, 'general')
