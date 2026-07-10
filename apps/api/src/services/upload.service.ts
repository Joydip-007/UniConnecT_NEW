import { randomUUID } from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env'
import { badRequest } from '../utils/errors'

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  ...(env.AWS_ENDPOINT && {
    endpoint: env.AWS_ENDPOINT,   // https://<accountid>.r2.cloudflarestorage.com
    forcePathStyle: false,        // R2 uses virtual-hosted-style (default for R2)
  }),
})

export interface CreateUploadCommandInput {
  fileName: string
  contentType: string
  folder?: string
}

export interface PresignedUpload {
  uploadUrl: string
  publicUrl: string
}

export function createUploadKey(input: CreateUploadCommandInput) {
  const safeFileName = sanitizeFileName(input.fileName)
  const folder = input.folder?.replace(/^\/+|\/+$/g, '') || 'uploads'
  return `${folder}/${randomUUID()}-${safeFileName}`
}

export function createPutObjectCommand(input: CreateUploadCommandInput) {
  const key = createUploadKey(input)

  return {
    key,
    command: new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      ContentType: input.contentType,
    }),
  }
}

export async function getPresignedUploadUrl(key: string, contentType: string): Promise<PresignedUpload> {
  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return {
    uploadUrl: await getSignedUrl(s3Client, command, { expiresIn: 300 }),
    publicUrl: buildPublicUrl(key),
  }
}

/** Returns the public CDN URL for a stored object key. */
export function buildPublicUrl(key: string): string {
  if (env.AWS_PUBLIC_URL) {
    return `${env.AWS_PUBLIC_URL.replace(/\/$/, '')}/${encodeS3Key(key)}`
  }
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${encodeS3Key(key)}`
}

/** Base prefix every publicUrl returned by this service starts with — used to validate client-supplied URLs actually point at our own bucket. */
export function getPublicUrlPrefix(): string {
  return env.AWS_PUBLIC_URL
    ? `${env.AWS_PUBLIC_URL.replace(/\/$/, '')}/`
    : `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/`
}

/**
 * Allowed content types for document/note/assignment-style attachment uploads (PDFs, office docs,
 * images). Shared across modules (groups, academic) that presign uploads for these kinds of files —
 * do not duplicate this list; import it or `assertAllowedUploadType` instead.
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

/** Throws badRequest if contentType is not in the shared upload allowlist. Call before presigning. */
export function assertAllowedUploadType(contentType: string) {
  if (!(ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw badRequest('Unsupported file type', 'UPLOAD_TYPE_NOT_ALLOWED')
  }
}

/**
 * Verifies every attachment/file-url a client submits actually points at a file this tenant uploaded
 * via the presign flow (our own bucket prefix) — prevents persisting arbitrary external/foreign URLs
 * as "attachments". Call after auth checks, before persisting, on any client-supplied URL list.
 */
export function assertAttachmentUrlsAreOwnUploads(items: { url: string }[] | undefined) {
  if (!items?.length) return
  const prefix = getPublicUrlPrefix()
  for (const item of items) {
    if (!item.url.startsWith(prefix)) {
      throw badRequest('Attachment URL must point to a file uploaded via the presign endpoint', 'ATTACHMENT_URL_INVALID')
    }
  }
}

export const uploadService = {
  getPresignedUploadUrl,
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function encodeS3Key(key: string) {
  return key.split('/').map(encodeURIComponent).join('/')
}
