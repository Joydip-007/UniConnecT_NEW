# Content Sync Automation (Skyvern → UniConnecT) — Design

**Date:** 2026-06-04
**Status:** Approved (pending implementation plan)
**Author:** Joydip

## Summary

An admin-triggered automation that scrapes UIU's public website (news, notice, and event
pages) with Skyvern, follows every item's detail link to capture full content and attachments,
categorizes the results, and posts them into UniConnecT's News and Events sections as
**unpublished drafts** for admin review. Source URLs are configurable per tenant from the admin
panel, so the automation is correctly multi-tenant and survives UIU moving its pages.

The latest published **notice** becomes the single featured **announcement** on the News page;
publishing a newer notice automatically demotes the previous one to the normal notice list.

## Goals

- Pull news from `uiu.ac.bd/news/`, notices from `uiu.ac.bd/notice/`, events from
  `uiu.ac.bd/event/` (URLs configurable per university).
- Follow every item link to capture full body text **and** attachments (PDFs/docs/images).
- Categorize: source decides the section (News / Notice / Event); an LLM sub-category is
  assigned inside the same extraction call.
- Post results as drafts into the existing News and Events systems for admin review/publish.
- Keep one featured announcement (latest published notice), auto-rotating at publish time.
- Stay within the free Skyvern budget (5,000 credits/month, ~4–5 runs) via incremental dedup.

## Non-goals (YAGNI)

- No cron/scheduling — manual "Sync now" only.
- No per-item AI summarization beyond the sub-category tag.
- No translation.
- No diffing/updating of already-imported items — new items only.
- No Skyvern webhook callback — the worker polls the run to completion.

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Orchestration | Manual admin "Sync now" (no cron) | Low frequency; simplest; user's call |
| Categorization | Source-driven routing + LLM sub-category folded into extraction | Tagging is ~free inside the existing extraction LLM call |
| Dedup | Incremental — skip items whose `source_url` is already ingested | Idempotent re-runs; collapses per-run credit cost after first backfill |
| Publish model | Draft → admin review queue | Scraping is messy; nothing wrong-looking reaches students |
| Attachments | Backend downloads & re-hosts to R2/S3 | Durable; **zero** Skyvern credits for files |
| Announcement | One featured notice, rotates at publish time | Matches draft-review model (banner only changes on publish) |
| Authorship | Per-university system/bot user ("Campus Feed") | Distinct from human posts; no misattribution |
| Skyvern integration | Pre-built parameterized workflow, triggered + polled by a Bull worker | Deterministic, debuggable, cheapest, reusable across tenants |
| Config access | Admin-only (`requireRole('admin')`) | Repointing the scraper is a higher-trust action |

## Skyvern budget analysis

- Skyvern benchmark: ~1,000 credits ≈ ~170 browser actions → 5,000 credits ≈ ~850 actions/month.
- Cost scales with **pages touched** (link-following), not categorization.
- A full backfill ≈ ~120 actions (~700 credits). Incremental runs (only new items) ≈ 10–20
  actions. So 4–5 runs/month with LLM sub-categorization fits comfortably **provided** dedup is
  built in.
- Categorization adds ~0 actions (same extraction call). Attachment downloads cost **0** Skyvern
  credits (done server-side).

## Architecture

Shared flow: admin clicks **Sync now** → API enqueues a Bull job (scraping takes minutes, so it
must not run in the HTTP handler — respects the "always enqueue" rule) → the `content-sync`
worker drives Skyvern → ingests results as drafts → enqueues attachment downloads → notifies the
admin.

### 1. Data model (new migrations, sequential after `057`)

**`058_add_content_sync_settings`** — add to existing `university_settings`:
- `content_sync_news_url text` (nullable)
- `content_sync_notice_url text` (nullable)
- `content_sync_event_url text` (nullable)
- `content_sync_enabled boolean default false`

**`059_add_imported_columns`** — on `news` and `events`:
- `source_url text` (UIU detail-page URL — the dedup key)
- `is_imported boolean default false`
- On `news` only: `is_announcement boolean default false`
- Partial unique index `(university_id, source_url) where source_url is not null` on each table
  → DB-level dedup guarantee.
- Partial unique index `(university_id) where is_announcement` on `news` → exactly one
  announcement per tenant.

**`060_create_content_attachments`** — polymorphic attachments:
- `id` uuid pk, `university_id` uuid fk
- `entity_type` (`'news' | 'event'`), `entity_id` uuid
- `source_url text` (original UIU file URL)
- `file_url text` nullable (re-hosted R2 URL, set after download)
- `file_name text`, `mime_type text`, `size_bytes integer`
- `download_status` (`'pending' | 'done' | 'failed'`) default `'pending'`
- `created_at timestamptz default now()`
- Index `(entity_type, entity_id)`; index `(download_status)`.

**`061_create_content_sync_runs`** — run history:
- `id`, `university_id`, `triggered_by` (admin user id)
- `status` (`'running' | 'success' | 'failed'`)
- `items_found integer`, `items_new integer`, `error text`
- `started_at timestamptz`, `finished_at timestamptz`

**`062_seed_campus_bot_users`** — one bot user + profile per existing university
(`full_name` "Campus Feed", role `faculty`, email `campus-bot@{domain}`, no usable password).
New-university creation also creates the bot going forward.

> Note: `news` uses `author_id`; `events` uses `organizer_id`. `events.type` has a DB CHECK
> constraint locked to its enum, so imported events map into that enum (fallback `'general'`);
> `news.category` is a free string, so `'news'`/`'notice'` + sub-category are fine.

### 2. Skyvern workflow (built once via MCP, parameterized per tenant)

One workflow, three parameters: `newsUrl`, `noticeUrl`, `eventUrl`. Per source:
1. Navigate to the source URL.
2. Extract the item list (title, detail link, date) — cheap, no per-item navigation.
3. The worker diffs the list against already-ingested `source_url`s and passes back only new links.
4. For each new link: navigate → one structured `extract` returning
   `{ title, body, publishedDate, subCategory, attachments: [{ url, fileName }] }`.

`subCategory` is where the LLM tagging happens — free, in the same extraction call. The workflow
ID is stored in env. Versioned in Skyvern.

### 3. Backend — new `content-sync` module + queue + worker

- **`src/services/skyvern.service.ts`** (shared): `triggerWorkflow(params)` + `pollRun(runId)`
  against Skyvern's REST API. Env: `SKYVERN_API_KEY`, `SKYVERN_BASE_URL`,
  `SKYVERN_CONTENT_WORKFLOW_ID`.
- **`src/queues/content-sync.queue.ts`** — job types: `sync-run`, `attachment-download`.
- **`src/workers/content-sync.worker.ts`**:
  - `sync-run`: load tenant config → create `content_sync_runs` row (`running`) → list-extract →
    diff against existing `source_url`s → detail-extract only new items → insert as **unpublished
    drafts** authored by the bot user (news `category` = `'news'`/`'notice'` from source, plus
    `subCategory`; events mapped into the `type` enum) → insert `content_attachments` rows
    (`pending`) → enqueue one `attachment-download` per file → update run row (`success`, counts)
    → emit socket event + notify the triggering admin.
  - `attachment-download`: fetch the file server-side → upload to R2 via the existing
    `upload.service` → set `file_url` + `download_status='done'` (or `'failed'`).
- **`content-sync` module** (`router/controller/service/schema/index`): trigger sync, expose
  config + run history.

### 4. API endpoints (admin module, `requireRole('admin')`)

- `GET  /admin/content-sync/config` — read the three URLs + enabled flag.
- `PATCH /admin/content-sync/config` — edit them (multi-tenancy / URL-shift control).
- `POST /admin/content-sync/run` — enqueue a sync; returns run id; **409** if a run is already
  `running` for the tenant.
- `GET  /admin/content-sync/runs` — paginated run history.
- Draft review reuses the existing admin surface: `GET /admin/content/:kind` already lists
  news/events; `togglePublish` already exists. The review queue is "imported + unpublished"
  filtered there. Publishing a notice triggers announcement rotation (§5).

### 5. Announcement rotation (at publish time)

In `NewsService.updateNews`, when an item with `category='notice'` transitions to published, in a
single transaction: set `is_announcement=false` on the current announcement for that university,
then `is_announcement=true` on this one. The partial unique index is the safety net. The News
page renders the single `is_announcement` notice as a highlighted banner; all other notices fall
into the Notice section list.

### 6. Frontend

- **Admin panel** — new "Content sync" section: three URL fields + enabled toggle (saves via
  config endpoint), a "Sync now" button (disabled while a run is `running`, state from run
  history), last-run summary ("Synced 2 h ago · 12 new"), and the imported-drafts review list
  reusing existing content-management components with edit/publish.
- **News page** — add an **Announcement** banner (the `is_announcement` notice) and a **Notice**
  tab/section alongside the existing News categories; render attachment chips (download links) on
  news/notice detail.
- **Event detail** — render attachment chips.
- New `src/features/content-sync/` bundle (admin hooks/components) + additions to `features/news`.
  Data fetching only in hooks via TanStack Query.

### 7. Shared (`packages/shared`)

- Zod schemas: `contentSyncConfigSchema`, the Skyvern extraction-result schema (single source of
  truth for what the worker parses), attachment type, sync-run type.
- Socket event constant `CONTENT_SYNC_EVENTS.RUN_COMPLETED` emitted to admins.

## Error handling & idempotency

- Re-running is safe: dedup on `(university_id, source_url)` at app **and** DB level → no
  duplicate posts.
- Partial Skyvern failure → run marked `failed` with the error; already-ingested drafts persist
  (no rollback of good items).
- Attachment download failures are isolated per file (`download_status='failed'`), retried via
  Bull retry; the news/notice item still publishes without blocking on a bad file.
- Skyvern unreachable / missing `SKYVERN_*` env → `POST /run` returns a clear error. Feature is
  inert when `content_sync_enabled=false`.
- Concurrency: `POST /run` returns 409 if a run is already `running` for the tenant.

## Testing

**Backend integration** (Skyvern service mocked — never hits the live API or spends credits):
- config GET/PATCH round-trip.
- `POST /run` enqueues a job; 409 on a concurrent run.
- Dedup: ingesting the same `source_url` twice yields one row.
- Announcement rotation: publishing notice B demotes notice A.
- Attachment worker sets `file_url` and `download_status='done'`.

**Frontend** (MSW):
- Admin config form save + "Sync now" disabled-state.
- News page announcement banner + notice section render.

## Configuration / env

`apps/api/.env`:
- `SKYVERN_API_KEY`
- `SKYVERN_BASE_URL`
- `SKYVERN_CONTENT_WORKFLOW_ID`

Per-tenant source URLs live in `university_settings` (set from the admin panel), not in env.

## Open questions

None outstanding — all major decisions resolved during brainstorming.
