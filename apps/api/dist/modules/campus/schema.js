"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrollCourseSchema = exports.CourseListQuerySchema = exports.CourseSchema = exports.ShuttleLocationSchema = exports.ShuttleRouteSchema = exports.UpdateLostFoundSchema = exports.CreateLostFoundSchema = exports.LostFoundListQuerySchema = exports.LostFoundTypeSchema = void 0;
const zod_1 = require("zod");
exports.LostFoundTypeSchema = zod_1.z.enum(['lost', 'found']);
exports.LostFoundListQuerySchema = zod_1.z.object({
    type: exports.LostFoundTypeSchema.optional(),
    isResolved: zod_1.z.coerce.boolean().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.CreateLostFoundSchema = zod_1.z
    .object({
    type: exports.LostFoundTypeSchema,
    item_name: zod_1.z.string().trim().min(1).max(255).optional(),
    itemName: zod_1.z.string().trim().min(1).max(255).optional(),
    description: zod_1.z.string().trim().default(''),
    images: zod_1.z.array(zod_1.z.string().url()).default([]),
    imageUrls: zod_1.z.array(zod_1.z.string().url()).optional(),
    location_detail: zod_1.z.string().trim().min(1).max(255).optional(),
    locationDetail: zod_1.z.string().trim().min(1).max(255).optional(),
    contact_info: zod_1.z.string().trim().min(1).max(255).optional(),
    contactInfo: zod_1.z.string().trim().min(1).max(255).optional(),
})
    .transform((value) => ({
    type: value.type,
    item_name: value.item_name ?? value.itemName,
    description: value.description,
    images: value.images.length > 0 ? value.images : (value.imageUrls ?? []),
    location_detail: value.location_detail ?? value.locationDetail,
    contact_info: value.contact_info ?? value.contactInfo,
}))
    .refine((value) => Boolean(value.item_name && value.location_detail && value.contact_info), {
    message: 'item_name, location_detail, and contact_info are required',
});
exports.UpdateLostFoundSchema = zod_1.z
    .object({
    item_name: zod_1.z.string().trim().min(1).max(255).optional(),
    itemName: zod_1.z.string().trim().min(1).max(255).optional(),
    description: zod_1.z.string().trim().min(1).optional(),
    images: zod_1.z.array(zod_1.z.string().url()).optional(),
    imageUrls: zod_1.z.array(zod_1.z.string().url()).optional(),
    location_detail: zod_1.z.string().trim().min(1).max(255).optional(),
    locationDetail: zod_1.z.string().trim().min(1).max(255).optional(),
    contact_info: zod_1.z.string().trim().min(1).max(255).optional(),
    contactInfo: zod_1.z.string().trim().min(1).max(255).optional(),
    is_resolved: zod_1.z.boolean().optional(),
    isResolved: zod_1.z.boolean().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
})
    .transform((value) => ({
    item_name: value.item_name ?? value.itemName,
    description: value.description,
    images: value.images ?? value.imageUrls,
    location_detail: value.location_detail ?? value.locationDetail,
    contact_info: value.contact_info ?? value.contactInfo,
    is_resolved: value.is_resolved ?? value.isResolved,
}));
exports.ShuttleRouteSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(100),
    color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/),
    stops: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())).default([]),
    schedule: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
    is_active: zod_1.z.boolean().default(true),
    isActive: zod_1.z.boolean().optional(),
})
    .transform((value) => ({
    name: value.name,
    color: value.color,
    stops: value.stops,
    schedule: value.schedule,
    is_active: value.is_active ?? value.isActive ?? true,
}));
exports.ShuttleLocationSchema = zod_1.z
    .object({
    route_id: zod_1.z.string().uuid().optional(),
    routeId: zod_1.z.string().uuid().optional(),
    lat: zod_1.z.number().min(-90).max(90),
    lng: zod_1.z.number().min(-180).max(180),
    speed_kmh: zod_1.z.number().min(0).max(999.99).nullable().optional(),
    speedKmh: zod_1.z.number().min(0).max(999.99).nullable().optional(),
    heading_deg: zod_1.z.number().min(0).max(359.99).nullable().optional(),
    headingDeg: zod_1.z.number().min(0).max(359.99).nullable().optional(),
})
    .transform((value) => ({
    route_id: value.route_id ?? value.routeId,
    lat: value.lat,
    lng: value.lng,
    speed_kmh: value.speed_kmh ?? value.speedKmh,
    heading_deg: value.heading_deg ?? value.headingDeg,
}))
    .refine((value) => Boolean(value.route_id), {
    message: 'route_id is required',
});
exports.CourseSchema = zod_1.z
    .object({
    code: zod_1.z.string().trim().min(1).max(50),
    title: zod_1.z.string().trim().min(1).max(255),
    section: zod_1.z.string().trim().max(50).nullable().optional(),
    term: zod_1.z.string().trim().max(100).nullable().optional(),
    lms_url: zod_1.z.string().url().nullable().optional(),
    lmsUrl: zod_1.z.string().url().nullable().optional(),
    is_active: zod_1.z.boolean().default(true),
    isActive: zod_1.z.boolean().optional(),
})
    .transform((value) => ({
    code: value.code,
    title: value.title,
    section: value.section,
    term: value.term,
    lms_url: value.lms_url ?? value.lmsUrl,
    is_active: value.is_active ?? value.isActive ?? true,
}));
exports.CourseListQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().min(1).optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
exports.EnrollCourseSchema = zod_1.z.object({
    status: zod_1.z.string().trim().min(1).max(30).default('enrolled'),
    grade: zod_1.z.string().trim().max(20).nullable().optional(),
});
