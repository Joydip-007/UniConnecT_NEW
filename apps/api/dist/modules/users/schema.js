"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePreferencesSchema = exports.PaginationQuerySchema = exports.UserListQuerySchema = exports.UpdateProfileSchema = void 0;
const zod_1 = require("zod");
const optionalString = zod_1.z.string().trim().nullable().optional();
exports.UpdateProfileSchema = zod_1.z
    .object({
    fullName: zod_1.z.string().trim().min(1).optional(),
    bio: optionalString,
    headline: optionalString,
    department: optionalString,
    batchYear: optionalString,
    linkedinUrl: optionalString,
    phone: optionalString,
    skills: zod_1.z.array(zod_1.z.string().trim().min(1)).optional(),
    avatarUrl: optionalString,
    coverUrl: optionalString,
    isOpenToWork: zod_1.z.boolean().optional(),
    isOpenToMentorship: zod_1.z.boolean().optional(),
})
    .strict();
exports.UserListQuerySchema = zod_1.z.object({
    role: zod_1.z.enum(['student', 'alumni', 'faculty', 'admin']).optional(),
    department: zod_1.z.string().trim().min(1).optional(),
    batch_year: zod_1.z.string().trim().min(1).optional(),
    search: zod_1.z.string().trim().min(1).optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.UpdatePreferencesSchema = zod_1.z
    .object({
    themePreference: zod_1.z.enum(['light', 'dark', 'system']).optional(),
})
    .strict();
