# Study groups 2.0 — design spec

**Date:** 2026-07-05
**Status:** Approved for Phase 6 implementation
**Scope:** Second independent Phase 6 slice from the design-refresh initiative: add group-scoped flashcard decks, shared notes, and spaced-repetition review to the existing Groups study surface.

---

## 1. Goal

Turn each group into a lightweight study workspace. Members should be able to create shared flashcard decks, review due cards with spaced repetition, and maintain shared notes without leaving the group context. This extends existing group study sessions and resources; it does not replace them.

## 2. Background

The master design-refresh spec defers study groups 2.0 to Phase 6 (§5.4 and §9): "Groups module gains flashcard decks + shared notes with spaced-repetition review." The same section says this work feeds the badge economy and requires its own design doc before planning.

Current implementation anchors:

- `apps/api/src/modules/groups/router.ts`, `controller.ts`, `service.ts`, and `schema.ts` already own group membership, resources, pinned text, rules, stats, and study sessions.
- `apps/web/src/features/groups/components/StudySessionsTab.tsx` already gives each group a study surface with creation and RSVP flows.
- `apps/web/src/features/groups/hooks/useGroupExtended.ts` already centralizes group-specific React Query hooks.
- `apps/web/src/features/learning/` and `apps/api/src/modules/learning/` already own learning stats, badges, and path/unit progress. Study groups should integrate with the badge economy through small extension points, not by moving group review into the learning path model.

## 3. Product Decision

Build study groups 2.0 as **group-owned collaborative study tools**:

- Flashcard decks belong to one group and one university.
- Any group member can view decks, create a deck, add cards, and review cards.
- Deck and card editing is limited to the deck creator or group owner/admin/moderator.
- Shared notes belong to one group and one university.
- Any group member can create notes; note editing/deletion is limited to the author or group owner/admin/moderator.
- Spaced-repetition progress is per user and per card, so one member's review schedule never changes another member's schedule.
- Badge integration emits non-blocking events for deck contribution and review completion. Badge awarding remains queued and deduplicated outside the HTTP request.

This is intentionally not a full LMS. There are no folders, rich text editors, attachments, AI card generation, import/export, public deck marketplace, or grading workflows in this phase.

## 4. Data Model

Add one migration after the current latest migration.

### 4.1 `group_flashcard_decks`

Columns:

- `id uuid primary key default uuid_generate_v4()`
- `group_id uuid not null references groups(id) on delete cascade`
- `university_id uuid not null references universities(id) on delete cascade`
- `created_by uuid references users(id) on delete set null`
- `title varchar(160) not null`
- `description text`
- `is_archived boolean not null default false`
- `card_count integer not null default 0 check (card_count >= 0)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `(group_id, is_archived, updated_at desc)`
- `(university_id, group_id)`

### 4.2 `group_flashcards`

Columns:

- `id uuid primary key default uuid_generate_v4()`
- `deck_id uuid not null references group_flashcard_decks(id) on delete cascade`
- `group_id uuid not null references groups(id) on delete cascade`
- `university_id uuid not null references universities(id) on delete cascade`
- `created_by uuid references users(id) on delete set null`
- `front text not null`
- `back text not null`
- `hint text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `(deck_id, created_at asc)`
- `(group_id, updated_at desc)`

Constraints:

- `front` and `back` are trimmed and limited by API validation to 2,000 characters each.
- `hint` is trimmed and limited by API validation to 500 characters.

### 4.3 `group_flashcard_reviews`

Columns:

- `card_id uuid not null references group_flashcards(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `group_id uuid not null references groups(id) on delete cascade`
- `university_id uuid not null references universities(id) on delete cascade`
- `ease_factor numeric(4,2) not null default 2.50`
- `interval_days integer not null default 0 check (interval_days >= 0)`
- `repetition_count integer not null default 0 check (repetition_count >= 0)`
- `due_at timestamptz not null default now()`
- `last_reviewed_at timestamptz`
- `last_rating varchar(10) check (last_rating in ('again','hard','good','easy'))`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- Primary key: `(card_id, user_id)`

Indexes:

- `(user_id, group_id, due_at asc)`
- `(group_id, due_at asc)`

### 4.4 `group_shared_notes`

Columns:

- `id uuid primary key default uuid_generate_v4()`
- `group_id uuid not null references groups(id) on delete cascade`
- `university_id uuid not null references universities(id) on delete cascade`
- `created_by uuid references users(id) on delete set null`
- `title varchar(160) not null`
- `body text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `(group_id, updated_at desc)`
- `(university_id, group_id)`

## 5. Spaced-Repetition Rules

Use a small deterministic scheduler, inspired by SM-2 but simplified for product clarity.

Ratings:

- `again`: reset repetition count to `0`, interval `0`, due in `10 minutes`, ease factor minus `0.20` with floor `1.30`.
- `hard`: keep at least one repetition, interval is `max(1, ceil(previous interval * 1.2))`, due in that many days, ease factor minus `0.15` with floor `1.30`.
- `good`: repetition count plus `1`; first success interval `1` day, second `3` days, later `ceil(previous interval * ease_factor)`.
- `easy`: repetition count plus `1`; first success interval `3` days, second `7` days, later `ceil(previous interval * (ease_factor + 0.3))`; ease factor plus `0.15` with max `3.00`.

The scheduler is implemented as a pure function in the groups module so it can be unit-tested without a database.

Review writes are idempotent at the row level: each rating upserts one `group_flashcard_reviews` row for the current user and card. The card must belong to a group the user can view.

## 6. API Endpoints

All routes stay under `/api/v1/groups`, require `requireAuth + resolveUniversity`, and use the existing router/controller/service/schema pattern.

### 6.1 Decks

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/:groupId/flashcard-decks` | group member | List active decks with `cardCount`, `dueCount`, `createdBy`, `updatedAt`. |
| `POST` | `/:groupId/flashcard-decks` | group member | Create deck with `title`, optional `description`. |
| `PATCH` | `/:groupId/flashcard-decks/:deckId` | deck creator or group admin/moderator/owner | Update title, description, or archive state. |
| `DELETE` | `/:groupId/flashcard-decks/:deckId` | deck creator or group admin/moderator/owner | Hard delete deck and cards. |

### 6.2 Cards

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/:groupId/flashcard-decks/:deckId/cards` | group member | List cards in created order. |
| `POST` | `/:groupId/flashcard-decks/:deckId/cards` | group member | Create a card and increment deck `card_count`. |
| `PATCH` | `/:groupId/flashcards/:cardId` | card creator, deck creator, or group admin/moderator/owner | Update front/back/hint. |
| `DELETE` | `/:groupId/flashcards/:cardId` | card creator, deck creator, or group admin/moderator/owner | Delete card and decrement deck `card_count`. |

### 6.3 Review

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/:groupId/flashcard-decks/:deckId/review` | group member | Return due cards first, then new cards with no review row. Limit defaults to `20`. |
| `POST` | `/:groupId/flashcards/:cardId/review` | group member | Body `{ rating: 'again' | 'hard' | 'good' | 'easy' }`. Upsert schedule row and return next schedule. |

### 6.4 Shared Notes

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/:groupId/shared-notes` | group member | List notes by `updated_at desc`. |
| `POST` | `/:groupId/shared-notes` | group member | Create note with title/body. |
| `PATCH` | `/:groupId/shared-notes/:noteId` | note author or group admin/moderator/owner | Update title/body. |
| `DELETE` | `/:groupId/shared-notes/:noteId` | note author or group admin/moderator/owner | Delete note. |

## 7. Frontend UX

Create a study workspace inside the group detail study area. The preferred UI is a segmented control above the existing study content:

- `Sessions`
- `Decks`
- `Notes`

`Sessions` keeps the existing study sessions flow.

### 7.1 Decks Surface

The decks view shows:

- A compact summary row: total decks, due cards, total cards.
- Deck rows with title, description, card count, due count, updated date, and a `Review` action.
- A `New deck` action that expands inline. Avoid a modal as the first thought.
- Empty state: "No decks yet" with one clear `New deck` action.
- Loading state: skeleton rows shaped like deck rows.
- Error state: concise message plus retry.

Deck rows should not be identical icon-card grids. Use a dense list layout with one card-like surface for the whole list and row dividers inside it.

### 7.2 Cards And Review

Within a selected deck:

- Show a header with deck title, due count, and actions.
- Card list has front/back previews and edit/delete affordances for allowed users.
- `Review` opens an inline review panel, not a blocking modal.
- The review panel shows one card at a time. The front is visible first; `Show answer` reveals the back and hint.
- Rating buttons are `Again`, `Hard`, `Good`, `Easy`.
- After rating, the next card appears with a concise schedule confirmation such as "Due tomorrow" or "Due in 10 minutes".
- When the queue is empty, show a closure state: "All reviewed for now" with next due time if available.

### 7.3 Notes Surface

Notes view:

- Shows note rows with title, author, updated date, and a short body preview.
- `New note` expands an inline editor.
- Editing a note is inline or in a drawer only if the body height becomes too large for the list. Prefer inline for this phase.
- Empty state: "No shared notes yet" with one `New note` action.

## 8. Visual And Interaction Standards

This feature is product-register UI under the Impeccable context:

- The interface serves the task; no decorative motion, gradients, glassmorphism, side-stripe accents, or nested cards.
- Use existing tokens only: `--surface-*`, `--border-*`, `--text-*`, `--uc-indigo-*`, `--uc-amber-*`, `--uc-mint`, and role/tenant tokens where their meaning applies.
- Buttons remain pill-shaped and sentence case.
- Font weights stay 400/500.
- Body copy uses `--text-secondary`; `--text-tertiary` is only for metadata.
- Structural borders are `0.5px solid var(--border-default)`.
- Keep interactive hit targets at least `44px` on touch surfaces and at least `40px` on dense desktop controls.
- Dynamic counts use `font-variant-numeric: tabular-nums`.
- Headings use balanced wrapping; note/deck descriptions use pretty wrapping.
- Transitions specify exact properties. Do not use `transition: all`.
- Motion is interruptible, 150 to 250ms for state changes, transform/opacity only, and guarded by existing reduced-motion behavior.

## 9. Permissions And Privacy

- Non-members cannot see decks, cards, reviews, or notes for private groups.
- Public groups still require membership for study tools. Viewing the group marketing shell is not enough to access decks.
- System auto-managed groups can use decks and notes. Their membership remains system-managed, but study content behaves like any other group.
- Creators retain edit/delete rights unless they leave. Group owner/admin/moderator can moderate all decks, cards, and notes.
- Deleted users are shown as "Former member" where author identity is missing.

## 10. Badge Economy Hook

This phase should emit lightweight badge queue events only after successful DB writes:

- `deck_contributed` when a member creates a deck or creates their first card in a deck.
- `flashcard_review_completed` when a member rates at least one card in a review session.

If the current badge worker cannot yet process these actions, add typed no-op support rather than blocking the feature. Badge awarding rules can be expanded in a later badge-focused task without changing the study groups API.

## 11. Error Handling

- Deck/card/note lookup failures return `404`.
- Permission failures return `403` with explicit copy, for example "Only group members can review this deck."
- Validation failures return `400`.
- Duplicate or stale update races should not crash. If a deck/card/note was deleted, return `404`.
- Capacity-style conflicts do not apply to decks or notes.

## 12. Testing And Verification

Backend:

- Scheduler unit tests for each rating and floor/cap behavior.
- Service tests or focused integration tests for member access, deck creation, card creation, review upsert, and notes CRUD.
- Typecheck for API and shared packages.

Frontend:

- Hook tests for deck/note/review query keys and invalidation.
- Component tests for deck empty state, review rating flow, all-reviewed state, notes create/edit visibility, and permission-sensitive actions.
- A Playwright scenario for a group member opening a group, creating or viewing a deck, revealing an answer, rating a card, and seeing the next-card or all-reviewed state.
- Browser check at mobile and desktop widths to confirm no text overlap, no nested cards, and all controls remain reachable.

Commands:

- `npx pnpm --filter api typecheck`
- `npx pnpm --filter web typecheck`
- `npx pnpm --filter web lint`
- `npx pnpm --filter web test`
- Relevant API tests.
- Relevant Playwright spec after implementation.

## 13. Out Of Scope

- AI-generated flashcards.
- Deck import/export.
- Public deck marketplace.
- Rich text editor or markdown preview for notes.
- Attachments on notes or cards.
- Graded assignments.
- Faculty-only deck approval workflow.
- Daily campus quiz and per-university leaderboard.
