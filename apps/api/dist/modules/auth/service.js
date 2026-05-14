"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../../config/db");
const redis_1 = require("../../config/redis");
const email_queue_1 = require("../../queues/email.queue");
const email_service_1 = require("../../services/email.service");
const otp_service_1 = require("../../services/otp.service");
const token_service_1 = require("../../services/token.service");
const errors_1 = require("../../utils/errors");
const env_1 = require("../../config/env");
const logger_1 = require("../../utils/logger");
const authMessages = {
    verifySent: 'Check your email for a 6-digit verification code.',
    loginSent: 'A 6-digit login code was sent to your email.',
    resetSent: 'If an account exists, a reset code was sent.',
    passwordReset: 'Password reset. Please log in.',
};
class AuthService {
    async register(data, universityId, _ipAddress, _deviceInfo) {
        const invitation = data.invitation_token ? await getInvitation(data.invitation_token) : null;
        const email = data.email ?? invitation?.email;
        const role = data.role ?? invitation?.role;
        if (!email || !role || !data.full_name) {
            throw new errors_1.AppError('Invitation token is required', 422, 'VALIDATION_ERROR');
        }
        if (invitation) {
            validateInvitationForRegistration(invitation, email, role, universityId);
        }
        const existingUser = await findUserByEmail(email, universityId);
        if (existingUser) {
            throw new errors_1.AppError('An account already exists for this email', 409, 'CONFLICT');
        }
        const passwordHash = data.password ? await bcryptjs_1.default.hash(data.password, 12) : null;
        const user = await db_1.db.transaction(async (trx) => {
            const [createdUser] = await trx('users')
                .insert({
                university_id: universityId,
                email,
                password_hash: passwordHash,
                role,
                is_verified: false,
            })
                .returning('*');
            await trx('profiles').insert({
                user_id: createdUser.id,
                full_name: data.full_name,
            });
            if (invitation) {
                await trx('invitations').where({ token: invitation.token }).update({ is_used: true });
            }
            return createdUser;
        });
        const profile = await findUserWithProfile(user.id);
        if (!profile)
            throw new errors_1.AppError('User not found', 404, 'NOT_FOUND');
        const otp = await otp_service_1.otpService.storeOtp(user.id, 'verify');
        await sendOtpOrThrow(user.email, otp, 'verify', data.full_name);
        const accessToken = token_service_1.tokenService.generateAccessToken({
            userId: user.id,
            universityId: user.university_id,
            role: user.role,
        });
        const refreshToken = token_service_1.tokenService.generateRefreshToken({
            userId: user.id,
            universityId: user.university_id,
        });
        await token_service_1.tokenService.saveRefreshToken(user.id, refreshToken, _deviceInfo ?? null, _ipAddress ?? null);
        return {
            message: authMessages.verifySent,
            accessToken,
            refreshToken,
            user: toAuthUser(profile),
        };
    }
    async verifyAccount(email, otp, universityId, ipAddress, deviceInfo) {
        const user = await findUserByEmail(email, universityId);
        if (!user)
            throw new errors_1.AppError('User not found', 404, 'NOT_FOUND');
        if (user.is_verified) {
            throw new errors_1.AppError('Account already verified', 409, 'CONFLICT');
        }
        await verifyOtpOrThrow(user.id, 'verify', otp);
        await (0, db_1.db)('users').where({ id: user.id }).update({ is_verified: true });
        const profile = await findUserWithProfile(user.id);
        const accessToken = token_service_1.tokenService.generateAccessToken({
            userId: user.id,
            universityId: user.university_id,
            role: user.role,
        });
        const refreshToken = token_service_1.tokenService.generateRefreshToken({
            userId: user.id,
            universityId: user.university_id,
        });
        await token_service_1.tokenService.saveRefreshToken(user.id, refreshToken, deviceInfo ?? null, ipAddress ?? null);
        await queueWelcomeEmail(user, profile?.full_name ?? user.email);
        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                universityId: user.university_id,
            },
        };
    }
    async login(email, password, universityId, ipAddress, deviceInfo) {
        const user = await findUserWithProfileByEmail(email, universityId);
        if (!user || !user.is_active) {
            throw new errors_1.AppError('Invalid email or password', 401, 'UNAUTHORIZED');
        }
        if (!user.is_verified) {
            throw new errors_1.AppError('Account is not verified', 403, 'ACCOUNT_NOT_VERIFIED');
        }
        if (!user.password_hash)
            throw new errors_1.AppError('Invalid email or password', 401, 'UNAUTHORIZED');
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isPasswordValid)
            throw new errors_1.AppError('Invalid email or password', 401, 'UNAUTHORIZED');
        const accessToken = token_service_1.tokenService.generateAccessToken({
            userId: user.id,
            universityId: user.university_id,
            role: user.role,
        });
        const refreshToken = token_service_1.tokenService.generateRefreshToken({
            userId: user.id,
            universityId: user.university_id,
        });
        await token_service_1.tokenService.saveRefreshToken(user.id, refreshToken, deviceInfo ?? null, ipAddress ?? null);
        await (0, db_1.db)('users').where({ id: user.id }).update({ last_active_at: db_1.db.fn.now() });
        return {
            accessToken,
            refreshToken,
            user: toAuthUser(user),
        };
    }
    async verifyLoginOtp(email, otp, universityId, ipAddress, deviceInfo) {
        const user = await findUserWithProfileByEmail(email, universityId);
        if (!user || !user.is_active)
            throw new errors_1.AppError('User not found', 404, 'NOT_FOUND');
        await verifyOtpOrThrow(user.id, 'login', otp);
        const accessToken = token_service_1.tokenService.generateAccessToken({
            userId: user.id,
            universityId: user.university_id,
            role: user.role,
        });
        const refreshToken = token_service_1.tokenService.generateRefreshToken({
            userId: user.id,
            universityId: user.university_id,
        });
        await token_service_1.tokenService.saveRefreshToken(user.id, refreshToken, deviceInfo ?? null, ipAddress ?? null);
        return {
            accessToken,
            refreshToken,
            user: toAuthUser(user),
        };
    }
    async refreshTokens(refreshToken, ipAddress, deviceInfo) {
        if (!refreshToken)
            throw new errors_1.AppError('Unauthorized', 401, 'AUTH_REQUIRED');
        const payload = token_service_1.tokenService.verifyRefreshToken(refreshToken);
        if (!payload)
            throw new errors_1.AppError('Unauthorized', 401, 'AUTH_REQUIRED');
        const tokens = await token_service_1.tokenService.rotateRefreshToken(refreshToken, payload.userId, payload.universityId, deviceInfo ?? null, ipAddress ?? null);
        if (!tokens)
            throw new errors_1.AppError('Unauthorized', 401, 'AUTH_REQUIRED');
        return tokens;
    }
    async logout(refreshToken) {
        if (refreshToken)
            await token_service_1.tokenService.revokeRefreshToken(refreshToken);
    }
    async forgotPassword(email, universityId) {
        const user = await findUserWithProfileByEmail(email, universityId);
        if (!user || !user.is_active) {
            return { message: authMessages.resetSent };
        }
        const otp = await otp_service_1.otpService.storeOtp(user.id, 'reset');
        await sendOtpOrThrow(user.email, otp, 'reset', user.full_name);
        return { message: authMessages.resetSent };
    }
    async resetPassword(email, otp, newPassword, universityId) {
        const user = await findUserByEmail(email, universityId);
        if (!user)
            throw new errors_1.AppError('User not found', 404, 'NOT_FOUND');
        await verifyOtpOrThrow(user.id, 'reset', otp);
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        await (0, db_1.db)('users').where({ id: user.id }).update({ password_hash: passwordHash });
        await token_service_1.tokenService.revokeAllUserSessions(user.id);
        return { message: authMessages.passwordReset };
    }
    async resendOtp(email, purpose, universityId) {
        const user = await findUserWithProfileByEmail(email, universityId);
        if (!user || !user.is_active)
            throw new errors_1.AppError('User not found', 404, 'NOT_FOUND');
        await enforceOtpResendLimit(user.id);
        await otp_service_1.otpService.revokeOtp(user.id, purpose);
        const otp = await otp_service_1.otpService.storeOtp(user.id, purpose);
        await sendOtpOrThrow(user.email, otp, purpose, user.full_name);
        return { message: 'A new 6-digit code was sent to your email.' };
    }
    async getMe(userId) {
        const user = await findUserWithProfile(userId);
        if (!user)
            throw new errors_1.AppError('User not found', 404, 'NOT_FOUND');
        return toAuthUser(user);
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
async function findUserByEmail(email, universityId) {
    return (0, db_1.db)('users')
        .where({
        email: email.toLowerCase(),
        university_id: universityId,
    })
        .first();
}
async function findUserWithProfile(userId) {
    return (0, db_1.db)('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .select('users.id', 'users.university_id', 'users.email', 'users.password_hash', 'users.role', 'users.is_verified', 'users.is_active', 'profiles.full_name', 'profiles.avatar_url')
        .where('users.id', userId)
        .first();
}
async function findUserWithProfileByEmail(email, universityId) {
    return (0, db_1.db)('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .select('users.id', 'users.university_id', 'users.email', 'users.password_hash', 'users.role', 'users.is_verified', 'users.is_active', 'profiles.full_name', 'profiles.avatar_url')
        .where({
        'users.email': email.toLowerCase(),
        'users.university_id': universityId,
    })
        .first();
}
function toAuthUser(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        universityId: user.university_id,
        isVerified: user.is_verified,
        profile: {
            fullName: user.full_name,
            bio: null,
            avatarUrl: user.avatar_url,
            coverUrl: null,
            headline: null,
            department: null,
            batchYear: null,
            linkedinUrl: null,
            phone: null,
            skills: [],
            isOpenToWork: false,
        },
    };
}
async function getInvitation(token) {
    return (0, db_1.db)('invitations').where({ token }).first();
}
function validateInvitationForRegistration(invitation, email, role, universityId) {
    if (invitation.is_used ||
        invitation.expires_at.getTime() <= Date.now() ||
        invitation.university_id !== universityId ||
        invitation.role !== role ||
        invitation.email.toLowerCase() !== email.toLowerCase()) {
        throw new errors_1.AppError('Invitation token is invalid or expired', 404, 'NOT_FOUND');
    }
}
async function verifyOtpOrThrow(userId, purpose, otp) {
    const result = await otp_service_1.otpService.verifyOtp(userId, purpose, otp);
    if (result.valid)
        return;
    if (result.reason === 'too_many_attempts') {
        throw new errors_1.AppError('Too many OTP attempts', 429, 'OTP_TOO_MANY_ATTEMPTS');
    }
    if (result.reason === 'expired') {
        throw new errors_1.AppError('OTP expired', 422, 'OTP_EXPIRED');
    }
    throw new errors_1.AppError('Invalid OTP code', 422, 'OTP_INVALID');
}
async function sendOtpOrThrow(to, otp, purpose, userName) {
    const result = await email_service_1.emailService.sendOtpEmail(to, otp, purpose, userName);
    if (result.success)
        return;
    logger_1.logger.warn('OTP email send failed', {
        to,
        purpose,
        error: result.error,
        devOtp: env_1.env.NODE_ENV === 'production' ? undefined : otp,
    });
    if (env_1.env.NODE_ENV === 'production') {
        throw new errors_1.AppError('Could not send verification email', 502, 'EMAIL_SEND_FAILED');
    }
}
async function queueWelcomeEmail(user, userName) {
    const university = await (0, db_1.db)('universities').select('name').where({ id: user.university_id }).first();
    const universityName = university?.name ?? 'your university';
    void email_queue_1.emailQueue
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
        .catch((error) => {
        logger_1.logger.warn('Welcome email queue enqueue failed', { error });
        void email_service_1.emailService.sendWelcomeEmail(user.email, userName, user.role, universityName);
    });
}
async function enforceOtpResendLimit(userId) {
    const key = `otp_resend:${userId}`;
    const count = await redis_1.redis.incr(key);
    if (count === 1) {
        await redis_1.redis.expire(key, 600);
    }
    if (count > 3) {
        throw new errors_1.AppError('Too many OTP resend requests', 429, 'OTP_RESEND_LIMITED');
    }
}
