# Feed Ranking Algorithm — Design Spec

**Date:** 2026-06-04
**Status:** Draft design, pre-implementation
**Scope:** An opt-in "Top" feed ranking that orders the home feed by an explainable engagement × recency-decay × affinity score, alongside the existing chronological "Recent" feed (which stays the default). Adds denormalised engagement counters so ranking is index-cheap.

> Sub-project 4 of the 6-feature decomposition. Builds on the existing `feed` module (`apps/api/src/modules/feed/service.ts`), whose current order is `is_pinned DESC → is_connected DESC → created_at DESC`.

---

## 1. Goals

1. Add a **`sort=top`** mode to `GET /feed` that ranks posts by a deterministic, tunable score; **`sort=recent`** (current behaviour) stays the default.
2. Score = **engagement** (reactions + comments, weighted) with **time-decay**, plus **affinity** boosts (author is a connection, same department/batch) — no ML, fully explainable.
3. Make ranking **cheap to sort** by denormalising reaction/comment counts (today they're correlated subqueries) and maintaining a precomputed `hot_score` refreshed on a schedule.
4. Keep pinned posts first and all existing filters/drafts/multi-tenancy rules intact.

Non-goals: machine-learned ranking, collaborative filtering ("users like you"), per-user precomputed timelines / fan-out-on-write, infinite personalization signals, A/B framework. These are explicitly deferred.

---

## 2. Decisions log

| Decision | Choice |
|---|---|
| Default sort | **`recent`** unchanged — ranking is opt-in, preserving current behaviour |
| Formula | Hacker-News-style gravity: `score = (weighted_engagement + 1) / (age_hours + 2)^GRAVITY` + additive affinity |
| Signals (v1) | reactions, comments, recency decay, connection affinity, same-department/batch affinity |
| Engagement counts | **Denormalise** `reaction_count` + `comment_count` onto `posts` (currently subqueried) — incrementally maintained |
| Score computation | **Precomputed `hot_score` column**, refreshed by a Bull cron; ranked via index (avoids per-request subquery sort) |
| Affinity | Applied **per-request** (connection/department are viewer-relative) on top of the precomputed base score |
| Window | "Top" considers posts from the last **14 days**; older posts only appear in "Recent" |
| Tunable weights | Centralised in a single `feed-ranking.config.ts` constant |

---

## 3. Ranking model

### 3.1 Base score (viewer-independent, precomputed)

```
weighted_engagement = REACTION_WEIGHT * reaction_count + COMMENT_WEIGHT * comment_count
base_score = (weighted_engagement + 1) / pow(age_hours + 2, GRAVITY)
```

- `age_hours = (now - created_at) / 1h`
- Defaults (tunable): `REACTION_WEIGHT = 1`, `COMMENT_WEIGHT = 2` (comments signal more investment than reactions), `GRAVITY = 1.5`.
- Stored as `posts.hot_score` (double precision), recomputed for posts within the 14-day window by a cron (§4.3). Older posts get `hot_score = 0` / excluded from Top.

### 3.2 Viewer-relative affinity (per request)

Applied as additive bonuses at query time using joins already present in the feed query (`is_connected`) plus the viewer's profile department/batch:

```
final = base_score
      + (is_connected      ? CONNECTION_BONUS : 0)   // e.g. +0.5 scaled to score range
      + (same_department   ? DEPARTMENT_BONUS : 0)
      + (same_batch        ? BATCH_BONUS      : 0)
```

Bonuses are scaled relative to the typical `base_score` range (documented in the config) so they nudge rather than dominate. Affinity stays per-request because connection/department are viewer-specific and must not be baked into the shared `hot_score`.

### 3.3 Ordering

```
ORDER BY posts.is_pinned DESC,           -- pins still first
         final_score DESC,
         posts.created_at DESC            -- stable tiebreak
```

Pinned, drafts (`is_published = false`), and `university_id` scoping behave exactly as today.

---

## 4. Backend

### 4.1 Migration `071_add_feed_ranking_columns.ts`

```
posts
  + reaction_count  integer not null default 0
  + comment_count   integer not null default 0
  + hot_score       double precision not null default 0
  index (university_id, is_published, hot_score desc)   -- supports Top ordering
```

Backfill in the migration: populate `reaction_count` / `comment_count` from the existing reaction/comment tables, then compute an initial `hot_score`.

> Confirm the next free migration number at implementation (latest committed is `067`).

### 4.2 Counter maintenance

Reaction/comment writes already flow through `feed/service.ts` (`getReactionCounts`, comment create paths) and emit sockets. Increment/decrement the denormalised counters in the **same transaction** as the reaction/comment insert/delete:
- add reaction ⇒ `reaction_count += 1`; remove ⇒ `-= 1`.
- add comment ⇒ `comment_count += 1`; delete (soft-delete `is_deleted`) ⇒ `-= 1`.

The live socket payloads keep using authoritative counts; the denormalised columns are for ranking and list rendering (they also let the feed drop the correlated-subquery counts — a nice perf win). A periodic reconciliation job (part of §4.3) corrects any drift.

### 4.3 Score refresh job

- Extend Bull infra with a `feed-ranking` repeatable job (or fold into an existing cron queue). Cadence: every ~15–30 min.
- Recompute `hot_score` for posts in the last 14 days (`created_at > now() - interval '14 days'`); set older posts' `hot_score = 0`.
- Single bulk `UPDATE … SET hot_score = (formula)` per university (or global, scoped by the window). Cheap — bounded row count.
- Also reconciles counter drift opportunistically (recompute counts for the same windowed set).
- Runs in the existing worker process (never inline in an HTTP handler).

### 4.4 Feed endpoint

`GET /api/v1/feed?sort=recent|top&page=&limit=&type=&authorId=`:
- `sort` defaults to `recent` → existing code path untouched.
- `sort=top` → add the 14-day window filter, join affinity signals, `ORDER BY` per §3.3 using `hot_score` + per-request affinity expression.
- Response shape unchanged (`sendPaginated`). Pagination by score+created_at; note score can shift between page loads after a refresh — acceptable for a "Top" feed (document it; a stable cursor is a future option).

---

## 5. Shared package additions (`packages/shared`)

- `src/constants/feed-ranking.ts` — `FEED_SORTS = ['recent','top'] as const`; `FEED_RANKING_WEIGHTS = { REACTION_WEIGHT, COMMENT_WEIGHT, GRAVITY, CONNECTION_BONUS, DEPARTMENT_BONUS, BATCH_BONUS, WINDOW_DAYS }`.
- `src/schemas/feed.ts` (extend) — add `sort: z.enum(FEED_SORTS).default('recent')` to the feed list query schema. Type via `z.infer`.

---

## 6. Frontend (`apps/web`)

- A segmented toggle at the top of the feed page: **Recent · Top** (sentence case, pill, design tokens). Default "Recent".
- The feed hook takes `sort` and includes it in the query key (`['feed','list',{ sort, type, … }]`) so switching refetches cleanly and caches both.
- No other UI change; post cards render the same. (Optional: a subtle "Top" empty-window message when no posts fall in the 14-day window.)

---

## 7. Multi-tenancy & security

- All ranking queries keep the existing `university_id` scoping and `is_published` / drafts rules — ranking changes order only, never visibility.
- Affinity uses the authenticated viewer's connections/department from `req` context, never client-supplied.
- Deactivated/blocked authors are excluded by the shared author filter introduced in the [privacy spec](2026-06-04-profile-privacy-controls-design.md) — ranking sits *after* that visibility filter.

---

## 8. Testing

**API (integration):**
- `sort=recent` (default) is byte-identical to current behaviour.
- `sort=top` orders a high-engagement recent post above a low-engagement newer one; an old high-engagement post (outside 14d) is excluded from Top but present in Recent.
- Pinned post stays first in both modes.
- Connection-authored / same-department post ranks above an equivalent stranger's post for the affinity viewer, not for others.
- Counter maintenance: reacting/commenting (and undo) moves `reaction_count`/`comment_count` correctly; refresh job recomputes `hot_score` and reconciles drift.
- Multi-tenant isolation preserved.

**Web (RTL + MSW):**
- Sort toggle switches query key and renders the corresponding ordered list; default is Recent.

---

## 9. Risks & open items

- **Counter drift** — denormalised counts can drift on edge cases (concurrent writes, failed transactions). The windowed reconciliation in the refresh job is the safety net; keep counters in the *same transaction* as the mutation to minimise it.
- **Pagination stability under refresh** — `hot_score` changes between refreshes can reorder pages mid-scroll. Acceptable for v1 (documented); a snapshot/cursor approach is the future fix.
- **Weight tuning** — initial weights are guesses; expose them in one config and revisit with real engagement data. No A/B framework in v1.
- **Cron load** — bulk UPDATE is bounded by the 14-day window; verify it stays cheap as volume grows, otherwise batch per university.
- **Migration number** — confirm next free `NNN` (latest committed is `067`).

---

## 10. Out of scope (future specs)

Machine-learned ranking · collaborative filtering · per-user precomputed timelines (fan-out-on-write) · engagement-history affinity (weighting authors you've previously engaged) · A/B testing framework · "why am I seeing this" explanations.
