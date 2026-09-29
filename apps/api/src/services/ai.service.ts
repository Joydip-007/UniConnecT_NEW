import type { GoogleGenerativeAI as GoogleGenerativeAIClass } from '@google/generative-ai'
import { z } from 'zod'
import { env } from '../config/env'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'

/**
 * Tried in order. A quota/overload error abandons the current model immediately and a
 * retired model (404) is skipped for the rest of the process; any other error is retried
 * per RETRY_DELAYS_MS first, and only then falls through to the next model. Worst case for
 * a persistently failing call is therefore MODEL_FALLBACK_CHAIN.length * RETRY_DELAYS_MS.length
 * attempts.
 *
 * Prefer the `-latest` aliases: pinned versions get retired (gemini-2.0-flash and -lite now
 * 404), and free-tier quota is per model, so each distinct entry is its own quota bucket.
 * Override with the `GEMINI_MODELS` env var.
 */
export const MODEL_FALLBACK_CHAIN: string[] = (() => {
  const configured = (env.GEMINI_MODELS ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  return configured.length > 0
    ? configured
    : ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
})()

// Imported lazily (rather than as a static top-level `import`) so that merely loading this
// module — which happens transitively through several routers at app startup/test setup —
// does not resolve `@google/generative-ai` before a test's `vi.mock('@google/generative-ai', ...)`
// has a chance to register. A static import would bind to whichever copy (real or mocked) was
// already cached under that specifier by the time this module first evaluated.
let genAIInstance: GoogleGenerativeAIClass | null = null
async function getGenAIInstance(): Promise<GoogleGenerativeAIClass> {
  if (!genAIInstance) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    genAIInstance = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  }
  return genAIInstance
}

const modelCache = new Map<string, ReturnType<GoogleGenerativeAIClass['getGenerativeModel']>>()
async function getModel(name: string) {
  let model = modelCache.get(name)
  if (!model) {
    const genAI = await getGenAIInstance()
    model = genAI.getGenerativeModel({
      model: name,
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    })
    modelCache.set(name, model)
  }
  return model
}

/** Models Google answered 404 for (retired/unknown). Skipped until the process restarts. */
const retiredModels = new Set<string>()

/** Thrown when every model in the fallback chain has exhausted its quota. */
export class AIQuotaExceededError extends AppError {
  constructor(message = 'AI quota reached for all configured models. Please try again later.') {
    super(message, 503, 'AI_QUOTA_EXCEEDED')
    this.name = 'AIQuotaExceededError'
  }
}

/** Thrown when every model in the chain failed for a reason other than quota. */
export class AIUnavailableError extends AppError {
  constructor(
    message = 'AI generation is temporarily unavailable. Please try again in a few minutes.',
    public readonly lastError?: unknown,
  ) {
    super(message, 503, 'AI_UNAVAILABLE')
    this.name = 'AIUnavailableError'
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isQuotaError(error: unknown): boolean {
  return /RESOURCE_EXHAUSTED|quota|status:\s*429|\[429/i.test(errorMessage(error))
}

/** Overloaded model ("high demand") — retrying the same model rarely helps; move on. */
function isOverloadedError(error: unknown): boolean {
  return /\[503|status:\s*503|UNAVAILABLE|overloaded|high demand/i.test(errorMessage(error))
}

function isModelGoneError(error: unknown): boolean {
  return /\[404|status:\s*404|no longer available|is not found for API version/i.test(errorMessage(error))
}

export interface AIQuizQuestion {
  q: string
  options: [string, string, string, string]
  answer: number
  explanation?: string
}

export interface AIFlashcard {
  front: string
  back: string
  hint?: string
}

export interface AISkillPathUnit {
  title: string
  type: 'read' | 'video' | 'exercise' | 'quiz'
  content: { body?: string; questions?: AIQuizQuestion[] }
  estimatedMinutes: number
}

export interface AISkillPath {
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedHours: number
  units: AISkillPathUnit[]
}

export const RETRY_DELAYS_MS = [0, 2000, 4000]
const CALL_TIMEOUT_MS = 45000

function stripCodeFences(text: string): string {
  const cleaned = text.trim()
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (match) {
    return match[1].trim()
  }
  return cleaned.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '').trim()
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI call timed out')), ms)),
  ])
}

async function callGemini(prompt: string): Promise<unknown> {
  let lastError: unknown
  let sawQuotaError = false

  for (const modelName of MODEL_FALLBACK_CHAIN) {
    if (retiredModels.has(modelName)) continue
    const model = await getModel(modelName)
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
      try {
        const result = await withTimeout(model.generateContent(prompt), CALL_TIMEOUT_MS)
        const text = stripCodeFences(result.response.text())
        return JSON.parse(text)
      } catch (error) {
        lastError = error
        if (isModelGoneError(error)) {
          retiredModels.add(modelName)
          logger.error('Gemini model unavailable (404), skipping it — update GEMINI_MODELS', { model: modelName })
          break
        }
        if (isQuotaError(error)) {
          sawQuotaError = true
          logger.warn('Gemini quota reached for model, switching to next fallback model', { model: modelName })
          break
        }
        if (isOverloadedError(error)) {
          logger.warn('Gemini model overloaded, switching to next fallback model', { model: modelName })
          break
        }
        logger.warn('Gemini call failed, will retry if attempts remain', { model: modelName, error })
      }
    }
  }

  if (sawQuotaError) {
    throw new AIQuotaExceededError()
  }
  logger.error('Gemini call failed on every model in the fallback chain', {
    models: MODEL_FALLBACK_CHAIN,
    error: errorMessage(lastError),
  })
  throw new AIUnavailableError(undefined, lastError)
}

export async function generateQuizQuestions(options: {
  department: string
  count?: number
  difficulty?: string
  style?: 'mcq' | 'true_false' | 'mixed'
  language?: 'en' | 'bn'
  topic?: string
  customInstructions?: string
}): Promise<AIQuizQuestion[]> {
  const count = options.count ?? 5
  const prompt = `Generate ${count} ${options.style ?? 'mcq'} quiz questions for university department "${options.department}"${
    options.topic ? ` on the topic "${options.topic}"` : ''
  }. Difficulty: ${options.difficulty ?? 'intermediate'}. Language: ${options.language ?? 'en'}.
${options.customInstructions ?? ''}
Return ONLY valid JSON. No markdown. No explanation. JSON schema:
[{ "q": string, "options": [string, string, string, string], "answer": number (0-indexed correct option), "explanation": string (optional) }]`

  const parsed = await callGemini(prompt)
  return parsed as AIQuizQuestion[]
}

export async function generateFlashcards(options: {
  topic: string
  count?: number
  difficulty?: string
  language?: 'en' | 'bn'
  customInstructions?: string
}): Promise<AIFlashcard[]> {
  const count = options.count ?? 10
  const prompt = `Generate ${count} flashcards on the topic "${options.topic}". Difficulty: ${
    options.difficulty ?? 'intermediate'
  }. Language: ${options.language ?? 'en'}.
${options.customInstructions ?? ''}
Return ONLY valid JSON. No markdown. No explanation. JSON schema:
[{ "front": string, "back": string, "hint": string (optional) }]`

  const parsed = await callGemini(prompt)
  return parsed as AIFlashcard[]
}

export async function generateSkillPath(options: {
  category: string
  difficulty?: string
  language?: 'en' | 'bn'
  estimatedDays?: number
  unitCount?: number
  includeCheckpointQuizzes?: boolean
  customInstructions?: string
}): Promise<AISkillPath> {
  // The admin "Draft with AI" flow asks for an exact unit count and optional checkpoint
  // quizzes; the nightly cron passes neither, so the schema below stays backward compatible.
  const quizSchema = options.includeCheckpointQuizzes
    ? ' | { "title": string, "type": "quiz", "content": { "questions": [{ "q": string, "options": [string, string, string, string], "answer": number }] }, "estimatedMinutes": number }'
    : ''
  const prompt = `Generate a self-paced learning path for the category "${options.category}". Difficulty: ${
    options.difficulty ?? 'intermediate'
  }. Language: ${options.language ?? 'en'}.${
    options.estimatedDays ? ` The path should be completable in about ${options.estimatedDays} days.` : ''
  }${options.unitCount ? ` The path must contain exactly ${options.unitCount} units.` : ''}${
    options.includeCheckpointQuizzes
      ? ' After each section of reading/video/exercise units, add one "quiz" unit with 3-5 multiple-choice questions checking that section.'
      : ''
  }
${options.customInstructions ?? ''}
Return ONLY valid JSON. No markdown. No explanation. JSON schema:
{ "title": string, "description": string, "difficulty": "beginner"|"intermediate"|"advanced", "estimatedHours": number,
  "units": [{ "title": string, "type": "read"|"video"|"exercise", "content": { "body": string }, "estimatedMinutes": number }${quizSchema}] }`

  const parsed = await callGemini(prompt)
  return parsed as AISkillPath
}

// Lenient on purpose: models routinely send `null` for absent optionals and numbers as
// strings ("20%"). Normalise those here instead of failing the whole import.
const optionalText = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined)
const looseNumber = z.preprocess(
  (v) => (typeof v === 'string' ? Number.parseFloat(v.replace(/[^\d.-]/g, '')) : v),
  z.number(),
)

const CourseOutlineExtractionSchema = z.object({
  courseCode: z.string(),
  courseTitle: z.string(),
  section: optionalText,
  topics: z.array(
    z.object({
      weekNumber: looseNumber,
      title: z.string(),
      dateRange: optionalText,
    }),
  ),
  assessments: z.array(
    z.object({
      categoryName: z.string(),
      weightPercent: looseNumber,
      fullMarks: looseNumber,
      totalGiven: looseNumber,
    }),
  ),
  assignments: z
    .array(
      z.object({
        title: z.string(),
        dueDate: z.string().nullish().transform((v) => v ?? null),
        topic: z.string().nullish().transform((v) => v ?? null),
        kind: z.enum(['assignment', 'class_test']).catch('assignment'),
      }),
    )
    .default([]),
})

export type CourseOutlineExtraction = z.infer<typeof CourseOutlineExtractionSchema>

/**
 * Sends raw syllabus/course-outline text (extracted from an uploaded PDF/DOCX) to Gemini
 * and validates the strict-JSON reply against `CourseOutlineExtractionSchema`. Used by
 * `POST /groups/course-outline/draft` to turn an uploaded file into a reviewable draft
 * before the faculty member creates the academic group from it.
 */
export async function extractCourseOutline(text: string): Promise<CourseOutlineExtraction> {
  const prompt = `Extract a structured course outline from the following text. Return ONLY valid JSON. No markdown. No explanation. JSON schema:
{ "courseCode": string, "courseTitle": string, "section": string (optional), "topics": [{ "weekNumber": number, "title": string, "dateRange": string (optional) }], "assessments": [{ "categoryName": string, "weightPercent": number, "fullMarks": number, "totalGiven": number }], "assignments": [{ "title": string, "dueDate": string|null (ISO date, e.g. "2026-06-20"), "topic": string|null, "kind": "assignment"|"class_test" }] }

Text:
${text}`

  const parsed = await callGemini(prompt)
  const result = CourseOutlineExtractionSchema.safeParse(parsed)
  if (!result.success) {
    // Not a request-validation failure — the model's reply didn't fit. A raw ZodError would
    // surface as a misleading 422 "Request validation failed".
    logger.warn('Course outline extraction returned an unexpected shape', { issues: result.error.issues })
    throw new AppError('Could not read a course outline from that file. Try a different file.', 422, 'OUTLINE_UNREADABLE')
  }
  return result.data
}
