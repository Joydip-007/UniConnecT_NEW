"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.notFound = notFound;
exports.unauthorized = unauthorized;
exports.forbidden = forbidden;
exports.badRequest = badRequest;
exports.conflict = conflict;
exports.tooManyRequests = tooManyRequests;
exports.validationError = validationError;
class AppError extends Error {
    statusCode;
    code;
    isOperational = true;
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
function notFound(message = 'Not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
}
function unauthorized(message = 'Unauthorized', code = 'AUTH_REQUIRED') {
    return new AppError(message, 401, code);
}
function forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
}
function badRequest(message = 'Bad request', code = 'BAD_REQUEST') {
    return new AppError(message, 400, code);
}
function conflict(message = 'Conflict', code = 'CONFLICT') {
    return new AppError(message, 409, code);
}
function tooManyRequests(message = 'Too many requests', code = 'RATE_LIMITED') {
    return new AppError(message, 429, code);
}
function validationError(issues) {
    return new AppError(JSON.stringify(issues), 422, 'VALIDATION_ERROR');
}
