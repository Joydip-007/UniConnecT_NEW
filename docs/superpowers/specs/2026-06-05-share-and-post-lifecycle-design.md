# Share + Post Scheduling & Archival — Design

**Date:** 2026-06-05
**Status:** Approved for planning
**Scope:** Three related content-lifecycle/distribution features for UniConnecT.

---

## Summary

Three subsystems, designed together because #2 and #3 share one `posts` lifecycle migration and one Bull lifecycle queue:

1. **Shareable deep links** + a Share menu on every content card (all card types).
2. **Scheduled posts** — publish a post at a future time (**posts only**).
3. **Expiry / archival** — manually archive a post, or auto-archive it at a set time (**posts only**).

UniConnecT is a private, multi-tenant network: every request is tenant-scoped via `x-university-domain`, so a "shared link" is an **internal deep link** — the recipient must be a logged-in member of the **same university**. Links opened by a member of another university resolve to `notFound` (expected).

The UI is intentionally specified thin: a separate UI refresh is coming and will restyle these surfaces. The durable parts of this spec are the data model, the API, the lifecycle execution, and the deep-link/visibility rules.

---

## Decisions (locked)

| # | Decision |
|---|---|
| Content scope | Sharing → **all card types**. Scheduling + expiry/archival → **posts only**. |
| Share actions | **Copy link** + **native share** (`navigator.share()`) as the foundation; **Send-in-a-message** as a later follow-up (reserved slot only). |
| Share UI | A small **anchored popover menu** on each card (Facebook-style), not a page. One shared `ShareMenu` component. |
| Post deep link | A **dedicated `/feed/:id` permalink page**. Other types reuse existing detail routes. |
| Scheduled posts | Fold into the existing **Drafts** view as a "Scheduled" filter; author can edit / reschedule / publish-now / cancel. `publish_at` stored UTC (`timestamptz`). |
| Expiry/archival | One `archived_at` column. **Manual archive/unarchive** + **auto-expiry** (`expires_at`). Archived = reversible, retained, removed from feeds/search. |
| Timed execution | **Hybrid**: per-post delayed Bull jobs for precision **+** a reconciliation cron as a safety net. |
| Permissions | All scheduling/archival is **author-only**. Admin moderation is unchanged and separate. |

---

## Lifecycle states (derived, not stored as an enum)

A post's state is computed from three nullable columns — no enum to keep in sync:

| State | Condition |
|---|---|
| **draft** | `is_published = false` AND `publish_at IS NULL` |
| **scheduled** | `is_published = false` AND `publish_at` in the future |
| **published** | `is_published = true` AND `archived_at IS NULL` |
| **archived** | `archived_at IS NOT NULL` (regardless of `is_published`) |

A small shared helper `getPostLifecycleState(post)` in `packages/shared` returns this for UI badges.

---

## Feature 1 — Shareable deep links + Share menu

### Frontend

**New feature bundle `apps/web/src/features/share/`:**
- `hooks/useShareLink.ts` → `useShareLink(entityType, entityId, title?)` returns `{ url, copy(), nativeShare(), canNativeShare }`.
  - `url = window.location.origin + SHARE_PATHS[entityType](entityId)`.
  - `copy()` uses the Clipboard API (toast on success).
  - `nativeShare()` calls `navigator.share({ title, url })`; `canNativeShare = typeof navigator.share === 'function'`.
- `index.ts` barrel.

**`SHARE_PATHS`** (built on existing `PATHS`), keyed by entity type:
| entityType | path |
|---|---|
| `post` | `/feed/:id` (new) |
| `job` | `/jobs/:id` |
| `event` | `/events/:id` |
| `news` | `/news/:id` |
| `group` | `/groups/:id` |
| `profile` | `/profile/:id` |
| `lost-found` | `/lost-found#:id` (list + anchor — no detail route) |

**`ShareMenu` component** (`apps/web/src/components/`, shared UI, props only):
- Anchored popover. Rows: **Copy link** (always); **Share via…** (only when `canNativeShare`). A reserved/commented slot for **Send in a message** (Feature B, later).
- Props: `{ entityType, entityId, title? }`.

**Shareable cards** (each gets a Share button that opens `ShareMenu`):
`PostCard`, `JobCard`, `EventCard`, `GroupCard`, news list item, `LostFoundCard`, profile (`ProfileHeader`).
**Excluded:** connection/mentorship request cards, search-result cards.

### Deep-link resolution & visibility

- **New route** `/feed/:id` → lazy `PostDetailPage` (`src/pages/`, via the `page()` helper). Add `POST_DETAIL: '/feed/:id'` to `src/router/paths.ts`.
- `PostDetailPage` → `usePost(id)` hook → **new** `GET /api/v1/feed/posts/:id`.
- **Visibility rule** (enforced in the service):
  - published & not archived → any member of the tenant.
  - draft / scheduled / archived → **author only**; otherwise `notFound`.
  - Non-author landing on an unavailable post sees a "This post isn't available" state.
- **Unauthenticated visitor:** `ProtectedRoute` captures the intended path (`?redirect=` query param or router location state) and navigates back to it after login. (Add redirect-back to `ProtectedRoute` if not already present.)
- **Cross-university:** tenant scoping means another university's member gets `notFound`. Expected.

### Backend

`feed` module:
- `GET /feed/posts/:id` → `controller.getPost` → `service.getPostById(universityId, postId, viewerId)`.
  - Returns the single post with author, engagement counts, viewer's reaction, comment count — same shape the feed list already returns for one item.
  - Applies the visibility rule above.
- No new tables. No `share_count` in v1 (YAGNI).

---

## Feature 2 — Scheduled posts (posts only)

### DB — migration `072_add_post_lifecycle`

```
posts.publish_at  timestamptz null
-- partial index for the reconciliation sweep
CREATE INDEX idx_posts_publish_at ON posts (university_id, publish_at)
  WHERE publish_at IS NOT NULL;
```

### API — feed module

- **Create**: create-post Zod schema gains optional `publish_at`. If `publish_at` is in the future → persist `is_published = false` + `publish_at`, and enqueue the lifecycle job. If absent/past → normal immediate publish.
- **Update / reschedule**: update schema accepts `publish_at` (change the time). Re-enqueues the delayed job.
- **Publish now**: clears `publish_at`, sets `is_published = true`, runs the same publish path. (Endpoint or an update flag — decide in plan.)
- **Cancel**: clears `publish_at` → post returns to **draft**.
- `GET /me/drafts` (drafts module) already unifies unpublished content — **include `publish_at`** in each row so the web can split **Drafts** vs **Scheduled** (scheduled = unpublished + future `publish_at`).

### Frontend

- Post composer gains a **schedule date/time control** (thin; author picks local time → converted to UTC).
- Drafts view gains a **Scheduled** filter/tab showing `publish_at`, with actions: edit, reschedule, publish-now, cancel.

---

## Feature 3 — Expiry / archival (posts only)

### DB — same migration `072`

```
posts.archived_at  timestamptz null   -- non-null => archived
posts.expires_at   timestamptz null   -- scheduled auto-archive time
-- partial index for the reconciliation sweep
CREATE INDEX idx_posts_expires_at ON posts (university_id, expires_at)
  WHERE expires_at IS NOT NULL AND archived_at IS NULL;
```

### Query impact

Every public post-list query **and the search query** (`posts.search_vector`, migration `070`) must add `AND archived_at IS NULL`. The implementation plan will enumerate the touch-points (feed list, "Top" feed, profile posts panel, group feed, explore/tag, search service).

### API — feed module (author-only)

- `POST /feed/posts/:id/archive` → set `archived_at = now()`, clear `expires_at`, emit removal event.
- `POST /feed/posts/:id/unarchive` → clear `archived_at` (post returns to published).
- **Set auto-expiry**: `expires_at` via the update schema (or a dedicated endpoint — decide in plan); enqueues the expire job.
- `GET /feed/posts/archived` → the author's archived posts (archived posts have `is_published = true`, so they do **not** fit `GET /me/drafts` — separate endpoint + hook).

### Frontend

- Owner card menu gains **Archive** and **Auto-expire…** (pick a time).
- Archived posts appear under an **Archived** filter in the same author-content hub as Drafts/Scheduled (the hub page may be renamed in the UI refresh).
- The `/feed/:id` permalink shows archived/scheduled posts to the author with a state badge; non-authors get "not available".

---

## Cross-cutting — timed execution (Hybrid)

**New Bull queue `post-lifecycle`** (9th queue) + worker (`apps/api/src/workers/`). Workers run as a separate process in dev, in-process in prod (per existing topology).

**Delayed jobs (precision):**
- On schedule/expiry set: enqueue a delayed job with a **deterministic id** — `publish:${postId}` / `expire:${postId}` — delay = `target − now`.
- On reschedule / cancel / publish-now / manual-archive: `queue.removeJobs(id)` (or remove by id) then re-enqueue if still applicable. Deterministic ids make this a clean remove-then-add.

**Reconciliation cron (safety net):**
- A repeatable job (every minute) sweeps anything the delayed jobs missed (worker restart / redeploy dropped a job):
  - `publish_at <= now() AND is_published = false AND publish_at IS NOT NULL` → publish.
  - `expires_at <= now() AND archived_at IS NULL` → archive.

**Idempotent shared actions** (called by both the delayed job and the cron):
- `publishScheduledPost(postId)` — in a txn: skip if already published; else set `is_published = true`; emit the normal **new-post** feed socket event to `uni:{universityId}`; enqueue notification fan-out exactly as a fresh post would.
- `archivePost(postId, { manual })` — skip if already archived; else set `archived_at = now()`; emit a **post-removed/updated** event so open feeds drop it.

Both reuse existing feed socket event constants (no new event names unless the plan finds a gap).

---

## packages/shared

- Add optional `publish_at` and `expires_at` to the create/update **post Zod schemas** (single source of truth for types).
- Add a `ShareEntityType` union and `getPostLifecycleState(post)` helper.
- Reuse existing socket event constants; add new ones only if a gap surfaces during planning.

---

## Testing

**API integration:**
- `getPostById` visibility matrix (published/draft/scheduled/archived × author/non-author/other-tenant).
- Schedule → publish via both the delayed job and the cron; idempotency (no double-publish).
- Set `expires_at` → archive via job and cron.
- Manual archive / unarchive; archived excluded from feed + search; `archive` clears `expires_at`.
- `GET /me/drafts` includes scheduled rows with `publish_at`.

**Frontend:**
- `ShareMenu`: copy-link writes the correct URL; native-share fallback when `navigator.share` absent.
- `PostDetailPage`: published, author-only (scheduled/archived), and unavailable states.

---

## Out of scope (v1)

- Share-to-a-direct-message (Feature B) — reserved menu slot only.
- Share-to-a-group.
- Scheduling/expiry for jobs, events, news.
- `share_count` / share analytics.
```
