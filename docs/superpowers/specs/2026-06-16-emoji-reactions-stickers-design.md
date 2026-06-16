# Emoji Picker, Reaction Bar & Sticker Drawer

**Date:** 2026-06-16
**Status:** Approved
**Scope:** `apps/web`, `apps/api`, `packages/shared`

---

## Overview

Add Facebook/Messenger-style emoji and reaction features across the UniConnecT app:

1. **Emoji Picker** — emoji-mart v5, dark/light aware, cursor-insert in post composer, chat input, and comment input
2. **Reaction Bar** — 7 Facebook reactions (like, love, care, haha, wow, sad, angry) with Twemoji SVGs and CSS pop animation; hover popover on posts/comments; floating mini-bar on chat messages
3. **Sticker Drawer** — LottieFiles API, dynamic pack fetching, available in chat and comments only
4. **Comment Attachments** — wire existing backend attachment support into CommentDrawer UI
5. **Cross-device consistency** — Noto Color Emoji CSS fallback in tokens.css

---

## Architecture

### New shared components

```
src/components/emoji/
  EmojiPicker.tsx          # emoji-mart wrapper, lazy-loaded
  StickerDrawer.tsx        # Lottie sticker tray, lazy-loaded, fetches LottieFiles API
  ReactionBar.tsx          # hover popover (posts/comments) + mini floating bar (messages)
  ReactionChip.tsx         # reaction count badge, e.g. ❤️ 3
  TwemojiIcon.tsx          # renders one Twemoji SVG by reaction key + size prop
  reactionConfig.ts        # maps each reaction key → Twemoji codepoint, label, pop color
```

### Modified feature files

```
src/features/feed/
  hooks/useUpsertReaction.ts         # extend: accepts full ReactionType, not just 'like'
  hooks/useUpsertCommentReaction.ts  # same extension
  components/PostCard.tsx            # swap Like button → ReactionBar hover popover
  components/CommentDrawer.tsx       # add emoji button, sticker button, AttachmentPicker,
                                     # wire attachments into mutate call

src/features/messages/
  hooks/useMessageReactions.ts       # new: POST/DELETE /messages/:id/reactions
  hooks/useStickers.ts               # new: TanStack Query wrapper for LottieFiles API
  components/MessageInput.tsx        # add emoji picker button + sticker drawer button
  components/ChatMessage.tsx         # add hover reaction mini-bar + reaction chips below bubble

packages/shared/src/types/
  reactions.ts                       # ReactionType = 'like'|'love'|'care'|'haha'|'wow'|'sad'|'angry'
```

### New backend migrations

| # | File | Change |
|---|------|--------|
| 077 | `077_update_reaction_types.ts` | Drop old check constraint (`like\|love\|insightful\|celebrate`), add new one with 7 types |
| 078 | `078_add_message_reactions.ts` | New `message_reactions` table |
| 079 | `079_add_message_stickers.ts` | Add `content_type`, `sticker_url` columns to `messages` |

### New API endpoints

```
POST   /messages/:messageId/reactions    body: { reaction_type }
DELETE /messages/:messageId/reactions
```

Both require `requireAuth`. Service emits `message:reaction` to `conv:{conversationId}` room after DB write.

---

## Reaction System

### The 7 reactions

| Key | Label | Twemoji codepoint | Pop color |
|-----|-------|-------------------|-----------|
| `like` | Like | `1f44d` | `var(--uc-indigo)` |
| `love` | Love | `2764` | `#e0245e` |
| `care` | Care | `1f917` | `#f4900c` |
| `haha` | Haha | `1f602` | `#f4900c` |
| `wow` | Wow | `1f62e` | `#f4900c` |
| `sad` | Sad | `1f622` | `#5c8dcf` |
| `angry` | Angry | `1f621` | `#e9710f` |

Defined in `reactionConfig.ts` — single source of truth for both frontend rendering and Zod schema in `packages/shared`.

### Post / comment reaction bar (hover popover)

- Like button shows current reaction SVG (or outline thumbs-up if none)
- Hover with 200 ms delay → `ReactionBar` popover appears above, all 7 icons at 28 px
- Each icon: `transform: scale(1.3)` on hover + tooltip label, 150 ms ease
- Click a reaction → calls `useUpsertReaction` / `useUpsertCommentReaction` with the chosen type
- Click same reaction again → removes it (toggle off, DELETE endpoint)
- `@keyframes pop` fires on `ReactionChip` when count changes: `scale(1) → scale(1.25) → scale(1)` over 300 ms

```css
@keyframes uc-reaction-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.25); }
  100% { transform: scale(1); }
}
```

### Chat message reaction mini-bar (Messenger-style)

- Hover over a message bubble → mini reaction bar appears floating above (6 reactions: like, love, care, haha, wow, angry — no sad, keeping DMs positive)
- Icon size: 24 px
- Click → `useMessageReactions` mutate; reaction chip appears below bubble
- Multiple users → chips grouped by type with count badge
- Optimistic update in `useMessageReactions.onMutate`, rolled back on error

### DB — `message_reactions` table (migration 078)

```
id            UUID PK default uuid_generate_v4()
message_id    UUID FK → messages.id ON DELETE CASCADE
user_id       UUID FK → users.id ON DELETE CASCADE
university_id UUID FK → universities.id
reaction_type VARCHAR(10) CHECK IN ('like','love','care','haha','wow','angry')
created_at    TIMESTAMPTZ default now()
UNIQUE (message_id, user_id)
INDEX (message_id)
INDEX (user_id)
```

---

## Emoji Picker

**Library:** `@emoji-mart/react` + `@emoji-mart/data` v5

**Theme:** reads `document.documentElement.dataset.theme` (`'dark'` / `'light'`) — already set by `themeStore`. No extra wiring.

**Cursor insertion:** shared `useEmojiInsert(ref, value, onChange)` hook:
1. Read `ref.current.selectionStart`
2. Splice emoji into value string at that offset
3. Restore cursor with `setSelectionRange` inside `useLayoutEffect`

**Placement:**
- Desktop: `position: absolute`, anchored above the toolbar button, closes on outside click via `useClickOutside`
- Mobile (`useIsMobile` breakpoint ≤ 640 px): bottom-sheet, full width, pinned to bottom of viewport

**Used in:** `CreatePost` (toolbar bottom-left), `MessageInput` (left of textarea), `CommentDrawer` (comment input toolbar)

**Noto emoji fallback** — added once to `tokens.css`:
```css
:root {
  --font-emoji: 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
}
```
All textareas append `var(--font-emoji)` as last entry in `font-family`.

---

## Sticker Drawer

**API:** LottieFiles Public API
- Pack listing: `GET https://lottiefiles.com/api/v1/sticker-packs` (header: `Authorization: Bearer $VITE_LOTTIEFILES_API_KEY`)
- Pack detail: `GET https://lottiefiles.com/api/v1/sticker-packs/:packId`

**`useStickers` hook:**
- `useQuery(['stickers', 'packs'])` — stale time 1 hour, fetches pack listing once per session
- `useQuery(['stickers', 'pack', packId])` — lazy, fetches only when user opens that pack tab
- Individual Lottie JSON fetched and cached in-memory by `lottie-react` player on first render

**`StickerDrawer` UI:**
- Lazy-loaded (`React.lazy`) — Lottie player (~40 kB) only loads when first opened
- Triggered by a dedicated sticker icon button in the toolbar (separate from emoji button)
- Pack strip across top (thumbnail icons), sticker grid (3 columns) below — matches Messenger layout
- Each sticker: `<Lottie>` at 80×80 px, plays on hover, pauses idle
- On select: sends message with `content_type: 'sticker'`, `sticker_url` = Lottie JSON URL

**Sticker message rendering in `ChatMessage`:**
- `content_type === 'sticker'` → render `<Lottie>` at 160×160 px, autoplay loop, no bubble background
- `content_type === 'text'` → existing bubble rendering (unchanged)

**Available in:** `MessageInput`, `CommentDrawer` only — not `CreatePost`

**New env var:**
```
# apps/web/.env
VITE_LOTTIEFILES_API_KEY=<public key>
```

### DB — `messages` table additions (migration 079)

```sql
ALTER TABLE messages
  ADD COLUMN content_type VARCHAR(10) NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text', 'sticker')),
  ADD COLUMN sticker_url  TEXT;
```

When `content_type = 'sticker'`, `content` is optional (empty string). Validation enforced in Zod schema.

---

## Comment Attachments

Backend already supports `attachments` and `media_urls` on comments — no API changes needed.

**Frontend additions to `CommentDrawer`:**
- Add `AttachmentPicker` component (already used in `CreatePost`) to the comment input toolbar
- State: `attachments: AttachmentInput[]`, `attachmentsUploading: boolean` — same pattern as `CreatePost`
- Extend `createComment.mutate(...)` to include `{ content, parent_id, attachments }`
- Display: `MediaGrid` for images, download chips for files — both already exist, wire into comment item rendering inside `CommentDrawer`

---

## New Dependencies

| Package | Used in | Why |
|---------|---------|-----|
| `@emoji-mart/react` | web | Emoji picker UI |
| `@emoji-mart/data` | web | Emoji dataset |
| `lottie-react` | web | Lottie animation player |
| `@twemoji/api` | web | Twemoji SVG URLs by codepoint (or inline SVGs — evaluate bundle size first) |

All added to `apps/web/package.json` only — no shared package changes.

---

## Testing

**Frontend:**
- `ReactionBar.test.tsx` — hover shows popover, click fires mutation with correct type, re-click removes reaction
- `EmojiPicker.test.tsx` — emoji insert at cursor, closes on outside click
- `StickerDrawer.test.tsx` — mock `useStickers`, renders pack strip, click sends sticker message
- `useMessageReactions.test.ts` — optimistic update + rollback on error

**Backend:**
- `messages.reactions.test.ts` — POST adds row, DELETE removes, 404 on unknown message, 409 on duplicate (upsert)
- Migration `077` smoke test: verify old reaction types (`insightful`, `celebrate`) are rejected after migration

---

## Rollout Notes

- Migration `077` changes the check constraint — any existing `insightful` / `celebrate` reactions must be migrated or deleted before deploying. Seed script and `db:reset` are unaffected (they rebuild from scratch). For production: run a one-time data migration to convert `insightful → like` and `celebrate → love` before applying `077`.
- `VITE_LOTTIEFILES_API_KEY` must be added to Vercel env vars before the sticker drawer goes live.
- Feature is additive — existing `like`-only reaction flow continues to work until the new UI is deployed.
