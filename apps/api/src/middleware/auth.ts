import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from '@uniconnect/shared'
import { verifyAccessToken } from '../services/token.service'
import { asyncHandler } from '../utils/asyncHandler'
import { AppError } from '../utils/errors'

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = getBearerToken(req)

  if (!token) {
    throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
  }

  const authContext = {
    userId: payload.userId,
    universityId: payload.universityId,
    role: payload.role,
  }

  req.user = authContext
  req.auth = authContext
  next()
})

export function requireRole(...roles: UserRole[]) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError('Forbidden', 403, 'INSUFFICIENT_ROLE')
    }

    next()
  })
}

function getBearerToken(req: Request) {
  const header = req.header('authorization')
  const [scheme, token] = header?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) return null
  return token
}
