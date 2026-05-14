"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalLimiter = exports.otpLimiter = exports.loginLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
exports.rateLimiter = rateLimiter;
const redis_1 = require("../config/redis");
const env_1 = require("../config/env");
const asyncHandler_1 = require("../utils/asyncHandler");
const errors_1 = require("../utils/errors");
const noop = (_req, _res, next) => next();
function createRateLimiter(maxRequests, windowSeconds, keyPrefix) {
    if (env_1.env.NODE_ENV === 'test')
        return noop;
    return (0, asyncHandler_1.asyncHandler)(async (req, _res, next) => {
        const ipAddress = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        const key = `rl:${keyPrefix}:${ipAddress}`;
        const count = await redis_1.redis.incr(key);
        if (count === 1) {
            await redis_1.redis.expire(key, windowSeconds);
        }
        if (count > maxRequests) {
            throw (0, errors_1.tooManyRequests)();
        }
        next();
    });
}
function rateLimiter(options = {}) {
    if (env_1.env.NODE_ENV === 'test')
        return noop;
    const maxRequests = options.max ?? 120;
    const windowSeconds = Math.ceil((options.windowMs ?? 60_000) / 1000);
    return createRateLimiter(maxRequests, windowSeconds, 'custom');
}
exports.loginLimiter = createRateLimiter(10, 900, 'login');
exports.otpLimiter = createRateLimiter(5, 300, 'otp');
exports.generalLimiter = createRateLimiter(300, 60, 'general');
