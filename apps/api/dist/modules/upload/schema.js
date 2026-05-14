"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresignUploadQuerySchema = void 0;
const zod_1 = require("zod");
exports.PresignUploadQuerySchema = zod_1.z.object({
    filename: zod_1.z.string().trim().min(1),
    contentType: zod_1.z.string().trim().min(1),
});
