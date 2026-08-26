# Contextual zone — the last piece of the role-aware shell

> Read this alongside `SIDEBAR_ROLES_PROMPT.md` §2, which defines the zone's rules.
> This file is the correction pass after building the rest of the shell: it records
> what already exists, and which of the spec'd rules have data behind them today.
> Where they disagree, this file wins.

Paste everything below the line into Claude Code at the repo root of
`Joydip-007/UniConnecT_NEW`, on the branch carrying the role-aware shell work.

---

## 0. What is already built — do not rebuild it

The zone's machinery is done and tested. Only the rules are missing.

In `components/leftSidebar.config.ts`:

- `CtxRule` — `{ key, label, icon, to, tone, when(ctx) }`, where `when` returns
  `false` or `{ meta, rank }`.
- `RailContext` — the cheap-signal bag passed to every `when`. **It currently holds
  exactly one key: `draftCount`.**
- `TONE_RANK` — `live 4 > action 3 > deadline 2 > network 1 > self 0`, already the
  spec's order.
- `TONE_TOKENS` — the tone → token map, already correct per role.
- `draftsRule(label)` — the one built rule, shared by student, alumni, faculty and
  admin (admin labels it "Unsent broadcast draft").

In `components/LeftSidebar.tsx` (around lines 347–356 and 522–560):

- Rules are evaluated, filtered to truthy, sorted by `rank` descending, sliced to 2,
  and the remainder becomes a `+n more` row pointing at `/notifications`.
- The zone renders as `<ul aria-live="polite" aria-label="Contextual shortcuts">`,
  under an eyebrow reading "Shows up when relevant" in `var(--text-label)`.
- The whole block, eyebrow included, renders nothing when no rule is true.
- `ContextualRow` is the row primitive — 44px target, tone tokens, collapsed variant.

So the task is: **extend `RailContext`, add rules, and feed the context from real
query caches.** Do not restructure the zone.

## 1. The gap the spec did not anticipate

`SIDEBAR_ROLES_PROMPT.md` §1 lists 4–5 rules per role. Roughly half of them describe
data this codebase does not have. Build the ones that are real; do not invent
endpoints to satisfy the list, and do not fake a rule with a hardcoded value.

### Buildable now, entirely from existing endpoints

| Role | Rule | Tone | Source |
|---|---|---|---|
| student | Shuttle arriving (`etaMinutes <= 10`) | live | `useShuttleLiveState()` in `features/shuttle/hooks` |
| student | Application update | network | `GET /jobs/applications/my` — status moved off `pending` |
| alumni | New applicants | deadline | `GET /jobs/my` — sum of `applicationCount` |
| alumni | Mentee requests | network | `GET /mentorship/requests/incoming?status=pending` |
| admin | Verification requests | action | already in the rail's own profile query — `profileData.stats.verifications` |
| admin | Invite batch expiring (`daysLeft <= 3`) | deadline | `GET /admin/invitations`, has expiry |
| admin | Escalated report | action | `GET /admin/stats` → `reports` (pending count) |
| driver | On duty now | live | `features/shuttle` live state; **`pinned: true`** |

The alumni and admin sources are already fetched elsewhere in the shell —
`MenteeRequestsWidget`, `MyPostingsPanel`, `PlatformTodayWidget` — so reuse the same
query keys and let TanStack dedupe. Do not add a second fetch of the same endpoint.

### Not buildable — leave these out and say so

Faculty gets **no** contextual rules beyond drafts. All four of its spec'd rules need
tables or endpoints that do not exist: there is no timetable (so no "class in Nm"), no
unanswered-query concept, no grade-submission window, and join requests are per-group
with no cross-group aggregate. An empty zone is the correct resting state — the spec
says so itself. Do not approximate any of these.

Same for: student "Registration open", alumni "Reunion RSVP", driver "Log fuel" and
"Passenger alert". If you think one is reachable, say what endpoint it needs and stop;
do not build it speculatively.

Student "Event starting" is a maybe — check whether the events list actually returns
the viewer's own RSVP. If it only returns `rsvpCounts`, skip it and report that.

## 2. `pinned` does not exist yet

Driver's "On duty now" is specified as `pinned: true` — it outlives a glance and stays
for the whole shift. `CtxRule` has no such field. Add it, and make pinned rules sort
above unpinned ones regardless of `rank`, and never fall into the `+n more` overflow.
A pinned rule that got hidden behind "+1 more" would defeat its only purpose.

## 3. Feeding `RailContext` without a waterfall

Every new key means a query in `LeftSidebar`, which renders on every authenticated
page. Rules:

- **Gate each query by role.** A student must not fetch `/admin/invitations`; it is
  `requireRole` -guarded and would 403 on every page load. Use `enabled:` keyed off the
  role, exactly as `JobsPage` gates its browse feed.
- **Reuse query keys** already used by the right-rail widgets so the cache is shared.
- Give each a `staleTime` — this is a rail, not a dashboard. 60s is the house default
  for these.
- Derive counts client-side from caches wherever possible rather than adding an
  endpoint. If a count genuinely does not exist client-side, add the endpoint properly
  (router → controller → service, university-scoped) rather than over-fetching a list
  to call `.length` on it.

## 4. Tests

Extend `components/LeftSidebar.test.tsx`, which already mocks `useMyDrafts` and the
auth store per role — follow that pattern for the new hooks.

- Per role: each rule appears when its condition is true and **vanishes** when it
  flips false. The vanish direction is the one that regresses.
- The 2-row cap with three-plus rules true, and that `+n more` counts the remainder.
- Rank order: a `live` rule outranks a `deadline` one when both are true.
- Driver's pinned row survives both the cap and a higher-ranked competitor.
- Faculty renders no zone at all — no eyebrow, no empty `<ul>`.
- No role evaluates a rule whose endpoint its role would be refused.

## 5. Guardrails

- Tone → token only via `TONE_TOKENS`; no new colour values.
- Sentence case, no emoji, no em dashes in labels.
- A row must disappear when its condition clears. No dismiss-and-remember, no empty
  state, no placeholder.
- Rows enter on the existing `fadeUp`; do not reorder while the pointer is inside the
  zone — queue until `mouseleave`.
- Collapsed rail: label becomes the accessible name plus tooltip, 44px target holds.
- Run `npx pnpm typecheck && npx pnpm lint` and the full web suite before finishing.
- Update the shell section of `CLAUDE.md` if you add a `RailContext` key or change how
  the zone sorts.
