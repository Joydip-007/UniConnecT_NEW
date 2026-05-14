"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateInvitationSchema = exports.ResolveReportSchema = exports.UpdateUserStatusSchema = exports.UpdateUserRoleSchema = exports.PaginationQuerySchema = void 0;
const zod_1 = require("zod");
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.UpdateUserRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(['student', 'alumni', 'staff', 'admin']),
});
exports.UpdateUserStatusSchema = zod_1.z.object({
    is_active: zod_1.z.boolean(),
});
exports.ResolveReportSchema = zod_1.z.object({
    status: zod_1.z.enum(['reviewed', 'resolved', 'dismissed']),
});
exports.CreateInvitationSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(['student', 'alumni', 'staff', 'admin']).default('student'),
    expires_in_days: zod_1.z.number().int().min(1).max(30).default(7),
});
