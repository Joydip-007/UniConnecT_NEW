# Shell delta — what changed after ROLE_SCREENS_PROMPT.md

Read this **before** acting on `ROLE_SCREENS_PROMPT.md` or `SIDEBAR_ROLES_PROMPT.md`.
Those two were written against the mockups; this file is the correction pass after
reading the real `apps/web/src` at `158c0238`. Where they disagree, this file wins.

Paste everything below the line into Claude Code at the repo root of
`Joydip-007/UniConnecT_NEW` (branch `main`).

---

## A. Four things already built — delete them from the plan

Do not implement these. They exist and work; touching them is churn.

1. **The avatar menu is done.** `TopNav.tsx` already renders a `role="menu"` dropdown
   off the avatar with View profile, Settings, Sign out, full keyboard support
   (Escape restores focus to the trigger, ArrowUp/ArrowDown cycle `menuitem` and
   `menuitemradio`), and click-outside handling. The only thing missing is the
   **chevron affordance** next to the 32px avatar — add that one element and stop.
2. **Theme switching is done, and it is 3-state.** The menu holds a
   Sun / Moon / Monitor `menuitemradio` group bound to `useThemeStore`'s
   `ThemeMode = 'light' | 'dark' | 'system'`. Earlier prompts told you to keep a
   2-state toggle — **that was wrong**; leave the 3-state group alone. A separate
   `ThemeToggleButton.tsx` also exists; do not add a third control.
3. **Light mode is done.** `styles/tokens.css` ships
   `:root[data-theme='light']`; `themeStore.ts` persists and applies it. No token work
   remains — do not edit `tokens.css`.
4. **Collapse is done.** `useSidebarRailPreference` +
   `left-sidebar--collapsed` handle it, and the collapsed rail is **68px, not 72px**.
   Match 68px everywhere (mockups and prompts say 72px; the code is correct).
   `NavItem` already moves the badge to the icon corner and uses `title` +
   `aria-label` for the collapsed tooltip.

## B. The icon set is Lucide, not Phosphor

`LeftSidebar.tsx` and `TopNav.tsx` both `import { … } from 'lucide-react'`, and the
design system's own guide specifies Lucide. `SIDEBAR_ROLES_PROMPT.md` and
`ROLE_SCREENS_PROMPT.md` say `@phosphor-icons/react` — **ignore that**. Do not add a
second icon dependency. Sizes are already correct in code: 17px rail nav, 16px top nav,
15px campus tools, 12px the external-link hint.

Icons already imported and available for the role rails: `Home Compass Users Network
Calendar Briefcase Newspaper MessageSquare Bus PackageSearch FileText UserCircle2
BookOpen BarChart2 ExternalLink PanelLeftClose PanelLeftOpen ShieldCheck Handshake
GraduationCap`. For the new role rows you will additionally need `Megaphone`
(announcements), `ClipboardList` (attendance, trip log, audit), `Map` (route and stops),
`Wrench` (report issue), `CheckCircle2` (verifications), `AlertTriangle` (on duty,
expiring) — all exist in Lucide.

## C. Two rule violations to fix while you are in these files

1. **`NavItem`'s `hasDot` uses `var(--uc-orange)`.** That is the *self* token being
   used for a *network* signal (unread group activity). Per the self/network rule it
   must be `var(--uc-indigo)`. One-line fix in `LeftSidebar.tsx`.
2. **`TopNav.tsx` sets `backdropFilter: blur(12px)`** (plus the `WebkitBackdropFilter`
   twin) on the sticky header. The design system bans glassmorphism outright. Replace
   with a solid `var(--overlay-bg-strong)` — it is already the background value, so
   deleting the two blur lines is the whole fix. Verify the feed still reads cleanly
   scrolling underneath.

## C2. One new token: the label tier is too faint

The `11px / 0.04em` eyebrow label tier currently renders at `--text-tertiary`
(`rgba(235,235,235,.28)`). Against 12px meta text at 58% it disappears, and design
review raised it to **50%** on the right-rail labels. Promote that to a token rather
than leaving it as a one-off:

```css
/* dark block */
--text-label: rgba(235, 235, 235, 0.50);
/* :root[data-theme='light'] */
--text-label: rgba(38, 38, 38, 0.55);
```

This is the **one exception** to "do not edit tokens.css" — add these two lines, nothing
else. Then switch every `11px` eyebrow label to `var(--text-label)`: the left sidebar's
group labels and "Campus tools", the right-rail section labels ("finish your profile",
"people you may know", "upcoming", "trending now"), and the rail's
"shows up when relevant" eyebrow. `--text-tertiary` stays where it belongs — 12px meta,
dept and batch lines, timestamps, and placeholder text. Do not use an 8-digit hex
(`#EBEBEB80`) anywhere; the token is the only accepted form.

## D. What the real LeftSidebar means for the rail work

The component is 17.7KB and already has the right bones — **refactor it, do not
rewrite it**:

- `NavItem` and `CampusTool` are already the correct primitives (44px min target,
  `--r-sm`, press feedback, collapsed variants). Reuse them as-is for every role.
- The active pill is a **shared `layoutId="nav-active-pill"` framer-motion element**,
  so it animates between rows. Keep it. The 2px left indicator from the mockups is an
  *addition* inside the same absolutely-positioned block, not a replacement — and it is
  what makes the active row legible at 68px.
- `navGroups` is already a data array with a `user?.role === 'admin'` branch appended to
  the "You" group. That branch is the thing to generalise: replace the three hardcoded
  groups with `ROLE_SHELL[role].rail`, and delete the inline role check.
- `isActive(path)` already handles dynamic segments by splitting on `:`. Reuse it
  verbatim for contextual rows.
- The profile card cover is **60px tall** (mockups show 56px) and the avatar ring is
  already `var(--tenant-accent)`, not orange. Keep both. Only the **stats pair** becomes
  role-driven — it is currently hardwired to `connections` / `pendingReceived` via
  `useCountUp`, so the manifest supplies which two `profileData.stats` keys to read and
  their labels.
- Campus tools are currently three hardcoded `<CampusTool>` calls with two
  `window.open` externals. Make the set manifest-driven; keep `ExternalLink` on
  external destinations only.

## E. Ordering — do it in this sequence

1. `config/roleShell.ts` with the manifest and a unit test that every `to` is a value
   in `PATHS` (this catches broken rows before any UI lands).
2. Refactor `LeftSidebar.tsx` to read the manifest; fix the orange dot; add the 2px
   indicator. Extend `LeftSidebar.test.tsx` per role.
3. `MobileBottomNav.tsx` mirrors each role's fixed rows from the same manifest.
4. `TopNav.tsx`: chevron, remove backdrop-filter, manifest-driven primary action and
   search placeholder, logo → `ROLE_SHELL[role].home`.
5. `router/index.tsx`: role-aware `/` resolver; driver hitting `/feed` redirects to
   `/shuttle/drive`. Every existing path in `PATHS` stays valid.
6. Split `RightSidebar.tsx` (23.5KB, student-shaped) into widgets keyed by
   `WidgetKey`; `FeedLayout.tsx` renders the manifest's three.
7. Page-level work last: `FeedPage` tabs, `JobsPage` alumni default, `ExplorePage`
   absorbing lost-and-found, `GroupsPage` people tab, `AdminPage` tab query param.

## F. Still true from the earlier prompts

The deciding rule (**a surface renders for a role only if that role can act on it**),
the five per-role payloads, the contextual-zone rules (2-row cap, rank order
live > action > deadline > network > self, tone → token, vanishes when the condition
clears), and the driver having no composer anywhere. Those stand as written.
