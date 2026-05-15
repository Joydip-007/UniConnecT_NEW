"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpService = exports.OtpService = void 0;
exports.generateOtp = generateOtp;
const node_crypto_1 = require("node:crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const redis_1 = require("../config/redis");
const otpTtlSeconds = 600;
const maxAttempts = 5;
/**
 * Redis OTP Key Schema:
 *   otp:{purpose}:{userId}          → bcrypt hash of OTP,  TTL 600s
 *   otp_attempts:{purpose}:{userId} → attempt counter,     TTL 600s  (max 5)
 *   otp_resend:{userId}             → resend counter,      TTL 600s  (max 3)
 * purpose: 'verify' | 'login' | 'reset'
 * OTP is NEVER stored in DB. NEVER returned in any API response.
 */
class OtpService {
    generateOtp() {
        return (0, node_crypto_1.randomInt)(100000, 999999).toString();
    }
    async storeOtp(userId, purpose) {
        const otp = this.generateOtp();
        const hash = await bcryptjs_1.default.hash(otp, 10);
        const { otpKey, attemptsKey } = this.getKeys(userId, purpose);
        await redis_1.redis
            .multi()
            .set(otpKey, hash, 'EX', otpTtlSeconds)
            .set(attemptsKey, '0', 'EX', otpTtlSeconds)
            .exec();
        return otp;
    }
    async verifyOtp(userId, purpose, inputOtp) {
        const { otpKey, attemptsKey } = this.getKeys(userId, purpose);
        const attemptsValue = await redis_1.redis.get(attemptsKey);
        const attempts = Number(attemptsValue ?? '0');
        if (attempts >= maxAttempts) {
            return { valid: false, reason: 'too_many_attempts' };
        }
        const storedHash = await redis_1.redis.get(otpKey);
        if (!storedHash) {
            return { valid: false, reason: 'expired' };
        }
        const isMatch = await bcryptjs_1.default.compare(inputOtp, storedHash);
        if (isMatch) {
            await this.revokeOtp(userId, purpose);
            return { valid: true };
        }
        await redis_1.redis.incr(attemptsKey);
        const ttl = await redis_1.redis.ttl(attemptsKey);
        if (ttl < 0) {
            await redis_1.redis.expire(attemptsKey, otpTtlSeconds);
        }
        return { valid: false, reason: 'invalid_code' };
    }
    async revokeOtp(userId, purpose) {
        const { otpKey, attemptsKey } = this.getKeys(userId, purpose);
        await redis_1.redis.del(otpKey, attemptsKey);
    }
    getKeys(userId, purpose) {
        return {
            otpKey: `otp:${purpose}:${userId}`,
            attemptsKey: `otp_attempts:${purpose}:${userId}`,
        };
    }
}
exports.OtpService = OtpService;
exports.otpService = new OtpService();
function generateOtp() {
    return exports.otpService.generateOtp();
}
