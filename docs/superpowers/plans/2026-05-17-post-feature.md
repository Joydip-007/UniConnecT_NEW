# Post Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the post feature end-to-end: comment delete/reactions, notification emissions, shared types, 11 data-fetching hooks, CreatePost modal composer (text + photo + poll + type toggle), CommentDrawer slide-over, and PostCard three-dot menu.

**Architecture:** Backend adds comment delete + reaction endpoints and wires notification emissions into the feed service. The frontend extracts all server-state into TanStack Query hooks in `features/feed/hooks/`; components receive data and callbacks as props and never call `api` directly. The CommentDrawer is a position-fixed slide-over; CreatePost becomes a modal composer.

**Tech Stack:** Express + Knex (API), React 18 + TanStack Query v5 + Zustand + Socket.io-client (web), Zod (validation), react-markdown (new), MSW v2 (tests), supertest + vitest (API tests).

---

## File map

### Backend (`apps/api/src/`)
| File | Action |
|------|--------|
| `modules/feed/service.ts` | Add `deleteComment`, `upsertCommentReaction`, `removeCommentReaction`; fix `removeReaction` socket; add notification calls |
| `modules/feed/controller.ts` | Add `deleteComment`, `addCommentReaction`, `removeCommentReaction` |
| `modules/feed/router.ts` | Add 3 new routes |
| `modules/__tests__/feed.test.ts` | Add tests for new endpoints |

### Shared (`packages/shared/src/`)
| File | Action |
|------|--------|
| `types/feed.ts` | New — `FeedPost`, `FeedPoll`, `FeedComment`, `FeedPostAuthor` |
| `types/index.ts` | Export from `feed.ts` |

### Frontend (`apps/web/src/`)
| File | Action |
|------|--------|
| `features/feed/hooks/usePosts.ts` | New |
| `features/feed/hooks/useProfilePosts.ts` | New |
| `features/feed/hooks/useComments.ts` | New |
| `features/feed/hooks/useCreatePost.ts` | New |
| `features/feed/hooks/useUpdatePost.ts` | New |
| `features/feed/hooks/useDeletePost.ts` | New |
| `features/feed/hooks/useUpsertReaction.ts` | New |
| `features/feed/hooks/useSavePost.ts` | New |
| `features/feed/hooks/useCreateComment.ts` | New |
| `features/feed/hooks/useDeleteComment.ts` | New |
| `features/feed/hooks/useUpsertCommentReaction.ts` | New |
| `features/feed/hooks/useFeedSocket.ts` | Add 3 new socket handlers, remove old `feed:reaction:new` handler |
| `features/feed/components/CreatePost.tsx` | Full rewrite — modal composer |
| `features/feed/components/PostCard.tsx` | Add three-dot menu, react-markdown, new props |
| `features/feed/components/CommentDrawer.tsx` | New |
| `pages/FeedPage.tsx` | Wire openPost/editPost state, use `usePosts` hook |
| `features/profile/components/PostsPanel.tsx` | Use `useProfilePosts` |

---

## Task 1: Shared feed types

**Files:**
- Create: `packages/shared/src/types/feed.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Create `packages/shared/src/types/feed.ts`**

```typescript
export interface FeedPollOption {
  id: string
  text: string
  displayOrder: number
  voteCount: number
}

export interface FeedPoll {
  id: string
  question: string
  expiresAt: string | null
  options: FeedPollOption[]
  myVote: string | null
  totalVotes: number
}

export interface FeedPostAuthor {
  id: string
  fullName: string
  role: 'student' | 'alumni' | 'faculty' | 'admin'
  profile: {
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
}

export interface FeedPost {
  id: string
  type: 'post' | 'announcement' | 'lost_found' | 'news' | 'event_promo'
  content: string
  mediaUrls: string[]
  author: FeedPostAuthor
  isPinned: boolean
  viewCount: number
  reactionCounts: { like: number; love: number; insightful: number; celebrate: number }
  myReaction: 'like' | 'love' | 'insightful' | 'celebrate' | null
  commentCount: number
  isSaved: boolean
  poll: FeedPoll | null
  jobEmbed: null
  eventEmbed: null
  lostFoundEmbed: null
  createdAt: string
}

export interface FeedComment {
  id: string
  postId: string
  authorId: string
  parentId: string | null
  content: string
  createdAt: string
  updatedAt: string
  author: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
  }
  reactionCounts: { like: number; love: number; insightful: number; celebrate: number }
  ownReaction: 'like' | 'love' | 'insightful' | 'celebrate' | null
  replies: FeedComment[]
}
```

- [ ] **Step 2: Add exports to `packages/shared/src/types/index.ts`**

Append to the existing file:
```typescript
export type { FeedPost, FeedPoll, FeedPollOption, FeedPostAuthor, FeedComment } from './feed'
```

- [ ] **Step 3: Verify shared package builds**

```bash
npx pnpm --filter @uniconnect/shared build 2>/dev/null || npx pnpm --filter @uniconnect/shared typecheck
```
Expected: exits 0, no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/feed.ts packages/shared/src/types/index.ts
git commit -m "feat(shared): add FeedPost, FeedComment, FeedPoll types"
```

---

## Task 2: Backend — comment delete + comment reactions

**Files:**
- Modify: `apps/api/src/modules/feed/service.ts`
- Modify: `apps/api/src/modules/feed/controller.ts`
- Modify: `apps/api/src/modules/feed/router.ts`
- Modify: `apps/api/src/__tests__/feed.test.ts`

- [ ] **Step 1: Write failing tests** — append to `apps/api/src/__tests__/feed.test.ts`

```typescript
describe('DELETE /api/v1/posts/:postId/comments/:commentId', () => {
  let postId: string
  let commentId: string

  beforeAll(async () => {
    const postRes = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: 'Post for comment delete test', type: 'post' })
    postId = postRes.body.data.id as string
    createdPostIds.push(postId)

    const commentRes = await api
      .post(`/api/v1/posts/${postId}/comments`)
      .set(authHeader(studentToken))
      .send({ content: 'Comment to delete' })
    commentId = commentRes.body.data.id as string
  })

  it('returns 200 when the author deletes their comment', async () => {
    const res = await api
      .delete(`/api/v1/posts/${postId}/comments/${commentId}`)
      .set(authHeader(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data.deleted).toBe(true)
  })

  it('returns 404 for an already-deleted comment', async () => {
    const res = await api
      .delete(`/api/v1/posts/${postId}/comments/${commentId}`)
      .set(authHeader(studentToken))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/v1/posts/:postId/comments/:commentId/reactions', () => {
  let postId: string
  let commentId: string

  beforeAll(async () => {
    const postRes = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: 'Post for comment reaction test', type: 'post' })
    postId = postRes.body.data.id as string
    createdPostIds.push(postId)

    const commentRes = await api
      .post(`/api/v1/posts/${postId}/comments`)
      .set(authHeader(studentToken))
      .send({ content: 'Comment to react to' })
    commentId = commentRes.body.data.id as string
  })

  it('returns 200 when adding a reaction', async () => {
    const res = await api
      .post(`/api/v1/posts/${postId}/comments/${commentId}/reactions`)
      .set(authHeader(studentToken))
      .send({ reaction_type: 'like' })
    expect(res.status).toBe(200)
  })

  it('returns 200 when removing a reaction', async () => {
    const res = await api
      .delete(`/api/v1/posts/${postId}/comments/${commentId}/reactions`)
      .set(authHeader(studentToken))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx pnpm --filter api test -- --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|✓|×|comment delete|comment reaction)"
```
Expected: new describe blocks fail with 404 (routes don't exist yet).

- [ ] **Step 3: Add service methods** — in `apps/api/src/modules/feed/service.ts`, add inside the `FeedService` class after `createComment`:

```typescript
async deleteComment(context: AuthContext, postId: string, commentId: string) {
  const comment = await db('comments')
    .select<{ id: string; author_id: string }>('id', 'author_id')
    .where({ id: commentId, post_id: postId })
    .first()
  if (!comment) throw notFound('Comment not found', 'COMMENT_NOT_FOUND')
  if (comment.author_id !== context.userId && context.role !== 'admin') {
    throw forbidden('Cannot delete this comment', 'COMMENT_FORBIDDEN')
  }
  await db('reactions').where({ target_id: commentId, target_type: 'comment' }).delete()
  await db('comments').where({ id: commentId }).delete()
  const io = getIo()
  io.to(`uni:${context.universityId}`).emit('feed:comment:deleted', { postId, commentId })
  return { deleted: true }
}

async upsertCommentReaction(context: AuthContext, postId: string, commentId: string, reactionType: ReactionType) {
  await assertPostInUniversity(postId, context.universityId)
  const comment = await db('comments').where({ id: commentId, post_id: postId }).first()
  if (!comment) throw notFound('Comment not found', 'COMMENT_NOT_FOUND')

  await db('reactions')
    .insert({ user_id: context.userId, target_id: commentId, target_type: 'comment', reaction_type: reactionType })
    .onConflict(['user_id', 'target_id', 'target_type'])
    .merge({ reaction_type: reactionType, created_at: db.fn.now() })

  return { reacted: true }
}

async removeCommentReaction(context: AuthContext, postId: string, commentId: string) {
  await assertPostInUniversity(postId, context.universityId)
  await db('reactions')
    .where({ user_id: context.userId, target_id: commentId, target_type: 'comment' })
    .delete()
  return { removed: true }
}
```

- [ ] **Step 4: Add controller handlers** — in `apps/api/src/modules/feed/controller.ts`, add after `createComment`:

```typescript
export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.deleteComment(context, getPostIdParam(req), getCommentIdParam(req)))
})

export const addCommentReaction = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { reaction_type } = req.body as { reaction_type: ReactionType }
  sendSuccess(res, await feedService.upsertCommentReaction(context, getPostIdParam(req), getCommentIdParam(req), reaction_type))
})

export const removeCommentReaction = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.removeCommentReaction(context, getPostIdParam(req), getCommentIdParam(req)))
})
```

Also add `type ReactionType = 'like' | 'love' | 'insightful' | 'celebrate'` at the top of controller.ts (or import from service).

Add the helper at the bottom of controller.ts:
```typescript
function getCommentIdParam(req: Request) {
  const value = req.params.commentId
  return Array.isArray(value) ? value[0] : value
}
```

Update the import at top of controller.ts to add the three new exports:
```typescript
import { ..., deleteComment as deleteCommentService, ... } from './service'
```
(Actually controller just uses `feedService.*` — just add the exports.)

- [ ] **Step 5: Add routes** — in `apps/api/src/modules/feed/router.ts`, add after the existing comment routes:

```typescript
feedRouter.delete('/:postId/comments/:commentId', deleteComment)
feedRouter.post('/:postId/comments/:commentId/reactions', validate(ReactionSchema), addCommentReaction)
feedRouter.delete('/:postId/comments/:commentId/reactions', removeCommentReaction)
```

Update the import at top of router.ts to include `deleteComment`, `addCommentReaction`, `removeCommentReaction`.

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npx pnpm --filter api test 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/feed/service.ts apps/api/src/modules/feed/controller.ts apps/api/src/modules/feed/router.ts apps/api/src/__tests__/feed.test.ts
git commit -m "feat(api): add comment delete and comment reaction endpoints"
```

---

## Task 3: Backend — fix reaction socket + add notification emissions

**Files:**
- Modify: `apps/api/src/modules/feed/service.ts`

- [ ] **Step 1: Fix `upsertReaction`** — find the two `io.to(...).emit(...)` calls inside `upsertReaction` and replace them with a single standardised emission:

Replace:
```typescript
io.to(`uni:${context.universityId}`).emit('post:reaction', payload)
io.to(`uni:${context.universityId}`).emit('feed:reaction:new', {
  postId,
  reactionType,
  count: reactionCounts[reactionType],
})
return payload
```

With:
```typescript
io.to(`uni:${context.universityId}`).emit('post:reaction', payload)
io.to(`uni:${context.universityId}`).emit('feed:reaction:updated', { postId, reactionCounts })

// Notify post author (fire-and-forget)
const post = await db('posts').select<{ author_id: string; university_id: string }>('author_id', 'university_id').where({ id: postId }).first()
if (post && post.author_id !== context.userId) {
  const actorName = await notificationsService.getActorName(context.userId)
  notificationsService
    .createNotification({
      userId: post.author_id,
      type: 'post_reaction',
      actorId: context.userId,
      referenceId: postId,
      referenceType: 'post',
      content: `${actorName} reacted to your post`,
    })
    .catch((err: unknown) => logger.warn('Failed to create reaction notification', { err }))
}

return payload
```

- [ ] **Step 2: Fix `removeReaction`** — find the `feed:reaction:new` emission with the hardcoded `'like'` and replace:

Replace:
```typescript
io.to(`uni:${context.universityId}`).emit('feed:reaction:new', {
  postId,
  reactionType: 'like',
  count: reactionCounts.like,
})
```

With:
```typescript
io.to(`uni:${context.universityId}`).emit('feed:reaction:updated', { postId, reactionCounts })
```

- [ ] **Step 3: Add notification to `createComment`** — after the `io.to(...).emit(...)` calls in `createComment`, add:

```typescript
// Notify post author (fire-and-forget)
const post = await db('posts').select<{ author_id: string }>('author_id').where({ id: postId }).first()
if (post && post.author_id !== context.userId) {
  const actorName = await notificationsService.getActorName(context.userId)
  notificationsService
    .createNotification({
      userId: post.author_id,
      type: 'post_comment',
      actorId: context.userId,
      referenceId: postId,
      referenceType: 'post',
      content: `${actorName} commented on your post`,
    })
    .catch((err: unknown) => logger.warn('Failed to create comment notification', { err }))
}
```

- [ ] **Step 4: Add import** — at top of `service.ts`, add:

```typescript
import { notificationsService } from '../notifications/service'
```

- [ ] **Step 5: Run typecheck**

```bash
npx pnpm --filter api typecheck 2>&1 | tail -20
```
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/feed/service.ts
git commit -m "fix(api): standardise reaction socket events and add notification emissions"
```

---

## Task 4: Install react-markdown

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Install**

```bash
npx pnpm --filter web add react-markdown
```

If pnpm prints a prompt about `allowBuilds` for any package, open `pnpm-workspace.yaml` and set the flagged package to `true`, then re-run.

- [ ] **Step 2: Verify import resolves**

```bash
npx pnpm --filter web typecheck 2>&1 | grep -i "react-markdown" | head -5
```
Expected: no errors mentioning react-markdown.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore(web): add react-markdown dependency"
```

---

## Task 5: Feed data-fetching hooks

**Files:**
- Create: `apps/web/src/features/feed/hooks/usePosts.ts`
- Create: `apps/web/src/features/feed/hooks/useProfilePosts.ts`
- Create: `apps/web/src/features/feed/hooks/useComments.ts`

- [ ] **Step 1: Create `usePosts.ts`**

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import type { FeedPost } from '@uniconnect/shared'

export type FeedFilter = 'all' | 'post' | 'news' | 'event_promo' | 'announcement' | 'lost_found'

export interface FeedPage {
  items: FeedPost[]
  total: number
  page: number
  hasMore: boolean
}

export type FeedInfiniteData = InfiniteData<FeedPage>

export const POSTS_FEED_KEY = ['posts', 'feed'] as const

export function usePosts(filter: FeedFilter) {
  const universityId = useAuthStore((s) => s.user?.universityId)
  return useInfiniteQuery<FeedPage>({
    queryKey: [...POSTS_FEED_KEY, { universityId, type: filter }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: FeedPage }>('/posts', {
          params: { page: pageParam, ...(filter !== 'all' && { type: filter }) },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!universityId,
  })
}
```

- [ ] **Step 2: Create `useProfilePosts.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedPost } from '@uniconnect/shared'

export interface ProfilePostsPage {
  items: FeedPost[]
  total: number
  page: number
  hasMore: boolean
}

export const PROFILE_POSTS_KEY = ['posts', 'profile'] as const

export function useProfilePosts(userId: string) {
  return useQuery<ProfilePostsPage>({
    queryKey: [...PROFILE_POSTS_KEY, { userId }],
    queryFn: () =>
      api
        .get<{ data: ProfilePostsPage }>('/posts', { params: { authorId: userId, limit: 20 } })
        .then((r) => r.data.data),
    enabled: !!userId,
  })
}
```

- [ ] **Step 3: Create `useComments.ts`**

```typescript
import { useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { socket } from '@/lib/socket'
import type { FeedComment } from '@uniconnect/shared'

export interface CommentsPage {
  items: FeedComment[]
  total: number
  page: number
  hasMore: boolean
}

export type CommentsData = InfiniteData<CommentsPage>

export function commentsQueryKey(postId: string) {
  return ['posts', 'comments', { postId }] as const
}

export function useComments(postId: string, enabled: boolean) {
  const queryClient = useQueryClient()

  const query = useInfiniteQuery<CommentsPage>({
    queryKey: commentsQueryKey(postId),
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: CommentsPage }>(`/posts/${postId}/comments`, {
          params: { page: pageParam },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  })

  useEffect(() => {
    if (!enabled) return

    function onCommentNew({ postId: evPostId, comment }: { postId: string; comment: FeedComment }) {
      if (evPostId !== postId) return
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old || old.pages.length === 0) return old
        const [first, ...rest] = old.pages as [CommentsPage, ...CommentsPage[]]
        if (!comment.parentId) {
          return {
            ...old,
            pages: [{ ...first, items: [{ ...comment, replies: [] }, ...first.items], total: first.total + 1 }, ...rest],
          }
        }
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((c) =>
              c.id === comment.parentId ? { ...c, replies: [...c.replies, comment] } : c,
            ),
          })),
        }
      })
    }

    function onCommentDeleted({ postId: evPostId, commentId }: { postId: string; commentId: string }) {
      if (evPostId !== postId) return
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items
              .filter((c) => c.id !== commentId)
              .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== commentId) })),
          })),
        }
      })
    }

    socket.on('feed:comment:new', onCommentNew)
    socket.on('feed:comment:deleted', onCommentDeleted)
    return () => {
      socket.off('feed:comment:new', onCommentNew)
      socket.off('feed:comment:deleted', onCommentDeleted)
    }
  }, [enabled, postId, queryClient])

  return query
}
```

- [ ] **Step 4: Typecheck**

```bash
npx pnpm --filter web typecheck 2>&1 | tail -10
```
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/feed/hooks/usePosts.ts apps/web/src/features/feed/hooks/useProfilePosts.ts apps/web/src/features/feed/hooks/useComments.ts
git commit -m "feat(web): add usePosts, useProfilePosts, useComments hooks"
```

---

## Task 6: Post write hooks

**Files:**
- Create: `apps/web/src/features/feed/hooks/useCreatePost.ts`
- Create: `apps/web/src/features/feed/hooks/useUpdatePost.ts`
- Create: `apps/web/src/features/feed/hooks/useDeletePost.ts`

- [ ] **Step 1: Create `useCreatePost.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedPost } from '@uniconnect/shared'
import { POSTS_FEED_KEY, type FeedInfiniteData, type FeedPage } from './usePosts'

export interface CreatePostInput {
  type: 'post' | 'announcement' | 'lost_found' | 'event_promo'
  content: string
  media_urls?: string[]
  poll?: { question: string; options: string[]; expires_at?: string | null }
  group_id?: string | null
}

export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePostInput) =>
      api.post<{ data: FeedPost }>('/posts', input).then((r) => r.data.data),
    onSuccess: (newPost) => {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old || old.pages.length === 0) return old
          const [first, ...rest] = old.pages as [FeedPage, ...FeedPage[]]
          return {
            ...old,
            pages: [{ ...first, items: [newPost, ...first.items], total: first.total + 1 }, ...rest],
          }
        },
      )
    },
  })
}
```

- [ ] **Step 2: Create `useUpdatePost.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedPost } from '@uniconnect/shared'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'
import { PROFILE_POSTS_KEY, type ProfilePostsPage } from './useProfilePosts'

export interface UpdatePostInput {
  content?: string
  media_urls?: string[]
  type?: 'post' | 'announcement' | 'lost_found' | 'event_promo'
  is_pinned?: boolean
}

export function useUpdatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: UpdatePostInput }) =>
      api.patch<{ data: FeedPost }>(`/posts/${postId}`, input).then((r) => r.data.data),
    onSuccess: (updated) => {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) => (p.id === updated.id ? updated : p)),
            })),
          }
        },
      )
      queryClient.setQueriesData<ProfilePostsPage>(
        { queryKey: PROFILE_POSTS_KEY },
        (old) => {
          if (!old) return old
          return { ...old, items: old.items.map((p) => (p.id === updated.id ? updated : p)) }
        },
      )
    },
  })
}
```

- [ ] **Step 3: Create `useDeletePost.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'
import { PROFILE_POSTS_KEY, type ProfilePostsPage } from './useProfilePosts'

export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) =>
      api.delete(`/posts/${postId}`).then((r) => r.data),
    onSuccess: (_, postId) => {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((p) => p.id !== postId),
            })),
          }
        },
      )
      queryClient.setQueriesData<ProfilePostsPage>(
        { queryKey: PROFILE_POSTS_KEY },
        (old) => {
          if (!old) return old
          return { ...old, items: old.items.filter((p) => p.id !== postId) }
        },
      )
    },
  })
}
```

- [ ] **Step 4: Typecheck**

```bash
npx pnpm --filter web typecheck 2>&1 | tail -10
```
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/feed/hooks/useCreatePost.ts apps/web/src/features/feed/hooks/useUpdatePost.ts apps/web/src/features/feed/hooks/useDeletePost.ts
git commit -m "feat(web): add useCreatePost, useUpdatePost, useDeletePost hooks"
```

---

## Task 7: Post interaction hooks

**Files:**
- Create: `apps/web/src/features/feed/hooks/useUpsertReaction.ts`
- Create: `apps/web/src/features/feed/hooks/useSavePost.ts`
- Create: `apps/web/src/features/feed/hooks/useCreateComment.ts`
- Create: `apps/web/src/features/feed/hooks/useDeleteComment.ts`
- Create: `apps/web/src/features/feed/hooks/useUpsertCommentReaction.ts`

- [ ] **Step 1: Create `useUpsertReaction.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'

export function useUpsertReaction(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ wasLiked }: { wasLiked: boolean }) =>
      wasLiked
        ? api.delete(`/posts/${postId}/reactions`).then((r) => r.data)
        : api.post(`/posts/${postId}/reactions`, { reaction_type: 'like' }).then((r) => r.data),
    onMutate: async ({ wasLiked }) => {
      await queryClient.cancelQueries({ queryKey: POSTS_FEED_KEY })
      const snapshot = queryClient.getQueriesData<FeedInfiniteData>({ queryKey: POSTS_FEED_KEY })
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.id === postId
                  ? {
                      ...p,
                      myReaction: wasLiked ? null : ('like' as const),
                      reactionCounts: {
                        ...p.reactionCounts,
                        like: wasLiked ? p.reactionCounts.like - 1 : p.reactionCounts.like + 1,
                      },
                    }
                  : p,
              ),
            })),
          }
        },
      )
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) {
          queryClient.setQueryData(key, data)
        }
      }
    },
  })
}
```

- [ ] **Step 2: Create `useSavePost.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'

export function useSavePost(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ wasSaved }: { wasSaved: boolean }) =>
      wasSaved
        ? api.delete(`/posts/${postId}/save`).then((r) => r.data)
        : api.post(`/posts/${postId}/save`).then((r) => r.data),
    onMutate: async ({ wasSaved }) => {
      await queryClient.cancelQueries({ queryKey: POSTS_FEED_KEY })
      const snapshot = queryClient.getQueriesData<FeedInfiniteData>({ queryKey: POSTS_FEED_KEY })
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) => (p.id === postId ? { ...p, isSaved: !wasSaved } : p)),
            })),
          }
        },
      )
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) {
          queryClient.setQueryData(key, data)
        }
      }
    },
  })
}
```

- [ ] **Step 3: Create `useCreateComment.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedComment } from '@uniconnect/shared'
import { commentsQueryKey, type CommentsData, type CommentsPage } from './useComments'

export interface CreateCommentInput {
  content: string
  parent_id?: string | null
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      api.post<{ data: FeedComment }>(`/posts/${postId}/comments`, input).then((r) => r.data.data),
    onSuccess: (comment) => {
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old || old.pages.length === 0) return old
        const [first, ...rest] = old.pages as [CommentsPage, ...CommentsPage[]]
        if (!comment.parentId) {
          return {
            ...old,
            pages: [{ ...first, items: [{ ...comment, replies: [] }, ...first.items], total: first.total + 1 }, ...rest],
          }
        }
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((c) =>
              c.id === comment.parentId ? { ...c, replies: [...c.replies, comment] } : c,
            ),
          })),
        }
      })
    },
  })
}
```

- [ ] **Step 4: Create `useDeleteComment.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { commentsQueryKey, type CommentsData } from './useComments'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete(`/posts/${postId}/comments/${commentId}`).then((r) => r.data),
    onSuccess: (_, commentId) => {
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items
              .filter((c) => c.id !== commentId)
              .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== commentId) })),
          })),
        }
      })
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p,
              ),
            })),
          }
        },
      )
    },
  })
}
```

- [ ] **Step 5: Create `useUpsertCommentReaction.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedComment } from '@uniconnect/shared'
import { commentsQueryKey, type CommentsData, type CommentsPage } from './useComments'

function patchComment(
  pages: CommentsPage[],
  commentId: string,
  updater: (c: FeedComment) => FeedComment,
): CommentsPage[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.map((c) => {
      if (c.id === commentId) return updater(c)
      return { ...c, replies: c.replies.map((r) => (r.id === commentId ? updater(r) : r)) }
    }),
  }))
}

export function useUpsertCommentReaction(postId: string, commentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ wasLiked }: { wasLiked: boolean }) =>
      wasLiked
        ? api.delete(`/posts/${postId}/comments/${commentId}/reactions`).then((r) => r.data)
        : api.post(`/posts/${postId}/comments/${commentId}/reactions`, { reaction_type: 'like' }).then((r) => r.data),
    onMutate: async ({ wasLiked }) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey(postId) })
      const snapshot = queryClient.getQueryData<CommentsData>(commentsQueryKey(postId))
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old) return old
        return {
          ...old,
          pages: patchComment(old.pages, commentId, (c) => ({
            ...c,
            ownReaction: wasLiked ? null : ('like' as const),
            reactionCounts: {
              ...c.reactionCounts,
              like: wasLiked ? c.reactionCounts.like - 1 : c.reactionCounts.like + 1,
            },
          })),
        }
      })
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(commentsQueryKey(postId), context.snapshot)
    },
  })
}
```

- [ ] **Step 6: Typecheck**

```bash
npx pnpm --filter web typecheck 2>&1 | tail -10
```
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/feed/hooks/useUpsertReaction.ts apps/web/src/features/feed/hooks/useSavePost.ts apps/web/src/features/feed/hooks/useCreateComment.ts apps/web/src/features/feed/hooks/useDeleteComment.ts apps/web/src/features/feed/hooks/useUpsertCommentReaction.ts
git commit -m "feat(web): add reaction, save, and comment mutation hooks"
```

---

## Task 8: Update useFeedSocket

**Files:**
- Modify: `apps/web/src/features/feed/hooks/useFeedSocket.ts`

- [ ] **Step 1: Rewrite `useFeedSocket.ts`** — full replacement:

```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '@/lib/socket'
import type { FeedPost, FeedPoll } from '@uniconnect/shared'
import { POSTS_FEED_KEY, type FeedInfiniteData, type FeedPage } from './usePosts'

interface FeedPostNewPayload { post: FeedPost }
interface FeedReactionUpdatedPayload {
  postId: string
  reactionCounts: FeedPost['reactionCounts']
}
interface FeedCommentNewPayload { postId: string; comment: unknown }
interface FeedCommentDeletedPayload { postId: string; commentId: string }
interface FeedPollUpdatedPayload { pollId: string; options: FeedPoll['options'] }

export function useFeedSocket(universityId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!universityId) return

    function onPostNew({ post }: FeedPostNewPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old || old.pages.length === 0) return old
          const [first, ...rest] = old.pages as [FeedPage, ...FeedPage[]]
          // Avoid duplicates (post may already be in cache from optimistic insert)
          if (first.items.some((p) => p.id === post.id)) return old
          return { ...old, pages: [{ ...first, items: [post, ...first.items] }, ...rest] }
        },
      )
    }

    function onReactionUpdated({ postId, reactionCounts }: FeedReactionUpdatedPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) => (p.id === postId ? { ...p, reactionCounts } : p)),
            })),
          }
        },
      )
    }

    function onCommentNew({ postId }: FeedCommentNewPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
              ),
            })),
          }
        },
      )
    }

    function onCommentDeleted({ postId }: FeedCommentDeletedPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p,
              ),
            })),
          }
        },
      )
    }

    function onPollUpdated({ pollId, options }: FeedPollUpdatedPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.poll?.id === pollId
                  ? {
                      ...p,
                      poll: {
                        ...p.poll,
                        options,
                        totalVotes: options.reduce((sum, o) => sum + o.voteCount, 0),
                      },
                    }
                  : p,
              ),
            })),
          }
        },
      )
    }

    socket.on('feed:post:new', onPostNew)
    socket.on('feed:reaction:updated', onReactionUpdated)
    socket.on('feed:comment:new', onCommentNew)
    socket.on('feed:comment:deleted', onCommentDeleted)
    socket.on('feed:poll:updated', onPollUpdated)

    return () => {
      socket.off('feed:post:new', onPostNew)
      socket.off('feed:reaction:updated', onReactionUpdated)
      socket.off('feed:comment:new', onCommentNew)
      socket.off('feed:comment:deleted', onCommentDeleted)
      socket.off('feed:poll:updated', onPollUpdated)
    }
  }, [universityId, queryClient])
}
```

- [ ] **Step 2: Typecheck**

```bash
npx pnpm --filter web typecheck 2>&1 | tail -10
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/feed/hooks/useFeedSocket.ts
git commit -m "feat(web): update useFeedSocket — reaction:updated, comment:deleted, poll:updated"
```

---

## Task 9: Update PostCard

**Files:**
- Modify: `apps/web/src/features/feed/components/PostCard.tsx`

Replace the entire file with the following. Key changes: import `FeedPost`/`FeedComment` from shared, use `useUpsertReaction`/`useSavePost`/`useDeletePost` hooks, add three-dot menu, render content with `react-markdown`, accept `onCommentClick`/`onEditPost` props.

- [ ] **Step 1: Overwrite `PostCard.tsx`**

```typescript
import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  Bookmark,
  Briefcase,
  Calendar,
  ExternalLink,
  MapPin,
  MessageCircle,
  MoreVertical,
  Phone,
  ThumbsUp,
  Trash2,
  Pencil,
} from 'lucide-react'
import type { FeedPost, FeedPoll } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, PrimaryBtn, ReactionBtn } from '@/components/Button'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useUpsertReaction } from '@/features/feed/hooks/useUpsertReaction'
import { useSavePost } from '@/features/feed/hooks/useSavePost'
import { useDeletePost } from '@/features/feed/hooks/useDeletePost'

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleBadgeVariant(role: FeedPost['author']['role']): 'dept' | 'alumni' | 'neutral' {
  if (role === 'student') return 'dept'
  if (role === 'alumni') return 'alumni'
  return 'neutral'
}

function roleLabel(role: FeedPost['author']['role']): string {
  if (role === 'faculty') return 'Faculty'
  if (role === 'admin') return 'Admin'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

// ── PinnedBar ─────────────────────────────────────────────────────────────────

function PinnedBar() {
  return (
    <div
      style={{
        background: 'var(--uc-orange-bg)',
        borderBottom: '0.5px solid var(--uc-orange-bdr)',
        padding: '7px 16px',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--uc-orange-l)' }}>
        Announcement
      </span>
    </div>
  )
}

// ── PollBlock ─────────────────────────────────────────────────────────────────

function PollBlock({ poll, postId }: { poll: FeedPoll; postId: string }) {
  const [localVote, setLocalVote] = useState<string | null>(poll.myVote)
  const [counts, setCounts] = useState(() => poll.options.map((o) => o.voteCount))
  const [animated, setAnimated] = useState(false)
  const voted = localVote !== null
  const totalVotes = counts.reduce((a, b) => a + b, 0)

  function handleVote(optionId: string) {
    if (voted) return
    const idx = poll.options.findIndex((o) => o.id === optionId)
    if (idx !== -1) setCounts((prev) => prev.map((c, i) => (i === idx ? c + 1 : c)))
    setLocalVote(optionId)
    setTimeout(() => setAnimated(true), 16)
    import('@/lib/axios').then(({ api }) =>
      api.post(`/polls/${poll.id}/vote`, { optionId }).catch(() => {}),
    )
  }

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        marginTop: 8,
      }}
    >
      <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
        {poll.question}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {poll.options.map((option, idx) => {
          const count = counts[idx] ?? 0
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isChosen = localVote === option.id
          return (
            <button
              key={option.id}
              type="button"
              disabled={voted}
              onClick={() => handleVote(option.id)}
              style={{
                width: '100%',
                position: 'relative',
                background: 'transparent',
                border: `0.5px solid ${isChosen ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                borderRadius: 'var(--r-sm)',
                padding: '9px 12px',
                cursor: voted ? 'default' : 'pointer',
                overflow: 'hidden',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0, bottom: 0, left: 0,
                  width: animated ? `${pct}%` : '0%',
                  background: isChosen ? 'var(--uc-indigo-bg)' : 'rgba(255,255,255,0.04)',
                  transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: isChosen ? 500 : 400, color: isChosen ? 'var(--uc-indigo-xl)' : 'var(--text-primary)' }}>
                  {option.text}
                </span>
                {voted && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pct}%</span>}
              </div>
            </button>
          )
        })}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
        {totalVotes.toLocaleString()} vote{totalVotes !== 1 ? 's' : ''}
        {poll.expiresAt && ` · closes ${formatDistanceToNow(parseISO(poll.expiresAt), { addSuffix: true })}`}
      </p>
    </div>
  )
}

// ── ThreeDotMenu ──────────────────────────────────────────────────────────────

interface ThreeDotMenuProps {
  onEdit: () => void
  onDelete: () => void
}

function ThreeDotMenu({ onEdit, onDelete }: ThreeDotMenuProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleDelete() {
    setOpen(false)
    if (window.confirm('Delete this post? This cannot be undone.')) {
      onDelete()
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: 'var(--r-sm)',
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <MoreVertical size={16} strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              zIndex: 50,
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-md)',
              padding: 4,
              minWidth: 140,
              marginTop: 4,
            }}
          >
            <MenuBtn icon={<Pencil size={13} strokeWidth={1.5} />} label="Edit post" onClick={() => { setOpen(false); onEdit() }} />
            <MenuBtn icon={<Trash2 size={13} strokeWidth={1.5} />} label="Delete" onClick={handleDelete} danger />
          </div>
        </>
      )}
    </div>
  )
}

function MenuBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 400,
        color: danger ? 'var(--uc-red)' : 'var(--text-primary)',
        textAlign: 'left',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── PostCard ──────────────────────────────────────────────────────────────────

export interface PostCardProps {
  post: FeedPost
  onCommentClick: (postId: string) => void
  onEditPost: (post: FeedPost) => void
}

export function PostCard({ post, onCommentClick, onEditPost }: PostCardProps) {
  const user = useAuthStore((s) => s.user)
  const [localLike, setLocalLike] = useState(post.myReaction === 'like')
  const [localLikeCount, setLocalLikeCount] = useState(post.reactionCounts.like)
  const [localSaved, setLocalSaved] = useState(post.isSaved)

  const reactionMutation = useUpsertReaction(post.id)
  const saveMutation = useSavePost(post.id)
  const deleteMutation = useDeletePost()

  function handleLike() {
    const wasLiked = localLike
    setLocalLike(!wasLiked)
    setLocalLikeCount((c) => (wasLiked ? c - 1 : c + 1))
    reactionMutation.mutate(
      { wasLiked },
      { onError: () => { setLocalLike(wasLiked); setLocalLikeCount((c) => (wasLiked ? c + 1 : c - 1)) } },
    )
  }

  function handleSave() {
    const wasSaved = localSaved
    setLocalSaved(!wasSaved)
    saveMutation.mutate({ wasSaved }, { onError: () => setLocalSaved(wasSaved) })
  }

  const canEdit = user && (user.id === post.author.id || user.role === 'admin')
  const isAnnouncement = post.type === 'announcement' || post.isPinned
  const author = post.author

  return (
    <article
      className="card-hover-border"
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        transition: 'border-color 200ms',
        marginBottom: 12,
      }}
    >
      {isAnnouncement && <PinnedBar />}

      <div style={{ padding: '14px 16px 12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <Avatar initials={getInitials(author.fullName)} color={avatarColor(author.id)} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                {author.fullName}
              </span>
              <Badge variant={roleBadgeVariant(author.role)}>{roleLabel(author.role)}</Badge>
              {author.profile.department && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  · {author.profile.department}
                  {author.profile.batchYear && ` '${author.profile.batchYear.slice(-2)}`}
                </span>
              )}
            </div>
            {author.profile.headline && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                {author.profile.headline}
              </p>
            )}
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              {formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true })}
            </p>
          </div>
          {canEdit && (
            <ThreeDotMenu
              onEdit={() => onEditPost(post)}
              onDelete={() => deleteMutation.mutate(post.id)}
            />
          )}
        </div>

        {/* Body — rendered as markdown */}
        {post.content && (
          <div
            style={{
              fontSize: 15,
              fontWeight: 400,
              color: 'var(--text-primary)',
              lineHeight: 1.72,
              marginBottom: 12,
            }}
          >
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>
        )}

        {/* Media grid */}
        {post.mediaUrls.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: post.mediaUrls.length === 1 ? '1fr' : '1fr 1fr',
              gap: 3,
              marginBottom: 12,
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
            }}
          >
            {post.mediaUrls.slice(0, 4).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Photo ${i + 1}`}
                loading="lazy"
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
              />
            ))}
          </div>
        )}

        {/* Poll */}
        {post.poll && <PollBlock poll={post.poll} postId={post.id} />}

        {/* Reactions bar */}
        <div
          style={{
            borderTop: '0.5px solid var(--border-default)',
            marginTop: 12,
            paddingTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <ReactionBtn active={localLike} onClick={handleLike}>
            <ThumbsUp size={15} strokeWidth={1.5} />
            Like
            {localLikeCount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 2 }}>
                {localLikeCount}
              </span>
            )}
          </ReactionBtn>

          <ReactionBtn onClick={() => onCommentClick(post.id)}>
            <MessageCircle size={15} strokeWidth={1.5} />
            Comment
            {post.commentCount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 2 }}>
                {post.commentCount}
              </span>
            )}
          </ReactionBtn>

          <ReactionBtn active={localSaved} onClick={handleSave} style={{ marginLeft: 'auto' }}>
            <Bookmark size={15} strokeWidth={1.5} fill={localSaved ? 'currentColor' : 'none'} />
            Save
          </ReactionBtn>
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx pnpm --filter web typecheck 2>&1 | tail -20
```
Expected: exits 0. Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/feed/components/PostCard.tsx
git commit -m "feat(web): update PostCard — three-dot menu, markdown, hook-based mutations"
```

---

## Task 10: Rewrite CreatePost composer

**Files:**
- Modify: `apps/web/src/features/feed/components/CreatePost.tsx`

- [ ] **Step 1: Overwrite `CreatePost.tsx`** with the full modal composer:

```typescript
import { useRef, useState, useCallback } from 'react'
import type { FeedPost } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/axios'
import { Avatar } from '@/components/Avatar'
import { PrimaryBtn, GhostBtn } from '@/components/Button'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useCreatePost, type CreatePostInput } from '@/features/feed/hooks/useCreatePost'
import { useUpdatePost, type UpdatePostInput } from '@/features/feed/hooks/useUpdatePost'
import { Image, BarChart2, Bold, Italic, Link } from 'lucide-react'

type ComposerMode = 'text' | 'photo' | 'poll'
type PostType = 'post' | 'announcement'

interface PollDraft {
  question: string
  options: string[]
  expiresAt: string
}

interface UploadedFile {
  name: string
  previewUrl: string
  publicUrl: string
  uploading: boolean
}

interface Props {
  editPost?: FeedPost | null
  onClose?: () => void
}

function insertAround(textarea: HTMLTextAreaElement, before: string, after = before): string {
  const { selectionStart: start, selectionEnd: end, value } = textarea
  const selected = value.slice(start, end)
  const replacement = `${before}${selected || 'text'}${after}`
  return value.slice(0, start) + replacement + value.slice(end)
}

export function CreatePost({ editPost, onClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(!!editPost)
  const [mode, setMode] = useState<ComposerMode>('text')
  const [postType, setPostType] = useState<PostType>((editPost?.type === 'announcement' ? 'announcement' : 'post'))
  const [text, setText] = useState(editPost?.content ?? '')
  const [files, setFiles] = useState<UploadedFile[]>(
    (editPost?.mediaUrls ?? []).map((url) => ({ name: url, previewUrl: url, publicUrl: url, uploading: false })),
  )
  const [poll, setPoll] = useState<PollDraft>({ question: '', options: ['', ''], expiresAt: '' })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createPost = useCreatePost()
  const updatePost = useUpdatePost()
  const isEdit = !!editPost
  const isPending = createPost.isPending || updatePost.isPending
  const isUploading = files.some((f) => f.uploading)

  const canSubmit = text.trim().length > 0 && !isPending && !isUploading

  const canToggleType = user?.role === 'faculty' || user?.role === 'admin'

  function handleOpen() {
    setOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleClose() {
    if (isEdit && onClose) { onClose(); return }
    setOpen(false)
    setText('')
    setFiles([])
    setPoll({ question: '', options: ['', ''], expiresAt: '' })
    setMode('text')
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`
  }

  function handleMdAction(before: string, after = before) {
    const ta = textareaRef.current
    if (!ta) return
    setText(insertAround(ta, before, after))
    ta.focus()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, 4 - files.length)
    if (selected.length === 0) return

    const newEntries: UploadedFile[] = selected.map((f) => ({
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      publicUrl: '',
      uploading: true,
    }))
    setFiles((prev) => [...prev, ...newEntries])

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i]!
      try {
        const { data } = await api.get<{ data: { uploadUrl: string; publicUrl: string } }>(
          '/upload/presign',
          { params: { filename: file.name, contentType: file.type } },
        )
        await fetch(data.data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })
        setFiles((prev) => {
          const idx = prev.findIndex((f) => f.name === file.name && f.uploading)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...next[idx]!, publicUrl: data.data.publicUrl, uploading: false }
          return next
        })
      } catch {
        setFiles((prev) => prev.filter((f) => !(f.name === file.name && f.uploading)))
      }
    }
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  function addPollOption() {
    if (poll.options.length >= 10) return
    setPoll((p) => ({ ...p, options: [...p.options, ''] }))
  }

  function setPollOption(idx: number, value: string) {
    setPoll((p) => { const opts = [...p.options]; opts[idx] = value; return { ...p, options: opts } })
  }

  function removePollOption(idx: number) {
    if (poll.options.length <= 2) return
    setPoll((p) => ({ ...p, options: p.options.filter((_, i) => i !== idx) }))
  }

  async function handleSubmit() {
    if (!canSubmit) return
    const media_urls = files.map((f) => f.publicUrl).filter(Boolean)
    const hasPoll = mode === 'poll' && poll.question.trim() && poll.options.filter((o) => o.trim()).length >= 2

    if (isEdit) {
      const input: UpdatePostInput = {
        content: text.trim(),
        type: postType,
        media_urls,
      }
      updatePost.mutate({ postId: editPost!.id, input }, { onSuccess: handleClose })
    } else {
      const input: CreatePostInput = {
        type: postType,
        content: text.trim(),
        media_urls,
        ...(hasPoll && {
          poll: {
            question: poll.question.trim(),
            options: poll.options.map((o) => o.trim()).filter(Boolean),
            expires_at: poll.expiresAt || null,
          },
        }),
      }
      createPost.mutate(input, { onSuccess: handleClose })
    }
  }

  if (!user) return null

  const name = user.profile.fullName ?? ''

  return (
    <>
      {/* Trigger row */}
      {!open && !isEdit && (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Avatar initials={getInitials(name)} color={avatarColor(user.id)} size={40} />
          <button
            onClick={handleOpen}
            style={{
              flex: 1,
              height: 40,
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-pill)',
              cursor: 'text',
              display: 'flex',
              alignItems: 'center',
              paddingInline: 16,
              color: 'var(--text-tertiary)',
              fontSize: 14,
              fontWeight: 400,
            }}
          >
            What's on your mind, {name.split(' ')[0]}?
          </button>
        </div>
      )}

      {/* Modal overlay */}
      {(open || isEdit) && (
        <>
          {/* Backdrop */}
          <div
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--overlay-bg)',
              zIndex: 100,
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 101,
              width: 'min(600px, 95vw)',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-xl)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: '16px 20px 12px',
                borderBottom: '0.5px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Avatar initials={getInitials(name)} color={avatarColor(user.id)} size={38} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {name}
                </p>
                {user.profile.headline && (
                  <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {user.profile.headline}
                  </p>
                )}
              </div>

              {/* Type toggle — faculty/admin only */}
              {canToggleType && !isEdit && (
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--surface-raised)',
                    borderRadius: 'var(--r-pill)',
                    padding: 2,
                    border: '0.5px solid var(--border-default)',
                  }}
                >
                  {(['post', 'announcement'] as PostType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPostType(t)}
                      style={{
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: postType === t ? 500 : 400,
                        borderRadius: 'var(--r-pill)',
                        border: 'none',
                        cursor: 'pointer',
                        background: postType === t ? 'var(--uc-orange-bg)' : 'transparent',
                        color: postType === t ? 'var(--uc-orange-l)' : 'var(--text-secondary)',
                        transition: 'all 150ms',
                      }}
                    >
                      {t === 'post' ? 'Post' : 'Announcement'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {/* Markdown toolbar */}
              <div
                style={{
                  padding: '8px 20px 0',
                  display: 'flex',
                  gap: 4,
                }}
              >
                {[
                  { icon: <Bold size={14} strokeWidth={1.5} />, action: () => handleMdAction('**') },
                  { icon: <Italic size={14} strokeWidth={1.5} />, action: () => handleMdAction('_') },
                  { icon: <Link size={14} strokeWidth={1.5} />, action: () => handleMdAction('[', '](url)') },
                ].map((btn, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={btn.action}
                    style={{
                      background: 'transparent',
                      border: '0.5px solid var(--border-default)',
                      borderRadius: 'var(--r-sm)',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextareaInput}
                placeholder="What's on your mind?"
                rows={4}
                style={{
                  width: '100%',
                  minHeight: 120,
                  maxHeight: 400,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 15,
                  fontWeight: 400,
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  padding: '12px 20px',
                  boxSizing: 'border-box',
                }}
              />

              {/* Photo thumbnails */}
              {files.length > 0 && (
                <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px', flexWrap: 'wrap' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                      <img
                        src={f.previewUrl}
                        alt="preview"
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 'var(--r-sm)',
                          border: '0.5px solid var(--border-default)',
                          opacity: f.uploading ? 0.5 : 1,
                        }}
                      />
                      {!f.uploading && (
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            background: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            borderRadius: '50%',
                            width: 20,
                            height: 20,
                            cursor: 'pointer',
                            color: '#fff',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Poll composer */}
              {mode === 'poll' && !isEdit && (
                <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    value={poll.question}
                    onChange={(e) => setPoll((p) => ({ ...p, question: e.target.value }))}
                    placeholder="Poll question"
                    maxLength={500}
                    style={{
                      width: '100%',
                      background: 'var(--surface-raised)',
                      border: '0.5px solid var(--border-default)',
                      borderRadius: 'var(--r-sm)',
                      padding: '9px 12px',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {poll.options.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={opt}
                        onChange={(e) => setPollOption(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        style={{
                          flex: 1,
                          background: 'var(--surface-raised)',
                          border: '0.5px solid var(--border-default)',
                          borderRadius: 'var(--r-sm)',
                          padding: '8px 12px',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                      {poll.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removePollOption(idx)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {poll.options.length < 10 && (
                    <button
                      type="button"
                      onClick={addPollOption}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--uc-indigo-xl)', fontSize: 13, textAlign: 'left', padding: 0 }}
                    >
                      + Add option
                    </button>
                  )}
                  <input
                    type="datetime-local"
                    value={poll.expiresAt}
                    onChange={(e) => setPoll((p) => ({ ...p, expiresAt: e.target.value }))}
                    style={{
                      background: 'var(--surface-raised)',
                      border: '0.5px solid var(--border-default)',
                      borderRadius: 'var(--r-sm)',
                      padding: '8px 12px',
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: '0.5px solid var(--border-default)',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Mode buttons */}
              <div style={{ display: 'flex', gap: 4 }}>
                {!isEdit && (
                  <>
                    <ModeBtn
                      icon={<Image size={15} strokeWidth={1.5} />}
                      label="Photo"
                      active={mode === 'photo'}
                      disabled={files.length >= 4}
                      onClick={() => {
                        setMode(mode === 'photo' ? 'text' : 'photo')
                        if (mode !== 'photo') fileInputRef.current?.click()
                      }}
                    />
                    <ModeBtn
                      icon={<BarChart2 size={15} strokeWidth={1.5} />}
                      label="Poll"
                      active={mode === 'poll'}
                      disabled={files.length > 0}
                      onClick={() => setMode(mode === 'poll' ? 'text' : 'poll')}
                    />
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <GhostBtn onClick={handleClose} disabled={isPending}>Cancel</GhostBtn>
                <PrimaryBtn onClick={handleSubmit} disabled={!canSubmit}>
                  {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Post'}
                </PrimaryBtn>
              </div>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </>
      )}
    </>
  )
}

function ModeBtn({
  icon, label, active, disabled, onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        background: active ? 'var(--uc-indigo-bg)' : 'transparent',
        border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
        borderRadius: 'var(--r-pill)',
        color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 150ms',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx pnpm --filter web typecheck 2>&1 | tail -20
```
Expected: exits 0. Fix any type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/feed/components/CreatePost.tsx
git commit -m "feat(web): rewrite CreatePost as modal composer with photo, poll, and type toggle"
```

---

## Task 11: Create CommentDrawer

**Files:**
- Create: `apps/web/src/features/feed/components/CommentDrawer.tsx`

- [ ] **Step 1: Create `CommentDrawer.tsx`**

```typescript
import { useRef, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { X, ThumbsUp, CornerDownRight, Trash2 } from 'lucide-react'
import type { FeedPost, FeedComment } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { useComments } from '@/features/feed/hooks/useComments'
import { useCreateComment } from '@/features/feed/hooks/useCreateComment'
import { useDeleteComment } from '@/features/feed/hooks/useDeleteComment'
import { useUpsertCommentReaction } from '@/features/feed/hooks/useUpsertCommentReaction'

// ── CommentItem ───────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: FeedComment
  postId: string
  onReply: (parentId: string, authorName: string) => void
  depth?: number
}

function CommentItem({ comment, postId, onReply, depth = 0 }: CommentItemProps) {
  const user = useAuthStore((s) => s.user)
  const [localLike, setLocalLike] = useState(comment.ownReaction === 'like')
  const [localLikeCount, setLocalLikeCount] = useState(comment.reactionCounts.like)

  const reactionMutation = useUpsertCommentReaction(postId, comment.id)
  const deleteMutation = useDeleteComment(postId)

  const canDelete = user && (user.id === comment.authorId || user.role === 'admin')

  function handleLike() {
    const wasLiked = localLike
    setLocalLike(!wasLiked)
    setLocalLikeCount((c) => (wasLiked ? c - 1 : c + 1))
    reactionMutation.mutate(
      { wasLiked },
      { onError: () => { setLocalLike(wasLiked); setLocalLikeCount((c) => (wasLiked ? c + 1 : c - 1)) } },
    )
  }

  function handleDelete() {
    if (!window.confirm('Delete this comment?')) return
    deleteMutation.mutate(comment.id)
  }

  return (
    <div style={{ display: 'flex', gap: 10, paddingLeft: depth > 0 ? 36 : 0 }}>
      <Avatar
        initials={getInitials(comment.author.fullName)}
        color={avatarColor(comment.authorId)}
        size={32}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-md)',
            padding: '10px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {comment.author.fullName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true })}
            </span>
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  marginLeft: 'auto',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <Trash2 size={12} strokeWidth={1.5} />
              </button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {comment.content}
          </p>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, paddingLeft: 4 }}>
          <button
            type="button"
            onClick={handleLike}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: localLike ? 'var(--uc-indigo-xl)' : 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ThumbsUp size={12} strokeWidth={1.5} />
            {localLikeCount > 0 && localLikeCount}
          </button>
          {depth === 0 && (
            <button
              type="button"
              onClick={() => onReply(comment.id, comment.author.fullName)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <CornerDownRight size={12} strokeWidth={1.5} />
              Reply
            </button>
          )}
        </div>

        {/* Replies */}
        {comment.replies.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} postId={postId} onReply={onReply} depth={1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CommentDrawer ─────────────────────────────────────────────────────────────

interface Props {
  post: FeedPost
  onClose: () => void
}

export function CommentDrawer({ post, onClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const [inputText, setInputText] = useState('')
  const [replyTo, setReplyTo] = useState<{ parentId: string; authorName: string } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useComments(post.id, true)
  const createComment = useCreateComment(post.id)

  const comments = data?.pages.flatMap((p) => p.items) ?? []

  function handleReply(parentId: string, authorName: string) {
    setReplyTo({ parentId, authorName })
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function clearReply() {
    setReplyTo(null)
  }

  function handleSubmit() {
    const content = inputText.trim()
    if (!content || createComment.isPending) return
    createComment.mutate(
      { content, parent_id: replyTo?.parentId ?? null },
      { onSuccess: () => { setInputText(''); setReplyTo(null) } },
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!user) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-bg)',
          zIndex: 200,
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100dvh',
          width: 'min(440px, 100vw)',
          background: 'var(--surface-card)',
          borderLeft: '0.5px solid var(--border-hover)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
            Comments
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              padding: 4,
              borderRadius: 'var(--r-sm)',
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Post snippet */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '0.5px solid var(--border-default)',
            background: 'var(--surface-raised)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Avatar
              initials={getInitials(post.author.fullName)}
              color={avatarColor(post.author.id)}
              size={28}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {post.author.fullName}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {post.content}
          </p>
        </div>

        {/* Comment list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isLoading && (
            <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</p>
          )}
          {!isLoading && comments.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No comments yet. Be the first to comment.
            </p>
          )}
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} postId={post.id} onReply={handleReply} />
          ))}
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{
                background: 'transparent',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-pill)',
                padding: '7px 16px',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text-secondary)',
                alignSelf: 'center',
              }}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>

        {/* Input area */}
        <div
          style={{
            borderTop: '0.5px solid var(--border-default)',
            padding: '12px 20px',
          }}
        >
          {replyTo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
                padding: '4px 10px',
                background: 'var(--uc-indigo-bg)',
                borderRadius: 'var(--r-sm)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--uc-indigo-xl)' }}>
                Replying to {replyTo.authorName}
              </span>
              <button
                type="button"
                onClick={clearReply}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--uc-indigo-xl)', fontSize: 14 }}
              >
                ×
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <Avatar
              initials={getInitials(user.profile.fullName ?? '')}
              color={avatarColor(user.id)}
              size={32}
            />
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment… (Enter to send, Shift+Enter for newline)"
              rows={1}
              style={{
                flex: 1,
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-hover)',
                borderRadius: 'var(--r-md)',
                padding: '9px 12px',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
                overflowY: 'hidden',
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputText.trim() || createComment.isPending}
              style={{
                background: 'var(--uc-indigo)',
                border: 'none',
                borderRadius: 'var(--r-pill)',
                padding: '9px 16px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                opacity: !inputText.trim() || createComment.isPending ? 0.4 : 1,
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx pnpm --filter web typecheck 2>&1 | tail -15
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/feed/components/CommentDrawer.tsx
git commit -m "feat(web): add CommentDrawer slide-over with threaded comments and reactions"
```

---

## Task 12: Update FeedPage

**Files:**
- Modify: `apps/web/src/pages/FeedPage.tsx`

- [ ] **Step 1: Overwrite `FeedPage.tsx`**

```typescript
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Rss } from 'lucide-react'
import type { FeedPost } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { CreatePost } from '@/features/feed/components/CreatePost'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { usePosts, type FeedFilter } from '@/features/feed/hooks/usePosts'
import { useFeedSocket } from '@/features/feed/hooks/useFeedSocket'
import { SkeletonPost } from '@/components/skeletons/SkeletonPost'
import { EmptyState } from '@/components/EmptyState'

const TABS: { label: string; value: FeedFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Posts', value: 'post' },
  { label: 'Announcements', value: 'announcement' },
  { label: 'Lost & Found', value: 'lost_found' },
]

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawFilter = searchParams.get('type') as FeedFilter | null
  const filter: FeedFilter =
    rawFilter !== null && TABS.some((t) => t.value === rawFilter) ? rawFilter : 'all'

  const universityId = useAuthStore((s) => s.user?.universityId)
  useFeedSocket(universityId)

  const [openPost, setOpenPost] = useState<FeedPost | null>(null)
  const [editPost, setEditPost] = useState<FeedPost | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePosts(filter)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const posts = data?.pages.flatMap((p) => p.items) ?? []
  const allCaughtUp = !isLoading && !hasNextPage && posts.length > 0

  function setFilter(value: FeedFilter) {
    setSearchParams(value === 'all' ? {} : { type: value }, { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Create / edit post */}
      {editPost ? (
        <CreatePost editPost={editPost} onClose={() => setEditPost(null)} />
      ) : (
        <CreatePost />
      )}

      {/* Filter tabs */}
      <nav
        role="tablist"
        aria-label="Feed filter"
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 8px',
          display: 'flex',
          gap: 2,
        }}
      >
        {TABS.map(({ label, value }) => {
          const active = filter === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(value)}
              style={{
                flex: 1,
                padding: '7px 0',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {label}
            </button>
          )
        })}
      </nav>

      {/* Loading skeletons */}
      {isLoading && <><SkeletonPost /><SkeletonPost /><SkeletonPost /></>}

      {/* Post list */}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onCommentClick={() => setOpenPost(post)}
          onEditPost={(p) => setEditPost(p)}
        />
      ))}

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <EmptyState
          icon={Rss}
          title="Nothing here yet"
          description="Be the first to post something, or try a different filter."
        />
      )}

      {/* Load-more skeletons */}
      {isFetchingNextPage && <><SkeletonPost /><SkeletonPost /></>}

      {/* Intersection sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* All caught up */}
      {allCaughtUp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            You're all caught up
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}

      {/* Comment drawer */}
      {openPost && (
        <CommentDrawer post={openPost} onClose={() => setOpenPost(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx pnpm --filter web typecheck 2>&1 | tail -15
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/FeedPage.tsx
git commit -m "feat(web): wire FeedPage with usePosts hook, CommentDrawer, and edit mode"
```

---

## Task 13: Update PostsPanel

**Files:**
- Modify: `apps/web/src/features/profile/components/PostsPanel.tsx`

- [ ] **Step 1: Replace inline fetch with `useProfilePosts`**

Replace the entire file:

```typescript
import { useNavigate } from 'react-router-dom'
import { FileText, AlertCircle } from 'lucide-react'
import type { FeedPost } from '@uniconnect/shared'
import { PostCard } from '@/features/feed/components/PostCard'
import { useProfilePosts } from '@/features/feed/hooks/useProfilePosts'
import { SkeletonPost } from '@/components/skeletons/SkeletonPost'
import { EmptyState } from '@/components/EmptyState'

interface Props {
  userId: string
  isOwnProfile: boolean
}

function noop() {}

export function PostsPanel({ userId, isOwnProfile }: Props) {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch, isRefetching } = useProfilePosts(userId)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonPost />
        <SkeletonPost />
      </div>
    )
  }

  if (isError) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '24px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <AlertCircle size={18} strokeWidth={1.5} color="var(--uc-red)" />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            Couldn't load posts
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Check your connection and try again.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: '0.5px solid var(--border-hover)',
            borderRadius: 'var(--r-pill)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: isRefetching ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {isRefetching ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    )
  }

  const posts = data?.items ?? []

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={isOwnProfile ? 'You haven't posted yet' : 'No posts yet'}
        description={
          isOwnProfile
            ? 'Share an update, ask a question, or post a poll. Your posts will appear here.'
            : 'When this person shares something, you'll see it here.'
        }
        action={isOwnProfile ? { label: 'Write a post', onClick: () => navigate('/feed') } : undefined}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onCommentClick={noop}
          onEditPost={noop}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx pnpm --filter web typecheck 2>&1 | tail -10
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/profile/components/PostsPanel.tsx
git commit -m "refactor(web): use useProfilePosts hook in PostsPanel"
```

---

## Task 14: Final verification

- [ ] **Step 1: Full typecheck across all workspaces**

```bash
npx pnpm typecheck 2>&1 | tail -30
```
Expected: exits 0, no errors.

- [ ] **Step 2: Lint**

```bash
npx pnpm lint 2>&1 | tail -30
```
Fix any lint errors before proceeding.

- [ ] **Step 3: Run all tests**

```bash
npx pnpm test 2>&1 | tail -30
```
Expected: all pass (API integration tests require `TEST_DATABASE_URL` to be set).

- [ ] **Step 4: Final commit (if any lint fixes were needed)**

```bash
git add -p
git commit -m "fix: address typecheck and lint issues in post feature"
```

---

## Self-review checklist

- [x] Spec section "comment delete" → Task 2 ✓
- [x] Spec section "comment reactions" → Task 2 ✓
- [x] Spec section "notification emissions" → Task 3 ✓
- [x] Spec section "fix reaction socket" → Task 3 ✓
- [x] Spec section "shared types" → Task 1 ✓
- [x] Spec section "usePosts / useProfilePosts / useComments" → Task 5 ✓
- [x] Spec section "useCreatePost / useUpdatePost / useDeletePost" → Task 6 ✓
- [x] Spec section "useUpsertReaction / useSavePost / useCreateComment / useDeleteComment / useUpsertCommentReaction" → Task 7 ✓
- [x] Spec section "useFeedSocket updates" → Task 8 ✓
- [x] Spec section "PostCard three-dot menu" → Task 9 ✓
- [x] Spec section "CreatePost composer" → Task 10 ✓
- [x] Spec section "CommentDrawer" → Task 11 ✓
- [x] Spec section "FeedPage wire-up" → Task 12 ✓
- [x] Spec section "PostsPanel refactor" → Task 13 ✓
- [x] react-markdown dependency → Task 4 ✓
- [x] Type names consistent: `FeedPost`, `FeedComment`, `FeedPoll`, `FeedFilter`, `CreatePostInput`, `UpdatePostInput` used consistently across tasks ✓
- [x] `POSTS_FEED_KEY` exported from `usePosts.ts` and imported in all mutation hooks ✓
- [x] `commentsQueryKey` exported from `useComments.ts` and imported in `useCreateComment`, `useDeleteComment`, `useUpsertCommentReaction` ✓
- [x] `PostCard` now requires `onCommentClick` and `onEditPost` — both wired in `FeedPage` (Task 12) and `PostsPanel` (Task 13, uses `noop`) ✓
