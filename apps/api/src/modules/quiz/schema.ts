import { z } from 'zod'

export const SubmitAnswersSchema = z.object({
  answers: z.array(z.number().int().min(0)).min(1).max(20),
})

export const QuizHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type SubmitAnswersInput = z.infer<typeof SubmitAnswersSchema>
export type QuizHistoryQuery = z.infer<typeof QuizHistoryQuerySchema>
