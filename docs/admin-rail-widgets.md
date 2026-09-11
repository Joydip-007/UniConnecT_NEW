# Admin right rail — widget plan

The admin right rail is **route-aware**. Every other role gets a fixed list of four
widgets; admin gets exactly two, and both read the active `?tab=` and answer the screen
you are on. Source of truth: `Feed Page.dc.html` with `role = admin`, rendered and read
route by route (`adminWidgets()` in its `text/x-dc` script).

Two widget kinds, reused on every tab:

| Kind | Shape |
|---|---|
| **Queue** — what is waiting | Title + count pill (tone-coloured). 0–3 rows: 28px `--r-sm` icon tile, label, right-hand count pill in the same tone triple. Optional full-width outlined indigo CTA. Empty state is one 12px `--text-tertiary` line, never a hidden card. |
| **Stats** — whether that is normal | Title, then a 2-up grid of `--surface-raised` `--r-md` tiles: 11px label, 18px/500 value, 11px tone-coloured sub-line. |

**Order:** queue first, stats second — *except* Insights, which leads with the numbers
because nothing on that screen is itself actionable.

**Tone is a triple, never one colour** (`{color, bg, bdr}`), so the icon tile and count
pill are always painted from the same set: `red · amber · indigo · cyan · mint · neutral`.

---

## Per-tab manifest

### `insights` — stats first
- **Campus insights** (stats): Active members `activeUsers` / "of {users}" mint · Posts today `postsByDay[last].count` · Reports resolved `resolvedPct7d`% / "last 7 days" mint · Invite batches `pendingInviteBatches` / "still open" amber
- **Needs attention** (queue, badge `{escalated+deletion} open`, red): Escalated reports → `?tab=moderation` · Deletion requests → `?tab=moderation`. CTA "Open moderation".
- Data: `GET /admin/stats` — **complete, no new endpoint.**

### `moderation`
- **Moderation queue** (queue, red): Escalated reports · Deletion requests. CTA "Open oldest report".
- **Moderation health** (stats): Reports open red · Resolved `%` mint · Median response `h` / "target 6h" mint · Repeat offenders amber.
- Data: `GET /admin/stats` → `moderationHealth`. **Complete.**
- Note: this panel currently renders *in the main column* (`ModerationHealthPanel`). Moving it to the rail is part of this work, not a duplicate.

### `groups`
- **Join requests** (queue, `{pendingRequests} pending`, amber): top 3 groups by `pendingRequestCount`, meta = the count, icon = the group's type icon. CTA "Review all requests". Empty: "No join requests waiting."
- **Group activity** (stats): Groups `totalGroups` / "{privateGroups} private" · Members `totalMembers` / "across all groups" · Pending `pendingRequests` / "join requests" amber · New this week `createdThisWeek` / "groups created" mint.
- Data: `GET /admin/groups` already returns `summary { totalGroups, privateGroups, totalMembers, pendingRequests, createdThisWeek }` **and** per-group `pendingRequestCount`. **Complete — exact match, no new endpoint.**

### `members`
- **Members by role** (queue, `{users} total`, mint): Students · Alumni · Faculty · Admins, from `usersByRole`. There is deliberately no verification queue — sign-up is OTP-gated, so nothing waits on an admin.
- **Membership** (stats): Active members mint · Activation `%` mint · Invite batches amber · Suspended red.
- Data: `GET /admin/stats` covers members, active, batches, users by role.
  **Gaps:** `activation %` (invites accepted ÷ sent) and `suspended` count.
  `// TODO(api): add acceptedInvites / sentInvites and suspendedUsers to GET /admin/stats.`
  Until then substitute Members total — real.

### `announcements`
- **Scheduled** (queue, `{n} queued`, indigo): next scheduled announcements, meta = the time label; unscheduled drafts as neutral rows. CTA "New announcement" — opens the composer modal, does not navigate.
- **Reach** (stats): Live now / "pinned campus-wide" · Open rate `%` mint · Sent this term / "avg n / week" · Unread amber.
- Data: `['admin','content','posts','announcement']` gives the list.
  **Gaps:** scheduled-at, open rate, unread count — none exist.
  `// TODO(api): GET /admin/announcements/stats — scheduled, openRatePct, sentThisTerm, unread.`
  Ship the queue from the announcement list; hold the stats widget until the endpoint lands.

### `content`
- **Needs a decision** (queue, `{n} items`, amber): Reported posts red → `?tab=moderation` · Imported drafts indigo → `?tab=content-sync` · Pinned this week neutral (count only, no link). CTA "Open moderation".
- **Content mix** (stats): Posts today mint · News items · Events live · Jobs open amber.
- Data: `GET /admin/stats` + `GET /admin/content-sync/pending`. **Gap:** "pinned this week" — drop the row rather than fake it.

### `content-sync`
- **Pending review** (queue, `{n} drafts`): News drafts · Notice drafts · Event drafts, indigo, rows with a zero count filtered out. CTA "Review drafts". Empty: "Nothing imported since the last publish."
- **Sync status** (stats): Sources `n/3` / enabled|paused · Last sync `{itemsNew} new` \| Running \| Failed · Imported all-time · Cap `entriesPerSource`.
- Data: `/admin/content-sync/{config,pending,runs}`. **Complete.**

### `learning`
- **Awaiting review** (queue, `{n} drafts`, amber): draft paths, meta = "{units} units". CTA "Open learning paths". Empty: "Every path is published."
- **Learning** (stats): Paths / "{n} published" · Enrolled / "total learners" · Avg completion `%` mint · Drafts amber.
- Data: `['learning-admin','pending-paths']` covers the queue.
  **Gap:** enrolment and completion aggregates.
  `// TODO(api): GET /admin/learning/stats — paths, published, enrolled, avgCompletionPct, drafts.`

### `shuttle`
- **Route alerts** (queue, `{n} idle` amber \| "All live" mint): idle routes, meta "Idle", icon `Bus`. CTA "Open shuttle ops". Empty: "Every route is broadcasting."
- **Fleet** (stats): Buses live cyan · Routes · Drivers · On-time `%` mint.
- Data: `GET /admin/shuttle/stats` → `{busesLive, activeRoutes, onDutyDrivers, onTimeRatePct, routes[]}`. **Complete.** Route *names* need joining against `['admin','shuttle','routes']`, which the tab already holds.

### `mentorship` (lives at `/mentorship` for admin, not `?tab=`)
- **Pending requests** (queue, `{n} waiting`): pending mentee requests (meta = department) plus a "Reward requests" indigo row when redemptions are pending. CTA "Open mentorship".
- **Mentorship** (stats): Mentors / "{n} with open slots" mint · Active pairs · Completed all-time · Sessions / "{n×10} pts awarded" mint.
- Data: `/admin/mentorship/mentors` + `/admin/mentorship/redemptions`. **Complete.**
- The rail here hangs off the mentorship route, not the admin tab param — needs its own trigger.

---

## Architecture

1. **Two new `WidgetKey`s** — `admin-queue`, `admin-stats` — and `ROLE_SHELL.admin.rightRail = ['admin-queue', 'admin-stats']`. The manifest stays the only place a role's rail is decided; the widgets own the route-awareness. Admin loses the four member widgets: `/admin` is an admin's home, and a suggestions column there addressed a feed this role is not reading.
2. **One hook, `useAdminRail()`**, returns `{ queue, stats, statsFirst }`. Every query inside it is `enabled`-gated on the tab that owns it, with `staleTime: 60_000`, reusing the tab's existing query key — so opening Insights does not pull the shuttle fleet, and the rail is a cache read on tabs that already fetched.
3. **Ordering** via a `WidgetShell order` prop, not manifest order, because `statsFirst` is a per-tab fact.
4. **Both widgets carry their own card.** The member rail's chrome is positional (`.right-rail > *:first-child`), so only the first is a card. The admin pair are peers describing one screen, so neither can be the flat continuation of the other — they need `AdminRailCard`, not `RailSlot`.
5. **No fixtures.** A tab whose endpoint does not exist renders no rail. An empty rail is the documented correct resting state.

## Test that will break

`roleShell.test.ts` asserts *"the four member roles carry the same number of widgets"* and counts admin among them. Admin now carries two route-aware widgets instead of four fixed ones, so that assertion has to narrow to `student | alumni | faculty` and gain a separate admin case: `rightRail` is exactly `['admin-queue','admin-stats']`. `RightSidebar.test.tsx` asserts the surviving widget set and needs the same update.

## Also found while rendering the prototype

- The account menu's identity block is **name + email only** — no avatar, no role badge (the brief said otherwise; the prototype is `min-width: 216px`, `padding: 6px`, identity `padding: 8px 10px 10px`).
- "Invite people" is a **textarea of email addresses + role pills + optional note**, not a directory picker of existing members.
- The prototype has **no admin Events or Jobs route**. Both are kinds inside Content moderation.
- Moderation's three counters use an **icon-tile-left** layout, not the label-above-value `MetricTile` the app ships.
