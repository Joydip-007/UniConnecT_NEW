import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().url().optional(),
  WEB_URL: z.string().url().optional(),
  DATABASE_URL: z.string().default('postgresql://postgres@localhost:5432/uniconnect_db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32).default('development-jwt-secret-change-before-production'),
  JWT_REFRESH_SECRET: z.string().min(32).default('development-refresh-secret-change-before-production'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  AWS_REGION: z.string().default('ap-southeast-1'),
  AWS_S3_BUCKET: z.string().default('uniconnect-local'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  OTP_EXPIRES_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  DEV_INVITE_TOKEN: z.string().default('dev-invite'),
  DEV_INVITE_EMAIL: z.string().email().default('student@uiu.ac.bd'),
  DEV_INVITE_ROLE: z.enum(['student', 'alumni', 'staff', 'admin']).default('student'),
})

const parsedEnv = envSchema.parse(process.env)
const clientUrl = parsedEnv.CLIENT_URL ?? parsedEnv.WEB_URL ?? 'http://localhost:5173'
const resendFromEmail = parsedEnv.RESEND_FROM_EMAIL ?? parsedEnv.EMAIL_FROM ?? 'UniConnecT <onboarding@resend.dev>'

export const env = {
  ...parsedEnv,
  CLIENT_URL: clientUrl,
  WEB_URL: clientUrl,
  RESEND_FROM_EMAIL: resendFromEmail,
  EMAIL_FROM: resendFromEmail,
}

export type Env = typeof env
