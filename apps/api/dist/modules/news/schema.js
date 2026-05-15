"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateNewsSchema = exports.CreateNewsSchema = exports.NewsListQuerySchema = void 0;
const zod_1 = require("zod");
exports.NewsListQuerySchema = zod_1.z.object({
    category: zod_1.z.string().trim().min(1).optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.CreateNewsSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(500),
    body: zod_1.z.string().trim().min(1),
    cover_url: zod_1.z.string().url().nullable().optional(),
    category: zod_1.z.string().trim().min(1).max(100),
    is_published: zod_1.z.boolean().default(false),
    is_pinned: zod_1.z.boolean().default(false),
});
exports.UpdateNewsSchema = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(1).max(500).optional(),
    body: zod_1.z.string().trim().min(1).optional(),
    cover_url: zod_1.z.string().url().nullable().optional(),
    category: zod_1.z.string().trim().min(1).max(100).optional(),
    is_published: zod_1.z.boolean().optional(),
    is_pinned: zod_1.z.boolean().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
});
