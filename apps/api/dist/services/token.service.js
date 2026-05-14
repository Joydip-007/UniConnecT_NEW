"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenService = exports.TokenService = void 0;
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
const node_crypto_1 = __importDefault(require("node:crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const accessTokenOptions = { expiresIn: '15m' };
const refreshTokenOptions = { expiresIn: '7d' };
class TokenService {
    generateAccessToken(input) {
        return jsonwebtoken_1.default.sign({
            userId: input.userId,
            universityId: input.universityId,
            role: input.role,
            type: 'access',
        }, env_1.env.JWT_SECRET, accessTokenOptions);
    }
    generateRefreshToken(input) {
        return jsonwebtoken_1.default.sign({
            jti: node_crypto_1.default.randomUUID(),
            userId: input.userId,
            universityId: input.universityId,
            type: 'refresh',
        }, env_1.env.JWT_REFRESH_SECRET, refreshTokenOptions);
    }
    verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
            return isAccessTokenPayload(decoded) ? decoded : null;
        }
        catch {
            return null;
        }
    }
    verifyRefreshToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_REFRESH_SECRET);
            return isRefreshTokenPayload(decoded) ? decoded : null;
        }
        catch {
            return null;
        }
    }
    async saveRefreshToken(userId, refreshToken, deviceInfo, ipAddress) {
        await (0, db_1.db)('user_sessions').insert({
            user_id: userId,
            refresh_token: refreshToken,
            device_info: deviceInfo ?? null,
            ip_address: ipAddress ?? null,
            expires_at: db_1.db.raw("NOW() + INTERVAL '7 days'"),
        });
    }
    async revokeRefreshToken(refreshToken) {
        await (0, db_1.db)('user_sessions').where({ refresh_token: refreshToken }).delete();
    }
    async revokeAllUserSessions(userId) {
        await (0, db_1.db)('user_sessions').where({ user_id: userId }).delete();
    }
    async rotateRefreshToken(oldToken, userId, universityId, deviceInfo, ipAddress) {
        const payload = this.verifyRefreshToken(oldToken);
        if (!payload || payload.userId !== userId || payload.universityId !== universityId) {
            return null;
        }
        return db_1.db.transaction(async (trx) => {
            const session = await trx('user_sessions')
                .where({ refresh_token: oldToken, user_id: userId })
                .where('expires_at', '>', trx.fn.now())
                .first();
            if (!session)
                return null;
            await trx('user_sessions').where({ refresh_token: oldToken }).delete();
            const user = await trx('users')
                .select('role')
                .where({ id: userId, university_id: universityId, is_active: true })
                .first();
            if (!user)
                return null;
            const accessToken = this.generateAccessToken({
                userId,
                universityId,
                role: user.role,
            });
            const refreshToken = this.generateRefreshToken({ userId, universityId });
            await trx('user_sessions').insert({
                user_id: userId,
                refresh_token: refreshToken,
                device_info: deviceInfo ?? null,
                ip_address: ipAddress ?? null,
                expires_at: trx.raw("NOW() + INTERVAL '7 days'"),
            });
            return { accessToken, refreshToken };
        });
    }
}
exports.TokenService = TokenService;
exports.tokenService = new TokenService();
function generateAccessToken(input) {
    return exports.tokenService.generateAccessToken(input);
}
function generateRefreshToken(input) {
    return exports.tokenService.generateRefreshToken(input);
}
function verifyAccessToken(token) {
    return exports.tokenService.verifyAccessToken(token);
}
function verifyRefreshToken(token) {
    return exports.tokenService.verifyRefreshToken(token);
}
function isAccessTokenPayload(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return (record.type === 'access' &&
        typeof record.userId === 'string' &&
        typeof record.universityId === 'string' &&
        isUserRole(record.role));
}
function isRefreshTokenPayload(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return (record.type === 'refresh' &&
        typeof record.jti === 'string' &&
        typeof record.userId === 'string' &&
        typeof record.universityId === 'string');
}
function isUserRole(value) {
    return value === 'student' || value === 'alumni' || value === 'staff' || value === 'admin';
}
