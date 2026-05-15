import type { Response } from 'express'
import { env } from '../config/env'

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

export function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: sevenDaysMs,
    path: '/api/v1/auth',
  })
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/api/v1/auth',
  })
}
