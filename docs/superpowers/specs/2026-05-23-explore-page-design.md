# Explore Page — Design Spec
**Date:** 2026-05-23  
**Project:** UniConnecT  
**Team:** Mavericks, UIU

---

## 1. Overview

Replace the existing `/search` route with a unified `/explore` page that serves two purposes:

- **Discovery mode** (idle, no query): algorithmic sections — trending posts, people you may know, active groups, upcoming events, featured alumni.
- **Search mode** (query ≥ 2 chars): tabbed search results with advanced filters.

Also introduces:
- Tag pages at `/explore/tag/:tag` showing posts for a hashtag.
- Hashtag auto-extraction on post save.

The TopNav search bar remains unchanged — its Enter action navigates to `/explore?q=…` instead of `/search?q=…`.

---

## 2. Route changes

| Before | After |
|---|---|
| `PATHS.SEARCH = '/search'` | `PATHS.EXPLORE = '/explore'` |
| — | `PATHS.TAG = '/explore/tag/:tag'` |
| `SearchPage` at `/search` | `ExplorePage` at `/explore` |
| — | `TagPage` at `/explore/tag/:tag` |

`SearchPage.tsx` is deleted. `LeftSidebar` "Explore" nav item path updated to `PATHS.EXPLORE`. TopNav `navigate` target updated from `/search?q=` to `/explore?q=`.

---

## 3. Backend — new `explore` module

### 3.1 File structure

```
apps/api/src/modules/explore/
  router.ts
  controller.ts
  service.ts
  schema.ts
  index.ts
```

Registered in `apps/api/src/app.ts` as `app.use('/api/v1/explore', exploreRouter)`.

### 3.2 Endpoints

#### `GET /api/v1/explore/discovery`

Returns all five discovery sections in one response. Requires auth.

**Response:**
```ts
{
  trendingPosts:     PostSummary[]      // 5 items
  peopleSuggestions: UserSuggestion[]   // 6 items
  activeGroups:      GroupSummary[]     // 4 items
  upcomingEvents:    EventSummary[]     // 4 items
  featuredAlumni:    UserSuggestion[]   // 4 items
}
```

All five queries run in `Promise.all` — latency is max(slowest), not sum.

#### `GET /api/v1/explore/tags/:tag`

Returns paginated posts for a tag. Query params: `page` (default 1), `limit` (default 20, max 50).

**Response:** `sendSuccess` with a custom shape (cannot use `sendPaginated` because we need `relatedTags`):
```ts
{
  items:       PostSummary[]   // same shape as feed posts
  total:       number
  page:        number
  hasMore:     boolean
  relatedTags: string[]        // top 5 co-occurring tag names
}
```

---

## 4. Discovery algorithms

### 4.1 Trending posts

- Pool: posts from the last **48 hours**, excluding the requester's own posts.
- Score: `(reaction_count + comment_count × 2) / hours_since_posted ^ 1.2`
- Returns top **5**, ordered by score DESC.
- `reaction_count` and `comment_count` computed via subquery joins on `reactions` and `comments` tables.

### 4.2 People you may know

- Excludes: requester self, already-followed users, inactive users (`is_active = false`).
- Requester's `department` and `batch_year` fetched from `profiles`.
- Scoring:

  | Signal | Points |
  |---|---|
  | Same department + same batch year | 3 |
  | Same department only | 2 |
  | Same batch year only | 1 |
  | 2nd-degree follow (followed by someone I follow) | +1 bonus |

- 2nd-degree query: `follows WHERE follower_id IN (SELECT following_id FROM follows WHERE follower_id = requesterId)`.
- Ties broken by follower count DESC.
- Returns top **6**.

### 4.3 Active groups you haven't joined

- Excludes groups where `group_members.user_id = requesterId` exists.
- Excludes groups with `type = 'secret'`.
- Ranked by number of posts with `group_id = groups.id AND created_at > NOW() - INTERVAL '7 days'`.
- Returns top **4** with `memberCount` and `recentPostCount`.

### 4.4 Upcoming events by RSVP count

- Filter: `starts_at > NOW()` AND `is_published = true`.
- Ranked by count of `event_rsvps WHERE status = 'going'` DESC.
- Returns top **4** with `rsvpCount` and requester's own `myRsvp` status.

### 4.5 Featured alumni

- Filter: `users.role = 'alumni'` AND `is_active = true`.
- Ranked by follower count DESC (count of `follows WHERE following_id = user_id`).
- Returns top **4**.
- Future: if `profiles.is_featured` boolean is ever added, featured=true takes priority.

---

## 5. Search filter extensions

### 5.1 `/search/people` — new optional params

| Param | Type | Behaviour |
|---|---|---|
| `role` | `'student' \| 'alumni' \| 'faculty' \| 'staff'` | AND filter on `users.role` |
| `department` | string | `ILIKE '%value%'` on `profiles.department` |
| `batch` | string | exact match on `profiles.batch_year` |

`q` becomes optional when any filter is present. If both `q` and filters are absent, returns empty result (no full-table dump).

### 5.2 `/search/posts` — new optional param

| Param | Type | Behaviour |
|---|---|---|
| `tag` | string | join `post_tags → tags` where `tags.name ILIKE tag`; combinable with `q` |

---

## 6. Hashtag auto-extraction

### Location
`apps/api/src/modules/feed/service.ts` — inside the `createPost` transaction, after the `posts` insert. Same logic added to `updatePost` (delete old `post_tags` for the post first, then re-insert).

### Algorithm
1. Extract: `content.match(/#[\w]+/gi) ?? []`
2. Normalise: lowercase, deduplicate.
3. Cap at **10 tags per post** (slice after dedup) — prevents spam.
4. Upsert tags: `INSERT INTO tags (id, university_id, name) VALUES (...) ON CONFLICT (university_id, name) DO NOTHING` — then re-select IDs by name.
5. Insert post_tags: `INSERT INTO post_tags (post_id, tag_id) ON CONFLICT (post_id, tag_id) DO NOTHING`.

All steps run inside the existing transaction — atomic with the post insert.

---

## 7. Frontend structure

### 7.1 Feature module

```
apps/web/src/features/explore/
  components/
    TrendingPosts.tsx         horizontal scroll row, 5 PostCard items
    PeopleSuggestions.tsx     horizontal scroll row, 6 PersonCard items
    ActiveGroups.tsx          horizontal scroll row, 4 GroupCard items
    UpcomingEvents.tsx        horizontal scroll row, 4 EventSummaryCard items
    FeaturedAlumni.tsx        horizontal scroll row, 4 PersonCard items
    EventSummaryCard.tsx      new shared card: title, date, location, RSVP count, RSVP button
    FilterPills.tsx           role/dept/batch dropdowns for People search tab
    DiscoverySection.tsx      wrapper: section label + "see all" link + horizontal row
  hooks/
    useDiscovery.ts           useQuery(['explore', 'discovery']) → GET /explore/discovery
    useTagPosts.ts            useInfiniteQuery(['explore', 'tag', tag]) → GET /explore/tags/:tag
  index.ts                    barrel export
```

### 7.2 Pages

**`apps/web/src/pages/ExplorePage.tsx`**

Mode determined by `useSearchParams`:
- `q` absent or < 2 chars → **discovery mode**: renders `useDiscovery` data as five horizontal sections.
- `q` ≥ 2 chars → **search mode**: renders tab bar + results (absorbs all logic from deleted `SearchPage.tsx`), People tab shows `FilterPills` row.

Search input at top of page (separate from TopNav bar) — pre-fills from `q` param, updates URL on change with 400ms debounce.

**`apps/web/src/pages/TagPage.tsx`**

- Header: `#tagname · N posts`
- Related tags chip row (up to 5, each links to `/explore/tag/othertag`)
- Infinite-scroll post list using `PostCard` from `features/feed`
- Back link to `/explore`

### 7.3 Component reuse

| Explore component | Reuses |
|---|---|
| `TrendingPosts` | `PostCard` (feed feature) |
| `PeopleSuggestions`, `FeaturedAlumni` | `PeopleResultCard` (search feature) |
| `ActiveGroups` | `GroupResultCard` (search feature) |
| `UpcomingEvents` | `EventSummaryCard` (new, in explore feature) |
| `TagPage` post list | `PostCard` (feed feature) |

### 7.4 Hashtag links in post content

New utility `linkifyContent(text: string): React.ReactNode[]` — splits the string on `/#[\w]+/g` and returns an array of plain string nodes and `<Link to="/explore/tag/word">#word</Link>` elements. Applied in `PostCard` wherever the post body is rendered. No `dangerouslySetInnerHTML` — pure React element array, no XSS risk.

### 7.5 URL / state conventions

- Filters live in URL params: `?q=react&tab=people&role=alumni&department=CSE&batch=2025` — shareable and bookmarkable.
- `useSearchParams` is the single source of truth; no local state for tab or filters.
- `useQuery` key for discovery: `['explore', 'discovery']` — no params, cached for the session.
- `useQuery` key for tag posts: `['explore', 'tag', tagName, { page }]`.

---

## 8. Design system compliance

- No hardcoded hex values — all colours via CSS tokens (`var(--surface-card)`, `var(--uc-indigo)`, etc.).
- Horizontal scroll rows: `overflow-x: auto; scroll-snap-type: x mandatory` — no carousel library.
- Section labels: 11px, `font-weight: 500`, `var(--text-secondary)`, `letter-spacing: 0.04em` — matches existing `sectionHeaderStyle` pattern from `SearchPage`.
- Cards: `border: 0.5px solid var(--border-default)`, `border-radius: var(--r-lg)` — no `box-shadow`.
- Buttons: `border-radius: var(--r-pill)` — no sharp corners.
- Font weights: 400 and 500 only.

---

## 9. Migration

No new DB migration required. The `tags` and `post_tags` tables already exist (migration `013_create_tags_and_post_tags`). The search index migration (`024_add_trgm_search_indexes`) already covers `profiles.department` and `profiles.full_name`. No schema changes needed.

---

## 10. What is explicitly out of scope

- Personalised feed ranking (ML/collaborative filtering) — trending score is sufficient for v1.
- Admin "pin to featured alumni" UI — follower-count proxy is used for now.
- Real-time trending updates (WebSocket push) — page-load fetch is sufficient.
- Saved searches or search history.
- Trending hashtag widget in the sidebar (can be added later using the existing `trendingTags` query in the feed service).
