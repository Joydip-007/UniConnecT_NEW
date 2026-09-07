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
  quizEnabled: z.boolean().optional(),
  quizRequireApproval: z.boolean().optional(),
  quizDifficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  quizLanguage: z.enum(['en', 'bn']).optional(),
  quizCount: z.number().int().min(1).max(20).optional(),
  quizCustomInstructions: z.string().max(2000).nullable().optional(),
})

export type LearningAdminConfigInput = z.infer<typeof LearningAdminConfigSchema>

export const AdminListPathsQuerySchema = z.object({
  status: z.enum(['all', 'published', 'draft']).optional().default('all'),
  category: z.string().min(1).max(100).optional(),
})
export type AdminListPathsQuery = z.infer<typeof AdminListPathsQuerySchema>

export const PathUnitInputSchema = z.object({
  title: z.string().min(1).max(255),
  type: z.enum(['read', 'video', 'exercise', 'quiz']),
  content: z.record(z.string(), z.unknown()),
  completionRule: z.object({ passScore: z.number().int().min(0).max(100) }).optional(),
})

export const CreateLearningPathSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  category: z.string().min(1).max(100),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedDays: z.number().int().min(1).max(90),
  units: z.array(PathUnitInputSchema).min(1).max(30),
})
export type CreateLearningPathBody = z.infer<typeof CreateLearningPathSchema>
