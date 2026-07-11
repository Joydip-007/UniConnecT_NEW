import { z } from 'zod'

export const LearningTopicSchema = z.object({
  category: z.string().min(1).max(100),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
})

export const LearningAdminConfigSchema = z.object({
  enabled: z.boolean().optional(),
  topics: z.array(LearningTopicSchema).max(50).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  language: z.enum(['en', 'bn']).optional(),
  estimatedDays: z.number().int().min(1).max(90).optional(),
  customInstructions: z.string().max(2000).nullable().optional(),
  genHour: z.number().int().min(0).max(23).optional(),
  countPerRun: z.number().int().min(1).max(5).optional(),
  quizRequireApproval: z.boolean().optional(),
  quizDifficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  quizLanguage: z.enum(['en', 'bn']).optional(),
  quizCount: z.number().int().min(1).max(20).optional(),
  quizCustomInstructions: z.string().max(2000).nullable().optional(),
})

export type LearningAdminConfigInput = z.infer<typeof LearningAdminConfigSchema>
