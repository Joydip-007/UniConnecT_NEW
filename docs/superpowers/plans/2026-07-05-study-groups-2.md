# Study Groups 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add group-scoped flashcard decks, shared notes, and spaced-repetition review to the existing Groups study surface.

**Architecture:** Keep the feature in the existing groups module. The API adds purpose-built tables, service methods, schemas, and routes under `/api/v1/groups/:groupId`; the web app adds focused hooks and a new study workspace that preserves the existing sessions flow. Spaced repetition is a pure scheduler plus per-user review rows, so collaborative card content and personal review progress stay separate.

**Tech Stack:** Express 5, Knex, PostgreSQL, Zod, Bull badge queue, React 18, TanStack Query, Vitest, Playwright.

## Global Constraints

- Must implement the master spec §5.4 requirement: group flashcard decks, shared notes, and spaced-repetition review.
- Must not implement daily campus quiz in this branch.
- All API work follows existing module conventions: `router/controller/service/schema`, `asyncHandler`, `sendSuccess`, Zod validation.
- All routes require `requireAuth` and `resolveUniversity`.
- Flashcard decks, cards, reviews, and shared notes are group-scoped and university-scoped.
- Public groups still require membership for study tools.
- Deck/card editing is limited to creator, deck creator, or group owner/admin/moderator as specified.
- Note editing/deletion is limited to note author or group owner/admin/moderator.
- Review progress is per user and per card.
- Badge queue writes are non-blocking and happen after successful DB writes.
- Product UI must follow Impeccable product-register rules: task-first, restrained, no decorative motion, no gradient text, no glassmorphism, no side-stripe accents, no nested cards.
- Interface polish must follow make-interfaces-feel-better: 44px mobile hit targets, tabular dynamic numbers, balanced headings, pretty descriptions, exact transition properties, no `transition: all`.
- Use existing design tokens only; no hardcoded hex colors in new frontend code.
- Font weights stay 400/500 and UI copy stays sentence case.

---

### Task 1: Database, Scheduler, And Validation

**Files:**
- Create: `apps/api/src/database/migrations/088_create_group_study_tools.ts`
- Create: `apps/api/src/modules/groups/spacedRepetition.ts`
- Create: `apps/api/src/modules/groups/spacedRepetition.test.ts`
- Modify: `apps/api/src/modules/groups/schema.ts`

**Interfaces:**
- Produces: `ReviewRating = 'again' | 'hard' | 'good' | 'easy'`
- Produces: `scheduleFlashcardReview(previous: ReviewSchedule | null, rating: ReviewRating, reviewedAt?: Date): ReviewSchedule`
- Produces Zod schemas and inferred types: `CreateFlashcardDeckSchema`, `UpdateFlashcardDeckSchema`, `CreateFlashcardSchema`, `UpdateFlashcardSchema`, `FlashcardReviewSchema`, `CreateSharedNoteSchema`, `UpdateSharedNoteSchema`, plus their input types.

- [ ] **Step 1: Add scheduler tests**

Create `apps/api/src/modules/groups/spacedRepetition.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { scheduleFlashcardReview } from './spacedRepetition'

const now = new Date('2026-07-05T08:00:00.000Z')

describe('scheduleFlashcardReview', () => {
  it('schedules again in 10 minutes and lowers ease with a floor', () => {
    const next = scheduleFlashcardReview({ easeFactor: 1.35, intervalDays: 5, repetitionCount: 3 }, 'again', now)
    expect(next.easeFactor).toBe(1.3)
    expect(next.intervalDays).toBe(0)
    expect(next.repetitionCount).toBe(0)
    expect(next.dueAt.toISOString()).toBe('2026-07-05T08:10:00.000Z')
  })

  it('uses first good interval of one day for a new card', () => {
    const next = scheduleFlashcardReview(null, 'good', now)
    expect(next.easeFactor).toBe(2.5)
    expect(next.intervalDays).toBe(1)
    expect(next.repetitionCount).toBe(1)
    expect(next.dueAt.toISOString()).toBe('2026-07-06T08:00:00.000Z')
  })

  it('uses second good interval of three days', () => {
    const next = scheduleFlashcardReview({ easeFactor: 2.5, intervalDays: 1, repetitionCount: 1 }, 'good', now)
    expect(next.intervalDays).toBe(3)
    expect(next.repetitionCount).toBe(2)
  })

  it('grows mature good reviews by ease factor', () => {
    const next = scheduleFlashcardReview({ easeFactor: 2.5, intervalDays: 4, repetitionCount: 2 }, 'good', now)
    expect(next.intervalDays).toBe(10)
    expect(next.repetitionCount).toBe(3)
  })

  it('schedules easy with bonus interval and ease cap', () => {
    const next = scheduleFlashcardReview({ easeFactor: 2.95, intervalDays: 7, repetitionCount: 2 }, 'easy', now)
    expect(next.easeFactor).toBe(3)
    expect(next.intervalDays).toBe(23)
    expect(next.repetitionCount).toBe(3)
  })

  it('schedules hard with at least one day and lowers ease', () => {
    const next = scheduleFlashcardReview({ easeFactor: 2, intervalDays: 0, repetitionCount: 0 }, 'hard', now)
    expect(next.easeFactor).toBe(1.85)
    expect(next.intervalDays).toBe(1)
    expect(next.repetitionCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run scheduler tests to verify RED**

Run: `npx pnpm --filter api test src/modules/groups/spacedRepetition.test.ts`

Expected: FAIL because `spacedRepetition.ts` does not exist.

- [ ] **Step 3: Add scheduler implementation**

Create `apps/api/src/modules/groups/spacedRepetition.ts`:

```ts
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewScheduleInput {
  easeFactor: number
  intervalDays: number
  repetitionCount: number
}

export interface ReviewSchedule {
  easeFactor: number
  intervalDays: number
  repetitionCount: number
  dueAt: Date
}

const MIN_EASE = 1.3
const MAX_EASE = 3
const DAY_MS = 24 * 60 * 60 * 1000
const TEN_MINUTES_MS = 10 * 60 * 1000

function clampEase(value: number) {
  return Number(Math.min(MAX_EASE, Math.max(MIN_EASE, value)).toFixed(2))
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

export function scheduleFlashcardReview(
  previous: ReviewScheduleInput | null,
  rating: ReviewRating,
  reviewedAt = new Date(),
): ReviewSchedule {
  const base = previous ?? { easeFactor: 2.5, intervalDays: 0, repetitionCount: 0 }

  if (rating === 'again') {
    return {
      easeFactor: clampEase(base.easeFactor - 0.2),
      intervalDays: 0,
      repetitionCount: 0,
      dueAt: new Date(reviewedAt.getTime() + TEN_MINUTES_MS),
    }
  }

  if (rating === 'hard') {
    const intervalDays = Math.max(1, Math.ceil(base.intervalDays * 1.2))
    return {
      easeFactor: clampEase(base.easeFactor - 0.15),
      intervalDays,
      repetitionCount: Math.max(1, base.repetitionCount),
      dueAt: addDays(reviewedAt, intervalDays),
    }
  }

  const repetitionCount = base.repetitionCount + 1
  if (rating === 'easy') {
    const intervalDays = repetitionCount === 1
      ? 3
      : repetitionCount === 2
        ? 7
        : Math.ceil(base.intervalDays * (base.easeFactor + 0.3))
    return {
      easeFactor: clampEase(base.easeFactor + 0.15),
      intervalDays,
      repetitionCount,
      dueAt: addDays(reviewedAt, intervalDays),
    }
  }

  const intervalDays = repetitionCount === 1
    ? 1
    : repetitionCount === 2
      ? 3
      : Math.ceil(base.intervalDays * base.easeFactor)
  return {
    easeFactor: clampEase(base.easeFactor),
    intervalDays,
    repetitionCount,
    dueAt: addDays(reviewedAt, intervalDays),
  }
}
```

- [ ] **Step 4: Add migration**

Create `apps/api/src/database/migrations/088_create_group_study_tools.ts`:

```ts
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('group_flashcard_decks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 160).notNullable()
    table.text('description')
    table.boolean('is_archived').notNullable().defaultTo(false)
    table.integer('card_count').notNullable().defaultTo(0)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['group_id', 'is_archived', 'updated_at'])
    table.index(['university_id', 'group_id'])
  })
  await knex.raw(
    'ALTER TABLE group_flashcard_decks ADD CONSTRAINT group_flashcard_decks_card_count_check CHECK (card_count >= 0)',
  )

  await knex.schema.createTable('group_flashcards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('deck_id').notNullable().references('id').inTable('group_flashcard_decks').onDelete('CASCADE')
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.text('front').notNullable()
    table.text('back').notNullable()
    table.text('hint')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['deck_id', 'created_at'])
    table.index(['group_id', 'updated_at'])
  })

  await knex.schema.createTable('group_flashcard_reviews', (table) => {
    table.uuid('card_id').notNullable().references('id').inTable('group_flashcards').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.decimal('ease_factor', 4, 2).notNullable().defaultTo(2.5)
    table.integer('interval_days').notNullable().defaultTo(0)
    table.integer('repetition_count').notNullable().defaultTo(0)
    table.timestamp('due_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('last_reviewed_at', { useTz: true })
    table.string('last_rating', 10)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.primary(['card_id', 'user_id'])
    table.index(['user_id', 'group_id', 'due_at'])
    table.index(['group_id', 'due_at'])
  })
  await knex.raw(
    'ALTER TABLE group_flashcard_reviews ADD CONSTRAINT group_flashcard_reviews_interval_days_check CHECK (interval_days >= 0)',
  )
  await knex.raw(
    'ALTER TABLE group_flashcard_reviews ADD CONSTRAINT group_flashcard_reviews_repetition_count_check CHECK (repetition_count >= 0)',
  )
  await knex.raw(
    "ALTER TABLE group_flashcard_reviews ADD CONSTRAINT group_flashcard_reviews_last_rating_check CHECK (last_rating IN ('again','hard','good','easy'))",
  )

  await knex.schema.createTable('group_shared_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 160).notNullable()
    table.text('body').notNullable()
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['group_id', 'updated_at'])
    table.index(['university_id', 'group_id'])
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('group_shared_notes')
  await knex.schema.dropTableIfExists('group_flashcard_reviews')
  await knex.schema.dropTableIfExists('group_flashcards')
  await knex.schema.dropTableIfExists('group_flashcard_decks')
}
```

- [ ] **Step 5: Add Zod schemas**

Modify `apps/api/src/modules/groups/schema.ts` after study session schemas:

```ts
export const CreateFlashcardDeckSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
})

export const UpdateFlashcardDeckSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    is_archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })

export const CreateFlashcardSchema = z.object({
  front: z.string().trim().min(1).max(2000),
  back: z.string().trim().min(1).max(2000),
  hint: z.string().trim().max(500).nullable().optional(),
})

export const UpdateFlashcardSchema = z
  .object({
    front: z.string().trim().min(1).max(2000).optional(),
    back: z.string().trim().min(1).max(2000).optional(),
    hint: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })

export const FlashcardReviewSchema = z.object({
  rating: z.enum(['again', 'hard', 'good', 'easy']),
})

export const CreateSharedNoteSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(10000),
})

export const UpdateSharedNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })

export type CreateFlashcardDeckInput = z.infer<typeof CreateFlashcardDeckSchema>
export type UpdateFlashcardDeckInput = z.infer<typeof UpdateFlashcardDeckSchema>
export type CreateFlashcardInput = z.infer<typeof CreateFlashcardSchema>
export type UpdateFlashcardInput = z.infer<typeof UpdateFlashcardSchema>
export type FlashcardReviewInput = z.infer<typeof FlashcardReviewSchema>
export type CreateSharedNoteInput = z.infer<typeof CreateSharedNoteSchema>
export type UpdateSharedNoteInput = z.infer<typeof UpdateSharedNoteSchema>
```

- [ ] **Step 6: Verify Task 1**

Run:

```bash
npx pnpm --filter api test src/modules/groups/spacedRepetition.test.ts
npx pnpm --filter api typecheck
```

Expected: scheduler tests pass and `tsc --noEmit` exits `0`.

- [ ] **Step 7: Commit Task 1**

```bash
git add apps/api/src/database/migrations/088_create_group_study_tools.ts apps/api/src/modules/groups/schema.ts apps/api/src/modules/groups/spacedRepetition.ts apps/api/src/modules/groups/spacedRepetition.test.ts
git commit -m "feat(api): add group study tool foundations"
```

### Task 2: Groups API Service, Controllers, And Routes

**Files:**
- Modify: `apps/api/src/modules/groups/service.ts`
- Modify: `apps/api/src/modules/groups/controller.ts`
- Modify: `apps/api/src/modules/groups/router.ts`
- Modify: `apps/api/src/workers/badge.worker.ts`

**Interfaces:**
- Consumes schemas and scheduler from Task 1.
- Produces API endpoints from spec §6.
- Produces response objects with camelCase fields for frontend usage.

- [ ] **Step 1: Add route/controller names first**

Add imports in `router.ts` and `controller.ts` for:

```ts
listFlashcardDecks
createFlashcardDeck
updateFlashcardDeck
deleteFlashcardDeck
listFlashcards
createFlashcard
updateFlashcard
deleteFlashcard
getFlashcardReviewQueue
reviewFlashcard
listSharedNotes
createSharedNote
updateSharedNote
deleteSharedNote
```

Add these routes after study sessions in `router.ts`:

```ts
groupsRouter.get('/:groupId/flashcard-decks', listFlashcardDecks)
groupsRouter.post('/:groupId/flashcard-decks', validate(CreateFlashcardDeckSchema), createFlashcardDeck)
groupsRouter.patch('/:groupId/flashcard-decks/:deckId', validate(UpdateFlashcardDeckSchema), updateFlashcardDeck)
groupsRouter.delete('/:groupId/flashcard-decks/:deckId', deleteFlashcardDeck)
groupsRouter.get('/:groupId/flashcard-decks/:deckId/cards', listFlashcards)
groupsRouter.post('/:groupId/flashcard-decks/:deckId/cards', validate(CreateFlashcardSchema), createFlashcard)
groupsRouter.get('/:groupId/flashcard-decks/:deckId/review', validateRequest({ query: PaginationQuerySchema }), getFlashcardReviewQueue)
groupsRouter.patch('/:groupId/flashcards/:cardId', validate(UpdateFlashcardSchema), updateFlashcard)
groupsRouter.delete('/:groupId/flashcards/:cardId', deleteFlashcard)
groupsRouter.post('/:groupId/flashcards/:cardId/review', validate(FlashcardReviewSchema), reviewFlashcard)
groupsRouter.get('/:groupId/shared-notes', validateRequest({ query: PaginationQuerySchema }), listSharedNotes)
groupsRouter.post('/:groupId/shared-notes', validate(CreateSharedNoteSchema), createSharedNote)
groupsRouter.patch('/:groupId/shared-notes/:noteId', validate(UpdateSharedNoteSchema), updateSharedNote)
groupsRouter.delete('/:groupId/shared-notes/:noteId', deleteSharedNote)
```

- [ ] **Step 2: Add controller wrappers**

Add controller functions in `controller.ts` using the existing pattern:

```ts
export const listFlashcardDecks = asyncHandler(async (req, res) => {
  sendSuccess(res, await groupsService.listFlashcardDecks(getContext(req), req.params.groupId))
})

export const createFlashcardDeck = asyncHandler(async (req, res) => {
  sendSuccess(res, await groupsService.createFlashcardDeck(getContext(req), req.params.groupId, req.body))
})

export const updateFlashcardDeck = asyncHandler(async (req, res) => {
  sendSuccess(res, await groupsService.updateFlashcardDeck(getContext(req), req.params.groupId, req.params.deckId, req.body))
})

export const deleteFlashcardDeck = asyncHandler(async (req, res) => {
  sendSuccess(res, await groupsService.deleteFlashcardDeck(getContext(req), req.params.groupId, req.params.deckId))
})
```

Repeat the same pattern for cards, review, and shared notes, passing route params directly to service methods.

- [ ] **Step 3: Add service row types and mappers**

Add row interfaces near existing row types in `service.ts`:

```ts
interface FlashcardDeckRow {
  id: string
  group_id: string
  university_id: string
  created_by: string | null
  title: string
  description: string | null
  is_archived: boolean
  card_count: number
  created_at: Date
  updated_at: Date
  creator_full_name: string | null
  creator_avatar_url: string | null
  due_count: string | number
}
```

Add equivalent `FlashcardRow`, `FlashcardReviewRow`, and `SharedNoteRow`, then map to camelCase:

```ts
function toFlashcardDeck(row: FlashcardDeckRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    isArchived: row.is_archived,
    cardCount: Number(row.card_count),
    dueCount: Number(row.due_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creator: row.created_by
      ? { id: row.created_by, fullName: row.creator_full_name, avatarUrl: row.creator_avatar_url }
      : null,
  }
}
```

- [ ] **Step 4: Add service access helpers**

Add helpers:

```ts
function canModerate(role: GroupRole | null) {
  return role === 'owner' || role === 'admin' || role === 'moderator'
}

function assertCanEditOwnedResource(access: GroupAccessRow, ownerId: string | null, userId: string) {
  if (ownerId === userId || canModerate(access.user_role)) return
  throw forbidden('Only the creator or group moderators can edit this item', 'GROUP_ROLE_FORBIDDEN')
}
```

Use `assertMemberAccess(context, groupId)` for every deck/card/note/review method.

- [ ] **Step 5: Implement deck methods**

Add methods with these exact signatures:

```ts
async listFlashcardDecks(context: AuthContext, groupId: string)
async createFlashcardDeck(context: AuthContext, groupId: string, input: CreateFlashcardDeckInput)
async updateFlashcardDeck(context: AuthContext, groupId: string, deckId: string, input: UpdateFlashcardDeckInput)
async deleteFlashcardDeck(context: AuthContext, groupId: string, deckId: string)
```

Implementation requirements:

- Query decks by `group_id`, `university_id`, and `is_archived=false` for list.
- `dueCount` counts cards where current user's review is missing or `due_at <= now()`.
- Update `updated_at` on deck mutations.
- Return fresh mapped deck rows after create/update.

- [ ] **Step 6: Implement card methods**

Add methods with these exact signatures:

```ts
async listFlashcards(context: AuthContext, groupId: string, deckId: string)
async createFlashcard(context: AuthContext, groupId: string, deckId: string, input: CreateFlashcardInput)
async updateFlashcard(context: AuthContext, groupId: string, cardId: string, input: UpdateFlashcardInput)
async deleteFlashcard(context: AuthContext, groupId: string, cardId: string)
```

Implementation requirements:

- Store `group_id` and `university_id` on every card.
- `createFlashcard` enqueues `deck_contributed` with `{ deckId }`.
- `deleteFlashcard` must not decrement below zero.

- [ ] **Step 7: Implement review methods**

Add methods with these exact signatures:

```ts
async getFlashcardReviewQueue(context: AuthContext, groupId: string, deckId: string, query: PaginationQuery)
async reviewFlashcard(context: AuthContext, groupId: string, cardId: string, input: FlashcardReviewInput)
```

Implementation requirements:

- Queue order: due reviewed cards first by `due_at asc`, then new cards by `created_at asc`.
- Limit defaults through `PaginationQuerySchema`; use `query.limit`.
- `reviewFlashcard` reads existing review, calls `scheduleFlashcardReview`, upserts by `(card_id, user_id)`, sets `last_rating`, `last_reviewed_at`, and timestamps.
- Enqueue `flashcard_review_completed` with `{ cardId, groupId }`.

- [ ] **Step 8: Implement note methods**

Add methods with these exact signatures:

```ts
async listSharedNotes(context: AuthContext, groupId: string, query: PaginationQuery)
async createSharedNote(context: AuthContext, groupId: string, input: CreateSharedNoteInput)
async updateSharedNote(context: AuthContext, groupId: string, noteId: string, input: UpdateSharedNoteInput)
async deleteSharedNote(context: AuthContext, groupId: string, noteId: string)
```

Return paginated `{ items, total, page, limit }` like existing group resources.

- [ ] **Step 9: Add badge worker no-op activity support**

Modify `getActivityCount` in `apps/api/src/workers/badge.worker.ts`:

```ts
case 'deck_contributed':
  return countRows('group_flashcard_decks', { created_by: userId })
case 'flashcard_review_completed':
  return countRows('group_flashcard_reviews', { user_id: userId })
```

- [ ] **Step 10: Verify Task 2**

Run:

```bash
npx pnpm --filter api typecheck
npx pnpm --filter api test src/modules/groups/spacedRepetition.test.ts
```

Expected: both pass.

- [ ] **Step 11: Commit Task 2**

```bash
git add apps/api/src/modules/groups/service.ts apps/api/src/modules/groups/controller.ts apps/api/src/modules/groups/router.ts apps/api/src/workers/badge.worker.ts
git commit -m "feat(api): add group flashcard and note endpoints"
```

### Task 3: Web Types And React Query Hooks

**Files:**
- Modify: `apps/web/src/features/groups/types.ts`
- Modify: `apps/web/src/features/groups/hooks/useGroupExtended.ts`
- Modify: `apps/web/src/features/groups/index.ts`

**Interfaces:**
- Produces frontend types: `FlashcardDeck`, `Flashcard`, `FlashcardReviewItem`, `SharedNote`.
- Produces hooks: `useFlashcardDecks`, `useCreateFlashcardDeck`, `useFlashcards`, `useCreateFlashcard`, `useReviewQueue`, `useReviewFlashcard`, `useSharedNotes`, `useCreateSharedNote`, `useUpdateSharedNote`, `useDeleteSharedNote`.

- [ ] **Step 1: Add frontend types**

Add to `types.ts`:

```ts
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export interface FlashcardDeck {
  id: string
  groupId: string
  createdBy: string | null
  title: string
  description: string | null
  isArchived: boolean
  cardCount: number
  dueCount: number
  createdAt: string
  updatedAt: string
  creator: { id: string; fullName: string | null; avatarUrl: string | null } | null
}

export interface Flashcard {
  id: string
  deckId: string
  groupId: string
  createdBy: string | null
  front: string
  back: string
  hint: string | null
  createdAt: string
  updatedAt: string
}

export interface FlashcardReviewItem extends Flashcard {
  dueAt: string | null
  lastRating: ReviewRating | null
}

export interface SharedNote {
  id: string
  groupId: string
  createdBy: string | null
  title: string
  body: string
  createdAt: string
  updatedAt: string
  author: { id: string; fullName: string | null; avatarUrl: string | null } | null
}
```

- [ ] **Step 2: Add hook tests**

Create or extend a focused hooks test in `apps/web/src/features/groups/hooks/useGroupExtended.test.tsx` if no file exists. At minimum, test that create deck invalidates `['groups','flashcard-decks',{ groupId }]` and review invalidates decks/cards/review queue. Use QueryClientProvider pattern from learning hook tests.

- [ ] **Step 3: Add hooks**

Add hooks in `useGroupExtended.ts`:

```ts
export function useFlashcardDecks(groupId: string) {
  return useQuery({
    queryKey: ['groups', 'flashcard-decks', { groupId }],
    queryFn: () => api.get<{ data: FlashcardDeck[] }>(`/groups/${groupId}/flashcard-decks`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}
```

Add matching mutations with invalidations:

- Create/update/delete deck invalidates `flashcard-decks`.
- Create/update/delete card invalidates `flashcards`, `flashcard-decks`, and `flashcard-review`.
- Review card invalidates `flashcard-review` and `flashcard-decks`.
- Create/update/delete note invalidates `shared-notes`.

- [ ] **Step 4: Export types and hooks**

Update `index.ts` to export the new types from `types.ts`. `useGroupExtended.ts` is already wildcard exported.

- [ ] **Step 5: Verify Task 3**

Run:

```bash
npx pnpm --filter web test src/features/groups/hooks/useGroupExtended.test.tsx
npx pnpm --filter web typecheck
```

Expected: hook test and typecheck pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/web/src/features/groups/types.ts apps/web/src/features/groups/hooks/useGroupExtended.ts apps/web/src/features/groups/hooks/useGroupExtended.test.tsx apps/web/src/features/groups/index.ts
git commit -m "feat(web): add group study hooks"
```

### Task 4: Study Workspace UI

**Files:**
- Create: `apps/web/src/features/groups/components/StudyToolsTab.tsx`
- Modify: `apps/web/src/features/groups/components/StudySessionsTab.tsx`
- Modify: `apps/web/src/features/groups/index.ts`
- Modify: `apps/web/src/pages/GroupDetailPage.tsx`
- Test: `apps/web/src/features/groups/components/StudyToolsTab.test.tsx`

**Interfaces:**
- Consumes hooks from Task 3.
- Produces `StudyToolsTab({ groupId, currentUserId, userRole })`.
- Replaces the `study-sessions` tab content with a segmented `Sessions | Decks | Notes` workspace.

- [ ] **Step 1: Write UI tests**

Create `StudyToolsTab.test.tsx` with mocked hooks. Cover:

- Renders segmented controls `Sessions`, `Decks`, `Notes`.
- Empty decks state has `No decks yet` and `New deck`.
- Review flow shows front, then answer, then rating buttons.
- Notes empty state has `No shared notes yet` and `New note`.

- [ ] **Step 2: Run UI tests to verify RED**

Run: `npx pnpm --filter web test src/features/groups/components/StudyToolsTab.test.tsx`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement StudyToolsTab**

Create `StudyToolsTab.tsx` with:

```tsx
type StudyMode = 'sessions' | 'decks' | 'notes'

export function StudyToolsTab({ groupId, currentUserId, userRole }: {
  groupId: string
  currentUserId?: string
  userRole: MemberRole | null
}) {
  const [mode, setMode] = useState<StudyMode>('sessions')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role="tablist" aria-label="Study tools" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['sessions', 'decks', 'notes'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setMode(item)}
            className="press-feedback"
            style={{
              minHeight: 40,
              padding: '7px 14px',
              borderRadius: 'var(--r-pill)',
              border: '0.5px solid var(--border-default)',
              background: mode === item ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
              color: mode === item ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transitionProperty: 'background-color, color, border-color, transform',
              transitionDuration: '150ms',
            }}
          >
            {item === 'sessions' ? 'Sessions' : item === 'decks' ? 'Decks' : 'Notes'}
          </button>
        ))}
      </div>
      {mode === 'sessions' && <StudySessionsTab groupId={groupId} currentUserId={currentUserId} showCreateAction />}
      {mode === 'decks' && <DecksPanel groupId={groupId} />}
      {mode === 'notes' && <NotesPanel groupId={groupId} currentUserId={currentUserId} userRole={userRole} />}
    </div>
  )
}
```

Implement `DecksPanel`, `DeckDetailPanel`, `ReviewPanel`, and `NotesPanel` in `StudyToolsTab.tsx`. If `StudyToolsTab.tsx` exceeds 450 lines after formatting, split `DecksPanel` and `DeckDetailPanel` into `StudyDecksPanel.tsx`, and split `NotesPanel` into `StudyNotesPanel.tsx`; export those panels only through `StudyToolsTab.tsx`.

- [ ] **Step 4: Adjust StudySessionsTab for composition**

Modify `StudySessionsTab` to accept:

```ts
showCreateAction?: boolean
```

Default to `true`. `StudyToolsTab` passes the prop as `true` in this phase so the existing sessions content remains unchanged.

- [ ] **Step 5: Wire GroupDetailPage**

Update `GroupDetailPage.tsx`:

- Change import from `StudySessionsTab` to `StudyToolsTab`.
- Keep the top-level tab label as `Study sessions` for route familiarity.
- Render:

```tsx
{id && activeTab === 'study-sessions' && (
  <StudyToolsTab groupId={id} currentUserId={user?.id} userRole={userRole} />
)}
```

- [ ] **Step 6: Visual requirements during implementation**

Apply these exact standards:

- Use one list surface for decks and notes, with `0.5px` row dividers.
- Do not nest cards inside cards.
- Use `fontVariantNumeric: 'tabular-nums'` for `cardCount` and `dueCount`.
- All icon buttons and action buttons have at least `40px` desktop hit area and `44px` mobile hit area.
- Use `textWrap: 'balance'` on panel titles and `textWrap: 'pretty'` on descriptions.
- No `transition: all`.

- [ ] **Step 7: Verify Task 4**

Run:

```bash
npx pnpm --filter web test src/features/groups/components/StudyToolsTab.test.tsx
npx pnpm --filter web typecheck
npx pnpm --filter web lint
```

Expected: all pass.

- [ ] **Step 8: Commit Task 4**

```bash
git add apps/web/src/features/groups/components/StudyToolsTab.tsx apps/web/src/features/groups/components/StudyToolsTab.test.tsx apps/web/src/features/groups/components/StudySessionsTab.tsx apps/web/src/features/groups/index.ts apps/web/src/pages/GroupDetailPage.tsx
git commit -m "feat(web): add group study workspace"
```

### Task 5: End-To-End Verification And Polish

**Files:**
- Create: `apps/web/e2e/study-groups-2.spec.ts`
- Modify only files from Tasks 1-4 when verification exposes a concrete defect, and document the defect in the Task 5 commit message body.

**Interfaces:**
- Produces browser-level coverage for the new study workspace.

- [ ] **Step 1: Add Playwright test**

Create `apps/web/e2e/study-groups-2.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test.describe('Study groups 2.0', () => {
  test('shows the study workspace and switches between sessions, decks, and notes', async ({ page }) => {
    await page.goto('/groups?dev-auth=1')
    const firstGroup = page.locator('a[href^="/groups/"], button').filter({ hasText: /group|CSE|club/i }).first()
    if (await firstGroup.count()) {
      await firstGroup.click()
    } else {
      test.skip(true, 'No seeded group available in dev-auth state')
    }

    await page.getByRole('tab', { name: 'Study sessions' }).click()
    await expect(page.getByRole('tablist', { name: 'Study tools' })).toBeVisible()
    await page.getByRole('tab', { name: 'Decks' }).click()
    await expect(page.getByText(/deck/i).first()).toBeVisible()
    await page.getByRole('tab', { name: 'Notes' }).click()
    await expect(page.getByText(/note/i).first()).toBeVisible()
  })
})
```

If the existing dev-auth fixtures do not expose a stable group route, replace the navigation with the app's established group detail fixture path rather than broad selectors.

- [ ] **Step 2: Full verification**

Run:

```bash
npx pnpm --filter api test src/modules/groups/spacedRepetition.test.ts
npx pnpm --filter api typecheck
npx pnpm --filter web test
npx pnpm --filter web typecheck
npx pnpm --filter web lint
npx pnpm --filter web exec playwright test e2e/study-groups-2.spec.ts
```

Expected: all pass. If Playwright cannot bind to localhost under sandbox, rerun the same command with escalation.

- [ ] **Step 3: Graph update**

Run:

```bash
graphify update .
```

Expected: graph update completes without tracked graph changes unless the repo normally tracks updated graph output.

- [ ] **Step 4: Commit Task 5**

```bash
git add apps/web/e2e/study-groups-2.spec.ts
git commit -m "test(web): verify study groups workspace"
```

- [ ] **Step 5: Whole-branch review and PR**

Use `superpowers:requesting-code-review` for a final whole-branch review. Fix Critical and Important findings, rerun the full verification commands, then push `feature/study-groups-2` and open a PR to `main`.
