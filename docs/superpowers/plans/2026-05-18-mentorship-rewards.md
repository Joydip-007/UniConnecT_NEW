# Mentorship Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add alumni mentorship opt-in (separate from `isOpenToWork`), a points system (10 pts per completed session), and an admin-fulfilled gift card redemption flow. Restructure `MentorshipPage` so alumni see a single opt-in toggle first; tabs (Requests | Previous sessions | Rewards) appear after opting in.

**Architecture:**
- New profile columns: `is_open_to_mentorship boolean`, `mentorship_points integer`.
- New tables: `gift_cards` (global catalog), `mentor_redemptions` (alumni → admin queue).
- Points lifecycle: +10 on `accepted → completed`, -threshold on redemption request (refunded on admin reject).
- Constants: `POINTS_PER_SESSION = 10`, `POINTS_PER_USD = 100` → 100-point threshold for $1, 1000 for $10, etc.
- 6 starter gift cards seeded via data migration: Google Play $5, Steam $5, Amazon $5, Udemy $10, Coursera $10, edX $10.
- Admin queue lives at `GET /admin/mentorship/redemptions`; admin sets status + code via `PATCH /admin/mentorship/redemptions/:id`.

**Tech Stack:** Express + Knex + Postgres backend; React + TanStack Query frontend. Existing socket infra for notifications. No new external deps for this plan (rehype-sanitize, framer-motion, satoshi are in the polish plan).

---

## Task A: Backend — schema migrations

**Files:**
- Create: `apps/api/src/database/migrations/030_add_mentorship_opt_in_and_points.ts`
- Create: `apps/api/src/database/migrations/031_create_gift_cards.ts`
- Create: `apps/api/src/database/migrations/032_create_mentor_redemptions.ts`
- Create: `apps/api/src/database/migrations/033_seed_gift_cards.ts`

- [ ] **Step 1: Migration 030 — profile fields**

```typescript
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('profiles', (table) => {
    table.boolean('is_open_to_mentorship').notNullable().defaultTo(false)
    table.integer('mentorship_points').notNullable().defaultTo(0)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('profiles', (table) => {
    table.dropColumn('is_open_to_mentorship')
    table.dropColumn('mentorship_points')
  })
}
```

- [ ] **Step 2: Migration 031 — gift_cards**

```typescript
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('gift_cards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.string('vendor', 100).notNullable()
    table.string('title', 160).notNullable()
    table.text('description')
    table.text('image_url')
    table.integer('value_usd_cents').notNullable() // store as cents to avoid float
    table.integer('threshold_points').notNullable()
    table.boolean('is_active').notNullable().defaultTo(true)
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.index(['is_active', 'threshold_points'])
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('gift_cards')
}
```

- [ ] **Step 3: Migration 032 — mentor_redemptions**

```typescript
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('mentor_redemptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('gift_card_id').notNullable().references('id').inTable('gift_cards').onDelete('RESTRICT')
    table.integer('points_spent').notNullable()
    table.enu('status', ['pending', 'fulfilled', 'rejected'], {
      useNative: true,
      enumName: 'mentor_redemption_status',
    }).notNullable().defaultTo('pending')
    table.text('code_text')
    table.text('admin_note')
    table.uuid('fulfilled_by').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('requested_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('fulfilled_at', { useTz: true })
    table.index(['university_id', 'status', 'requested_at'])
    table.index(['user_id', 'requested_at'])
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('mentor_redemptions')
  await knex.raw('DROP TYPE IF EXISTS mentor_redemption_status')
}
```

- [ ] **Step 4: Migration 033 — seed gift cards**

```typescript
import type { Knex } from 'knex'

const SEED = [
  { vendor: 'Google Play', title: 'Google Play $5', value_usd_cents: 500, threshold_points: 500, image_url: null },
  { vendor: 'Steam',       title: 'Steam $5',       value_usd_cents: 500, threshold_points: 500, image_url: null },
  { vendor: 'Amazon',      title: 'Amazon $5',      value_usd_cents: 500, threshold_points: 500, image_url: null },
  { vendor: 'Udemy',       title: 'Udemy $10',      value_usd_cents: 1000, threshold_points: 1000, image_url: null },
  { vendor: 'Coursera',    title: 'Coursera $10',   value_usd_cents: 1000, threshold_points: 1000, image_url: null },
  { vendor: 'edX',         title: 'edX $10',        value_usd_cents: 1000, threshold_points: 1000, image_url: null },
]

export async function up(knex: Knex) {
  for (const row of SEED) {
    const exists = await knex('gift_cards').where({ title: row.title }).first()
    if (!exists) await knex('gift_cards').insert(row)
  }
}

export async function down(knex: Knex) {
  await knex('gift_cards').whereIn('title', SEED.map((s) => s.title)).delete()
}
```

- [ ] **Step 5: Run migrations**

```bash
npx pnpm --filter api db:migrate
```

Expected: four `Batch X run` lines.

---

## Task B: Backend — extend mentorship service & router

**Files:**
- Modify: `apps/api/src/modules/mentorship/schema.ts` (add redeem + gift card query schemas)
- Modify: `apps/api/src/modules/mentorship/service.ts` (rename gate to opt-in; award points; add rewards/redeem methods)
- Modify: `apps/api/src/modules/mentorship/controller.ts`
- Modify: `apps/api/src/modules/mentorship/router.ts`
- Modify: `apps/api/src/modules/admin/service.ts`, `controller.ts`, `router.ts`, `schema.ts` (redemption queue endpoints)
- Modify: `apps/api/src/modules/users/schema.ts` (allow `isOpenToMentorship` in PATCH profile)
- Modify: `apps/api/src/modules/users/service.ts` (write the new field + expose `mentorshipPoints`)

- [ ] **Step 1: Add Zod schemas in `mentorship/schema.ts`**

Append:
```typescript
export const RedeemGiftCardSchema = z.object({
  giftCardId: z.string().uuid(),
})

export const GiftCardListQuerySchema = z.object({
  vendor: z.string().trim().min(1).optional(),
})

export const RedemptionStatusSchema = z.enum(['pending', 'fulfilled', 'rejected'])

export type RedeemGiftCardInput = z.infer<typeof RedeemGiftCardSchema>
export type GiftCardListQuery = z.infer<typeof GiftCardListQuerySchema>
```

Update `UpdateRequestSchema` so we recognize the points-grant trigger — no schema change needed; the transition logic lives in the service.

- [ ] **Step 2: Switch alumni-list and request-creation to `is_open_to_mentorship`**

In `mentorship/service.ts`, replace both occurrences of `'profiles.is_open_to_work': true` with `'profiles.is_open_to_mentorship': true`.

- [ ] **Step 3: Award points on `accepted → completed`**

In `updateRequest()` after the existing `await db('mentorship_requests')...update(updates)` and before the return:

```typescript
const prevStatus = request.status
const nextStatus = input.status
if (prevStatus !== 'completed' && nextStatus === 'completed') {
  await db('profiles')
    .where({ user_id: request.alumni_id })
    .increment('mentorship_points', POINTS_PER_SESSION)
}
```

Add at top of file:
```typescript
export const POINTS_PER_SESSION = 10
export const POINTS_PER_USD_CENT = 1 // 100 points per dollar = 1 point per cent
```

- [ ] **Step 4: Add rewards methods**

In the same service class, add:
```typescript
async getMyRewards(universityId: string, userId: string) {
  const profile = await db('profiles')
    .where({ user_id: userId })
    .select<{ mentorship_points: number }[]>('mentorship_points')
    .first()
  const points = profile?.mentorship_points ?? 0

  const history = await db('mentor_redemptions')
    .leftJoin('gift_cards', 'gift_cards.id', 'mentor_redemptions.gift_card_id')
    .where({ 'mentor_redemptions.university_id': universityId, 'mentor_redemptions.user_id': userId })
    .orderBy('mentor_redemptions.requested_at', 'desc')
    .select(
      'mentor_redemptions.id',
      'mentor_redemptions.points_spent',
      'mentor_redemptions.status',
      'mentor_redemptions.code_text',
      'mentor_redemptions.admin_note',
      'mentor_redemptions.requested_at',
      'mentor_redemptions.fulfilled_at',
      'gift_cards.id as gift_card_id',
      'gift_cards.vendor',
      'gift_cards.title',
      'gift_cards.value_usd_cents',
      'gift_cards.image_url',
    )

  return {
    points,
    history: history.map(toRedemption),
  }
}

async listGiftCards() {
  const rows = await db('gift_cards')
    .where({ is_active: true })
    .orderBy('threshold_points', 'asc')
    .select('id', 'vendor', 'title', 'description', 'image_url', 'value_usd_cents', 'threshold_points')
  return rows.map(toGiftCard)
}

async redeem(context: AuthContext, input: RedeemGiftCardInput) {
  if (context.role !== 'alumni') {
    throw forbidden('Only alumni can redeem rewards', 'REDEEM_ALUMNI_ONLY')
  }

  return db.transaction(async (trx) => {
    const card = await trx('gift_cards')
      .where({ id: input.giftCardId, is_active: true })
      .select<{ id: string; threshold_points: number }[]>('id', 'threshold_points')
      .first()
    if (!card) throw notFound('Gift card not available', 'GIFT_CARD_NOT_FOUND')

    const profile = await trx('profiles')
      .where({ user_id: context.userId })
      .forUpdate()
      .select<{ mentorship_points: number }[]>('mentorship_points')
      .first()
    const balance = profile?.mentorship_points ?? 0
    if (balance < card.threshold_points) {
      throw badRequest('Not enough points to redeem this card', 'INSUFFICIENT_POINTS')
    }

    await trx('profiles')
      .where({ user_id: context.userId })
      .decrement('mentorship_points', card.threshold_points)

    const [row] = await trx('mentor_redemptions')
      .insert({
        university_id: context.universityId,
        user_id: context.userId,
        gift_card_id: card.id,
        points_spent: card.threshold_points,
        status: 'pending',
      })
      .returning<{ id: string }[]>('id')

    return { redemptionId: row!.id, remainingPoints: balance - card.threshold_points }
  })
}
```

Add transformers at the bottom:
```typescript
function toGiftCard(row: any) {
  return {
    id: row.id,
    vendor: row.vendor,
    title: row.title,
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    valueUsdCents: row.value_usd_cents,
    thresholdPoints: row.threshold_points,
  }
}

function toRedemption(row: any) {
  return {
    id: row.id,
    pointsSpent: row.points_spent,
    status: row.status,
    codeText: row.code_text ?? null,
    adminNote: row.admin_note ?? null,
    requestedAt: row.requested_at,
    fulfilledAt: row.fulfilled_at ?? null,
    giftCard: row.gift_card_id
      ? {
          id: row.gift_card_id,
          vendor: row.vendor,
          title: row.title,
          valueUsdCents: row.value_usd_cents,
          imageUrl: row.image_url,
        }
      : null,
  }
}
```

(Use proper row types instead of `any` — pull the columns into an interface; lint will require it.)

- [ ] **Step 5: Controller + router wiring**

Add controller exports `getMyRewards`, `listGiftCards`, `redeemGiftCard`. Mount routes in `router.ts`:
```typescript
mentorshipRouter.get('/rewards/me', requireRole('alumni'), getMyRewards)
mentorshipRouter.get('/gift-cards', listGiftCards)
mentorshipRouter.post('/redeem', requireRole('alumni'), validate(RedeemGiftCardSchema), redeemGiftCard)
```

- [ ] **Step 6: Update `users/schema.ts` + service**

Add `isOpenToMentorship: z.boolean().optional()` to `UpdateProfileSchema`. In `users/service.ts`, accept the field in the update and expose `mentorshipPoints` + `isOpenToMentorship` in the profile select + mapper.

Also update `packages/shared/src/types/UserProfile` (or equivalent) to include both new fields. Find existing field by grepping `isOpenToWork` in `packages/shared/src/`.

- [ ] **Step 7: Admin queue endpoints**

In `admin/router.ts` add:
```typescript
adminRouter.get('/mentorship/redemptions', requireRole('admin'), validateRequest({ query: AdminRedemptionListSchema }), listAdminRedemptions)
adminRouter.patch('/mentorship/redemptions/:id', requireRole('admin'), validate(AdminFulfillRedemptionSchema), updateAdminRedemption)
```

Schemas in `admin/schema.ts`:
```typescript
export const AdminRedemptionListSchema = z.object({
  status: z.enum(['pending', 'fulfilled', 'rejected']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

export const AdminFulfillRedemptionSchema = z.object({
  status: z.enum(['fulfilled', 'rejected']),
  codeText: z.string().trim().min(1).max(200).optional(),
  adminNote: z.string().trim().max(500).optional(),
}).refine((v) => v.status !== 'fulfilled' || (v.codeText && v.codeText.length > 0), {
  message: 'codeText is required when fulfilling',
})
```

Admin service:
```typescript
async listRedemptions(universityId: string, query) { /* join, filter, paginate */ }
async updateRedemption(adminUserId: string, universityId: string, id: string, input) {
  return db.transaction(async (trx) => {
    const row = await trx('mentor_redemptions')
      .where({ id, university_id: universityId })
      .forUpdate()
      .first()
    if (!row) throw notFound(…)
    if (row.status !== 'pending') throw badRequest('Redemption already processed', 'REDEMPTION_ALREADY_PROCESSED')

    if (input.status === 'rejected') {
      // refund
      await trx('profiles')
        .where({ user_id: row.user_id })
        .increment('mentorship_points', row.points_spent)
    }

    await trx('mentor_redemptions')
      .where({ id })
      .update({
        status: input.status,
        code_text: input.codeText ?? null,
        admin_note: input.adminNote ?? null,
        fulfilled_at: trx.fn.now(),
        fulfilled_by: adminUserId,
      })

    // emit to alumni
    getIo().to(`user:${row.user_id}`).emit('mentorship:redemption:updated', { redemptionId: id, status: input.status })
  })
}
```

- [ ] **Step 8: Verify backend**

```bash
npx pnpm --filter api typecheck
npx pnpm --filter api lint
npx pnpm --filter api test
```

---

## Task C: Frontend — refactor + new alumni features

**Files (refactor):**
- Create: `apps/web/src/features/mentorship/types.ts` ✅ done
- Create: `apps/web/src/features/mentorship/hooks/useToast.ts` ✅ done
- Create: `apps/web/src/features/mentorship/components/{StatusBadge,Skeletons,ToastContainer,RequestModal,AlumniCard,MyRequestRow,IncomingRequestCard,StudentView,AlumniView}.tsx`
- Create: `apps/web/src/features/mentorship/index.ts`

**Files (new features):**
- Create: `apps/web/src/features/mentorship/constants.ts`
- Create: `apps/web/src/features/mentorship/components/AlumniMentorToggle.tsx`
- Create: `apps/web/src/features/mentorship/components/RewardsPanel.tsx`
- Create: `apps/web/src/features/mentorship/components/GiftCardGrid.tsx`
- Create: `apps/web/src/features/mentorship/components/RedemptionModal.tsx`
- Create: `apps/web/src/features/mentorship/components/RedemptionHistoryList.tsx`
- Create: `apps/web/src/features/mentorship/hooks/{useMentorshipOptIn,useRewards,useGiftCards,useRedeemGiftCard}.ts`
- Modify: `apps/web/src/stores/authStore.ts` to include `isOpenToMentorship` + `mentorshipPoints` in the profile shape (sync with shared types).
- Modify: `apps/web/src/pages/MentorshipPage.tsx` → thin orchestrator.

- [ ] **Step 1: Update types & shared schema imports.** Add `isOpenToMentorship` and `mentorshipPoints` to `UserProfile` in `packages/shared`. Confirm auth store picks them up.

- [ ] **Step 2: Build constants.ts**

```typescript
export const POINTS_PER_SESSION = 10
export const POINTS_PER_USD = 100
export const cents = (n: number) => `$${(n / 100).toFixed(2)}`
```

- [ ] **Step 3: Build hooks**

`useMentorshipOptIn` → mutation on `PATCH /users/me/profile` with `{ isOpenToMentorship }`, optimistic update of authStore.
`useRewards` → `useQuery(['mentorship', 'rewards'], () => api.get('/mentorship/rewards/me'))`.
`useGiftCards` → `useQuery(['mentorship', 'gift-cards'], () => api.get('/mentorship/gift-cards'))`.
`useRedeemGiftCard` → mutation on `POST /mentorship/redeem`, invalidates rewards on success.

- [ ] **Step 4: Build components (per spec — see plan body for inline detail)**

`AlumniMentorToggle`: card with title, description, toggle. Uses existing toggle visual from current `AlumniView` lines 1062–1095.

`RewardsPanel`: composes `<PointsBalance>`, `<GiftCardGrid>`, `<RedemptionHistoryList>`.

`GiftCardGrid`: card grid; each card disabled when `balance < thresholdPoints` with copy "Need N more points". Click → `<RedemptionModal>` confirm → mutation.

`RedemptionHistoryList`: small list showing status pill, vendor, requested date, code (if fulfilled), admin note (if rejected).

- [ ] **Step 5: Rewire `AlumniView.tsx`**

Top of the file (always visible):
```tsx
<AlumniMentorToggle isOn={isOpenToMentorship} onChange={…} />
```

When `isOpenToMentorship === false`, return early after the toggle and a short helper text. No tabs.

When on, render a tab bar (Requests | Previous sessions | Rewards) and the relevant body. "Previous sessions" reuses `IncomingRequestCard` with `status: 'completed'` filter pinned.

- [ ] **Step 6: Slim `MentorshipPage.tsx`** to ~70 lines (role guard, header, dispatch to StudentView / AlumniView / faculty-message, mount ToastContainer).

- [ ] **Step 7: Verify**

```bash
npx pnpm typecheck && npx pnpm lint
npx pnpm --filter web test
```

Manual smoke:
- Alumni: opt-out → only toggle visible. Opt-in → tabs appear. Mark a request completed → +10 points. Redeem → balance drops, history row appears as pending.
- Admin: see pending queue. Fulfill with a code → alumni sees status flip to fulfilled with code revealed.
- Student: unchanged behavior (browse, send request, my requests).

---

## Out of Scope (Deferred)

- Admin UI for gift card CRUD (catalog managed via DB / future iteration).
- Email notification when a redemption is fulfilled (socket-only for now).
- Code inventory / auto-fulfillment.
- Promotional thresholds different from `value × 100`.

## Self-Review

- ✅ Backend covers schema, profile field, points trigger, rewards query, redeem (atomic), admin queue (with refund on reject).
- ✅ Frontend covers opt-in gating, three tabs, rewards UI, history.
- ✅ No raw `any` left in plan code (note in Task B Step 4 reminding to type properly).
- ✅ Migration numbers continue 030–033 (no gap).
- ⚠️ `getMyRewards`, `redeem`, admin updates all need integration tests under `apps/api/tests/routes/`. Listed in Task B Step 8 but not spelled out — keep the existing mentorship test file pattern.
