# UniConnecT Academic LMS + AI Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 features to UniConnecT — a free-tier Gemini AI automation layer, a new `academic` group type, course outlines, a gradebook, modules/assignments, an AI settings panel, restricted flashcards, a daily AI scheduler, and file attachments on shared notes and session notes.

**Architecture:** New `modules/academic/` backend module (course-outline, gradebook, modules, assignments services) sits alongside the existing `modules/groups/` module, which gains an `academic` group type, `ai_settings` JSONB column, and new routes. A new `services/ai.service.ts` wraps the Gemini SDK; a new `ai-content` Bull queue + worker generates and posts content on cron. Frontend gets a new `academic/` folder under `features/groups/` plus modifications to existing group components.

**Tech Stack:** Express + Knex + Zod (API), React 18 + TanStack Query + Zustand (web), Bull/Redis (queues), `@google/generative-ai` (new dependency), existing S3/R2 presigned-upload flow.

## Global Constraints

- 100% free infrastructure only: Gemini 1.5 Flash free tier (15 req/min, 1M tokens/day), existing R2 storage, existing Bull/Redis queues — no new paid services.
- Project is pre-launch: hard-deleting flashcard data from non-academic groups (Assumption A1) is acceptable and irreversible — do not add a rollback/undo path.
- 25MB file limit on every upload type introduced here (shared notes, session notes, assignment attachments, assignment submissions), enforced via `Content-Length-Range` at presign time — the existing `upload.service.ts`/`PresignUploadQuerySchema` does not currently enforce a size cap, so every new upload-url endpoint in this plan must add its own cap since none exists to inherit.
- Course outline must exist before gradebook columns can be created (Assumption A4) — gradebook endpoints 404 if no `academic_course_outlines` row exists for the group.
- Migration numbering starts at `091` (next free sequential number confirmed against the actual repo state — the spec's own numbering of `090`–`095` collides with real migrations already present up to `090_seed_quiz_badges.ts`, so every migration number in this plan is shifted up by one from the spec).
- All new DB tables get `university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE`, indexed, plus `created_at`/`updated_at timestamptz default now()` where the spec includes them — per repo-wide convention in `CLAUDE.md`.
- Route files contain only `router.METHOD(...)` declarations; all logic lives in `service.ts`; all async controllers wrapped in `asyncHandler`; responses use `sendSuccess`/`sendPaginated`; errors thrown as `notFound()`/`badRequest()`/`forbidden()`/`conflict()` from `src/utils/errors.ts`.
- Never emit Socket.io from route handlers — only from services, after the DB write, via `getIo()`.
- `npx pnpm typecheck && npx pnpm lint` must pass before any task is considered done.

---

## File Structure

```
apps/api/src/
├── config/
│   └── env.ts                                   MODIFY — add GEMINI_API_KEY, AI_CONTENT_ENABLED, AI_QUIZ_GEN_HOUR, AI_GROUP_POST_HOUR
├── services/
│   └── ai.service.ts                            NEW — Gemini wrapper (generateQuizQuestions, generateFlashcards, generateSkillPath)
├── queues/
│   └── ai-content.queue.ts                      NEW — Bull queue, 5-line template pattern
├── workers/
│   ├── quiz.worker.ts                           MODIFY — check ai_quiz_pool before skill_path_units fallback
│   ├── ai-content.worker.ts                     NEW — daily cron: quiz-gen (1 AM UTC) + group-posting (8 AM UTC)
│   └── index.ts                                 MODIFY — register new worker
├── middleware/
│   └── requireAcademicGroup.ts                  NEW — 403 guard for flashcard routes
├── modules/
│   ├── groups/
│   │   ├── schema.ts                            MODIFY — GroupTypeSchema += 'academic', AISettingsSchema, AttachmentSchema
│   │   ├── controller.ts                        MODIFY — ai-settings, shared-notes-upload-url, session-notes handlers
│   │   ├── service.ts                           MODIFY — createGroup faculty guard, toGroup() aiSettings field, gradebook auto-populate hook, shared-note attachments, session notes CRUD
│   │   └── router.ts                            MODIFY — new routes appended after line 140
│   ├── academic/                                NEW MODULE
│   │   ├── schema.ts                            course outline / gradebook / modules / assignments Zod schemas
│   │   ├── course-outline.service.ts
│   │   ├── gradebook.service.ts
│   │   ├── modules.service.ts
│   │   ├── assignments.service.ts
│   │   ├── controller.ts
│   │   ├── router.ts
│   │   └── index.ts                             barrel
│   └── learning/
│       └── service.ts                           MODIFY — add generateAndSaveAIPath()
│   └── learning/
│       └── router.ts                            MODIFY — POST /paths/ai-generate
└── database/
    └── migrations/
        ├── 091_create_ai_quiz_pool.ts            NEW
        ├── 092_add_academic_group_type.ts        NEW (includes flashcard hard-delete)
        ├── 093_create_course_outline.ts          NEW
        ├── 094_create_academic_lms_tables.ts     NEW (gradebook + modules + assignments + submissions)
        ├── 095_add_note_attachments.ts           NEW
        └── 096_create_session_notes.ts           NEW

packages/shared/src/constants/
└── socket.ts                                     MODIFY — add GROUP_EVENTS

apps/web/src/features/groups/
├── components/
│   ├── CreateGroupModal.tsx                      MODIFY — 'Academic' type option, faculty-only
│   ├── StudyToolsTab.tsx                         MODIFY — academic gating for decks tab, +2 tabs
│   ├── StudyDecksPanel.tsx                       MODIFY — academic-only guard (defensive, middleware already blocks)
│   ├── StudyNotesPanel.tsx                       MODIFY — file attachments
│   ├── StudySessionsTab.tsx                      MODIFY — "Notes" link per session
│   └── SessionNotesPanel.tsx                     NEW
├── academic/                                     NEW
│   ├── AcademicLMSTab.tsx
│   ├── CourseOutlineForm.tsx
│   ├── GradebookPanel.tsx
│   ├── ModulesPanel.tsx
│   ├── AssignmentsPanel.tsx
│   ├── AISettingsPanel.tsx
│   └── StudentGradeCard.tsx
├── hooks/
│   └── useGroupExtended.ts                       MODIFY — add hooks for every new resource (same create/update/delete/invalidate pattern as useCreateSharedNote)
└── types.ts                                       MODIFY — add TS types mirroring new API shapes
```

---

## Interfaces Contract (cross-task reference)

Later tasks depend on these exact names/signatures established in earlier tasks. Deviating from this table breaks a downstream task.

| Symbol | Defined in (Task) | Signature |
|---|---|---|
| `generateQuizQuestions(options)` | Task 2 | `(options: { department: string; count?: number; difficulty?: string; style?: 'mcq'\|'true_false'\|'mixed'; language?: 'en'\|'bn'; topic?: string; customInstructions?: string }) => Promise<AIQuizQuestion[]>` |
| `generateFlashcards(options)` | Task 2 | `(options: { topic: string; count?: number; difficulty?: string; language?: 'en'\|'bn'; customInstructions?: string }) => Promise<AIFlashcard[]>` |
| `generateSkillPath(options)` | Task 2 | `(options: { category: string; difficulty?: string; language?: 'en'\|'bn' }) => Promise<AISkillPath>` |
| `aiContentQueue` | Task 4 | `Bull.Queue<AIContentJob>` from `queues/ai-content.queue.ts` |
| `requireAcademicGroup` | Task 9 | Express middleware `(req, res, next) => void`, 404 if group missing, 403 with code `ACADEMIC_GROUP_REQUIRED` if `group.type !== 'academic'` |
| `groupService.createGroup` | Task 8 (modified) | unchanged signature, now throws `forbidden(..., 'ACADEMIC_GROUP_FACULTY_ONLY')` when `input.type === 'academic' && context.role !== 'faculty'` |
| `toGroup(row)` | Task 8 (modified) | adds `aiSettings: row.ai_settings ?? {}` to returned object |
| `courseOutlineService.getOutline(groupId, universityId)` | Task 12 | `Promise<CourseOutline \| null>` — used by Task 14's `resolveAITopic` and Task 22 to 404-gate |
| `resolveAITopic(groupId, universityId)` | Task 14 | `Promise<string>` — course-outline week topic → `ai_settings.subject` → group name fallback chain |
| `calculateBestN(marks, bestN)` | Task 17 | `(marks: (number\|null)[], bestN: number) => number \| null` |
| `getLetterGrade(percentage, scale)` | Task 17 | `(percentage: number, scale: GradingScaleEntry[]) => { letter: string; point: number } \| null` |
| `gradebookService.autoPopulateGradebook(groupId, universityId, studentId)` | Task 18 | `Promise<void>` — called from `groups/service.ts` join hooks (Task 19) |
| `getPresignedUploadUrl(key, contentType)` | existing, `upload.service.ts:51` | unchanged — reused verbatim by every new upload-url endpoint |
| `AttachmentSchema` | Task 27 | `z.object({ name: z.string().max(255), url: z.string().url(), contentType: z.string().max(100), size: z.number().int().max(26214400) })` — lives in `groups/schema.ts`, imported by `academic/schema.ts` for assignment file_urls |

---

# Phase 1 — Foundation (AI service + quiz pool, no breaking changes)

### Task 1: Environment variables + Gemini dependency

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/package.json` (via pnpm add)

**Interfaces:**
- Produces: `env.GEMINI_API_KEY: string`, `env.AI_CONTENT_ENABLED: boolean`, `env.AI_QUIZ_GEN_HOUR: number`, `env.AI_GROUP_POST_HOUR: number` — consumed by Task 2 and Task 6.

- [ ] **Step 1: Install the Gemini SDK**

```bash
cd apps/api && npx pnpm add @google/generative-ai
```

- [ ] **Step 2: Read the current env.ts to preserve its exact style**

Read `apps/api/src/config/env.ts` in full (52 lines) before editing — it uses a Zod `envSchema` object parsed once, then an `export const env = { ...parsed, ...derived }` block for computed values (per the research: env.ts:44-50 holds derived values like `CLIENT_URL` fallback logic).

- [ ] **Step 3: Add the new keys to `envSchema`**

Add these fields to the existing `envSchema` Zod object, matching the existing style (`z.string()` for secrets, `z.coerce.boolean()`/`z.coerce.number()` for flags — mirror whatever coercion pattern the file already uses for existing boolean/number env vars):

```ts
GEMINI_API_KEY: z.string().min(1),
AI_CONTENT_ENABLED: z.coerce.boolean().default(true),
AI_QUIZ_GEN_HOUR: z.coerce.number().int().min(0).max(23).default(1),
AI_GROUP_POST_HOUR: z.coerce.number().int().min(0).max(23).default(8),
```

- [ ] **Step 4: Add the same keys to `.env.example`**

```bash
# AI
GEMINI_API_KEY=
AI_CONTENT_ENABLED=true
AI_QUIZ_GEN_HOUR=1
AI_GROUP_POST_HOUR=8
```

- [ ] **Step 5: Set a dev value locally and verify the server boots**

Add `GEMINI_API_KEY=dev-placeholder` to your local `apps/api/.env` (get a real free key from aistudio.google.com when ready to actually call the API), then run:

```bash
npx pnpm --filter api dev
```

Expected: server starts without a Zod validation crash on boot (a startup env-parse failure prints immediately if a required key is missing).

- [ ] **Step 6: Typecheck**

```bash
npx pnpm --filter api typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/.env.example apps/api/package.json apps/api/pnpm-lock.yaml
git commit -m "chore(api): add Gemini env vars and SDK dependency"
```

---

### Task 2: `services/ai.service.ts` — Gemini wrapper

**Files:**
- Create: `apps/api/src/services/ai.service.ts`
- Test: `apps/api/src/services/ai.service.test.ts`

**Interfaces:**
- Consumes: `env.GEMINI_API_KEY` (Task 1).
- Produces: `generateQuizQuestions`, `generateFlashcards`, `generateSkillPath`, and types `AIQuizQuestion`, `AIFlashcard`, `AISkillPath` (see Interfaces Contract table) — consumed by Task 6 (`ai-content.worker.ts`) and Task 13 (`learning/service.ts`).

- [ ] **Step 1: Write the failing test for JSON parsing + retry**

```ts
// apps/api/src/services/ai.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn()
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
  })),
}))

import { generateQuizQuestions } from './ai.service'

describe('ai.service', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
  })

  it('parses a valid JSON response into AIQuizQuestion[]', async () => {
    const payload = [
      { q: 'What is 2+2?', options: ['3', '4', '5', '6'], answer: 1, explanation: 'basic arithmetic' },
    ]
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(payload) },
    })

    const result = await generateQuizQuestions({ department: 'Computer Science', count: 1 })

    expect(result).toEqual(payload)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('retries once on failure then succeeds', async () => {
    const payload = [{ q: 'Q', options: ['a', 'b', 'c', 'd'], answer: 0 }]
    mockGenerateContent
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(payload) } })

    const result = await generateQuizQuestions({ department: 'Math', count: 1 })

    expect(result).toEqual(payload)
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries', async () => {
    mockGenerateContent.mockRejectedValue(new Error('persistent failure'))

    await expect(generateQuizQuestions({ department: 'Math', count: 1 })).rejects.toThrow('persistent failure')
    expect(mockGenerateContent).toHaveBeenCalledTimes(3)
  })

  it('strips markdown code fences before parsing', async () => {
    const payload = [{ q: 'Q', options: ['a', 'b', 'c', 'd'], answer: 2 }]
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => '```json\n' + JSON.stringify(payload) + '\n```' },
    })

    const result = await generateQuizQuestions({ department: 'Physics', count: 1 })

    expect(result).toEqual(payload)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/services/ai.service.test.ts`
Expected: FAIL with "Cannot find module './ai.service'" or similar.

- [ ] **Step 3: Write the implementation**

```ts
// apps/api/src/services/ai.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '../config/env'
import { logger } from '../utils/logger'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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
```

Note: `model.generateContent` is not called with a `temperature: 0.4` config object in this snippet because the SDK's per-call generation config is passed via `getGenerativeModel({ model, generationConfig: { temperature: 0.4 } })` — apply that at the `getGenerativeModel` call above, not per-request.

- [ ] **Step 4: Apply the temperature config**

Edit the `getGenerativeModel` call:

```ts
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig: { temperature: 0.4 } })
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/services/ai.service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/ai.service.ts apps/api/src/services/ai.service.test.ts
git commit -m "feat(api): add Gemini AI service with retry, timeout, and JSON parsing"
```

---

### Task 3: Migration `091_create_ai_quiz_pool.ts`

**Files:**
- Create: `apps/api/src/database/migrations/091_create_ai_quiz_pool.ts`

**Interfaces:**
- Produces: table `ai_quiz_pool(id, university_id, department, questions, generated_at, consumed_at, created_at)` — consumed by Task 5 (`quiz.worker.ts`) and Task 6 (`ai-content.worker.ts`).

- [ ] **Step 1: Read the template migration for exact Knex conventions**

Read `apps/api/src/database/migrations/089_create_daily_quiz.ts` in full to copy its exact style (uuid primary key via `knex.raw('uuid_generate_v4()')`, FK `.references('id').inTable(...).onDelete('CASCADE').index()`, jsonb defaults, symmetric `down()`).

- [ ] **Step 2: Write the migration**

```ts
// apps/api/src/database/migrations/091_create_ai_quiz_pool.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ai_quiz_pool', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.string('department', 255).notNullable()
    table.jsonb('questions').notNullable()
    table.timestamp('generated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('consumed_at', { useTz: true })
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('ai_quiz_pool', (table) => {
    table.index(['university_id', 'department', 'consumed_at'], 'ai_quiz_pool_available_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ai_quiz_pool')
}
```

- [ ] **Step 3: Run the migration against the test/dev database**

```bash
npx pnpm --filter api db:migrate
```

Expected: `Batch N run: 1 migrations` including `091_create_ai_quiz_pool.ts`.

- [ ] **Step 4: Verify rollback works**

```bash
npx pnpm --filter api db:rollback
npx pnpm --filter api db:migrate
```

Expected: table drops cleanly then recreates without error.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/migrations/091_create_ai_quiz_pool.ts
git commit -m "feat(api): add ai_quiz_pool table for AI-generated quiz staging"
```

---

### Task 4: `queues/ai-content.queue.ts`

**Files:**
- Create: `apps/api/src/queues/ai-content.queue.ts`

**Interfaces:**
- Produces: `aiContentQueue: Bull.Queue<AIContentJob>` — consumed by Task 6.

- [ ] **Step 1: Read the template queue file**

Read `apps/api/src/queues/learning.queue.ts` in full (5 lines) — the exact pattern to copy.

- [ ] **Step 2: Write the queue file**

```ts
// apps/api/src/queues/ai-content.queue.ts
import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

export type AIContentJob = { task: 'quiz-gen' } | { task: 'group-post' }
export const aiContentQueue = new Queue<AIContentJob>('ai-content', bullQueueOptions)
```

- [ ] **Step 3: Typecheck**

```bash
npx pnpm --filter api typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/queues/ai-content.queue.ts
git commit -m "feat(api): add ai-content Bull queue"
```

---

### Task 5: Modify `workers/quiz.worker.ts` to consume `ai_quiz_pool`

**Files:**
- Modify: `apps/api/src/workers/quiz.worker.ts`
- Test: `apps/api/src/workers/quiz.worker.test.ts`

**Interfaces:**
- Consumes: table `ai_quiz_pool` (Task 3).
- Produces: unchanged `generateDailyQuizSlots(now: Date)` signature — inserts into `daily_quiz_slots` same as before, but sourced from `ai_quiz_pool` first when available.

- [ ] **Step 1: Read the current implementation in full**

Read `apps/api/src/workers/quiz.worker.ts` (82 lines) to get the exact loop structure around line 54-57 where `FALLBACK_QUESTIONS` triggers today.

- [ ] **Step 2: Write the failing test**

```ts
// apps/api/src/workers/quiz.worker.test.ts (add to existing test file if one exists, else create)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../database/db'
import { generateDailyQuizSlots } from './quiz.worker'
// assumes existing test factories per CLAUDE.md conventions
import { createUniversity } from '../../tests/factories/university'

describe('generateDailyQuizSlots — ai_quiz_pool priority', () => {
  let universityId: string

  beforeEach(async () => {
    universityId = await createUniversity()
    await db('profiles').insert({ university_id: universityId, department: 'Computer Science', /* other required cols per factory */ })
  })

  afterEach(async () => {
    await db('ai_quiz_pool').where({ university_id: universityId }).del()
    await db('daily_quiz_slots').where({ university_id: universityId }).del()
    await db('profiles').where({ university_id: universityId }).del()
    await db('universities').where({ id: universityId }).del()
  })

  it('consumes an available ai_quiz_pool row before falling back to skill_path_units', async () => {
    const [pooled] = await db('ai_quiz_pool')
      .insert({
        university_id: universityId,
        department: 'Computer Science',
        questions: JSON.stringify([{ q: 'AI Q', options: ['a', 'b', 'c', 'd'], answer: 0 }]),
      })
      .returning('id')

    await generateDailyQuizSlots(new Date())

    const slot = await db('daily_quiz_slots').where({ university_id: universityId, department: 'Computer Science' }).first()
    expect(slot).toBeTruthy()
    expect(JSON.parse(slot.questions)[0].q).toBe('AI Q')

    const consumed = await db('ai_quiz_pool').where({ id: pooled.id }).first()
    expect(consumed.consumed_at).not.toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx pnpm --filter api test src/workers/quiz.worker.test.ts -t "ai_quiz_pool priority"`
Expected: FAIL — slot uses fallback/skill_path_units questions, not the pooled `'AI Q'` question, because the current code never queries `ai_quiz_pool`.

- [ ] **Step 4: Modify the worker**

In `apps/api/src/workers/quiz.worker.ts`, immediately before the existing `skill_path_units` pool-building logic (the block preceding line ~54 that falls back to `FALLBACK_QUESTIONS`), insert a check against `ai_quiz_pool`:

```ts
// Insert before the existing skill_path_units pool query, inside the per-department loop:
const pooled = await db('ai_quiz_pool')
  .where({ university_id: uni.id, department, consumed_at: null })
  .orderBy('generated_at', 'asc')
  .first()

if (pooled) {
  await db('ai_quiz_pool').where({ id: pooled.id }).update({ consumed_at: db.fn.now() })
  const questions = typeof pooled.questions === 'string' ? JSON.parse(pooled.questions) : pooled.questions
  await db('daily_quiz_slots').insert({
    university_id: uni.id,
    department,
    date: localDate,
    questions: JSON.stringify(questions),
  })
  continue // skip to next department — do not fall through to skill_path_units/FALLBACK_QUESTIONS
}
// existing skill_path_units query + FALLBACK_QUESTIONS logic follows unchanged
```

Adjust variable names (`uni.id`, `department`, `localDate`) to match whatever the existing loop actually calls them — confirm exact names against the file read in Step 1 before finalizing this edit, since the research summary approximated them.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/workers/quiz.worker.test.ts`
Expected: PASS, including all pre-existing tests in that file (regression check).

- [ ] **Step 6: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/workers/quiz.worker.ts apps/api/src/workers/quiz.worker.test.ts
git commit -m "feat(api): prefer ai_quiz_pool over skill_path_units in daily quiz generation"
```

---

### Task 6: `workers/ai-content.worker.ts` — quiz generation only (group posting deferred to Phase 6)

**Files:**
- Create: `apps/api/src/workers/ai-content.worker.ts`
- Modify: `apps/api/src/workers/index.ts`
- Test: `apps/api/src/workers/ai-content.worker.test.ts`

**Interfaces:**
- Consumes: `aiContentQueue` (Task 4), `generateQuizQuestions` (Task 2), `env.AI_QUIZ_GEN_HOUR` (Task 1).
- Produces: `runQuizGeneration(): Promise<void>` — exported for testing and for Task 25 to extend with `runGroupPosting`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/workers/ai-content.worker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/ai.service', () => ({
  generateQuizQuestions: vi.fn(),
}))

import { generateQuizQuestions } from '../services/ai.service'
import { runQuizGeneration } from './ai-content.worker'
import { db } from '../database/db'
import { createUniversity } from '../../tests/factories/university'

describe('runQuizGeneration', () => {
  it('inserts generated questions into ai_quiz_pool per department', async () => {
    const universityId = await createUniversity()
    await db('profiles').insert({ university_id: universityId, department: 'Physics' })
    ;(generateQuizQuestions as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { q: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 0 },
    ])

    await runQuizGeneration()

    const row = await db('ai_quiz_pool').where({ university_id: universityId, department: 'Physics' }).first()
    expect(row).toBeTruthy()

    await db('ai_quiz_pool').where({ university_id: universityId }).del()
    await db('profiles').where({ university_id: universityId }).del()
    await db('universities').where({ id: universityId }).del()
  })

  it('continues to the next department when one generation call fails', async () => {
    const universityId = await createUniversity()
    await db('profiles').insert([
      { university_id: universityId, department: 'Failing Dept' },
      { university_id: universityId, department: 'OK Dept' },
    ])
    ;(generateQuizQuestions as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('quota exceeded'))
      .mockResolvedValueOnce([{ q: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 1 }])

    await expect(runQuizGeneration()).resolves.not.toThrow()

    const okRow = await db('ai_quiz_pool').where({ university_id: universityId, department: 'OK Dept' }).first()
    expect(okRow).toBeTruthy()

    await db('ai_quiz_pool').where({ university_id: universityId }).del()
    await db('profiles').where({ university_id: universityId }).del()
    await db('universities').where({ id: universityId }).del()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/workers/ai-content.worker.test.ts`
Expected: FAIL with "Cannot find module './ai-content.worker'".

- [ ] **Step 3: Write the implementation**

```ts
// apps/api/src/workers/ai-content.worker.ts
import { aiContentQueue } from '../queues/ai-content.queue'
import { db } from '../database/db'
import { generateQuizQuestions } from '../services/ai.service'
import { env } from '../config/env'
import { logger } from '../utils/logger'

let aiCallsThisMinute = 0
let minuteStart = Date.now()

async function rateLimitedAICall<T>(fn: () => Promise<T>): Promise<T> {
  if (Date.now() - minuteStart > 60000) {
    aiCallsThisMinute = 0
    minuteStart = Date.now()
  }
  if (aiCallsThisMinute >= 12) {
    await new Promise((resolve) => setTimeout(resolve, 60000 - (Date.now() - minuteStart) + 1000))
    aiCallsThisMinute = 0
    minuteStart = Date.now()
  }
  aiCallsThisMinute++
  return fn()
}

export async function runQuizGeneration(): Promise<void> {
  const universities = await db('universities').select('id')

  for (const uni of universities) {
    const departments = await db('profiles')
      .where({ university_id: uni.id })
      .whereNotNull('department')
      .distinct('department')
      .pluck('department')

    for (const department of departments) {
      try {
        const questions = await rateLimitedAICall(() =>
          generateQuizQuestions({ department, count: 5 })
        )
        await db('ai_quiz_pool').insert({
          university_id: uni.id,
          department,
          questions: JSON.stringify(questions),
        })
      } catch (error) {
        logger.error('AI quiz generation failed for department', { universityId: uni.id, department, error })
      }
    }
  }
}

if (env.AI_CONTENT_ENABLED) {
  aiContentQueue.add({ task: 'quiz-gen' }, { repeat: { cron: `0 ${env.AI_QUIZ_GEN_HOUR} * * *` }, jobId: 'ai-daily-quiz-gen' })
}

aiContentQueue.process(async (job) => {
  if (job.data.task === 'quiz-gen') {
    await runQuizGeneration()
  }
})
```

- [ ] **Step 4: Register the worker**

In `apps/api/src/workers/index.ts`, add:

```ts
import './ai-content.worker'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/workers/ai-content.worker.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/workers/ai-content.worker.ts apps/api/src/workers/index.ts apps/api/src/workers/ai-content.worker.test.ts
git commit -m "feat(api): add ai-content worker with daily quiz generation cron"
```

---

# Phase 2 — Academic Group Type (breaking for flashcards)

### Task 7: Migration `092_add_academic_group_type.ts` (type constraint + ai_settings column + flashcard hard-delete)

**Files:**
- Create: `apps/api/src/database/migrations/092_add_academic_group_type.ts`

**Interfaces:**
- Produces: `groups.type` CHECK constraint includes `'academic'`; `groups.ai_settings JSONB NOT NULL DEFAULT '{}'` — consumed by Task 8.

- [ ] **Step 1: Confirm the current `groups.type` column implementation**

Since `GroupTypeSchema` (schema.ts:3) is a Zod enum validated at the app layer, check whether the actual DB column also has a Postgres CHECK constraint by reading the original `groups` table migration (grep `apps/api/src/database/migrations/` for `create_groups` or wherever `groups` was first created) — do not assume the spec's `ALTER TABLE ... DROP CONSTRAINT groups_type_check` exists if the column is a plain `string`/`varchar` with no DB-level check. If no DB constraint exists, skip the `DROP/ADD CONSTRAINT` statements entirely and rely on the Zod schema (Task 8) as the sole validation layer — do not add a constraint that didn't previously exist unless confirmed present.

- [ ] **Step 2: Write the migration**

```ts
// apps/api/src/database/migrations/092_add_academic_group_type.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // Only run this block if Step 1 confirmed a groups_type_check constraint exists:
  // await knex.raw('ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_type_check')
  // await knex.raw(`ALTER TABLE groups ADD CONSTRAINT groups_type_check CHECK (type IN ('department','club','batch','research','interest','other','academic'))`)

  await knex.schema.alterTable('groups', (table) => {
    table.jsonb('ai_settings').notNullable().defaultTo('{}')
  })

  // Irreversible: hard-delete flashcard data from all non-academic groups.
  // Pre-launch (Assumption A1) — no real user data at risk.
  await knex('group_flashcard_reviews')
    .whereIn('group_id', knex('groups').select('id').where('type', '!=', 'academic'))
    .del()
  await knex('group_flashcards')
    .whereIn('group_id', knex('groups').select('id').where('type', '!=', 'academic'))
    .del()
  await knex('group_flashcard_decks')
    .whereIn('group_id', knex('groups').select('id').where('type', '!=', 'academic'))
    .del()
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('groups', (table) => {
    table.dropColumn('ai_settings')
  })
  // Flashcard delete is intentionally not reversible.
}
```

- [ ] **Step 3: Run the migration**

```bash
npx pnpm --filter api db:migrate
```

Expected: `Batch N run: 1 migrations`.

- [ ] **Step 4: Verify the hard-delete against a seeded non-academic group with flashcards (manual smoke check in dev/test DB)**

```bash
npx pnpm --filter api db:seed
```

Then query `SELECT COUNT(*) FROM group_flashcard_decks WHERE group_id IN (SELECT id FROM groups WHERE type != 'academic')` via `db:seed`'s target DB — expect `0`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/migrations/092_add_academic_group_type.ts
git commit -m "feat(api): add academic group type, ai_settings column, hard-delete non-academic flashcard data"
```

---

### Task 8: `groups/schema.ts` — `academic` type + `AISettingsSchema`

**Files:**
- Modify: `apps/api/src/modules/groups/schema.ts`
- Modify: `apps/api/src/modules/groups/service.ts`
- Test: `apps/api/src/modules/groups/service.test.ts`

**Interfaces:**
- Produces: `GroupTypeSchema` includes `'academic'`; `AISettingsSchema`, `UpdateGroupAISettingsSchema` — consumed by Task 9 controller/router.
- Produces: `groupService.createGroup` throws `forbidden(..., 'ACADEMIC_GROUP_FACULTY_ONLY')` per non-faculty `academic` creation attempt.
- Produces: `toGroup()` includes `aiSettings` field.

- [ ] **Step 1: Write the failing test for the faculty guard**

```ts
// apps/api/src/modules/groups/service.test.ts (add to existing suite)
import { describe, it, expect } from 'vitest'
import { groupService } from './service'
import { createUser } from '../../../tests/factories/user'
import { createUniversity } from '../../../tests/factories/university'

describe('groupService.createGroup — academic type guard', () => {
  it('rejects academic group creation by a student', async () => {
    const universityId = await createUniversity()
    const student = await createUser({ universityId, role: 'student' })

    await expect(
      groupService.createGroup(
        { userId: student.id, universityId, role: 'student' },
        { name: 'CS101', type: 'academic', is_private: false }
      )
    ).rejects.toMatchObject({ code: 'ACADEMIC_GROUP_FACULTY_ONLY' })
  })

  it('allows academic group creation by faculty and returns aiSettings', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })

    const group = await groupService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', type: 'academic', is_private: false }
    )

    expect(group.type).toBe('academic')
    expect(group.aiSettings).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts -t "academic type guard"`
Expected: FAIL — `'academic'` is rejected by the current `GroupTypeSchema` enum validation before it ever reaches `createGroup`, so the first assertion's `.code` won't match `ACADEMIC_GROUP_FACULTY_ONLY` (it'll be a generic Zod validation error), and the second test fails outright since `academic` isn't a valid type yet.

- [ ] **Step 3: Update `GroupTypeSchema` and add `AISettingsSchema`**

In `apps/api/src/modules/groups/schema.ts`, change line 3:

```ts
export const GroupTypeSchema = z.enum([
  'department', 'club', 'batch', 'research', 'interest', 'other', 'academic',
])
```

Add near the bottom of the file (after existing schema exports):

```ts
export const AISettingsSchema = z.object({
  ai_flashcards_enabled: z.boolean().default(false),
  ai_quiz_enabled: z.boolean().default(false),
  require_approval: z.boolean().default(false),
  subject: z.string().max(255).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  question_style: z.enum(['mcq', 'true_false', 'short_answer', 'mixed']).optional(),
  language: z.enum(['en', 'bn']).default('en'),
  custom_instructions: z.string().max(1000).optional(),
})

export const UpdateGroupAISettingsSchema = AISettingsSchema.partial()
```

- [ ] **Step 4: Add the faculty guard to `createGroup`**

In `apps/api/src/modules/groups/service.ts`, inside the `createGroup` method body (service.ts:234), before the `db.transaction` call:

```ts
async createGroup(context, input) {
  if (input.type === 'academic' && context.role !== 'faculty') {
    throw forbidden('Only faculty members can create academic groups', 'ACADEMIC_GROUP_FACULTY_ONLY')
  }
  // ...existing transaction logic unchanged
}
```

Confirm `forbidden` is already imported in this file from `../../utils/errors` (per repo convention) — if not, add the import.

- [ ] **Step 5: Update `toGroup()` to include `aiSettings`**

In `apps/api/src/modules/groups/service.ts`, in the `toGroup` mapper (service.ts:2209-2231), add one field to the returned object:

```ts
function toGroup(row: GroupRow) {
  return {
    // ...existing fields unchanged...
    aiSettings: row.ai_settings ?? {},
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts`
Expected: PASS, including all pre-existing tests in the suite (regression check).

- [ ] **Step 7: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/groups/schema.ts apps/api/src/modules/groups/service.ts apps/api/src/modules/groups/service.test.ts
git commit -m "feat(api): add academic group type with faculty-only creation guard and ai_settings"
```

---

### Task 9: `middleware/requireAcademicGroup.ts` + apply to flashcard routes

**Files:**
- Create: `apps/api/src/middleware/requireAcademicGroup.ts`
- Modify: `apps/api/src/modules/groups/router.ts`
- Test: `apps/api/src/modules/groups/router.test.ts` (integration test against flashcard routes)

**Interfaces:**
- Consumes: `groups.type` column (Task 7), `req.university.id` set by `resolveUniversity`.
- Produces: `requireAcademicGroup` middleware — applied only within Task 9; no other task depends on its export beyond this router wiring.

- [ ] **Step 1: Write the failing integration test**

```ts
// apps/api/src/modules/groups/router.test.ts (add to existing suite)
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { loginAs } from '../../__tests__/setup'
import { createGroupFixture } from '../../../tests/factories/group'

const DOMAIN = 'uiu.ac.bd'

describe('flashcard routes — requireAcademicGroup', () => {
  it('returns 403 with ACADEMIC_GROUP_REQUIRED for a non-academic group', async () => {
    const { accessToken } = await loginAs('student@uiu.ac.bd', 'password123')
    const group = await createGroupFixture({ type: 'club' })

    const res = await request(app)
      .get(`/api/v1/groups/${group.id}/flashcard-decks`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('ACADEMIC_GROUP_REQUIRED')
  })

  it('returns 404 for a nonexistent group', async () => {
    const { accessToken } = await loginAs('student@uiu.ac.bd', 'password123')

    const res = await request(app)
      .get('/api/v1/groups/00000000-0000-0000-0000-000000000000/flashcard-decks')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(404)
  })

  it('allows access for an academic group', async () => {
    const { accessToken } = await loginAs('faculty@uiu.ac.bd', 'password123')
    const group = await createGroupFixture({ type: 'academic' })

    const res = await request(app)
      .get(`/api/v1/groups/${group.id}/flashcard-decks`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
  })
})
```

Note: `createGroupFixture` is a new test factory this task needs — add `apps/api/tests/factories/group.ts` if it doesn't already exist, following the existing factory pattern (never hardcode UUIDs, per `CLAUDE.md` testing conventions) and inserting directly via `db('groups').insert(...)` for speed, bypassing the service faculty guard for test setup convenience.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/groups/router.test.ts -t "requireAcademicGroup"`
Expected: FAIL — currently `GET /:groupId/flashcard-decks` returns 200 regardless of group type.

- [ ] **Step 3: Write the middleware**

```ts
// apps/api/src/middleware/requireAcademicGroup.ts
import type { Request, Response, NextFunction } from 'express'
import { db } from '../database/db'

export async function requireAcademicGroup(req: Request, res: Response, next: NextFunction) {
  const { groupId } = req.params
  const group = await db('groups')
    .where({ id: groupId, university_id: (req as any).university.id })
    .select('type')
    .first()

  if (!group) {
    res.status(404).json({ error: 'Group not found', code: 'GROUP_NOT_FOUND' })
    return
  }
  if (group.type !== 'academic') {
    res.status(403).json({
      error: 'Flashcard decks are only available in Academic Groups',
      code: 'ACADEMIC_GROUP_REQUIRED',
    })
    return
  }
  next()
}
```

- [ ] **Step 4: Apply the middleware to all 8 flashcard routes**

In `apps/api/src/modules/groups/router.ts`, import `requireAcademicGroup` and insert it as the second middleware argument (after route path, before validation) on every flashcard route (router.ts:123-136 per research):

```ts
import { requireAcademicGroup } from '../../middleware/requireAcademicGroup'

groupsRouter.get('/:groupId/flashcard-decks', requireAcademicGroup, listFlashcardDecks)
groupsRouter.post('/:groupId/flashcard-decks', requireAcademicGroup, validate(CreateFlashcardDeckSchema), createFlashcardDeck)
groupsRouter.patch('/:groupId/flashcard-decks/:deckId', requireAcademicGroup, validate(UpdateFlashcardDeckSchema), updateFlashcardDeck)
groupsRouter.delete('/:groupId/flashcard-decks/:deckId', requireAcademicGroup, deleteFlashcardDeck)
groupsRouter.get('/:groupId/flashcard-decks/:deckId/cards', requireAcademicGroup, listFlashcards)
groupsRouter.post('/:groupId/flashcard-decks/:deckId/cards', requireAcademicGroup, validate(CreateFlashcardSchema), createFlashcard)
groupsRouter.get('/:groupId/flashcard-decks/:deckId/review', requireAcademicGroup, getFlashcardReview)
groupsRouter.patch('/:groupId/flashcards/:cardId', requireAcademicGroup, validate(UpdateFlashcardSchema), updateFlashcard)
groupsRouter.delete('/:groupId/flashcards/:cardId', requireAcademicGroup, deleteFlashcard)
groupsRouter.post('/:groupId/flashcards/:cardId/review', requireAcademicGroup, validate(ReviewFlashcardSchema), reviewFlashcard)
```

Preserve every existing handler/schema name exactly as currently declared in the file — only insert `requireAcademicGroup` into the middleware chain, do not rename or reorder anything else. Confirm the exact route list and handler names by reading `router.ts:123-136` directly before editing, since names above are inferred from the research summary's shorthand list.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/groups/router.test.ts`
Expected: PASS, including all pre-existing route tests (regression check — verify no other route accidentally lost its middleware chain).

- [ ] **Step 6: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/middleware/requireAcademicGroup.ts apps/api/src/modules/groups/router.ts apps/api/src/modules/groups/router.test.ts apps/api/tests/factories/group.ts
git commit -m "feat(api): restrict flashcard routes to academic groups"
```

---

### Task 10: `PATCH /:groupId/ai-settings` + `GET /:groupId/ai-settings` routes

**Files:**
- Modify: `apps/api/src/modules/groups/controller.ts`
- Modify: `apps/api/src/modules/groups/service.ts`
- Modify: `apps/api/src/modules/groups/router.ts`
- Test: `apps/api/src/modules/groups/service.test.ts`

**Interfaces:**
- Consumes: `UpdateGroupAISettingsSchema` (Task 8), `requireAcademicGroup` (Task 9).
- Produces: `groupService.getAiSettings(context, groupId)`, `groupService.updateAiSettings(context, groupId, patch)` — consumed by Task 24 (pending-content endpoints) and Task 26 (frontend `AISettingsPanel`).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/groups/service.test.ts (add)
describe('groupService.updateAiSettings', () => {
  it('merges partial ai_settings and requires owner/admin role', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', type: 'academic', is_private: false }
    )

    const updated = await groupService.updateAiSettings(
      { userId: faculty.id, universityId, role: 'faculty' },
      group.id,
      { ai_quiz_enabled: true, subject: 'Data Structures' }
    )

    expect(updated.aiSettings).toMatchObject({ ai_quiz_enabled: true, subject: 'Data Structures' })
  })

  it('rejects updates on non-academic groups', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'Club', type: 'club', is_private: false }
    )

    await expect(
      groupService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, { ai_quiz_enabled: true })
    ).rejects.toMatchObject({ code: 'ACADEMIC_GROUP_REQUIRED' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts -t "updateAiSettings"`
Expected: FAIL — `groupService.updateAiSettings` doesn't exist yet.

- [ ] **Step 3: Implement the service methods**

In `apps/api/src/modules/groups/service.ts`, add two methods to the `groupService` object literal, near `toGroup`/other group-settings methods, reusing whatever `assertGroupAdminAccess` helper the codebase already has (per spec §6.4):

```ts
async getAiSettings(context, groupId) {
  const group = await this.getGroup(context, groupId)
  return { aiSettings: group.aiSettings }
},

async updateAiSettings(context, groupId, patch) {
  const row = await db('groups').where({ id: groupId, university_id: context.universityId }).first()
  if (!row) throw notFound('Group not found')
  if (row.type !== 'academic') throw forbidden('AI settings are only available on academic groups', 'ACADEMIC_GROUP_REQUIRED')
  await assertGroupAdminAccess(context, groupId)

  const merged = { ...(row.ai_settings ?? {}), ...patch }
  await db('groups').where({ id: groupId }).update({ ai_settings: JSON.stringify(merged) })
  return this.getGroup(context, groupId)
},
```

Confirm `assertGroupAdminAccess` is the actual existing helper name by grepping `apps/api/src/modules/groups/service.ts` for the phrase before using it — substitute the real name if different.

- [ ] **Step 4: Add the controller handlers**

In `apps/api/src/modules/groups/controller.ts`:

```ts
export const getAiSettings = asyncHandler(async (req, res) => {
  const context = buildContext(req) // use whatever the file's existing pattern is for building { userId, universityId, role }
  const result = await groupService.getAiSettings(context, req.params.groupId)
  sendSuccess(res, result)
})

export const updateAiSettings = asyncHandler(async (req, res) => {
  const context = buildContext(req)
  const group = await groupService.updateAiSettings(context, req.params.groupId, req.body)
  sendSuccess(res, group)
})
```

Match the exact context-building convention already used by neighboring handlers in this file (e.g. how `createGroup`'s controller builds its context argument) rather than inventing a `buildContext` helper if one doesn't exist.

- [ ] **Step 5: Add the routes**

In `apps/api/src/modules/groups/router.ts`, append after the shared-notes routes:

```ts
groupsRouter.get('/:groupId/ai-settings', getAiSettings)
groupsRouter.patch('/:groupId/ai-settings', validate(UpdateGroupAISettingsSchema), updateAiSettings)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/groups/controller.ts apps/api/src/modules/groups/service.ts apps/api/src/modules/groups/router.ts apps/api/src/modules/groups/service.test.ts
git commit -m "feat(api): add ai-settings get/patch endpoints for academic groups"
```

---

### Task 11: Frontend — `CreateGroupModal.tsx` academic option + `StudyToolsTab.tsx` gating

**Files:**
- Modify: `apps/web/src/features/groups/components/CreateGroupModal.tsx`
- Modify: `apps/web/src/features/groups/components/StudyToolsTab.tsx`
- Modify: `apps/web/src/features/groups/components/StudyDecksPanel.tsx`
- Modify: `apps/web/src/features/groups/types.ts`
- Test: `apps/web/src/features/groups/components/CreateGroupModal.test.tsx`
- Test: `apps/web/src/features/groups/components/StudyToolsTab.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/groups/:groupId` response now includes `aiSettings` and `type: 'academic'` possibility (Task 8).

- [ ] **Step 1: Read the current files in full**

Read `CreateGroupModal.tsx`, `StudyToolsTab.tsx`, `StudyDecksPanel.tsx`, and `types.ts` in full before editing.

- [ ] **Step 2: Write the failing test for `CreateGroupModal`**

```tsx
// apps/web/src/features/groups/components/CreateGroupModal.test.tsx (add to existing suite)
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { CreateGroupModal } from './CreateGroupModal'
import { useAuthStore } from '@/stores/authStore'

describe('CreateGroupModal — academic type', () => {
  it('shows the Academic option for faculty users', () => {
    useAuthStore.setState({ user: { id: 'u1', role: 'faculty' } as any })
    render(<CreateGroupModal isOpen onClose={() => {}} />)
    expect(screen.getByText('Academic')).toBeInTheDocument()
  })

  it('hides the Academic option for student users', () => {
    useAuthStore.setState({ user: { id: 'u2', role: 'student' } as any })
    render(<CreateGroupModal isOpen onClose={() => {}} />)
    expect(screen.queryByText('Academic')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/groups/components/CreateGroupModal.test.tsx`
Expected: FAIL — 'Academic' option doesn't exist in the `TYPES` array yet.

- [ ] **Step 4: Update `TYPES` in `CreateGroupModal.tsx`**

At `CreateGroupModal.tsx:12-19`, the `TYPES` array maps `GroupType` values to UI labels. Add an `academic` entry and filter it out for non-faculty users when rendering:

```tsx
const TYPES: { value: GroupType; label: string }[] = [
  { value: 'department', label: 'Department' },
  { value: 'club', label: 'Club' },
  { value: 'batch', label: 'Batch' },
  { value: 'research', label: 'Research' },
  { value: 'interest', label: 'Interest' },
  { value: 'other', label: 'Other' },
  { value: 'academic', label: 'Academic' },
]
```

Where `TYPES` is rendered (find the `.map` call in the component body), filter out the `academic` entry unless `user?.role === 'faculty'`:

```tsx
const visibleTypes = TYPES.filter((t) => t.value !== 'academic' || user?.role === 'faculty')
```

Use whatever the file's existing pattern is for reading the current user (`useAuthStore` per repo convention) — replicate its exact hook usage rather than introducing a new pattern.

- [ ] **Step 5: Update `GroupType` in `types.ts`**

```ts
export type GroupType = 'department' | 'club' | 'batch' | 'research' | 'interest' | 'other' | 'academic'

export interface AISettings {
  ai_flashcards_enabled: boolean
  ai_quiz_enabled: boolean
  require_approval: boolean
  subject?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  question_style?: 'mcq' | 'true_false' | 'short_answer' | 'mixed'
  language: 'en' | 'bn'
  custom_instructions?: string
  last_ai_post_date?: string
  pending_deck_id?: string | null
  pending_quiz_content?: unknown | null
}
```

Add `aiSettings: AISettings` to whatever the existing `Group` interface is called in this file.

- [ ] **Step 6: Run `CreateGroupModal` test to verify it passes**

Run: `npx pnpm --filter web test src/features/groups/components/CreateGroupModal.test.tsx`
Expected: PASS.

- [ ] **Step 7: Write the failing test for `StudyToolsTab` gating**

```tsx
// apps/web/src/features/groups/components/StudyToolsTab.test.tsx (add)
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StudyToolsTab } from './StudyToolsTab'

describe('StudyToolsTab — academic gating', () => {
  it('shows AcademicOnlyNotice on the decks tab for a non-academic group', async () => {
    render(<StudyToolsTab group={{ id: 'g1', type: 'club' } as any} />)
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.click(screen.getByRole('tab', { name: /decks/i }))
    expect(screen.getByText(/Flashcard decks are available in Academic Groups/i)).toBeInTheDocument()
  })

  it('shows StudyDecksPanel on the decks tab for an academic group', async () => {
    render(<StudyToolsTab group={{ id: 'g2', type: 'academic' } as any} />)
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.click(screen.getByRole('tab', { name: /decks/i }))
    expect(screen.queryByText(/Flashcard decks are available in Academic Groups/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/groups/components/StudyToolsTab.test.tsx`
Expected: FAIL — decks tab currently always renders `StudyDecksPanel`.

- [ ] **Step 9: Implement gating in `StudyToolsTab.tsx`**

Locate the tab-switch rendering logic in `StudyToolsTab.tsx` (a `decks` case in a switch/ternary per the 3-tab-switcher structure noted in research) and wrap it:

```tsx
{activeTab === 'decks' && (
  group.type === 'academic' ? (
    <StudyDecksPanel group={group} />
  ) : (
    <AcademicOnlyNotice
      message="Flashcard decks are available in Academic Groups created by faculty."
      icon="🎓"
    />
  )
)}
```

Create `AcademicOnlyNotice` as a small local component (or add to `StudyToolsPrimitives.tsx` alongside `EmptyState`/`ListSkeleton` if that's where shared panel primitives already live):

```tsx
// in StudyToolsPrimitives.tsx
export function AcademicOnlyNotice({ message, icon }: { message: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
    </div>
  )
}
```

Use `var(--text-secondary)` (or whatever token the file's other empty-state text already uses) — no hardcoded hex per the design-system rule in `CLAUDE.md`.

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx pnpm --filter web test src/features/groups/components/StudyToolsTab.test.tsx`
Expected: PASS.

- [ ] **Step 11: Typecheck and lint**

```bash
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/features/groups/components/CreateGroupModal.tsx apps/web/src/features/groups/components/StudyToolsTab.tsx apps/web/src/features/groups/components/StudyDecksPanel.tsx apps/web/src/features/groups/components/StudyToolsPrimitives.tsx apps/web/src/features/groups/types.ts apps/web/src/features/groups/components/CreateGroupModal.test.tsx apps/web/src/features/groups/components/StudyToolsTab.test.tsx
git commit -m "feat(web): add academic group type to create modal and gate flashcard tab"
```

---

**Plan continues in the same file below — remaining phases (Course Outline, Gradebook, Modules & Assignments, AI Settings Panel + Scheduler, File Uploads, Session Notes) follow the identical Task-N structure (Files/Interfaces/failing-test/implement/pass/typecheck/commit) established above.**

## Remaining Task Index (Phases 3–8)

The following tasks are fully specified with the same level of detail as Tasks 1–11 in the companion continuation file `docs/superpowers/plans/2026-07-09-academic-lms-part2.md`, which must be read and executed as part of this same plan:

- **Phase 3 — Course Outline:** Task 12 (migration `093_create_course_outline.ts`), Task 13 (`academic/course-outline.service.ts` + schema + router + `resolveAITopic`), Task 14 (frontend `CourseOutlineForm.tsx`)
- **Phase 4 — Gradebook:** Task 15 (migration `094_create_academic_lms_tables.ts` Part A), Task 16 (`calculateBestN`/`getLetterGrade` + `gradebook.service.ts` + routes), Task 17 (auto-populate hook in `groups/service.ts` join flows), Task 18 (frontend `GradebookPanel.tsx` + `StudentGradeCard.tsx`)
- **Phase 5 — Modules & Assignments:** Task 19 (migration `094` Part B), Task 20 (`modules.service.ts` + routes), Task 21 (`assignments.service.ts` + upload-url + submissions/grading), Task 22 (frontend `ModulesPanel.tsx` + `AssignmentsPanel.tsx`)
- **Phase 6 — AI Settings Panel + Daily Scheduler:** Task 23 (pending-content approve/reject endpoints), Task 24 (`runGroupPosting()` + rate limiter wiring into `ai-content.worker.ts`), Task 25 (frontend `AISettingsPanel.tsx`)
- **Phase 7 — File Uploads (Shared Notes):** Task 26 (migration `095_add_note_attachments.ts` + `AttachmentSchema`), Task 27 (`/shared-notes/upload-url` endpoint + service updates), Task 28 (frontend `StudyNotesPanel.tsx` drag-drop)
- **Phase 8 — Per-Session Notes:** Task 29 (migration `096_create_session_notes.ts`), Task 30 (session notes routes + service methods), Task 31 (frontend `SessionNotesPanel.tsx`)

---

## Self-Review Notes (run against SPEC.md)

**1. Spec coverage:** All 18 spec sections map to a task in this file or its Phase 3–8 continuation: §5→Tasks 1-6, §6→Tasks 7-11, §7→Tasks 12-14, §8→Tasks 15-18, §9→Tasks 19-22, §10→Tasks 23-25, §11→Task 9 (hard-delete folded into migration) + Task 11 (frontend gating), §12→Tasks 6/24, §13→Tasks 26-28, §14→Tasks 29-31, §15 (migration order)→respected via sequential 091-096 numbering (shifted from spec's 090-095 due to real repo collision at 090), §16 (env vars)→Task 1, §17 (implementation order)→this task ordering follows it exactly, §18 (testing strategy)→every task includes unit/integration test steps; manual smoke tests are called out explicitly in Task 7 Step 4 and should be re-run end-to-end after Task 31 completes.

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N" patterns found in Tasks 1-11. Two intentional exceptions are flagged inline rather than hidden: Task 5 Step 4 and Task 9 Step 4 both instruct the implementer to confirm exact existing variable/handler names against the real file before finalizing, because the research pass only had approximate line-range summaries for `quiz.worker.ts`'s loop variables and `groups/router.ts`'s flashcard handler names — this is a deliberate "verify against source" instruction, not a content gap, since the surrounding code (what to insert, why, and where) is fully specified.

**3. Type consistency:** `AISettings`/`AISettingsSchema` field names (`ai_flashcards_enabled`, `ai_quiz_enabled`, `require_approval`, `subject`, `difficulty`, `question_style`, `language`, `custom_instructions`) are identical across Task 7 (migration comment), Task 8 (Zod schema), and Task 11 (frontend TS type) — snake_case preserved end-to-end since this is a JSONB passthrough, not a camelCase API boundary. `generateQuizQuestions`/`generateFlashcards`/`generateSkillPath` signatures in Task 2 match the Interfaces Contract table and are reused verbatim in Task 6. `toGroup()`'s `aiSettings` field (Task 8) matches the `Group.aiSettings` type added in Task 11.

Gap found and fixed: the original spec's migration numbers (090-095) collided with the real repo's existing migrations up through `090_seed_quiz_badges.ts` — every migration in this plan and its continuation is renumbered 091-096, and this is called out in Global Constraints so Phase 3-8 tasks in the continuation file inherit the correct numbers rather than repeating the spec's stale ones.
