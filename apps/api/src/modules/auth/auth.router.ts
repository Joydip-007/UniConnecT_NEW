import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { rateLimiter } from '../../middleware/rateLimiter'
import { resolveUniversity } from '../../middleware/university'
import { validateBody } from '../../middleware/validate'
import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resendOtp,
  resetPassword,
  verifyLoginOtp,
  verifyOtp,
} from './controller'
import {
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
authRouter.post('/logout', requireAuth, logout)
authRouter.post('/forgot-password', validateBody(ForgotPasswordSchema), forgotPassword)
authRouter.post('/reset-password', otpLimiter, validateBody(ResetPasswordSchema), resetPassword)
authRouter.get('/me', requireAuth, me)
