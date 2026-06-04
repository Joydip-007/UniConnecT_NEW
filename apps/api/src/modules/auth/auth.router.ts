import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { rateLimiter } from '../../middleware/rateLimiter'
import { resolveUniversity } from '../../middleware/university'
import { validateBody } from '../../middleware/validate'
import {
  changePassword,
  checkInvitation,
  forgotPassword,
  listSessions,
  login,
  logout,
  me,
  refresh,
  register,
  resendOtp,
  resetPassword,
  revokeOtherSessions,
  revokeSession,
  verifyLoginOtp,
  verifyOtp,
} from './controller'
import {
  ChangePasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResendOtpSchema,
  ResetPasswordSchema,
  VerifyOtpSchema,
} from './schema'

export const authRouter = Router()

const loginLimiter = rateLimiter({ windowMs: 60_000, max: 10 })
const otpLimiter = rateLimiter({ windowMs: 60_000, max: 12 })

authRouter.use(resolveUniversity)

authRouter.post('/register', validateBody(RegisterSchema), register)
authRouter.post('/verify-otp', otpLimiter, validateBody(VerifyOtpSchema), verifyOtp)
authRouter.post('/login', loginLimiter, validateBody(LoginSchema), login)
authRouter.post('/verify-login-otp', otpLimiter, validateBody(VerifyOtpSchema), verifyLoginOtp)
authRouter.post('/resend-otp', otpLimiter, validateBody(ResendOtpSchema), resendOtp)
authRouter.post('/refresh', refresh)
authRouter.post('/logout', logout)
authRouter.post('/forgot-password', validateBody(ForgotPasswordSchema), forgotPassword)
authRouter.post('/reset-password', otpLimiter, validateBody(ResetPasswordSchema), resetPassword)
authRouter.get('/me', requireAuth, me)
authRouter.post('/change-password', requireAuth, validateBody(ChangePasswordSchema), changePassword)
authRouter.get('/sessions', requireAuth, listSessions)
authRouter.delete('/sessions', requireAuth, revokeOtherSessions)
authRouter.delete('/sessions/:sessionId', requireAuth, revokeSession)
authRouter.get('/invitation/:token', checkInvitation)
