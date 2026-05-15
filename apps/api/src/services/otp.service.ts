import { randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { redis } from '../config/redis'

export type OtpPurpose = 'verify' | 'login' | 'reset'

export interface OtpVerificationResult {
  valid: boolean
  reason?: 'too_many_attempts' | 'expired' | 'invalid_code'
}

const otpTtlSeconds = 600
const maxAttempts = 5

/**
 * Redis OTP Key Schema:
 *   otp:{purpose}:{userId}          → bcrypt hash of OTP,  TTL 600s
 *   otp_attempts:{purpose}:{userId} → attempt counter,     TTL 600s  (max 5)
 *   otp_resend:{userId}             → resend counter,      TTL 600s  (max 3)
 * purpose: 'verify' | 'login' | 'reset'
 * OTP is NEVER stored in DB. NEVER returned in any API response.
 */
export class OtpService {
  generateOtp(): string {
    return randomInt(100000, 999999).toString()
  }

  async storeOtp(userId: string, purpose: OtpPurpose): Promise<string> {
    const otp = this.generateOtp()
    const hash = await bcrypt.hash(otp, 10)
    const { otpKey, attemptsKey } = this.getKeys(userId, purpose)

    await redis
      .multi()
      .set(otpKey, hash, 'EX', otpTtlSeconds)
      .set(attemptsKey, '0', 'EX', otpTtlSeconds)
      .exec()

    return otp
  }

  async verifyOtp(userId: string, purpose: OtpPurpose, inputOtp: string): Promise<OtpVerificationResult> {
    const { otpKey, attemptsKey } = this.getKeys(userId, purpose)
    const attemptsValue = await redis.get(attemptsKey)
    const attempts = Number(attemptsValue ?? '0')

    if (attempts >= maxAttempts) {
      return { valid: false, reason: 'too_many_attempts' }
    }

    const storedHash = await redis.get(otpKey)
    if (!storedHash) {
      return { valid: false, reason: 'expired' }
    }

    const isMatch = await bcrypt.compare(inputOtp, storedHash)
    if (isMatch) {
      await this.revokeOtp(userId, purpose)
      return { valid: true }
    }

    await redis.incr(attemptsKey)
    const ttl = await redis.ttl(attemptsKey)
    if (ttl < 0) {
      await redis.expire(attemptsKey, otpTtlSeconds)
    }

    return { valid: false, reason: 'invalid_code' }
  }

  async revokeOtp(userId: string, purpose: OtpPurpose): Promise<void> {
    const { otpKey, attemptsKey } = this.getKeys(userId, purpose)
    await redis.del(otpKey, attemptsKey)
  }

  private getKeys(userId: string, purpose: OtpPurpose) {
    return {
      otpKey: `otp:${purpose}:${userId}`,
      attemptsKey: `otp_attempts:${purpose}:${userId}`,
    }
  }
}

export const otpService = new OtpService()

export function generateOtp() {
  return otpService.generateOtp()
}
