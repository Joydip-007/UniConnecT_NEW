# Contextual left rail for all five roles — master prompt

> Read `SHELL_DELTA_PROMPT.md` first: it corrects the icon set, the collapsed width and
> the theme-control note below, against the real codebase.

Paste everything below the line into Claude Code at the repo root of
`Joydip-007/UniConnecT_NEW` (branch `main`). Visual reference: `4a`–`4e` in
`Feed Mockups.dc.html`. Token work is already done and shipped — do not touch
`styles/tokens.css`.

---

Rebuild the left sidebar as a **role-aware contextual rail** and update every surface
that its logic touches. Keep the existing profile mini-card exactly as it is (cover
dot-pattern, avatar ring, online dot, stats block) — only its stats labels change per
role. Do not change tokens, radii, the 0.5px border rule, or the pill rule.

## 0. The pattern

Four zones, top to bottom, in every role:

1. **Collapse toggle** — already backed by `hooks/useSidebarRailPreference.ts`
   (`uc:left-sidebar-collapsed`). Collapsed = 68px icon rail (the width already in code).
2. **Profile mini-card** — unchanged component; role badge from
   `components/RoleBadge.tsx` + `RoleBadge.constants.ts`; stats pair is role-specific.
3. **Fixed rows** — max 5 (Driver gets 4). Permanent, order never changes, 44px,
   17px icon, active row gets the `--uc-indigo-bg` tint **plus** a 2px
   `--uc-indigo` left indicator (the indicator is what survives collapse).
4. **Contextual zone** — 0 to 2 rows that exist only while their condition is true,
   then vanish. Under an `11px / 0.04em` "shows up when relevant" eyebrow, coloured
   `var(--text-label)` (see `SHELL_DELTA_PROMPT.md` section C2) — not
   `--text-tertiary`, which is too faint for this tier.
5. **Campus tools** — 3-up grid of icon tiles, role-specific set.

Everything not in the rail must still be reachable: search, the top-nav avatar menu,
or in-page navigation. No route may become orphaned — verify against
`router/paths.ts`.

## 1. Role configuration

Drive this from one exported table, not conditionals scattered in JSX. Suggested shape
in a new `components/leftSidebar.config.ts`:

```ts
type RailRow   = { key: string; label: string; icon: Icon; to: string; badge?: BadgeSource }
type CtxRule   = { key: string; label: string; icon: Icon; to: string
                   tone: 'self' | 'network' | 'live' | 'deadline' | 'action'
                   when: (ctx: RailContext) => false | { meta: string; rank: number }
                   pinned?: boolean }
type RoleRail  = { fixed: RailRow[]; contextual: CtxRule[]; tools: ToolTile[]
                   stats: [StatSource, StatSource] }
export const RAILS: Record<UserRole, RoleRail>
```

`UserRole` comes from `@uniconnect/shared` — the five keys in `ROLE_LABEL`.

### Student
- Fixed: Home `/feed` · Groups & people `/groups` · Events `/events` · Jobs `/jobs` ·
  Mentorship `/mentorship`
- Stats: connections · pending
- Contextual: Drafts (`draftCount > 0`, self) · Shuttle arriving (`etaMinutes <= 10`,
  live) · Application update (a job application changed state, network) · Event starting
  (RSVP'd event within 60m, live) · Registration open (window active, deadline)
- Tools: Shuttle `/shuttle` · eLMS (external) · CGPA calculator

### Alumni
- Fixed: Home · Groups & people · Events · **My postings** `/jobs` (authoring, not
  browsing — filtered to `postedByMe`) · **Mentees** `/mentorship`
- Stats: connections · mentees
- Contextual: New applicants (`applicantCount > 0`, deadline) · Mentee requests
  (pending, network) · Reunion / convocation RSVP (event window, network) · Drafts (self)
- Tools: Directory `/connections` · Post a job · Shuttle
- No CGPA, no eLMS.

### Faculty
- Fixed: Home · **My sections** (`/groups` filtered to academic groups) ·
  Groups & people · Events · **Announcements** (`/news`, authoring)
- Stats: sections · students
- Contextual: Student queries (unanswered > 0, network) · Class in Nm (next timetable
  slot within 30m, live) · Grade submission (window open, deadline) · Section join
  requests (action)
- Tools: eLMS · Attendance · Shuttle
- Announcements is fixed because posting is a duty, not a browse.

### Driver
- Fixed (4): **Duty board** `/shuttle/drive` · Route & stops `/shuttle` ·
  Messages `/messages` · Notices `/news`
- Stats: route · trips today
- Contextual: **On duty now** (`shiftActive`, live, `pinned: true` — the one row that
  outlives a glance; it stays for the whole shift) · Log fuel / maintenance due
  (action) · Passenger alert (action)
- Tools: Trip log · Report issue · Live map
- No feed, no jobs, no groups, no mentorship. Driver never sees the composer.
  `DriverRoute.tsx` already guards `/shuttle/drive`; the rail must not offer routes a
  driver cannot use.

### Admin
- Fixed: Home · **Moderation** `/admin` (live count, never hidden) ·
  Members & invites `/admin` · Announcements `/news` · Insights `/admin`
- Stats: members · verifications
- Contextual: Verification requests (`pendingVerifications > 0`, action) · Invite batch
  expiring (`daysLeft <= 3`, deadline) · Escalated report (action) · Unsent broadcast
  draft (self)
- Tools: Audit log · Broadcast · Shuttle ops
- The three `/admin` rows deep-link to `AdminPage` tabs — add tab query params rather
  than new routes.

## 2. Contextual-zone rules

- **At most 2 rows visible.** If more conditions are true, show the highest `rank` and
  a single `+n more` row that opens the notifications page.
- **Rank order:** live > action > deadline > network > self.
- **Tone → token:** self `--uc-orange-bg` / `--uc-orange-l`; network `--uc-indigo-bg` /
  `--uc-indigo-l`; live `--uc-cyan-bg` / `--uc-cyan`; deadline `--uc-amber-bg` /
  `--uc-amber-l`; action `--role-admin-bg` / `--role-admin-text`.
- **Never a menu.** A contextual row must disappear when its condition clears. No
  dismiss-and-remember, no empty-state placeholder — an empty zone renders nothing,
  eyebrow included.
- **No layout thrash.** Rows enter with the existing `fadeUp` (700ms) and never
  reorder while the pointer is inside the zone; queue the change until `mouseleave`.
- **Accessibility:** the zone is a `<ul aria-live="polite" aria-label="Contextual
  shortcuts">`; each row keeps a 44px min target; collapsed rail exposes the label as
  the accessible name plus a tooltip.
- Poll cheaply: derive counts from existing query caches
  (`features/drafts`, `features/shuttle`, `features/mentorship`,
  `features/moderation`, `features/notifications`) — no new endpoint unless a count
  genuinely does not exist client-side.

## 3. Collapsed rail (68px)

Applies to every role. Icon-only 44px tiles, tooltip on hover/focus with the label,
active indicator retained, badges move to the icon's top-right corner. Profile card
collapses to the avatar with its ring and online dot. Tools become three stacked tiles.
State comes from `useSidebarRailPreference` — do not add a second store.

## 4. Other surfaces this changes

- **`components/TopNav.tsx`** — the avatar becomes a menu button (chevron affordance)
  owning Profile, Settings, theme, Sign out, since My profile leaves the rail. Search
  scope copy becomes "Search people, posts, events, lost & found". The primary action
  button is role-aware: Post (student) / Post a job (alumni) / Announce (faculty,
  admin) / Start trip (driver).
- **`components/MobileBottomNav.tsx`** — 5 slots must mirror that role's fixed rows
  (Driver: 4 slots + More). The More sheet lists exactly what the rail demoted.
  Mobile active colour follows the same indicator rule.
- **`pages/FeedPage.tsx`** — add filter tabs (All / Campus news / My groups / Jobs)
  so `/news` no longer needs a rail row; the News route stays valid and deep-linkable.
- **`pages/ExplorePage.tsx`** — absorbs Explore + Lost & found as tabs; keep
  `/lost-found` routable.
- **`pages/GroupsPage.tsx`** — gains a People tab so "My network" (`/connections`)
  folds into Groups & people; `/connections` stays routable for deep links.
- **`components/LeftSidebar.test.tsx`** — extend to cover all five roles: fixed-row
  count and order, contextual show/hide on condition flip, the 2-row cap and `+n more`,
  and that no role renders a row it cannot access per the route guards.

## 5. Guardrails

- No new colour values; only the tokens named above.
- Sentence case everywhere; no em dashes, no emoji in labels.
- Fixed rows never change order between sessions — muscle memory is the point.
- If a role's contextual list is empty, the rail is just card + fixed rows + tools.
  That is the correct resting state, not a gap to fill.
- The theme control in the TopNav menu is already a 3-state light/dark/system radio
  group. Leave it alone.
- Icons come from `lucide-react` (the repo's actual icon set, and what the design
  system specifies), 17px in the rail, 15px in tool tiles. Do not add a second icon
  dependency.
