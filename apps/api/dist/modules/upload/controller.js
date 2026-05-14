"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presignUpload = void 0;
const errors_1 = require("../../utils/errors");
const asyncHandler_1 = require("../../utils/asyncHandler");
const upload_service_1 = require("../../services/upload.service");
const response_1 = require("../../utils/response");
exports.presignUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || !req.university)
        throw (0, errors_1.unauthorized)();
    const query = req.query;
    const key = `uploads/${req.university.id}/${req.user.userId}/${Date.now()}-${(0, upload_service_1.sanitizeFileName)(query.filename)}`;
    (0, response_1.sendSuccess)(res, await (0, upload_service_1.getPresignedUploadUrl)(key, query.contentType));
});
