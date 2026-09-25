import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { userRoleSchema, type UserRole } from '@uniconnect/shared'
import { db } from '../config/db'
import { env } from '../config/env'

export interface AccessTokenPayload {
  userId: string
  universityId: string
  role: UserRole
  type: 'access'
}

export interface RefreshTokenPayload {
  jti: string
  userId: string
  universityId: string
  type: 'refresh'
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface GenerateAccessTokenInput {
  userId: string
  universityId: string
  role: UserRole
}

interface GenerateRefreshTokenInput {
  userId: string
  universityId: string
}

interface UserRoleRow {
  role: UserRole
}

const accessTokenOptions: SignOptions = { expiresIn: '15m' }
const refreshTokenOptions: SignOptions = { expiresIn: '7d' }

export class TokenService {
  generateAccessToken(input: GenerateAccessTokenInput): string {
    return jwt.sign(
      {
        userId: input.userId,
        universityId: input.universityId,
        role: input.role,
        type: 'access',
      } satisfies AccessTokenPayload,
      env.JWT_SECRET,
      accessTokenOptions,
    )
  }

  generateRefreshToken(input: GenerateRefreshTokenInput): string {
    return jwt.sign(
      {
        jti: crypto.randomUUID(),
        userId: input.userId,
        universityId: input.universityId,
        type: 'refresh',
      } satisfies RefreshTokenPayload,
      env.JWT_REFRESH_SECRET,
      refreshTokenOptions,
    )
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET)
      return isAccessTokenPayload(decoded) ? decoded : null
    } catch {
      return null
    }
  }

  verifyAccessTokenWithExpiry(token: string): { payload: AccessTokenPayload | null; expired: boolean } {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET)
      return { payload: isAccessTokenPayload(decoded) ? decoded : null, expired: false }
    } catch (err) {
      return { payload: null, expired: err instanceof jwt.TokenExpiredError }
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET)
      return isRefreshTokenPayload(decoded) ? decoded : null
    } catch {
      return null
    }
  }

  async saveRefreshToken(
    userId: string,
    refreshToken: string,
    deviceInfo?: Record<string, unknown> | null,
    ipAddress?: string | null,
  ): Promise<void> {
    await db('user_sessions').insert({
      user_id: userId,
      refresh_token: refreshToken,
      device_info: deviceInfo ?? null,
      ip_address: ipAddress ?? null,
      expires_at: db.raw("NOW() + INTERVAL '7 days'"),
    })
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await db('user_sessions').where({ refresh_token: refreshToken }).delete()
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await db('user_sessions').where({ user_id: userId }).delete()
  }

  async rotateRefreshToken(
    oldToken: string,
    userId: string,
    universityId: string,
    deviceInfo?: Record<string, unknown> | null,
    ipAddress?: string | null,
  ): Promise<AuthTokens | null> {
    const payload = this.verifyRefreshToken(oldToken)
    if (!payload || payload.userId !== userId || payload.universityId !== universityId) {
      return null
    }

    return db.transaction(async (trx) => {
      const session = await trx('user_sessions')
        .where({ refresh_token: oldToken, user_id: userId })
        .where('expires_at', '>', trx.fn.now())
        .first()

      if (!session) return null

      await trx('user_sessions').where({ refresh_token: oldToken }).delete()

      const user = await trx<UserRoleRow>('users')
        .select('role')
        .where({ id: userId, university_id: universityId, is_active: true })
        .first()

      if (!user) return null

      const accessToken = this.generateAccessToken({
        userId,
        universityId,
        role: user.role,
      })
      const refreshToken = this.generateRefreshToken({ userId, universityId })

      await trx('user_sessions').insert({
        user_id: userId,
        refresh_token: refreshToken,
        device_info: deviceInfo ?? null,
        ip_address: ipAddress ?? null,
        expires_at: trx.raw("NOW() + INTERVAL '7 days'"),
      })

      return { accessToken, refreshToken }
    })
  }
}

export const tokenService = new TokenService()

export function generateAccessToken(input: GenerateAccessTokenInput): string {
  return tokenService.generateAccessToken(input)
}

export function generateRefreshToken(input: GenerateRefreshTokenInput): string {
  return tokenService.generateRefreshToken(input)
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  return tokenService.verifyAccessToken(token)
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  return tokenService.verifyRefreshToken(token)
}

function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    record.type === 'access' &&
    typeof record.userId === 'string' &&
    typeof record.universityId === 'string' &&
    isUserRole(record.role)
  )
}

function isRefreshTokenPayload(value: unknown): value is RefreshTokenPayload {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    record.type === 'refresh' &&
    typeof record.jti === 'string' &&
    typeof record.userId === 'string' &&
    typeof record.universityId === 'string'
  )
}

function isUserRole(value: unknown): value is UserRole {
  // Must stay in step with `userRoleSchema` — a role missing here signs in and then
  // has every request rejected (this is how the driver role was locked out).
  return userRoleSchema.safeParse(value).success
}
