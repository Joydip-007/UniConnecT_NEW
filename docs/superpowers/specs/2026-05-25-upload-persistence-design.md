# Upload Persistence & Display — Design Spec

**Date:** 2026-05-25  
**Status:** Approved  
**Scope:** Frontend only — no backend changes required

---

## Problem

Two compounding bugs prevent uploaded photos from appearing consistently across the app:

1. **`Avatar` component is initials-only.** It has no `src` prop and cannot render an image. Five high-traffic surfaces (`TopNav`, `LeftSidebar`, `PostCard`, `ChatView`, `ConversationList`) therefore always show initials even when the user has uploaded a real avatar.

2. **Upload surfaces are inconsistent.** Eight components already work around the `Avatar` limitation with their own inline `avatarUrl ? <img> : <Avatar>` fallback blocks. Two forms (`CreateGroupModal`, `CreateNewsForm`) still use plain `<input type="url">` paste fields instead of the presigned S3 file-picker used everywhere else. The presign-upload logic itself is copy-pasted verbatim in three separate files.

---

## Approach

**Approach B — Upgrade `Avatar` + extract shared upload primitives + normalise callsites.**

Three deliverables, bounded entirely within `apps/web/src/`:

| Deliverable | Type | Path |
|---|---|---|
| `usePresignedUpload` | new hook | `hooks/usePresignedUpload.ts` |
| `Avatar` | upgraded component | `components/Avatar.tsx` |
| `ImageUploadField` | new component | `components/ImageUploadField.tsx` |

No changes to `apps/api/`, `packages/shared/`, migrations, or environment variables.

---

## Architecture

### `usePresignedUpload(folder: string)`

A single async function that encapsulates the full upload protocol:

1. `GET /upload/presign?filename=<name>&contentType=<mime>` → `{ uploadUrl, publicUrl }`
2. `PUT <uploadUrl>` with raw file bytes and `Content-Type` header
3. Returns `publicUrl` on success; throws on any non-2xx response

**Signature:**
```ts
export function usePresignedUpload(folder: string): {
  upload: (file: File) => Promise<string>   // resolves to publicUrl
  uploading: boolean
  error: string | null
  reset: () => void
}
```

Currently this logic is copy-pasted in `EditProfileModal`, `CreateEventForm`, and `PostItemModal`. After extraction those files call `usePresignedUpload` instead. Any future upload surface gets it for free.

---

### `Avatar` component — upgraded

Adds one optional prop; all existing callsites compile without modification.

**New prop:** `src?: string | null`

**Render logic:**
- `src` is truthy and `imgFailed` is false → render `<img src={src} style={{ objectFit: 'cover', borderRadius: '50%', width, height }} onError={() => setImgFailed(true)} />`
- Otherwise → render the existing initials circle

The `imgFailed` boolean is local `useState`, reset to `false` whenever `src` changes (via `useEffect`). This covers broken URLs, CORS errors in dev, and future URL changes cleanly.

**No changes** to `initials`, `color`, `size`, or `online` props.

---

### `ImageUploadField` component

A self-contained rectangular click-to-upload zone. Owns spinner, preview, and error state.

**Props:**
```ts
interface ImageUploadFieldProps {
  value: string | null          // current publicUrl (controlled)
  onChange: (url: string) => void
  folder: string                // passed through to usePresignedUpload
  label?: string                // e.g. "Cover image"
  aspectRatio?: string          // CSS value, default "16 / 5"
}
```

**States:**
- `idle` — dot-pattern placeholder with "Click to upload" hint, or existing `value` shown as preview
- `uploading` — spinner overlay, hidden file input disabled
- `error` — "Upload failed — tap to retry" hint; `value` is preserved so a prior successful upload is not lost
- `done` — uploaded image shown as preview; `onChange` fires with `publicUrl`

Clicking anywhere on the field triggers the hidden `<input type="file" accept="image/*">`.

---

## Callsite changes

### Avatar display fixes (5 files)

Each file adds `src={<avatarUrl expression>}` to its existing `<Avatar>` call:

| File | `src` expression |
|---|---|
| `components/TopNav.tsx` | `user?.profile.avatarUrl` |
| `components/LeftSidebar.tsx` | `user?.profile.avatarUrl` (avatar); also add cover image display to mini-card cover strip |
| `features/feed/components/PostCard.tsx` | `author.avatarUrl` |
| `features/messages/components/ChatView.tsx` | `message.sender.profile.avatarUrl` |
| `features/messages/components/ConversationList.tsx` | participant `avatarUrl` |

### Inline pattern normalisation (8 files)

These files currently do:
```tsx
{user.profile.avatarUrl
  ? <img src={user.profile.avatarUrl} alt="" style={{ width, height, objectFit: 'cover', borderRadius: '50%' }} />
  : <Avatar initials={…} color={…} size={…} />}
```

After the `Avatar` upgrade this collapses to:
```tsx
<Avatar src={user.profile.avatarUrl} initials={…} color={…} size={…} />
```

Files: `ProfileHeader`, `FollowModal`, `LostFoundCard`, `GroupCard`, `GroupHeader`, `MembersTab`, `JoinRequestsTab`, `InviteMemberModal`.

### Upload surface upgrades (2 files)

| File | Before | After |
|---|---|---|
| `features/groups/components/CreateGroupModal.tsx` | Two `<input type="url">` for avatar URL and cover URL | Two `<ImageUploadField folder="groups">` |
| `features/news/components/CreateNewsForm.tsx` | One `<input type="url">` for cover URL | One `<ImageUploadField folder="news">` |

### Upload logic extraction (3 files)

`EditProfileModal`, `CreateEventForm`, `PostItemModal` each contain an inline `uploadFile` function. That function is deleted and replaced with a call to `usePresignedUpload`. The UI (custom hover overlays, multi-image grid, etc.) is untouched.

> **Side-effect fix:** `PostItemModal` currently calls `api.post('/upload/presign', …)` but the route is `GET /presign?filename=&contentType=`. Extracting to `usePresignedUpload` (which uses GET with query params) silently corrects this latent bug.

### `LeftSidebar` cover strip

The static dot-pattern background in the profile mini-card cover area becomes:
```tsx
background: user?.profile.coverUrl
  ? `center / cover no-repeat url(${user.profile.coverUrl})`
  : [dot-pattern gradient]
```

---

## Data flow

```
User picks file
  → usePresignedUpload(folder).upload(file)
      → GET /upload/presign?filename=&contentType=   (existing endpoint)
      → PUT <uploadUrl> with raw bytes               (direct to S3/R2, never via API server)
      → returns publicUrl
  → caller stores publicUrl in form state
  → on form submit, publicUrl sent in body           (existing API fields: avatar_url, cover_url, etc.)
  → API writes to DB, returns updated entity
  → Zustand / TanStack Query updated (existing onSuccess handlers, unchanged)
```

**Zustand coherence for profile photos:**  
`EditProfileModal` already calls `updateProfile({ avatarUrl })` on `authStore` immediately after upload (before form submit). `TopNav` and `LeftSidebar` both read from `authStore`, so they reflect the new photo without a page reload or query invalidation.

**Group and news covers:**  
`CreateGroupModal`'s `onSuccess` already invalidates `['groups']`. `CreateNewsForm`'s `onSuccess` already invalidates the news query. No changes needed.

---

## Error handling

| Failure point | Behaviour |
|---|---|
| Presign request fails (network / 4xx) | `usePresignedUpload` sets `error`; `ImageUploadField` shows retry message; previous value preserved |
| S3 PUT returns non-2xx | Same as above |
| `<Avatar src>` image fails to load | `onError` sets `imgFailed = true`; component falls back to initials circle |
| `src` changes to a new URL | `imgFailed` resets to `false` via `useEffect` |
| `src` is `null` or `undefined` | Initials path taken directly; no `<img>` rendered, no error event |

---

## Testing

### `Avatar.test.tsx`
- Renders initials + background when `src` is null
- Renders `<img>` when `src` is a valid URL
- Falls back to initials when `<img>` fires `onError`
- Online dot appears when `online={true}` (regression guard)

### `usePresignedUpload.test.ts` (MSW)
- Happy path: GET presign → PUT S3 → returns publicUrl
- Presign GET fails → hook `error` is set, `uploading` is false
- S3 PUT returns 403 → hook `error` is set

### `ImageUploadField.test.tsx`
- Clicking the zone opens the hidden file input
- On file select: spinner shown, then preview image after successful upload
- On upload failure: error message shown; `value` prop unchanged

### `PostCard.test.tsx` (existing, extended)
- Add a second fixture with `avatarUrl: 'https://…'`; assert `<img>` is rendered
- Existing `avatarUrl: null` case continues to pass (regression)

### `ConversationList.test.tsx`, `ChatView.test.tsx`
- One case each: `avatarUrl` non-null → `<img>` present; null → `<img>` absent

---

## Files changed summary

| File | Action |
|---|---|
| `hooks/usePresignedUpload.ts` | **create** |
| `components/Avatar.tsx` | **modify** — add `src` prop + error fallback |
| `components/ImageUploadField.tsx` | **create** |
| `components/TopNav.tsx` | modify — pass `src` |
| `components/LeftSidebar.tsx` | modify — pass `src`; add cover display |
| `features/feed/components/PostCard.tsx` | modify — pass `src` |
| `features/messages/components/ChatView.tsx` | modify — pass `src` |
| `features/messages/components/ConversationList.tsx` | modify — pass `src` |
| `features/profile/components/ProfileHeader.tsx` | modify — collapse inline pattern |
| `features/profile/components/FollowModal.tsx` | modify — collapse inline pattern |
| `features/lost-found/components/LostFoundCard.tsx` | modify — collapse inline pattern |
| `features/groups/components/GroupCard.tsx` | modify — collapse inline pattern |
| `features/groups/components/GroupHeader.tsx` | modify — collapse inline pattern |
| `features/groups/components/MembersTab.tsx` | modify — collapse inline pattern |
| `features/groups/components/JoinRequestsTab.tsx` | modify — collapse inline pattern |
| `features/groups/components/InviteMemberModal.tsx` | modify — collapse inline pattern |
| `features/groups/components/CreateGroupModal.tsx` | modify — replace URL inputs with `ImageUploadField` |
| `features/news/components/CreateNewsForm.tsx` | modify — replace URL input with `ImageUploadField` |
| `features/profile/components/EditProfileModal.tsx` | modify — extract inline upload fn to hook |
| `features/events/components/CreateEventForm.tsx` | modify — extract inline upload fn to hook |
| `features/lost-found/components/PostItemModal.tsx` | modify — extract inline upload fn to hook |
| **Tests** | create/extend as listed above |

**Total: 3 new files, ~19 modified files, 0 backend changes.**
