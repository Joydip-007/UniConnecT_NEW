# KLIPY stickers + GIFs integration — design

**Date:** 2026-06-16
**Status:** Approved (design)

## Summary

Replace the current self-hosted sticker system (Lottie JSON files served from an R2
bucket via a `manifest.json`, rendered with `lottie-react`) with [KLIPY](https://klipy.com)
— a hosted API for animated stickers, GIFs, clips, and memes.

Scope for this work: **stickers + GIFs**, surfaced through one tabbed picker in the
two places the current sticker picker already lives (chat messages and feed comments).
Clips and memes are explicitly out of scope.

KLIPY's API key is a **server-side secret** and is rate-limited (testing mode: 100
requests/hour). The frontend therefore never talks to KLIPY directly — all calls go
through a thin proxy module in `apps/api` that holds the key, injects per-user and
safety parameters, and normalizes the response.

## Motivation

- The R2/Lottie approach requires us to manually source, convert, and upload every
  sticker, and maintain a `manifest.json`. The library never grows on its own.
- KLIPY gives "lifetime access" to millions of stickers + GIFs with trending, search,
  categories, and localization — no asset hosting on our side.
- The comment sticker button is currently a **broken stub**: `CommentDrawer`'s
  `StickerDrawer.onSelect` ignores the chosen URL and posts a comment with content
  `' '` (which fails `content.trim().min(1)` validation). This work fixes it.

## Current state (what we're replacing)

| Piece | Current behavior |
|---|---|
| `apps/web/src/components/emoji/StickerDrawer.tsx` | Fetches `VITE_STICKER_BUCKET_URL/stickers/manifest.json`, renders fixed packs of Lottie JSON via `lottie-react`. Exports `StickerDrawer` + `StickerMessage`. |
| Chat messages | `messages.content_type='sticker'` + `messages.sticker_url` (text URL) — migration `082`. Rendered by `StickerMessage` in `ChatView.tsx`. **Fully working** with any image URL. |
| Feed comments | `CommentDrawer` shows a `StickerDrawer`, but `onSelect` discards the URL and posts a blank comment. **Broken.** Comments have `content` + `media_urls` (array) + `attachments` — no sticker column. |
| `lottie-react` | Used **only** by `StickerDrawer`. Safe to remove. |
| Env | `VITE_STICKER_BUCKET_URL` (web). Documented in `deployment-ins.md` §3 + §5. |

## Decisions

- **Architecture:** proxy through `apps/api` (key stays secret, fits the project's
  "no secrets in the bundle/JWT" rule, lets us inject `content_filter` + `customer_id`
  and centralize rate-limit handling).
- **Scope:** stickers + GIFs in one tabbed picker.
- **Content filter:** default `high` (university-appropriate), env-overridable via
  `KLIPY_CONTENT_FILTER`.

---

## A. Backend — new `klipy` proxy module

New module `apps/api/src/modules/klipy/` following the standard module shape
(`router.ts`, `controller.ts`, `service.ts`, `schema.ts`, `index.ts`), mounted at
`/api/v1/klipy`. All routes use `resolveUniversity` + `requireAuth`.

### Config / env

- `KLIPY_API_KEY` — secret, from the KLIPY Partner Panel. Required; if unset the
  service throws a clear `serviceUnavailable('Stickers are not configured')` so the
  feature degrades gracefully rather than 500-ing.
- `KLIPY_CONTENT_FILTER` — one of KLIPY's filter levels (`off | low | medium | high`),
  default `high`. Centralized as a constant read from env (no hardcoded literal at the
  call site).
- Upstream base URL: `https://api.klipy.com/api/v1/{KLIPY_API_KEY}`.

### Routes

`:media` is validated against the enum `stickers | gifs` (Zod param schema). Anything
else → `badRequest`.

| Method | Path | Upstream | Query/params |
|---|---|---|---|
| GET | `/klipy/:media/trending` | `GET /{key}/{media}/trending` | `page` (≥1, default 1), `per_page` (1–50, default 24) |
| GET | `/klipy/:media/search` | `GET /{key}/{media}/search` | `q` (required), `page`, `per_page` |
| GET | `/klipy/:media/categories` | `GET /{key}/{media}/categories` | — |
| POST | `/klipy/:media/share/:slug` | `POST /{key}/{media}/share/{slug}` | body/query `q` optional |

> KLIPY uses the same path shape for stickers and gifs (`/{key}/{media}/...`), so the
> proxy is a single set of handlers parameterized by `:media`.

### Service behavior

- Inject on every upstream call: `customer_id = req.user.id` (personalization +
  per-user share attribution), `content_filter` from config, `locale` (default `en`;
  university locale can be wired later — not in scope now).
- **Normalize** KLIPY's nested item shape into a slim DTO. KLIPY returns
  `data.data[]` where each item has `id`, `slug`, `title`, and a `file` object keyed by
  size (`hd | md | sm | xs`) → format (`gif | webp | webm | png`) → `{ url, width, height, size }`.
  We map to:

  ```ts
  interface KlipyItem {
    id: string
    slug: string
    title: string
    url: string        // md → webp.url (fallback md.gif.url) — used when sent
    previewUrl: string // sm → webp.url (fallback sm.gif.url) — used in the grid
    width: number
    height: number
  }
  ```

  Response wrapper → `{ items: KlipyItem[], page: number, hasNext: boolean }`
  (returned via `sendSuccess`). `hasNext` derived from KLIPY's pagination fields.
- Error mapping: upstream `429` → `tooManyRequests`; other non-2xx or network failure
  → `serviceUnavailable`. Never surface the raw KLIPY error or the key.
- HTTP client: reuse the project's existing approach (the codebase already uses `axios`
  / `fetch` for outbound calls — match whatever `content-sync` uses for external HTTP).
- Caching: out of scope for v1. Frontend TanStack Query already caches; trending/
  categories caching can be added later if rate limits bite.

### Share trigger

When a user picks an item and sends it, the frontend fires
`POST /klipy/:media/share/:slug` (fire-and-forget). This is KLIPY's engagement/
monetization signal. Failure is non-fatal and must not block sending.

---

## B. Shared types (`packages/shared`)

- `KlipyMedia = 'stickers' | 'gifs'`
- `KlipyItem` (the slim DTO above)
- `KlipyListResponse = { items: KlipyItem[]; page: number; hasNext: boolean }`
- Zod schemas for the proxy query/params live in the API module's `schema.ts`
  (single source of truth), with inferred types; shared package holds only the
  response/data types consumed by both apps.

---

## C. Frontend — rewrite the picker

Rewrite `apps/web/src/components/emoji/StickerDrawer.tsx`. The exported component keeps
serving as the picker but is now KLIPY-backed:

- **Tabs:** `Stickers | GIFs` (controls `:media`).
- **Search box:** debounced (~300ms). Empty query → `trending`; non-empty → `search`.
- **Grid:** animated `<img>` using `previewUrl` (sm/webp), lazy-loaded, with
  pagination / infinite scroll (TanStack Query `useInfiniteQuery`, `page`-based).
- **Attribution:** KLIPY branding badge pinned at the bottom (required by KLIPY's
  terms). Asset/text per KLIPY's attribution guidelines.
- **Empty/error states:** loading spinner; "Stickers aren't available right now" on
  proxy error; "No results" on empty search.
- `onSelect(url)` returns the item's `url` (md/webp) and fires the share-trigger for
  that `slug` + `media`. (Signature stays `(url: string) => void` so existing callers
  in `MessageInput` and `CommentDrawer` keep working.)

`StickerMessage` (chat bubble renderer) becomes a plain animated `<img src={url}>`
(rename prop `lottieUrl` → `url`; update the one call site in `ChatView.tsx`).
`lottie-react` import is removed.

New hooks (co-located, e.g. `src/features/messages/hooks/` or a small
`src/components/emoji/hooks/`): `useKlipyTrending(media)`, `useKlipySearch(media, q)`
as infinite queries; a `useKlipyShare()` mutation for the fire-and-forget trigger.
Query keys follow the convention `['klipy', media, 'trending'|'search', { q }]`.

---

## D. Messages — no change

`content_type='sticker'` + `sticker_url` already carry an arbitrary image URL. A KLIPY
webp/gif URL drops straight in. No migration, no schema change. The only edit is the
`StickerMessage` render swap (§C).

---

## E. Comments — fix the broken stub (no migration)

- `CommentDrawer`'s `StickerDrawer.onSelect` posts `{ content: '', media_urls: [url] }`
  instead of discarding the URL. The comment media renderer already renders
  `media_urls` as images, so an animated webp/gif simply animates.
- Relax `createCommentSchema` in `apps/api/src/modules/feed/schema.ts`: allow empty
  `content` when `media_urls` (or `attachments`) is non-empty. Implement with a Zod
  `superRefine` / cross-field check so a comment must still have *either* text *or*
  media. Update the matching frontend type/usage if it asserts `content.min(1)`.
- No `comments` table change.

---

## F. Docs (`deployment-ins.md`)

- Replace the §3 "Sticker pack setup (animated chat/comment stickers)" subsection
  (R2/Lottie/manifest) with a "KLIPY (stickers & GIFs)" subsection:
  - Create an app + API key in the [KLIPY Partner Panel](https://partner.klipy.com/).
  - Set `KLIPY_API_KEY` (and optional `KLIPY_CONTENT_FILTER`) as **Azure App Service**
    env vars (API-side, not Vercel — the key must stay server-side).
  - Add KLIPY attribution branding in the UI (required).
  - Note testing-mode limit (100 req/hr) and requesting production access.
- Remove the `VITE_STICKER_BUCKET_URL` row from the §5 Vercel env-vars table — no longer
  used.
- Update the env-vars section in `CLAUDE.md` / `.env.example` accordingly (add
  `KLIPY_API_KEY`, `KLIPY_CONTENT_FILTER` to the API list; drop `VITE_STICKER_BUCKET_URL`
  from the web list).

---

## G. Cleanup

- Remove `lottie-react` from `apps/web/package.json` (only `StickerDrawer` used it).
- Remove `VITE_STICKER_BUCKET_URL` references from web env files / `.env.example`.
- No R2 bucket changes required (the `stickers/` prefix can simply be abandoned; no code
  references it after this work).

---

## Testing

**Backend integration** (`apps/api`, mocked KLIPY upstream via `nock` or an HTTP mock):
- `GET /klipy/stickers/trending` and `GET /klipy/gifs/search?q=...` return the
  normalized `{ items, page, hasNext }` shape.
- The API key never appears in any response body or error.
- `customer_id` and `content_filter` are sent upstream.
- Invalid `:media` → 400. Missing `q` on search → 400.
- Upstream 429 → 429 (`tooManyRequests`); upstream 500 → 503 (`serviceUnavailable`).
- Unset `KLIPY_API_KEY` → 503 with a clear message (no crash).
- All requests set `x-university-domain` and use `loginAs()` per the test harness.

**Frontend** (Vitest + RTL, MSW handlers for the proxy endpoints):
- Tab switch Stickers ↔ GIFs refetches the correct media.
- Typing in search switches from trending to search results (debounced).
- Selecting an item calls `onSelect` with the item `url` and fires the share endpoint.
- `StickerMessage` renders an `<img>` with the given URL.

**Manual:** send a sticker and a GIF in chat; post a sticker and a GIF as a comment;
confirm both animate and the comment has no blank-content error.

---

## Out of scope

- Clips and memes APIs.
- KLIPY Ads API / monetization.
- Locale wiring beyond `en` default.
- Proxy-side caching layer (frontend query cache suffices for v1).
- Migrating already-sent Lottie sticker URLs (the old R2 URLs, if any exist in prod
  `messages.sticker_url`, will simply 404 on render — acceptable for a pre-launch
  feature; can be backfilled/cleared separately if needed).
