import { z } from 'zod'

export const SearchAllQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(100),
  limit: z.coerce.number().int().min(1).max(10).default(3),
})

export const SearchPagedQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// Extended: people search supports optional role/department/batch filters.
// q becomes optional when at least one filter is supplied.
export const SearchPeopleQuerySchema = z
  .object({
    q: z.string().min(2).max(100).optional(),
    role: z.enum(['student', 'alumni', 'faculty', 'staff']).optional(),
    department: z.string().max(100).optional(),
    batch: z.string().max(20).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((d) => (d.q && d.q.length >= 2) || d.role || d.department || d.batch, {
    message: 'Provide at least a search query (min 2 chars) or one filter (role, department, or batch)',
  })

// Extended: posts search supports optional tag filter; q becomes optional when tag is supplied.
export const SearchPostsQuerySchema = z
  .object({
    q: z.string().min(2).max(100).optional(),
    tag: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((d) => (d.q && d.q.length >= 2) || d.tag, {
    message: 'Provide at least a search query (min 2 chars) or a tag',
  })

export type SearchAllQuery = z.infer<typeof SearchAllQuerySchema>
export type SearchPagedQuery = z.infer<typeof SearchPagedQuerySchema>
export type SearchPeopleQuery = z.infer<typeof SearchPeopleQuerySchema>
export type SearchPostsQuery = z.infer<typeof SearchPostsQuerySchema>
