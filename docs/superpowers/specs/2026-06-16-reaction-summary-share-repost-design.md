# Reaction Summary Bar, All-Reactions Dialog, Share-to-Profile & Author Controls Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Facebook-style reaction/comment/share count summary bar above the action row, a tabbed all-reactions dialog with user list, a share-to-profile (repost) feature, and per-post author controls for hiding counts and disabling comments/shares.

**Architecture:** Shares are stored as regular `posts` rows with an `original_post_id` FK pointing to the root original post — this reuses all existing feed infrastructure (pagination, ranking, reactions). The count summary bar and reactions dialog are frontend-only except for a new `GET /posts/:id/reactions` endpoint. Author controls are three boolean columns on `posts` enforced at the service layer.

**Tech Stack:** Knex migrations, Express service layer, TanStack Query, React portals, Framer Motion, Twemoji SVGs (existing `TwemojiIcon`).

---

## Section 1: Count Summary Bar

A thin row rendered **between the post body and the Like/Comment/Share action buttons**, only when at least one of reaction total, comment count, or share count is non-zero.

### Layout

```
[👍❤️😂  933]                    [45 comments · 12 shares]
─────────────────────────────────────────────────────────
[👍 Like]   [💬 Comment]   [↗ Share]               [🔖 Save]
```

- **Left cluster** (reaction summary): Top-3 Twemoji icons stacked with slight negative margin, then the total reaction count as a number. The entire cluster is a `<button>` — clicking opens the all-reactions dialog.
- **Right cluster** (counts): `N comments · N shares` as plain styled text. Clicking the comments text opens the comment drawer. Share count is display-only.
- When `hide_reaction_counts = true` on the post (set by author): the reaction cluster is hidden entirely; comment and share counts still show.
- The row has `border-bottom: 0.5px solid var(--border-default)` and `padding-bottom: 8px` separating it from the action row.

### Data sources

All data already exists on `FeedPost` except `shareCount` (new field, added via migration). No new fetch needed for the summary bar itself.

### New `FeedPost` fields

```ts
// packages/shared/src/types/feed.ts — additions
shareCount: number
originalPost: FeedPost | null        // non-null when this post is a share/repost
reactionCountsHidden: boolean        // true when author set hide_reaction_counts
commentsDisabled: boolean
sharesDisabled: boolean
```

---

## Section 2: All-Reactions Dialog

### UI

A modal portal (renders into `document.body`, same pattern as `ShareMenu`) opened by clicking the reaction count cluster.

- **Header tabs:** "All" tab first (default active), then one tab per reaction type with at least one count — each tab shows `<TwemojiIcon> N`. Active tab has a `2px solid var(--uc-indigo)` bottom border underline, no filled background.
- **Body:** Scrollable list. Each row:
  - 36px circular avatar (`<Avatar>`)
  - Full name (`font-size: 14, font-weight: 500`)
  - **"Connect"** button on the right — shown only when the viewing user is not yet connected to this person and it's not themselves. Uses the existing `useConnectionAction` hook.
- **Close button** (×) top-right corner.
- Infinite scroll via cursor pagination — loads 20 per page, fetches next page when user scrolls near the bottom using `IntersectionObserver`.
- Tab switching triggers a new fetch with the selected reaction type filter.

### New backend endpoint

```
GET /posts/:postId/reactions?type=all&cursor=<createdAt>&limit=20
```

- `type` — optional, one of `like | love | care | haha | wow | sad | angry`. Omit for "All".
- Returns:
  ```json
  {
    "data": {
      "items": [
        { "userId": "...", "fullName": "...", "avatarUrl": "...", "reactionType": "like" }
      ],
      "nextCursor": "2026-06-15T10:00:00Z"
    }
  }
  ```
- Auth: `requireAuth`. Multi-tenancy: filtered by `university_id` from `req.university.id`.
- SQL: join `reactions` → `users` → `profiles`, cursor on `reactions.created_at`, ordered `DESC`.

### New frontend files

- `apps/web/src/features/feed/hooks/usePostReactions.ts` — `usePostReactions(postId, type)` TanStack Query infinite query.
- `apps/web/src/features/feed/components/ReactionsDialog.tsx` — the modal component.

---

## Section 3: Share to Profile (Repost)

### Database migration (`083_add_post_shares.ts`)

```sql
ALTER TABLE posts
  ADD COLUMN original_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  ADD COLUMN share_count      INT NOT NULL DEFAULT 0,
  ADD COLUMN hide_reaction_counts BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN comments_disabled    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN shares_disabled      BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_posts_original_post_id ON posts(original_post_id) WHERE original_post_id IS NOT NULL;
```

### Backend — new endpoints

#### `POST /posts/:id/share`

Request body: `{ caption?: string }` (validated via Zod, `caption` max 500 chars).

Service logic:
1. Load target post (must belong to same `university_id`).
2. Determine root: if target has `original_post_id`, use that; otherwise use target's `id`.
3. Check root post's `shares_disabled` — if true, throw `forbidden()`.
4. Check if calling user already has a share of this root — if so, throw `conflict('Already shared')`.
5. In a transaction: insert new `posts` row with `content = caption ?? ''`, `original_post_id = rootId`, `university_id`, `user_id = context.userId`, `is_published = true`; increment `share_count` on root post.
6. Emit `post:shared` to `uni:{universityId}` room via `getIo()`.
7. Return the new share post object.

#### `DELETE /posts/:id/share`

- Verifies the post is owned by the calling user and has `original_post_id` set.
- In a transaction: delete the share post, decrement `share_count` (floor 0) on the original.
- Emits `post:unshared` to `uni:{universityId}`.

### Feed query changes

The existing feed query already returns all posts. Add to the select:
- `posts.original_post_id`
- `posts.share_count`
- `posts.hide_reaction_counts`
- `posts.comments_disabled`
- `posts.shares_disabled`

For posts where `original_post_id IS NOT NULL`, embed the original post object (a lightweight join: author, content, mediaUrls, createdAt — no nested share, no reaction counts on the embed). This avoids a second network request.

### Frontend — SharePostModal

New file: `apps/web/src/features/feed/components/SharePostModal.tsx`

- Small dialog (400px wide) with:
  - User's own avatar + name at the top
  - Optional caption `<textarea>` (placeholder: "Say something about this…")
  - Preview of the post being shared (same as `OriginalPostEmbed`, read-only)
  - "Share now" button — calls `POST /posts/:id/share`, invalidates feed query on success, shows toast "Shared to your profile"
- Opened from `ShareMenu`'s new "Share to profile" row (shown only when `!post.sharesDisabled`).

### Frontend — OriginalPostEmbed

New file: `apps/web/src/features/feed/components/OriginalPostEmbed.tsx`

Renders inside a `PostCard` when `post.originalPost !== null`. A read-only nested card:
- `border: 0.5px solid var(--border-default)`, `border-radius: var(--r-md)`, `padding: 12px`
- Author avatar (28px) + name + timestamp
- Post content (truncated to 3 lines, "See more" expands inline)
- First media image thumbnail if present (max height 200px)
- No action buttons, no reaction bar
- If `originalPost` is null (original deleted): show "Original post is no longer available" placeholder text

### Frontend — PostCard share header

When `post.originalPost !== null`, render a small line above the embedded card:

```
[Avatar 24px]  User shared [Author]'s post · 2h ago
```

Font-size 12, color `var(--text-secondary)`.

### My share state

`PostCard` tracks `myShare: boolean` (from new `useMyShare(postId)` hook or derived from feed). The Share button in the action row turns indigo when `myShare = true`. Clicking it when already shared opens a "Remove share?" confirmation.

---

## Section 4: Author Controls Per Post

### Backend enforcement

- `hide_reaction_counts = true` → feed service returns `reactionCounts` as all zeros and `reactionCountsHidden: true` **for all users except the post author**. The author still sees real counts.
- `comments_disabled = true` → `createComment` service throws `forbidden('Comments are turned off')`.
- `shares_disabled = true` → `sharePost` service throws `forbidden('Sharing is turned off')`.

### Frontend — CreatePost / EditPost toggles

At the bottom of the post composer modal, a collapsible **"Post settings"** section (collapsed by default, toggled by a chevron). Contains three `<Toggle>` components (reuse existing `Toggle` from `features/settings`):

| Toggle label | Field |
|---|---|
| Hide reaction counts | `hideReactionCounts` |
| Turn off commenting | `commentsDisabled` |
| Turn off sharing | `sharesDisabled` |

The `CreatePostSchema` / `UpdatePostSchema` Zod schemas gain three optional boolean fields. The API already passes through extra fields on `PATCH /posts/:id` — no router change needed, only service + schema.

### Frontend — PostCard rendering

| Setting | PostCard effect |
|---|---|
| `reactionCountsHidden` | Reaction cluster hidden in count summary bar; action row Like button still works |
| `commentsDisabled` | Comment button removed from action row; count summary bar hides comment count |
| `sharesDisabled` | "Share to profile" row hidden from ShareMenu; share count still shown in summary bar |

---

## Files Created / Modified

### Backend (`apps/api/`)

| File | Change |
|---|---|
| `database/migrations/083_add_post_shares.ts` | New migration |
| `modules/feed/schema.ts` | `sharePostSchema`, `updatePostSchema` additions |
| `modules/feed/service.ts` | `sharePost`, `unsharePost`, `getPostReactions`; feed query additions |
| `modules/feed/controller.ts` | `sharePost`, `unsharePost`, `getPostReactions` handlers |
| `modules/feed/router.ts` | `POST /:id/share`, `DELETE /:id/share`, `GET /:id/reactions` |

### Shared (`packages/shared/`)

| File | Change |
|---|---|
| `src/types/feed.ts` | `FeedPost` additions: `shareCount`, `originalPost`, `reactionCountsHidden`, `commentsDisabled`, `sharesDisabled` |
| `src/constants/socket.ts` | `FEED_EVENTS.POST_SHARED`, `FEED_EVENTS.POST_UNSHARED` |

### Frontend (`apps/web/`)

| File | Change |
|---|---|
| `features/feed/components/PostCard.tsx` | Count summary bar, `OriginalPostEmbed` rendering, share header, author controls rendering |
| `features/feed/components/PostCard.test.tsx` | Add new `FeedPost` fields to factory |
| `features/feed/components/ReactionsDialog.tsx` | **New** — all-reactions modal |
| `features/feed/components/OriginalPostEmbed.tsx` | **New** — nested original post card |
| `features/feed/components/SharePostModal.tsx` | **New** — share-to-profile dialog |
| `features/feed/hooks/usePostReactions.ts` | **New** — infinite query for reactions list |
| `features/feed/hooks/useSharePost.ts` | **New** — share/unshare mutations |
| `features/feed/components/CreatePost.tsx` | Post settings toggles |
| `components/ShareMenu.tsx` | "Share to profile" row |

---

## Constraints & Edge Cases

- **Deleted original:** When `original_post_id IS NOT NULL` but the join returns nothing (original deleted), `originalPost` is `null`. `OriginalPostEmbed` shows the deleted placeholder. Share count on the deleted post is irrelevant (post is gone).
- **Share of a share:** Always resolved to root at write time — `original_post_id` always points to a non-shared post.
- **Author sharing own post:** Not prevented at the backend but the "Share to profile" option is hidden in the UI when `post.author.id === user.id`.
- **Reaction counts in feed list vs post detail:** `reactionCountsHidden` is enforced in both the feed list query and the single-post query.
- **Migration number:** Next available is `083_` (previous collision at `072_` noted in CLAUDE.md; `082_` was last used for message stickers).
