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

// Independent object, not `.partial()` of a defaulted schema — every field here is
// genuinely optional with no `.default()`, so the jsonb-merge trap documented for
// ai_settings does not apply.
export const UpdateLearningPathSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  category: z.string().min(1).max(100).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  estimatedDays: z.number().int().min(1).max(90).optional(),
})
export type UpdateLearningPathBody = z.infer<typeof UpdateLearningPathSchema>

export const SetPathPublishedSchema = z.object({ isPublished: z.boolean() })
export type SetPathPublishedBody = z.infer<typeof SetPathPublishedSchema>

export const PathIdParamSchema = z.object({ id: z.string().uuid() })

export const CreatePathUnitSchema = PathUnitInputSchema
export type CreatePathUnitBody = z.infer<typeof CreatePathUnitSchema>

export const UpdatePathUnitSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: z.enum(['read', 'video', 'exercise', 'quiz']).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  completionRule: z.object({ passScore: z.number().int().min(0).max(100) }).optional(),
})
export type UpdatePathUnitBody = z.infer<typeof UpdatePathUnitSchema>

export const ReorderPathUnitsSchema = z.object({ unitIds: z.array(z.string().uuid()).min(1) })
export type ReorderPathUnitsBody = z.infer<typeof ReorderPathUnitsSchema>

export const UnitIdParamSchema = z.object({ id: z.string().uuid(), unitId: z.string().uuid() })

export const TriggerGenerateSchema = z.object({
  task: z.enum(['learning', 'quiz', 'both']).optional().default('both'),
})
export type TriggerGenerateBody = z.infer<typeof TriggerGenerateSchema>
