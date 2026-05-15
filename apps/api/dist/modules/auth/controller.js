"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.resendOtp = exports.resetPassword = exports.forgotPassword = exports.logout = exports.refresh = exports.verifyLoginOtp = exports.login = exports.verifyOtp = exports.register = void 0;
const env_1 = require("../../config/env");
const asyncHandler_1 = require("../../utils/asyncHandler");
const errors_1 = require("../../utils/errors");
const service_1 = require("./service");
const refreshCookieName = 'refreshToken';
const refreshCookieMaxAge = 7 * 24 * 60 * 60 * 1000;
exports.register = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await service_1.authService.register(req.body, getUniversityId(req), getIpAddress(req), getDeviceInfo(req));
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ data: { message: result.message, accessToken: result.accessToken, user: result.user } });
});
exports.verifyOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    if (body.purpose === 'login') {
        const result = await service_1.authService.verifyLoginOtp(body.email, body.otp, getUniversityId(req), getIpAddress(req), getDeviceInfo(req));
        setRefreshCookie(res, result.refreshToken);
        res.json({ data: { accessToken: result.accessToken, user: result.user } });
        return;
    }
    if (body.purpose === 'reset') {
        throw new errors_1.AppError('Use reset-password to verify reset codes', 422, 'INVALID_OTP_PURPOSE');
    }
    const result = await service_1.authService.verifyAccount(body.email, body.otp, getUniversityId(req), getIpAddress(req), getDeviceInfo(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
});
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const result = await service_1.authService.login(body.email, body.password, getUniversityId(req), getIpAddress(req), getDeviceInfo(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
});
exports.verifyLoginOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const result = await service_1.authService.verifyLoginOtp(body.email, body.otp, getUniversityId(req), getIpAddress(req), getDeviceInfo(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
});
exports.refresh = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const result = await service_1.authService.refreshTokens(req.cookies?.[refreshCookieName], getIpAddress(req), getDeviceInfo(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ data: { accessToken: result.accessToken } });
});
exports.logout = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await service_1.authService.logout(req.cookies?.[refreshCookieName]);
    clearRefreshCookie(res);
    res.status(204).send();
});
exports.forgotPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    res.json({ data: await service_1.authService.forgotPassword(body.email, getUniversityId(req)) });
});
exports.resetPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const result = await service_1.authService.resetPassword(body.email, body.otp, body.new_password, getUniversityId(req));
    res.json({ data: result });
});
exports.resendOtp = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const result = await service_1.authService.resendOtp(body.email, body.purpose, getUniversityId(req));
    res.json({ data: result });
});
exports.me = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw new errors_1.AppError('Unauthorized', 401, 'AUTH_REQUIRED');
    res.json({ data: await service_1.authService.getMe(req.user.userId) });
});
function setRefreshCookie(res, refreshToken) {
    res.cookie(refreshCookieName, refreshToken, {
        httpOnly: true,
        secure: env_1.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: refreshCookieMaxAge,
    });
}
function clearRefreshCookie(res) {
    res.clearCookie(refreshCookieName, {
        httpOnly: true,
        secure: env_1.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
}
function getUniversityId(req) {
    if (!req.university)
        throw new errors_1.AppError('University not found', 404, 'UNIVERSITY_NOT_FOUND');
    return req.university.id;
}
function getIpAddress(req) {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
function getDeviceInfo(req) {
    const userAgent = req.headers['user-agent'];
    return {
        userAgent: Array.isArray(userAgent) ? userAgent.join(' ') : userAgent,
    };
}
