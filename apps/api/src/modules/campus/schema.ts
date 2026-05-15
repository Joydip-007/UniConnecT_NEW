import { z } from 'zod'

export const LostFoundTypeSchema = z.enum(['lost', 'found'])

export const LostFoundListQuerySchema = z.object({
  type: LostFoundTypeSchema.optional(),
  isResolved: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const CreateLostFoundSchema = z
  .object({
    type: LostFoundTypeSchema,
    item_name: z.string().trim().min(1).max(255).optional(),
    itemName: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().default(''),
    images: z.array(z.string().url()).default([]),
    imageUrls: z.array(z.string().url()).optional(),
    location_detail: z.string().trim().min(1).max(255).optional(),
    locationDetail: z.string().trim().min(1).max(255).optional(),
    contact_info: z.string().trim().min(1).max(255).optional(),
    contactInfo: z.string().trim().min(1).max(255).optional(),
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
  })

export const UpdateLostFoundSchema = z
  .object({
    item_name: z.string().trim().min(1).max(255).optional(),
    itemName: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().min(1).optional(),
    images: z.array(z.string().url()).optional(),
    imageUrls: z.array(z.string().url()).optional(),
    location_detail: z.string().trim().min(1).max(255).optional(),
    locationDetail: z.string().trim().min(1).max(255).optional(),
    contact_info: z.string().trim().min(1).max(255).optional(),
    contactInfo: z.string().trim().min(1).max(255).optional(),
    is_resolved: z.boolean().optional(),
    isResolved: z.boolean().optional(),
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
  }))

export const ShuttleRouteSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    stops: z.array(z.record(z.string(), z.unknown())).default([]),
    schedule: z.record(z.string(), z.unknown()).default({}),
    is_active: z.boolean().default(true),
    isActive: z.boolean().optional(),
  })
  .transform((value) => ({
    name: value.name,
    color: value.color,
    stops: value.stops,
    schedule: value.schedule,
    is_active: value.is_active ?? value.isActive ?? true,
  }))

export const ShuttleLocationSchema = z
  .object({
    route_id: z.string().uuid().optional(),
    routeId: z.string().uuid().optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speed_kmh: z.number().min(0).max(999.99).nullable().optional(),
    speedKmh: z.number().min(0).max(999.99).nullable().optional(),
    heading_deg: z.number().min(0).max(359.99).nullable().optional(),
    headingDeg: z.number().min(0).max(359.99).nullable().optional(),
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
  })

export const CourseSchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    title: z.string().trim().min(1).max(255),
    section: z.string().trim().max(50).nullable().optional(),
    term: z.string().trim().max(100).nullable().optional(),
    lms_url: z.string().url().nullable().optional(),
    lmsUrl: z.string().url().nullable().optional(),
    is_active: z.boolean().default(true),
    isActive: z.boolean().optional(),
  })
  .transform((value) => ({
    code: value.code,
    title: value.title,
    section: value.section,
    term: value.term,
    lms_url: value.lms_url ?? value.lmsUrl,
    is_active: value.is_active ?? value.isActive ?? true,
  }))

export const CourseListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const EnrollCourseSchema = z.object({
  status: z.string().trim().min(1).max(30).default('enrolled'),
  grade: z.string().trim().max(20).nullable().optional(),
})

export type LostFoundListQuery = z.infer<typeof LostFoundListQuerySchema>
export type CreateLostFoundInput = z.infer<typeof CreateLostFoundSchema>
export type UpdateLostFoundInput = z.infer<typeof UpdateLostFoundSchema>
export type ShuttleRouteInput = z.infer<typeof ShuttleRouteSchema>
export type ShuttleLocationInput = z.infer<typeof ShuttleLocationSchema>
export type CourseInput = z.infer<typeof CourseSchema>
export type CourseListQuery = z.infer<typeof CourseListQuerySchema>
export type EnrollCourseInput = z.infer<typeof EnrollCourseSchema>
