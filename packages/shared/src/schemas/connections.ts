import { z } from 'zod'

export const connectionSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  status: z.enum(['pending', 'accepted']),
  note: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  // Populated in list responses
  user: z.object({
    id: z.string().uuid(),
    fullName: z.string(),
    avatarUrl: z.string().nullable(),
    headline: z.string().nullable(),
    role: z.enum(['student', 'alumni', 'faculty', 'admin']),
    department: z.string().nullable(),
  }).optional(),
})

export const connectionRequestSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  note: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  requester: z.object({
    id: z.string().uuid(),
    fullName: z.string(),
    avatarUrl: z.string().nullable(),
    headline: z.string().nullable(),
    role: z.enum(['student', 'alumni', 'faculty', 'admin']),
    department: z.string().nullable(),
    mutualConnections: z.number().int().nonnegative(),
  }).optional(),
})

export type Connection = z.infer<typeof connectionSchema>
export type ConnectionRequest = z.infer<typeof connectionRequestSchema>
