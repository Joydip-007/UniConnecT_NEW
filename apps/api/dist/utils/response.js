"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendPaginated = sendPaginated;
exports.sendFailure = sendFailure;
function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({ data });
}
function sendPaginated(res, items, total, page, limit) {
    return res.json({
        data: {
            items,
            total,
            page,
            hasMore: page * limit < total,
        },
    });
}
function sendFailure(res, error, code, statusCode) {
    return res.status(statusCode).json({ error, code });
}
