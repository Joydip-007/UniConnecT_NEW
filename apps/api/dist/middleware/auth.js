"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
exports.requireRole = requireRole;
const token_service_1 = require("../services/token.service");
const asyncHandler_1 = require("../utils/asyncHandler");
const errors_1 = require("../utils/errors");
exports.requireAuth = (0, asyncHandler_1.asyncHandler)(async (req, _res, next) => {
    const token = getBearerToken(req);
    if (!token) {
        throw new errors_1.AppError('Unauthorized', 401, 'AUTH_REQUIRED');
    }
    const payload = (0, token_service_1.verifyAccessToken)(token);
    if (!payload) {
        throw new errors_1.AppError('Unauthorized', 401, 'AUTH_REQUIRED');
    }
    const authContext = {
        userId: payload.userId,
        universityId: payload.universityId,
        role: payload.role,
    };
    req.user = authContext;
    req.auth = authContext;
    next();
});
function requireRole(...roles) {
    return (0, asyncHandler_1.asyncHandler)(async (req, _res, next) => {
        if (!req.user) {
            throw new errors_1.AppError('Unauthorized', 401, 'AUTH_REQUIRED');
        }
        if (!roles.includes(req.user.role)) {
            throw new errors_1.AppError('Forbidden', 403, 'INSUFFICIENT_ROLE');
        }
        next();
    });
}
function getBearerToken(req) {
    const header = req.header('authorization');
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token)
        return null;
    return token;
}
