import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '../config/env'
import { logger } from '../utils/logger'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig: { temperature: 0.4 } })

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
  type: 'read' | 'video' | 'exercise'
  content: { text: string }
  estimatedMinutes: number
}

export interface AISkillPath {
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedHours: number
  units: AISkillPathUnit[]
}

const RETRY_DELAYS_MS = [0, 2000, 4000]
const CALL_TIMEOUT_MS = 15000

function stripCodeFences(text: string): string {
  return text.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '').trim()
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI call timed out')), ms)),
  ])
}

async function callGemini(prompt: string): Promise<unknown> {
  let lastError: unknown
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      const result = await withTimeout(model.generateContent(prompt), CALL_TIMEOUT_MS)
      const text = stripCodeFences(result.response.text())
      return JSON.parse(text)
    } catch (error) {
      lastError = error
      logger.warn('Gemini call failed, will retry if attempts remain', { error })
    }
  }
  throw lastError
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
}): Promise<AISkillPath> {
  const prompt = `Generate a self-paced learning path for the category "${options.category}". Difficulty: ${
    options.difficulty ?? 'intermediate'
  }. Language: ${options.language ?? 'en'}.
Return ONLY valid JSON. No markdown. No explanation. JSON schema:
{ "title": string, "description": string, "difficulty": "beginner"|"intermediate"|"advanced", "estimatedHours": number,
  "units": [{ "title": string, "type": "read"|"video"|"exercise", "content": { "text": string }, "estimatedMinutes": number }] }`

  const parsed = await callGemini(prompt)
  return parsed as AISkillPath
}
