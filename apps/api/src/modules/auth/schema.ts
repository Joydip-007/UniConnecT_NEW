import { z } from 'zod'

export const AuthRoleSchema = z.enum(['student', 'alumni', 'faculty', 'admin'])
export const OtpPurposeSchema = z.enum(['verify', 'login', 'reset'])

export const RegisterSchema = z
  .object({
    email: z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    full_name: z.string().trim().min(1, 'Full name is required').optional(),
    fullName: z.string().trim().min(1, 'Full name is required').optional(),
    role: AuthRoleSchema.optional(),
    invitation_token: z.string().trim().min(1).optional(),
    token: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).max(100).optional().nullable(),
    batch_year: z.string().trim().min(1).max(20).optional().nullable(),
  })
  .transform((value) => ({
    email: value.email,
    password: value.password,
    full_name: value.full_name ?? value.fullName,
    role: value.role,
    invitation_token: value.invitation_token ?? value.token,
    department: value.department ?? null,
    batch_year: value.batch_year ?? null,
  }))
  .refine((value) => Boolean(value.full_name), {
    message: 'Full name is required',
  })

export const LoginSchema = z.object({
  email: z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
})

export const VerifyOtpSchema = z.object({
  email: z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  purpose: OtpPurposeSchema,
})

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
})

export const ResetPasswordSchema = z.object({
  email: z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const ResendOtpSchema = z.object({
  email: z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()),
  purpose: OtpPurposeSchema,
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type ResendOtpInput = z.infer<typeof ResendOtpSchema>
export type OtpPurpose = z.infer<typeof OtpPurposeSchema>
