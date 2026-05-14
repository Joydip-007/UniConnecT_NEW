import type { Request, Response } from 'express'
import { env } from '../../config/env'
import { asyncHandler } from '../../utils/asyncHandler'
import { AppError } from '../../utils/errors'
import { authService } from './service'
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendOtpInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from './schema'

const refreshCookieName = 'refreshToken'
const refreshCookieMaxAge = 7 * 24 * 60 * 60 * 1000

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(
    req.body as RegisterInput,
    getUniversityId(req),
    getIpAddress(req),
    getDeviceInfo(req),
  )

  setRefreshCookie(res, result.refreshToken)
  res.status(201).json({ data: { message: result.message, accessToken: result.accessToken, user: result.user } })
})

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as VerifyOtpInput

  if (body.purpose === 'login') {
    const result = await authService.verifyLoginOtp(
      body.email,
      body.otp,
      getUniversityId(req),
      getIpAddress(req),
      getDeviceInfo(req),
    )
    setRefreshCookie(res, result.refreshToken)
    res.json({ data: { accessToken: result.accessToken, user: result.user } })
    return
  }

  if (body.purpose === 'reset') {
    throw new AppError('Use reset-password to verify reset codes', 422, 'INVALID_OTP_PURPOSE')
  }

  const result = await authService.verifyAccount(body.email, body.otp, getUniversityId(req), getIpAddress(req), getDeviceInfo(req))
  setRefreshCookie(res, result.refreshToken)
  res.json({ data: { accessToken: result.accessToken, user: result.user } })
})

export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LoginInput
  const result = await authService.login(body.email, body.password, getUniversityId(req), getIpAddress(req), getDeviceInfo(req))
  setRefreshCookie(res, result.refreshToken)
  res.json({ data: { accessToken: result.accessToken, user: result.user } })
})

export const verifyLoginOtp = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as VerifyOtpInput
  const result = await authService.verifyLoginOtp(
    body.email,
    body.otp,
    getUniversityId(req),
    getIpAddress(req),
    getDeviceInfo(req),
  )

  setRefreshCookie(res, result.refreshToken)
  res.json({ data: { accessToken: result.accessToken, user: result.user } })
})

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refreshTokens(req.cookies?.[refreshCookieName], getIpAddress(req), getDeviceInfo(req))
  setRefreshCookie(res, result.refreshToken)
  res.json({ data: { accessToken: result.accessToken } })
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.cookies?.[refreshCookieName])
  clearRefreshCookie(res)
  res.status(204).send()
})

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ForgotPasswordInput
  res.json({ data: await authService.forgotPassword(body.email, getUniversityId(req)) })
})

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ResetPasswordInput
  const result = await authService.resetPassword(body.email, body.otp, body.new_password, getUniversityId(req))
  res.json({ data: result })
})

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ResendOtpInput
  const result = await authService.resendOtp(body.email, body.purpose, getUniversityId(req))
  res.json({ data: result })
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
  res.json({ data: await authService.getMe(req.user.userId) })
})

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: refreshCookieMaxAge,
  })
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  })
}

function getUniversityId(req: Request) {
  if (!req.university) throw new AppError('University not found', 404, 'UNIVERSITY_NOT_FOUND')
  return req.university.id
}

function getIpAddress(req: Request) {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown'
}

function getDeviceInfo(req: Request) {
  const userAgent = req.headers['user-agent']
  return {
    userAgent: Array.isArray(userAgent) ? userAgent.join(' ') : userAgent,
  }
}
