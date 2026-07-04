# Phase 3 — Role Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add platform-global role identity badges (glyph + tooltip + hover animation) beside every display name, replacing the current text-pill `Badge` role labels and the "Alumni · verified" conflation.

**Architecture:** New `--role-{role}` token families in `tokens.css` (dark + light), a shared `RoleBadge` component in `src/components/` (CSS-only hover animations, pill tooltip), rolled out across the six name-render sites that currently use duplicated `roleBadgeVariant`/`roleLabel` helpers. One small API change adds `role` to comment authors so `CommentDrawer` can render badges.

**Tech Stack:** React 18 + TypeScript, lucide-react icons, CSS custom properties, Vitest + React Testing Library (web), supertest (api).

**Branch:** `feature/role-badges`, created from `feature/design-polish` (Phase 2, PR #20 — stacked; PR targets main and collapses once #20 merges).

## Global Constraints

- No hardcoded hex in component code — always `var(--token)`. (Hex values are allowed only inside `tokens.css`.)
- Borders `0.5px solid`, never `1px`. No `box-shadow`. Buttons/pills `border-radius: var(--r-pill)`.
- Font weights 400/500 only. Sentence case everywhere ("Student", not "STUDENT").
- Animations: transform/opacity only, ≤300ms interactions, idle screens are still (badges never animate at rest — hover only), `prefers-reduced-motion` guarded.
- Motion durations/easings via tokens: `--dur-fast/med/slow`, `--ease-out-expo`.
- `pnpm` is not on PATH — always `npx pnpm …`.
- Known allowed test failure: `ShuttleMap.test.tsx` (fails on main too). Everything else must pass.
- Commit format `type(scope): description`.
- Two name slots rule: role badge (left of name, always). The showcased achievement badge (right slot) is Phase 4 — do NOT build it now.

---

### Task 1: Role token families

**Files:**
- Modify: `apps/web/src/styles/tokens.css` (dark block ends ~line 102; light block `:root[data-theme='light']` starts ~line 104)
- Modify: `docs/DESIGN.md` (append role token reference)

**Interfaces:**
- Produces: CSS custom properties `--role-{student|alumni|faculty|admin|driver}`, plus `-text`, `-bg`, `-bdr` suffixes, resolvable in both themes. Later tasks consume them via `var(--role-…)` only.

- [ ] **Step 1: Add dark-theme role tokens**

In `apps/web/src/styles/tokens.css`, inside the main `:root` block, immediately after the `--uc-red-bdr` line (~line 48), insert:

```css

  /* ── Role identity (spec §6) — platform-global, same meaning at every
     university. student/alumni/faculty alias existing families so they
     track theme overrides automatically; admin/driver are standalone and
     re-declared in the light block below. `-text` is the legible-on-card
     tone used for the glyph, tooltip text, and (optionally) the name. */
  --role-student:      var(--uc-indigo);
  --role-student-text: var(--uc-indigo-l);
  --role-student-bg:   var(--uc-indigo-bg);
  --role-student-bdr:  var(--uc-indigo-bdr);

  --role-alumni:       var(--uc-amber);
  --role-alumni-text:  var(--uc-amber-l);
  --role-alumni-bg:    var(--uc-amber-bg);
  --role-alumni-bdr:   var(--uc-amber-bdr);

  --role-faculty:      var(--uc-cyan);
  --role-faculty-text: #67E8F9;
  --role-faculty-bg:   var(--uc-cyan-bg);
  --role-faculty-bdr:  var(--uc-cyan-bdr);

  --role-admin:        #E8543F;
  --role-admin-text:   #F58A78;
  --role-admin-bg:     rgba(232, 84, 63, 0.10);
  --role-admin-bdr:    rgba(232, 84, 63, 0.28);

  --role-driver:       #8B99AD;
  --role-driver-text:  #B7C3D4;
  --role-driver-bg:    rgba(139, 153, 173, 0.10);
  --role-driver-bdr:   rgba(139, 153, 173, 0.28);
```

- [ ] **Step 2: Add light-theme overrides**

In the `:root[data-theme='light']` block, after the `--uc-red-bdr` line (~line 149), insert (the var()-aliased student/alumni families re-resolve automatically; faculty-text, admin, and driver need explicit darker steps for AA on white):

```css

  /* Role identity — light steps darker for AA (spec §6) */
  --role-faculty-text: #0E7490;

  --role-admin:        #B93A28;
  --role-admin-text:   #9C2F1F;
  --role-admin-bg:     rgba(185, 58, 40, 0.10);
  --role-admin-bdr:    rgba(185, 58, 40, 0.25);

  --role-driver:       #52617A;
  --role-driver-text:  #43506A;
  --role-driver-bg:    rgba(82, 97, 122, 0.08);
  --role-driver-bdr:   rgba(82, 97, 122, 0.22);
```

- [ ] **Step 3: Document in docs/DESIGN.md**

Append a short "Role tokens" subsection to the token reference in `docs/DESIGN.md` (match the file's existing table style): list the five families, the `-text/-bg/-bdr` suffix convention, the aliasing note (student/alumni/faculty alias core families), and the rule "role colors decorate identity only — never buttons or links".

- [ ] **Step 4: Verify**

Run: `npx pnpm --filter web build`
Expected: build succeeds (CSS parse check). Also visually grep your own diff: every new value in `tokens.css` only; no component files touched.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles/tokens.css docs/DESIGN.md
git commit -m "feat(web): role identity token families (spec §6)"
```

---

### Task 2: RoleBadge component

**Files:**
- Create: `apps/web/src/components/RoleBadge.tsx`
- Modify: `apps/web/src/styles/index.css` (append role-badge classes)
- Test: `apps/web/src/components/RoleBadge.test.tsx`

**Interfaces:**
- Consumes: role tokens from Task 1; `UserRole` from `@uniconnect/shared`; lucide-react (already a web dependency).
- Produces:
  - `RoleBadge({ role: UserRole, size?: number /* default 15 */, showTooltip?: boolean /* default true */ }): JSX.Element` — named export from `@/components/RoleBadge`.
  - `ROLE_LABEL: Record<UserRole, string>` — sentence-case labels (`Student`, `Alumni`, `Faculty`, `Admin`, `Driver`), exported for reuse.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/RoleBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoleBadge, ROLE_LABEL } from './RoleBadge'
import type { UserRole } from '@uniconnect/shared'

const ROLES: UserRole[] = ['student', 'alumni', 'faculty', 'admin', 'driver']

describe('RoleBadge', () => {
  it.each(ROLES)('renders an accessible %s badge with role class', (role) => {
    const { container } = render(<RoleBadge role={role} />)
    const badge = screen.getByRole('img', { name: ROLE_LABEL[role] })
    expect(badge).toBeInTheDocument()
    expect(container.querySelector(`.role-badge--${role}`)).toBe(badge)
  })

  it('renders the tooltip label by default, hidden from AT', () => {
    const { container } = render(<RoleBadge role="student" />)
    const tip = container.querySelector('.role-badge__tip')
    expect(tip).toHaveTextContent('Student')
    expect(tip).toHaveAttribute('aria-hidden', 'true')
  })

  it('omits the tooltip when showTooltip is false', () => {
    const { container } = render(<RoleBadge role="student" showTooltip={false} />)
    expect(container.querySelector('.role-badge__tip')).toBeNull()
  })

  it('sizes the glyph box from the size prop', () => {
    const { container } = render(<RoleBadge role="faculty" size={14} />)
    const badge = container.querySelector('.role-badge') as HTMLElement
    expect(badge.style.width).toBe('14px')
    expect(badge.style.height).toBe('14px')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter web test src/components/RoleBadge.test.tsx`
Expected: FAIL — cannot resolve `./RoleBadge`.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/components/RoleBadge.tsx`:

```tsx
import type { UserRole } from '@uniconnect/shared'
import { BookOpen, Bus, GraduationCap, Medal, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Student',
  alumni: 'Alumni',
  faculty: 'Faculty',
  admin: 'Admin',
  driver: 'Driver',
}

const ROLE_ICON: Record<UserRole, LucideIcon> = {
  student: GraduationCap,
  alumni: Medal,
  faculty: BookOpen,
  admin: Shield,
  driver: Bus,
}

interface RoleBadgeProps {
  role: UserRole
  /** Glyph box in px — spec §6 says 14–16. */
  size?: number
  showTooltip?: boolean
}

export function RoleBadge({ role, size = 15, showTooltip = true }: RoleBadgeProps) {
  const Icon = ROLE_ICON[role]
  return (
    <span
      className={`role-badge role-badge--${role}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ROLE_LABEL[role]}
    >
      <Icon size={size} strokeWidth={1.75} className="role-badge__glyph" aria-hidden />
      {showTooltip && (
        <span className="role-badge__tip" aria-hidden="true">
          {ROLE_LABEL[role]}
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 4: Add the CSS**

Append to `apps/web/src/styles/index.css`:

```css
/* ── Role badge (spec §6) ─────────────────────────────────────────────────
   Idle-calm: never animates at rest — hover/focus only. Transform/opacity
   only. Per-role color channels are set once via the --role-c-* indirection
   so the shared rules below stay role-agnostic. */
.role-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
  color: var(--role-c-text);
}
.role-badge--student { --role-c-text: var(--role-student-text); --role-c-bg: var(--role-student-bg); --role-c-bdr: var(--role-student-bdr); }
.role-badge--alumni  { --role-c-text: var(--role-alumni-text);  --role-c-bg: var(--role-alumni-bg);  --role-c-bdr: var(--role-alumni-bdr); }
.role-badge--faculty { --role-c-text: var(--role-faculty-text); --role-c-bg: var(--role-faculty-bg); --role-c-bdr: var(--role-faculty-bdr); }
.role-badge--admin   { --role-c-text: var(--role-admin-text);   --role-c-bg: var(--role-admin-bg);   --role-c-bdr: var(--role-admin-bdr); }
.role-badge--driver  { --role-c-text: var(--role-driver-text);  --role-c-bg: var(--role-driver-bg);  --role-c-bdr: var(--role-driver-bdr); }

.role-badge__glyph {
  transition: transform var(--dur-med) var(--ease-out-expo);
  transform-origin: 50% 75%;
}

/* Tooltip pill — slides in ~200ms on hover (spec §6) */
.role-badge__tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translate(-50%, 4px);
  opacity: 0;
  pointer-events: none;
  padding: 5px 9px;
  border-radius: var(--r-pill);
  border: 0.5px solid var(--role-c-bdr);
  background: var(--surface-raised);
  background-image: linear-gradient(var(--role-c-bg), var(--role-c-bg));
  color: var(--role-c-text);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  z-index: var(--z-popover);
  transition:
    opacity var(--dur-med) var(--ease-out-expo),
    transform var(--dur-med) var(--ease-out-expo);
}
.role-badge:hover .role-badge__tip {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* Per-role hover animations — hover-capable pointers, motion-safe only */
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .role-badge--student:hover .role-badge__glyph { transform: rotate(-14deg); } /* cap tips */
  .role-badge--driver:hover  .role-badge__glyph { transform: rotate(10deg); }  /* micro-rotation */
  .role-badge--faculty:hover .role-badge__glyph { animation: role-book-flip 0.3s var(--ease-out-expo); }
  .role-badge--alumni:hover  .role-badge__glyph { animation: role-shimmer 0.45s var(--ease-out-expo); }
  .role-badge--admin:hover::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 0.5px solid var(--role-c-bdr);
    animation: role-pulse-ring 1.4s var(--ease-out-expo) infinite;
  }
}

@keyframes role-book-flip {
  0%   { transform: scaleX(1); }
  50%  { transform: scaleX(0.7); }
  100% { transform: scaleX(1); }
}
@keyframes role-shimmer {
  0%   { opacity: 1; }
  35%  { opacity: 0.45; transform: translateX(-1px); }
  70%  { opacity: 1; transform: translateX(1px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes role-pulse-ring {
  0%   { transform: scale(0.85); opacity: 0.9; }
  100% { transform: scale(1.35); opacity: 0; }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx pnpm --filter web test src/components/RoleBadge.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck + lint, then commit**

Run: `npx pnpm typecheck && npx pnpm lint`
Expected: clean.

```bash
git add apps/web/src/components/RoleBadge.tsx apps/web/src/components/RoleBadge.test.tsx apps/web/src/styles/index.css
git commit -m "feat(web): RoleBadge component with tooltip and hover animations"
```

---

### Task 3: API — comment authors carry role

**Files:**
- Modify: `packages/shared/src/types/feed.ts:75-80` (`FeedComment['author']`)
- Modify: `apps/api/src/modules/feed/service.ts` — `CommentRow` interface (~line 84-95), `commentSelectQuery` (~line 1191), `toComment` (~line 1374)
- Test: `apps/api/src/__tests__/feed.test.ts`

**Interfaces:**
- Consumes: existing `users` join already present in `commentSelectQuery`.
- Produces: `FeedComment.author.role: UserRole` in every comment API response — Task 4's `CommentDrawer` renders from it.

- [ ] **Step 1: Write the failing integration test**

In `apps/api/src/__tests__/feed.test.ts`, add a new describe (follow the existing pattern — `api`, `authHeader(studentToken)`, `createdPostIds` are already in scope):

```ts
describe('GET /api/v1/posts/:postId/comments — author role', () => {
  it('includes the author role on each comment', async () => {
    const postRes = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: 'Post for comment role test', type: 'post' })
    const postId = postRes.body.data.id as string
    createdPostIds.push(postId)

    await api
      .post(`/api/v1/posts/${postId}/comments`)
      .set(authHeader(studentToken))
      .send({ content: 'Role-bearing comment' })

    const res = await api
      .get(`/api/v1/posts/${postId}/comments`)
      .set(authHeader(studentToken))

    expect(res.status).toBe(200)
    const comment = res.body.data.items[0]
    expect(comment.author.role).toBe('student')
  })
})
```

Note: check how the existing comments GET is shaped in `apps/api/src/modules/feed/router.ts` first — if the list response is `{ data: { items } }` keep the assertion above; if it's `{ data: [...] }` adjust to `res.body.data[0]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/__tests__/feed.test.ts`
Expected: FAIL — `comment.author.role` is `undefined`.

- [ ] **Step 3: Implement**

1. `apps/api/src/modules/feed/service.ts`, `CommentRow` interface — after `author_headline: string | null` add:

```ts
  author_role: UserRole
```

(`UserRole` is imported from `@uniconnect/shared` — add to the existing import if missing.)

2. In `commentSelectQuery`, after `'profiles.headline as author_headline',` add:

```ts
      'users.role as author_role',
```

3. In `toComment`, inside `author: {`, after `headline: row.author_headline,` add:

```ts
      role: row.author_role,
```

4. `packages/shared/src/types/feed.ts` — `FeedComment.author` becomes:

```ts
  author: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    role: UserRole
  }
```

- [ ] **Step 4: Run tests**

Run: `npx pnpm --filter api test src/__tests__/feed.test.ts`
Expected: PASS.

Run: `npx pnpm typecheck`
Expected: the api and shared packages pass. If the web package now fails on comment fixtures (MSW handlers or tests missing `role`), add `role: 'student'` to those fixture authors in this task — the type change owns its fallout.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/feed.ts apps/api/src/modules/feed/service.ts apps/api/src/__tests__/feed.test.ts
git commit -m "feat(api): include author role on comment responses"
```

---

### Task 4: Feed rollout — PostCard, OriginalPostEmbed, CommentDrawer

**Files:**
- Modify: `apps/web/src/features/feed/components/PostCard.tsx` (helpers ~lines 47-59, header render ~lines 419-433)
- Modify: `apps/web/src/features/feed/components/OriginalPostEmbed.tsx` (helper ~lines 12-16, render ~lines 70-77)
- Modify: `apps/web/src/features/feed/components/CommentDrawer.tsx` (author name row ~lines 138-144)
- Test: `apps/web/src/features/feed/components/PostCard.test.tsx`

**Interfaces:**
- Consumes: `RoleBadge` from `@/components/RoleBadge` (Task 2); `comment.author.role` (Task 3).
- Produces: nothing new — pure call-site migration.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/features/feed/components/PostCard.test.tsx`, add (the fixture author role is `'student'`):

```tsx
it('renders a role badge beside the author name', () => {
  renderPostCard() // use this file's existing render helper/pattern
  expect(screen.getByRole('img', { name: 'Student' })).toBeInTheDocument()
  expect(screen.queryByText('Student', { selector: '.role-badge__tip' })).toBeInTheDocument()
})
```

Adapt the render call to whatever helper the file already uses (it renders PostCard with the `role: 'student'` fixture) — do not build a new harness.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/feed/PostCard.test.tsx`
Expected: new test FAILS (no `img` role element); existing tests pass.

- [ ] **Step 3: Migrate PostCard**

1. Delete the local `roleBadgeVariant` and `roleLabel` functions (lines 49-59).
2. Remove `Badge` from imports **only if** it is now unused in the file (search first — `PinnedBar`/other usages may remain); add `import { RoleBadge } from '@/components/RoleBadge'`.
3. Replace the header name row (lines 419-426 region):

```tsx
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <RoleBadge role={author.role} size={15} />
              <Link
                to={authorProfileUrl}
                style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}
              >
                {author.fullName}
              </Link>
              {author.profile.department && (
```

(The badge sits LEFT of the name per spec §6; the text `Badge` pill is gone. The department `· dept 'YY` span stays.)

- [ ] **Step 4: Migrate OriginalPostEmbed**

Delete the local `roleBadgeVariant`, drop the `Badge` import, import `RoleBadge`, and replace the name row:

```tsx
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <RoleBadge role={post.author.role} size={13} />
            <Link
              to={authorProfileUrl}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}
            >
              {post.author.fullName}
            </Link>
          </div>
```

- [ ] **Step 5: Add badge to CommentDrawer**

In the comment author row (~line 138), add the badge left of the name link:

```tsx
            <RoleBadge role={comment.author.role} size={13} />
            <Link
              to={authorProfileUrl}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}
            >
              {comment.author.fullName}
            </Link>
```

(Import `RoleBadge` at the top. The surrounding flex row already has `gap: 6`.)

- [ ] **Step 6: Run tests, typecheck, lint**

Run: `npx pnpm --filter web test src/features/feed && npx pnpm typecheck && npx pnpm lint`
Expected: PASS/clean. Fix any comment fixtures still missing `role`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/feed
git commit -m "feat(feed): role badges on post, embed, and comment authors"
```

---

### Task 5: Rollout — ProfileHeader, ConnectionCard, RightSidebar, NewConversationModal

**Files:**
- Modify: `apps/web/src/features/profile/components/ProfileHeader.tsx` (helpers ~lines 19-29, render ~line 119)
- Modify: `apps/web/src/features/connections/components/ConnectionCard.tsx` (helpers ~lines 17-25, render ~lines 97-101)
- Modify: `apps/web/src/components/RightSidebar.tsx` (helpers ~lines 66-77, render ~lines 229-231)
- Modify: `apps/web/src/features/messages/components/NewConversationModal.tsx` (`ROLE_BADGE` map ~lines 43-50, render ~line 119)

**Interfaces:**
- Consumes: `RoleBadge` from `@/components/RoleBadge`.
- Produces: nothing new. **Do not touch** `MemberRoleTag` in groups — group roles (admin/moderator/member) are a different concept from platform roles.

- [ ] **Step 1: ProfileHeader**

Delete `roleBadgeVariant`/`roleLabel`, import `RoleBadge`. In the name row (~line 106-119), place the role badge immediately LEFT of the name and keep the existing `isVerified` BadgeCheck as a separate signal AFTER the name (spec: role and verification are separate signals):

```tsx
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <RoleBadge role={user.role} size={16} />
            <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {fullName}
            </span>
            {user.isVerified && (
              <span
                aria-label="Verified"
                title="Verified"
                style={{ display: 'inline-flex', color: 'var(--uc-cyan)', lineHeight: 0 }}
              >
                <BadgeCheck size={14} strokeWidth={1.75} />
              </span>
            )}
            {user.profile.department && (
```

(The `<Badge variant={roleBadgeVariant(...)}>` line is removed; the department `Badge variant="neutral"` stays. Keep the `Badge` import if the department pill still uses it.)

- [ ] **Step 2: ConnectionCard**

Delete the two helpers, import `RoleBadge`, and replace the role pill:

```tsx
          {user?.role && <RoleBadge role={user.role as UserRole} size={14} />}
```

Place it inside the same name flex row, left of the name `Link` if layout allows; if the row wasn't a flex row with a gap, wrap name + badge in `<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>`. Remove the `Badge` import if now unused.

- [ ] **Step 3: RightSidebar**

Delete `roleBadgeVariant`/`roleLabel` (this removes the "Alumni · verified" conflation). Import `RoleBadge`. Put `<RoleBadge role={user.role} size={13} />` beside `{user.profile.fullName}` inside a flex row (`display: 'flex', alignItems: 'center', gap: 5`) and delete the `<Badge variant=… className="mt-0.5">` element entirely. The user's headline/department line (if any) is unaffected. Remove the `Badge` import if now unused in the file.

- [ ] **Step 4: NewConversationModal**

Delete the `ROLE_BADGE` map and the local `BadgeVariant` type, import `RoleBadge`, replace:

```tsx
          <RoleBadge role={user.role} size={13} />
```

placed left of the `{user.fullName}` span in its existing flex row; delete the `<Badge …>{user.role}</Badge>` element (this also fixes the lowercase raw-role label). Remove the `Badge` import if now unused.

- [ ] **Step 5: Sweep for leftovers**

Run: `grep -rn "roleBadgeVariant\|roleLabel\|ROLE_BADGE" apps/web/src`
Expected: no matches. If any new site appears, migrate it the same way.

- [ ] **Step 6: Tests, typecheck, lint**

Run: `npx pnpm --filter web test && npx pnpm typecheck && npx pnpm lint`
Expected: all pass except the known `ShuttleMap.test.tsx` failure. Fix any snapshot/query assertions that referenced the old text pills (e.g. tests querying `getByText('Student')` on a pill).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): roll out RoleBadge across profile, connections, sidebar, and messages"
```

---

### Task 6: Final verification + screenshots

**Files:**
- Modify: `screenshots/*.png` (regenerate affected pages)
- Modify: `.superpowers/sdd/progress.md` (append Phase 3 ledger — done by controller, listed for completeness)

- [ ] **Step 1: Full suite**

Run: `npx pnpm typecheck && npx pnpm lint && npx pnpm test`
Expected: clean, except the pre-existing `ShuttleMap.test.tsx` failure (confirm it is the ONLY failure).

- [ ] **Step 2: Screenshots**

With the Vite dev server running (`npx pnpm --filter web dev`):

```bash
node scripts/screenshot.cjs feed
node scripts/screenshot.cjs profile
```

Replace old files (never keep both). Visually inspect both PNGs: role badge glyph left of names, no text role pills, no "Alumni · verified", verified check still separate on profile.

- [ ] **Step 3: Commit**

```bash
git add screenshots
git commit -m "chore(web): refresh reference screenshots after role badges"
```

---

## Self-review notes

- Spec §6 coverage: tokens ✓ (Task 1), RoleBadge component with size/showTooltip props ✓ (Task 2), 14–16px left of name ✓ (Tasks 4-5), tooltip pill ~200ms ease-out-expo ✓, per-role hover animations CSS-only + reduced-motion guarded ✓, idle-calm ✓, "Alumni · verified" split ✓ (Task 5 RightSidebar + ProfileHeader keeps separate BadgeCheck), two-slots rule: right slot deferred to Phase 4 by design.
- Deviation, deliberate: spec says "the name itself uses the role's text token" — NOT implemented; names stay `--text-primary`. Rationale: recoloring every display name by role harms readability and text hierarchy across dense lists; the glyph already carries the identity. Flag this in the PR body for the user to overrule if desired.
- `driver` role never appears in the social app (walled off), but RoleBadge supports it for completeness (admin panel user lists may render it later).
