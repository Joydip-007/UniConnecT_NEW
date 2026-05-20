"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUniversity = exports.resolveUniversity = void 0;
const db_1 = require("../config/db");
const token_service_1 = require("../services/token.service");
const asyncHandler_1 = require("../utils/asyncHandler");
const errors_1 = require("../utils/errors");
exports.resolveUniversity = (0, asyncHandler_1.asyncHandler)(async (req, _res, next) => {
    const domain = getUniversityDomain(req);
    const universityId = req.user?.universityId ??
        req.auth?.universityId ??
        getUniversityIdFromBearerToken(req) ??
        getUniversityIdFromRefreshCookie(req);
    const query = (0, db_1.db)('universities')
        .select('id', 'name', 'domain', 'plan', 'is_active', 'allowed_email_domains')
        .first();
    if (domain) {
        query.where({ domain });
    }
    else if (universityId) {
        query.where({ id: universityId });
    }
    else {
        throw new errors_1.AppError('University not found', 404, 'UNIVERSITY_NOT_FOUND');
    }
    const university = await query;
    if (!university || !university.is_active) {
        throw new errors_1.AppError('University not found', 404, 'UNIVERSITY_NOT_FOUND');
    }
    req.university = {
        id: university.id,
        name: university.name,
        domain: university.domain,
        plan: university.plan,
        allowedEmailDomains: university.allowed_email_domains ?? [],
    };
    next();
});
exports.requireUniversity = exports.resolveUniversity;
function getUniversityDomain(req) {
    const headerValue = req.header('x-university-domain');
    if (!headerValue)
        return null;
    return headerValue.trim().toLowerCase();
}
function getUniversityIdFromBearerToken(req) {
    const header = req.header('authorization');
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token)
        return null;
    return (0, token_service_1.verifyAccessToken)(token)?.universityId ?? null;
}
function getUniversityIdFromRefreshCookie(req) {
    const refreshToken = req.cookies?.refreshToken;
    if (typeof refreshToken !== 'string')
        return null;
    return (0, token_service_1.verifyRefreshToken)(refreshToken)?.universityId ?? null;
}
