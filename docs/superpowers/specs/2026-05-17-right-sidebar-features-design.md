# Right Sidebar — Trending on Campus & Your Progress

**Date:** 2026-05-17  
**Scope:** Fill the two placeholder widgets in `RightSidebar.tsx` with real backend data.

---

## Context

`apps/web/src/components/RightSidebar.tsx` has four widgets. Two already work:

- **People you may know** — live via `GET /users/suggestions`
- **Upcoming events** — live via `GET /events`

Two are placeholders:

- **Trending on campus** — hardcoded "Nothing trending yet."
- **Your progress** — hardcoded fake items (comment says "until Phase 9")

---

## Approach

Two focused new endpoints (Option A). Each widget fetches its own data independently via TanStack Query. Follows the module-per-domain pattern throughout the codebase.

---

## Backend

### 1. `GET /feed/trending`

**Module:** `apps/api/src/modules/feed/`  
**Auth:** `requireAuth + resolveUniversity`

**Response shape:**
```ts
{
  data: {
    pinnedPosts: Array<{
      id: string
      content: string        // truncated to 120 chars
      authorName: string
      createdAt: string      // ISO
    }>
    trendingTags: Array<{
      name: string
      postCount: number
    }>
  }
}
```

**Pinned posts query:**  
`posts WHERE is_pinned = true AND university_id = ?`  
Join `profiles` to get `full_name`. Order by `created_at DESC`. Limit 3.

**Trending tags query:**  
`post_tags` JOIN `tags` ON `tags.id = post_tags.tag_id`  
JOIN `posts` ON `posts.id = post_tags.post_id`  
WHERE `tags.university_id = ?` AND `posts.created_at > NOW() - INTERVAL '7 days'`  
GROUP BY `tags.name`  
ORDER BY `COUNT(*) DESC`  
LIMIT 5.

**Changes:**
- Add `getTrending` to `apps/api/src/modules/feed/service.ts`
- Add `getTrending` to `apps/api/src/modules/feed/controller.ts`
- Add `GET /trending` route to `apps/api/src/modules/feed/router.ts`

---

### 2. `GET /users/me/progress`

**Module:** `apps/api/src/modules/users/`  
**Auth:** `requireAuth + resolveUniversity`

**Response shape:**
```ts
{
  data: {
    profileScore: number     // 0–100, percentage of optional profile fields filled
    hasMadePost: boolean
    followerCount: number
    isVerified: boolean
  }
}
```

**Profile score fields (7 total, each worth ~14 pts):**  
`bio`, `headline`, `department`, `batch_year`, `avatar_url`, `skills` (array length ≥ 1), `linkedin_url`

**Changes:**
- Add `getProgress` to `apps/api/src/modules/users/service.ts`
- Add `getProgress` to `apps/api/src/modules/users/controller.ts`
- Add `GET /me/progress` route to `apps/api/src/modules/users/router.ts` (before `/:userId` to avoid param collision)

---

## Frontend

### Trending on campus widget

**File:** `apps/web/src/components/RightSidebar.tsx`

Replace the hardcoded stub with a `useQuery`:

```ts
queryKey: ['feed', 'trending']
queryFn: () => api.get<{ data: TrendingData }>('/feed/trending').then(r => r.data.data)
staleTime: 60_000
```

**Render:**
- **Pinned posts** (if any): compact rows showing truncated content + small "Pinned" label using `var(--uc-orange-bg)` / `var(--uc-orange-l)` token pairing. Navigate to `PATHS.FEED` on click (no detail route for sidebar).
- Divider `0.5px solid var(--border-default)` between pinned posts and tags (only when both sections have items).
- **Trending tags** (if any): tag chips — `#name · N posts` — using `var(--uc-indigo-bg)` / `var(--uc-indigo-l)` token pairing, `border-radius: var(--r-pill)`.
- Empty state: "Nothing trending yet." (unchanged).
- Loading: skeleton (2 lines for posts, 3 chips for tags).

---

### Your progress widget

**File:** `apps/web/src/components/RightSidebar.tsx`

Replace hardcoded `BADGE_ITEMS` with a `useQuery`:

```ts
queryKey: ['users', 'me', 'progress']
queryFn: () => api.get<{ data: UserProgress }>('/users/me/progress').then(r => r.data.data)
staleTime: 30_000
```

Derive the four progress items dynamically from the response:

| Item | Done condition | Progress display |
|---|---|---|
| Profile complete | `profileScore === 100` | `profileScore / 100` progress bar |
| First post | `hasMadePost` | done / not-done |
| 10 connections | `followerCount >= 10` | `followerCount / 10` progress bar |
| Get verified | `isVerified` | done / locked (no progress bar) |

Loading state: skeleton (4 rows, same layout as existing `BadgeProgressRow`).

---

## Design token compliance

- No hardcoded hex colours — only `var(--token-name)`
- Borders `0.5px solid var(--border-*)`
- Coloured surfaces use matching light tokens (`--uc-orange-l` on `--uc-orange-bg`, `--uc-indigo-l` on `--uc-indigo-bg`)
- Font weight 400/500 only

---

## What is NOT in scope

- A trending endpoint that supports pagination or date-range params
- Pinned post detail page
- Admin UI to pin/unpin posts (already exists via admin module)
- Socket.io real-time updates for trending or progress
