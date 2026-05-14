import { z } from 'zod'

export const PresignUploadQuerySchema = z.object({
  filename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
})

export type PresignUploadQuery = z.infer<typeof PresignUploadQuerySchema>
