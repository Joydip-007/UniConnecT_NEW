"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRefreshCookie = setRefreshCookie;
exports.clearRefreshCookie = clearRefreshCookie;
const env_1 = require("../config/env");
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
function setRefreshCookie(res, refreshToken) {
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env_1.env.NODE_ENV === 'production',
        maxAge: sevenDaysMs,
        path: '/api/v1/auth',
    });
}
function clearRefreshCookie(res) {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: 'lax',
        secure: env_1.env.NODE_ENV === 'production',
        path: '/api/v1/auth',
    });
}
