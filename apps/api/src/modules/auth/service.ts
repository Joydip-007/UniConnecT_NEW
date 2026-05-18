import bcrypt from 'bcryptjs'
import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { redis } from '../../config/redis'
import { emailQueue } from '../../queues/email.queue'
import { emailService } from '../../services/email.service'
import { otpService } from '../../services/otp.service'
import { tokenService } from '../../services/token.service'
import { AppError } from '../../utils/errors'
import { env } from '../../config/env'
import { logger } from '../../utils/logger'
import { systemGroupsService } from '../groups/system-groups.service'
import type { LoginInput, OtpPurpose, RegisterInput } from './schema'

interface UserRow {
  id: string
  university_id: string
  email: string
  password_hash: string | null
  role: UserRole
  is_verified: boolean
  is_active: boolean
}

interface UserWithProfileRow extends UserRow {
  full_name: string
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  headline: string | null
  department: string | null
  batch_year: string | null
  linkedin_url: string | null
  phone: string | null
  skills: string[] | null
  is_open_to_work: boolean
  is_open_to_mentorship: boolean
  mentorship_points: number
  theme_preference: 'light' | 'dark' | 'system'
}

interface InvitationRow {
  token: string
  university_id: string
  email: string
  role: UserRole
  is_used: boolean
  expires_at: Date
}

interface UniversityRow {
  name: string
}

interface AuthDeviceInfo extends Record<string, unknown> {
  userAgent?: string
}

const authMessages = {
  verifySent: 'Check your email for a 6-digit verification code.',
  loginSent: 'A 6-digit login code was sent to your email.',
  resetSent: 'If an account exists, a reset code was sent.',
  passwordReset: 'Password reset. Please log in.',
}

export class AuthService {
  async register(data: RegisterInput, universityId: string, _ipAddress: string, _deviceInfo: AuthDeviceInfo, allowedEmailDomains: string[] = []) {
    const invitation = data.invitation_token ? await getInvitation(data.invitation_token) : null
    const email = data.email ?? invitation?.email
    const role = data.role ?? invitation?.role

    if (!email || !role || !data.full_name) {
      throw new AppError('Invitation token is required', 422, 'VALIDATION_ERROR')
    }

    if (allowedEmailDomains.length > 0) {
      const emailDomain = email.split('@')[1]?.toLowerCase() ?? ''
      if (!allowedEmailDomains.includes(emailDomain)) {
        throw new AppError(
          `Registration is only allowed for these email domains: ${allowedEmailDomains.join(', ')}`,
          422,
          'EMAIL_DOMAIN_NOT_ALLOWED',
        )
      }
    }

    if (invitation) {
      validateInvitationForRegistration(invitation, email, role, universityId)
    }

    const existingUser = await findUserByEmail(email, universityId)
    if (existingUser) {
      throw new AppError('An account already exists for this email', 409, 'CONFLICT')
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null

    const user = await db.transaction(async (trx) => {
      const [createdUser] = await trx<UserRow>('users')
        .insert({
          university_id: universityId,
          email,
          password_hash: passwordHash,
          role,
          is_verified: false,
        })
        .returning('*')

      await trx('profiles').insert({
        user_id: createdUser.id,
        full_name: data.full_name,
        department: data.department ?? null,
      })

      if (invitation) {
        await trx('invitations').where({ token: invitation.token }).update({ is_used: true })
      }

      return createdUser
    })

    const profile = await findUserWithProfile(user.id)
    if (!profile) throw new AppError('User not found', 404, 'NOT_FOUND')

    const otp = await otpService.storeOtp(user.id, 'verify')
    await sendOtpOrThrow(user.email, otp, 'verify', data.full_name)

    const accessToken = tokenService.generateAccessToken({
      userId: user.id,
      universityId: user.university_id,
      role: user.role,
    })
    const refreshToken = tokenService.generateRefreshToken({
      userId: user.id,
      universityId: user.university_id,
    })

    await tokenService.saveRefreshToken(user.id, refreshToken, _deviceInfo ?? null, _ipAddress ?? null)

    return {
      message: authMessages.verifySent,
      accessToken,
      refreshToken,
      user: toAuthUser(profile),
    }
  }

  async verifyAccount(email: string, otp: string, universityId: string, ipAddress?: string, deviceInfo?: AuthDeviceInfo) {
    const user = await findUserByEmail(email, universityId)
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND')

    if (user.is_verified) {
      throw new AppError('Account already verified', 409, 'CONFLICT')
    }

    await verifyOtpOrThrow(user.id, 'verify', otp)
    await db('users').where({ id: user.id }).update({ is_verified: true })

    const profile = await findUserWithProfile(user.id)
    if (!profile) throw new AppError('User not found', 404, 'NOT_FOUND')

    await systemGroupsService
      .addUserToSystemGroups(user.id, user.university_id, user.role, profile.department)
      .catch((error: unknown) => logger.warn('System-groups add failed on verify', { error, userId: user.id }))

    const accessToken = tokenService.generateAccessToken({
      userId: user.id,
      universityId: user.university_id,
      role: user.role,
    })
    const refreshToken = tokenService.generateRefreshToken({
      userId: user.id,
      universityId: user.university_id,
    })

    await tokenService.saveRefreshToken(user.id, refreshToken, deviceInfo ?? null, ipAddress ?? null)
    await queueWelcomeEmail(user, profile.full_name ?? user.email)

    return {
      accessToken,
      refreshToken,
      user: toAuthUser(profile),
    }
  }

  async login(email: string, password: LoginInput['password'], universityId: string, ipAddress: string, deviceInfo: AuthDeviceInfo) {
    const user = await findUserWithProfileByEmail(email, universityId)
    if (!user || !user.is_active) {
      throw new AppError('Invalid email or password', 401, 'UNAUTHORIZED')
    }

    if (!user.is_verified) {
      throw new AppError('Account is not verified', 403, 'ACCOUNT_NOT_VERIFIED')
    }

    if (!user.password_hash) throw new AppError('Invalid email or password', 401, 'UNAUTHORIZED')
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    if (!isPasswordValid) throw new AppError('Invalid email or password', 401, 'UNAUTHORIZED')

    const accessToken = tokenService.generateAccessToken({
      userId: user.id,
      universityId: user.university_id,
      role: user.role,
    })
    const refreshToken = tokenService.generateRefreshToken({
      userId: user.id,
      universityId: user.university_id,
    })

    await tokenService.saveRefreshToken(user.id, refreshToken, deviceInfo ?? null, ipAddress ?? null)

    await db('users').where({ id: user.id }).update({ last_active_at: db.fn.now() })

    return {
      accessToken,
      refreshToken,
      user: toAuthUser(user),
    }
  }

  async verifyLoginOtp(email: string, otp: string, universityId: string, ipAddress?: string, deviceInfo?: AuthDeviceInfo) {
    const user = await findUserWithProfileByEmail(email, universityId)
    if (!user || !user.is_active) throw new AppError('User not found', 404, 'NOT_FOUND')

    await verifyOtpOrThrow(user.id, 'login', otp)

    const accessToken = tokenService.generateAccessToken({
      userId: user.id,
      universityId: user.university_id,
      role: user.role,
    })
    const refreshToken = tokenService.generateRefreshToken({
      userId: user.id,
      universityId: user.university_id,
    })

    await tokenService.saveRefreshToken(user.id, refreshToken, deviceInfo ?? null, ipAddress ?? null)

    return {
      accessToken,
      refreshToken,
      user: toAuthUser(user),
    }
  }

  async refreshTokens(refreshToken: string | undefined, ipAddress?: string, deviceInfo?: AuthDeviceInfo) {
    if (!refreshToken) throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')

    const payload = tokenService.verifyRefreshToken(refreshToken)
    if (!payload) throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')

    const tokens = await tokenService.rotateRefreshToken(
      refreshToken,
      payload.userId,
      payload.universityId,
      deviceInfo ?? null,
      ipAddress ?? null,
    )

    if (!tokens) throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
    return tokens
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) await tokenService.revokeRefreshToken(refreshToken)
  }

  async forgotPassword(email: string, universityId: string) {
    const user = await findUserByEmail(email, universityId)
    if (!user || !user.is_active) {
      return { message: authMessages.resetSent }
    }

    const profile = await findUserWithProfile(user.id)
    const displayName = profile?.full_name ?? email.split('@')[0]

    const otp = await otpService.storeOtp(user.id, 'reset')
    await sendOtpOrThrow(user.email, otp, 'reset', displayName)
    return { message: authMessages.resetSent }
  }

  async resetPassword(email: string, otp: string, newPassword: string, universityId: string) {
    const user = await findUserByEmail(email, universityId)
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND')

    await verifyOtpOrThrow(user.id, 'reset', otp)

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await db('users').where({ id: user.id }).update({ password_hash: passwordHash, is_verified: true })
    await tokenService.revokeAllUserSessions(user.id)

    return { message: authMessages.passwordReset }
  }

  async resendOtp(email: string, purpose: OtpPurpose, universityId: string) {
    const user = await findUserByEmail(email, universityId)
    if (!user || !user.is_active) throw new AppError('User not found', 404, 'NOT_FOUND')

    const profile = await findUserWithProfile(user.id)
    const displayName = profile?.full_name ?? email.split('@')[0]

    await enforceOtpResendLimit(user.id)
    await otpService.revokeOtp(user.id, purpose)
    const otp = await otpService.storeOtp(user.id, purpose)
    await sendOtpOrThrow(user.email, otp, purpose, displayName)

    return { message: 'A new 6-digit code was sent to your email.' }
  }

  async peekInvitation(token: string, universityId: string) {
    const inv = await db('invitations')
      .where({ token, university_id: universityId, is_used: false })
      .where('expires_at', '>', db.fn.now())
      .select('role', 'email')
      .first<{ role: string; email: string } | undefined>()

    if (!inv) throw new AppError('Invitation not found', 404, 'NOT_FOUND')
    return { role: inv.role as UserRole, email: inv.email }
  }

  async getMe(userId: string) {
    const user = await findUserWithProfile(userId)
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND')

    return toAuthUser(user)
  }
}

export const authService = new AuthService()

async function findUserByEmail(email: string, universityId: string) {
  return db<UserRow>('users')
    .where({
      email: email.toLowerCase(),
      university_id: universityId,
    })
    .first()
}

async function findUserWithProfile(userId: string) {
  return db<UserRow>('users')
    .leftJoin('profiles', 'profiles.user_id', 'users.id')
    .select(
      'users.id',
      'users.university_id',
      'users.email',
      'users.password_hash',
      'users.role',
      'users.is_verified',
      'users.is_active',
      'profiles.full_name',
      'profiles.avatar_url',
      'profiles.cover_url',
      'profiles.bio',
      'profiles.headline',
      'profiles.department',
      'profiles.batch_year',
      'profiles.linkedin_url',
      'profiles.phone',
      'profiles.skills',
      'profiles.is_open_to_work',
      'profiles.is_open_to_mentorship',
      'profiles.mentorship_points',
      'users.theme_preference',
    )
    .where('users.id', userId)
    .first<UserWithProfileRow>()
}

async function findUserWithProfileByEmail(email: string, universityId: string) {
  return db<UserRow>('users')
    .leftJoin('profiles', 'profiles.user_id', 'users.id')
    .select(
      'users.id',
      'users.university_id',
      'users.email',
      'users.password_hash',
      'users.role',
      'users.is_verified',
      'users.is_active',
      'profiles.full_name',
      'profiles.avatar_url',
      'profiles.cover_url',
      'profiles.bio',
      'profiles.headline',
      'profiles.department',
      'profiles.batch_year',
      'profiles.linkedin_url',
      'profiles.phone',
      'profiles.skills',
      'profiles.is_open_to_work',
      'profiles.is_open_to_mentorship',
      'profiles.mentorship_points',
      'users.theme_preference',
    )
    .where({
      'users.email': email.toLowerCase(),
      'users.university_id': universityId,
    })
    .first<UserWithProfileRow>()
}

function toAuthUser(user: UserWithProfileRow) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    universityId: user.university_id,
    isVerified: user.is_verified,
    themePreference: user.theme_preference ?? 'system',
    profile: {
      fullName: user.full_name ?? '',
      bio: user.bio ?? null,
      avatarUrl: user.avatar_url ?? null,
      coverUrl: user.cover_url ?? null,
      headline: user.headline ?? null,
      department: user.department ?? null,
      batchYear: user.batch_year ?? null,
      linkedinUrl: user.linkedin_url ?? null,
      phone: user.phone ?? null,
      skills: user.skills ?? [],
      isOpenToWork: user.is_open_to_work ?? false,
      isOpenToMentorship: user.is_open_to_mentorship ?? false,
      mentorshipPoints: user.mentorship_points ?? 0,
    },
  }
}

async function getInvitation(token: string) {
  return db<InvitationRow>('invitations').where({ token }).first()
}

function validateInvitationForRegistration(
  invitation: InvitationRow,
  email: string,
  role: UserRole,
  universityId: string,
) {
  if (
    invitation.is_used ||
    invitation.expires_at.getTime() <= Date.now() ||
    invitation.university_id !== universityId ||
    invitation.role !== role ||
    invitation.email.toLowerCase() !== email.toLowerCase()
  ) {
    throw new AppError('Invitation token is invalid or expired', 404, 'NOT_FOUND')
  }
}

async function verifyOtpOrThrow(userId: string, purpose: OtpPurpose, otp: string) {
  const result = await otpService.verifyOtp(userId, purpose, otp)
  if (result.valid) return

  if (result.reason === 'too_many_attempts') {
    throw new AppError('Too many OTP attempts', 429, 'OTP_TOO_MANY_ATTEMPTS')
  }

  if (result.reason === 'expired') {
    throw new AppError('OTP expired', 422, 'OTP_EXPIRED')
  }

  throw new AppError('Invalid OTP code', 422, 'OTP_INVALID')
}

async function sendOtpOrThrow(to: string, otp: string, purpose: OtpPurpose, userName: string) {
  // Directly log for development convenience before enqueueing
  if (env.NODE_ENV !== 'production') {
    logger.info('OTP generated (dev)', { to, purpose, devOtp: otp })
  }

  void emailQueue
    .add({
      to,
      subject: 'otp',
      text: JSON.stringify({
        template: 'otp',
        otp,
        purpose,
        userName,
      }),
    })
    .catch((error: unknown) => {
      logger.warn('OTP email queue enqueue failed', { error })
      // Fallback for extreme cases (if redis is down briefly)
      void emailService.sendOtpEmail(to, otp, purpose, userName)
    })
}

async function queueWelcomeEmail(user: UserRow, userName: string) {
  const university = await db<UniversityRow>('universities').select('name').where({ id: user.university_id }).first()
  const universityName = university?.name ?? 'your university'

  void emailQueue
    .add({
      to: user.email,
      subject: 'welcome',
      text: JSON.stringify({
        template: 'welcome',
        userName,
        role: user.role,
        universityName,
      }),
    })
    .catch((error: unknown) => {
      logger.warn('Welcome email queue enqueue failed', { error })
      void emailService.sendWelcomeEmail(user.email, userName, user.role, universityName)
    })
}

async function enforceOtpResendLimit(userId: string) {
  const key = `otp_resend:${userId}`
  const count = await redis.incr(key)

  if (count === 1) {
    await redis.expire(key, 600)
  }

  if (count > 3) {
    throw new AppError('Too many OTP resend requests', 429, 'OTP_RESEND_LIMITED')
  }
}
