import { z } from 'zod'

export const GradingScaleTypeSchema = z.enum(['uiu', 'ugc', 'custom'])

export const GradingScaleEntrySchema = z.object({
  minPercent: z.number().min(0).max(100),
  letter: z.string().max(5),
  point: z.number().min(0).max(4),
})

export const CreateAssessmentSchema = z
  .object({
    categoryName: z.string().min(1).max(100),
    fullMarks: z.number().int().min(1),
    weightPercent: z.number().min(0).max(100),
    totalGiven: z.number().int().min(1),
    bestNCounted: z.number().int().min(1),
    displayOrder: z.number().int().min(1),
  })
  .refine((a) => a.bestNCounted <= a.totalGiven, {
    message: 'bestNCounted must be <= totalGiven',
    path: ['bestNCounted'],
  })

export const CreateTopicSchema = z.object({
  weekNumber: z.number().int().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
})

export function isWeightSumValid(assessments: { weightPercent: number }[]): boolean {
  return Math.abs(assessments.reduce((sum, a) => sum + a.weightPercent, 0) - 100) < 0.01
}

export function areWeekNumbersUnique(topics: { weekNumber: number }[]): boolean {
  return new Set(topics.map((t) => t.weekNumber)).size === topics.length
}

export const CreateCourseOutlineSchema = z
  .object({
    courseCode: z.string().max(50).optional(),
    courseTitle: z.string().min(1).max(255),
    creditHours: z.number().optional(),
    trimester: z.string().max(100).optional(),
    description: z.string().optional(),
    gradingScale: GradingScaleTypeSchema,
    customScaleJson: z.array(GradingScaleEntrySchema).optional(),
    assessments: z.array(CreateAssessmentSchema).min(1),
    topics: z.array(CreateTopicSchema).optional().default([]),
  })
  .refine((input) => isWeightSumValid(input.assessments), {
    message: 'Sum of weightPercent across all assessments must equal 100',
    path: ['assessments'],
  })
  .refine((input) => areWeekNumbersUnique(input.topics), {
    message: 'Week numbers in topics must be unique',
    path: ['topics'],
  })

export const UpdateAssessmentsSchema = z
  .object({
    assessments: z.array(CreateAssessmentSchema).min(1),
  })
  .refine((input) => isWeightSumValid(input.assessments), {
    message: 'Sum of weightPercent across all assessments must equal 100',
    path: ['assessments'],
  })

export const UpdateTopicsSchema = z
  .object({
    topics: z.array(CreateTopicSchema),
  })
  .refine((input) => areWeekNumbersUnique(input.topics), {
    message: 'Week numbers in topics must be unique',
    path: ['topics'],
  })

export type CreateCourseOutlineInput = z.infer<typeof CreateCourseOutlineSchema>
export type UpdateAssessmentsInput = z.infer<typeof UpdateAssessmentsSchema>
export type UpdateTopicsInput = z.infer<typeof UpdateTopicsSchema>
export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>
export type CreateTopicInput = z.infer<typeof CreateTopicSchema>
