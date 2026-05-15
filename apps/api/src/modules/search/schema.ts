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

export type SearchAllQuery = z.infer<typeof SearchAllQuerySchema>
export type SearchPagedQuery = z.infer<typeof SearchPagedQuerySchema>
