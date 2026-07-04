# Phase 4b — Learning frontend (/learn, streaks, badges) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend for the learning MVP — a `learning` feature bundle, `/learn` route with Learn nav entry, enroll flow, today's-unit card (Learn page + interleaved feed card), streak display, real ProfileBadges with one showcased badge beside the name, and achievement moments.

**Architecture:** New `apps/web/src/features/learning/` bundle (components/, hooks/, index.ts barrel) consuming the Phase 4a API (`/api/v1/learning`) via TanStack Query hooks; a lazy `/learn` page; small integrations into `LeftSidebar`, `FeedPage`, `ProfileHeader`, and the profile Badges tab (wiring the orphaned `BadgesPanel` stub). Achievement moments listen to the existing `badge:earned` socket event and reuse the global toast system + framer presets from `src/lib/motion.ts`.

**Tech Stack:** React 18, TanStack Query, Zustand (existing stores only), framer-motion presets, MSW for tests, Vitest + React Testing Library.

**Branch:** `feature/learning-ui` off `feature/learning-api` (4a, PR #22 — not yet merged; PR 4b targets `feature/learning-api` until #22 merges, then retarget to `main`).

## Global Constraints

- `pnpm` not on PATH — always `npx pnpm …`. Web tests: `npx pnpm --filter web test <file>`; before finishing any task: `npx pnpm typecheck && npx pnpm lint`.
- **Design system (non-negotiable):** no hardcoded hex — `var(--token)` only; borders `0.5px solid var(--border-*)`; no `box-shadow` (surface stacking only); buttons `border-radius: var(--r-pill)`; font weights 400/500 only; sentence case everywhere; text on coloured surfaces uses the matching light token. Showcased achievement badge uses the **amber reward family** (`--uc-amber*` tokens — check `apps/web/src/styles/tokens.css` for exact names before use).
- **Motion:** presets from `@/lib/motion` only (`popoverIn`, `modalIn`, `listStagger`, `listItem`, `DUR`, `EASE_OUT_EXPO`) — no inline transition objects; transform/opacity only; ≤300ms interactions; idle screens are still; every framer path respects `useReducedMotion`; CSS animations guarded by `@media (prefers-reduced-motion: reduce)`.
- **React conventions:** data fetching only in `hooks/` via TanStack Query (`useQuery` key `['learning', '<action>', {…}]`); components receive props, never call axios; `queryClient.invalidateQueries` only in mutation `onSuccess`; server state never in `useState`; pages are thin orchestrators; lazy pages via the `page()` helper in `src/router/index.tsx`.
- API client: `api` from `@/lib/axios`; responses are `{ data: T }` (so `.then(r => r.data.data)` — copy the style of `src/features/connections/hooks/useConnections.ts`).
- Two name slots, never more: RoleBadge (left, exists) + ONE showcased achievement badge (right, optional).
- Tests: RTL + user-event, behavior not implementation; HTTP mocked in `src/tests/msw/handlers.ts`. Pre-existing allowed failure: `ShuttleMap.test.tsx` only.
- Icons: `lucide-react` (already a dependency).
- TS strict, no `any`.
- Commit format `type(scope): description`.

## Backend API contract (Phase 4a — verify against `apps/api/src/modules/learning/service.ts` on this branch before coding; DB-row fields are snake_case, computed/badge fields camelCase)

Base `/api/v1/learning`:
- `GET /paths` → `LearningPath[]`: `{ id, title, description, category, difficulty, estimated_days, badge_name, badge_icon, unitCount, enrolledCount, myEnrollmentStatus: 'active'|'completed'|'abandoned'|null }`
- `GET /paths/:pathId` → `{ ...path, units: LearningUnit[], enrollment: { status, started_at, completed_at } | null }`; `LearningUnit`: `{ id, display_order, title, type: 'read'|'video'|'exercise'|'quiz', completed: boolean, content?: UnitContent, completion_rule?: { passScore?: number } }` (content only present when unlocked)
- `POST /paths/:pathId/enroll` / `POST /paths/:pathId/abandon`
- `GET /me/today` → `TodayEntry[]`: `{ pathId, unit: LearningUnit, completedToday: boolean }`
- `POST /units/:unitId/complete` body `{ score? }` → `{ completed: true, alreadyCompleted?: boolean, pathCompleted: boolean, streak: { currentStreak, longestStreak } }` — 400 locked/failed quiz, 429 daily pacing
- `GET /me/stats` → `{ currentStreak, longestStreak, lastActivityDate, freezesRemaining }`
- `GET /me/badges` / `GET /users/:userId/badges` → `UserBadge[]`: `{ id, name, description, iconUrl, category, points, rarity: 'common'|'rare'|'epic', isShowcased, awardedAt, skillPathId }`
- `PUT /me/badges/showcase` body `{ badgeId: string | null }`

Socket (server → `user:{id}` room): `badge:earned` payload `{ badge: { id, name, description, icon_url, points } }` (snake_case — worker emit).

Quiz `content` JSONB shape (seeded 087): `{ questions: [{ q: string, options: string[], answer: number }] }`. Score is computed client-side as `Math.round(100 * correct / questions.length)` and POSTed.

---

### Task 1: Learning types + query/mutation hooks + MSW handlers

**Files:**
- Create: `apps/web/src/features/learning/types.ts`
- Create: `apps/web/src/features/learning/hooks/useLearning.ts`
- Create: `apps/web/src/features/learning/index.ts` (barrel — export hooks + types; components added by later tasks)
- Modify: `apps/web/src/tests/msw/handlers.ts` (append learning handlers)
- Test: `apps/web/src/features/learning/hooks/useLearning.test.tsx`

**Interfaces:**
- Produces (all later tasks consume): types `LearningPath`, `LearningUnit`, `TodayEntry`, `LearningStats`, `UserBadge`, `CompleteUnitResult`; hooks `usePaths()`, `usePath(pathId)`, `useToday()`, `useLearningStats()`, `useMyBadges()`, `useUserBadges(userId)`, `useEnroll()`, `useAbandon()`, `useCompleteUnit()`, `useShowcaseBadge()`.

Step 1 — `types.ts` (mirror the API contract block above exactly; verify field names against the backend service first — if any name differs, the backend is the source of truth and the plan's contract block should be corrected in your report):

```ts
export interface LearningPath {
  id: string
  title: string
  description: string | null
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimated_days: number
  badge_name: string | null
  badge_icon: string | null
  unitCount: number
  enrolledCount: number
  myEnrollmentStatus: 'active' | 'completed' | 'abandoned' | null
}

export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
}

export interface LearningUnit {
  id: string
  display_order: number
  title: string
  type: 'read' | 'video' | 'exercise' | 'quiz'
  completed: boolean
  content?: { body?: string; questions?: QuizQuestion[] }
  completion_rule?: { passScore?: number }
}

export interface PathDetail extends Omit<LearningPath, 'myEnrollmentStatus'> {
  units: LearningUnit[]
  enrollment: { status: 'active' | 'completed' | 'abandoned' } | null
}

export interface TodayEntry {
  pathId: string
  unit: LearningUnit
  completedToday: boolean
}

export interface LearningStats {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string | null
  freezesRemaining: number
}

export interface UserBadge {
  id: string
  name: string
  description: string | null
  iconUrl: string | null
  category: 'path' | 'streak' | 'volume' | 'social'
  points: number
  rarity: 'common' | 'rare' | 'epic'
  isShowcased: boolean
  awardedAt: string
  skillPathId: string | null
}

export interface CompleteUnitResult {
  completed: boolean
  alreadyCompleted?: boolean
  pathCompleted: boolean
  streak: { currentStreak: number; longestStreak: number }
}
```

Step 2 — `hooks/useLearning.ts` (copy the connections hooks style exactly):

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type {
  CompleteUnitResult, LearningPath, LearningStats, PathDetail, TodayEntry, UserBadge,
} from '../types'

export function usePaths() {
  return useQuery({
    queryKey: ['learning', 'paths', {}],
    queryFn: () => api.get<{ data: LearningPath[] }>('/learning/paths').then((r) => r.data.data),
  })
}

export function usePath(pathId: string | null) {
  return useQuery({
    queryKey: ['learning', 'path', { pathId }],
    queryFn: () => api.get<{ data: PathDetail }>(`/learning/paths/${pathId}`).then((r) => r.data.data),
    enabled: !!pathId,
  })
}

export function useToday() {
  return useQuery({
    queryKey: ['learning', 'today', {}],
    queryFn: () => api.get<{ data: TodayEntry[] }>('/learning/me/today').then((r) => r.data.data),
  })
}

export function useLearningStats() {
  return useQuery({
    queryKey: ['learning', 'stats', {}],
    queryFn: () => api.get<{ data: LearningStats }>('/learning/me/stats').then((r) => r.data.data),
  })
}

export function useMyBadges() {
  return useQuery({
    queryKey: ['learning', 'badges', { mine: true }],
    queryFn: () => api.get<{ data: UserBadge[] }>('/learning/me/badges').then((r) => r.data.data),
  })
}

export function useUserBadges(userId: string) {
  return useQuery({
    queryKey: ['learning', 'badges', { userId }],
    queryFn: () => api.get<{ data: UserBadge[] }>(`/learning/users/${userId}/badges`).then((r) => r.data.data),
    enabled: !!userId,
  })
}

function useInvalidateLearning() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['learning'] })
}

export function useEnroll() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: (pathId: string) => api.post(`/learning/paths/${pathId}/enroll`),
    onSuccess: invalidate,
  })
}

export function useAbandon() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: (pathId: string) => api.post(`/learning/paths/${pathId}/abandon`),
    onSuccess: invalidate,
  })
}

export function useCompleteUnit() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: ({ unitId, score }: { unitId: string; score?: number }) =>
      api.post<{ data: CompleteUnitResult }>(`/learning/units/${unitId}/complete`, score === undefined ? {} : { score })
        .then((r) => r.data.data),
    onSuccess: invalidate,
  })
}

export function useShowcaseBadge() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: (badgeId: string | null) => api.put('/learning/me/badges/showcase', { badgeId }),
    onSuccess: invalidate,
  })
}
```

Step 3 — MSW: append handlers to `src/tests/msw/handlers.ts` for all ten endpoints returning small deterministic fixtures (export the fixtures — e.g. `learningFixtures` — so component tests can assert against them; follow the file's existing handler style and base-URL pattern).

Step 4 — Test `useLearning.test.tsx`: render hooks with a fresh `QueryClientProvider` wrapper; assert `usePaths` resolves the fixture list; `useCompleteUnit` posts score and invalidates (`useToday` refetches — assert via `qc.getQueryState(['learning','today',{}])?.isInvalidated` or a refetch spy); `useShowcaseBadge` sends `{ badgeId: null }`.

Steps 5–6 — RED first (hooks missing), then GREEN; `npx pnpm typecheck && npx pnpm lint`; commit `feat(web): learning types, query hooks and msw fixtures`.

---

### Task 2: /learn route, Learn nav entry, LearnPage shell

**Files:**
- Modify: `apps/web/src/router/paths.ts` (add `LEARN: '/learn'` after `MENTORSHIP`)
- Modify: `apps/web/src/router/index.tsx` (add `{ path: PATHS.LEARN, element: page(() => import('@/pages/LearnPage')) }` in the same protected block as `PATHS.MENTORSHIP`)
- Modify: `apps/web/src/components/LeftSidebar.tsx:225-232` (Community group: add `{ icon: GraduationCap, label: 'Learn', path: PATHS.LEARN }` after Mentorship; import `GraduationCap` from lucide-react)
- Create: `apps/web/src/pages/LearnPage.tsx`
- Test: `apps/web/src/pages/LearnPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 hooks.
- Produces: `LearnPage` renders three regions in order — streak header slot, "Today" section, "Paths" section — later tasks fill them with real components; this task renders data inline minimally.

LearnPage shell (thin orchestrator): fetch `useToday`, `usePaths`, `useLearningStats`; use the same page layout wrapper as MentorshipPage (check `apps/web/src/pages/MentorshipPage.tsx` and copy its FeedLayout/RightSidebar arrangement); page `<h1>` "Learn" (sentence case, weight 500); loading skeletons matching final layout; empty state (`EmptyState` component) when no paths exist.

Test: renders heading "Learn", fixture path titles from MSW, and today's-unit title. RED (page missing) → GREEN → typecheck/lint → commit `feat(web): /learn route, sidebar entry and page shell`.

---

### Task 3: StreakBanner component

**Files:**
- Create: `apps/web/src/features/learning/components/StreakBanner.tsx`
- Modify: `apps/web/src/pages/LearnPage.tsx` (mount at top)
- Modify: `apps/web/src/features/learning/index.ts`
- Test: `apps/web/src/features/learning/components/StreakBanner.test.tsx`

**Interfaces:**
- Produces: `StreakBanner({ stats }: { stats: LearningStats })`.

Behavior: a card (`--surface-card`, 0.5px border, radius `--r-lg` if defined — check tokens.css) with: Flame icon + `{currentStreak}-day streak` (weight 500); sub-line `Longest: {longestStreak} days · {freezesRemaining} freezes left this month` (`--text-secondary`); when `currentStreak === 0` show `Start your streak — complete one unit today` instead. Flame uses `--uc-orange` family when streak > 0, `--text-tertiary` when 0. No animation at rest (idle-calm rule).

Test: renders streak count; zero-state message; freeze count text. TDD RED→GREEN, typecheck/lint, commit `feat(web): streak banner on learn page`.

---

### Task 4: TodayCard + non-quiz completion flow

**Files:**
- Create: `apps/web/src/features/learning/components/TodayCard.tsx`
- Modify: `apps/web/src/pages/LearnPage.tsx` (render a TodayCard per `TodayEntry` in the Today section)
- Modify: `apps/web/src/features/learning/index.ts`
- Test: `apps/web/src/features/learning/components/TodayCard.test.tsx`

**Interfaces:**
- Consumes: `useCompleteUnit`, toast via `useToastStore.getState().show` / `useToastStore((s) => s.show)`.
- Produces: `TodayCard({ entry, pathTitle }: { entry: TodayEntry; pathTitle?: string })`; exported `onQuizStart?: (unit: LearningUnit) => void` prop consumed by Task 5.

Behavior:
- Card shows unit type icon (BookOpen read / Play video / PenLine exercise / HelpCircle quiz), unit title (500), path context line, and `~5-10 min` hint (`--text-secondary`).
- `completedToday` → check icon + `Done for today — come back tomorrow` state, no button.
- Otherwise for `read`/`video`/`exercise`: expandable content (`content.body` rendered as plain paragraphs) + primary pill button `Mark complete`. On success: toast `show({ message: 'Unit complete — streak: N days', type: 'success' })` where N = `result.streak.currentStreak`; if `result.pathCompleted`, additionally toast `Path complete! Badge on its way`. On 429 → toast `type: 'error'` with the API error message; on 400 same.
- For `quiz` type: button label `Start quiz`, calls `onQuizStart(unit)` (Task 5 wires it; until then the prop is optional and the button may no-op if absent).
- Button uses `:active` scale + disabled while pending (`mutation.isPending`).

Test (RTL + user-event, MSW): renders unit title; clicking `Mark complete` fires POST and shows streak toast (assert toast store state or rendered ToastHost); `completedToday` entry renders done-state without a button. TDD, typecheck/lint, commit `feat(web): today's unit card with completion flow`.

---

### Task 5: QuizModal

**Files:**
- Create: `apps/web/src/features/learning/components/QuizModal.tsx`
- Modify: `apps/web/src/pages/LearnPage.tsx` (own `quizUnit` state; pass `onQuizStart` to TodayCard; render QuizModal)
- Modify: `apps/web/src/features/learning/index.ts`
- Test: `apps/web/src/features/learning/components/QuizModal.test.tsx`

**Interfaces:**
- Consumes: shared `Modal` primitive (`@/components/Modal` — check its exact props in the file before use), `useCompleteUnit`, `LearningUnit`.
- Produces: `QuizModal({ unit, open, onClose }: { unit: LearningUnit | null; open: boolean; onClose: () => void })`.

Behavior: renders `unit.content.questions` as radio groups (one question per fieldset, options as labelled radios, sentence case); submit button disabled until every question answered; on submit compute `score = Math.round(100 * correct / questions.length)` and `useCompleteUnit().mutate({ unitId, score })`. Pass → success state inside the modal (`Score: X% — passed`, check icon, close button) + streak toast as in Task 4. Fail (400) → inline result `Score: X% — you need {passScore}%` with `Try again` resetting answers (no shake animation — inline validation via border-color only). 429 → toast error + close.

Test: answer all → submit posts computed score; failing response shows retry state. TDD, typecheck/lint, commit `feat(web): quiz modal with client-side scoring`.

---

### Task 6: Path catalog — PathCard + PathDetailModal + enroll/abandon

**Files:**
- Create: `apps/web/src/features/learning/components/PathCard.tsx`
- Create: `apps/web/src/features/learning/components/PathDetailModal.tsx`
- Modify: `apps/web/src/pages/LearnPage.tsx` (Paths section grid; selected-path state)
- Modify: `apps/web/src/features/learning/index.ts`
- Test: `apps/web/src/features/learning/components/PathCard.test.tsx`, `PathDetailModal.test.tsx`

**Interfaces:**
- Consumes: `usePath`, `useEnroll`, `useAbandon`, `Modal`, toast, `listStagger`/`listItem` presets for grid entrance (first load only).
- Produces: `PathCard({ path, onOpen }: { path: LearningPath; onOpen: (id: string) => void })`; `PathDetailModal({ pathId, open, onClose })`.

PathCard: title (500), description (2-line clamp, `--text-secondary`), meta row `{unitCount} units · ~{estimated_days} days · {difficulty}` (sentence case), badge icon + `badge_name` hint when present (amber family), status chip when `myEnrollmentStatus` is `active` (`In progress`) or `completed` (`Completed`). Whole card clickable → `onOpen(path.id)`.

PathDetailModal: fetches `usePath(pathId)`; ordered unit list with per-unit state — completed (check, `--uc-mint` family), next unlocked (highlighted border `--uc-indigo` family), locked (Lock icon, `--text-tertiary`); primary action by state: not enrolled → `Enroll` (useEnroll → success toast `Enrolled — your first unit is ready`); active → `Abandon path` as quiet secondary action with an undo-toast (`show({ message: 'Path abandoned', onUndo: () => enroll.mutate(pathId) })`); completed → `Completed` chip + badge line.

Tests: PathCard renders meta + fires onOpen; DetailModal enroll button posts and toasts; abandoned path shows undo toast. TDD, typecheck/lint, commit `feat(web): path catalog with enroll and abandon flows`.

---

### Task 7: Interleaved feed card

**Files:**
- Create: `apps/web/src/features/learning/components/LearnFeedCard.tsx`
- Modify: `apps/web/src/pages/FeedPage.tsx:125` area (interleave after the 3rd post)
- Modify: `apps/web/src/features/learning/index.ts`
- Test: `apps/web/src/features/learning/components/LearnFeedCard.test.tsx`

**Interfaces:**
- Consumes: `useToday`, `PATHS.LEARN`, `useViewTransitionNavigate` if that's what other feed links use (check `FeedPage.tsx` link style).

Behavior:
- `LearnFeedCard` renders nothing (`null`) unless `useToday()` has ≥1 entry with `completedToday === false`. It shows the first such entry: `Today's unit` kicker (`--text-secondary`, sentence case), unit title (500), path context, and a pill `Continue learning` linking to `/learn`. Dismiss ✕ (top-right, appears on hover like RightSidebar suggestions) hides it for the session (module-level `sessionStorage` key `uc:learn-card-dismissed` checked on render; set on dismiss).
- FeedPage integration: render `<LearnFeedCard />` between the 3rd and 4th `PostCard` (index 2 → after; when fewer than 3 posts, render after the last one). It must not affect the caught-up footer logic.
- The card self-contains its data fetching (exception to props-only rule is NOT taken: FeedPage stays thin because LearnFeedCard is the feature's own container component — mirror how RightSidebar widgets fetch their own data; confirm that precedent in `RightSidebar.tsx` and note it in the report).

Test: with MSW today-fixture (not completed) renders unit title + link; renders null when all `completedToday`; dismiss hides and persists via sessionStorage. TDD, typecheck/lint, commit `feat(web): interleaved learn card in the feed`.

---

### Task 8: ProfileBadges — real badges tab + showcased badge beside the name

**Files:**
- Modify: `apps/web/src/features/profile/components/BadgesPanel.tsx` (orphaned stub — wire it up; it currently renders only an EmptyState and is imported nowhere)
- Modify: `apps/web/src/features/profile/components/ProfileTabs.tsx` (add `'badges'` to `ProfileTab` union + tab def `{ label: 'Badges', value: 'badges' }`)
- Modify: the profile page/panel switcher that renders panels for the active tab (find where `ProfileTabs` is consumed — likely `apps/web/src/pages/ProfilePage.tsx` — and render `<BadgesPanel userId={user.id} isOwnProfile={isOwnProfile} />` for `'badges'`)
- Modify: `apps/web/src/features/profile/components/ProfileHeader.tsx:94-98` (name row: showcased badge right of the verified check)
- Create: `apps/web/src/features/learning/components/ShowcasedBadge.tsx`
- Test: `apps/web/src/features/profile/components/BadgesPanel.test.tsx`, `apps/web/src/features/learning/components/ShowcasedBadge.test.tsx`

**Interfaces:**
- Consumes: `useUserBadges`, `useMyBadges`, `useShowcaseBadge`.
- Produces: `ShowcasedBadge({ userId, size = 16 })` — self-fetching via `useUserBadges(userId)`, renders the badge with `isShowcased === true` as a 16px amber-family chip (icon char + tooltip-style `title` with badge name), or null when none. `BadgesPanel({ userId, isOwnProfile })`.

BadgesPanel behavior: grid of `UserBadge` chips — icon, name (500), rarity chip (`epic`/`rare`/`common` — epic uses amber `-bg`/`-l` pairing, rare indigo family, common neutral), earned date (`--text-secondary`). Own profile: each badge gets a `Showcase` pill (or `Showcased ✓` on the active one, clicking it clears via `mutate(null)`); swap uses `useShowcaseBadge`. Keep the existing `EmptyState` for zero badges. Preserve the existing two-slot rule: ProfileHeader adds `<ShowcasedBadge userId={user.id} />` immediately after the `BadgeCheck` verified span — never a second achievement badge anywhere in the name row.

Tests: BadgesPanel renders fixture badges with rarity labels; own profile showcase button PUTs badgeId; ShowcasedBadge renders only the showcased badge and null otherwise. TDD, typecheck/lint, commit `feat(web): profile badges tab and showcased badge in the name row`.

---

### Task 9: Achievement moments (badge:earned socket + milestone toasts)

**Files:**
- Create: `apps/web/src/features/learning/hooks/useAchievementSocket.ts`
- Modify: the authenticated layout that is always mounted (check where `ToastHost` / feed layout providers mount — likely `apps/web/src/components/FeedLayout.tsx` or the router's protected layout — mount the hook there once)
- Modify: `apps/web/src/features/learning/index.ts`
- Test: `apps/web/src/features/learning/hooks/useAchievementSocket.test.tsx`

**Interfaces:**
- Consumes: `socket` from `@/lib/socket` (subscribe/cleanup pattern copied from `apps/web/src/features/feed/hooks/useFeedSocket.ts`), toast store, query invalidation.

Behavior: on `badge:earned` → `useToastStore.getState().show({ message: `Badge earned: ${badge.name}`, type: 'success', durationMs: 6000 })` and invalidate `['learning', 'badges']` queries. (Payload is snake_case `icon_url` — type it locally.) No confetti/celebration overlay in this pass — the toast IS the achievement moment (idle-calm + ≤300ms rules; a richer moment can ride with phase 6). Streak milestones: in `TodayCard`/`QuizModal` success handling (already built), when `result.streak.currentStreak` ∈ {7, 30, 100} the toast message becomes `` `${n}-day streak — badge on its way` `` — implement as a tiny exported helper `streakToastMessage(n: number): string` in `useLearning.ts` used by both components (add unit assertions to the existing component tests).

Test: emit fake `badge:earned` on a mocked socket → toast store contains message + badges query invalidated; unsubscribes on unmount. TDD, typecheck/lint, commit `feat(web): achievement toasts for earned badges and streak milestones`.

---

### Task 10: Final verification + screenshots

**Files:**
- Modify: `scripts/screenshot.cjs` (add `learn` → `/learn` (auth) to ROUTES) and the screenshots table in `CLAUDE.md` (add the `learn` row)
- Screenshots: `screenshots/learn.png` (new), plus refresh `feed.png` and `profile.png` (feed card + name-row/badges changes)

Steps:
1. `npx pnpm typecheck && npx pnpm lint` — clean.
2. `npx pnpm --filter web test` — all green except the pre-existing `ShuttleMap.test.tsx` failure.
3. Start `npx pnpm --filter web dev`, run `node scripts/screenshot.cjs learn && node scripts/screenshot.cjs feed && node scripts/screenshot.cjs profile` (auth pages use `?dev-auth=1`; the learn page will render its empty/loading state without a backend — that is the expected capture, same convention as other API-backed pages; note what the capture shows in the report).
4. Commit `chore(web): learn page screenshots + screenshot route`.

---

## Post-plan (controller responsibilities, not a task)

- Fable whole-branch review → fix wave → push `feature/learning-ui`, PR targeting `feature/learning-api` (retarget to `main` if #22 merges first). PR body: note the two-slot name rule, the dismissable feed card, quiz scoring client-side (server enforces passScore), and that BadgesPanel was an orphaned stub now wired.
- Update `.superpowers/sdd/progress.md` per task and the memory note at the end.
