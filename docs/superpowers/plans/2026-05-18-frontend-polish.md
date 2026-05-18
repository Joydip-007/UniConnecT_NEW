# Frontend Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply four design-audit recommendations: (1) extract `MentorshipPage` into a proper `features/mentorship/` folder, (2) pin a display font (Satoshi), (3) sanitize user-generated markdown in `PostCard`, (4) add Framer Motion to drawers/dropdowns/list reorders.

**Architecture:** Each task is independent. Refactor first (largest blast radius, no behavior change). Then font, markdown safety, motion. Use existing test suite + `npx pnpm typecheck && npx pnpm lint` as the safety net for refactor work where TDD doesn't fit. Add a real test for the sanitize task.

**Tech Stack:** React 18, Vite 5, TanStack Query, Tailwind 3, lucide-react, sonner. New deps: `framer-motion`, `rehype-sanitize`. Font via Fontshare CDN `@import` (Satoshi is free for commercial use; no package needed).

---

## Task 1: Extract `MentorshipPage` into `features/mentorship/`

**Files:**
- Create: `apps/web/src/features/mentorship/types.ts`
- Create: `apps/web/src/features/mentorship/hooks/useToast.ts`
- Create: `apps/web/src/features/mentorship/components/ToastContainer.tsx`
- Create: `apps/web/src/features/mentorship/components/StatusBadge.tsx`
- Create: `apps/web/src/features/mentorship/components/Skeletons.tsx`
- Create: `apps/web/src/features/mentorship/components/RequestModal.tsx`
- Create: `apps/web/src/features/mentorship/components/AlumniCard.tsx`
- Create: `apps/web/src/features/mentorship/components/MyRequestRow.tsx`
- Create: `apps/web/src/features/mentorship/components/IncomingRequestCard.tsx`
- Create: `apps/web/src/features/mentorship/components/StudentView.tsx`
- Create: `apps/web/src/features/mentorship/components/AlumniView.tsx`
- Create: `apps/web/src/features/mentorship/index.ts`
- Modify: `apps/web/src/pages/MentorshipPage.tsx` (becomes thin orchestrator — role gate + view selection)

**Decomposition rules:**
- One file per logical component. No further sub-splits (avoid premature abstraction).
- All API access stays inline within view files via existing `api` axios singleton. No new hooks files unless an API call is reused across views — none are.
- Toast utility goes into `hooks/useToast.ts` + `components/ToastContainer.tsx` since the page composes them together but they're conceptually separate.
- Types file holds `RequestStatus`, `AlumniMentor`, `MyRequest`, `IncomingRequest`, `PageResult<T>`. No exports renamed.
- Barrel exports only what `MentorshipPage` needs: `StudentView`, `AlumniView`, `ToastContainer`, `useToast`.

- [ ] **Step 1: Create `types.ts`**

```typescript
// apps/web/src/features/mentorship/types.ts
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'completed'

export interface AlumniMentor {
  id: string
  universityId: string
  fullName: string
  headline: string | null
  department: string | null
  batchYear: string | null
  skills: string[]
  avatarUrl: string | null
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

export interface MyRequest {
  id: string
  message: string
  status: RequestStatus
  sessionNotes: string | null
  createdAt: string
  alumni: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
}

export interface IncomingRequest {
  id: string
  message: string
  status: RequestStatus
  sessionNotes: string | null
  createdAt: string
  student: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
}

export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}
```

- [ ] **Step 2: Create `hooks/useToast.ts`**

Copy `useToast` from `MentorshipPage.tsx:85-95` verbatim, importing `ToastItem` from `../types`.

- [ ] **Step 3: Create `components/ToastContainer.tsx`**

Copy `ToastContainer` from `MentorshipPage.tsx:97-136` verbatim, importing `ToastItem` from `../types`.

- [ ] **Step 4: Create `components/StatusBadge.tsx`**

Copy `StatusBadge` from `MentorshipPage.tsx:140-161`, importing `RequestStatus` from `../types`.

- [ ] **Step 5: Create `components/Skeletons.tsx`**

Copy `AlumniCardSkeleton` (lines 636-680) and `RequestRowSkeleton` (lines 682-718). Export both as named exports.

- [ ] **Step 6: Create `components/RequestModal.tsx`**

Copy `RequestModal` from `MentorshipPage.tsx:163-294`. Imports: `useState`, `useMutation`, `Avatar`, `GhostBtn`, `PrimaryBtn`, `api`, `avatarColor`, `getInitials as initials`, and `AlumniMentor` from `../types`.

- [ ] **Step 7: Create `components/AlumniCard.tsx`**

Copy `AlumniCard` from `MentorshipPage.tsx:296-373`. Imports: `Avatar`, `Badge`, `GhostBtn`, `PrimaryBtn`, `avatarColor`, `getInitials as initials`, `AlumniMentor`.

- [ ] **Step 8: Create `components/MyRequestRow.tsx`**

Copy `MyRequestRow` and the `formatDate` helper from lines 67-76 + 375-466. Imports: `Avatar`, `avatarColor`, `getInitials as initials`, `MyRequest`, `StatusBadge`.

- [ ] **Step 9: Create `components/IncomingRequestCard.tsx`**

Copy `IncomingRequestCard` from `MentorshipPage.tsx:468-632` plus `formatDate`. Imports: `useState`, `useEffect`, `useQueryClient`, `CheckCircle`, `XCircle`, `Avatar`, `Badge`, `GhostBtn`, `MintBtn`, `api`, `avatarColor`, `getInitials as initials`, `IncomingRequest`, `RequestStatus`, `ToastItem`, `StatusBadge`.

- [ ] **Step 10: Create `components/StudentView.tsx`**

Copy `StudentView` from `MentorshipPage.tsx:722-905`. Imports include `EmptyState`, the new sub-components (`AlumniCard`, `MyRequestRow`, `RequestModal`, `AlumniCardSkeleton`, `RequestRowSkeleton`), types from `../types`, hooks/utils as before.

- [ ] **Step 11: Create `components/AlumniView.tsx`**

Copy `AlumniView` from `MentorshipPage.tsx:918-1182`. Imports include `IncomingRequestCard`, `RequestRowSkeleton`, types from `../types`, `socket`, etc.

- [ ] **Step 12: Create `index.ts` barrel**

```typescript
// apps/web/src/features/mentorship/index.ts
export { StudentView } from './components/StudentView'
export { AlumniView } from './components/AlumniView'
export { ToastContainer } from './components/ToastContainer'
export { useToast } from './hooks/useToast'
```

- [ ] **Step 13: Slim down `MentorshipPage.tsx`**

Replace the entire 1252-line file with a ~70-line orchestrator: role gate + view dispatch + page header + ToastContainer mount. Use the barrel imports from `@/features/mentorship`.

- [ ] **Step 14: Verify**

```bash
npx pnpm typecheck && npx pnpm lint
```
Expected: both pass with no diagnostics. If `pnpm web test` exists and is fast, also run it.

- [ ] **Step 15: Smoke check imports**

```bash
grep -rE "from '@/pages/MentorshipPage'" apps/web/src 2>/dev/null
grep -rE "MentorshipPage" apps/web/src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "pages/MentorshipPage\|router/router"
```
Expected: only the lazy-load in `router.tsx` references the page.

---

## Task 2: Pin Satoshi as display font

**Files:**
- Modify: `apps/web/src/styles/index.css` (top — add Fontshare `@import`)
- Modify: `apps/web/src/styles/tokens.css` (add `--font-display` and `--font-mono` tokens)

**Approach:** Fontshare CDN `@import` for Satoshi (weights 400, 500 only — matching design system's two-weight rule). No package dep, no build config changes.

- [ ] **Step 1: Add font import to `index.css`**

Add as the **very first** line (before the tokens import) so the font request fires early:

```css
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500&display=swap');
@import './tokens.css';
```

- [ ] **Step 2: Register tokens in `tokens.css`**

Add inside `:root` after the easing block:

```css
  /* ── Type stack ───────────────────────────────────── */
  --font-display: 'Satoshi', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono:    ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
```

- [ ] **Step 3: Apply globally in `index.css`**

Add immediately after the focus-indicator block:

```css
html, body {
  font-family: var(--font-display);
  font-feature-settings: 'ss01', 'cv11';
}

code, pre, kbd, samp {
  font-family: var(--font-mono);
}
```

- [ ] **Step 4: Verify**

```bash
npx pnpm typecheck && npx pnpm lint
```
Visual check: load `/` in dev server, confirm text renders in Satoshi (System fallback only on first paint if the CDN is slow).

---

## Task 3: Sanitize `ReactMarkdown` in `PostCard`

**Files:**
- Modify: `apps/web/package.json` (add `rehype-sanitize`)
- Modify: `apps/web/src/features/feed/components/PostCard.tsx` (pass `rehypePlugins`)
- Create: `apps/web/src/features/feed/components/PostCard.test.tsx` (verifies sanitization)

**Why:** `ReactMarkdown` doesn't render raw HTML by default, but it *does* allow `javascript:` URLs in markdown links and image sources. `rehype-sanitize` enforces an allow-list at the AST layer.

- [ ] **Step 1: Install `rehype-sanitize`**

```bash
npx pnpm --filter web add rehype-sanitize
```

- [ ] **Step 2: Write failing test**

```typescript
// apps/web/src/features/feed/components/PostCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PostCard } from './PostCard'
import type { FeedPost } from '@uniconnect/shared'

function makePost(content: string): FeedPost {
  return {
    id: 'p1',
    type: 'post',
    content,
    mediaUrls: [],
    isPinned: false,
    isSaved: false,
    myReaction: null,
    reactionCounts: { like: 0, love: 0, insightful: 0, celebrate: 0 },
    commentCount: 0,
    createdAt: new Date().toISOString(),
    author: {
      id: 'u1',
      fullName: 'Test User',
      role: 'student',
      profile: { headline: null, department: null, batchYear: null },
    },
    poll: null,
  } as unknown as FeedPost
}

function renderCard(post: FeedPost) {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PostCard post={post} onCommentClick={() => {}} onEditPost={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PostCard markdown sanitization', () => {
  it('strips javascript: links from markdown', () => {
    renderCard(makePost('[click](javascript:alert(1))'))
    const link = screen.queryByRole('link', { name: 'click' })
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
  })

  it('renders safe http links unchanged', () => {
    renderCard(makePost('[ok](https://example.com)'))
    const link = screen.getByRole('link', { name: 'ok' })
    expect(link.getAttribute('href')).toBe('https://example.com')
  })
})
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npx pnpm --filter web test src/features/feed/components/PostCard.test.tsx
```
Expected: the `javascript:` test fails (link href is `javascript:alert(1)`).

- [ ] **Step 4: Wire `rehype-sanitize` into the `ReactMarkdown` call in `PostCard.tsx`**

At the top of the file:
```typescript
import rehypeSanitize from 'rehype-sanitize'
```

Replace the existing `<ReactMarkdown>{post.content}</ReactMarkdown>` at line 368 with:
```typescript
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{post.content}</ReactMarkdown>
```

- [ ] **Step 5: Run test to confirm pass**

```bash
npx pnpm --filter web test src/features/feed/components/PostCard.test.tsx
```
Expected: both tests pass.

- [ ] **Step 6: Final verify**

```bash
npx pnpm typecheck && npx pnpm lint
```

---

## Task 4: Add Framer Motion for targeted UI

**Files:**
- Modify: `apps/web/package.json` (add `framer-motion`)
- Modify: `apps/web/src/features/notifications/components/NotificationDropdown.tsx` (entry + list reorder)
- Modify: `apps/web/src/components/TopNav.tsx` (profile dropdown entry)
- Modify: `apps/web/src/features/feed/components/CommentDrawer.tsx` (drawer slide-in via Motion instead of CSS class)
- Modify: `apps/web/src/features/feed/components/PostCard.tsx` (ThreeDotMenu entry)

**Approach:** Replace the existing `.dropdown-enter` CSS animation usages with Framer Motion `motion.div` so we get spring physics + AnimatePresence-driven exit animations. Keep CSS animation as fallback for components not touched. Respect `prefers-reduced-motion` via the existing global CSS override (Framer Motion auto-respects it as of v11).

**Spring config (reused everywhere):** `{ type: 'spring', stiffness: 360, damping: 30, mass: 0.7 }` for dropdowns; `{ type: 'spring', stiffness: 220, damping: 28 }` for the drawer.

- [ ] **Step 1: Install `framer-motion`**

```bash
npx pnpm --filter web add framer-motion
```

- [ ] **Step 2: Update `NotificationDropdown.tsx`**

Imports add:
```typescript
import { motion, AnimatePresence } from 'framer-motion'
```

Wrap the outer `<div className="dropdown-enter" …>` (lines 147–258) — change it to `motion.div`, remove the `dropdown-enter` class, remove `data-origin`, and add motion props:

```typescript
<motion.div
  initial={{ opacity: 0, scale: 0.96, y: -4 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.96, y: -4 }}
  transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.7 }}
  style={{ ...existingStyle, transformOrigin: 'top right' }}
>
```

Wrap the notification list in `<AnimatePresence initial={false}>` and convert each `<NotificationRow>` outer element to `motion.button` with `layout` prop so reorders animate. Each row gets:
```typescript
layout
initial={{ opacity: 0, x: 8 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -8 }}
transition={{ type: 'spring', stiffness: 380, damping: 32 }}
```

- [ ] **Step 3: Update `TopNav.tsx` profile dropdown**

Wrap the profile menu (`<div role="menu" className="dropdown-enter" …>` at lines 300–356) in the same `motion.div` pattern as Step 2. Replace the `dropdown-enter` class. Wrap the `{menuOpen && …}` block in `<AnimatePresence>` so the menu can animate on close.

Same treatment for the notification panel mount: wrap `{notifOpen && <NotificationDropdown … />}` in `<AnimatePresence>` so close has an exit animation. The `<NotificationDropdown>` itself already emits exit transition from Step 2.

- [ ] **Step 4: Update `CommentDrawer.tsx`**

Replace the existing slide-in (mounting + `useEffect` + `visible` state + inline transition) with `motion.div`:

- Remove `visible` state and the `useEffect` that sets it.
- Backdrop becomes `motion.div` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}`.
- Drawer panel becomes `motion.div` with `initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 220, damping: 28 }}`.

The drawer is mounted by the parent (`FeedPage`); we need exit animations, so wrap the *parent's* drawer mount in `<AnimatePresence>`. Check `FeedPage.tsx` and adjust — if `<CommentDrawer>` is `post ? <CommentDrawer …/> : null`, change to:

```typescript
<AnimatePresence>
  {drawerPost && <CommentDrawer post={drawerPost} onClose={…} />}
</AnimatePresence>
```

- [ ] **Step 5: Update `PostCard.tsx` ThreeDotMenu**

Wrap the `{open && …}` dropdown in `<AnimatePresence>` and convert the inner `<div className="dropdown-enter">` to `motion.div` with the dropdown spring (Step 2 config).

- [ ] **Step 6: Verify**

```bash
npx pnpm typecheck && npx pnpm lint
```

Visual check in dev server:
- Open notification dropdown → springs in. Mark all read → rows fade. Close → springs out.
- Open profile menu → springs in. Click outside → springs out.
- Click a post comment button → drawer slides in from right with spring; click backdrop → slides out cleanly.
- Click the post `…` menu → small spring entry; close → exit animation.

- [ ] **Step 7: Confirm reduced-motion still works**

In Chrome DevTools, toggle "Emulate CSS prefers-reduced-motion: reduce". Re-open dropdowns — Framer Motion's built-in reduced-motion handling should disable spring durations. If not, set `MotionConfig` reducedMotion="user" in the app root.

---

## Out of Scope (Deferred)

- `LostFoundPage` and `ShuttlePage` feature-folder extraction. Apply the Task 1 pattern after this plan ships.
- CLAUDE.md correction (admin module gate wording). Trivial; fold into one of the above commits.
- Migration of remaining inline-style components to Tailwind. Going-forward guideline only.

## Self-Review Pass

- ✅ Task 1 covers MentorshipPage decomposition end-to-end with explicit line ranges and import lists.
- ✅ Task 2 covers font import, token registration, and global application.
- ✅ Task 3 includes failing test → install → wire → passing test sequence.
- ✅ Task 4 covers 5 specific files with explicit spring configs and AnimatePresence parent placements.
- ✅ No placeholders (TBD, "implement later") found.
- ✅ Type/method names consistent across tasks (StudentView, AlumniView, ToastContainer, useToast).
- ⚠️ Task 1 has no test gate (refactor only). Mitigated by typecheck + lint + manual smoke. Acceptable given the no-behavior-change scope.
