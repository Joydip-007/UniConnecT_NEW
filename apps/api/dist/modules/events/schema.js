"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RsvpSchema = exports.UpdateEventSchema = exports.CreateEventSchema = exports.AttendeesQuerySchema = exports.EventListQuerySchema = exports.PaginationQuerySchema = exports.RsvpStatusSchema = exports.EventTypeSchema = void 0;
const zod_1 = require("zod");
exports.EventTypeSchema = zod_1.z.enum(['general', 'career_fair', 'seminar', 'alumni_meetup', 'workshop', 'club']);
exports.RsvpStatusSchema = zod_1.z.enum(['going', 'maybe', 'not_going']);
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.EventListQuerySchema = exports.PaginationQuerySchema.extend({
    type: exports.EventTypeSchema.optional(),
    from: zod_1.z.string().datetime({ offset: true }).optional(),
    to: zod_1.z.string().datetime({ offset: true }).optional(),
});
exports.AttendeesQuerySchema = exports.PaginationQuerySchema.extend({
    status: exports.RsvpStatusSchema.optional(),
});
exports.CreateEventSchema = zod_1.z
    .object({
    group_id: zod_1.z.string().uuid().nullable().optional(),
    groupId: zod_1.z.string().uuid().nullable().optional(),
    title: zod_1.z.string().trim().min(1).max(255),
    description: zod_1.z.string().trim().min(1),
    location: zod_1.z.string().trim().min(1).max(255),
    is_online: zod_1.z.boolean().default(false),
    isOnline: zod_1.z.boolean().optional(),
    online_link: zod_1.z.string().url().nullable().optional(),
    onlineLink: zod_1.z.string().url().nullable().optional(),
    cover_url: zod_1.z.string().url().nullable().optional(),
    coverUrl: zod_1.z.string().url().nullable().optional(),
    starts_at: zod_1.z.string().datetime({ offset: true }).optional(),
    startsAt: zod_1.z.string().datetime({ offset: true }).optional(),
    ends_at: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    capacity: zod_1.z.number().int().positive().nullable().optional(),
    type: exports.EventTypeSchema.default('general'),
})
    .transform((value) => ({
    group_id: value.group_id ?? value.groupId,
    title: value.title,
    description: value.description,
    location: value.location,
    is_online: value.is_online ?? value.isOnline ?? false,
    online_link: value.online_link ?? value.onlineLink,
    cover_url: value.cover_url ?? value.coverUrl,
    starts_at: value.starts_at ?? value.startsAt,
    ends_at: value.ends_at ?? value.endsAt,
    capacity: value.capacity,
    type: value.type,
}))
    .refine((value) => Boolean(value.starts_at), {
    message: 'starts_at is required',
    path: ['starts_at'],
})
    .refine((value) => !value.ends_at || new Date(value.ends_at) > new Date(value.starts_at ?? ''), {
    message: 'ends_at must be after starts_at',
    path: ['ends_at'],
});
exports.UpdateEventSchema = zod_1.z
    .object({
    group_id: zod_1.z.string().uuid().nullable().optional(),
    groupId: zod_1.z.string().uuid().nullable().optional(),
    title: zod_1.z.string().trim().min(1).max(255).optional(),
    description: zod_1.z.string().trim().min(1).optional(),
    location: zod_1.z.string().trim().min(1).max(255).optional(),
    is_online: zod_1.z.boolean().optional(),
    isOnline: zod_1.z.boolean().optional(),
    online_link: zod_1.z.string().url().nullable().optional(),
    onlineLink: zod_1.z.string().url().nullable().optional(),
    cover_url: zod_1.z.string().url().nullable().optional(),
    coverUrl: zod_1.z.string().url().nullable().optional(),
    starts_at: zod_1.z.string().datetime({ offset: true }).optional(),
    startsAt: zod_1.z.string().datetime({ offset: true }).optional(),
    ends_at: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    capacity: zod_1.z.number().int().positive().nullable().optional(),
    type: exports.EventTypeSchema.optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
})
    .refine((value) => {
    if (!value.starts_at || !value.ends_at)
        return true;
    return new Date(value.ends_at) > new Date(value.starts_at);
}, {
    message: 'ends_at must be after starts_at',
    path: ['ends_at'],
})
    .transform((value) => ({
    group_id: value.group_id ?? value.groupId,
    title: value.title,
    description: value.description,
    location: value.location,
    is_online: value.is_online ?? value.isOnline,
    online_link: value.online_link ?? value.onlineLink,
    cover_url: value.cover_url ?? value.coverUrl,
    starts_at: value.starts_at ?? value.startsAt,
    ends_at: value.ends_at ?? value.endsAt,
    capacity: value.capacity,
    type: value.type,
}));
exports.RsvpSchema = zod_1.z.object({
    status: exports.RsvpStatusSchema,
});
