# Group AI Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the academic-group AI settings honest — every toggle does what it says, every stored setting is reachable from the UI and honored by the worker, and concurrent saves can't be lost.

**Architecture:** Group AI config lives in the `groups.ai_settings` jsonb column, so new *settings* need no migration — only the new `group_quizzes` table does. Writes to `ai_settings` move from read-modify-write to an in-SQL `||` jsonb merge, which removes the lost-update window between the creator and the worker. The `group-post` cron moves from once-daily to hourly with per-group hour/frequency gating, matching how `ai-hourly-quiz-gen` and `ai-hourly-learning-gen` already work. AI-authored content is attributed to the campus bot user instead of `groups.created_by`.

**Tech Stack:** Express + Knex + Bull (apps/api), React 18 + TanStack Query + Zustand (apps/web), Zod schemas in the module's `schema.ts`, Vitest + supertest.

## Global Constraints

- `pnpm` is not on PATH — always prefix with `npx`: `npx pnpm …`
- Run `npx pnpm typecheck && npx pnpm lint` before finishing any task.
- Next migration number is `102_` (latest committed is `101_add_module_file_urls`). Never edit a committed migration.
- Services import `db` directly; `universityId` always comes from `req.university.id`, never the request body.
- Emit Socket.io from services after the DB write, never from route handlers.
- Use `sendSuccess` / `sendPaginated`, never raw `res.json()`.
- Throw the named error helpers (`notFound`, `badRequest`, `forbidden`) from services.
- Frontend: no hardcoded hex — `var(--token)` only; borders `0.5px`; buttons `var(--r-pill)`; font-weight 400/500 only; sentence case.
- Data fetching only in `features/*/hooks/` via TanStack Query; `invalidateQueries` only inside mutation `onSuccess`.
- No `any` — `unknown` + narrowing.
- DB tables/columns snake_case; soft deletes use `is_deleted`, not `deleted_at`.

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/modules/groups/schema.ts` | `AISettingsSchema` — add cadence/volume fields |
| `apps/api/src/modules/groups/service.ts` | Atomic `ai_settings` merge; pending-content list/approve/discard for quizzes |
| `apps/api/src/workers/ai-content.worker.ts` | Per-group scheduling gate; flashcard + quiz generation; bot attribution |
| `apps/api/src/database/migrations/102_create_group_quizzes.ts` | New `group_quizzes` table |
| `apps/web/src/features/groups/hooks/useGroupExtended.ts` | `GroupAISettings` type gains the new fields |
| `apps/web/src/features/groups/academic/AISettingsPanel.tsx` | Full settings form |

**Out of scope (state explicitly if asked):** group quiz *attempts* and scoring. `daily_quiz_attempts` is university+department scoped; per-group attempt tracking is a separate feature. This plan generates and publishes group quizzes only.

---

### Task 1: Make `ai_settings` writes atomic

Both `updateAiSettings` and the worker currently read the whole jsonb blob, spread it in JS, and write it back. The worker's copy is a snapshot from the batch query at the top of the run, so a creator saving settings mid-run is silently clobbered. Replace every write with an in-SQL merge.

**Files:**
- Modify: `apps/api/src/modules/groups/service.ts` (`updateAiSettings`, `approvePendingAiContent`, `discardPendingAiContent`)
- Modify: `apps/api/src/workers/ai-content.worker.ts` (both `ai_settings` updates in `runGroupPosting`)
- Test: `apps/api/src/__tests__/groups/ai-settings.test.ts` (create)

**Interfaces:**
- Produces: `mergeAiSettings(groupId: string, patch: Record<string, unknown>): Promise<void>` — module-level helper exported from `apps/api/src/modules/groups/service.ts`, used by Tasks 3 and 4.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/groups/ai-settings.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { db } from '../../config/db'
import { groupsService, mergeAiSettings } from '../../modules/groups/service'
import { randomUUID } from 'node:crypto'

async function makeAcademicGroup() {
  const [uni] = await db('universities')
    .insert({ name: 'AI Settings U', domain: `ai-${randomUUID()}.example.edu` })
    .returning<{ id: string }[]>('id')
  const [user] = await db('users')
    .insert({
      university_id: uni.id,
      username: `t_${randomUUID().slice(0, 8)}`,
      email: `${randomUUID()}@example.edu`,
      role: 'faculty',
    })
    .returning<{ id: string }[]>('id')
  await db('profiles').insert({ user_id: user.id, full_name: 'Faculty' })
  const context = { userId: user.id, universityId: uni.id, role: 'faculty' as const }
  const group = await groupsService.createGroup(context, {
    name: 'AI CS101',
    description: 'g',
    type: 'academic',
    is_private: false,
  })
  return { context, groupId: group.id, universityId: uni.id }
}

describe('ai_settings concurrent writes', () => {
  it('does not clobber a concurrent write made from a stale snapshot', async () => {
    const { context, groupId } = await makeAcademicGroup()

    await groupsService.updateAiSettings(context, groupId, { subject: 'Trees' })

    // Simulates the worker: it holds a snapshot taken BEFORE the creator's save below.
    const staleSnapshot = { subject: 'Trees' }

    await groupsService.updateAiSettings(context, groupId, { ai_flashcards_enabled: true })
    await mergeAiSettings(groupId, { ...staleSnapshot, last_ai_post_date: '2026-08-09' })

    const row = await db('groups').where({ id: groupId }).first()
    // The creator's enable survives the worker's write.
    expect(row.ai_settings.ai_flashcards_enabled).toBe(true)
    expect(row.ai_settings.last_ai_post_date).toBe('2026-08-09')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/__tests__/groups/ai-settings.test.ts`
Expected: FAIL — `mergeAiSettings` is not exported (import error).

- [ ] **Step 3: Add the helper and use it everywhere**

In `apps/api/src/modules/groups/service.ts`, add near the other module-level helpers at the bottom:

```ts
/**
 * Merges a patch into groups.ai_settings inside the database rather than reading the
 * blob, spreading it in JS, and writing it back. The read-modify-write version lost
 * whichever concurrent write finished first — most often the creator's save being
 * overwritten by the background worker's stale snapshot.
 */
export async function mergeAiSettings(groupId: string, patch: Record<string, unknown>): Promise<void> {
  await db('groups')
    .where({ id: groupId })
    .update({ ai_settings: db.raw(`coalesce(ai_settings, '{}'::jsonb) || ?::jsonb`, [JSON.stringify(patch)]) })
}
```

Replace the body of `updateAiSettings`'s write:

```ts
    await mergeAiSettings(groupId, patch)
    return this.getGroup(context, groupId)
```

(delete the `const merged = { ...(row.ai_settings ?? {}), ...patch }` line).

In `approvePendingAiContent` and `discardPendingAiContent`, replace each
`.update({ ai_settings: { ...settings, X: null } })` with `await mergeAiSettings(groupId, { X: null })`.

In `apps/api/src/workers/ai-content.worker.ts`, import it and replace both
`db('groups').where({ id: group.id }).update({ ai_settings: { ...settings, … } })` calls:

```ts
import { groupsService, mergeAiSettings } from '../modules/groups/service'
// …
await mergeAiSettings(group.id, { pending_deck_id: deck.id, last_ai_post_date: today })
// …and in the else branch:
await mergeAiSettings(group.id, { last_ai_post_date: today })
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && npx vitest run src/__tests__/groups/ai-settings.test.ts src/workers/ai-content.worker.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/groups/service.ts apps/api/src/workers/ai-content.worker.ts apps/api/src/__tests__/groups/ai-settings.test.ts
git commit -m "fix(groups): merge ai_settings in SQL to stop concurrent writes clobbering"
```

---

### Task 2: Attribute AI content to the campus bot, not `created_by`

Decks, cards, and the feed post are attributed to `groups.created_by` with a hardcoded `role: 'faculty'`. After an ownership transfer the original creator keeps "posting" AI content, even having left the group. The approval path already posts as the campus bot — make the worker consistent.

**Files:**
- Modify: `apps/api/src/workers/ai-content.worker.ts` (`runGroupPosting`)
- Test: `apps/api/src/workers/ai-content.worker.test.ts`

**Interfaces:**
- Consumes: `contentSyncService.ensureCampusBotUser(universityId: string): Promise<string>` (existing, `modules/content-sync/service.ts:190`)

- [ ] **Step 1: Write the failing test**

Add to the `runGroupPosting` describe block in `apps/api/src/workers/ai-content.worker.test.ts`:

```ts
  it(
    'attributes the AI deck and post to the campus bot, not the group creator',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS104', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const subject = `Graphs ${randomUUID()}`
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          require_approval: false,
          subject,
        })
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { topic: string }) =>
          opts.topic === subject ? [{ front: 'Q', back: 'A' }] : [],
        )

        await runGroupPosting()

        const [deck] = await db('group_flashcard_decks').where({ group_id: group.id })
        expect(deck.created_by).not.toBe(faculty.id)

        const post = await db('posts').where({ group_id: group.id }).first()
        expect(post.user_id).not.toBe(faculty.id)
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/workers/ai-content.worker.test.ts -t 'campus bot'`
Expected: FAIL — `expected <faculty uuid> not to be <faculty uuid>`

- [ ] **Step 3: Implement**

In `runGroupPosting`, resolve the author once per group, before generating:

```ts
      // AI content is authored by the campus bot: groups.created_by goes stale after an
      // ownership transfer and may name someone who has left the group entirely.
      const authorId = await contentSyncService.ensureCampusBotUser(group.university_id)
      const author = await db('users').where({ id: authorId }).first<{ role: string }>('role')
```

Replace every `created_by: group.created_by` with `created_by: authorId` (deck insert and card inserts), and the feed call:

```ts
        await feedService.createPost(
          { userId: authorId, universityId: group.university_id, role: author.role as 'faculty' },
```

Add the import: `import { contentSyncService } from '../modules/content-sync/service'`.

- [ ] **Step 4: Run tests**

Run: `cd apps/api && npx vitest run src/workers/ai-content.worker.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workers/ai-content.worker.ts apps/api/src/workers/ai-content.worker.test.ts
git commit -m "fix(groups): attribute AI group content to campus bot instead of stale created_by"
```

---

### Task 3: Cadence and volume settings

Add `items_per_run`, `frequency`, `run_hour`, `run_weekday` to the jsonb settings (no migration needed) and move `group-post` from a single global daily hour to hourly with per-group gating — the same shape `ai-hourly-quiz-gen` and `ai-hourly-learning-gen` already use.

**Files:**
- Modify: `apps/api/src/modules/groups/schema.ts:197-208`
- Modify: `apps/api/src/workers/ai-content.worker.ts` (`runGroupPosting` signature + gate, cron registration at `:245-246`, queue handler at `:258`)
- Test: `apps/api/src/workers/ai-content.worker.test.ts`

**Interfaces:**
- Produces: `runGroupPosting(now?: Date): Promise<void>` — gains an injectable clock, mirroring `runLearningPathGeneration(now)`.
- Produces settings keys consumed by Task 5's UI: `items_per_run: number`, `frequency: 'daily' | 'weekly'`, `run_hour: number`, `run_weekday?: number`.

- [ ] **Step 1: Write the failing test**

```ts
  it(
    'skips a group whose configured run hour is not the current hour',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS105', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const now = new Date()
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          run_hour: (now.getUTCHours() + 5) % 24,
        })
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockResolvedValue([{ front: 'Q', back: 'A' }])

        await runGroupPosting(now)

        expect(await db('group_flashcard_decks').where({ group_id: group.id })).toHaveLength(0)
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )

  it(
    'generates items_per_run cards rather than the hardcoded 10',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS106', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const now = new Date()
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          items_per_run: 3,
          run_hour: now.getUTCHours(),
        })
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockResolvedValue([{ front: 'Q', back: 'A' }])

        await runGroupPosting(now)

        expect(generateFlashcards).toHaveBeenCalledWith(expect.objectContaining({ count: 3 }))
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/workers/ai-content.worker.test.ts -t 'run hour'`
Expected: FAIL — `runGroupPosting` takes no argument, deck is created anyway.

- [ ] **Step 3: Extend the schema**

In `apps/api/src/modules/groups/schema.ts`, add to `AISettingsSchema`:

```ts
  items_per_run: z.number().int().min(1).max(20).default(10),
  frequency: z.enum(['daily', 'weekly']).default('daily'),
  run_hour: z.number().int().min(0).max(23).default(2),
  run_weekday: z.number().int().min(0).max(6).optional(),
```

- [ ] **Step 4: Gate the worker per group**

Extend the `AiSettings` interface in the worker with the same four keys (all optional). Change the signature and add the gate immediately after `const settings: AiSettings = group.ai_settings ?? {}`:

```ts
export async function runGroupPosting(now: Date = new Date()): Promise<void> {
  const today = now.toISOString().slice(0, 10)
  // …
      // Per-group schedule. The job now fires hourly, so each group picks its own hour
      // (and weekday, when weekly) instead of every group sharing one global env hour.
      if ((settings.run_hour ?? 2) !== now.getUTCHours()) continue
      if (settings.frequency === 'weekly' && (settings.run_weekday ?? 1) !== now.getUTCDay()) continue
```

Pass the count through: `count: settings.items_per_run ?? 10`.

Change the cron registration and handler:

```ts
    { repeat: { cron: '0 * * * *' }, jobId: 'ai-hourly-group-post' },
// …
  if (job.data.task === 'group-post') {
    await runGroupPosting(new Date())
  }
```

Note: `env.AI_GROUP_POST_HOUR` becomes unused here — leave the env var defined (other deployments may read it) but drop it from this cron expression. The `jobId` change from `ai-daily-group-post` to `ai-hourly-group-post` is deliberate: Bull keys repeatable jobs by `jobId`, so reusing the old id would keep the old daily schedule alive.

- [ ] **Step 5: Run tests**

Run: `cd apps/api && npx vitest run src/workers/ai-content.worker.test.ts`
Expected: PASS (all). The three pre-existing `runGroupPosting` tests must still pass — they don't set `run_hour`, so they rely on the `?? 2` default; update each to pass `run_hour: new Date().getUTCHours()` in its `updateAiSettings` call so they remain deterministic.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/groups/schema.ts apps/api/src/workers/ai-content.worker.ts apps/api/src/workers/ai-content.worker.test.ts
git commit -m "feat(groups): per-group AI cadence, run hour, and item count"
```

---

### Task 4: Make the quiz toggle real

`ai_quiz_enabled` selects the group in the worker's query and is then discarded by `if (!settings.ai_flashcards_enabled) continue`. `pending_quiz_content` is read, listed, and cleared in three places but written nowhere, and `question_style` is defined in the schema and read nowhere. This task makes all three live, storing quizzes in a new table that mirrors `group_flashcard_decks`.

**Files:**
- Create: `apps/api/src/database/migrations/102_create_group_quizzes.ts`
- Modify: `apps/api/src/workers/ai-content.worker.ts` (`runGroupPosting`)
- Modify: `apps/api/src/modules/groups/service.ts` (`listPendingAiContent`, `approvePendingAiContent`, `discardPendingAiContent`)
- Test: `apps/api/src/workers/ai-content.worker.test.ts`

**Interfaces:**
- Consumes: `mergeAiSettings` (Task 1), `authorId` resolution (Task 2), `items_per_run` / schedule gate (Task 3)
- Produces: `groups.ai_settings.pending_quiz_id: string | null` — replaces the never-written `pending_quiz_content`. The pending-content item id for a quiz becomes the `group_quizzes.id`, not the literal string `'pending-quiz'`.

- [ ] **Step 1: Write the migration**

Create `apps/api/src/database/migrations/102_create_group_quizzes.ts`:

```ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('group_quizzes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 160).notNullable()
    table.jsonb('questions').notNullable().defaultTo('[]')
    table.boolean('is_archived').notNullable().defaultTo(false)
    table.integer('question_count').notNullable().defaultTo(0)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('group_quizzes', (table) => {
    table.index(['group_id', 'created_at'], 'idx_group_quizzes_group_created')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('group_quizzes')
}
```

- [ ] **Step 2: Run the migration**

Run: `cd apps/api && npx pnpm db:migrate`
Expected: `Batch N run: 1 migrations`

- [ ] **Step 3: Write the failing test**

```ts
  it(
    'generates a group quiz when only the quiz toggle is enabled',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS107', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const now = new Date()
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_quiz_enabled: true,
          ai_flashcards_enabled: false,
          require_approval: false,
          question_style: 'true_false',
          run_hour: now.getUTCHours(),
        })
        ;(generateQuizQuestions as ReturnType<typeof vi.fn>).mockResolvedValue([
          { q: 'Q', options: ['a', 'b', 'c', 'd'], answer: 0 },
        ])

        await runGroupPosting(now)

        const quizzes = await db('group_quizzes').where({ group_id: group.id })
        expect(quizzes).toHaveLength(1)
        expect(quizzes[0].is_archived).toBe(false)
        expect(generateQuizQuestions).toHaveBeenCalledWith(expect.objectContaining({ style: 'true_false' }))
      } finally {
        await db('group_quizzes').where({ university_id: universityId }).del()
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )
```

Also add `await db('group_quizzes').whereIn('group_id', groupIds).del()` as the first line of `cleanupGroups`.

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/workers/ai-content.worker.test.ts -t 'only the quiz toggle'`
Expected: FAIL — `expected [] to have length 1`

- [ ] **Step 5: Implement generation**

In `runGroupPosting`, replace `if (!settings.ai_flashcards_enabled) continue` with independent handling of each toggle. After the schedule gate:

```ts
      if (!settings.ai_flashcards_enabled && !settings.ai_quiz_enabled) continue

      const topic = await courseOutlineService.resolveAITopic(group.id, group.university_id)
      const authorId = await contentSyncService.ensureCampusBotUser(group.university_id)
      const author = await db('users').where({ id: authorId }).first<{ role: string }>('role')

      if (settings.ai_flashcards_enabled) {
        // …existing deck generation, unchanged apart from authorId/items_per_run…
      }

      if (settings.ai_quiz_enabled) {
        const questions = await rateLimitedAICall(() =>
          generateQuizQuestions({
            department: topic,
            count: settings.items_per_run ?? 10,
            difficulty: settings.difficulty,
            style: settings.question_style === 'short_answer' ? 'mixed' : settings.question_style,
            language: settings.language,
            customInstructions: settings.custom_instructions,
          }),
        )

        const [quiz] = await db('group_quizzes')
          .insert({
            group_id: group.id,
            university_id: group.university_id,
            created_by: authorId,
            title: `AI quiz — ${topic}`,
            questions: JSON.stringify(questions),
            question_count: questions.length,
            is_archived: !!settings.require_approval,
          })
          .returning<{ id: string }[]>('id')

        if (settings.require_approval) {
          await mergeAiSettings(group.id, { pending_quiz_id: quiz.id })
        } else {
          await feedService.createPost(
            { userId: authorId, universityId: group.university_id, role: author.role as 'faculty' },
            {
              type: 'post',
              content: `🧠 New AI quiz: ${topic} — ${questions.length} questions ready!`,
              group_id: group.id,
              media_urls: [],
              is_published: true,
            },
          )
        }
      }

      await mergeAiSettings(group.id, { last_ai_post_date: today })
```

Note `generateQuizQuestions`'s `style` union is `'mcq' | 'true_false' | 'mixed'` while the settings enum also allows `'short_answer'` — map it to `'mixed'` as shown rather than widening the AI service.

Import `generateQuizQuestions` in the worker if not already imported.

- [ ] **Step 6: Replace the dead pending-quiz plumbing**

In `service.ts`, `listPendingAiContent` — replace the `settings.pending_quiz_content` branch:

```ts
    if (typeof settings.pending_quiz_id === 'string') {
      const quiz = await db('group_quizzes').where({ id: settings.pending_quiz_id }).first()
      if (quiz) items.push({ id: quiz.id, type: 'quiz', title: quiz.title })
    }
```

In `approvePendingAiContent`, replace the `contentId === 'pending-quiz'` branch:

```ts
    if (settings.pending_quiz_id === contentId) {
      await db('group_quizzes').where({ id: contentId }).update({ is_archived: false })
      await mergeAiSettings(groupId, { pending_quiz_id: null })
      return { approved: true }
    }
```

In `discardPendingAiContent`, replace its `'pending-quiz'` branch:

```ts
    if (settings.pending_quiz_id === contentId) {
      await db('group_quizzes').where({ id: contentId }).del()
      await mergeAiSettings(groupId, { pending_quiz_id: null })
      return { discarded: true }
    }
```

- [ ] **Step 7: Run tests**

Run: `cd apps/api && npx vitest run src/workers/ai-content.worker.test.ts src/__tests__/groups/`
Expected: PASS (all)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/database/migrations/102_create_group_quizzes.ts apps/api/src/workers/ai-content.worker.ts apps/api/src/modules/groups/service.ts apps/api/src/workers/ai-content.worker.test.ts
git commit -m "feat(groups): generate group quizzes so the quiz toggle actually works"
```

---

### Task 5: Expose every setting in the UI

`AISettingsPanel` renders 3 of the now-12 settings. The rest are validated, stored, and honored — just unreachable.

**Files:**
- Modify: `apps/web/src/features/groups/hooks/useGroupExtended.ts:679-688` (`GroupAISettings`)
- Modify: `apps/web/src/features/groups/academic/AISettingsPanel.tsx`
- Test: `apps/web/src/features/groups/academic/AISettingsPanel.test.tsx`

**Interfaces:**
- Consumes: settings keys from Tasks 3 and 4 — `items_per_run`, `frequency`, `run_hour`, `run_weekday`, plus existing `subject`, `difficulty`, `question_style`, `language`, `custom_instructions`.

- [ ] **Step 1: Extend the type**

```ts
export interface GroupAISettings {
  ai_flashcards_enabled: boolean
  ai_quiz_enabled: boolean
  require_approval: boolean
  subject?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  question_style?: 'mcq' | 'true_false' | 'short_answer' | 'mixed'
  language: 'en' | 'bn'
  custom_instructions?: string
  items_per_run: number
  frequency: 'daily' | 'weekly'
  run_hour: number
  run_weekday?: number
}
```

- [ ] **Step 2: Write the failing test**

Add to `AISettingsPanel.test.tsx` (follow the existing MSW setup in that file):

```tsx
it('saves the subject the creator types', async () => {
  const user = userEvent.setup()
  render(<AISettingsPanel groupId="g1" />, { wrapper })

  const subject = await screen.findByLabelText('Subject')
  await user.clear(subject)
  await user.type(subject, 'Binary trees')
  await user.tab()

  await waitFor(() => expect(patchedBodies).toContainEqual(expect.objectContaining({ subject: 'Binary trees' })))
})

it('saves the number of items per run', async () => {
  const user = userEvent.setup()
  render(<AISettingsPanel groupId="g1" />, { wrapper })

  const count = await screen.findByLabelText('Items per run')
  await user.clear(count)
  await user.type(count, '5')
  await user.tab()

  await waitFor(() => expect(patchedBodies).toContainEqual(expect.objectContaining({ items_per_run: 5 })))
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/features/groups/academic/AISettingsPanel.test.tsx`
Expected: FAIL — `Unable to find a label with the text of: Subject`

- [ ] **Step 4: Build the form**

Add below the existing checkbox card, in a second card with the same styling. Text/number inputs save on blur (not per keystroke) to avoid a PATCH per character; selects save on change:

```tsx
      <div
        className="flex flex-col gap-3 rounded-[var(--r-md)] p-4"
        style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)' }}
      >
        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subject</span>
          <input
            aria-label="Subject"
            defaultValue={settings.subject ?? ''}
            onBlur={(e) => update.mutate({ subject: e.target.value })}
            placeholder="Falls back to your course outline, then the group name"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Difficulty</span>
          <select
            aria-label="Difficulty"
            value={settings.difficulty ?? 'intermediate'}
            onChange={(e) => update.mutate({ difficulty: e.target.value as GroupAISettings['difficulty'] })}
            style={inputStyle}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Question style</span>
          <select
            aria-label="Question style"
            value={settings.question_style ?? 'mcq'}
            onChange={(e) => update.mutate({ question_style: e.target.value as GroupAISettings['question_style'] })}
            style={inputStyle}
          >
            <option value="mcq">Multiple choice</option>
            <option value="true_false">True or false</option>
            <option value="short_answer">Short answer</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Language</span>
          <select
            aria-label="Language"
            value={settings.language}
            onChange={(e) => update.mutate({ language: e.target.value as 'en' | 'bn' })}
            style={inputStyle}
          >
            <option value="en">English</option>
            <option value="bn">Bangla</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Items per run</span>
          <input
            aria-label="Items per run"
            type="number"
            min={1}
            max={20}
            defaultValue={settings.items_per_run}
            onBlur={(e) => update.mutate({ items_per_run: Number(e.target.value) })}
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Frequency</span>
          <select
            aria-label="Frequency"
            value={settings.frequency}
            onChange={(e) => update.mutate({ frequency: e.target.value as 'daily' | 'weekly' })}
            style={inputStyle}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Run hour (UTC)</span>
          <input
            aria-label="Run hour"
            type="number"
            min={0}
            max={23}
            defaultValue={settings.run_hour}
            onBlur={(e) => update.mutate({ run_hour: Number(e.target.value) })}
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Custom instructions</span>
          <textarea
            aria-label="Custom instructions"
            rows={3}
            maxLength={1000}
            defaultValue={settings.custom_instructions ?? ''}
            onBlur={(e) => update.mutate({ custom_instructions: e.target.value })}
            style={inputStyle}
          />
        </label>
      </div>
```

Define once above the return:

```tsx
  const inputStyle = {
    background: 'var(--surface-raised)',
    border: '0.5px solid var(--border-default)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-primary)',
    padding: '7px 10px',
    fontSize: 13,
    fontWeight: 400,
  } as const
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npx vitest run src/features/groups/academic/AISettingsPanel.test.tsx`
Expected: PASS (all)

- [ ] **Step 6: Update the screenshot**

Requires the Vite dev server running (`npx pnpm --filter web dev`).
Run: `node scripts/screenshot.cjs feed` — there is no dedicated group-detail entry in `ROUTES`; if you add one, add the matching row to the table in `CLAUDE.md`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/groups/hooks/useGroupExtended.ts apps/web/src/features/groups/academic/AISettingsPanel.tsx apps/web/src/features/groups/academic/AISettingsPanel.test.tsx
git commit -m "feat(groups): expose full AI settings form to group admins"
```

---

## Final verification

- [ ] `npx pnpm typecheck && npx pnpm lint` — both clean
- [ ] `npx pnpm test` — api 49 files green, web 53 files green
- [ ] Manually confirm: enabling only "Daily quiz" on an academic group with `run_hour` set to the current UTC hour produces a `group_quizzes` row on the next hourly run.
