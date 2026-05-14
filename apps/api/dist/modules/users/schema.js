"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationQuerySchema = exports.UserListQuerySchema = exports.UpdateProfileSchema = void 0;
const zod_1 = require("zod");
const optionalString = zod_1.z.string().trim().nullable().optional();
exports.UpdateProfileSchema = zod_1.z.object({
    full_name: zod_1.z.string().trim().min(1).optional(),
    bio: optionalString,
    headline: optionalString,
    department: optionalString,
    batch_year: optionalString,
    linkedin_url: optionalString,
    phone: optionalString,
    skills: zod_1.z.array(zod_1.z.string().trim().min(1)).optional(),
    avatar_url: optionalString,
    cover_url: optionalString,
    is_open_to_work: zod_1.z.boolean().optional(),
});
exports.UserListQuerySchema = zod_1.z.object({
    role: zod_1.z.enum(['student', 'alumni', 'staff', 'admin']).optional(),
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
