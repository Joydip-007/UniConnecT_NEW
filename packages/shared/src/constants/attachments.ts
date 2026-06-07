// Attachment limits + allowlist, shared by the API (server-side enforcement) and the web
// client (pre-upload validation for UX). Keep the two in lockstep.

/** Max attachments allowed on a single entity (notice/event/job/post). */
export const MAX_ATTACHMENTS_PER_ENTITY = 10

/** Max size of a single uploaded attachment, in bytes (25 MB). */
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024

/** Allowed MIME types for user-uploaded attachments: documents + images. */
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const

/** Allowed file extensions (lowercase, no dot) — the fallback when a MIME type is absent
 *  or generic (e.g. application/octet-stream from some browsers). */
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
] as const

export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]

/** Returns the lowercase extension of a file name without the dot, or '' if none. */
export function attachmentExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''
}

/** True if a file is an allowed attachment by MIME type or, failing that, by extension. */
export function isAllowedAttachment(fileName: string, mimeType?: string | null): boolean {
  if (mimeType && (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return true
  }
  return (ALLOWED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(attachmentExtension(fileName))
}
