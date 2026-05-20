"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchPagedQuerySchema = exports.SearchAllQuerySchema = void 0;
const zod_1 = require("zod");
exports.SearchAllQuerySchema = zod_1.z.object({
    q: zod_1.z.string().min(2, 'Query must be at least 2 characters').max(100),
    limit: zod_1.z.coerce.number().int().min(1).max(10).default(3),
});
exports.SearchPagedQuerySchema = zod_1.z.object({
    q: zod_1.z.string().min(2, 'Query must be at least 2 characters').max(100),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(20),
});
