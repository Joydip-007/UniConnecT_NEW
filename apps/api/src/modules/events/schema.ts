import { z } from 'zod'

export const EventTypeSchema = z.enum(['general', 'career_fair', 'seminar', 'alumni_meetup', 'workshop', 'club'])
export const RsvpStatusSchema = z.enum(['going', 'maybe', 'not_going'])

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const EventListQuerySchema = PaginationQuerySchema.extend({
  type: EventTypeSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
})

export const AttendeesQuerySchema = PaginationQuerySchema.extend({
  status: RsvpStatusSchema.optional(),
})

export const CreateEventSchema = z
  .object({
    group_id: z.string().uuid().nullable().optional(),
    groupId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().min(1),
    location: z.string().trim().min(1).max(255),
    is_online: z.boolean().default(false),
    isOnline: z.boolean().optional(),
    online_link: z.string().url().nullable().optional(),
    onlineLink: z.string().url().nullable().optional(),
    cover_url: z.string().url().nullable().optional(),
    coverUrl: z.string().url().nullable().optional(),
    starts_at: z.string().datetime({ offset: true }).optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    ends_at: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    capacity: z.number().int().positive().nullable().optional(),
    type: EventTypeSchema.default('general'),
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
  })

export const UpdateEventSchema = z
  .object({
    group_id: z.string().uuid().nullable().optional(),
    groupId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().min(1).optional(),
    location: z.string().trim().min(1).max(255).optional(),
    is_online: z.boolean().optional(),
    isOnline: z.boolean().optional(),
    online_link: z.string().url().nullable().optional(),
    onlineLink: z.string().url().nullable().optional(),
    cover_url: z.string().url().nullable().optional(),
    coverUrl: z.string().url().nullable().optional(),
    starts_at: z.string().datetime({ offset: true }).optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    ends_at: z.string().datetime({ offset: true }).nullable().optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    capacity: z.number().int().positive().nullable().optional(),
    type: EventTypeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .refine(
    (value) => {
      if (!value.starts_at || !value.ends_at) return true
      return new Date(value.ends_at) > new Date(value.starts_at)
    },
    {
      message: 'ends_at must be after starts_at',
      path: ['ends_at'],
    },
  )
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
  }))

export const RsvpSchema = z.object({
  status: RsvpStatusSchema,
})

export type EventListQuery = z.infer<typeof EventListQuerySchema>
export type AttendeesQuery = z.infer<typeof AttendeesQuerySchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type CreateEventInput = z.infer<typeof CreateEventSchema>
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>
export type RsvpInput = z.infer<typeof RsvpSchema>
