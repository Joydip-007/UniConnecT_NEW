# Sidebar Icon Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent 68px collapsed mode to the desktop/tablet `LeftSidebar` while preserving the existing expanded sidebar and mobile bottom navigation.

**Architecture:** Pure frontend work in `apps/web`. `FeedLayout` owns the persisted collapsed state and applies a grid data attribute; `LeftSidebar` renders expanded or compact UI from props; CSS switches the app shell grid between 232px and 68px first columns.

**Tech Stack:** React 18, TypeScript strict, React Router, TanStack Query, framer-motion, Vitest + React Testing Library, Playwright.

## Global Constraints

- Branch: `feature/sidebar-icon-rail` off `main`.
- Expanded left sidebar width remains exactly `232px`; collapsed width is exactly `68px`.
- Collapsed state persists in `localStorage['uc:left-sidebar-collapsed']` as `'true'` or `'false'`; default is expanded.
- Mobile behavior is unchanged: at `max-width: 767px`, `.feed-layout-left` stays hidden and `MobileBottomNav` remains the primary navigation.
- Frontend only: no API, database, shared schema, auth, or route changes.
- Design tokens only: no hardcoded hex colors in component code; borders remain `0.5px solid var(--border-*)`; no `box-shadow`; font weights 400/500; sentence case.
- Motion is idle-calm, transform/opacity/width only, uses `DUR` / `EASE_OUT_EXPO` or CSS duration tokens, and respects reduced motion.
- Accessibility: toggle labels are exactly `Collapse sidebar` and `Expand sidebar`; collapsed nav and campus tools expose accessible names; active route keeps `aria-current="page"`.
- `npx pnpm` is required for package commands; plain `pnpm` is not on PATH.
- Finish each implementation task with the focused tests plus `npx pnpm --filter web typecheck && npx pnpm --filter web lint`.

---

### Task 1: Sidebar rail preference hook

**Files:**
- Create: `apps/web/src/hooks/useSidebarRailPreference.ts`
- Test: `apps/web/src/hooks/useSidebarRailPreference.test.ts`

**Interfaces:**
- Produces: `useSidebarRailPreference(): { isCollapsed: boolean; toggleCollapsed: () => void }`
- Consumed by: `apps/web/src/components/FeedLayout.tsx` in Task 3.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/hooks/useSidebarRailPreference.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSidebarRailPreference } from './useSidebarRailPreference'

const STORAGE_KEY = 'uc:left-sidebar-collapsed'

describe('useSidebarRailPreference', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to expanded when storage is empty', () => {
    const { result } = renderHook(() => useSidebarRailPreference())
    expect(result.current.isCollapsed).toBe(false)
  })

  it('initializes collapsed from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    const { result } = renderHook(() => useSidebarRailPreference())
    expect(result.current.isCollapsed).toBe(true)
  })

  it('toggles and persists the collapsed value', () => {
    const { result } = renderHook(() => useSidebarRailPreference())

    act(() => result.current.toggleCollapsed())
    expect(result.current.isCollapsed).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')

    act(() => result.current.toggleCollapsed())
    expect(result.current.isCollapsed).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx pnpm --filter web test src/hooks/useSidebarRailPreference.test.ts`

Expected: FAIL because `./useSidebarRailPreference` does not exist.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/hooks/useSidebarRailPreference.ts`:

```ts
import { useCallback, useState } from 'react'

const STORAGE_KEY = 'uc:left-sidebar-collapsed'

function readInitialPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writePreference(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    // Current-session state still updates when storage is unavailable.
  }
}

export function useSidebarRailPreference() {
  const [isCollapsed, setIsCollapsed] = useState(readInitialPreference)

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((current) => {
      const next = !current
      writePreference(next)
      return next
    })
  }, [])

  return { isCollapsed, toggleCollapsed }
}
```

- [ ] **Step 4: Verify**

Run:

```bash
npx pnpm --filter web test src/hooks/useSidebarRailPreference.test.ts
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useSidebarRailPreference.ts apps/web/src/hooks/useSidebarRailPreference.test.ts
git commit -m "feat(web): persist sidebar rail preference"
```

---

### Task 2: Collapsed LeftSidebar rendering

**Files:**
- Modify: `apps/web/src/components/LeftSidebar.tsx`
- Test: `apps/web/src/components/LeftSidebar.test.tsx`

**Interfaces:**
- Consumes: `collapsed: boolean` and `onToggleCollapsed: () => void` props.
- Produces: expanded sidebar unchanged plus collapsed 68px icon-rail rendering with accessible names and visible toggle.

- [ ] **Step 1: Write the failing component tests**

Create `apps/web/src/components/LeftSidebar.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeftSidebar } from './LeftSidebar'

const navigate = vi.fn()

vi.mock('@/hooks/useViewTransitionNavigate', () => ({
  useViewTransitionNavigate: () => navigate,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      role: 'student',
      profile: {
        fullName: 'Ada Lovelace',
        avatarUrl: null,
        coverUrl: null,
        department: 'CSE',
        batchYear: '2026',
      },
    },
  }),
}))

vi.mock('@/stores/notificationsStore', () => ({
  useNotificationsStore: () => ({ messageCount: 7 }),
}))

vi.mock('@/lib/axios', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: {
          id: 'user-1',
          email: 'ada@example.edu',
          role: 'student',
          isVerified: true,
          profile: {
            fullName: 'Ada Lovelace',
            username: 'ada',
            avatarUrl: null,
            coverUrl: null,
            headline: null,
            department: 'CSE',
            batchYear: '2026',
            bio: null,
            location: null,
            website: null,
            skills: [],
          },
          stats: { posts: 0, connections: 12, pendingReceived: 2 },
        },
      },
    }),
  },
}))

function renderSidebar(collapsed: boolean, onToggleCollapsed = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/feed']}>
        <LeftSidebar collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LeftSidebar', () => {
  beforeEach(() => {
    navigate.mockClear()
  })

  it('renders the expanded sidebar with visible profile and labels', () => {
    renderSidebar(false)
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByText('Campus tools')).toBeInTheDocument()
  })

  it('renders collapsed nav as accessible icon buttons without visible labels', () => {
    const { container } = renderSidebar(true)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('title', 'Home')
    expect(screen.getByRole('button', { name: 'Messages' })).toHaveAttribute('title', 'Messages')
    expect(screen.getByRole('button', { name: 'Shuttle live' })).toHaveAttribute('title', 'Shuttle live')
    expect(container.querySelector('.left-sidebar--collapsed')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  })

  it('calls the collapse toggle from the rail button', async () => {
    const onToggleCollapsed = vi.fn()
    renderSidebar(false, onToggleCollapsed)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(onToggleCollapsed).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx pnpm --filter web test src/components/LeftSidebar.test.tsx`

Expected: FAIL because `LeftSidebar` does not accept the new props and does not render the toggle/collapsed class.

- [ ] **Step 3: Add props and toggle control**

In `apps/web/src/components/LeftSidebar.tsx`:

- Import `PanelLeftClose` and `PanelLeftOpen` from `lucide-react`.
- Add:

```ts
interface LeftSidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}
```

- Change the export to:

```tsx
export function LeftSidebar({ collapsed, onToggleCollapsed }: LeftSidebarProps) {
```

- Add a top toggle button inside the `aside`, before the profile button:

```tsx
const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose
```

```tsx
<button
  type="button"
  onClick={onToggleCollapsed}
  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  className="left-sidebar-toggle press-feedback"
>
  <ToggleIcon size={17} />
</button>
```

- [ ] **Step 4: Render collapsed profile, nav, and campus tool variants**

Apply these component rules:

- `aside` className becomes `rail-scroll left-sidebar-shell${collapsed ? ' left-sidebar--collapsed' : ''}`.
- `aside` width style becomes `width: collapsed ? 68 : 232`.
- In collapsed mode, render the profile button as only the avatar ring and keep `aria-label="View my profile"`.
- In expanded mode, keep the current cover strip, full name, department, and stats.
- Pass `collapsed` to `NavItem` and `CampusTool`.
- `NavItem` adds `aria-label={collapsed ? label : undefined}` and `title={collapsed ? label : undefined}`.
- `NavItem` hidden label span uses `className={collapsed ? 'left-sidebar-visually-hidden' : undefined}`.
- Collapsed `NavItem` hit targets are centered, with stable 44px square minimum.
- `CampusTool` follows the same collapsed pattern: centered icon, accessible name/title, no visible label or trailing external-link icon.

- [ ] **Step 5: Verify**

Run:

```bash
npx pnpm --filter web test src/components/LeftSidebar.test.tsx
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/LeftSidebar.tsx apps/web/src/components/LeftSidebar.test.tsx
git commit -m "feat(web): add collapsed left sidebar rail rendering"
```

---

### Task 3: FeedLayout grid wiring and CSS

**Files:**
- Modify: `apps/web/src/components/FeedLayout.tsx`
- Modify: `apps/web/src/styles/index.css`
- Test: `apps/web/src/components/FeedLayout.test.tsx`

**Interfaces:**
- Consumes: `useSidebarRailPreference` from Task 1.
- Consumes: `LeftSidebar collapsed/onToggleCollapsed` from Task 2.
- Produces: `.feed-layout-grid[data-left-sidebar='collapsed']` grid state and 68px first-column CSS.

- [ ] **Step 1: Write the failing layout test**

Create `apps/web/src/components/FeedLayout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedLayout } from './FeedLayout'

vi.mock('@/components/TopNav', () => ({ TopNav: () => <div data-testid="topnav" /> }))
vi.mock('@/components/MobileBottomNav', () => ({ MobileBottomNav: () => <div data-testid="mobile-nav" /> }))
vi.mock('@/components/RightSidebar', () => ({ RightSidebar: () => <aside data-testid="right-sidebar" /> }))
vi.mock('@/components/ToastHost', () => ({ ToastHost: () => null }))
vi.mock('@/features/notifications', () => ({ useNotificationsSocket: vi.fn() }))
vi.mock('@/features/presence', () => ({ usePresenceHeartbeat: vi.fn() }))
vi.mock('@/features/learning', () => ({ useAchievementSocket: vi.fn() }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => 'user-1' }))
vi.mock('@/stores/socketStore', () => ({
  useSocketStore: () => ({ connected: true, hasConnected: true }),
}))

vi.mock('@/components/LeftSidebar', () => ({
  LeftSidebar: ({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) => (
    <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
      {collapsed ? 'collapsed' : 'expanded'}
    </button>
  ),
}))

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/feed']}>
      <Routes>
        <Route element={<FeedLayout />}>
          <Route path="/feed" element={<div>Feed body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('FeedLayout sidebar rail state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts expanded and marks the grid collapsed after toggle', async () => {
    const { container } = renderLayout()
    const grid = container.querySelector('.feed-layout-grid')
    expect(grid).toHaveAttribute('data-left-sidebar', 'expanded')

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(grid).toHaveAttribute('data-left-sidebar', 'collapsed')
    expect(localStorage.getItem('uc:left-sidebar-collapsed')).toBe('true')
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx pnpm --filter web test src/components/FeedLayout.test.tsx`

Expected: FAIL because `FeedLayout` does not yet use the preference hook or set the data attribute.

- [ ] **Step 3: Wire layout state**

In `apps/web/src/components/FeedLayout.tsx`:

- Import `useSidebarRailPreference` from `@/hooks/useSidebarRailPreference`.
- Inside `FeedLayout`, add:

```ts
const { isCollapsed: isLeftSidebarCollapsed, toggleCollapsed: toggleLeftSidebarCollapsed } = useSidebarRailPreference()
```

- Change:

```tsx
<div className="feed-layout-grid">
```

to:

```tsx
<div className="feed-layout-grid" data-left-sidebar={isLeftSidebarCollapsed ? 'collapsed' : 'expanded'}>
```

- Change:

```tsx
<LeftSidebar />
```

to:

```tsx
<LeftSidebar collapsed={isLeftSidebarCollapsed} onToggleCollapsed={toggleLeftSidebarCollapsed} />
```

- [ ] **Step 4: Add grid and rail CSS**

In `apps/web/src/styles/index.css`, update the feed layout block:

```css
.feed-layout-grid[data-left-sidebar='collapsed'] {
  grid-template-columns: 68px 1fr 272px;
}

@media (max-width: 1100px) {
  .feed-layout-grid[data-left-sidebar='collapsed'] {
    grid-template-columns: 68px 1fr;
  }
}
```

Add sidebar utility CSS near the existing nav-sidebar hover styles:

```css
.left-sidebar-shell {
  transition: width var(--dur-med) var(--ease-out-expo);
}

.left-sidebar-toggle {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
  border: 0.5px solid var(--border-default);
  border-radius: var(--r-sm);
  background: var(--surface-card);
  color: var(--text-secondary);
  cursor: pointer;
}

.left-sidebar--collapsed .left-sidebar-toggle {
  justify-content: center;
  padding: 0;
}

.left-sidebar-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .left-sidebar-shell {
    transition: none;
  }
}
```

- [ ] **Step 5: Verify**

Run:

```bash
npx pnpm --filter web test src/hooks/useSidebarRailPreference.test.ts src/components/LeftSidebar.test.tsx src/components/FeedLayout.test.tsx
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/FeedLayout.tsx apps/web/src/styles/index.css apps/web/src/components/FeedLayout.test.tsx
git commit -m "feat(web): wire sidebar rail state into feed layout"
```

---

### Task 4: Browser verification, graph refresh, and PR readiness

**Files:**
- Create: `apps/web/e2e/sidebar-icon-rail.spec.ts`
- Update generated graph files: `graphify-out/`

**Interfaces:**
- Produces: Playwright coverage for desktop expanded/collapsed, 768px collapsed, and mobile bottom navigation using the existing DEV-only `?dev-auth=1` design-verification path.

- [ ] **Step 1: Add the Playwright spec**

Create `apps/web/e2e/sidebar-icon-rail.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test.describe('Sidebar icon rail', () => {
  test('collapses and expands on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/feed?dev-auth=1')

    const grid = page.locator('.feed-layout-grid')
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
    await expect(grid).toHaveAttribute('data-left-sidebar', 'expanded')

    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await expect(grid).toHaveAttribute('data-left-sidebar', 'collapsed')
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible()

    const leftBox = await page.locator('.feed-layout-left').boundingBox()
    expect(leftBox?.width).toBeGreaterThanOrEqual(68)
    expect(leftBox?.width).toBeLessThanOrEqual(72)

    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect(grid).toHaveAttribute('data-left-sidebar', 'expanded')
  })

  test('keeps the 68px rail at 768px while right sidebar is hidden', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await page.goto('/feed?dev-auth=1')
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()

    await expect(page.locator('.feed-layout-right')).toBeHidden()
    const leftBox = await page.locator('.feed-layout-left').boundingBox()
    expect(leftBox?.width).toBeGreaterThanOrEqual(68)
    expect(leftBox?.width).toBeLessThanOrEqual(72)
  })

  test('keeps mobile bottom nav as primary navigation below 768px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/feed?dev-auth=1')

    await expect(page.locator('.feed-layout-left')).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toHaveCount(0)
  })
})
```

- [ ] **Step 2: Run focused and full validation**

Run:

```bash
npx pnpm --filter web test src/hooks/useSidebarRailPreference.test.ts src/components/LeftSidebar.test.tsx src/components/FeedLayout.test.tsx
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Then run the broader web test suite:

```bash
npx pnpm --filter web test
```

Expected: all tests pass, except a pre-existing `ShuttleMap.test.tsx` failure is acceptable only if it matches the known map-environment issue from earlier phases.

- [ ] **Step 3: Run Playwright verification**

Run the local app:

```bash
npx pnpm --filter web dev
```

Then run Playwright from another shell:

```bash
npx pnpm --filter web exec playwright test e2e/sidebar-icon-rail.spec.ts
```

Expected: the new spec passes in Chromium and verifies desktop expanded/collapsed, tablet collapsed, and mobile bottom-nav behavior.

- [ ] **Step 4: Refresh graphify output**

Run:

```bash
graphify update .
```

Expected: graph refresh completes. Dirty `graphify-out/` files are expected and should be included only if the command changes tracked graph files.

- [ ] **Step 5: Final review package**

Before opening the PR, run a whole-branch review against the merge base:

```bash
git merge-base main HEAD
git diff --stat main...HEAD
git diff --check
```

Fix any Critical or Important review findings before PR creation.

- [ ] **Step 6: Commit verification artifacts**

Commit the Playwright spec and any tracked graph changes from `graphify update .`:

```bash
git add apps/web/e2e/sidebar-icon-rail.spec.ts graphify-out
git commit -m "test(web): verify sidebar icon rail behavior"
```
