# Right Sidebar Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two hardcoded placeholder widgets in `RightSidebar.tsx` ("Trending on campus" and "Your progress") with real data from two new focused API endpoints.

**Architecture:** Add `getTrending` to the feed module and `getProgress` to the users module — service → controller → router per module. The frontend `RightSidebar.tsx` gets two new `useQuery` calls replacing the stubs, each driving its own widget UI.

**Tech Stack:** Express, Knex, Zod, TypeScript (strict), React 18, TanStack Query v5, CSS design tokens.

---

## File Map

| Action | File |
|---|---|
| Modify | `apps/api/src/modules/feed/service.ts` |
| Modify | `apps/api/src/modules/feed/controller.ts` |
| Modify | `apps/api/src/modules/feed/router.ts` |
| Modify | `apps/api/src/modules/users/service.ts` |
| Modify | `apps/api/src/modules/users/controller.ts` |
| Modify | `apps/api/src/modules/users/router.ts` |
| Modify | `apps/web/src/components/RightSidebar.tsx` |

---

## Task 1: `GET /feed/trending` — service method

**Files:**
- Modify: `apps/api/src/modules/feed/service.ts`

- [ ] **Step 1: Add `getTrending` to `FeedService`**

Open `apps/api/src/modules/feed/service.ts`. After the closing brace of `unsavePost` and before the closing brace of the `FeedService` class (around the line `export const feedService = new FeedService()`), add this method inside the class:

```typescript
  async getTrending(universityId: string) {
    const pinnedRows = await db('posts')
      .join('profiles', 'profiles.user_id', 'posts.author_id')
      .select(
        'posts.id',
        'posts.content',
        'posts.created_at',
        db.raw("profiles.full_name as author_name"),
      )
      .where({ 'posts.university_id': universityId, 'posts.is_pinned': true })
      .orderBy('posts.created_at', 'desc')
      .limit(3) as Array<{ id: string; content: string; created_at: Date; author_name: string }>

    const tagRows = await db('tags')
      .join('post_tags', 'post_tags.tag_id', 'tags.id')
      .join('posts', 'posts.id', 'post_tags.post_id')
      .select('tags.name')
      .count<Array<{ name: string; post_count: string }>>('post_tags.post_id as post_count')
      .where('tags.university_id', universityId)
      .where('posts.created_at', '>', db.raw("NOW() - INTERVAL '7 days'"))
      .groupBy('tags.id', 'tags.name')
      .orderBy('post_count', 'desc')
      .limit(5) as Array<{ name: string; post_count: string }>

    return {
      pinnedPosts: pinnedRows.map((p) => ({
        id: p.id,
        content: String(p.content).slice(0, 120),
        authorName: p.author_name,
        createdAt: p.created_at,
      })),
      trendingTags: tagRows.map((t) => ({
        name: t.name,
        postCount: Number(t.post_count),
      })),
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/feed/service.ts
git commit -m "feat(feed): add getTrending service method"
```

---

## Task 2: `GET /feed/trending` — controller + route

**Files:**
- Modify: `apps/api/src/modules/feed/controller.ts`
- Modify: `apps/api/src/modules/feed/router.ts`

- [ ] **Step 1: Add `getTrending` export to the controller**

Open `apps/api/src/modules/feed/controller.ts`. After the `unsavePost` export (before the `getAuthContext` helper), add:

```typescript
export const getTrending = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.getTrending(context.universityId))
})
```

- [ ] **Step 2: Wire the route**

Open `apps/api/src/modules/feed/router.ts`. Add the import and route.

In the import block at the top, add `getTrending` to the destructured import from `'./controller'`:

```typescript
import {
  addCommentReaction,
  addReaction,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getComments,
  getPost,
  getTrending,
  listPosts,
  removeCommentReaction,
  removeReaction,
  savePost,
  unsavePost,
  updatePost,
  votePoll,
} from './controller'
```

Then add the route **before** `feedRouter.get('/:postId', ...)` to avoid param collision:

```typescript
feedRouter.get('/trending', getTrending)
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx pnpm --filter api typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/feed/controller.ts apps/api/src/modules/feed/router.ts
git commit -m "feat(feed): add GET /feed/trending endpoint"
```

---

## Task 3: `GET /users/me/progress` — service method

**Files:**
- Modify: `apps/api/src/modules/users/service.ts`

- [ ] **Step 1: Add `getProgress` to `UsersService`**

Open `apps/api/src/modules/users/service.ts`. Inside the `UsersService` class, after the `getSuggestions` method (before the closing brace of the class), add:

```typescript
  async getProgress(userId: string, universityId: string) {
    const row = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select(
        'users.is_verified',
        'profiles.bio',
        'profiles.headline',
        'profiles.department',
        'profiles.batch_year',
        'profiles.avatar_url',
        'profiles.skills',
        'profiles.linkedin_url',
      )
      .where({ 'users.id': userId, 'users.university_id': universityId })
      .first<{
        is_verified: boolean
        bio: string | null
        headline: string | null
        department: string | null
        batch_year: string | null
        avatar_url: string | null
        skills: string[] | null
        linkedin_url: string | null
      }>()

    if (!row) throw notFound('User not found')

    const fields = [
      Boolean(row.bio),
      Boolean(row.headline),
      Boolean(row.department),
      Boolean(row.batch_year),
      Boolean(row.avatar_url),
      Array.isArray(row.skills) && row.skills.length >= 1,
      Boolean(row.linkedin_url),
    ]
    const profileScore = Math.round((fields.filter(Boolean).length / fields.length) * 100)

    const [postResult] = await db('posts')
      .where({ author_id: userId, university_id: universityId })
      .count<[{ count: string }]>({ count: '*' })
    const hasMadePost = Number(postResult.count) > 0

    const [followerResult] = await db('follows')
      .join('users', 'users.id', 'follows.follower_id')
      .where({ 'follows.following_id': userId, 'users.university_id': universityId })
      .count<[{ count: string }]>({ count: '*' })
    const followerCount = Number(followerResult.count)

    return {
      profileScore,
      hasMadePost,
      followerCount,
      isVerified: row.is_verified,
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/users/service.ts
git commit -m "feat(users): add getProgress service method"
```

---

## Task 4: `GET /users/me/progress` — controller + route

**Files:**
- Modify: `apps/api/src/modules/users/controller.ts`
- Modify: `apps/api/src/modules/users/router.ts`

- [ ] **Step 1: Add `getProgress` export to the controller**

Open `apps/api/src/modules/users/controller.ts`. After the `getSuggestions` export (before the `getAuthContext` helper), add:

```typescript
export const getProgress = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getProgress(context.userId, context.universityId))
})
```

- [ ] **Step 2: Wire the route**

Open `apps/api/src/modules/users/router.ts`. Add `getProgress` to the import from `'./controller'`:

```typescript
import {
  followUser,
  getMe,
  getProgress,
  getSuggestions,
  getUser,
  listFollowers,
  listFollowing,
  listUsers,
  unfollowUser,
  updateMe,
} from './controller'
```

Add the route **after** `usersRouter.patch('/me', ...)` and **before** `usersRouter.get('/:userId', ...)` to avoid param collision:

```typescript
usersRouter.get('/me/progress', getProgress)
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx pnpm --filter api typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/users/controller.ts apps/api/src/modules/users/router.ts
git commit -m "feat(users): add GET /users/me/progress endpoint"
```

---

## Task 5: Frontend — Trending on campus widget

**Files:**
- Modify: `apps/web/src/components/RightSidebar.tsx`

- [ ] **Step 1: Add the `TrendingData` type near the top of the file**

In `apps/web/src/components/RightSidebar.tsx`, in the `// ── Local types ──` section, add after the existing interfaces:

```typescript
interface TrendingData {
  pinnedPosts: Array<{
    id: string
    content: string
    authorName: string
    createdAt: string
  }>
  trendingTags: Array<{
    name: string
    postCount: number
  }>
}
```

- [ ] **Step 2: Add the trending query inside `RightSidebar`**

Inside the `RightSidebar` function body, after the `events` query, add:

```typescript
  const { data: trending, isLoading: loadingTrending } = useQuery({
    queryKey: ['feed', 'trending'],
    queryFn: () =>
      api
        .get<{ data: TrendingData }>('/feed/trending')
        .then((r) => r.data.data),
    staleTime: 60_000,
  })
```

- [ ] **Step 3: Replace the Trending on campus widget stub**

Find and replace the existing "Trending on campus" widget block:

```tsx
      {/* Trending on campus */}
      <Widget>
        <SectionHeader title="Trending on campus" />
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
          Nothing trending yet.
        </p>
      </Widget>
```

Replace with:

```tsx
      {/* Trending on campus */}
      <Widget>
        <SectionHeader title="Trending on campus" />

        {loadingTrending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 10 }}>
                <SkeletonLine width="80%" />
                <SkeletonLine width="50%" height={10} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[0, 1, 2].map((i) => (
                <SkeletonLine key={i} width={64} height={22} />
              ))}
            </div>
          </div>
        ) : !trending || (trending.pinnedPosts.length === 0 && trending.trendingTags.length === 0) ? (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
            Nothing trending yet.
          </p>
        ) : (
          <div>
            {trending.pinnedPosts.map((post) => (
              <div
                key={post.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '0.5px solid var(--border-default)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--uc-orange-l)',
                      background: 'var(--uc-orange-bg)',
                      borderRadius: 'var(--r-pill)',
                      padding: '1px 6px',
                    }}
                  >
                    Pinned
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{post.authorName}</span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {post.content}
                </p>
              </div>
            ))}

            {trending.pinnedPosts.length > 0 && trending.trendingTags.length > 0 && (
              <div style={{ height: '0.5px', background: 'var(--border-default)', margin: '8px 0' }} />
            )}

            {trending.trendingTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trending.trendingTags.map((tag) => (
                  <span
                    key={tag.name}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--uc-indigo-l)',
                      background: 'var(--uc-indigo-bg)',
                      border: '0.5px solid var(--uc-indigo-bdr)',
                      borderRadius: 'var(--r-pill)',
                      padding: '3px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    #{tag.name} · {tag.postCount}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Widget>
```

- [ ] **Step 4: Typecheck frontend**

```bash
npx pnpm --filter web typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/RightSidebar.tsx
git commit -m "feat(web): wire Trending on campus widget with real data"
```

---

## Task 6: Frontend — Your progress widget

**Files:**
- Modify: `apps/web/src/components/RightSidebar.tsx`

- [ ] **Step 1: Add the `UserProgress` type**

In the `// ── Local types ──` section, after `TrendingData`, add:

```typescript
interface UserProgress {
  profileScore: number
  hasMadePost: boolean
  followerCount: number
  isVerified: boolean
}
```

- [ ] **Step 2: Add the progress query inside `RightSidebar`**

Inside the `RightSidebar` function body, after the `trending` query, add:

```typescript
  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['users', 'me', 'progress'],
    queryFn: () =>
      api
        .get<{ data: UserProgress }>('/users/me/progress')
        .then((r) => r.data.data),
    staleTime: 30_000,
  })
```

- [ ] **Step 3: Remove the hardcoded `BADGE_ITEMS` constant**

Delete the entire `BADGE_ITEMS` constant block (it is currently outside the component, in the `// ── Badge progress (hardcoded until Phase 9) ──` section). Remove:

```typescript
// ── Badge progress (hardcoded until Phase 9) ─────────────

interface BadgeProgressItem {
  icon: LucideIcon
  label: string
  state: 'done' | 'in-progress' | 'locked'
  progress?: number
  total?: number
}

const BADGE_ITEMS: BadgeProgressItem[] = [
  { icon: CheckCircle2, label: 'Profile complete', state: 'in-progress', progress: 80, total: 100 },
  { icon: CheckCircle2, label: 'First post', state: 'done' },
  { icon: Circle, label: '10 connections', state: 'in-progress', progress: 7, total: 10 },
  { icon: Lock, label: 'Get verified', state: 'locked' },
]
```

Delete **only** the comment header and the `BADGE_ITEMS` constant. Leave the `BadgeProgressItem` interface and `BadgeProgressRow` function exactly where they are — they are still used.

- [ ] **Step 4: Replace the Your progress widget body**

Find the existing "Your progress" / "Badge progress" widget:

```tsx
      {/* Badge progress */}
      <Widget>
        <SectionHeader title="Your progress" />
        <div>
          {BADGE_ITEMS.map((item) => (
            <BadgeProgressRow key={item.label} item={item} />
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '10px 0 0', lineHeight: 1.5 }}>
          Earn badges by being active — posting, connecting, and getting verified.
        </p>
      </Widget>
```

Replace with:

```tsx
      {/* Your progress */}
      <Widget>
        <SectionHeader title="Your progress" />

        {loadingProgress ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <SkeletonLine width={14} height={14} />
                <SkeletonLine width="60%" />
              </div>
            ))}
          </div>
        ) : progress ? (
          <>
            <div>
              {(
                [
                  {
                    icon: progress.profileScore === 100 ? CheckCircle2 : Circle,
                    label: 'Profile complete',
                    state: progress.profileScore === 100 ? 'done' : 'in-progress',
                    progress: progress.profileScore,
                    total: 100,
                  },
                  {
                    icon: progress.hasMadePost ? CheckCircle2 : Circle,
                    label: 'First post',
                    state: progress.hasMadePost ? 'done' : 'in-progress',
                  },
                  {
                    icon: progress.followerCount >= 10 ? CheckCircle2 : Circle,
                    label: '10 connections',
                    state: progress.followerCount >= 10 ? 'done' : 'in-progress',
                    progress: Math.min(progress.followerCount, 10),
                    total: 10,
                  },
                  {
                    icon: progress.isVerified ? CheckCircle2 : Lock,
                    label: 'Get verified',
                    state: progress.isVerified ? 'done' : 'locked',
                  },
                ] as BadgeProgressItem[]
              ).map((item) => (
                <BadgeProgressRow key={item.label} item={item} />
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '10px 0 0', lineHeight: 1.5 }}>
              Earn badges by being active — posting, connecting, and getting verified.
            </p>
          </>
        ) : null}
      </Widget>
```

- [ ] **Step 5: Typecheck frontend**

```bash
npx pnpm --filter web typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/RightSidebar.tsx
git commit -m "feat(web): wire Your progress widget with real data"
```

---

## Task 7: Lint pass + final typecheck

- [ ] **Step 1: Run lint across all workspaces**

```bash
npx pnpm lint
```

Fix any reported issues before continuing.

- [ ] **Step 2: Run full typecheck**

```bash
npx pnpm typecheck
```

Expected: no errors in any workspace.

- [ ] **Step 3: Final commit (only if lint/typecheck required fixes)**

```bash
git add -p   # stage only lint/type fixes
git commit -m "chore: fix lint and type errors in right sidebar feature"
```
