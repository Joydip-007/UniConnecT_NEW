"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminFulfillRedemptionSchema = exports.AdminRedemptionListSchema = exports.ToggleActiveSchema = exports.TogglePublishSchema = exports.TogglePinSchema = exports.ContentListQuerySchema = exports.ContentKindSchema = exports.CreateBulkInvitationsSchema = exports.UpdateAllowedDomainsSchema = exports.CreateInvitationSchema = exports.ResolveReportSchema = exports.UpdateUserStatusSchema = exports.UpdateUserRoleSchema = exports.PaginationQuerySchema = void 0;
const zod_1 = require("zod");
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.UpdateUserRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(['student', 'alumni', 'faculty', 'admin']),
});
exports.UpdateUserStatusSchema = zod_1.z.object({
    is_active: zod_1.z.boolean(),
});
exports.ResolveReportSchema = zod_1.z.object({
    status: zod_1.z.enum(['reviewed', 'resolved', 'dismissed']),
});
exports.CreateInvitationSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(['student', 'alumni', 'faculty', 'admin']).default('student'),
    expires_in_days: zod_1.z.number().int().min(1).max(30).default(7),
});
exports.UpdateAllowedDomainsSchema = zod_1.z.object({
    allowed_email_domains: zod_1.z
        .array(zod_1.z.string().trim().min(1).toLowerCase())
        .max(20, 'Maximum 20 allowed domains'),
});
exports.CreateBulkInvitationsSchema = zod_1.z.object({
    emails: zod_1.z.array(zod_1.z.string().email()).min(1).max(50),
    role: zod_1.z.enum(['student', 'alumni', 'faculty', 'admin']).default('student'),
    expires_in_days: zod_1.z.number().int().min(1).max(30).default(7),
});
exports.ContentKindSchema = zod_1.z.enum(['posts', 'events', 'jobs', 'news']);
exports.ContentListQuerySchema = exports.PaginationQuerySchema.extend({
    filter: zod_1.z.enum(['all', 'pinned', 'published', 'unpublished', 'active', 'closed']).default('all'),
});
exports.TogglePinSchema = zod_1.z.object({
    is_pinned: zod_1.z.boolean(),
});
exports.TogglePublishSchema = zod_1.z.object({
    is_published: zod_1.z.boolean(),
});
exports.ToggleActiveSchema = zod_1.z.object({
    is_active: zod_1.z.boolean(),
});
exports.AdminRedemptionListSchema = exports.PaginationQuerySchema.extend({
    status: zod_1.z.enum(['pending', 'fulfilled', 'rejected']).optional(),
});
exports.AdminFulfillRedemptionSchema = zod_1.z
    .object({
    status: zod_1.z.enum(['fulfilled', 'rejected']),
    codeText: zod_1.z.string().trim().min(1).max(200).optional(),
    adminNote: zod_1.z.string().trim().max(500).optional(),
})
    .refine((v) => v.status !== 'fulfilled' || (v.codeText !== undefined && v.codeText.length > 0), {
    message: 'codeText is required when fulfilling a redemption',
    path: ['codeText'],
});
