# Design Refresh Phase 1 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the token foundations (durations, z-index, amber, tenant accent), shared Modal/Drawer/Toast primitives, motion presets, and all audit bug/consistency fixes from the design spec (`docs/superpowers/specs/2026-07-03-design-refresh-and-learning-design.md` §3, §7.1, §8).

**Architecture:** Pure frontend work in `apps/web` plus token additions in `tokens.css`. New shared primitives live in `src/components/` and `src/lib/`; global toast state is a Zustand store. No API or DB changes in this phase.

**Tech Stack:** React 18, TypeScript strict, framer-motion (already a dependency), Zustand, Vitest + React Testing Library, CSS custom properties.

## Global Constraints

- All colors via `var(--token)` — never raw hex in component code.
- Borders `0.5px solid var(--border-*)`; no `box-shadow`; buttons `border-radius: var(--r-pill)`; font weights 400/500 only; sentence case for all UI labels.
- Animations: transform/opacity only; ≤300ms interactions; every animation guarded by `prefers-reduced-motion` (CSS) or `useReducedMotion` (framer).
- No `any`; named exports for components; inline styles (project convention).
- Finish every task with a passing `npx pnpm typecheck && npx pnpm lint` before commit (run once per commit, from repo root).
- Commit format `type(scope): description`.
- `pnpm` is not on PATH — always `npx pnpm …`.

---

### Task 1: Token foundations in tokens.css

**Files:**
- Modify: `apps/web/src/styles/tokens.css`

**Interfaces:**
- Produces: CSS custom properties consumed by all later tasks — `--dur-fast` (150ms), `--dur-med` (200ms), `--dur-slow` (300ms), `--z-nav` (50), `--z-popover` (100), `--z-modal` (200), `--z-toast` (300), `--z-banner` (400), `--uc-amber`, `--uc-amber-l`, `--uc-amber-bg`, `--uc-amber-bdr`, `--tenant-accent`, `--tenant-accent-l`, `--tenant-accent-bg`, `--tenant-accent-bdr` (dark + light values).

- [ ] **Step 1: Add theme-invariant tokens to the `:root, :root[data-theme='dark']` block** (after the `/* ── Easing ── */` section, before `/* ── Type ── */`):

```css
  /* ── Duration ─────────────────────────────────────── */
  --dur-fast: 150ms;
  --dur-med:  200ms;
  --dur-slow: 300ms;

  /* ── Z-index ──────────────────────────────────────── */
  --z-nav:     50;
  --z-popover: 100;
  --z-modal:   200;
  --z-toast:   300;
  --z-banner:  400;
```

- [ ] **Step 2: Add amber + tenant accent (dark values) to the same block** (after the `--uc-mint-bdr` line in the Semantic section):

```css
  --uc-amber:         #F5A623;
  --uc-amber-l:       #FFC15E;
  --uc-amber-bg:      rgba(245, 166, 35, 0.10);
  --uc-amber-bdr:     rgba(245, 166, 35, 0.28);
```

And after the `--uc-navy` line (tenant accent defaults to UIU orange until per-university runtime theming lands in a later phase):

```css
  /* ── Tenant accent — per-university identity slot.
     Defaults to UIU orange; later set at runtime from university_settings. */
  --tenant-accent:     #F05A28;
  --tenant-accent-l:   #F5845A;
  --tenant-accent-bg:  rgba(240, 90, 40, 0.10);
  --tenant-accent-bdr: rgba(240, 90, 40, 0.28);
```

- [ ] **Step 3: Add light-theme overrides** inside `:root[data-theme='light']` (amber steps darker for AA on pale tints, same pattern as the existing mint comment; tenant accent mirrors the light orange values):

```css
  --uc-amber:         #B45309;
  --uc-amber-l:       #92400E;
  --uc-amber-bg:      rgba(180, 83, 9, 0.10);
  --uc-amber-bdr:     rgba(180, 83, 9, 0.28);

  --tenant-accent:     #D44A1F;
  --tenant-accent-l:   #A8391A;
  --tenant-accent-bg:  rgba(212, 74, 31, 0.10);
  --tenant-accent-bdr: rgba(212, 74, 31, 0.28);
```

- [ ] **Step 4: Verify** — Run: `npx pnpm typecheck && npx pnpm lint` → both pass (CSS-only change; this confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles/tokens.css
git commit -m "feat(web): add duration, z-index, amber, and tenant-accent tokens"
```

---

### Task 2: Fix undefined-token bugs (`--uc-green`, `--shadow-lg`)

**Files:**
- Modify: `apps/web/src/features/settings/components/AccountSection.tsx:299,323`
- Modify: `apps/web/src/features/feed/components/CommentDrawer.tsx:682`

**Interfaces:**
- Consumes: `--uc-mint` (exists in tokens.css).

- [ ] **Step 1:** In `AccountSection.tsx`, replace both occurrences of `'var(--uc-green, #2e9e5b)'` with `'var(--uc-mint)'` (lines ~299 and ~323).

- [ ] **Step 2:** In `CommentDrawer.tsx:682`, delete the `boxShadow: 'var(--shadow-lg)',` line entirely (token never existed; no-shadow rule — depth via surface tiers).

- [ ] **Step 3: Verify** — Run: `npx pnpm --filter web test src/features/settings` (existing settings tests pass) and `npx pnpm typecheck && npx pnpm lint`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/settings/components/AccountSection.tsx apps/web/src/features/feed/components/CommentDrawer.tsx
git commit -m "fix(web): replace undefined --uc-green and --shadow-lg token references"
```

---

### Task 3: Casing consistency fixes

**Files:**
- Modify: `apps/web/src/components/LeftSidebar.tsx:365` ("campus tools" → "Campus tools")
- Modify: `apps/web/src/components/RightSidebar.tsx:397` ("trending now" → "Trending now")
- Modify: `apps/web/src/features/groups/components/StudySessionsTab.tsx:52,68`
- Modify: `apps/web/src/features/landing/components/LandingFooter.tsx:52`
- Modify: `apps/web/src/components/ui/hover-footer.tsx:103,125,149`

**Interfaces:** none.

- [ ] **Step 1:** `LeftSidebar.tsx` — change the literal `campus tools` to `Campus tools`.

- [ ] **Step 2:** `RightSidebar.tsx` — change the literal `trending now` to `Trending now`.

- [ ] **Step 3:** `StudySessionsTab.tsx` lines 52 and 68 — remove `textTransform: 'uppercase', letterSpacing: '0.05em'` from both `<p>` styles (labels already read "Upcoming" / "Past" in sentence case).

- [ ] **Step 4:** `LandingFooter.tsx:52` and `hover-footer.tsx:103,125,149` — remove each `textTransform: 'uppercase',` property. If a removed style leaves an orphaned `letterSpacing` tuned for caps (≥0.05em), reduce it to `'0.02em'`.

- [ ] **Step 5: Verify** — Run: `npx pnpm typecheck && npx pnpm lint` → pass. Visually spot-check: `node scripts/screenshot.cjs feed` (Vite dev server must be running) and confirm the sidebar label reads "Campus tools".

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src
git commit -m "fix(web): sentence-case section labels, remove uppercase transforms"
```

---

### Task 4: Replace hardcoded hex colors

**Files:**
- Modify: `apps/web/src/pages/admin/ShuttleTab.tsx:66`
- Modify: `apps/web/src/features/shuttle/components/ShuttleMap.tsx:249`
- Modify: `apps/web/src/features/feed/components/MediaGrid.tsx:108`
- Modify: `apps/web/src/components/LeftSidebar.tsx:278`

**Interfaces:**
- Consumes: `--tenant-accent` (Task 1), `--on-accent`, `--uc-indigo` (existing).

- [ ] **Step 1:** `ShuttleTab.tsx:66` — replace `color: '#5B5BD6'` with `color: 'var(--uc-indigo)'`.

- [ ] **Step 2:** `ShuttleMap.tsx:249` — Leaflet `pathOptions` cannot resolve CSS vars from a string in all render paths; read the token at runtime instead. Above the component's return (inside the component), add:

```ts
const tenantAccent =
  typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--tenant-accent').trim() || '#F05A28'
    : '#F05A28'
```

and replace `color: '#F05A28', fillColor: '#F05A28'` with `color: tenantAccent, fillColor: tenantAccent`. (The literal fallback is acceptable here: Leaflet requires a resolved color string; the token is the source when available.)

- [ ] **Step 3:** `MediaGrid.tsx:108` — replace `color: '#fff'` with `color: 'var(--on-accent)'`. Leave the `background: '#000'` media backdrop at line 159 and add a trailing comment on that line: `// intentional: media letterbox is theme-invariant black`.

- [ ] **Step 4:** `LeftSidebar.tsx:278` — replace the avatar ring `background: 'var(--uc-orange)'` with `background: 'var(--tenant-accent)'`.

- [ ] **Step 5: Verify** — Run: `npx pnpm typecheck && npx pnpm lint` → pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/admin/ShuttleTab.tsx apps/web/src/features/shuttle/components/ShuttleMap.tsx apps/web/src/features/feed/components/MediaGrid.tsx apps/web/src/components/LeftSidebar.tsx
git commit -m "fix(web): replace hardcoded hex colors with tokens, introduce tenant accent"
```

---

### Task 5: Investigate own-profile Connect button + stray screenshot element

**Files:**
- Inspect: `apps/web/src/features/profile/components/ProfileHeader.tsx`, `apps/web/src/pages/ProfilePage.tsx` (or wherever `isOwnProfile` is computed), `apps/web/src/components/AuthLoader.tsx` (dev-auth mock)
- Possibly modify: whichever file computes `isOwnProfile`
- Regenerate: `screenshots/feed.png`, `screenshots/profile.png`

**Interfaces:**
- Consumes: `useAuthStore` (`user.id`), route param `:id`.

Context: `ProfileFeatured` already receives `isOwnProfile`, yet the reference screenshot shows a Connect button and "Connect to see featured items" on the user's own profile. Most likely the `?dev-auth=1` mock user id differs from the `:devId` used in the screenshot route, making the page believe it is viewing someone else. The screenshots also show an unexplained circular palm-tree graphic bottom-right that does not exist anywhere in source (grep confirmed) — likely a browser extension captured by the screenshot script.

- [ ] **Step 1:** Read how `isOwnProfile` is computed (grep `isOwnProfile` in `features/profile` and `pages`). Confirm it compares `useAuthStore().user.id` with the route's user id.

- [ ] **Step 2:** Read `scripts/screenshot.cjs` and `AuthLoader.tsx` dev-auth path. Check whether the mock user's `id` equals the `:devId` the profile screenshot route uses. If they differ, fix the script or the mock so they match (this is the expected root cause — a screenshot-tooling artifact, not an app bug).

- [ ] **Step 3:** If Step 1 reveals a real comparison bug (e.g. comparing username vs id), fix it so own-profile renders the owner view; run `npx pnpm --filter web test src/features/profile` → pass.

- [ ] **Step 4:** Regenerate screenshots with a clean Chromium profile: `node scripts/screenshot.cjs feed && node scripts/screenshot.cjs profile`. Confirm (a) no Connect button on own profile, (b) no palm-tree element. If the palm tree persists, find its DOM node in the captured page (add `--dump-html` style debugging or inspect manually) and remove its source.

- [ ] **Step 5: Verify** — `npx pnpm typecheck && npx pnpm lint` → pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(web): correct own-profile detection in dev screenshots, refresh captures"
```

---

### Task 6: Motion presets module

**Files:**
- Create: `apps/web/src/lib/motion.ts`
- Test: `apps/web/src/lib/motion.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 7, 8, 9 and all later phases):
  - `DUR = { fast: 0.15, med: 0.2, slow: 0.3 }` (seconds, framer units)
  - `EASE_OUT_EXPO: [number, number, number, number]` = `[0.16, 1, 0.3, 1]`
  - `EASE_DRAWER: [number, number, number, number]` = `[0.32, 0.72, 0, 1]`
  - `popoverIn`, `modalIn`, `drawerIn`: framer-motion variant objects `{ initial, animate, exit, transition }`
  - `listStagger(delayMs?: number)`: returns container variants with `staggerChildren`
  - `listItem`: child variant for staggered lists

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/motion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DUR, EASE_OUT_EXPO, popoverIn, modalIn, drawerIn, listStagger, listItem } from './motion'

describe('motion presets', () => {
  it('exposes duration constants in seconds', () => {
    expect(DUR).toEqual({ fast: 0.15, med: 0.2, slow: 0.3 })
  })

  it('popoverIn scales from 0.96 and exits faster than it enters', () => {
    expect(popoverIn.initial).toMatchObject({ opacity: 0, scale: 0.96 })
    expect(popoverIn.animate).toMatchObject({ opacity: 1, scale: 1 })
    expect(popoverIn.exit).toMatchObject({ opacity: 0, scale: 0.96 })
    expect(popoverIn.transition.duration).toBe(DUR.med)
    expect(popoverIn.exitTransition.duration).toBeLessThan(popoverIn.transition.duration)
  })

  it('modalIn and drawerIn are complete variant sets', () => {
    for (const v of [modalIn, drawerIn]) {
      expect(v.initial).toBeDefined()
      expect(v.animate).toBeDefined()
      expect(v.exit).toBeDefined()
    }
    expect(drawerIn.initial).toMatchObject({ y: '100%' })
    expect(drawerIn.transition.ease).toEqual([0.32, 0.72, 0, 1])
  })

  it('listStagger produces container variants with per-child delay', () => {
    const c = listStagger(40)
    expect(c.animate.transition.staggerChildren).toBe(0.04)
    expect(listItem.initial).toMatchObject({ opacity: 0, y: 8 })
  })

  it('easings are cubic-bezier tuples', () => {
    expect(EASE_OUT_EXPO).toEqual([0.16, 1, 0.3, 1])
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx pnpm --filter web test src/lib/motion.test.ts` → FAIL ("Cannot find module './motion'").

- [ ] **Step 3: Write the implementation** — `apps/web/src/lib/motion.ts`:

```ts
/* Shared framer-motion presets. Every popover/modal/drawer imports these —
   never inline transition objects (spec §7.1). Durations mirror the CSS
   --dur-* tokens (seconds here because framer uses seconds). */

export const DUR = { fast: 0.15, med: 0.2, slow: 0.3 } as const

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]
export const EASE_DRAWER: [number, number, number, number] = [0.32, 0.72, 0, 1]

interface Preset {
  initial: Record<string, string | number>
  animate: Record<string, string | number>
  exit: Record<string, string | number>
  transition: { duration: number; ease: [number, number, number, number] }
  /** Exits run ~25% faster than entrances. Spread onto exit via the
      `transition` prop of AnimatePresence children when needed. */
  exitTransition: { duration: number; ease: [number, number, number, number] }
}

function preset(
  initial: Preset['initial'],
  animate: Preset['animate'],
  exit: Preset['exit'],
  duration: number,
  ease: [number, number, number, number],
): Preset {
  return {
    initial,
    animate,
    exit,
    transition: { duration, ease },
    exitTransition: { duration: duration * 0.75, ease },
  }
}

export const popoverIn = preset(
  { opacity: 0, scale: 0.96, y: -4 },
  { opacity: 1, scale: 1, y: 0 },
  { opacity: 0, scale: 0.96, y: -4 },
  DUR.med,
  EASE_OUT_EXPO,
)

export const modalIn = preset(
  { opacity: 0, scale: 0.96 },
  { opacity: 1, scale: 1 },
  { opacity: 0, scale: 0.96 },
  DUR.med,
  EASE_OUT_EXPO,
)

export const drawerIn = preset(
  { y: '100%' },
  { y: 0 },
  { y: '100%' },
  DUR.slow,
  EASE_DRAWER,
)

export const overlayIn = preset(
  { opacity: 0 },
  { opacity: 1 },
  { opacity: 0 },
  DUR.med,
  EASE_OUT_EXPO,
)

export function listStagger(delayMs = 35) {
  return {
    initial: {},
    animate: { transition: { staggerChildren: delayMs / 1000 } },
  }
}

export const listItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.med, ease: EASE_OUT_EXPO } },
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npx pnpm --filter web test src/lib/motion.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/motion.ts apps/web/src/lib/motion.test.ts
git commit -m "feat(web): add shared motion presets module"
```

---

### Task 7: Shared Modal primitive

**Files:**
- Create: `apps/web/src/components/Modal.tsx`
- Test: `apps/web/src/components/Modal.test.tsx`

**Interfaces:**
- Consumes: `modalIn`, `overlayIn` from `@/lib/motion` (Task 6); z-index tokens (Task 1).
- Produces: `Modal` component —
  `({ isOpen, onClose, title, children, maxWidth = 440, triggerRef }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: number; triggerRef?: React.RefObject<HTMLButtonElement | null> }) => JSX.Element | null`
  Behavior contract: portal to `document.body`; backdrop click + Escape call `onClose`; Tab is trapped; body scroll locked while open; focus returns to `triggerRef` on close; respects `useReducedMotion`.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/Modal.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

function setup(isOpen = true, onClose = vi.fn()) {
  render(
    <Modal isOpen={isOpen} onClose={onClose} title="Send request">
      <button>First</button>
      <button>Second</button>
    </Modal>,
  )
  return { onClose }
}

describe('Modal', () => {
  it('renders title and children when open', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Send request' })).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose on Escape', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on backdrop click but not on panel click', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByText('First'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('traps Tab focus inside the panel', async () => {
    setup()
    const [closeBtn, first, second] = screen.getAllByRole('button')
    second.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(closeBtn)
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(second)
    expect(first).toBeInTheDocument()
  })

  it('locks body scroll while open', () => {
    setup()
    expect(document.body.style.overflow).toBe('hidden')
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx pnpm --filter web test src/components/Modal.test.tsx` → FAIL ("Cannot find module './Modal'").

- [ ] **Step 3: Write the implementation** — `apps/web/src/components/Modal.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { modalIn, overlayIn } from '@/lib/motion'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: number
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({ isOpen, onClose, title, children, maxWidth = 440, triggerRef }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  // Escape + Tab trap
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const idx = items.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey && idx <= 0) {
        e.preventDefault()
        items[items.length - 1].focus()
      } else if (!e.shiftKey && idx === items.length - 1) {
        e.preventDefault()
        items[0].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // Scroll lock + initial focus + focus return
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      triggerRef?.current?.focus()
    }
  }, [isOpen, triggerRef])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-testid="modal-backdrop"
          onClick={onClose}
          initial={reduced ? false : overlayIn.initial}
          animate={overlayIn.animate}
          exit={reduced ? undefined : overlayIn.exit}
          transition={overlayIn.transition}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-modal)' as unknown as number,
            background: 'var(--overlay-bg)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={reduced ? false : modalIn.initial}
            animate={modalIn.animate}
            exit={reduced ? undefined : modalIn.exit}
            transition={modalIn.transition}
            style={{
              width: '100%',
              maxWidth,
              maxHeight: 'calc(100dvh - 48px)',
              overflowY: 'auto',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-xl)',
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="press-feedback"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npx pnpm --filter web test src/components/Modal.test.tsx` → PASS. (If the focus-trap test's expected first element differs — the close button is the first focusable — adjust the test's destructuring order to match DOM order, not the implementation.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Modal.tsx apps/web/src/components/Modal.test.tsx
git commit -m "feat(web): add shared Modal primitive with focus trap and motion"
```

---

### Task 8: Shared Drawer primitive

**Files:**
- Create: `apps/web/src/components/Drawer.tsx`
- Test: `apps/web/src/components/Drawer.test.tsx`

**Interfaces:**
- Consumes: `drawerIn`, `overlayIn` from `@/lib/motion`.
- Produces: `Drawer` component —
  `({ isOpen, onClose, title, children, height = '70dvh' }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; height?: string }) => JSX.Element | null`
  Bottom-sheet: slides up from the bottom edge, same backdrop/Escape/scroll-lock contract as Modal.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/Drawer.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Drawer } from './Drawer'

describe('Drawer', () => {
  it('renders children when open, nothing when closed', () => {
    const { rerender } = render(
      <Drawer isOpen onClose={vi.fn()} title="Comments"><p>Body</p></Drawer>,
    )
    expect(screen.getByRole('dialog', { name: 'Comments' })).toBeInTheDocument()
    rerender(<Drawer isOpen={false} onClose={vi.fn()} title="Comments"><p>Body</p></Drawer>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape and backdrop click', async () => {
    const onClose = vi.fn()
    render(<Drawer isOpen onClose={onClose} title="Comments"><p>Body</p></Drawer>)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByTestId('drawer-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx pnpm --filter web test src/components/Drawer.test.tsx` → FAIL.

- [ ] **Step 3: Write the implementation** — `apps/web/src/components/Drawer.tsx` (same skeleton as Modal; differences shown in full):

```tsx
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { drawerIn, overlayIn } from '@/lib/motion'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  height?: string
}

export function Drawer({ isOpen, onClose, title, children, height = '70dvh' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-testid="drawer-backdrop"
          onClick={onClose}
          initial={reduced ? false : overlayIn.initial}
          animate={overlayIn.animate}
          exit={reduced ? undefined : overlayIn.exit}
          transition={overlayIn.transition}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-modal)' as unknown as number,
            background: 'var(--overlay-bg-soft)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={reduced ? false : drawerIn.initial}
            animate={drawerIn.animate}
            exit={reduced ? undefined : drawerIn.exit}
            transition={drawerIn.transition}
            style={{
              width: '100%',
              height,
              background: 'var(--surface-card)',
              borderTop: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
              padding: '12px 16px 16px',
              overflowY: 'auto',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 36,
                height: 4,
                borderRadius: 'var(--r-pill)',
                background: 'var(--border-strong)',
                margin: '0 auto 12px',
              }}
            />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npx pnpm --filter web test src/components/Drawer.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Drawer.tsx apps/web/src/components/Drawer.test.tsx
git commit -m "feat(web): add shared bottom-sheet Drawer primitive"
```

---

### Task 9: Global toast system with undo

**Files:**
- Create: `apps/web/src/stores/toastStore.ts`
- Create: `apps/web/src/components/ToastHost.tsx`
- Test: `apps/web/src/stores/toastStore.test.ts`
- Modify: `apps/web/src/components/FeedLayout.tsx` (mount `<ToastHost />` once, after `<MobileBottomNav />`)

**Interfaces:**
- Produces:
  - `useToastStore` Zustand store: `{ toasts: Toast[]; show: (opts: { message: string; type?: 'success' | 'error' | 'info'; onUndo?: () => void; durationMs?: number }) => string; dismiss: (id: string) => void }` where `Toast = { id: string; message: string; type: 'success' | 'error' | 'info'; onUndo?: () => void }`
  - `ToastHost` component rendered once in `FeedLayout`.
  - Later phases call `useToastStore.getState().show({ message: 'Suggestion dismissed', onUndo })` from mutation `onSuccess` handlers.

- [ ] **Step 1: Write the failing test** — `apps/web/src/stores/toastStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from './toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  it('show adds a toast and returns its id', () => {
    const id = useToastStore.getState().show({ message: 'Saved' })
    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ id, message: 'Saved', type: 'success' })
  })

  it('auto-dismisses after the duration', () => {
    useToastStore.getState().show({ message: 'Saved', durationMs: 3000 })
    vi.advanceTimersByTime(2999)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('undo toasts live longer by default and carry the callback', () => {
    const onUndo = vi.fn()
    useToastStore.getState().show({ message: 'Dismissed', onUndo })
    expect(useToastStore.getState().toasts[0].onUndo).toBe(onUndo)
    vi.advanceTimersByTime(3500)
    expect(useToastStore.getState().toasts).toHaveLength(1) // still visible at the non-undo default
    vi.advanceTimersByTime(2500)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('dismiss removes immediately', () => {
    const id = useToastStore.getState().show({ message: 'Saved' })
    useToastStore.getState().dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npx pnpm --filter web test src/stores/toastStore.test.ts` → FAIL.

- [ ] **Step 3: Write the store** — `apps/web/src/stores/toastStore.ts`:

```ts
import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  onUndo?: () => void
}

interface ToastState {
  toasts: Toast[]
  show: (opts: { message: string; type?: Toast['type']; onUndo?: () => void; durationMs?: number }) => string
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: ({ message, type = 'success', onUndo, durationMs }) => {
    const id = crypto.randomUUID()
    // Undo toasts stay longer so the user has time to react.
    const ttl = durationMs ?? (onUndo ? 6000 : 3500)
    set((s) => ({ toasts: [...s.toasts, { id, message, type, onUndo }] }))
    setTimeout(() => get().dismiss(id), ttl)
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npx pnpm --filter web test src/stores/toastStore.test.ts` → PASS.

- [ ] **Step 5: Write `ToastHost`** — `apps/web/src/components/ToastHost.tsx`:

```tsx
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useToastStore } from '@/stores/toastStore'
import { DUR, EASE_OUT_EXPO } from '@/lib/motion'

const typeColor = {
  success: 'var(--uc-mint)',
  error: 'var(--uc-red)',
  info: 'var(--uc-indigo-l)',
} as const

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const reduced = useReducedMotion()

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-toast)' as unknown as number,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            role="status"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 12 }}
            transition={{ duration: DUR.med, ease: EASE_OUT_EXPO }}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-pill)',
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor[t.type], flexShrink: 0 }} />
            {t.message}
            {t.onUndo && (
              <button
                onClick={() => {
                  t.onUndo?.()
                  dismiss(t.id)
                }}
                className="press-feedback"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--uc-indigo-l)',
                  padding: 0,
                }}
              >
                Undo
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 6: Mount it** — in `FeedLayout.tsx`, add `import { ToastHost } from '@/components/ToastHost'` and render `<ToastHost />` immediately after `<MobileBottomNav />`.

- [ ] **Step 7: Verify** — Run: `npx pnpm --filter web test src/stores src/components` → PASS; `npx pnpm typecheck && npx pnpm lint` → pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/stores/toastStore.ts apps/web/src/stores/toastStore.test.ts apps/web/src/components/ToastHost.tsx apps/web/src/components/FeedLayout.tsx
git commit -m "feat(web): add global toast system with undo support"
```

---

### Task 10: Migrate ConnectionRequestModal to the shared Modal (pattern proof)

**Files:**
- Modify: `apps/web/src/features/connections/components/ConnectionRequestModal.tsx`

**Interfaces:**
- Consumes: `Modal` from `@/components/Modal` (Task 7). Public props of `ConnectionRequestModal` are unchanged: `{ isOpen, onClose, targetName, onSend, isPending, triggerRef }`.

- [ ] **Step 1:** Rewrite `ConnectionRequestModal` to render `<Modal isOpen={isOpen} onClose={onClose} title={`Connect with ${targetName}`} triggerRef={triggerRef}>` around only its content (note toggle, textarea with the 300-char counter, send button). Delete the now-duplicated Escape handler, focus trap, focus-return effect, and overlay markup. Keep the state-reset-on-open and textarea-focus effects.

- [ ] **Step 2:** Run existing connection tests: `npx pnpm --filter web test src/features/connections` → PASS. If a test queried the old overlay structure, update selectors to `getByRole('dialog')`.

- [ ] **Step 3:** Manual check — start `npx pnpm --filter web dev`, open a profile, click Connect: modal animates in (scale + blur backdrop), Escape closes, focus returns to the button.

- [ ] **Step 4: Verify** — `npx pnpm typecheck && npx pnpm lint` → pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/connections/components/ConnectionRequestModal.tsx
git commit -m "refactor(connections): migrate ConnectionRequestModal to shared Modal primitive"
```

---

### Task 11: Final verification sweep

**Files:** none (verification only).

- [ ] **Step 1:** Run the full suite: `npx pnpm typecheck && npx pnpm lint && npx pnpm --filter web test` → all pass.

- [ ] **Step 2:** With the dev server running, regenerate all screenshots: `node scripts/screenshot.cjs all`. Visually confirm: sentence-case labels, tenant-accent avatar ring, no stray elements, no own-profile Connect button.

- [ ] **Step 3:** Toggle light theme in the running app and spot-check the settings page (username availability indicator now mint) and feed.

- [ ] **Step 4: Commit screenshots**

```bash
git add screenshots/
git commit -m "chore(web): refresh reference screenshots after foundation fixes"
```

---

## Out of scope (subsequent plans)

Phase 2 (component polish: TopNav frost/hide-reveal, ⌘K, sidebar layoutId indicator, remaining modal migrations, View Transitions, caught-up state), Phase 3 (role badges), Phase 4 (learning MVP: migrations `077_+`, `learning` module, `/learn` route), Phase 5 (landing refresh), Phase 6 (decks/quiz/icon rail). Each gets its own plan once this one lands.
