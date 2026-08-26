# Role-aware app shell — master prompt

> Read `SHELL_DELTA_PROMPT.md` first: four items below are already built, and the icon
> set and theme-control notes here are corrected there.

Paste everything below the line into Claude Code at the repo root of
`Joydip-007/UniConnecT_NEW` (branch `main`). Visual reference: `5a`–`5e` (full pages
per role) and `4a`–`4e` (rails only) in `Feed Mockups.dc.html`. Read
`SIDEBAR_ROLES_PROMPT.md` first — this prompt assumes the rail spec and extends it to
the rest of the app. Tokens are already shipped; do not edit `styles/tokens.css`.

---

Make the whole authenticated shell role-aware for the five roles in `ROLE_LABEL`
(student, alumni, faculty, admin, driver). One shell, five payloads.

## 0. The rule that decides everything

**A surface renders for a role only if that role can act on it.** No disabled states as
a substitute, no empty widgets, no rows that lead to a 403. Every difference below
follows from that one rule, so when a new feature lands, ask the same question rather
than adding a flag.

What stays constant for all roles: the three-column grid (232 / 1fr / 272), the four
rail zones, the token roles, 0.5px borders, pill buttons, 44px minimum targets, sentence
case. What varies: the fixed rail rows, the top-nav primary action, whether a composer
exists at all, the centre column's first block, and the right rail's three widgets.

## 1. One source of truth

Extend the rail config into a single role manifest — new file
`config/roleShell.ts`, imported by the rail, the top nav, the mobile nav and the home
route resolver:

```ts
export type RoleShell = {
  home: string                    // where '/' and the logo resolve to
  primaryAction: { label: string; to: string; kind: 'compose' | 'navigate' }
  composer: false | { placeholder: string; tools: ComposerTool[] }
  searchScope: SearchScope[]      // drives the placeholder AND the query
  feedTabs: string[] | false
  rail: RoleRail                  // from SIDEBAR_ROLES_PROMPT.md
  rightRail: WidgetKey[]          // exactly three
  stats: [StatSource, StatSource]
}
export const ROLE_SHELL: Record<UserRole, RoleShell>
```

No `user.role === 'admin'` checks sprinkled through components. If a component needs to
branch, it reads the manifest.

## 2. Per-role home screens

### Student — `/feed`
Primary action **Post**. Composer "What's on your mind?" with photo, poll, event.
Feed tabs All / Campus news / My groups / Jobs (these replace the News rail row).
Right rail: profile completeness, people you may know, upcoming events.
The only role whose home is a social feed.

### Alumni — `/feed`
Primary action **Post a job**. Composer "Share an opportunity or an update" with job,
photo, event. Tabs All / My postings / Mentees / Batch.
Centre's first block is a **posting performance card** (views, applicants, shortlisted,
review action) — alumni contribute more than they browse, so authoring outranks reading.
Right rail: mentee requests (accept / later inline), reunion RSVP, batch + directory.
`/jobs` for alumni defaults to `postedByMe`.

### Faculty — `/feed`
Primary action **Announce**. Composer "Post an announcement to your sections" with
announcement, attachment, poll.
Centre leads with **next class** (timetable slot within 30m, attendance + notify
actions) then announcements, then an **unanswered queries** block with inline reply.
Right rail: my sections with head counts, grade-submission deadline, office hours.
Sections, not groups, are the unit of navigation.

### Driver — `/shuttle/drive`
**No feed, no composer anywhere in the shell.** `/` and the logo resolve to the duty
board; `/feed` for a driver redirects there.
Primary action **Start trip**. Centre: active shift card (route, trip n of m, next stop,
passengers, arrived / skip / end trip), today's trip list with done / running / next
states, and the end-of-shift fuel-and-mileage log.
Right rail: live map, notices, week's totals.
`DriverRoute.tsx` already guards the page; the shell must stop offering routes a driver
cannot use.

### Admin — `/admin`
Primary action **Broadcast**. In place of a composer, a **broadcast composer** with an
audience selector and pin-to-feed.
Centre: moderation queue with inline keep / remove, then verification requests with
verify / reject. Tabs Moderation / Verifications / Members / Insights map to
`AdminPage` tabs via query params — **do not add new routes**.
Right rail: platform-today counters, invite batches with expiry, audit trail.
Admin still keeps read access to the feed via the rail's Home row.

## 3. Surfaces that change

- **`components/TopNav.tsx`** — primary action comes from the manifest; the avatar menu already
  exists with Profile, Settings, theme and Sign out, so only add the chevron affordance;
  also delete the banned `backdropFilter: blur(12px)` on the header; search placeholder
  and query scope come from `searchScope`. The logo links to `ROLE_SHELL[role].home`.
- **`components/FeedLayout.tsx`** — right-rail widget set comes from the manifest, not
  from `RightSidebar`'s internals. Driver and Admin use the same grid with different
  payloads; do not fork the layout.
- **`components/MobileBottomNav.tsx`** — 5 slots mirror that role's fixed rows (Driver:
  4 + More). The More sheet lists exactly what the rail demoted.
- **`components/RightSidebar.tsx`** — split into widget components keyed by
  `WidgetKey`, each self-hiding when it has no data. It is currently 23KB of
  student-shaped assumptions.
- **`pages/FeedPage.tsx`** — filter tabs; default tab per role; for driver, redirect.
- **`pages/JobsPage.tsx`** — alumni default to their own postings with an applicants
  view; students see the browse view.
- **`pages/ExplorePage.tsx`** — absorbs Explore + Lost & found as tabs (`/lost-found`
  stays routable).
- **`pages/GroupsPage.tsx`** — gains a People tab so `/connections` folds in
  (still routable); for faculty, an academic-sections view first.
- **`pages/AdminPage.tsx`** — accept a tab query param so the rail and centre tabs can
  deep-link.
- **`router/index.tsx`** — add a role-aware index resolver for `/` instead of a hard
  `/feed`; keep every existing path valid so no deep link breaks.
- **`pages/ProfilePage.tsx`** — reached from the avatar menu now; keep the role badge
  and role-specific stats pair (student connections/pending, alumni
  connections/mentees, faculty sections/students, driver route/trips, admin
  members/verifications).

## 4. Tests to add or extend

- `components/LeftSidebar.test.tsx` — per role: fixed-row count and order, contextual
  show/hide on condition flip, 2-row cap plus `+n more`, and no row that the route
  guards would reject.
- `components/FeedLayout.test.tsx` — the right rail renders exactly the manifest's three
  widgets per role.
- A new `config/roleShell.test.ts` — every `UserRole` key exists, every `to` is a value
  in `PATHS`, driver's manifest has `composer: false`, and no role's fixed rows exceed 5.
- Route-guard test: a driver hitting `/feed` lands on the duty board; a student hitting
  `/admin` lands on the feed.

## 5. Guardrails

- No new colour values; tone → token mapping as in `SIDEBAR_ROLES_PROMPT.md`. The one
  exception is `--text-label` (see `SHELL_DELTA_PROMPT.md` section C2): every 11px
  eyebrow label in the shell, including all three right-rail widget labels per role,
  uses it instead of `--text-tertiary`.
- No emoji, no em dashes, sentence case everywhere.
- Icons from `lucide-react`: 17px rail, 16px top nav, 15px tool tiles.
- The TopNav theme control is already 3-state (light/dark/system); leave it as is.
- Ship it behind the manifest, not behind feature flags per role — the manifest *is*
  the flag.
