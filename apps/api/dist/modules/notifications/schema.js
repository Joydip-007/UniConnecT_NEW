"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationListQuerySchema = void 0;
const zod_1 = require("zod");
exports.NotificationListQuerySchema = zod_1.z.object({
    isRead: zod_1.z.coerce.boolean().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
