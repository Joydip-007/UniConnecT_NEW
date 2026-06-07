import type { Request, RequestHandler } from 'express'
import { redis } from '../config/redis'
import { env } from '../config/env'
import { asyncHandler } from '../utils/asyncHandler'
import { tooManyRequests } from '../utils/errors'

const noop: RequestHandler = (_req, _res, next) => next()

interface RateLimiterOptions {
  windowMs?: number
  max?: number
  keyPrefix?: string
}

/**
 * Derive the throttle subject. Prefer the authenticated user id so that an
 * entire university sitting behind a single NAT IP is not throttled as one
 * client; fall back to IP for unauthenticated routes (login, register, etc.).
 */
function rateLimitSubject(req: Request): string {
  if (req.user?.userId) return `u:${req.user.userId}`
  return `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`
}

export function createRateLimiter(maxRequests: number, windowSeconds: number, keyPrefix: string): RequestHandler {
  if (env.NODE_ENV === 'test') return noop
  return asyncHandler(async (req, _res, next) => {
    const key = `rl:${keyPrefix}:${rateLimitSubject(req)}`
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
  return createRateLimiter(maxRequests, windowSeconds, options.keyPrefix ?? 'custom')
}

// Unauthenticated auth-flow limiters (IP-keyed in practice — no user yet).
export const loginLimiter = createRateLimiter(10, 900, 'login')
export const otpLimiter = createRateLimiter(5, 300, 'otp')

// Coarse global safety net mounted on the whole API surface. Runs before
// per-router auth, so it is IP-keyed in practice — kept generous because a
// whole university can share one NAT IP. Fairness comes from the per-user
// limiters below; this only stops single-IP floods.
export const globalLimiter = createRateLimiter(1200, 60, 'global')

// Stricter per-subject limiters for expensive / abuse-prone operations.
export const writeLimiter = createRateLimiter(60, 60, 'write') // content/connection writes
export const searchLimiter = createRateLimiter(40, 60, 'search') // FTS queries
export const uploadLimiter = createRateLimiter(30, 60, 'upload') // presign generation
