"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteToGroupSchema = exports.UpdateMemberSchema = exports.UpdateGroupSchema = exports.CreateGroupSchema = exports.MembersQuerySchema = exports.GroupListQuerySchema = exports.PaginationQuerySchema = exports.AllowedRoleSchema = exports.GroupRoleSchema = exports.GroupTypeSchema = void 0;
const zod_1 = require("zod");
exports.GroupTypeSchema = zod_1.z.enum(['department', 'club', 'batch', 'research', 'interest', 'other']);
exports.GroupRoleSchema = zod_1.z.enum(['owner', 'admin', 'moderator', 'member']);
exports.AllowedRoleSchema = zod_1.z.enum(['student', 'alumni', 'faculty', 'admin']);
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.GroupListQuerySchema = exports.PaginationQuerySchema.extend({
    type: exports.GroupTypeSchema.optional(),
    search: zod_1.z.string().trim().min(1).optional(),
});
exports.MembersQuerySchema = exports.PaginationQuerySchema.extend({
    search: zod_1.z.string().trim().min(1).optional(),
});
exports.CreateGroupSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(255),
    description: zod_1.z.string().trim().min(1),
    type: exports.GroupTypeSchema,
    avatar_url: zod_1.z.string().url().nullable().optional(),
    cover_url: zod_1.z.string().url().nullable().optional(),
    is_private: zod_1.z.boolean().default(false),
    allowed_role: exports.AllowedRoleSchema.nullable().optional(),
});
exports.UpdateGroupSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(255).optional(),
    description: zod_1.z.string().trim().min(1).optional(),
    type: exports.GroupTypeSchema.optional(),
    avatar_url: zod_1.z.string().url().nullable().optional(),
    cover_url: zod_1.z.string().url().nullable().optional(),
    is_private: zod_1.z.boolean().optional(),
    allowed_role: exports.AllowedRoleSchema.nullable().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
});
exports.UpdateMemberSchema = zod_1.z.object({
    role: exports.GroupRoleSchema,
});
exports.InviteToGroupSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
});
