"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
function errorHandler(err, _req, res, _next) {
    if (err instanceof errors_1.AppError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
    }
    if (err instanceof zod_1.ZodError) {
        res.status(422).json({
            error: 'Request validation failed',
            code: 'VALIDATION_ERROR',
            issues: err.format(),
        });
        return;
    }
    logger_1.logger.error('Unhandled API error', { err });
    const body = {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
    };
    if (env_1.env.NODE_ENV !== 'production' && err instanceof Error) {
        body.stack = err.stack;
    }
    res.status(500).json(body);
}
