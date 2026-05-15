# Search Feature — Design Spec

**Date:** 2026-05-16  
**Scope:** Full-stack (backend search module + frontend floating panel + full results page)  
**Branch:** feature/search (to be created off develop)

---

## Overview

Search is a two-surface feature:

1. **Floating panel** — appears in-place below the TopNav search bar on any page when the user types (debounced 400ms). Covers all five content types with a tab bar. No page navigation for the panel itself.
2. **Full results page** (`/search`) — full paginated view, accessible from "View all results" in the panel footer or "See all [type]" section links. Also navigated to directly if the user presses Enter in the search bar.

Both surfaces share the same backend endpoints and TanStack Query hooks.

---

## Backend

### Module location
`apps/api/src/modules/search/`  
Files: `router.ts`, `controller.ts`, `service.ts`, `schema.ts`, `index.ts`

Registered in `app.ts` as:
```ts
app.use('/api/v1/search', searchRouter)
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q=&limit=3` | Omnibus: top N from each type |
| GET | `/search/people?q=&page=&limit=20` | Paginated people |
| GET | `/search/posts?q=&page=&limit=20` | Paginated posts |
| GET | `/search/jobs?q=&page=&limit=20` | Paginated jobs |
| GET | `/search/events?q=&page=&limit=20` | Paginated events |
| GET | `/search/groups?q=&page=&limit=20` | Paginated groups |

All endpoints require auth (`requireAuth` middleware) and use `req.university.id` for tenant isolation. They return `{ data: T }` on success, `{ error, code }` on failure — matching the project-wide response convention.

**Omnibus response shape:**
```ts
{
  data: {
    people: UserSearchResult[]
    posts:  PostSearchResult[]
    jobs:   JobSearchResult[]
    events: EventSearchResult[]
    groups: GroupSearchResult[]
  }
}
```

**Paginated response shape** (same for all per-type endpoints):
```ts
{ data: { items: T[], hasMore: boolean, page: number } }
```

### Result shapes (service layer types)

```ts
interface UserSearchResult {
  id: string
  fullName: string
  headline: string | null
  department: string | null
  batchYear: string | null
  avatarUrl: string | null
  role: 'student' | 'alumni' | 'staff' | 'admin'
  isFollowing: boolean
}

interface PostSearchResult {
  id: string
  content: string
  createdAt: string
  reactionCount: number
  commentCount: number
  author: { id: string; fullName: string; avatarUrl: string | null }
}

interface JobSearchResult {
  id: string
  title: string
  company: string
  type: string
  location: string
  deadline: string | null
}

interface EventSearchResult {
  id: string
  title: string
  startDate: string
  location: string
  coverUrl: string | null
  myRsvp: 'going' | 'maybe' | null
}

interface GroupSearchResult {
  id: string
  name: string
  type: string
  avatarUrl: string | null
  memberCount: number
  isMember: boolean
}
```

### Search strategy: ILIKE + pg_trgm

**Migration** (`024_add_trgm_search_indexes.ts`):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_full_name_trgm
  ON profiles USING GIN (full_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_content_trgm
  ON posts USING GIN (content gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_title_trgm
  ON jobs USING GIN (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_company_trgm
  ON jobs USING GIN (company gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_title_trgm
  ON events USING GIN (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_groups_name_trgm
  ON groups USING GIN (name gin_trgm_ops);
```

**Query pattern** (people example — others follow same shape):
```ts
db('profiles as p')
  .join('users as u', 'u.id', 'p.user_id')
  .where('u.university_id', universityId)
  .where('u.is_deleted', false)
  .whereRaw('p.full_name ILIKE ?', [`%${q}%`])
  .select(/* columns */)
  .limit(limit)
  .offset((page - 1) * limit)
```

All service methods validate `q.length >= 2` and throw `AppError('Query too short', 400, 'QUERY_TOO_SHORT')` if not.

### Zod schema

```ts
export const searchQuerySchema = z.object({
  q: z.string().min(2).max(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const searchAllQuerySchema = z.object({
  q: z.string().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(10).default(3),
})
```

---

## Frontend

### File structure

```
apps/web/src/
  utils/
    highlightMatch.tsx              NEW — highlight matched substrings
  features/search/
    components/
      SearchPanel.tsx               NEW — floating panel (renders inside TopNav)
      PeopleResultCard.tsx          NEW — person row with follow button
      PostResultCard.tsx            NEW — post preview row
      GroupResultCard.tsx           NEW — group row with join/leave button
    hooks/
      useSearchAll.ts               NEW — useQuery(['search','all',{q}])
      useSearchPeople.ts            NEW — useInfiniteQuery, people tab
      useSearchPosts.ts             NEW — useInfiniteQuery, posts tab
      useSearchJobs.ts              NEW — useInfiniteQuery, jobs tab
      useSearchEvents.ts            NEW — useInfiniteQuery, events tab
      useSearchGroups.ts            NEW — useInfiniteQuery, groups tab
    index.ts                        NEW — barrel export
  components/
    TopNav.tsx                      MODIFIED — integrate SearchPanel
  pages/
    SearchPage.tsx                  MODIFIED — full results page
```

JobCard and EventCard from their respective feature modules are reused directly in SearchPage and the panel (they already accept a `job`/`event` prop and `queryKey`).

### highlightMatch utility

**File:** `src/utils/highlightMatch.tsx`

```tsx
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const splitRe = new RegExp(`(${escaped})`, 'gi')
  const matchRe = new RegExp(`^${escaped}$`, 'i')   // stateless — no `g` flag
  const parts = text.split(splitRe)
  return parts.map((part, i) =>
    matchRe.test(part)
      ? <mark key={i} style={{
          background: 'var(--uc-indigo-bg)',
          color: 'var(--uc-indigo-xl)',
          borderRadius: 2,
          padding: '0 2px',
        }}>{part}</mark>
      : part
  )
}
```

### TopNav changes

- Add `searchQuery` local state (controlled input value).
- `useSearchParams` to pre-populate value if user lands on `/search?q=...` and goes back.
- `onFocus` + `onChange` with `useRef`-based 400ms debounce → set state that opens `SearchPanel`.
- `panelOpen` boolean state; `onClickOutside` (existing `useEffect` pattern) closes it.
- Render `<SearchPanel>` absolutely positioned below the input when `panelOpen && searchQuery.length >= 2`.
- Pressing Enter navigates to `/search?q={searchQuery}` (replace: true).
- Pressing Escape closes panel and blurs input.

### SearchPanel component

**Positioning:** `position: absolute`, `top: calc(100% + 6px)`, centered on the search wrapper, `width: 500px`, `max-height: 520px`, `z-index: 200`. A backdrop `div` fills the viewport at `z-index: 190` with `onClick` to close.

**Tabs:** All | People | Posts | Jobs | Events | Groups  
Active tab state lives in `SearchPanel` (resets to All when `q` changes).

**All tab behaviour:**
- Calls `useSearchAll(q, limit=3)` — single `useQuery`.
- Renders up to 3 results per category using the compact result card components.
- "See all [type] results" link → `navigate('/search?q=…&tab=people')` etc.
- Footer "View all results" → `navigate('/search?q=…')`.
- If all categories return 0 results: centered "Nothing found for '[q]'" message.

**Per-type tab behaviour:**
- Calls the matching `useInfiniteQuery` hook.
- Shows compact result cards (same components as All tab).
- "Load more" button at the bottom (not auto-scroll).
- Max panel height enforced by `overflow-y: auto` on the body.

**Keyboard:**
- `Escape` → close panel.
- `↑` / `↓` → highlight rows (optional, implement if time allows; not blocking).

**Loading state:** 3 skeleton rows (a slim 40px shimmer block per row) while query is in-flight.

**Empty state:** Centered muted text "No [type] found for '[q]'" per section in All tab, or full empty state in per-type tab.

**Query guard:** Panel only mounts when `q.length >= 2`. If `q` drops below 2, show "Type at least 2 characters to search." in the panel body.

### SearchPage (`/search`)

Reads `q` and `tab` from `useSearchParams`. Updates URL on tab change with `replace: true`.

**Tab rendering:**
- **All** → `useSearchAll(q, limit=3)` + reuses the same compact cards as the panel. Shows full `EmptyState` component if zero across all types.
- **People / Posts / Jobs / Events / Groups** → respective `useInfiniteQuery` hook, full result cards, "Load more" button.

**Job results:** reuse `JobCard` (existing component). Pass a stable `queryKey` of `['search','jobs',{q,page}]`.  
**Event results:** reuse `EventCard`. Same pattern.  
**People results:** `PeopleResultCard` (includes follow/unfollow inline mutation, same pattern as `ProfilePage`).  
**Post results:** `PostResultCard` (author avatar + 2-line content preview + reaction/comment counts). Highlight applied to content via `highlightMatch`.  
**Group results:** `GroupResultCard` (avatar + name + type badge + member count + join/leave mutation).

**Highlight:** applied to `fullName` and `content` fields in People and Post cards.

**Skeleton:** `SkeletonPost` for posts, `SkeletonJobCard` for jobs, `SkeletonEventCard` for events; a simple 56px shimmer row for people/groups.

**Minimum query length guard:** if `q.length < 2`, show `EmptyState` with icon `Search` and title "Type at least 2 characters to search."

### Query keys

| Hook | Key |
|------|-----|
| useSearchAll | `['search', 'all', { q }]` |
| useSearchPeople | `['search', 'people', { q, page }]` |
| useSearchPosts | `['search', 'posts', { q, page }]` |
| useSearchJobs | `['search', 'jobs', { q, page }]` |
| useSearchEvents | `['search', 'events', { q, page }]` |
| useSearchGroups | `['search', 'groups', { q, page }]` |

All hooks have `enabled: q.length >= 2`.

### Design token compliance

All result cards use `var(--surface-card)` / `var(--border-default)` / `var(--r-lg)` for structure. Borders are `0.5px`. Buttons use `var(--r-pill)`. Font weights 400 and 500 only. No hardcoded hex. Text-on-colour uses matching light token (e.g., `--uc-indigo-xl` on `--uc-indigo-bg`).

---

## Follow / Join mutations (in result cards)

**People follow/unfollow:** inline `useMutation` in `PeopleResultCard` — same pattern as `ProfilePage`. Calls `POST /users/:id/follow` / `DELETE /users/:id/follow`. Optimistic local state toggle.

**Group join/leave:** inline `useMutation` in `GroupResultCard` — same pattern as `GroupsPage`. Calls `POST /groups/:id/join` / `DELETE /groups/:id/join`.

Neither requires a shared hook — they're self-contained in their card components.

---

## Error handling

- Backend: `AppError` thrown from service → caught by `errorHandler` middleware → returns `{ error, code }` with appropriate status.
- Frontend: TanStack Query `isError` state → show `EmptyState` with icon `AlertCircle` and a "Something went wrong" message in the panel/page body.
- Network debounce means at most one in-flight request per 400ms burst.

---

## What is NOT in scope

- Search history / recent searches
- Saved searches
- Search analytics / logging
- Full-text ranking (`ts_rank`) — ILIKE + trigram is sufficient for this scale
- Keyboard row navigation in the floating panel (nice-to-have, not blocking)
