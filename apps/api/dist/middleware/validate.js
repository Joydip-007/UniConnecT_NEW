"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
exports.validateBody = validateBody;
exports.validateRequest = validateRequest;
const errors_1 = require("../utils/errors");
function validate(schema) {
    return (req, _res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            next((0, errors_1.validationError)(result.error.issues));
            return;
        }
        req.body = result.data;
        next();
    };
}
function validateBody(schema) {
    return validate(schema);
}
function validateRequest(schemas) {
    return (req, _res, next) => {
        if (schemas.body) {
            const result = schemas.body.safeParse(req.body);
            if (!result.success) {
                next((0, errors_1.validationError)(result.error.issues));
                return;
            }
            req.body = result.data;
        }
        if (schemas.params) {
            const result = schemas.params.safeParse(req.params);
            if (!result.success) {
                next((0, errors_1.validationError)(result.error.issues));
                return;
            }
            req.params = result.data;
        }
        if (schemas.query) {
            const result = schemas.query.safeParse(req.query);
            if (!result.success) {
                next((0, errors_1.validationError)(result.error.issues));
                return;
            }
            // Express 5 makes req.query a read-only getter on the prototype;
            // define an own property to shadow it with the parsed value.
            Object.defineProperty(req, 'query', {
                value: result.data,
                writable: true,
                configurable: true,
                enumerable: true,
            });
        }
        next();
    };
}
