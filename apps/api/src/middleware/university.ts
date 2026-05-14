import type { NextFunction, Request, Response } from 'express'
import { db } from '../config/db'
import { verifyAccessToken, verifyRefreshToken } from '../services/token.service'
import { asyncHandler } from '../utils/asyncHandler'
import { AppError } from '../utils/errors'

interface UniversityRow {
  id: string
  name: string
  domain: string
  plan: string
  is_active: boolean
  allowed_email_domains: string[] | null
}

export const resolveUniversity = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const domain = getUniversityDomain(req)
  const universityId =
    req.user?.universityId ??
    req.auth?.universityId ??
    getUniversityIdFromBearerToken(req) ??
    getUniversityIdFromRefreshCookie(req)

  const query = db<UniversityRow>('universities')
    .select('id', 'name', 'domain', 'plan', 'is_active', 'allowed_email_domains')
    .first()

  if (domain) {
    query.where({ domain })
  } else if (universityId) {
    query.where({ id: universityId })
  } else {
    throw new AppError('University not found', 404, 'UNIVERSITY_NOT_FOUND')
  }

  const university = await query

  if (!university || !university.is_active) {
    throw new AppError('University not found', 404, 'UNIVERSITY_NOT_FOUND')
  }

  req.university = {
    id: university.id,
    name: university.name,
    domain: university.domain,
    plan: university.plan,
    allowedEmailDomains: university.allowed_email_domains ?? [],
  }

  next()
})

export const requireUniversity = resolveUniversity

function getUniversityDomain(req: Request) {
  const headerValue = req.header('x-university-domain')
  if (!headerValue) return null
  return headerValue.trim().toLowerCase()
}

function getUniversityIdFromBearerToken(req: Request) {
  const header = req.header('authorization')
  const [scheme, token] = header?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) return null
  return verifyAccessToken(token)?.universityId ?? null
}

function getUniversityIdFromRefreshCookie(req: Request) {
  const refreshToken = req.cookies?.refreshToken
  if (typeof refreshToken !== 'string') return null
  return verifyRefreshToken(refreshToken)?.universityId ?? null
}
