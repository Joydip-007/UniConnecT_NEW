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

export const UpsertGradebookEntriesSchema = z.object({
  entries: z.array(
    z.object({
      studentId: z.string().uuid(),
      assessmentId: z.string().uuid(),
      instanceNumber: z.number().int().min(1),
      marksObtained: z.number().nullable(),
      notes: z.string().optional(),
    }),
  ),
})

export type CreateCourseOutlineInput = z.infer<typeof CreateCourseOutlineSchema>
export type UpdateAssessmentsInput = z.infer<typeof UpdateAssessmentsSchema>
export type UpdateTopicsInput = z.infer<typeof UpdateTopicsSchema>
export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>
export type CreateTopicInput = z.infer<typeof CreateTopicSchema>
export type UpsertGradebookEntriesInput = z.infer<typeof UpsertGradebookEntriesSchema>

export const CreateModuleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  weekNumber: z.number().int().min(1).optional(),
  displayOrder: z.number().int().min(1),
})

export const UpdateModuleSchema = CreateModuleSchema.partial()

export const ReorderModulesSchema = z.object({
  order: z.array(z.string().uuid()),
})

export type CreateModuleInput = z.infer<typeof CreateModuleSchema>
export type UpdateModuleInput = z.infer<typeof UpdateModuleSchema>
export type ReorderModulesInput = z.infer<typeof ReorderModulesSchema>

export const FileUrlSchema = z.object({
  name: z.string().max(255),
  url: z.string().url(),
  contentType: z.string().max(100),
  size: z.number().int().max(26214400),
})

export const CreateAssignmentSchema = z.object({
  moduleId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  fileUrls: z.array(FileUrlSchema).optional().default([]),
  deadline: z.string().datetime().optional(),
  maxScore: z.number().int().min(1).default(100),
  isPublished: z.boolean().optional().default(false),
})

export const UpdateAssignmentSchema = CreateAssignmentSchema.partial()

export const UploadUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
})

export const SubmitAssignmentSchema = z.object({
  fileUrls: z.array(FileUrlSchema).optional().default([]),
  textContent: z.string().optional(),
})

export const GradeSubmissionSchema = z.object({
  score: z.number().int().min(0),
  feedback: z.string().optional(),
})

export type FileUrlInput = z.infer<typeof FileUrlSchema>
export type CreateAssignmentInput = z.input<typeof CreateAssignmentSchema>
export type UpdateAssignmentInput = z.input<typeof UpdateAssignmentSchema>
export type UploadUrlRequestInput = z.infer<typeof UploadUrlRequestSchema>
export type SubmitAssignmentInput = z.input<typeof SubmitAssignmentSchema>
export type GradeSubmissionInput = z.infer<typeof GradeSubmissionSchema>
