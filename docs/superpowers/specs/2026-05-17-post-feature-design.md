# Post feature — design spec

**Date:** 2026-05-17  
**Branch:** `codex/codex`  
**Status:** Approved

---

## Overview

Build the post feature end-to-end with all dependencies. The backend feed module already has the core CRUD, reactions, threaded comments, polls, and save/unsave. This spec covers:

- Backend: comment delete, comment reactions, notification emissions, bug fix in `removeReaction`
- Frontend: shared types in `packages/shared`, data-fetching hooks, full CreatePost composer (text + photo + poll + type toggle), CommentDrawer slide-over, PostCard three-dot menu (edit/delete)

---

## Current state and known bugs

| Bug | Location | Fix |
|-----|----------|-----|
| `removeReaction` emits `reactionType: 'like'` hardcoded | `feed/service.ts:280` | Omit the `reactionType` field or derive it from `reactionCounts` diff |
| `CreatePost` inserts into `['posts', 'feed']` but `FeedPage` caches under `['posts', 'feed', { universityId, type }]` | `CreatePost.tsx:88` | Move mutation to `useCreatePost` hook with correct key prefix |
| `FeedPost.jobEmbed`, `eventEmbed`, `lostFoundEmbed` typed non-null in component but API never returns them | `PostCard.tsx:85-101` | Keep fields typed `| null`, API returns `null` |
| No comment delete endpoint | API | Add `DELETE /posts/:postId/comments/:commentId` |
| No comment reaction endpoints | API | Add `POST/DELETE /posts/:postId/comments/:commentId/reactions` |
| `feed:poll:updated` socket event emitted by API but not handled client-side | `useFeedSocket.ts` | Add handler to update poll vote counts in cache |

---

## Backend changes

### 1. Comment delete

**Route:** `DELETE /posts/:postId/comments/:commentId`  
**Auth:** `requireAuth` + `resolveUniversity`  
**Authorization:** `comment.author_id === userId || role === 'admin'`  
**Action:** Hard delete of comment and all its child reactions. Cascade on `parent_id` handles child comments (FK `ON DELETE CASCADE` already set in migration 009).  
**Socket:** Emit `feed:comment:deleted { postId, commentId }` to `uni:{universityId}`.

```typescript
// In FeedService
async deleteComment(context: AuthContext, postId: string, commentId: string) {
  const comment = await db('comments').where({ id: commentId, post_id: postId }).first()
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
```

### 2. Comment reactions

**Routes:**  
- `POST /posts/:postId/comments/:commentId/reactions` — body: `{ reaction_type }`  
- `DELETE /posts/:postId/comments/:commentId/reactions`

Both follow the identical pattern as post reactions (`upsertReaction` / `removeReaction`) with `target_type: 'comment'`. No socket event needed initially — the comment drawer refetches on open.

### 3. Notification emissions

Add a `createNotification` method to `NotificationsService`:

```typescript
async createNotification(input: CreateNotificationInput) {
  const [row] = await db('notifications')
    .insert({ ...input })
    .returning('id')
  const io = getIo()
  io.to(`user:${input.userId}`).emit('notification:new', { id: row.id, ...input })
}
```

Call from `FeedService`:

- **`upsertReaction`**: after DB write, fetch `post.author_id`, skip if `context.userId === post.author_id`, then `notificationsService.createNotification({ userId: post.author_id, type: 'post_reaction', actorId: context.userId, referenceId: postId, referenceType: 'post', content: '...' })`. Fire-and-forget (`.catch(logger.warn)`).

- **`createComment`**: same pattern, `type: 'post_comment'`, skip self-notification.

### 4. Fix reaction socket events — standardize to `feed:reaction:updated`

Both `upsertReaction` and `removeReaction` should emit the same event with the full updated counts. Replace the two separate `feed:reaction:new` / hardcoded-type emissions with a single consistent event:

```typescript
io.to(`uni:${context.universityId}`).emit('feed:reaction:updated', { postId, reactionCounts })
```

`useFeedSocket` handles `feed:reaction:updated` by replacing the full `reactionCounts` on the cached post (instead of updating a single reaction type). Remove the existing `feed:reaction:new` handler entirely.

---

## packages/shared — new types

**File:** `packages/shared/src/types/feed.ts`

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
  jobEmbed: null   // reserved, API returns null until jobs module is extended
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

Export via `packages/shared/src/types/index.ts`. Remove local duplicate interfaces from `PostCard.tsx` and `CreatePost.tsx`.

---

## Frontend — data-fetching hooks

All hooks live in `apps/web/src/features/feed/hooks/`. Components receive data and callbacks as props; none call `api` directly.

### `usePosts(filter: FeedFilter)`

```typescript
useInfiniteQuery<FeedPage>({
  queryKey: ['posts', 'feed', { universityId, type: filter }],
  queryFn: ({ pageParam }) => api.get('/posts', { params: { page: pageParam, type: filter !== 'all' ? filter : undefined } }).then(r => r.data.data),
  initialPageParam: 1,
  getNextPageParam: (last) => last.hasMore ? last.page + 1 : undefined,
  enabled: !!universityId,
})
```

### `useProfilePosts(userId: string)`

`useQuery` with key `['posts', 'profile', { userId }]`, fetches `/posts?authorId={userId}&limit=20`.

### `useComments(postId: string, enabled: boolean)`

`useInfiniteQuery` with key `['posts', 'comments', { postId }]`, fetches `GET /posts/:postId/comments`. `enabled` is `true` only when the drawer is open.

### `useCreatePost()`

`useMutation` → `POST /posts`. On success, uses `queryClient.setQueriesData({ queryKey: ['posts', 'feed'] }, ...)` to prepend the new post to all feed cache entries (fuzzy prefix match).

### `useUpdatePost()`

`useMutation` → `PATCH /posts/:postId`. On success, updates the post in all feed cache entries.

### `useDeletePost()`

`useMutation` → `DELETE /posts/:postId`. On success, removes the post from all `['posts', 'feed', *]` and `['posts', 'profile', *]` cache entries.

### `useUpsertReaction(postId: string)`

`useMutation` with optimistic update. Toggles like on the cached post.

### `useSavePost(postId: string)`

`useMutation` with optimistic update. Toggles `isSaved` on the cached post.

### `useCreateComment(postId: string)`

`useMutation` → `POST /posts/:postId/comments`. On success, appends to the open comments cache.

### `useDeleteComment(postId: string)`

`useMutation` → `DELETE /posts/:postId/comments/:commentId`. On success, removes from comments cache and updates `commentCount` in feed cache.

### `useUpsertCommentReaction(postId: string, commentId: string)`

`useMutation` → `POST /posts/:postId/comments/:commentId/reactions`. Updates `reactionCounts` in comments cache optimistically.

---

## Frontend — CreatePost composer

**File:** `apps/web/src/features/feed/components/CreatePost.tsx`

The collapsed trigger row (avatar + placeholder button) remains. Clicking opens a **modal overlay** (not inline expansion) centered on desktop, full-screen on mobile. The modal has:

**Header:** Author avatar + name, announcement toggle (`Post | Announcement`) — visible only to `faculty` and `admin` roles.

**Toolbar tabs:** Three icon buttons at the top-right: `Text` (always active), `Photo`, `Poll`. Photo and Poll are mutually exclusive; selecting one deactivates the other.

**Text mode (default):**  
- Auto-growing `<textarea>` (min 120px, max 400px)  
- Markdown toolbar: Bold (`**`), Italic (`_`), Link — inserts syntax around current selection  
- Content stored as a plain markdown string; `PostCard` renders with `react-markdown` (already available or add as a dependency)

**Photo mode:**  
- `<input type="file" multiple accept="image/*" max 4 files>`  
- For each selected file: call `POST /api/upload/presign` → upload to S3 PUT URL → store returned S3 URL  
- Show thumbnail grid (max 4, with remove ×)  
- `media_urls` field populated with collected URLs  
- Photo and text compose together (text is still editable in photo mode)

**Poll mode:**  
- Question field (required, max 500 chars)  
- Minimum 2 option inputs, "Add option" link up to 10  
- Optional "Closes at" `<input type="datetime-local">`  
- Poll + text compose together; switching to Photo mode hides the Poll panel (photo wins)

**Footer:** Cancel button + Post button. Post is disabled while any upload is in progress or text is empty.

**Submission:** Calls `useCreatePost()` with `{ type, content, media_urls, poll? }`.

**Edit mode:** When triggered from the three-dot menu, the modal pre-fills `content`, `type`, and `media_urls`. Poll tab is disabled (polls are immutable once created). On submit calls `useUpdatePost()`.

---

## Frontend — CommentDrawer

**File:** `apps/web/src/features/feed/components/CommentDrawer.tsx`

A `position: fixed` right-side panel. On desktop: width 420px, full viewport height, slides in from the right (`transform: translateX(100%)` → `translateX(0)` with 250ms ease). On mobile: full screen. Backdrop overlay closes the drawer on click.

**Structure:**

```
CommentDrawer
├── Header (post author, content, reaction bar) — read-only
├── CommentList
│   ├── CommentItem (root)
│   │   ├── Author, content, timestamp, reaction row, three-dot (own/admin)
│   │   └── ReplyList
│   │       └── CommentItem (reply, no further nesting)
│   └── Load more button (when hasMore)
└── CommentInput (fixed at drawer bottom)
    ├── Auto-growing textarea
    ├── Reply-to indicator (dismissible)
    └── Send button
```

**Data flow:**
- `useComments(postId, isOpen)` — fetches when `isOpen = true`
- Socket: inside `useComments`, subscribe to `feed:comment:new` and `feed:comment:deleted` events to update the comments cache in real-time while the drawer is open
- `useCreateComment` appends optimistically; on error, rolls back
- `useDeleteComment` removes optimistically with a confirmation dialog
- `useUpsertCommentReaction` updates the reaction row on individual comments

**Trigger:** `PostCard` receives an `onCommentClick` prop. `FeedPage` manages `openPostId: string | null` state; when set, `CommentDrawer` renders with that postId.

---

## Frontend — PostCard three-dot menu

**File:** `apps/web/src/features/feed/components/PostCard.tsx`

A `⋮` (`MoreVertical` from lucide) icon button in the top-right of the author row. Visible only when `user.id === post.author.id || user.role === 'admin'`.

Clicking opens a small dropdown positioned below the button:

```
┌────────────┐
│ Edit post  │
│ Delete     │
└────────────┘
```

- **Edit post**: calls `onEditPost(post)` prop (passed from `FeedPage`) — opens `CreatePost` in edit mode
- **Delete**: opens a `ConfirmDialog` ("Are you sure? This cannot be undone.") → on confirm, calls `useDeletePost`

`PostCard` receives `onCommentClick`, `onEditPost` as props. No direct data fetching inside `PostCard`.

---

## Frontend — useFeedSocket updates

Add handlers for the two new/changed socket events:

```typescript
// feed:comment:deleted
socket.on('feed:comment:deleted', ({ postId, commentId }) => {
  // Decrement commentCount on the post in all feed caches
  // Update comments cache if the drawer for this post is open
})

// feed:reaction:updated (replaces feed:reaction:new for removeReaction)
socket.on('feed:reaction:updated', ({ postId, reactionCounts }) => {
  // Replace full reactionCounts on the post in all feed caches
})

// feed:poll:updated (already emitted by API, now handled)
socket.on('feed:poll:updated', ({ pollId, options }) => {
  // Update the poll options + totalVotes in all feed caches where poll.id === pollId
})
```

---

## File changelist

### Backend (`apps/api`)

| File | Change |
|------|--------|
| `modules/feed/service.ts` | Add `deleteComment`, `upsertCommentReaction`, `removeCommentReaction`; add notification calls in `createComment` and `upsertReaction`; fix `removeReaction` socket emission |
| `modules/feed/controller.ts` | Add `deleteComment`, `addCommentReaction`, `removeCommentReaction` handlers |
| `modules/feed/router.ts` | Add routes for the above |
| `modules/feed/schema.ts` | No changes needed |
| `modules/notifications/service.ts` | Add public `createNotification` method |

### Shared (`packages/shared`)

| File | Change |
|------|--------|
| `src/types/feed.ts` | New file with `FeedPost`, `FeedPoll`, `FeedComment`, etc. |
| `src/types/index.ts` | Export from `feed.ts` |

### Frontend (`apps/web`)

| File | Change |
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
| `features/feed/hooks/useFeedSocket.ts` | Add 3 new socket event handlers |
| `features/feed/components/CreatePost.tsx` | Full rewrite — modal composer |
| `features/feed/components/PostCard.tsx` | Add three-dot menu, `onCommentClick`/`onEditPost` props, react-markdown rendering |
| `features/feed/components/CommentDrawer.tsx` | New |
| `pages/FeedPage.tsx` | Wire `openPostId` state, pass props to `PostCard`, render `CommentDrawer` |
| `features/profile/components/PostsPanel.tsx` | Replace inline fetch with `useProfilePosts` |

### Dependencies to add

| Package | Where | Reason |
|---------|-------|--------|
| `react-markdown` | `apps/web` | Render post content markdown |

---

## Out of scope

- `jobEmbed`, `eventEmbed`, `lostFoundEmbed` API population (separate module specs)
- Post tags (migration 013 exists; tag creation/filtering is a future spec)
- Poll editing (intentionally immutable once published)
- Pagination for replies (API fetches all replies for root comments in a single pass; acceptable for typical thread depth)
- Full-text search within a post's comments
