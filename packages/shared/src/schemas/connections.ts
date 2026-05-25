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

const connectionRequestUserBase = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
  headline: z.string().nullable(),
  role: z.enum(['student', 'alumni', 'faculty', 'admin']),
  department: z.string().nullable(),
})

export const connectionRequestSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  note: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  // Populated for received requests — the person who sent the request
  requester: connectionRequestUserBase.extend({
    mutualConnections: z.number().int().nonnegative(),
  }).optional(),
  // Populated for sent requests — the person we sent the request to
  addressee: connectionRequestUserBase.optional(),
})

export type Connection = z.infer<typeof connectionSchema>
export type ConnectionRequest = z.infer<typeof connectionRequestSchema>
