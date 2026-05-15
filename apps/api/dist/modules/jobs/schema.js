"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateApplicationSchema = exports.ApplyJobSchema = exports.UpdateJobSchema = exports.CreateJobSchema = exports.JobListQuerySchema = exports.PaginationQuerySchema = exports.ApplicationStatusSchema = exports.JobTypeSchema = void 0;
const zod_1 = require("zod");
exports.JobTypeSchema = zod_1.z.enum(['full_time', 'part_time', 'internship', 'remote', 'contract']);
exports.ApplicationStatusSchema = zod_1.z.enum([
    'pending',
    'reviewed',
    'shortlisted',
    'interviewed',
    'offered',
    'rejected',
]);
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.JobListQuerySchema = exports.PaginationQuerySchema.extend({
    type: exports.JobTypeSchema.optional(),
    search: zod_1.z.string().trim().min(1).optional(),
    location: zod_1.z.string().trim().min(1).optional(),
});
exports.CreateJobSchema = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(1).max(255),
    company: zod_1.z.string().trim().min(1).max(255),
    location: zod_1.z.string().trim().min(1).max(255),
    type: exports.JobTypeSchema,
    description: zod_1.z.string().trim().min(1),
    requirements: zod_1.z.array(zod_1.z.string().trim().min(1)).default([]),
    salary_range: zod_1.z.string().trim().max(100).nullable().optional(),
    salaryRange: zod_1.z.string().trim().max(100).nullable().optional(),
    application_url: zod_1.z.string().url().nullable().optional(),
    applicationUrl: zod_1.z.string().url().nullable().optional(),
    deadline: zod_1.z.string().datetime({ offset: true }),
})
    .transform((value) => ({
    title: value.title,
    company: value.company,
    location: value.location,
    type: value.type,
    description: value.description,
    requirements: value.requirements,
    salary_range: value.salary_range ?? value.salaryRange,
    application_url: value.application_url ?? value.applicationUrl,
    deadline: value.deadline,
}));
exports.UpdateJobSchema = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(1).max(255).optional(),
    company: zod_1.z.string().trim().min(1).max(255).optional(),
    location: zod_1.z.string().trim().min(1).max(255).optional(),
    type: exports.JobTypeSchema.optional(),
    description: zod_1.z.string().trim().min(1).optional(),
    requirements: zod_1.z.array(zod_1.z.string().trim().min(1)).optional(),
    salary_range: zod_1.z.string().trim().max(100).nullable().optional(),
    salaryRange: zod_1.z.string().trim().max(100).nullable().optional(),
    application_url: zod_1.z.string().url().nullable().optional(),
    applicationUrl: zod_1.z.string().url().nullable().optional(),
    deadline: zod_1.z.string().datetime({ offset: true }).optional(),
    is_active: zod_1.z.boolean().optional(),
    isActive: zod_1.z.boolean().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
})
    .transform((value) => ({
    title: value.title,
    company: value.company,
    location: value.location,
    type: value.type,
    description: value.description,
    requirements: value.requirements,
    salary_range: value.salary_range ?? value.salaryRange,
    application_url: value.application_url ?? value.applicationUrl,
    deadline: value.deadline,
    is_active: value.is_active ?? value.isActive,
}));
exports.ApplyJobSchema = zod_1.z
    .object({
    resume_url: zod_1.z.string().url().nullable().optional(),
    resumeUrl: zod_1.z.string().url().nullable().optional(),
    cover_letter: zod_1.z.string().trim().nullable().optional(),
    coverLetter: zod_1.z.string().trim().nullable().optional(),
})
    .transform((value) => ({
    resume_url: value.resume_url ?? value.resumeUrl,
    cover_letter: value.cover_letter ?? value.coverLetter,
}));
exports.UpdateApplicationSchema = zod_1.z
    .object({
    status: exports.ApplicationStatusSchema.optional(),
    notes: zod_1.z.string().trim().nullable().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
});
