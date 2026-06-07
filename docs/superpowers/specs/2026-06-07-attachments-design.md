# User-uploaded attachments for notices, events, jobs, posts

**Date:** 2026-06-07
**Status:** Approved design — ready for implementation plan

## Problem

1. **Feature:** Users have no way to attach files (documents/images) to notices (news),
   events, jobs, or feed posts. Only the content-sync importer can attach files to
   news/events, and only via automated capture.
2. **Production bug (related):** Notices that should carry attachments show none.
   Diagnosis: the production `content_attachments` table is **empty** — the content-sync
   parser never extracts attachment URLs from notice content, so nothing is ever
   enqueued/persisted. This is an upstream parsing gap (tracked separately). The feature
   below is the immediate remedy: admins can manually attach the file to a notice.

## Scope

- **In scope:** user-uploaded attachments (documents + images) on **news (notices),
  events, jobs, posts** via the existing presigned-upload flow.
- **Out of scope:** fixing the content-sync parser's attachment extraction (separate
  follow-up); changing the posts image gallery (`media_urls`) behaviour.

## Decisions (locked with user)

| Decision | Choice |
|---|---|
| File types | Documents + images |
| Upload mechanism | Reuse presign flow (client → R2 direct, bytes never hit API) |
| Entities | news, events, jobs, posts |
| Storage model | **A — generalize the existing `content_attachments` table** |
| Posts vs `media_urls` | Keep separate: `media_urls` stays the inline image gallery; attachments = file chips |

## Data model

Migration **`077_generalize_content_attachments`** (next free prefix after `076`):

- `source_url` → **nullable** (user uploads have no external source).
- Drop & re-add the `entity_type` CHECK to allow `('news','event','job','post')`.
- Add `uploaded_by uuid NULL` referencing `users(id)` `ON DELETE SET NULL`
  (NULL = content-sync import; non-NULL = user upload; used for audit + permission).
- Keep `download_status`; user uploads are inserted directly as `'done'`.
- Index `uploaded_by` is not needed (queries are by `(entity_type, entity_id)`, already indexed).

User-upload row shape: `file_url=<R2 url>`, `source_url=NULL`, `download_status='done'`,
`uploaded_by=<userId>`.

## Shared (`packages/shared`)

In `src/schemas/content-sync.ts` (beside `ContentAttachment`):

```ts
export const attachmentInputSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().max(255).optional(),
  sizeBytes: z.number().int().positive().optional(),
})
export type AttachmentInput = z.infer<typeof attachmentInputSchema>
```

Constants (new, e.g. `src/constants/attachments.ts`), reused client + server:

- `ALLOWED_ATTACHMENT_MIME_TYPES`: pdf, doc, docx, ppt, pptx, xls, xlsx, txt,
  png, jpeg, jpg, gif, webp.
- `MAX_ATTACHMENTS_PER_ENTITY = 10`
- `MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024` (25 MB)

Server validates `fileName` extension / `mimeType` against the allowlist and rejects
counts over the max; client mirrors this for UX.

## Backend

`apps/api/src/modules/content-sync/attachments.ts`:

- Generalize `getAttachmentsFor(entityType, entityId)` to accept all four entity types
  (type widened from `'news'|'event'` to include `'job'|'post'`).
- `addUserAttachments(trx, { universityId, entityType, entityId, uploadedBy, attachments })`
  — inserts rows (`download_status='done'`, `source_url=null`), enforcing the per-entity max
  against existing count.
- `removeAttachments(trx, { universityId, entityType, entityId, ids })` — deletes the
  given attachment ids scoped to the entity + university.

Per-module wiring (news, events, jobs, feed):

- **Create schema** gains `attachments?: AttachmentInput[]`.
- **Update schema** gains `attachments?: AttachmentInput[]` (additions) and
  `removedAttachmentIds?: string[]` (removals).
- Service performs entity write, then `addUserAttachments` / `removeAttachments` inside the
  **same transaction** as the entity write.
- Permission reuses each module's existing author/admin update gate; no new auth surface.

Detail endpoints return `attachments` (array, possibly empty):

- news detail — already returns it ✅
- event detail — add `getAttachmentsFor('event', id)`
- job detail — add `getAttachmentsFor('job', id)`
- post detail — add `getAttachmentsFor('post', id)`

(List endpoints unchanged; attachments are a detail-view concern. A count badge on cards
can be a later enhancement — YAGNI for now.)

## Frontend (`apps/web`)

New shared component **`AttachmentPicker`** (`src/components/`):

- Accepts file selections, validates type + size client-side (shared constants).
- For each file: `GET /upload/presign?filename&contentType` → PUT bytes to R2 →
  collect `{ fileUrl, fileName, mimeType, sizeBytes }`.
- Shows per-file progress and allows removing a staged file before submit.
- Emits the `AttachmentInput[]` to the parent form.

Reuse existing **`AttachmentList`** (`src/features/content-sync`) to render attachments in
`EventDetailPage`, `JobDetailPage`, `PostDetailPage` (news already renders it).

Composer/edit wiring:

- News create/edit, event create/edit, job create/edit, post composer get the
  `AttachmentPicker`; their mutation hooks pass `attachments` (and `removedAttachmentIds`
  on edit) through to the API.
- **Posts:** existing `media_urls` image gallery stays untouched; attachments render as a
  separate row of file chips.

## Error handling

- Over-limit count or disallowed type → `badRequest()` from the service helper; client
  blocks before upload with an inline message.
- Presign/upload failure on the client → staged file marked failed, removable, form still
  submittable without it.
- Removing a non-existent / cross-entity attachment id is a no-op (scoped delete).

## Testing

Backend integration tests (per module, supertest + `loginAs` + `x-university-domain`):

- create-with-attachments → attachments present in detail response.
- update adds new + removes by id.
- non-author/non-admin update with attachments → 403.
- disallowed mime type / over-max count → 400.

Frontend (`@testing-library/react` + MSW):

- `AttachmentPicker` rejects oversize/disallowed files; happy path stages and emits inputs.

## Follow-ups (not in this spec)

- Fix content-sync parser to extract attachment URLs from notice/event content so
  auto-capture repopulates `content_attachments`.
- Optional: attachment-count badge on feed/job/event list cards.
