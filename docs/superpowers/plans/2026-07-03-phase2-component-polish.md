# Design Refresh Phase 2 — Component Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the Phase 1 primitives across the app (modal migrations, toast migration, z-index tokens), and land the modern interaction layer: frosted hide/reveal TopNav with ⌘K search, sliding sidebar nav indicator, standardized popover motion, View Transitions, dismissable suggestions with undo, and the feed "caught up" state.

**Architecture:** Pure frontend (`apps/web`). All motion imports come from `@/lib/motion`; all overlays use the shared `Modal`/`Drawer`; toasts use `useToastStore`. New hooks live in `src/hooks/`. No API or DB changes.

**Tech Stack:** React 18, TypeScript strict, framer-motion, Zustand, TanStack Query, Vitest + RTL, View Transitions API (progressive enhancement).

## Global Constraints

- Colors via `var(--token)` only; borders `0.5px solid var(--border-*)`; no `box-shadow`; pill buttons; weights 400/500; sentence case.
- Animations transform/opacity only; ≤300ms interactions (≤400ms route transitions); `prefers-reduced-motion` (CSS) / `useReducedMotion` (framer) respected in every new animation.
- Idle-state calm: nothing animates at rest — motion only on user action or state change.
- Durations/easings from tokens or `@/lib/motion` (`DUR`, `EASE_OUT_EXPO`, `EASE_DRAWER`, `popoverIn`, `modalIn`, `drawerIn`, `overlayIn`, `listStagger`, `listItem`) — no inline magic transition values.
- TypeScript strict, no `any`; named exports; `@/` alias; inline styles per project convention.
- Every task ends with `npx pnpm typecheck && npx pnpm lint` green (run from repo root; `pnpm` is not on PATH — always `npx pnpm …`).
- Commit format `type(scope): description`.
- Shared `Modal` contract: `{ isOpen, onClose, title, children, maxWidth?, triggerRef? }` — provides portal, blur backdrop, focus trap, Escape, scroll lock, focus return, ✕ button + title header. Shared `Drawer`: `{ isOpen, onClose, title, children, height? }`.
- Toast contract: `useToastStore.getState().show({ message, type?, onUndo?, durationMs? })`.

---

### Task 1: Migrate legacy z-index values to tokens

**Files:**
- Modify: `apps/web/src/features/mentorship/components/ToastContainer.tsx` (zIndex 9999)
- Modify: `apps/web/src/components/GlobalCurtain.tsx` (zIndex 9997)
- Modify: `apps/web/src/components/MobileBottomNav.tsx` (zIndex 200 — collides with `--z-modal`)
- Modify: `apps/web/src/styles/tokens.css` (documentation comment only)

**Interfaces:**
- Consumes: `--z-nav` (50), `--z-popover` (100), `--z-modal` (200), `--z-toast` (300), `--z-banner` (400) from Phase 1.

- [ ] **Step 1:** Grep the full inventory first: `grep -rn "zIndex" apps/web/src --include="*.tsx" | grep -v "var(--z-"`. For each hit, map to a token: nav bars → `'var(--z-nav)'`; dropdown/popover panels → `'var(--z-popover)'`; full-screen curtains → `'var(--z-banner)'`; toasts → `'var(--z-toast)'`. `MobileBottomNav` gets `'var(--z-nav)'` (it must sit under modals). `GlobalCurtain` gets `'var(--z-banner)'`. Mentorship `ToastContainer` gets `'var(--z-toast)'` (it is deleted in Task 2, but this keeps Task 1 independently correct). Leaflet map internals (ShuttleMap pane/control z-indexes, if any) are exempt — Leaflet owns its own 200–700 scale.
- [ ] **Step 2:** In `tokens.css`, extend the z-index block comment: `/* Leaflet map panes use their own 200–700 scale internally — never place a token-stacked element inside the map container. */`
- [ ] **Step 3:** Verify: re-run the grep — remaining numeric zIndex values must be inside Leaflet-scoped code or `zIndex: 1` local stacking (fine within a positioned card); list survivors in the commit body.
- [ ] **Step 4:** Run: `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 5:** Commit: `refactor(web): migrate hardcoded z-index values to tokens`

---

### Task 2: Migrate mentorship toasts to the global toast system

**Files:**
- Modify: all consumers of `useToast` / `ToastContainer` under `apps/web/src/features/mentorship/` (find with `grep -rn "useToast\|ToastContainer" apps/web/src`)
- Delete: `apps/web/src/features/mentorship/components/ToastContainer.tsx`, `apps/web/src/features/mentorship/hooks/useToast.ts`
- Modify: `apps/web/src/features/mentorship/types.ts` (remove `ToastItem` if now unused)

**Interfaces:**
- Consumes: `useToastStore` from `@/stores/toastStore` — `show({ message, type })` where mentorship's old types map `'success' | 'error'` directly.

- [ ] **Step 1:** For each call site, replace `const { toasts, addToast } = useToast()` + `<ToastContainer toasts={toasts} />` with `const show = useToastStore((s) => s.show)` and `addToast(msg, type)` → `show({ message: msg, type })`. Remove the `<ToastContainer …/>` JSX (ToastHost is already mounted globally in FeedLayout).
- [ ] **Step 2:** Delete the two dead files; remove `ToastItem` from mentorship types if nothing else imports it.
- [ ] **Step 3:** Run: `npx pnpm --filter web test src/features/mentorship` (if test files exist) and `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 4:** Commit: `refactor(mentorship): adopt global toast system, delete local ToastContainer`

---

### Task 3: Drawer focus trap + initial focus (parity with Modal)

**Files:**
- Modify: `apps/web/src/components/Drawer.tsx`
- Test: `apps/web/src/components/Drawer.test.tsx`

**Interfaces:**
- Produces: unchanged props; new behavior — Tab trapped inside the panel (including the idx === -1 outside-focus case, same logic as `Modal.tsx`), first focusable focused on open, focus behavior test-covered.

- [ ] **Step 1: Write the failing tests** (append to `Drawer.test.tsx`):

```tsx
it('traps Tab focus inside the panel', async () => {
  render(
    <Drawer isOpen onClose={vi.fn()} title="Comments">
      <button>First</button>
      <button>Second</button>
    </Drawer>,
  )
  const second = screen.getByText('Second')
  second.focus()
  await userEvent.tab()
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
})

it('pulls focus into the panel when focus is outside', async () => {
  render(
    <Drawer isOpen onClose={vi.fn()} title="Comments">
      <button>Only</button>
    </Drawer>,
  )
  ;(document.activeElement as HTMLElement | null)?.blur()
  await userEvent.tab()
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
})
```

- [ ] **Step 2:** Run: `npx pnpm --filter web test src/components/Drawer.test.tsx` → new tests FAIL (focus escapes).
- [ ] **Step 3:** Port the focus-trap keydown logic and initial-focus effect from `Modal.tsx` into `Drawer.tsx` verbatim (reintroduce `panelRef` on the panel div; same `FOCUSABLE` selector; same idx === -1 boundary handling; focus first focusable on open). Do not add focus-return-to-trigger (Drawer has no `triggerRef` prop — out of scope).
- [ ] **Step 4:** Run: `npx pnpm --filter web test src/components/Drawer.test.tsx` → all PASS; `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 5:** Commit: `feat(web): add focus trap and initial focus to Drawer`

---

### Task 4: Migrate groups + profile modals to shared Modal

**Files:**
- Modify: `apps/web/src/features/groups/components/CreateGroupModal.tsx`, `InviteMemberModal.tsx`
- Modify: `apps/web/src/features/profile/components/EditProfileModal.tsx`, `ExperienceModal.tsx`, `EducationModal.tsx`, `FeaturedModal.tsx`

**Interfaces:**
- Consumes: `Modal` from `@/components/Modal`.
- Produces: unchanged public props on every migrated component.

Migration recipe (apply to each file):
1. Import `{ Modal }` from `@/components/Modal`.
2. Replace the hand-rolled fixed overlay div + panel div with `<Modal isOpen={…} onClose={…} title="…" maxWidth={…}>` wrapping only the form/content JSX. Choose `title` from the modal's existing heading text (sentence case); pass the existing width if the old panel set one, else omit.
3. Delete now-duplicated code: Escape key handlers, focus traps, focus-return effects, scroll-lock effects, overlay click-to-close handlers, the panel's own close (✕) button and `<h2>` heading (Modal renders both).
4. Keep all content behavior: form state, validation, submit/pending logic, any reset-on-open effects, autofocus effects for fields.
5. If the old component early-returned `null` when closed, keep that OR pass `isOpen` through — but never both wrap in Modal *and* early-return before it in a way that skips exit animation; prefer passing `isOpen` to Modal.

- [ ] **Step 1:** Migrate the two groups modals per the recipe.
- [ ] **Step 2:** Migrate the four profile modals per the recipe.
- [ ] **Step 3:** Run: `npx pnpm --filter web test src/features/groups src/features/profile` (update any selectors that queried old overlay markup to `getByRole('dialog')`); `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 4:** Commit: `refactor(web): migrate groups and profile modals to shared Modal`

---

### Task 5: Migrate remaining feature modals to shared Modal

**Files:**
- Modify: `apps/web/src/features/jobs/components/ApplyModal.tsx`, `apps/web/src/features/moderation/components/ReportModal.tsx`, `apps/web/src/features/lost-found/components/PostItemModal.tsx`, `apps/web/src/features/messages/components/NewConversationModal.tsx`, `apps/web/src/features/mentorship/components/RequestModal.tsx`, `RedemptionModal.tsx`, `apps/web/src/features/feed/components/SharePostModal.tsx`

**Interfaces:** same recipe and constraints as Task 4 (recipe repeated there in full — read Task 4's five recipe points and apply identically).

- [ ] **Step 1:** Migrate all seven modals using the five-point recipe from Task 4: import shared Modal; wrap content; delete duplicated Escape/trap/scroll-lock/overlay/✕/heading code; preserve all form and submit behavior; pass `isOpen` to Modal rather than early-returning.
- [ ] **Step 2:** If any component is not actually a centered modal (e.g. renders inline or as a dropdown), leave it and note the exception in the report.
- [ ] **Step 3:** Run: `npx pnpm --filter web test src/features` (update selectors to `getByRole('dialog')` where needed); `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 4:** Commit: `refactor(web): migrate remaining feature modals to shared Modal`

---

### Task 6: Small deferred fixes (overlay token, wrapper div, overflow-wrap)

**Files:**
- Modify: `apps/web/src/features/feed/components/MediaGrid.tsx` (`rgba(0,0,0,0.55)` overlay → `'var(--overlay-media)'`)
- Modify: `apps/web/src/features/connections/components/ConnectionRequestModal.tsx` (remove the redundant outer `<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>` inside Modal — move the gap to the elements' own margins or keep a single fragment; simplest: keep the div only if removing it breaks spacing, and if kept, justify in report)
- Modify: post body text components in `apps/web/src/features/feed/components/` (find the post-content renderer, e.g. PostCard body / post detail body) — add `overflowWrap: 'anywhere'` to the text container style so long unbroken strings/URLs cannot overflow the card.

- [ ] **Step 1:** Make the three changes. For the post body: `grep -rn "content" apps/web/src/features/feed/components/PostCard.tsx` to locate the body text element; apply the style to the element that renders user-authored text (post card and post detail if separate).
- [ ] **Step 2:** Run: `npx pnpm --filter web test src/features/feed` and `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 3:** Commit: `fix(web): themed media overlay, overflow-wrap on post bodies, modal tidy-up`

---

### Task 7: Standardize popover motion (NotificationDropdown, MessagesPopup, SearchPanel)

**Files:**
- Modify: `apps/web/src/features/notifications/components/NotificationDropdown.tsx` (path via `grep -rl "NotificationDropdown" apps/web/src/features/notifications`)
- Modify: `apps/web/src/features/messages/components/MessagesPopup.tsx`
- Modify: `apps/web/src/features/search/components/SearchPanel.tsx` (path via barrel)
- Modify: `apps/web/src/components/TopNav.tsx` (profile menu: replace its inline transition object with the shared preset)

**Interfaces:**
- Consumes: `popoverIn`, `listStagger`, `listItem`, `DUR` from `@/lib/motion`; `useReducedMotion` from framer-motion.

- [ ] **Step 1:** In each of the four popovers, replace bespoke `initial/animate/exit/transition` props (or unanimated mounts) with the shared preset:

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import { popoverIn } from '@/lib/motion'
// on the panel root:
const reduced = useReducedMotion()
<motion.div
  initial={reduced ? false : popoverIn.initial}
  animate={popoverIn.animate}
  exit={reduced ? undefined : popoverIn.exit}
  transition={popoverIn.transition}
  style={{ transformOrigin: 'top right', /* existing styles */ }}
>
```

(Keep each panel's existing `transformOrigin`; SearchPanel anchors top-center — use `'top center'`.) Panels not currently wrapped in `AnimatePresence` at their call site: wrap the conditional render in `AnimatePresence` (TopNav already does this for its three).
- [ ] **Step 2:** NotificationDropdown list: wrap the items container in a `motion.div` with `variants={listStagger(20)} initial="initial" animate="animate"` and each row in `motion.div variants={listItem}` — first open only (variants run on mount, which is exactly open). Skip when `useReducedMotion()`.
- [ ] **Step 3:** SearchPanel: add `layout` to the panel's motion.div so height changes between result sets animate; ensure `transition={popoverIn.transition}` covers layout.
- [ ] **Step 4:** Run: `npx pnpm --filter web test src/features/notifications src/features/search src/features/messages` (existing tests only) and `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 5:** Commit: `refactor(web): standardize popover motion on shared presets`

---

### Task 8: `useScrollDirection` hook + TopNav frost and hide/reveal

**Files:**
- Create: `apps/web/src/hooks/useScrollDirection.ts`
- Test: `apps/web/src/hooks/useScrollDirection.test.ts`
- Modify: `apps/web/src/components/TopNav.tsx`
- Modify: `apps/web/src/styles/index.css` (`.topnav-shell` additions)

**Interfaces:**
- Produces: `useScrollDirection(threshold?: number): 'up' | 'down'` — returns `'down'` only after scrolling down past `threshold` px from top (default 64); returns `'up'` at page top always.

- [ ] **Step 1: Write the failing test** — `useScrollDirection.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useScrollDirection } from './useScrollDirection'

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

describe('useScrollDirection', () => {
  it('starts as up and stays up near the top', () => {
    const { result } = renderHook(() => useScrollDirection())
    act(() => scrollTo(30))
    expect(result.current).toBe('up')
  })

  it('reports down after scrolling down past threshold, up after scrolling up', () => {
    const { result } = renderHook(() => useScrollDirection())
    act(() => scrollTo(200))
    expect(result.current).toBe('down')
    act(() => scrollTo(120))
    expect(result.current).toBe('up')
  })
})
```

- [ ] **Step 2:** Run: `npx pnpm --filter web test src/hooks/useScrollDirection.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** — `useScrollDirection.ts`:

```ts
import { useEffect, useRef, useState } from 'react'

/** 'down' once the user scrolls down past `threshold`; 'up' on any upward
    scroll or near the page top. Drives the TopNav hide/reveal. */
export function useScrollDirection(threshold = 64): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const lastY = useRef(0)

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      if (y <= threshold) {
        setDirection('up')
      } else if (y > lastY.current) {
        setDirection('down')
      } else if (y < lastY.current) {
        setDirection('up')
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return direction
}
```

- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** TopNav integration: in `TopNav.tsx`, `const scrollDir = useScrollDirection()`; on the `<header>` add `data-hidden={scrollDir === 'down' || undefined}` and change inline styles: `background: 'var(--overlay-bg-strong)'` → replace existing `background: 'var(--surface-card)'`, add `backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'`, and `zIndex: 'var(--z-nav)'` (replacing the literal 50). Do NOT hide the header while any of `menuOpen || notifOpen || msgOpen || panelOpen` is true — compute `const hidden = scrollDir === 'down' && !menuOpen && !notifOpen && !msgOpen && !panelOpen`.
- [ ] **Step 6:** In `index.css`, add:

```css
.topnav-shell {
  transition: transform var(--dur-slow) var(--ease-drawer);
}
.topnav-shell[data-hidden] {
  transform: translateY(-100%);
}
@media (prefers-reduced-motion: reduce) {
  .topnav-shell { transition: none; }
}
```

Note: the sidebars are `sticky; top: 78px` — hiding the bar leaves that offset; acceptable (content doesn't reflow). Do not change sidebar offsets in this task.
- [ ] **Step 7:** Run: `npx pnpm typecheck && npx pnpm lint` → pass; manual check if dev server available (scroll feed down → bar slides away; scroll up → returns; open notifications → bar never hides).
- [ ] **Step 8:** Commit: `feat(web): frosted TopNav with scroll hide/reveal`

---

### Task 9: Search expand-on-focus + ⌘K shortcut

**Files:**
- Modify: `apps/web/src/components/TopNav.tsx`
- Modify: `apps/web/src/styles/index.css`

**Interfaces:**
- Consumes: existing `topnav-search-input` / `topnav-search-wrap` classes; `--dur-med` token.

- [ ] **Step 1:** CSS (index.css): give the wrapper a width transition —

```css
.topnav-search-wrap {
  transition: max-width var(--dur-med) var(--ease-out-strong);
}
.topnav-search-wrap:focus-within {
  max-width: 520px !important;
}
@media (prefers-reduced-motion: reduce) {
  .topnav-search-wrap { transition: none; }
}
```

(The `!important` overrides the inline `maxWidth: 400`; alternatively move maxWidth from inline style to the class — prefer moving it: delete `maxWidth: 400` from the inline style and set `max-width: 400px` in `.topnav-search-wrap`, then drop the `!important`.)
- [ ] **Step 2:** ⌘K: in TopNav add a global keydown listener effect —

```tsx
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      searchInputRef.current?.focus()
    }
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [])
```

Add `const searchInputRef = useRef<HTMLInputElement>(null)` and `ref={searchInputRef}` on the input.
- [ ] **Step 3:** Shortcut chip inside the search field (right edge, hidden on compact/mobile): a `<kbd>` styled span, absolutely positioned right 10px, vertically centered, showing `⌘K` when `navigator.platform` includes 'Mac' else `Ctrl K`: fontSize 10, weight 400 (kbd values are not UI labels — keep glyph form), color `var(--text-tertiary)`, border `0.5px solid var(--border-default)`, borderRadius `var(--r-sm)`, padding `1px 5px`, background `var(--surface-card)`, `pointerEvents: 'none'`. Hide it while the input has value or focus (`searchQuery.length > 0 || inputFocused` — track focus with existing onFocus/onBlur or `:focus-within` CSS by toggling a class). Also adjust input right padding to 44px so text doesn't underlap the chip.
- [ ] **Step 4:** Run: `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 5:** Commit: `feat(web): search expand-on-focus with command-K shortcut`

---

### Task 10: TopNav feedback details — badge pop, theme icon, reconnect banner

**Files:**
- Modify: `apps/web/src/components/TopNav.tsx`
- Modify: `apps/web/src/components/FeedLayout.tsx`

**Interfaces:**
- Consumes: `uc-reaction-pop` keyframes (tokens.css), `DUR`/`EASE_OUT_EXPO` from `@/lib/motion`, `useSocketStore` state already read in FeedLayout.

- [ ] **Step 1: Badge pop.** In TopNav's `BadgeCount`, re-trigger the pop when count changes: `<span key={count} style={{ ...badgeStyle, animation: 'uc-reaction-pop 320ms var(--ease-out-strong)' }} …>` — the changing `key` remounts the span, restarting the animation. Wrap in reduced-motion guard: `const reduced = useReducedMotion()` in TopNav, pass `animate={!reduced}` prop to `BadgeCount` and only set `animation` when true.
- [ ] **Step 2: Theme icon rotate.** In the profile menu theme section, wrap each option's `<Icon size={14} />` in a span with `display: inline-flex; transition: transform var(--dur-med) var(--ease-out-strong)` and `transform: checked ? 'rotate(0deg) scale(1)' : 'rotate(-30deg) scale(0.92)'` — the selected option's icon settles upright; switching animates. (CSS transition — automatically inert under the global reduced-motion CSS if added; add the reduced-motion guard in the same style: skip transition when `reduced`.)
- [ ] **Step 3: Reconnect banner.** In `FeedLayout.tsx`, replace the static banner with an `AnimatePresence` block: while `hasConnected && !connected`, show the existing "Reconnecting…" banner as a `motion.div` sliding in (`initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}`). Add a brief success flash: keep local state `justReconnected` set true for 1500ms (setTimeout, cleared on unmount) when `connected` transitions false→true (track previous value with a ref); while true, render the same banner shape with text "Connected" and `color: 'var(--uc-mint)'`, then it exits via AnimatePresence. Banner `zIndex: 'var(--z-banner)'`. Respect `useReducedMotion` (skip initial/exit when reduced).
- [ ] **Step 4:** Run: `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 5:** Commit: `feat(web): animated badge counts, theme icons, and reconnect banner`

---

### Task 11: LeftSidebar — sliding active indicator, hover nudge, clickable profile card, stats count-up

**Files:**
- Modify: `apps/web/src/components/LeftSidebar.tsx`
- Create: `apps/web/src/hooks/useCountUp.ts`
- Test: `apps/web/src/hooks/useCountUp.test.ts`
- Modify: `apps/web/src/styles/index.css` (`.nav-sidebar-item` hover rules)

**Interfaces:**
- Produces: `useCountUp(target: number, durationMs?: number): number` — animates 0→target once when target first becomes > 0; returns target immediately under reduced motion or after completion.

- [ ] **Step 1: Sliding indicator.** In `NavItem`, replace the `background: isActive ? 'var(--uc-indigo-bg)' : 'transparent'` with a layered approach: make the button `position: 'relative'`, background always transparent, and inside it (first child) render, only when `isActive`:

```tsx
<motion.div
  layoutId="nav-active-pill"
  transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
  style={{
    position: 'absolute',
    inset: 0,
    background: 'var(--uc-indigo-bg)',
    borderRadius: 'var(--r-sm)',
    zIndex: 0,
  }}
/>
```

and wrap the icon/label/badge in a `<span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>` (preserving current layout). framer animates the pill between nav items because they share `layoutId`. All NavItems must render within the same tree (they do). Under `useReducedMotion`, pass `transition={{ duration: 0 }}`.
- [ ] **Step 2: Hover nudge.** In index.css (the `.nav-sidebar-item` class already exists — extend it):

```css
.nav-sidebar-item .nav-item-icon {
  transition: transform var(--dur-fast) var(--ease-out-strong), color var(--dur-fast) var(--ease-out-strong);
}
@media (hover: hover) and (pointer: fine) {
  .nav-sidebar-item:hover .nav-item-icon { transform: translateX(1px); }
  .nav-sidebar-item:hover { color: var(--text-primary); }
}
@media (prefers-reduced-motion: reduce) {
  .nav-sidebar-item .nav-item-icon { transition: none; }
}
```

Add `className="nav-item-icon"`-equivalent by wrapping the icon container div: give the existing icon wrapper div `className="nav-item-icon"`.
- [ ] **Step 3: Clickable profile card.** Wrap the profile mini-card in a `<button>` (reset styles: background transparent at rest, border none, textAlign left, padding 0, width 100%, cursor pointer) with `onClick={() => navigate(profilePath)}` and `aria-label="View my profile"`, keeping the card div inside. Add hover lift via existing `interactive-surface` class on the inner card div if that class exists (it's used elsewhere in this file), else add `className="press-feedback"`.
- [ ] **Step 4: Count-up hook, TDD.** Failing test `useCountUp.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCountUp } from './useCountUp'

describe('useCountUp', () => {
  it('returns 0 for target 0', () => {
    const { result } = renderHook(() => useCountUp(0))
    expect(result.current).toBe(0)
  })

  it('reaches the target', async () => {
    const { result } = renderHook(() => useCountUp(42, 80))
    await waitFor(() => expect(result.current).toBe(42), { timeout: 2000 })
  })
})
```

Run → FAIL. Implement:

```ts
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/** Animates 0 → target once (ease-out) the first time target becomes > 0.
    Returns target directly under reduced motion. */
export function useCountUp(target: number, durationMs = 300): number {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)
  const played = useRef(false)

  useEffect(() => {
    if (target <= 0) {
      setValue(target < 0 ? target : 0)
      return
    }
    if (reduced || played.current) {
      setValue(target)
      return
    }
    played.current = true
    const start = performance.now()
    let raf = 0
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, reduced])

  return value
}
```

Run → PASS.
- [ ] **Step 5:** Use it for the two stats: `const connectionsShown = useCountUp(profileData?.stats.connections ?? 0)` etc., rendering `connectionsShown`/`pendingShown` in the stats map.
- [ ] **Step 6:** Run: `npx pnpm --filter web test src/hooks` and `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 7:** Commit: `feat(web): sliding nav indicator, hover nudge, clickable profile card, stat count-up`

---

### Task 12: RightSidebar — entrance stagger, dismissable suggestions with undo, completion moment, empty-state hiding

**Files:**
- Modify: `apps/web/src/components/RightSidebar.tsx`

**Interfaces:**
- Consumes: `listStagger`, `listItem`, `DUR`, `EASE_OUT_EXPO` from `@/lib/motion`; `useToastStore` from `@/stores/toastStore`.

- [ ] **Step 1: Entrance stagger.** Wrap the aside's children in `motion.div` containers using `listStagger(40)`/`listItem` variants (one motion.div per widget/section), `initial="initial" animate="animate"` on the aside-level wrapper — runs once on mount. Skip via `useReducedMotion` (pass `initial={false}`).
- [ ] **Step 2: Dismissable suggestions.** Add local state `const [dismissed, setDismissed] = useState<Set<string>>(new Set())`. Filter rendered suggestions by `!dismissed.has(user.id)`. On `PersonRow` hover show an ✕ button (visible via CSS `:hover` on a `person-row` class or React hover state; keep simple: always render the button with `opacity: 0`, `.person-row:hover &`-style CSS class making it 1 — add `.person-row-dismiss` rules to index.css with `@media (hover: hover)`). Clicking ✕: add id to `dismissed` and fire `show({ message: 'Suggestion hidden', onUndo: () => setDismissed(prev => { const n = new Set(prev); n.delete(user.id); return n }) })`. Wrap the rows list in `AnimatePresence` and make `PersonRow`'s root a `motion.div` with `exit={{ opacity: 0, height: 0 }}` `transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}` (height animation needs `overflow: 'hidden'` on the row root; this is the one sanctioned height animation — it's an exit collapse, not idle motion). Client-side only (resets on refetch) — acceptable per spec; note it in code comment.
- [ ] **Step 3: Progress completion moment.** Track previous `progressIncomplete` with a ref; when it transitions true→false while `progress` is loaded, set `justCompleted` for 2000ms and render the widget one last time with a "All set — profile complete 🎉" row (text `var(--uc-mint)`), wrapped in `AnimatePresence` so the widget exits with `exit={{ opacity: 0, height: 0 }}`. After the timeout it unmounts (state flips), animating out instead of vanishing.
- [ ] **Step 4: Empty-state hiding.** When `!loadingSuggestions && (!suggestions || suggestions.length === 0)`, return `null` for that Section instead of the "No suggestions right now." paragraph; same for events ("No upcoming events."). If BOTH are empty and progress is hidden, render one compact fallback card instead: title "Your campus is warming up", body "Suggestions and events will appear here as your university comes online." (sentence case, `var(--text-tertiary)`) — prevents an entirely blank rail.
- [ ] **Step 5:** Run: `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 6:** Commit: `feat(web): right rail stagger, dismissable suggestions with undo, completion moment`

---

### Task 13: View Transitions for route changes

**Files:**
- Create: `apps/web/src/hooks/useViewTransitionNavigate.ts`
- Modify: `apps/web/src/router/index.tsx` (no structural change — see Step 2 note)
- Modify: `apps/web/src/styles/index.css`

**Interfaces:**
- Produces: `useViewTransitionNavigate(): (to: string) => void` — drop-in wrapper over `useNavigate` that wraps navigation in `document.startViewTransition` when available and motion is allowed.

- [ ] **Step 1: Hook** (progressive enhancement, no test framework support for the API — unit test the fallback path only):

```ts
import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'

/** Navigate wrapped in a View Transition (cross-fade) where supported.
    Falls back to plain navigate. Respects prefers-reduced-motion. */
export function useViewTransitionNavigate(): (to: string) => void {
  const navigate = useNavigate()
  return useCallback(
    (to: string) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => void
      }
      if (!doc.startViewTransition || reduced) {
        navigate(to)
        return
      }
      doc.startViewTransition(() => {
        flushSync(() => navigate(to))
      })
    },
    [navigate],
  )
}
```

Test (`useViewTransitionNavigate.test.ts`): render the hook inside a `MemoryRouter`, assert calling it navigates (jsdom has no `startViewTransition`, so the fallback path is what's tested — assert location changed via a probe component using `useLocation`).
- [ ] **Step 2: Adopt** in the highest-traffic navigations only (YAGNI — not a find/replace of every `useNavigate`): `LeftSidebar` NavItem clicks, `MobileBottomNav` tab clicks, and PostCard → post detail navigation (locate the click handler in `apps/web/src/features/feed/components/PostCard.tsx`). Replace `useNavigate` with `useViewTransitionNavigate` in those components.
- [ ] **Step 3: CSS** (index.css):

```css
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 220ms;
    animation-timing-function: var(--ease-out-strong);
  }
}
```

- [ ] **Step 4:** Run: `npx pnpm --filter web test src/hooks` and `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 5:** Commit: `feat(web): view-transition route changes for primary navigation`

---

### Task 14: Feed "caught up" end-state

**Files:**
- Modify: the feed list component that owns pagination (locate via `grep -rn "hasMore\|fetchNextPage" apps/web/src/features/feed apps/web/src/pages/FeedPage.tsx`) — likely `apps/web/src/pages/FeedPage.tsx` or `apps/web/src/features/feed/components/` list container.

**Interfaces:**
- Consumes: existing feed pagination state (`hasMore` / `hasNextPage` from the feed query hook); `DUR`, `EASE_OUT_EXPO` from `@/lib/motion`.

- [ ] **Step 1:** Locate the feed list's end-of-list rendering (where a loader/"no more posts" currently lives). When the list has ≥1 item and there are no more pages, render a caught-up divider:

```tsx
<motion.div
  initial={reduced ? false : { opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: DUR.slow, ease: EASE_OUT_EXPO }}
  style={{ textAlign: 'center', padding: '28px 0 8px' }}
>
  <div aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>✓</div>
  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginTop: 8 }}>
    You're all caught up
  </div>
  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
    You've seen every new post from your campus
  </div>
</motion.div>
```

Style the ✓ with `color: 'var(--uc-mint)'`. The entrance animation is the "one-time subtle celebration" — nothing looping.
- [ ] **Step 2:** If the feed currently uses infinite autoload via intersection observer, leave the mechanism intact — this phase adds the end-state only (the explicit "Show earlier posts" gate needs backend cursor semantics; defer to phase 4 and note it in the report if autoload-past-caught-up exists).
- [ ] **Step 3:** Run: `npx pnpm --filter web test src/features/feed` and `npx pnpm typecheck && npx pnpm lint` → pass.
- [ ] **Step 4:** Commit: `feat(feed): caught-up end state`

---

### Task 15: Final verification sweep

**Files:** screenshots only.

- [ ] **Step 1:** `npx pnpm typecheck && npx pnpm lint && npx pnpm --filter web test` — all pass (the pre-existing ShuttleMap failure on main is the only allowed failure; confirm no NEW failures).
- [ ] **Step 2:** Start dev server, `node scripts/screenshot.cjs all`, commit changed screenshots: `chore(web): refresh reference screenshots after phase 2 polish`.
- [ ] **Step 3:** Manual smoke pass if the browser works: TopNav hides/reveals on scroll and never hides with an open popover; ⌘K focuses search; nav pill slides; a modal opens/closes with animation on each migrated feature; suggestion dismiss shows undo toast and undo restores.

---

## Out of scope (later phases)

Role badges (phase 3), learning MVP (phase 4), landing refresh (phase 5), sidebar icon-rail collapse, tablet right-rail strips, "Show earlier posts" pagination gate, per-university runtime tenant theming.
